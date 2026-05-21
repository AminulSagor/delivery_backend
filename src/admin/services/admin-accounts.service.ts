import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { AdminAccount } from '../entities/admin-account.entity';
import { AdminAccountStatement } from '../entities/admin-account-statement.entity';
import {
  CreateAdminAccountDto,
  UpdateAdminAccountDto,
} from '../dto/create-admin-account.dto';
import {
  AccountReferenceType,
  AccountTransactionType,
} from 'src/common/enums/account-type.enum';
import { ManualTransactionDto } from '../dto/manual-transaction.dto';
import { TransferFundsDto } from '../dto/transfer-funds.dto';
import { UpdateStatementDto } from '../dto/update-statement.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AdminFinanceAnalyticsQueryDto } from '../dto/admin-finance-analytics-query.dto';
import { Parcel, ParcelStatus } from '../../parcels/entities/parcel.entity';
import { HubExpense } from '../../hubs/entities/hub-expense.entity';
import { TransferRecordStatus } from '../../common/enums/transfer-record-status.enum';
import {
  FinanceReferenceType,
  FinanceTransactionType,
} from '../../common/enums/finance-transaction-type.enum';
import { MerchantFinance } from '../../merchant-finance/entities/merchant-finance.entity';
import { MerchantFinanceTransaction } from '../../merchant-finance/entities/merchant-finance-transaction.entity';

@Injectable()
export class AdminAccountsService {
  private readonly logger = new Logger(AdminAccountsService.name);

  constructor(
    @InjectRepository(AdminAccount)
    private accountRepo: Repository<AdminAccount>,
    @InjectRepository(AdminAccountStatement)
    private statementRepo: Repository<AdminAccountStatement>,
    @InjectRepository(Parcel)
    private parcelRepo: Repository<Parcel>,
    @InjectRepository(HubExpense)
    private hubExpenseRepo: Repository<HubExpense>,
    @InjectRepository(MerchantFinance)
    private merchantFinanceRepo: Repository<MerchantFinance>,
    @InjectRepository(MerchantFinanceTransaction)
    private merchantFinanceTransactionRepo: Repository<MerchantFinanceTransaction>,
    private dataSource: DataSource,
  ) {}

  // ===== CRUD OPERATIONS =====

