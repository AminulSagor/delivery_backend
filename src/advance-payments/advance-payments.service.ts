import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AdvancePayment,
  AdvancePaymentStatus,
} from './entities/advance-payment.entity';
import { CreateAdvancePaymentDto } from './dto/create-advance.dto';
import {
  MerchantActionDto,
  MerchantActionType,
} from './dto/merchant-action.dto';
import { MerchantFinanceService } from '../merchant-finance/merchant-finance.service';
import { User } from '../users/entities/user.entity';
import {
  FinanceReferenceType,
  FinanceTransactionType,
} from '../common/enums/finance-transaction-type.enum'; // Ensure you add ADVANCE_PAYMENT to this enum
import { GetAdvancePaymentsQueryDto } from './dto/get-advance-payments.dto';
import {
  PaginatedResponse,
  PaginationMeta,
} from 'src/common/dto/pagination.dto';

@Injectable()
export class AdvancePaymentsService {
  private readonly logger = new Logger(AdvancePaymentsService.name);

  constructor(
    @InjectRepository(AdvancePayment)
    private readonly advanceRepo: Repository<AdvancePayment>,
    private readonly merchantFinanceService: MerchantFinanceService,
  ) {}

  // --- 1. Admin Creates Manual Invoice ---
  async create(dto: CreateAdvancePaymentDto, admin: User) {
    // Manual Calculation logic
    const deductions =
      Number(dto.delivery_fee) +
      Number(dto.cod_charge) +
      Number(dto.previous_weight_charge) +
      Number(dto.return_amount);

    const netAmount = Number(dto.total_collectable_amount) - deductions;

    const invoiceId = `ADV-${Date.now().toString().slice(-6)}`;

    const advance = this.advanceRepo.create({
      ...dto,
      created_by_id: admin.id,
      invoice_id: invoiceId,
      net_amount_paid: netAmount,
      status: AdvancePaymentStatus.PENDING_MERCHANT_APPROVAL,
    });

    return await this.advanceRepo.save(advance);
  }

  // --- 2. Merchant Approval Workflow ---
  async merchantAction(
    id: string,
    dto: MerchantActionDto,
    merchantUserId: string,
  ) {
    // Find advance linked to this merchant
    const advance = await this.advanceRepo.findOne({
      where: { id },
      relations: ['merchant'],
    });

    if (!advance) throw new NotFoundException('Invoice not found');

    // Security check: ensure the logged-in merchant owns this invoice
    if (advance.merchant.user_id !== merchantUserId) {
      throw new BadRequestException('Unauthorized access to this invoice');
    }

    if (advance.status !== AdvancePaymentStatus.PENDING_MERCHANT_APPROVAL) {
      throw new BadRequestException('Action not allowed in current status');
    }

    if (dto.action === MerchantActionType.APPROVE) {
      advance.status = AdvancePaymentStatus.APPROVED_BY_MERCHANT;
      advance.merchant_review_note = '';
    } else {
      if (!dto.review_note)
        throw new BadRequestException('Review note is required');
      advance.status = AdvancePaymentStatus.MERCHANT_REVIEW_REQUESTED;
      advance.merchant_review_note = dto.review_note;
    }

    return await this.advanceRepo.save(advance);
  }

  // --- 3. Admin Updates (If Merchant Requested Review) ---
  async update(id: string, dto: CreateAdvancePaymentDto) {
    const advance = await this.advanceRepo.findOne({ where: { id } });
    if (!advance) throw new NotFoundException('Invoice not found');
    if (advance.is_paid)
      throw new BadRequestException('Cannot update a paid invoice');

    const deductions =
      Number(dto.delivery_fee) +
      Number(dto.cod_charge) +
      Number(dto.previous_weight_charge) +
      Number(dto.return_amount);
    const netAmount = Number(dto.total_collectable_amount) - deductions;

    Object.assign(advance, dto);
    advance.net_amount_paid = netAmount;
    advance.status = AdvancePaymentStatus.PENDING_MERCHANT_APPROVAL; // Reset for re-approval

    return await this.advanceRepo.save(advance);
  }

  // --- 4. THE INTERLINK: Payment & Balance Deduction ---
  async pay(id: string, admin: User) {
    const advance = await this.advanceRepo.findOne({
      where: { id },
      relations: ['merchant'],
    });

    if (!advance) throw new NotFoundException('Invoice not found');

    if (advance.status !== AdvancePaymentStatus.APPROVED_BY_MERCHANT) {
      throw new BadRequestException(
        'Merchant must approve the invoice before payment',
      );
    }

    if (advance.is_paid) throw new BadRequestException('Already paid');

    // === CRITICAL: INTERLINK WITH FINANCE ===
    // We record a transaction that REDUCES the merchant's balance.
    // Ensure 'ADVANCE_PAYMENT' is added to your FinanceTransactionType enum

    // Note: We send the amount as negative because we are GIVING money before earning it.
    // Or, depending on your finance logic, 'WITHDRAWAL' type automatically subtracts.
    // Let's assume createTransaction handles sign based on type, or we pass negative.

    await this.merchantFinanceService.createTransaction({
      merchant_id: advance.merchant.user_id, // Use User ID as merchant_id per your schema
      amount: -Math.abs(advance.net_amount_paid), // Negative to reduce balance
      transaction_type: FinanceTransactionType.ADVANCE_PAYMENT, // You need to add this
      description: `Advance Payment - Invoice ${advance.invoice_id}`,
      reference_id: advance.id,
      reference_type: FinanceReferenceType.ADVANCE_PAYMENT,
      created_by: admin.id,
    });

    advance.status = AdvancePaymentStatus.PAID;
    advance.is_paid = true;
    advance.paid_at = new Date();

    return await this.advanceRepo.save(advance);
  }

