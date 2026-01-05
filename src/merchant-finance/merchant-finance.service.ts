import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between, ILike } from 'typeorm';
import { MerchantFinance } from './entities/merchant-finance.entity';
import { MerchantFinanceTransaction } from './entities/merchant-finance-transaction.entity';
import { User } from '../users/entities/user.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Parcel, ParcelStatus } from '../parcels/entities/parcel.entity';
import {
  FinanceTransactionType,
  FinanceReferenceType,
} from '../common/enums/finance-transaction-type.enum';
import {
  CreateTransactionDto,
  RecordParcelTransactionDto,
} from './dto/create-transaction.dto';
import { GetTransactionsQueryDto, GetAllMerchantsFinanceQueryDto } from './dto/get-transactions.dto';
import { AdjustBalanceDto, HoldBalanceDto, ReleaseHoldDto, ProcessWithdrawalDto } from './dto/adjust-balance.dto';
import {
  MerchantFinanceOverview,
  TransactionListResponse,
  AdminFinanceSummary,
} from './dto/finance-dashboard.dto';

@Injectable()
export class MerchantFinanceService {
  private readonly logger = new Logger(MerchantFinanceService.name);

  constructor(
    @InjectRepository(MerchantFinance)
    private financeRepository: Repository<MerchantFinance>,
    @InjectRepository(MerchantFinanceTransaction)
    private transactionRepository: Repository<MerchantFinanceTransaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @InjectRepository(Parcel)
    private parcelRepository: Repository<Parcel>,
    private dataSource: DataSource,
  ) {}

  // ===== FINANCE RECORD MANAGEMENT =====

  /**
   * Get or create merchant finance record
   */
  async getOrCreateFinance(merchantId: string): Promise<MerchantFinance> {
    let finance = await this.financeRepository.findOne({
      where: { merchant_id: merchantId },
    });

    if (!finance) {
      // Create new finance record
      finance = this.financeRepository.create({
        merchant_id: merchantId,
        current_balance: 0,
        pending_balance: 0,
        invoiced_balance: 0,
        processing_balance: 0,
        hold_amount: 0,
        total_earned: 0,
        total_withdrawn: 0,
        total_delivery_charges: 0,
        total_return_charges: 0,
        total_cod_collected: 0,
        total_parcels_delivered: 0,
        total_parcels_returned: 0,
        credit_limit: 0,
        credit_used: 0,
      });
      await this.financeRepository.save(finance);
      this.logger.log(`Created finance record for merchant ${merchantId}`);
    }

    return finance;
  }

  /**
   * Get merchant finance overview/dashboard
   */
  async getMerchantFinanceOverview(merchantId: string): Promise<MerchantFinanceOverview> {
    const finance = await this.getOrCreateFinance(merchantId);

    // Get user info
    const user = await this.userRepository.findOne({
      where: { id: merchantId },
    });

    if (!user) {
      throw new NotFoundException('Merchant not found');
    }

    // Get merchant profile
    const merchant = await this.merchantRepository.findOne({
      where: { user_id: merchantId },
    });

    return {
      merchant: {
        id: merchant?.id || '',
        user_id: user.id,
        name: user.full_name,
        phone: user.phone,
        email: user.email,
      },
      balance: {
        current_balance: Number(finance.current_balance),
        pending_balance: Number(finance.pending_balance),
        invoiced_balance: Number(finance.invoiced_balance),
        processing_balance: Number(finance.processing_balance),
        hold_amount: Number(finance.hold_amount),
        available_for_withdrawal: Math.max(
          0,
          Number(finance.current_balance) - Number(finance.hold_amount)
        ),
      },
      lifetime_stats: {
        total_earned: Number(finance.total_earned),
        total_withdrawn: Number(finance.total_withdrawn),
        total_cod_collected: Number(finance.total_cod_collected),
        total_delivery_charges: Number(finance.total_delivery_charges),
        total_return_charges: Number(finance.total_return_charges),
        total_parcels_delivered: finance.total_parcels_delivered,
        total_parcels_returned: finance.total_parcels_returned,
      },
      credit: {
        credit_limit: Number(finance.credit_limit),
        credit_used: Number(finance.credit_used),
        credit_available: Math.max(
          0,
          Number(finance.credit_limit) - Number(finance.credit_used)
        ),
      },
      last_activity: {
        last_transaction_at: finance.last_transaction_at,
        last_withdrawal_at: finance.last_withdrawal_at,
      },
    };
  }