  async create(
    dto: CreateAdminAccountDto,
    userId: string,
  ): Promise<AdminAccount> {
    const existing = await this.accountRepo.findOne({
      where: { account_number: dto.account_number },
    });
    if (existing) {
      throw new ConflictException('Account number already exists');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Account
      const account = queryRunner.manager.create(AdminAccount, {
        ...dto,
        current_balance: dto.opening_balance || 0,
      });
      const savedAccount = await queryRunner.manager.save(
        AdminAccount,
        account,
      );

      // 2. Record Opening Balance if > 0
      if (dto.opening_balance && dto.opening_balance > 0) {
        const statement = queryRunner.manager.create(AdminAccountStatement, {
          account_id: savedAccount.id,
          type: AccountTransactionType.CREDIT,
          credit_amount: dto.opening_balance,
          debit_amount: 0,
          balance_before: 0,
          balance_after: dto.opening_balance,
          description: 'Opening Balance',
          reference_type: AccountReferenceType.OPENING_BALANCE,
          created_by_id: userId,
        });
        await queryRunner.manager.save(AdminAccountStatement, statement);
      }

      await queryRunner.commitTransaction();
      return savedAccount;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<AdminAccount[]> {
    return this.accountRepo.find({
      order: { created_at: 'ASC' },
    });
  }

  async findOne(id: string): Promise<AdminAccount> {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async findAllActive(query: PaginationDto) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.accountRepo
      .createQueryBuilder('account')
      .where('account.is_active = :active', { active: true });

    if (search) {
      qb.andWhere(
        '(account.account_name ILIKE :search OR account.account_number ILIKE :search OR account.provider_type ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('account.created_at', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      success: true,
      data: items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findActiveOne(id: string) {
    const account = await this.accountRepo.findOne({
      where: { id, is_active: true },
    });
    if (!account) throw new NotFoundException('Account not found or inactive');
    return account;
  }

  async update(id: string, dto: UpdateAdminAccountDto): Promise<AdminAccount> {
    const account = await this.findOne(id);

    // Prevent duplicate account number if changed
    if (dto.account_number && dto.account_number !== account.account_number) {
      const existing = await this.accountRepo.findOne({
        where: { account_number: dto.account_number },
      });
      if (existing)
        throw new ConflictException('Account number already exists');
    }

    // Protect balance from direct update
    // Balance can only be changed via transactions/transfers
    if ('current_balance' in dto || 'opening_balance' in dto) {
      delete dto['current_balance'];
      delete dto['opening_balance'];
    }

    Object.assign(account, dto);
    return this.accountRepo.save(account);
  }

  async remove(id: string): Promise<{ message: string }> {
    const account = await this.findOne(id);

    // Check if account has statements (transactions)
    const statementCount = await this.statementRepo.count({
      where: { account_id: id },
    });

    if (statementCount > 0) {
      throw new BadRequestException(
        'Cannot delete account with existing transactions. Please deactivate it instead.',
      );
    }

    await this.accountRepo.remove(account);
    return { message: 'Account deleted successfully' };
  }

  // ===== TRANSACTIONS =====

  async createManualTransaction(
    dto: ManualTransactionDto,
    userId: string,
  ): Promise<AdminAccountStatement> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const account = await queryRunner.manager.findOne(AdminAccount, {
        where: { id: dto.account_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) throw new NotFoundException('Account not found');
      if (!account.is_active)
        throw new BadRequestException('Account is inactive');

      const balanceBefore = Number(account.current_balance);
      let balanceAfter = balanceBefore;
      let credit = 0;
      let debit = 0;

      if (dto.type === AccountTransactionType.DEBIT) {
        if (balanceBefore < dto.amount) {
          throw new BadRequestException('Insufficient funds');
        }
        balanceAfter = balanceBefore - dto.amount;
        debit = dto.amount;
      } else {
        balanceAfter = balanceBefore + dto.amount;
        credit = dto.amount;
      }

      account.current_balance = balanceAfter;
      await queryRunner.manager.save(AdminAccount, account);

      const statement = queryRunner.manager.create(AdminAccountStatement, {
        account_id: account.id,
        type: dto.type,

        // NEW COLUMNS
        credit_amount: credit,
        debit_amount: debit,

        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: dto.description,
        reference_type:
          dto.type === AccountTransactionType.CREDIT
            ? AccountReferenceType.MANUAL_DEPOSIT
            : AccountReferenceType.MANUAL_WITHDRAWAL,
        reference_id: dto.reference_id,
        created_by_id: userId,
      });

      const savedStatement = await queryRunner.manager.save(
        AdminAccountStatement,
        statement,
      );

      await queryRunner.commitTransaction();
      return savedStatement;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async transferFunds(
    dto: TransferFundsDto,
    userId: string,
  ): Promise<{ transaction_id: string; message: string }> {
    if (dto.from_account_id === dto.to_account_id) {
      throw new BadRequestException('Cannot transfer to the same account');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const fromAcc = await queryRunner.manager.findOne(AdminAccount, {
        where: { id: dto.from_account_id },
        lock: { mode: 'pessimistic_write' },
      });
      const toAcc = await queryRunner.manager.findOne(AdminAccount, {
        where: { id: dto.to_account_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromAcc || !toAcc)
        throw new NotFoundException('One or both accounts not found');
      if (!fromAcc.is_active || !toAcc.is_active)
        throw new BadRequestException('One or both accounts are inactive');

      const amount = Number(dto.amount);
      // const fromBalance = Number(fromAcc.current_balance);

      // if (fromBalance < amount) {
      //   throw new BadRequestException(
      //     `Insufficient funds in source account (${fromAcc.account_name})`,
      //   );
      // }

      const transferId =
        dto.reference_id ||
        `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const transferDescription = dto.description || 'Internal transfer';

      // Debit Sender
      const fromBalance = Number(fromAcc.current_balance);
      const senderNewBalance = fromBalance - amount;
      fromAcc.current_balance = senderNewBalance;
      await queryRunner.manager.save(AdminAccount, fromAcc);

      await queryRunner.manager.save(AdminAccountStatement, {
        account_id: fromAcc.id,
        type: AccountTransactionType.DEBIT,

        credit_amount: 0,
        debit_amount: amount, // DEBIT

        balance_before: fromBalance,
        balance_after: senderNewBalance,
        description: `Transfer to ${toAcc.account_name}: ${transferDescription}`,
        reference_type: AccountReferenceType.INTERNAL_TRANSFER,
        reference_id: transferId,
        created_by_id: userId,
      });

      // Credit Receiver
      const toBalance = Number(toAcc.current_balance);
      const receiverNewBalance = toBalance + amount;
      toAcc.current_balance = receiverNewBalance;
      await queryRunner.manager.save(AdminAccount, toAcc);

      await queryRunner.manager.save(AdminAccountStatement, {
        account_id: toAcc.id,
        type: AccountTransactionType.CREDIT,

        credit_amount: amount, // CREDIT
        debit_amount: 0,

        balance_before: toBalance,
        balance_after: receiverNewBalance,
        description: `Transfer from ${fromAcc.account_name}: ${transferDescription}`,
        reference_type: AccountReferenceType.INTERNAL_TRANSFER,
        reference_id: transferId,
        created_by_id: userId,
      });

      await queryRunner.commitTransaction();
      return { transaction_id: transferId, message: 'Transfer successful' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getStatements(accountId: string, query: PaginationDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await this.statementRepo.findAndCount({
      where: { account_id: accountId },
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all statements (Global history with pagination/filtering)
   */
  async findAllStatements(query: any) {
    const {
      page = 1,
      limit = 20,
      account_id,
      type,
      start_date,
      end_date,
    } = query;

    const qb = this.statementRepo
      .createQueryBuilder('statement')
      .leftJoinAndSelect('statement.account', 'account')
      .orderBy('statement.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (account_id)
      qb.andWhere('statement.account_id = :account_id', { account_id });
    if (type) qb.andWhere('statement.type = :type', { type });
    if (start_date && end_date) {
      qb.andWhere('statement.created_at BETWEEN :start AND :end', {
        start: start_date,
        end: end_date,
      });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single statement (Transaction) by ID
   */
  async findStatementById(id: string): Promise<AdminAccountStatement> {
    const statement = await this.statementRepo.findOne({
      where: { id },
      relations: ['account'],
    });
    if (!statement) throw new NotFoundException('Transaction not found');
    return statement;
  }

  /**
   * Update a statement (Advanced: Auto-corrects Account Balance)
   */
  async updateStatement(
    id: string,
    dto: UpdateStatementDto,
    userId: string,
  ): Promise<AdminAccountStatement> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock statement and account
      const statement = await queryRunner.manager.findOne(
        AdminAccountStatement,
        {
          where: { id },
          relations: ['account'],
          lock: { mode: 'pessimistic_write' },
        },
      );

      if (!statement) throw new NotFoundException('Statement not found');

      // If amount is changing, we must adjust the account balance
      const oldAmount =
        statement.type === AccountTransactionType.CREDIT
          ? Number(statement.credit_amount)
          : Number(statement.debit_amount);

      // If amount is changing
      if (dto.amount && Number(dto.amount) !== oldAmount) {
        const account = await queryRunner.manager.findOne(AdminAccount, {
          where: { id: statement.account_id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!account) throw new NotFoundException('Account not found');

        const newAmount = Number(dto.amount);
        const diff = newAmount - oldAmount;

        let newBalance = Number(account.current_balance);

        if (statement.type === AccountTransactionType.CREDIT) {
          // Credit increased -> Balance increases
          newBalance += diff;
        } else {
          // Debit increased -> Balance decreases
          newBalance -= diff;
        }

        if (newBalance < 0) {
          throw new BadRequestException(
            'Modification failed: Insufficient funds for this adjustment',
          );
        }

        account.current_balance = newBalance;
        await queryRunner.manager.save(AdminAccount, account);

        // ERROR FIX 3: Set correct column based on type
        if (statement.type === AccountTransactionType.CREDIT) {
          statement.credit_amount = newAmount;
          statement.debit_amount = 0;
          statement.balance_after =
            Number(statement.balance_before) + newAmount;
        } else {
          statement.debit_amount = newAmount;
          statement.credit_amount = 0;
          statement.balance_after =
            Number(statement.balance_before) - newAmount;
        }
      }

      if (dto.description) statement.description = dto.description;

      const saved = await queryRunner.manager.save(
        AdminAccountStatement,
        statement,
      );
      await queryRunner.commitTransaction();

      this.logger.log(`Statement ${id} updated by ${userId}`);
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Delete a statement (Reverse the transaction)
   */
  async removeStatement(id: string): Promise<{ message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const statement = await queryRunner.manager.findOne(
        AdminAccountStatement,
        {
          where: { id },
          relations: ['account'],
          lock: { mode: 'pessimistic_write' },
        },
      );

      if (!statement) throw new NotFoundException('Statement not found');

      const account = await queryRunner.manager.findOne(AdminAccount, {
        where: { id: statement.account_id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) throw new NotFoundException('Account not found');

      // ERROR FIX 4: Get amount dynamically
      const amount =
        statement.type === AccountTransactionType.CREDIT
          ? Number(statement.credit_amount)
          : Number(statement.debit_amount);

      let newBalance = Number(account.current_balance);

      if (statement.type === AccountTransactionType.CREDIT) {
        if (newBalance < amount) {
          throw new BadRequestException(
            'Cannot delete: Account balance would become negative',
          );
        }
        newBalance -= amount;
      } else {
        newBalance += amount;
      }

      account.current_balance = newBalance;
      await queryRunner.manager.save(AdminAccount, account);
      await queryRunner.manager.remove(AdminAccountStatement, statement);

      await queryRunner.commitTransaction();
      return {
        message: 'Transaction deleted and balance reverted successfully',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ===== TRANSFER SPECIFIC READS =====

  /**
   * Get all transfers (Grouped by Reference ID)
   * A transfer consists of 2 statements sharing a reference_id
   */
  async findAllTransfers(page = 1, limit = 20) {
    // We fetch unique reference IDs of type INTERNAL_TRANSFER
    const qb = this.statementRepo
      .createQueryBuilder('s')
      .select('s.reference_id', 'ref')
      .addSelect('MAX(s.created_at)', 'date') // Get latest date
      .where('s.reference_type = :type', {
        type: AccountReferenceType.INTERNAL_TRANSFER,
      })
      .groupBy('s.reference_id')
      .orderBy('MAX(s.created_at)', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const refs = await qb.getRawMany();
    const total = await qb.getCount(); // Approximate count of groups

    if (refs.length === 0) return { items: [], meta: { total: 0 } };

    // Fetch full details for these references
    const refIds = refs.map((r) => r.ref);
    const statements = await this.statementRepo.find({
      where: {
        reference_type: AccountReferenceType.INTERNAL_TRANSFER,
        reference_id: In(refIds),
      },
      relations: ['account'],
    });

    // Group manually
    const transfers = refIds.map((refId) => {
      const parts = statements.filter((s) => s.reference_id === refId);
      const from = parts.find((s) => s.type === AccountTransactionType.DEBIT);
      const to = parts.find((s) => s.type === AccountTransactionType.CREDIT);

      return {
        transfer_id: refId,
        created_at: from?.created_at,
        amount: from?.debit_amount,
        description: from?.description,
        from_account: from?.account
          ? { id: from.account.id, name: from.account.account_name }
          : null,
        to_account: to?.account
          ? { id: to.account.id, name: to.account.account_name }
          : null,
      };
    });

    return {
      items: transfers,
      meta: { page, limit, total },
    };
  }

  /**
   * Get Transfer Details by Reference ID
   */
  async findTransferById(transferId: string) {
    const statements = await this.statementRepo.find({
      where: {
        reference_type: AccountReferenceType.INTERNAL_TRANSFER,
        reference_id: transferId,
      },
      relations: ['account', 'createdBy'],
    });

    if (statements.length === 0)
      throw new NotFoundException('Transfer record not found');

    const from = statements.find(
      (s) => s.type === AccountTransactionType.DEBIT,
    );
    const to = statements.find((s) => s.type === AccountTransactionType.CREDIT);

    return {
      transfer_id: transferId,
      created_at: from?.created_at,
      created_by: from?.createdBy?.full_name,
      // ERROR FIX 6: Use debit_amount
      amount: from?.debit_amount,
      description: from?.description,
      from_account: from?.account,
      to_account: to?.account,
      raw_statements: statements,
    };
  }

  /**
   * Get Admin Finance Overview
   * Returns: Available Balance, Transferred This Month, Expenses This Month,
   * Pending Transfer, Lifetime Expenses, Lifetime Transferred
   */
  async getAdminFinanceOverview(adminId: string) {
    // Calculate date range for "this month"
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    // Get lifetime transferred (all-time CREDIT with HUB_TRANSFER type - APPROVED transfers only)
    const lifetimeTransferred = await this.statementRepo
      .createQueryBuilder('statement')
      .where('statement.type = :type', { type: 'CREDIT' })
      .andWhere('statement.reference_type = :refType', {
        refType: 'HUB_TRANSFER',
      })
      .select('COALESCE(SUM(statement.credit_amount), 0)', 'total')
      .getRawOne();

    // Get lifetime expenses (all-time DEBIT with EXPENSE type)
    const lifetimeExpenses = await this.statementRepo
      .createQueryBuilder('statement')
      .where('statement.type = :type', { type: 'DEBIT' })
      .andWhere('statement.reference_type = :refType', { refType: 'EXPENSE' })
      .select('COALESCE(SUM(statement.debit_amount), 0)', 'total')
      .getRawOne();

    // Calculate Available Balance
    // = Total approved hub transfers - Total approved expenses
    const availableBalance =
      Number(lifetimeTransferred.total || 0) -
      Number(lifetimeExpenses.total || 0);

    // Get all statements for this month with type CREDIT (incoming transfers)
    const transferredThisMonth = await this.statementRepo
      .createQueryBuilder('statement')
      .where('statement.type = :type', { type: 'CREDIT' })
      .andWhere('statement.reference_type = :refType', {
        refType: 'HUB_TRANSFER',
      })
      .andWhere('statement.created_at BETWEEN :start AND :end', {
        start: startOfMonth,
        end: endOfMonth,
      })
      .select('COALESCE(SUM(statement.credit_amount), 0)', 'total')
      .getRawOne();

    // Get expenses this month (DEBIT transactions with EXPENSE reference type)
    const expensesThisMonth = await this.statementRepo
      .createQueryBuilder('statement')
      .where('statement.type = :type', { type: 'DEBIT' })
      .andWhere('statement.reference_type = :refType', { refType: 'EXPENSE' })
      .andWhere('statement.created_at BETWEEN :start AND :end', {
        start: startOfMonth,
        end: endOfMonth,
      })
      .select('COALESCE(SUM(statement.debit_amount), 0)', 'total')
      .getRawOne();

    // Get pending transfers from hub managers (requires HubTransferRecord access)
    // For now, we'll return 0 or you can inject HubTransferRecord repository
    const pendingTransfer = 0;

    return {
      available_balance: availableBalance,
      transferred_this_month: Number(transferredThisMonth.total || 0),
      expenses_this_month: Number(expensesThisMonth.total || 0),
      pending_transfer: pendingTransfer,
      lifetime_expenses: Number(lifetimeExpenses.total || 0),
      lifetime_transferred: Number(lifetimeTransferred.total || 0),
    };
  }

  /**
   * Admin: Finance & Analytics overview
   */
  async getAdminFinanceAnalytics(
    _adminId: string,
    query: AdminFinanceAnalyticsQueryDto,
  ) {
    const { start, end } = this.normalizeAnalyticsRange(
      query.startDate,
      query.endDate,
    );

    const revenueStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURNED,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
    ];

    const successStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
    ];

    const completionStatuses = [
      ...successStatuses,
      ParcelStatus.RETURNED,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
      ParcelStatus.FAILED_DELIVERY,
      ParcelStatus.CANCELLED,
    ];

    const parcelDateFilter =
      'COALESCE(parcel.delivered_at, parcel.updated_at, parcel.created_at) BETWEEN :start AND :end';

    const revenueRow = await this.parcelRepo
      .createQueryBuilder('parcel')
      .select('COALESCE(SUM(parcel.delivery_charge), 0)', 'delivery_fee')
      .addSelect('COALESCE(SUM(parcel.cod_charge), 0)', 'cod_fee')
      .addSelect('COALESCE(SUM(parcel.weight_charge), 0)', 'weight_fee')
      .addSelect('COALESCE(SUM(parcel.return_charge), 0)', 'return_fee')
      .where('parcel.status IN (:...statuses)', { statuses: revenueStatuses })
      .andWhere(parcelDateFilter, { start, end })
      .getRawOne();

    const deliveryFee = Number(revenueRow?.delivery_fee || 0);
    const codFee = Number(revenueRow?.cod_fee || 0);
    const weightFee = Number(revenueRow?.weight_fee || 0);
    const returnFee = Number(revenueRow?.return_fee || 0);
    const otherFees = weightFee + returnFee;
    const totalRevenue = deliveryFee + codFee + otherFees;

    const collectedRow = await this.parcelRepo
      .createQueryBuilder('parcel')
      .select('COALESCE(SUM(parcel.cod_collected_amount), 0)', 'total')
      .where('parcel.status IN (:...statuses)', { statuses: successStatuses })
      .andWhere(parcelDateFilter, { start, end })
      .getRawOne();

    const hubExpenseRow = await this.hubExpenseRepo
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.status = :status', {
        status: TransferRecordStatus.APPROVED,
      })
      .andWhere('expense.created_at BETWEEN :start AND :end', { start, end })
      .getRawOne();

    const adminExpenseRow = await this.statementRepo
      .createQueryBuilder('statement')
      .select('COALESCE(SUM(statement.debit_amount), 0)', 'total')
      .where('statement.reference_type = :refType', {
        refType: AccountReferenceType.EXPENSE,
      })
      .andWhere('statement.type = :type', {
        type: AccountTransactionType.DEBIT,
      })
      .andWhere('statement.created_at BETWEEN :start AND :end', { start, end })
      .getRawOne();

    const hubExpenses = Number(hubExpenseRow?.total || 0);
    const adminExpenses = Number(adminExpenseRow?.total || 0);
    const totalExpenses = hubExpenses + adminExpenses;

    const netProfit = totalRevenue - totalExpenses;

    const merchantPaymentRow = await this.merchantFinanceTransactionRepo
      .createQueryBuilder('txn')
      .select('COALESCE(SUM(txn.amount), 0)', 'total')
      .where('txn.reference_type = :refType', {
        refType: FinanceReferenceType.INVOICE_PAID,
      })
      .andWhere('txn.transaction_type = :type', {
        type: FinanceTransactionType.DEBIT,
      })
      .andWhere('txn.created_at BETWEEN :start AND :end', { start, end })
      .getRawOne();

    const pendingPaymentRow = await this.merchantFinanceRepo
      .createQueryBuilder('finance')
      .select(
        'COALESCE(SUM(finance.pending_balance + finance.invoiced_balance + finance.processing_balance), 0)',
        'total',
      )
      .getRawOne();

    const liquidityRow = await this.accountRepo
      .createQueryBuilder('account')
      .select('COALESCE(SUM(account.current_balance), 0)', 'total')
      .where('account.is_active = :active', { active: true })
      .getRawOne();

    const year = start.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    const revenueMonthlyRows = await this.parcelRepo
      .createQueryBuilder('parcel')
      .select(
        "DATE_TRUNC('month', COALESCE(parcel.delivered_at, parcel.updated_at, parcel.created_at))",
        'month',
      )
      .addSelect(
        'COALESCE(SUM(parcel.delivery_charge + parcel.cod_charge + parcel.weight_charge + parcel.return_charge), 0)',
        'total',
      )
      .where('parcel.status IN (:...statuses)', { statuses: revenueStatuses })
      .andWhere(
        "COALESCE(parcel.delivered_at, parcel.updated_at, parcel.created_at) >= :yearStart",
        { yearStart },
      )
      .andWhere(
        "COALESCE(parcel.delivered_at, parcel.updated_at, parcel.created_at) < :yearEnd",
        { yearEnd },
      )
      .andWhere(parcelDateFilter, { start, end })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    const hubExpenseMonthlyRows = await this.hubExpenseRepo
      .createQueryBuilder('expense')
      .select("DATE_TRUNC('month', expense.created_at)", 'month')
      .addSelect('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.status = :status', {
        status: TransferRecordStatus.APPROVED,
      })
      .andWhere('expense.created_at >= :yearStart', { yearStart })
      .andWhere('expense.created_at < :yearEnd', { yearEnd })
      .andWhere('expense.created_at BETWEEN :start AND :end', { start, end })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    const adminExpenseMonthlyRows = await this.statementRepo
      .createQueryBuilder('statement')
      .select("DATE_TRUNC('month', statement.created_at)", 'month')
      .addSelect('COALESCE(SUM(statement.debit_amount), 0)', 'total')
      .where('statement.reference_type = :refType', {
        refType: AccountReferenceType.EXPENSE,
      })
      .andWhere('statement.type = :type', {
        type: AccountTransactionType.DEBIT,
      })
      .andWhere('statement.created_at >= :yearStart', { yearStart })
      .andWhere('statement.created_at < :yearEnd', { yearEnd })
      .andWhere('statement.created_at BETWEEN :start AND :end', { start, end })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    const revenueByMonth = new Map<number, number>();
    for (const row of revenueMonthlyRows) {
      const monthIndex = new Date(row.month).getMonth();
      revenueByMonth.set(monthIndex, Number(row.total) || 0);
    }

    const expensesByMonth = new Map<number, number>();
    for (const row of hubExpenseMonthlyRows) {
      const monthIndex = new Date(row.month).getMonth();
      const current = expensesByMonth.get(monthIndex) || 0;
      expensesByMonth.set(monthIndex, current + Number(row.total || 0));
    }
    for (const row of adminExpenseMonthlyRows) {
      const monthIndex = new Date(row.month).getMonth();
      const current = expensesByMonth.get(monthIndex) || 0;
      expensesByMonth.set(monthIndex, current + Number(row.total || 0));
    }

    const months = this.getMonthLabels().map((label, index) => ({
      month: label,
      revenue: this.roundMoney(revenueByMonth.get(index) || 0),
      expenses: this.roundMoney(expensesByMonth.get(index) || 0),
    }));

    const hubRows = await this.parcelRepo
      .createQueryBuilder('parcel')
      .leftJoin('parcel.currentHub', 'currentHub')
      .leftJoin('parcel.store', 'store')
      .leftJoin('store.hub', 'storeHub')
      .select('COALESCE(parcel.current_hub_id, store.hub_id)', 'hub_id')
      .addSelect(
        'COALESCE(currentHub.branch_name, storeHub.branch_name)',
        'hub_name',
      )
      .addSelect('COALESCE(currentHub.hub_code, storeHub.hub_code)', 'hub_code')
      .addSelect('COUNT(*)', 'total_parcels')
      .addSelect(
        'SUM(CASE WHEN parcel.status IN (:...successStatuses) THEN 1 ELSE 0 END)',
        'success_count',
      )
      .where('COALESCE(parcel.current_hub_id, store.hub_id) IS NOT NULL')
      .andWhere('parcel.status IN (:...totalStatuses)', {
        totalStatuses: completionStatuses,
      })
      .andWhere(parcelDateFilter, { start, end })
      .groupBy('COALESCE(parcel.current_hub_id, store.hub_id)')
      .addGroupBy('COALESCE(currentHub.branch_name, storeHub.branch_name)')
      .addGroupBy('COALESCE(currentHub.hub_code, storeHub.hub_code)')
      .orderBy('total_parcels', 'DESC')
      .limit(3)
      .setParameters({ successStatuses })
      .getRawMany();

    const hubPerformance = hubRows.map((row) => {
      const totalParcels = Number(row.total_parcels || 0);
      const successCount = Number(row.success_count || 0);
      const successRate = totalParcels
        ? this.roundMoney((successCount / totalParcels) * 100)
        : 0;

      return {
        hub_id: row.hub_id,
        hub_name: row.hub_name,
        hub_code: row.hub_code,
        parcels: totalParcels,
        success_rate: successRate,
      };
    });

    const zoneRows = await this.parcelRepo
      .createQueryBuilder('parcel')
      .leftJoin('parcel.delivery_coverage_area', 'coverage')
      .select('COALESCE(coverage.area, parcel.delivery_area)', 'zone_name')
      .addSelect('COUNT(*)', 'total_deliveries')
      .where('parcel.status IN (:...statuses)', { statuses: successStatuses })
      .andWhere(parcelDateFilter, { start, end })
      .groupBy('zone_name')
      .orderBy('total_deliveries', 'DESC')
      .limit(5)
      .getRawMany();

    const topDeliveryZones = zoneRows.map((row) => ({
      zone_name: row.zone_name,
      deliveries: Number(row.total_deliveries || 0),
    }));

    const statements = await this.statementRepo.find({
      relations: ['account'],
      order: { created_at: 'DESC' },
      take: 10,
    });

    const transactionHistory = statements.map((statement) => ({
      id: statement.id,
      account: statement.account
        ? {
            id: statement.account.id,
            name: statement.account.account_name,
            number_masked: this.maskAccountNumber(
              statement.account.account_number,
            ),
            provider_type: statement.account.provider_type,
          }
        : null,
      type: statement.type,
      amount:
        statement.type === AccountTransactionType.CREDIT
          ? Number(statement.credit_amount)
          : Number(statement.debit_amount),
      description: statement.description,
      reference_type: statement.reference_type,
      balance_after: Number(statement.balance_after),
      created_at: statement.created_at,
    }));

    return {
      range: {
        start,
        end,
      },
      summary: {
        total_revenue: this.roundMoney(totalRevenue),
        total_expenses: this.roundMoney(totalExpenses),
        net_profit: this.roundMoney(netProfit),
        collected_amount: this.roundMoney(Number(collectedRow?.total || 0)),
        merchant_payment: this.roundMoney(
          Number(merchantPaymentRow?.total || 0),
        ),
        pending_payment: this.roundMoney(
          Number(pendingPaymentRow?.total || 0),
        ),
      },
      revenue_sources: [
        {
          key: 'delivery_fee',
          label: 'Delivery Fee',
          amount: this.roundMoney(deliveryFee),
          percent: totalRevenue
            ? this.roundMoney((deliveryFee / totalRevenue) * 100)
            : 0,
        },
        {
          key: 'cod_charges',
          label: 'COD Charges',
          amount: this.roundMoney(codFee),
          percent: totalRevenue
            ? this.roundMoney((codFee / totalRevenue) * 100)
            : 0,
        },
        {
          key: 'others',
          label: 'Others',
          amount: this.roundMoney(otherFees),
          percent: totalRevenue
            ? this.roundMoney((otherFees / totalRevenue) * 100)
            : 0,
        },
      ],
      revenue_vs_expenses: {
        year,
        months,
      },
      hub_performance: hubPerformance,
      top_delivery_zones: topDeliveryZones,
      liquidity: {
        total: this.roundMoney(Number(liquidityRow?.total || 0)),
      },
      transaction_history: transactionHistory,
    };
  }

  private normalizeAnalyticsRange(startDate?: string, endDate?: string) {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (startDate) {
      start = this.getStartOfDay(new Date(startDate));
    }

    if (endDate) {
      end = this.getEndOfDay(new Date(endDate));
    }

    if (!start && !end) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      return { start: startOfMonth, end: endOfMonth };
    }

    if (!start && end) {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    }

    if (start && !end) {
      end = this.getEndOfDay(now);
    }

    return { start: start!, end: end! };
  }

  private getStartOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private getEndOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  private getMonthLabels() {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private maskAccountNumber(value: string | null) {
    if (!value) {
      return null;
    }

    const raw = value.replace(/\s+/g, '');
    if (raw.length <= 4) {
      return raw;
    }

    return `${'*'.repeat(raw.length - 4)}${raw.slice(-4)}`;
  }
}