  async findAll(
    query: GetAdvancePaymentsQueryDto,
    currentUserMerchantId?: string, // If present, forces merchant filter
  ): Promise<PaginatedResponse<any>> {
    // Returning 'any' to allow mapped minimal object
    const {
      page = 1,
      limit = 10,
      status,
      merchant_id,
      search,
      start_date,
      end_date,
      sortBy = 'created_at',
      order = 'DESC',
    } = query;

    const skip = (page - 1) * limit;

    const queryBuilder = this.advanceRepo
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'user');

    // 1. Ownership / Merchant Filter
    if (currentUserMerchantId) {
      // If merchant is logged in, force their ID
      queryBuilder.andWhere('ap.merchant_id = :mid', {
        mid: currentUserMerchantId,
      });
    } else if (merchant_id) {
      // If admin is searching for a specific merchant
      queryBuilder.andWhere('ap.merchant_id = :mid', { mid: merchant_id });
    }

    // 2. Status Filter
    if (status) {
      queryBuilder.andWhere('ap.status = :status', { status });
    }

    // 3. Search (Invoice ID)
    if (search) {
      queryBuilder.andWhere('ap.invoice_id ILIKE :search', {
        search: `%${search}%`,
      });
    }

    // 4. Date Range
    if (start_date && end_date) {
      queryBuilder.andWhere('ap.created_at BETWEEN :start AND :end', {
        start: start_date,
        end: end_date,
      });
    }

    // 5. Sort & Pagination
    queryBuilder.orderBy(`ap.${sortBy}`, order as 'ASC' | 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    // 6. Map to Minimal Response
    // We only return what is needed for the list view design
    const mappedItems = items.map((item) => ({
      id: item.id,
      invoice_id: item.invoice_id,
      created_at: item.created_at,
      merchant_name: item.merchant?.user?.full_name || 'N/A', // Helpful for Admin
      merchant_phone: item.merchant?.user?.phone || 'N/A', // Helpful for Admin
      total_parcels: item.total_parcels,
      net_amount: Number(item.net_amount_paid),
      status: item.status,
      is_paid: item.is_paid,
      paid_at: item.paid_at,
    }));

    const pagination: PaginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return {
      items: mappedItems,
      pagination,
    };
  }

  /**
   * Get Single Advance Payment by ID
   * Includes security check for merchants
   */
  async findOne(id: string, currentUserMerchantId?: string) {
    const advance = await this.advanceRepo.findOne({
      where: { id },
      relations: ['merchant', 'merchant.user', 'createdBy'],
    });

    if (!advance) {
      throw new NotFoundException('Advance payment invoice not found');
    }

    // Security Check: If a merchant is calling, they must own this invoice
    if (
      currentUserMerchantId &&
      advance.merchant_id !== currentUserMerchantId
    ) {
      // Fixed: using merchant_id column directly usually matches user_id in your schema, or check relation
      // NOTE: In your schema, advance.merchant_id is a UUID.
      // If currentUserMerchantId passed here is the User ID (which equals Merchant ID in your system usually), this works.
      // If they are different tables, ensure you compare correct IDs.
      // Based on previous files: Merchant entity has `user_id`.
      // The `merchantId` from token usually refers to the User ID of the merchant.

      // Let's verify via the relation to be safe if ids differ:
      if (advance.merchant.user_id !== currentUserMerchantId) {
        throw new ForbiddenException(
          'You do not have permission to view this invoice',
        );
      }
    }

    // Return full details for the detail view
    return {
      id: advance.id,
      invoice_id: advance.invoice_id,
      status: advance.status,
      created_at: advance.created_at,
      paid_at: advance.paid_at,
      is_paid: advance.is_paid,

      // Merchant Info
      merchant: {
        id: advance.merchant.id,
        name: advance.merchant.user?.full_name,
        phone: advance.merchant.user?.phone,
      },

      // Calculation Breakdown
      breakdown: {
        total_parcels: advance.total_parcels,
        total_collectable: Number(advance.total_collectable_amount),
        deductions: {
          delivery_fee: Number(advance.delivery_fee),
          cod_charge: Number(advance.cod_charge),
          weight_charge: Number(advance.previous_weight_charge),
          return_charge: Number(advance.return_amount),
        },
        net_payable: Number(advance.net_amount_paid),
      },

      // Workflow Info
      payment_method: advance.payment_method,
      admin_note: advance.admin_note,
      merchant_review_note: advance.merchant_review_note,
      created_by: advance.createdBy?.full_name || 'Admin',
    };
  }
}