  // ===== TRANSACTION RECORDING =====

  /**
   * Record a parcel delivery transaction
   * Called when parcel reaches terminal status (DELIVERED, PARTIAL_DELIVERY, etc.)
   */
  async recordParcelTransaction(
    merchantId: string,
    dto: RecordParcelTransactionDto,
    createdBy?: string,
  ): Promise<MerchantFinanceTransaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get or create finance record
      let finance = await queryRunner.manager.findOne(MerchantFinance, {
        where: { merchant_id: merchantId },
      });

      if (!finance) {
        finance = queryRunner.manager.create(MerchantFinance, {
          merchant_id: merchantId,
        });
        await queryRunner.manager.save(MerchantFinance, finance);
      }

      const balanceBefore = Number(finance.pending_balance);
      const netPayable = dto.net_payable;

      // Determine reference type based on parcel status
      let referenceType: FinanceReferenceType;
      let transactionType: FinanceTransactionType;

      const deliveredStatuses = ['DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE'];
      const returnedStatuses = ['RETURNED', 'PAID_RETURN', 'RETURNED_TO_HUB', 'RETURN_TO_MERCHANT'];

      if (deliveredStatuses.includes(dto.parcel_status)) {
        referenceType = dto.parcel_status === 'PARTIAL_DELIVERY'
          ? FinanceReferenceType.PARCEL_PARTIAL_DELIVERY
          : dto.parcel_status === 'EXCHANGE'
          ? FinanceReferenceType.PARCEL_EXCHANGE
          : FinanceReferenceType.PARCEL_DELIVERED;
        transactionType = netPayable >= 0 ? FinanceTransactionType.CREDIT : FinanceTransactionType.DEBIT;

        // Update delivered count
        finance.total_parcels_delivered += 1;
      } else if (returnedStatuses.includes(dto.parcel_status)) {
        referenceType = dto.parcel_status === 'PAID_RETURN'
          ? FinanceReferenceType.PARCEL_PAID_RETURN
          : FinanceReferenceType.RETURN_CHARGE;
        transactionType = netPayable >= 0 ? FinanceTransactionType.CREDIT : FinanceTransactionType.DEBIT;

        // Update returned count
        finance.total_parcels_returned += 1;
      } else {
        throw new BadRequestException(`Invalid parcel status: ${dto.parcel_status}`);
      }

      // Update pending balance (money waiting to be invoiced)
      const newPendingBalance = balanceBefore + netPayable;
      finance.pending_balance = newPendingBalance;

      // Update lifetime stats
      finance.total_cod_collected = Number(finance.total_cod_collected) + dto.cod_collected;
      finance.total_delivery_charges = Number(finance.total_delivery_charges) + dto.delivery_charge;
      finance.total_return_charges = Number(finance.total_return_charges) + dto.return_charge;
      finance.last_transaction_at = new Date();

      await queryRunner.manager.save(MerchantFinance, finance);

      // Create transaction record
      const transaction = queryRunner.manager.create(MerchantFinanceTransaction, {
        merchant_id: merchantId,
        transaction_type: transactionType,
        amount: Math.abs(netPayable),
        balance_before: balanceBefore,
        balance_after: newPendingBalance,
        reference_type: referenceType,
        reference_id: dto.parcel_id,
        reference_code: dto.tracking_number,
        description: dto.description || `Parcel ${dto.tracking_number} - ${dto.parcel_status}`,
        cod_amount: dto.cod_collected,
        delivery_charge: dto.delivery_charge,
        return_charge: dto.return_charge,
        created_by: createdBy,
        metadata: {
          parcel_status: dto.parcel_status,
        },
      });

