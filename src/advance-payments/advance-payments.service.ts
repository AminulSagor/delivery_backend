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
import { Merchant } from '../merchant/entities/merchant.entity';
import { CreateAdvancePaymentDto } from './dto/create-advance.dto';
import { UpdateAdvancePaymentDto } from './dto/update-advance.dto';
import {
  MerchantActionDto,
  MerchantActionType,
} from './dto/merchant-action.dto';
import {
  AdvancePaymentReviewAction,
  ReviewAdvancePaymentDto,
} from './dto/review-advance.dto';
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
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    private readonly merchantFinanceService: MerchantFinanceService,
  ) {}

  private async assertAdvancePaymentsEnabled(merchantId: string) {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (merchant.is_advance_payment_disabled) {
      throw new ForbiddenException(
        'Advance payment feature is disabled for this merchant',
      );
    }
    return merchant;
  }

  private calculateNetAmount(
    dto: Pick<
      CreateAdvancePaymentDto | UpdateAdvancePaymentDto,
      | 'total_collectable_amount'
      | 'delivery_fee'
      | 'cod_charge'
      | 'previous_weight_charge'
      | 'return_amount'
      | 'update_amount'
      | 'hold_amount'
      | 'hold_pay'
    >,
  ) {
    const deductions =
      Number(dto.delivery_fee || 0) +
      Number(dto.cod_charge || 0) +
      Number(dto.previous_weight_charge || 0) +
      Number(dto.return_amount || 0) +
      Number(dto.update_amount || 0) +
      Number(dto.hold_amount || 0) +
      Number(dto.hold_pay || 0);

    return Number(dto.total_collectable_amount || 0) - deductions;
  }

  // --- 1. Admin Creates Manual Invoice ---
  async create(dto: CreateAdvancePaymentDto, admin: User) {
    await this.assertAdvancePaymentsEnabled(dto.merchant_id);
    const netAmount = this.calculateNetAmount(dto);

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

    if (advance.merchant?.is_advance_payment_disabled) {
      throw new ForbiddenException(
        'Advance payment feature is disabled for this merchant',
      );
    }

    // Security check: ensure the logged-in merchant owns this invoice
    if (advance.merchant_id !== merchantUserId) {
      throw new BadRequestException('Unauthorized access to this invoice');
    }

    if (advance.status !== AdvancePaymentStatus.PENDING_MERCHANT_APPROVAL) {
      throw new BadRequestException('Action not allowed in current status');
    }

    if (dto.action === MerchantActionType.APPROVE) {
      advance.status = AdvancePaymentStatus.APPROVED_BY_MERCHANT;
      advance.merchant_review_note = '';

      return await this.finalizeAdvancePayment(
        advance,
        merchantUserId,
        'merchant approval',
      );
    } else {
      if (!dto.review_note)
        throw new BadRequestException('Review note is required');
      advance.status = AdvancePaymentStatus.MERCHANT_REVIEW_REQUESTED;
      advance.merchant_review_note = dto.review_note;
    }

    return await this.advanceRepo.save(advance);
  }

  private async finalizeAdvancePayment(
    advance: AdvancePayment,
    actorId: string,
    actorLabel: string,
  ) {
    if (advance.status !== AdvancePaymentStatus.APPROVED_BY_MERCHANT) {
      throw new BadRequestException(
        'Merchant must approve the invoice before payment',
      );
    }

    if (advance.is_paid) throw new BadRequestException('Already paid');

    await this.merchantFinanceService.createTransaction({
      merchant_id: advance.merchant.user_id,
      amount: -Math.abs(advance.net_amount_paid),
      transaction_type: FinanceTransactionType.ADVANCE_PAYMENT,
      description: `Advance Payment - Invoice ${advance.invoice_id}`,
      reference_id: advance.id,
      reference_type: FinanceReferenceType.ADVANCE_PAYMENT,
      created_by: actorId,
    });

    advance.status = AdvancePaymentStatus.PAID;
    advance.is_paid = true;
    advance.paid_at = new Date();

    const saved = await this.advanceRepo.save(advance);

    this.logger.log(
      `Advance payment completed via ${actorLabel}. Invoice: ${advance.id}, Actor: ${actorId}`,
    );

    return saved;
  }

  // --- 3. Admin Updates (If Merchant Requested Review) ---
  async update(id: string, dto: UpdateAdvancePaymentDto) {
    const advance = await this.advanceRepo.findOne({
      where: { id },
      relations: ['merchant'],
    });
    if (!advance) throw new NotFoundException('Invoice not found');

    if (advance.merchant?.is_advance_payment_disabled) {
      throw new ForbiddenException(
        'Advance payment feature is disabled for this merchant',
      );
    }

    if (advance.is_paid)
      throw new BadRequestException('Cannot update a paid invoice');

    const nextMerchantId = dto.merchant_id || advance.merchant_id;
    await this.assertAdvancePaymentsEnabled(nextMerchantId);

    Object.assign(advance, dto);
    advance.merchant_id = nextMerchantId;
    advance.net_amount_paid = this.calculateNetAmount({
      total_collectable_amount: advance.total_collectable_amount,
      delivery_fee: advance.delivery_fee,
      cod_charge: advance.cod_charge,
      previous_weight_charge: advance.previous_weight_charge,
      return_amount: advance.return_amount,
      update_amount: advance.update_amount,
      hold_amount: advance.hold_amount,
      hold_pay: advance.hold_pay,
    });
    advance.status = AdvancePaymentStatus.PENDING_MERCHANT_APPROVAL; // Reset for re-approval

    return await this.advanceRepo.save(advance);
  }

  async review(id: string, dto: ReviewAdvancePaymentDto, admin: User) {
    const advance = await this.advanceRepo.findOne({
      where: { id },
      relations: ['merchant'],
    });

    if (!advance) throw new NotFoundException('Invoice not found');

    if (advance.merchant?.is_advance_payment_disabled) {
      throw new ForbiddenException(
        'Advance payment feature is disabled for this merchant',
      );
    }

    if (advance.status !== AdvancePaymentStatus.MERCHANT_REVIEW_REQUESTED) {
      throw new BadRequestException(
        'Only merchant review requests can be reviewed by admin',
      );
    }

    if (
      dto.action === AdvancePaymentReviewAction.REJECT &&
      !dto.admin_note?.trim()
    ) {
      throw new BadRequestException('admin_note is required when rejecting');
    }

    if (dto.action === AdvancePaymentReviewAction.APPROVE) {
      const nextMerchantId = dto.merchant_id || advance.merchant_id;
      await this.assertAdvancePaymentsEnabled(nextMerchantId);

      if (dto.merchant_id && dto.merchant_id !== advance.merchant_id) {
        throw new BadRequestException('Merchant cannot be changed during review');
      }

      Object.assign(advance, dto);
      advance.merchant_id = nextMerchantId;
      advance.net_amount_paid = this.calculateNetAmount({
        total_collectable_amount: advance.total_collectable_amount,
        delivery_fee: advance.delivery_fee,
        cod_charge: advance.cod_charge,
        previous_weight_charge: advance.previous_weight_charge,
        return_amount: advance.return_amount,
        update_amount: advance.update_amount,
        hold_amount: advance.hold_amount,
        hold_pay: advance.hold_pay,
      });
      advance.admin_note = dto.admin_note?.trim() || advance.admin_note;
    } else {
      advance.admin_note = dto.admin_note?.trim() || null;
    }

    advance.status = AdvancePaymentStatus.PENDING_MERCHANT_APPROVAL;

    const saved = await this.advanceRepo.save(advance);

    this.logger.log(
      `Advance payment review processed. Invoice: ${id}, Action: ${dto.action}, Admin: ${admin.id}`,
    );

    return saved;
  }

  // --- 4. THE INTERLINK: Payment & Balance Deduction ---
  async pay(id: string, admin: User) {
    const advance = await this.advanceRepo.findOne({
      where: { id },
      relations: ['merchant'],
    });

    if (!advance) throw new NotFoundException('Invoice not found');

    if (advance.merchant?.is_advance_payment_disabled) {
      throw new ForbiddenException(
        'Advance payment feature is disabled for this merchant',
      );
    }

    return await this.finalizeAdvancePayment(advance, admin.id, 'admin pay');
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
    queryBuilder.orderBy(`ap.${sortBy}`, order);
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
      throw new ForbiddenException(
        'You do not have permission to view this invoice',
      );
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
          update_amount: Number(advance.update_amount || 0),
          hold_amount: Number(advance.hold_amount || 0),
          hold_pay: Number(advance.hold_pay || 0),
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
