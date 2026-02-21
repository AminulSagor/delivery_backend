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

@Injectable()
export class AdminAccountsService {
  private readonly logger = new Logger(AdminAccountsService.name);

  constructor(
    @InjectRepository(AdminAccount)
    private accountRepo: Repository<AdminAccount>,
    @InjectRepository(AdminAccountStatement)
    private statementRepo: Repository<AdminAccountStatement>,
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

      const transferId = dto.reference_id || `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get lifetime transferred (all-time CREDIT with HUB_TRANSFER type - APPROVED transfers only)
    const lifetimeTransferred = await this.statementRepo
      .createQueryBuilder('statement')
      .where('statement.type = :type', { type: 'CREDIT' })
      .andWhere('statement.reference_type = :refType', { refType: 'HUB_TRANSFER' })
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
    const availableBalance = Number(lifetimeTransferred.total || 0) - Number(lifetimeExpenses.total || 0);

    // Get all statements for this month with type CREDIT (incoming transfers)
    const transferredThisMonth = await this.statementRepo
      .createQueryBuilder('statement')
      .where('statement.type = :type', { type: 'CREDIT' })
      .andWhere('statement.reference_type = :refType', { refType: 'HUB_TRANSFER' })
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
}