      await queryRunner.manager.save(MerchantFinanceTransaction, transaction);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Recorded parcel transaction for merchant ${merchantId}: ${dto.tracking_number} = ${netPayable}`,
      );

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to record parcel transaction: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Move balance from pending to invoiced when invoice is created
   */
  async moveToInvoiced(
    merchantId: string,
    amount: number,
    invoiceId: string,
    invoiceNo: string,
    createdBy?: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const finance = await queryRunner.manager.findOne(MerchantFinance, {
        where: { merchant_id: merchantId },
      });

      if (!finance) {
        throw new NotFoundException('Merchant finance record not found');
      }

      // Decrease pending, increase invoiced
      finance.pending_balance = Number(finance.pending_balance) - amount;
      finance.invoiced_balance = Number(finance.invoiced_balance) + amount;
      finance.last_transaction_at = new Date();

      await queryRunner.manager.save(MerchantFinance, finance);

      // No transaction record needed for internal balance movement
      // The invoice itself serves as the record

      await queryRunner.commitTransaction();

      this.logger.log(
        `Moved ${amount} from pending to invoiced for merchant ${merchantId}, invoice ${invoiceNo}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Move balance from invoiced to processing when admin starts processing
   */
  async moveToProcessing(
    merchantId: string,
    amount: number,
    invoiceId: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const finance = await queryRunner.manager.findOne(MerchantFinance, {
        where: { merchant_id: merchantId },
      });

      if (!finance) {
        throw new NotFoundException('Merchant finance record not found');
      }

      // Move from invoiced to processing
      finance.invoiced_balance = Number(finance.invoiced_balance) - amount;
      finance.processing_balance = Number(finance.processing_balance) + amount;

      await queryRunner.manager.save(MerchantFinance, finance);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Moved ${amount} from invoiced to processing for merchant ${merchantId}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Move balance back from processing to invoiced (if payment cancelled)
   */
  async moveBackToInvoiced(
    merchantId: string,
    amount: number,
    invoiceId: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const finance = await queryRunner.manager.findOne(MerchantFinance, {
        where: { merchant_id: merchantId },
      });

      if (!finance) {
        throw new NotFoundException('Merchant finance record not found');
      }

      // Move back from processing to invoiced
      finance.processing_balance = Number(finance.processing_balance) - amount;
      finance.invoiced_balance = Number(finance.invoiced_balance) + amount;

      await queryRunner.manager.save(MerchantFinance, finance);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Moved ${amount} back from processing to invoiced for merchant ${merchantId}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Record invoice payment (withdrawal from merchant balance)
   */
  async recordInvoicePayment(
    merchantId: string,
    amount: number,
    invoiceId: string,
    invoiceNo: string,
    paymentReference: string | null,
    paidBy: string,
  ): Promise<MerchantFinanceTransaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const finance = await queryRunner.manager.findOne(MerchantFinance, {
        where: { merchant_id: merchantId },
      });

      if (!finance) {
        throw new NotFoundException('Merchant finance record not found');
      }

      // Get current balance before withdrawal
      // The amount should be in either invoiced or processing balance
      const processingAmount = Number(finance.processing_balance);
      const invoicedAmount = Number(finance.invoiced_balance);

      // Deduct from processing first, then invoiced
      let deductFromProcessing = Math.min(amount, processingAmount);
      let deductFromInvoiced = amount - deductFromProcessing;

      finance.processing_balance = processingAmount - deductFromProcessing;
      finance.invoiced_balance = invoicedAmount - deductFromInvoiced;

      // Update lifetime stats
      finance.total_withdrawn = Number(finance.total_withdrawn) + amount;
      finance.total_earned = Number(finance.total_earned) + amount;
      finance.last_withdrawal_at = new Date();
      finance.last_transaction_at = new Date();

      await queryRunner.manager.save(MerchantFinance, finance);

      // Create transaction record for the withdrawal
      const transaction = queryRunner.manager.create(MerchantFinanceTransaction, {
        merchant_id: merchantId,
        transaction_type: FinanceTransactionType.DEBIT,
        amount: amount,
        balance_before: processingAmount + invoicedAmount,
        balance_after: Number(finance.processing_balance) + Number(finance.invoiced_balance),
        reference_type: FinanceReferenceType.INVOICE_PAID,
        reference_id: invoiceId,
        reference_code: invoiceNo,
        description: `Invoice payment: ${invoiceNo}`,
        notes: paymentReference,
        created_by: paidBy,
        metadata: {
          payment_reference: paymentReference,
        },
      });

      await queryRunner.manager.save(MerchantFinanceTransaction, transaction);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Recorded invoice payment for merchant ${merchantId}: ${invoiceNo} = ${amount}`,
      );

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to record invoice payment: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ===== ADMIN ADJUSTMENTS =====

  /**
   * Admin: Adjust merchant balance (credit or debit)
   */
  async adjustBalance(
    merchantId: string,
    dto: AdjustBalanceDto,
    adminUserId: string,
  ): Promise<MerchantFinanceTransaction> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const finance = await this.getOrCreateFinance(merchantId);
      const balanceBefore = Number(finance.current_balance);

      let newBalance: number;
      let referenceType: FinanceReferenceType;

      if (dto.type === FinanceTransactionType.CREDIT) {
        newBalance = balanceBefore + dto.amount;
        referenceType = FinanceReferenceType.ADJUSTMENT_CREDIT;
      } else {
        newBalance = balanceBefore - dto.amount;
        referenceType = FinanceReferenceType.ADJUSTMENT_DEBIT;
      }

      // Update finance record
      await queryRunner.manager.update(
        MerchantFinance,
        { merchant_id: merchantId },
        {
          current_balance: newBalance,
          last_transaction_at: new Date(),
        },
      );

      // Create transaction record
      const transaction = queryRunner.manager.create(MerchantFinanceTransaction, {
        merchant_id: merchantId,
        transaction_type: dto.type,
        amount: dto.amount,
        balance_before: balanceBefore,
        balance_after: newBalance,
        reference_type: referenceType,
        description: dto.reason,
        notes: dto.notes,
        created_by: adminUserId,
      });

      await queryRunner.manager.save(MerchantFinanceTransaction, transaction);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Admin ${adminUserId} adjusted balance for merchant ${merchantId}: ${dto.type} ${dto.amount}`,
      );

      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Admin: Hold merchant balance
   */
  async holdBalance(
    merchantId: string,
    dto: HoldBalanceDto,
    adminUserId: string,
  ): Promise<MerchantFinance> {
    const finance = await this.getOrCreateFinance(merchantId);

    const availableToHold =
      Number(finance.current_balance) - Number(finance.hold_amount);

    if (dto.amount > availableToHold) {
      throw new BadRequestException(
        `Insufficient balance to hold. Available: ${availableToHold}`,
      );
    }

    finance.hold_amount = Number(finance.hold_amount) + dto.amount;
    await this.financeRepository.save(finance);

    this.logger.log(
      `Admin ${adminUserId} held ${dto.amount} for merchant ${merchantId}. Reason: ${dto.reason}`,
    );

    return finance;
  }

  /**
   * Admin: Release held balance
   */
  async releaseHold(
    merchantId: string,
    dto: ReleaseHoldDto,
    adminUserId: string,
  ): Promise<MerchantFinance> {
    const finance = await this.getOrCreateFinance(merchantId);

    if (dto.amount > Number(finance.hold_amount)) {
      throw new BadRequestException(
        `Cannot release more than held amount. Held: ${finance.hold_amount}`,
      );
    }

    finance.hold_amount = Number(finance.hold_amount) - dto.amount;
    await this.financeRepository.save(finance);

    this.logger.log(
      `Admin ${adminUserId} released ${dto.amount} hold for merchant ${merchantId}`,
    );

    return finance;
  }

  // ===== TRANSACTION HISTORY =====

  /**
   * Get merchant transaction history
   */
  async getTransactionHistory(
    merchantId: string,
    query: GetTransactionsQueryDto,
  ): Promise<TransactionListResponse> {
    const {
      page = 1,
      limit = 20,
      transaction_type,
      reference_type,
      from_date,
      to_date,
      sort_by = 'created_at',
      sort_order = 'DESC',
    } = query;

    const queryBuilder = this.transactionRepository
      .createQueryBuilder('txn')
      .where('txn.merchant_id = :merchantId', { merchantId });

    // Apply filters
    if (transaction_type) {
      queryBuilder.andWhere('txn.transaction_type = :transaction_type', {
        transaction_type,
      });
    }

    if (reference_type) {
      queryBuilder.andWhere('txn.reference_type = :reference_type', {
        reference_type,
      });
    }

    if (from_date) {
      queryBuilder.andWhere('txn.created_at >= :from_date', { from_date });
    }

    if (to_date) {
      queryBuilder.andWhere('txn.created_at <= :to_date', { to_date });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply sorting and pagination
    queryBuilder
      .orderBy(`txn.${sort_by}`, sort_order)
      .skip((page - 1) * limit)
      .take(limit);

    const transactions = await queryBuilder.getMany();

    // Calculate summary
    const summaryQueryBuilder = this.transactionRepository
      .createQueryBuilder('txn')
      .select('txn.transaction_type', 'type')
      .addSelect('SUM(txn.amount)', 'total')
      .where('txn.merchant_id = :merchantId', { merchantId })
      .groupBy('txn.transaction_type');

    const summaryResults = await summaryQueryBuilder.getRawMany();

    let totalCredits = 0;
    let totalDebits = 0;

    summaryResults.forEach((result) => {
      if (result.type === FinanceTransactionType.CREDIT) {
        totalCredits = Number(result.total);
      } else {
        totalDebits = Number(result.total);
      }
    });

    return {
      transactions: transactions.map((txn) => ({
        id: txn.id,
        transaction_type: txn.transaction_type,
        amount: Number(txn.amount),
        balance_before: Number(txn.balance_before),
        balance_after: Number(txn.balance_after),
        reference_type: txn.reference_type,
        reference_id: txn.reference_id,
        reference_code: txn.reference_code,
        description: txn.description,
        cod_amount: txn.cod_amount ? Number(txn.cod_amount) : null,
        delivery_charge: txn.delivery_charge ? Number(txn.delivery_charge) : null,
        return_charge: txn.return_charge ? Number(txn.return_charge) : null,
        created_at: txn.created_at,
        created_by: txn.created_by,
      })),
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
      summary: {
        total_credits: totalCredits,
        total_debits: totalDebits,
        net_change: totalCredits - totalDebits,
      },
    };
  }

  // ===== ADMIN VIEWS =====

  /**
   * Admin: Get all merchants finance summary
   */
  async getAllMerchantsFinance(
    query: GetAllMerchantsFinanceQueryDto,
  ): Promise<AdminFinanceSummary> {
    const {
      page = 1,
      limit = 20,
      search,
      has_balance,
      has_pending,
      sort_by = 'current_balance',
      sort_order = 'DESC',
    } = query;

    const queryBuilder = this.financeRepository
      .createQueryBuilder('finance')
      .leftJoin(User, 'user', 'user.id = finance.merchant_id')
      .leftJoin(Merchant, 'merchant', 'merchant.user_id = finance.merchant_id')
      .select([
        'finance.merchant_id as merchant_id',
        'user.id as user_id',
        'user.full_name as name',
        'user.phone as phone',
        'finance.current_balance as current_balance',
        'finance.pending_balance as pending_balance',
        'finance.invoiced_balance as invoiced_balance',
        'finance.total_earned as total_earned',
        'finance.total_parcels_delivered as total_parcels_delivered',
        'finance.last_transaction_at as last_transaction_at',
      ]);

    // Apply filters
    if (search) {
      queryBuilder.andWhere(
        '(user.full_name ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (has_balance) {
      queryBuilder.andWhere('finance.current_balance > 0');
    }

    if (has_pending) {
      queryBuilder.andWhere(
        '(finance.pending_balance > 0 OR finance.invoiced_balance > 0)',
      );
    }

    // Get total count
    const totalCount = await queryBuilder.getCount();

    // Get totals
    const totalsQuery = await this.financeRepository
      .createQueryBuilder('finance')
      .select('COUNT(*)', 'total_merchants')
      .addSelect('SUM(finance.current_balance)', 'total_current_balance')
      .addSelect('SUM(finance.pending_balance)', 'total_pending_balance')
      .addSelect('SUM(finance.invoiced_balance)', 'total_invoiced_balance')
      .addSelect('SUM(finance.processing_balance)', 'total_processing_balance')
      .addSelect('SUM(finance.hold_amount)', 'total_hold_amount')
      .getRawOne();

    // Apply sorting and pagination
    queryBuilder
      .orderBy(`finance.${sort_by}`, sort_order)
      .offset((page - 1) * limit)
      .limit(limit);

    const merchants = await queryBuilder.getRawMany();

    return {
      totals: {
        total_merchants: Number(totalsQuery.total_merchants),
        total_current_balance: Number(totalsQuery.total_current_balance) || 0,
        total_pending_balance: Number(totalsQuery.total_pending_balance) || 0,
        total_invoiced_balance: Number(totalsQuery.total_invoiced_balance) || 0,
        total_processing_balance: Number(totalsQuery.total_processing_balance) || 0,
        total_hold_amount: Number(totalsQuery.total_hold_amount) || 0,
      },
      merchants: merchants.map((m) => ({
        merchant_id: m.merchant_id,
        user_id: m.user_id,
        name: m.name,
        phone: m.phone,
        current_balance: Number(m.current_balance) || 0,
        pending_balance: Number(m.pending_balance) || 0,
        invoiced_balance: Number(m.invoiced_balance) || 0,
        total_earned: Number(m.total_earned) || 0,
        total_parcels_delivered: m.total_parcels_delivered || 0,
        last_transaction_at: m.last_transaction_at,
      })),
      pagination: {
        total: totalCount,
        page,
        limit,
        total_pages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Sync merchant finance from existing parcels
   * Used for initial migration or data reconciliation
   */
  async syncMerchantFinance(merchantId: string): Promise<MerchantFinance> {
    const terminalStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURNED,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
    ];

    const deliveredStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
    ];

    const returnedStatuses = [
      ParcelStatus.RETURNED,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
    ];

    // Get all terminal parcels for this merchant
    const parcels = await this.parcelRepository.find({
      where: {
        merchant_id: merchantId,
        status: In(terminalStatuses),
      },
    });

    let totalCodCollected = 0;
    let totalDeliveryCharges = 0;
    let totalReturnCharges = 0;
    let pendingBalance = 0;
    let invoicedBalance = 0;
    let deliveredCount = 0;
    let returnedCount = 0;
    let totalWithdrawn = 0;

    for (const parcel of parcels) {
      const codCollected = Number(parcel.cod_collected_amount) || 0;
      const deliveryCharge = parcel.delivery_charge_applicable
        ? Number(parcel.total_charge) || 0
        : 0;
      const returnCharge = parcel.return_charge_applicable
        ? Number(parcel.return_charge) || 0
        : 0;
      const netPayable = codCollected - deliveryCharge - returnCharge;

      totalCodCollected += codCollected;
      totalDeliveryCharges += deliveryCharge;
      totalReturnCharges += returnCharge;

      // Categorize by invoice status
      if (parcel.paid_to_merchant) {
        totalWithdrawn += netPayable;
      } else if (parcel.invoice_id) {
        invoicedBalance += netPayable;
      } else {
        pendingBalance += netPayable;
      }

      // Count by status
      if (deliveredStatuses.includes(parcel.status as ParcelStatus)) {
        deliveredCount++;
      } else if (returnedStatuses.includes(parcel.status as ParcelStatus)) {
        returnedCount++;
      }
    }

    // Update or create finance record
    let finance = await this.financeRepository.findOne({
      where: { merchant_id: merchantId },
    });

    if (!finance) {
      finance = this.financeRepository.create({
        merchant_id: merchantId,
      });
    }

    finance.pending_balance = pendingBalance;
    finance.invoiced_balance = invoicedBalance;
    finance.total_cod_collected = totalCodCollected;
    finance.total_delivery_charges = totalDeliveryCharges;
    finance.total_return_charges = totalReturnCharges;
    finance.total_parcels_delivered = deliveredCount;
    finance.total_parcels_returned = returnedCount;
    finance.total_withdrawn = totalWithdrawn;
    finance.total_earned = totalWithdrawn;

    await this.financeRepository.save(finance);

    this.logger.log(`Synced finance for merchant ${merchantId}`);

    return finance;
  }

  /**
   * Sync all merchants' finance records
   */
  async syncAllMerchantsFinance(): Promise<{ synced: number; errors: number }> {
    const merchants = await this.merchantRepository.find();

    let synced = 0;
    let errors = 0;

    for (const merchant of merchants) {
      try {
        await this.syncMerchantFinance(merchant.user_id);
        synced++;
      } catch (error) {
        this.logger.error(
          `Failed to sync finance for merchant ${merchant.user_id}: ${error.message}`,
        );
        errors++;
      }
    }

    return { synced, errors };
  }
}

