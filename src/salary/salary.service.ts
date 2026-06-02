import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository, DataSource } from 'typeorm';
import { Staff } from '../staff/entities/staff.entity';
import { StaffFinance } from '../staff/entities/staff-finance.entity';
import { StaffPayoutMethod } from '../staff/entities/staff-payout-method.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Parcel, ParcelStatus, RIDER_DELIVERY_STATUSES } from '../parcels/entities/parcel.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { StaffPosition } from '../common/enums/staff-position.enum';
import { PayoutTransactionStatus } from '../common/enums/payout-transaction-status.enum';
import { GenerateSalaryDto } from './dto/generate-salary.dto';
import { ProcessSalaryPaymentDto } from './dto/process-salary-payment.dto';
import { format, endOfMonth, startOfMonth, endOfDay, startOfDay } from 'date-fns';
import { PayoutTransaction } from '../merchant/entities/payout-transaction.entity';

type SalaryBreakdown = {
  basic_salary: number;
  per_day: number;
  commission: number;
  increment: number;
  commitment_increment: number;
  pickup_increment: number;
  eid_bonus_per: number;
  attendance: number;
  delivery: number;
  cancel: number;
  pickup: number;
  overtime: number;
  advance_acceptance: number;
  loan: number;
  previous_month: number;
  calculated_payment_amount: number;
};

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(PayoutTransaction)
    private readonly payoutRepository: Repository<PayoutTransaction>,
    @InjectRepository(StaffPayoutMethod)
    private readonly staffPayoutMethodRepository: Repository<StaffPayoutMethod>,
    @InjectRepository(StaffFinance)
    private readonly staffFinanceRepository: Repository<StaffFinance>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    private readonly dataSource: DataSource,
  ) {}

  async getCreateList(page = 1, limit = 10) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [staff, total] = await this.staffRepository.findAndCount({
      where: { is_active: true },
      relations: ['user', 'hub'],
      order: { created_at: 'DESC' },
      skip,
      take: safeLimit,
    });

    const items = await Promise.all(
      staff.map(async (member) => {
        const breakdown = await this.resolveSalaryBreakdown(member);
        const lastPaid = await this.getLastPaidAt(member.id);

        return {
          id: member.id,
          profile: {
            name: member.user?.full_name ?? 'N/A',
            phone: member.user?.phone ?? 'N/A',
            avatar_url: member.photo ?? null,
          },
          position: member.position,
          assigned_hub: member.hub?.branch_name ?? null,
          
          salary_amount: breakdown.calculated_payment_amount,
          last_paid: lastPaid,
          status: lastPaid ? 'created' : 'pending_creation',
        };
      }),
    );

    return {
      status: 'success',
      data: {
        staff: items,
        pagination: {
          total_items: total,
          current_page: safePage,
          items_per_page: safeLimit,
          total_pages: Math.ceil(total / safeLimit),
        },
      },
    };
  }

  async getCreateDetails(staffId: string) {
    const staff = await this.findStaffOrThrow(staffId);
    const breakdown = await this.resolveSalaryBreakdown(staff);

    return {
      status: 'success',
      data: {
        staff_information: {
          id: staff.id,
          name: staff.user?.full_name ?? 'N/A',
          is_verified: !!staff.is_active,
          position: staff.position,
          assigned_hub: staff.hub?.branch_name ?? null,
          phone: staff.user?.phone ?? null,
          base_salary: this.toMoney(staff.fixed_salary),
          commission: breakdown.commission,
          avatar_url: staff.photo ?? null,
        },
        salary_summary: {
          basic_salary: breakdown.basic_salary,
          per_day: breakdown.per_day,
        },
        salary_increment_modifiers: {
          increment: breakdown.increment,
          commitment_increment: breakdown.commitment_increment,
          pickup_increment: breakdown.pickup_increment,
          eid_bonus_per: breakdown.eid_bonus_per,
        },
        monthly_salary_modifiers: {
          delivery: breakdown.delivery,
          cancel: breakdown.cancel,
          pickup: breakdown.pickup,
          overtime: breakdown.overtime,
          advance_acceptance: breakdown.advance_acceptance,
          loan: breakdown.loan,
          previous_month: breakdown.previous_month,
        },
        calculated_payment_amount: breakdown.calculated_payment_amount,
      },
    };
  }

  async generateSalarySlip(dto: GenerateSalaryDto) {
    const staff = await this.findStaffOrThrow(dto.staff_id);
    const breakdown = await this.resolveSalaryBreakdown(
      staff,
      dto.salary_increment_modifiers,
      dto.monthly_salary_modifiers,
    );

    if (
      dto.final_payment_amount !== undefined &&
      this.roundMoney(dto.final_payment_amount) !== breakdown.calculated_payment_amount
    ) {
      throw new BadRequestException(
        `final_payment_amount must equal calculated_payment_amount (${breakdown.calculated_payment_amount})`,
      );
    }

    return {
      status: 'success',
      data: {
        staff_id: staff.id,
        salary_increment_modifiers: dto.salary_increment_modifiers,
        monthly_salary_modifiers: dto.monthly_salary_modifiers,
        final_payment_amount: breakdown.calculated_payment_amount,
      },
    };
  }

  async getPayList(page = 1, limit = 10) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const [staff, total] = await this.staffRepository.findAndCount({
      where: { is_active: true },
      relations: ['user', 'hub'],
      order: { created_at: 'DESC' },
      skip,
      take: safeLimit,
    });

    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());

    const items = await Promise.all(
      staff.map(async (member) => {
        const breakdown = await this.resolveSalaryBreakdown(member);
        const paidThisMonth = await this.getPaidAmount(member.id, currentMonthStart, currentMonthEnd);
        const lastPaid = await this.getLastPaidAt(member.id);
        const salaryPending = Math.max(0, breakdown.calculated_payment_amount - paidThisMonth);

        return {
          id: member.id,
          profile: {
            name: member.user?.full_name ?? 'N/A',
            phone: member.user?.phone ?? 'N/A',
            avatar_url: member.photo ?? null,
          },
          position: member.position,
          assigned_hub: member.hub?.branch_name ?? null,
          total_earnings: breakdown.calculated_payment_amount,
          salary_pending: salaryPending,
          payment_method: this.resolvePaymentMethod(member),
          last_paid: lastPaid,
          month: format(new Date(), 'MMMM yy'),
          is_payable: salaryPending > 0,
        };
      }),
    );

    return {
      status: 'success',
      data: {
        staff: items,
        pagination: {
          total_items: total,
          current_page: safePage,
          items_per_page: safeLimit,
          total_pages: Math.ceil(total / safeLimit),
        },
      },
    };
  }

  async getPaymentDetails(staffId: string) {
    const staff = await this.findStaffOrThrow(staffId);
    const breakdown = await this.resolveSalaryBreakdown(staff);
    const lastPaid = await this.getLastPaidAt(staff.id);
    const paidThisMonth = await this.getPaidAmount(
      staff.id,
      startOfMonth(new Date()),
      endOfMonth(new Date()),
    );
    const salaryPending = Math.max(0, breakdown.calculated_payment_amount - paidThisMonth);

    return {
      status: 'success',
      data: {
        staff_information: {
          id: staff.id,
          name: staff.user?.full_name ?? 'N/A',
          is_verified: !!staff.is_active,
          position: staff.position,
          assigned_hub: staff.hub?.branch_name ?? null,
          phone: staff.user?.phone ?? null,
          base_salary: this.toMoney(staff.fixed_salary),
          commission: breakdown.commission,
          avatar_url: staff.photo ?? null,
        },
        payment_summary: {
          total_earnings: breakdown.calculated_payment_amount,
          last_paid: lastPaid,
          salary_pending: salaryPending,
        },
        available_bank_accounts: this.buildAvailableBankAccounts(staff, salaryPending),
        selected_account_details: this.buildSelectedAccountDetails(
          staff,
          salaryPending,
          lastPaid,
        ),
      },
    };
  }

  async processPayment(dto: ProcessSalaryPaymentDto, initiatedBy: string) {
    const staff = await this.findStaffOrThrow(dto.staff_id);
    const breakdown = await this.resolveSalaryBreakdown(staff);
    const paidThisMonth = await this.getPaidAmount(
      staff.id,
      startOfMonth(new Date()),
      endOfMonth(new Date()),
    );
    const salaryPending = Math.max(0, breakdown.calculated_payment_amount - paidThisMonth);

    const expectedAmount = this.roundMoney(salaryPending);
    const paymentAmount = this.roundMoney(dto.payment_amount);

    if (paymentAmount <= 0) {
      throw new BadRequestException('payment_amount must be greater than 0');
    }

    if (paymentAmount !== expectedAmount) {
      throw new BadRequestException(
        `payment_amount must equal salary_pending (${expectedAmount})`,
      );
    }

    const transaction = this.payoutRepository.create({
      staff_id: staff.id,
      merchant_id: null,
      payout_method_id: null,
      amount: paymentAmount,
      reference_number: this.generateReferenceNumber(staff),
      status: PayoutTransactionStatus.PENDING,
      admin_notes: `Requested via ${dto.payment_method}`,
      failure_reason: null,
      initiated_by: initiatedBy,
      initiated_at: new Date(),
      processed_at: null,
      completed_at: null,
    });

    // validate and attach payout method when a payout method record is used
    let payoutMethod: StaffPayoutMethod | null = null;

    const isStaffBankTransfer =
      dto.payment_method === 'bank_transfer' && dto.account_id === staff.id;

    if (isStaffBankTransfer) {
      if (!staff.bank_account_number) {
        throw new BadRequestException('Invalid account_id');
      }
    } else {
      payoutMethod = await this.staffPayoutMethodRepository.findOne({
        where: { id: dto.account_id },
      });

      if (!payoutMethod) {
        throw new BadRequestException('Invalid account_id');
      }

      if (payoutMethod.staff_id !== staff.id) {
        throw new BadRequestException('Payout method does not belong to the staff');
      }

      if (!payoutMethod.is_active) {
        throw new BadRequestException('Selected payout method is not active');
      }

      transaction.payout_method_id = payoutMethod.id;
    }

    const saved = await this.payoutRepository.save(transaction);

    return {
      status: 'success',
      data: {
        transaction_id: saved.id,
        staff_id: staff.id,
        payment_amount: saved.amount,
        payment_method: dto.payment_method,
        reference_number: saved.reference_number,
        status: saved.status,
        initiated_at: saved.initiated_at,
      },
    };
  }

  /**
   * Finalize a payout transaction — mark as COMPLETED or FAILED and update StaffFinance accordingly.
   * Intended to be called by payout worker after external transfer completes.
   */
  async finalizePayout(transactionId: string, status: PayoutTransactionStatus, processedAt?: Date, failureReason?: string) {
    const tx = await this.payoutRepository.findOne({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Payout transaction not found');

    if (tx.status === status) {
      return tx;
    }

    tx.status = status;
    tx.processed_at = processedAt || new Date();
    if (status === PayoutTransactionStatus.COMPLETED) {
      tx.completed_at = new Date();
      tx.failure_reason = null;
    } else {
      tx.failure_reason = failureReason || null;
    }

    await this.payoutRepository.save(tx);

    // If completed, update staff finance
    if (status === PayoutTransactionStatus.COMPLETED && tx.staff_id) {
      const finance = await this.staffFinanceRepository.findOne({ where: { staff_id: tx.staff_id } });
      if (finance) {
        const amount = Number(tx.amount || 0);
        finance.total_paid_amount = Number((Number(finance.total_paid_amount || 0) + amount).toFixed(2));
        finance.remaining_balance = Number(Math.max(0, Number(finance.remaining_balance || 0) - amount).toFixed(2));
        finance.last_payout_at = tx.completed_at;
        finance.last_payout_amount = amount;
        await this.staffFinanceRepository.save(finance);
      }
    }

    return tx;
  }

  async getPayouts(staffId: string, page = 1, limit = 20) {
    const staff = await this.findStaffOrThrow(staffId);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [transactions, total] = await this.payoutRepository.findAndCount({
      where: { staff_id: staff.id },
      order: { created_at: 'DESC' },
      skip,
      take: safeLimit,
    });

    return {
      status: 'success',
      data: {
        transactions,
        total,
        staff: {
          id: staff.id,
          name: staff.user?.full_name ?? 'N/A',
        },
      },
    };
  }

  async getPayoutHistoryList(
    search?: string,
    page = 1,
    limit = 10,
    startDateInput?: string,
    endDateInput?: string,
  ) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;
    const startDate = this.parseOptionalDate(startDateInput, 'start_date');
    const endDate = this.parseOptionalDate(endDateInput, 'end_date');

    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('start_date must be earlier than end_date');
    }

    const baseQuery = this.payoutRepository
      .createQueryBuilder('tx')
      .innerJoin('tx.staff', 'staff')
      .innerJoin('staff.user', 'user')
      .leftJoin('staff.hub', 'hub')
      .where('tx.status = :status', { status: PayoutTransactionStatus.COMPLETED })
      .andWhere('tx.staff_id IS NOT NULL');

    if (search?.trim()) {
      baseQuery.andWhere(
        '(user.full_name ILIKE :search OR user.email ILIKE :search OR staff.staff_code ILIKE :search OR staff.position::text ILIKE :search OR COALESCE(hub.branch_name, \'\') ILIKE :search OR COALESCE(staff.bank_name, \'\') ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    if (startDate) {
      baseQuery.andWhere('tx.completed_at >= :startDate', {
        startDate: startOfDay(startDate),
      });
    }

    if (endDate) {
      baseQuery.andWhere('tx.completed_at <= :endDate', {
        endDate: endOfDay(endDate),
      });
    }

    const totalResult = await baseQuery
      .clone()
      .select('COUNT(DISTINCT staff.id)', 'total')
      .getRawOne<{ total: string }>();

    const rows = await baseQuery
      .clone()
      .select('staff.id', 'id')
      .addSelect('user.full_name', 'full_name')
      .addSelect('user.email', 'email')
      .addSelect('staff.photo', 'avatar_url')
      .addSelect('staff.position', 'position')
      .addSelect('hub.branch_name', 'assigned_hub')
      .addSelect('MAX(tx.completed_at)', 'last_paid_at')
      .addSelect('COALESCE(SUM(tx.amount), 0)', 'salary_paid')
      .groupBy('staff.id')
      .addGroupBy('user.full_name')
      .addGroupBy('user.email')
      .addGroupBy('staff.photo')
      .addGroupBy('staff.position')
      .addGroupBy('hub.branch_name')
      .orderBy('MAX(tx.completed_at)', 'DESC')
      .offset(skip)
      .limit(safeLimit)
      .getRawMany<{
        id: string;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
        position: string | null;
        assigned_hub: string | null;
        last_paid_at: string | Date | null;
        salary_paid: string;
      }>();

    const staffIds = rows.map((row) => row.id);
    const payoutMethods = await this.loadDefaultPayoutMethods(staffIds);

    const data = rows.map((row) => {
      const payoutMethod = payoutMethods.get(row.id) || null;

      return {
        id: row.id,
        profile: {
          name: row.full_name ?? 'N/A',
          email: row.email ?? null,
          avatar_url: row.avatar_url ?? null,
        },
        position: row.position ?? 'N/A',
        assigned_hub: row.assigned_hub ?? null,
        last_paid_at: row.last_paid_at ? new Date(row.last_paid_at).toISOString() : null,
        salary_paid: this.toMoney(row.salary_paid),
        currency: 'BDT',
        paid_using: this.resolvePaymentLabel(payoutMethod),
      };
    });

    const totalRecords = Number(totalResult?.total || 0);

    return {
      success: true,
      meta: {
        title: 'Payout History',
        subtitle: 'Salary Management - Staff List',
        pagination: {
          total_records: totalRecords,
          current_page: safePage,
          limit: safeLimit,
          showing: this.buildShowingRange(totalRecords, safePage, safeLimit, data.length),
        },
      },
      filters: {
        selected_count: [search, startDateInput, endDateInput].filter((value) => !!value).length,
        export_formats: ['Excel', 'CSV'],
        bulk_actions: ['Pay Salary', 'Hold Payout'],
      },
      data,
    };
  }

  async getPayoutHistoryDetails(staffId: string) {
    const staff = await this.findStaffOrThrow(staffId);
    const completedTransactions = await this.payoutRepository.find({
      where: {
        staff_id: staff.id,
        status: PayoutTransactionStatus.COMPLETED,
      },
      order: { completed_at: 'DESC' },
    });

    const defaultMethod = await this.findDefaultPayoutMethod(staff.id);
    const latestTransaction = completedTransactions[0] ?? null;
    const latestPaidAt = latestTransaction?.completed_at ?? null;
    const periodReferenceDate = latestPaidAt ?? new Date();
    const periodStart = startOfMonth(periodReferenceDate);
    const periodEnd = endOfMonth(periodReferenceDate);

    const periodTransactions = completedTransactions.filter((transaction) => {
      if (!transaction.completed_at) {
        return false;
      }

      return transaction.completed_at >= periodStart && transaction.completed_at <= periodEnd;
    });

    const amountPaid = periodTransactions.reduce(
      (sum, transaction) => sum + this.toMoney(transaction.amount),
      0,
    );
    const totalEarningsToDate = completedTransactions.reduce(
      (sum, transaction) => sum + this.toMoney(transaction.amount),
      0,
    );

    const paymentGateway = this.buildPaymentGateway(
      staff,
      defaultMethod,
      latestPaidAt,
      totalEarningsToDate,
    );

    return {
      success: true,
      data: {
        staff_information: {
          id: staff.id,
          name: staff.user?.full_name ?? 'N/A',
          status: staff.is_active ? 'Verified' : 'Inactive',
          employment_type: 'Permanent',
          position: staff.position,
          email: staff.user?.email ?? null,
          avatar_url: staff.photo ?? null,
          base_salary: this.toMoney(staff.fixed_salary),
          conveyance: 0,
          total_earnings_to_date: this.toMoney(totalEarningsToDate),
          currency: 'BDT',
          last_paid_at: latestPaidAt ? latestPaidAt.toISOString() : null,
        },
        salary_period: {
          month: format(periodReferenceDate, 'MMMM'),
          days_counted: periodTransactions.length,
          amount_paid: this.toMoney(amountPaid),
          total_disbursed: this.toMoney(amountPaid),
        },
        payment_gateway: paymentGateway,
      },
    };
  }

  private async findStaffOrThrow(staffId: string) {
    const staff = await this.staffRepository.findOne({
      where: { id: staffId },
      relations: ['user', 'hub'],
    });

    if (!staff) {
      throw new NotFoundException(`Staff with ID "${staffId}" not found`);
    }

    return staff;
  }

  private async resolveSalaryBreakdown(
    staff: Staff,
    incrementModifiers?: any,
    monthlyModifiers?: any,
  ): Promise<SalaryBreakdown> {
    const basic_salary = this.toMoney(staff.fixed_salary);
    const per_day = this.roundMoney(basic_salary / this.getDaysInCurrentMonth());

    const commission = await this.resolveCommission(staff);

    const increment = this.toMoney(incrementModifiers?.increment ?? 0);
    const commitment_increment = this.toMoney(
      incrementModifiers?.commitment_increment ?? 0,
    );
    const pickup_increment = this.toMoney(
      incrementModifiers?.pickup_increment ?? 0,
    );
    const eid_bonus_per = this.toMoney(incrementModifiers?.eid_bonus_per ?? 0);

    const attendance = this.toMoney(monthlyModifiers?.attendance ?? 0);
    const delivery = this.toMoney(monthlyModifiers?.delivery ?? 0);
    const cancel = this.toMoney(monthlyModifiers?.cancel ?? 0);
    const pickup = this.toMoney(monthlyModifiers?.pickup ?? 0);
    const overtime = this.toMoney(monthlyModifiers?.overtime ?? 0);
    const advance_acceptance = this.toMoney(
      monthlyModifiers?.advance_acceptance ?? 0,
    );
    const loan = this.toMoney(monthlyModifiers?.loan ?? 0);
    const previous_month = this.toMoney(monthlyModifiers?.previous_month ?? 0);

    const calculated_payment_amount = this.roundMoney(
      basic_salary +
        commission +
        increment +
        commitment_increment +
        pickup_increment +
        eid_bonus_per +
        attendance +
        delivery +
        pickup +
        overtime +
        previous_month -
        cancel -
        advance_acceptance -
        loan,
    );

    return {
      basic_salary,
      per_day,
      commission,
      increment,
      commitment_increment,
      pickup_increment,
      eid_bonus_per,
      attendance,
      delivery,
      cancel,
      pickup,
      overtime,
      advance_acceptance,
      loan,
      previous_month,
      calculated_payment_amount,
    };
  }

  private async resolveCommission(staff: Staff): Promise<number> {
    if (staff.position !== StaffPosition.RIDER) {
      return 0;
    }

    const rider = await this.riderRepository.findOne({
      where: { user_id: staff.user_id },
    });

    if (!rider) {
      return 0;
    }

    const deliveredCount = await this.parcelRepository.count({
      where: {
        assigned_rider_id: rider.id,
        status: In([
          ParcelStatus.DELIVERED,
          ParcelStatus.PARTIAL_DELIVERY,
          ParcelStatus.EXCHANGE,
          ParcelStatus.PAID_RETURN,
        ]),
        delivered_at: Between(startOfMonth(new Date()), endOfMonth(new Date())),
      },
    });

    return this.roundMoney(deliveredCount * Number(rider.commission_per_delivery || 0));
  }

  private async getPaidAmount(staffId: string, start: Date, end: Date) {
    const result = await this.payoutRepository
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'amount')
      .where('tx.staff_id = :staffId', { staffId })
      .andWhere('tx.status = :status', { status: PayoutTransactionStatus.COMPLETED })
      .andWhere('tx.completed_at BETWEEN :start AND :end', { start, end })
      .getRawOne<{ amount: string }>();

    return this.toMoney(result?.amount || 0);
  }

  private async getLastPaidAt(staffId: string) {
    const last = await this.payoutRepository.findOne({
      where: {
        staff_id: staffId,
        status: PayoutTransactionStatus.COMPLETED,
      },
      order: { completed_at: 'DESC' },
    });

    return last?.completed_at ?? null;
  }

  private buildAvailableBankAccounts(staff: Staff, amount: number) {
    if (!staff.bank_account_number) {
      return [];
    }

    return [
      {
        account_id: staff.id,
        bank_name: staff.bank_name ?? 'BANK_TRANSFER',
        masked_number: this.maskAccountNumber(staff.bank_account_number),
        logo_url: null,
        is_default: true,
      },
    ];
  }

  private buildSelectedAccountDetails(staff: Staff, amount: number, lastPaid: Date | null) {
    if (!staff.bank_account_number) {
      return null;
    }

    return {
      bank_name: staff.bank_name ?? 'BANK_TRANSFER',
      account_no: staff.bank_account_number,
      account_holder_name: staff.user?.full_name ?? 'N/A',
      account_balance: amount,
      last_used: lastPaid,
    };
  }

  private resolvePaymentMethod(staff: Staff) {
    if (staff.bank_account_number && staff.bank_name) {
      return staff.bank_name;
    }
    if (staff.bank_account_number) {
      return 'BANK_TRANSFER';
    }
    return 'MANUAL';
  }

  private maskAccountNumber(accountNumber: string) {
    if (accountNumber.length <= 4) {
      return accountNumber;
    }

    return `${accountNumber.slice(0, 4)}...${accountNumber.slice(-2)}`;
  }

  private async loadDefaultPayoutMethods(staffIds: string[]) {
    if (!staffIds.length) {
      return new Map<string, StaffPayoutMethod>();
    }

    const methods = await this.staffPayoutMethodRepository.find({
      where: {
        staff_id: In(staffIds),
        is_default: true,
      },
      order: {
        updated_at: 'DESC',
        created_at: 'DESC',
      },
    });

    const methodMap = new Map<string, StaffPayoutMethod>();

    methods.forEach((method) => {
      if (!methodMap.has(method.staff_id)) {
        methodMap.set(method.staff_id, method);
      }
    });

    return methodMap;
  }

  private async findDefaultPayoutMethod(staffId: string) {
    const method = await this.staffPayoutMethodRepository.findOne({
      where: {
        staff_id: staffId,
        is_default: true,
      },
      order: {
        updated_at: 'DESC',
        created_at: 'DESC',
      },
    });

    return method || null;
  }

  /**
   * Get staff balance information (remaining balance, last payout, etc.)
   */
  async getStaffBalance(staffId: string) {
    const finance = await this.staffFinanceRepository.findOne({
      where: { staff_id: staffId },
    });

    if (!finance) {
      throw new NotFoundException(`Staff finance record not found for staff ${staffId}`);
    }

    return {
      remaining_balance: Number(finance.remaining_balance),
      total_paid_amount: Number(finance.total_paid_amount),
      last_payout_at: finance.last_payout_at,
      last_payout_amount: finance.last_payout_amount ? Number(finance.last_payout_amount) : null,
    };
  }

  /**
   * Get staff last payout transaction details
   */
  async getStaffLastPayout(staffId: string) {
    const lastPayout = await this.payoutRepository.findOne({
      where: {
        staff_id: staffId,
        status: PayoutTransactionStatus.COMPLETED,
      },
      order: {
        created_at: 'DESC',
      },
    });

    if (!lastPayout) {
      return null;
    }

    return {
      id: lastPayout.id,
      amount: Number(lastPayout.amount),
      paid_at: lastPayout.created_at,
      reference: lastPayout.reference_number || null,
    };
  }

  private resolvePaymentLabel(method: StaffPayoutMethod | null) {
    if (!method) {
      return 'BANK_TRANSFER';
    }

    if (method.method_type === 'BANK_ACCOUNT') {
      return method.bank_name ?? 'BANK_TRANSFER';
    }

    if (method.method_type === 'BKASH') {
      return 'bKash';
    }

    if (method.method_type === 'NAGAD') {
      return 'Nagad';
    }

    return method.bank_name ?? method.method_type;
  }

  private buildPaymentGateway(
    staff: Staff,
    method: StaffPayoutMethod | null,
    latestPaidAt: Date | null,
    totalEarningsToDate: number,
  ) {
    const providerName = this.resolvePaymentLabel(method);
    const accountNumber =
      method?.account_number ?? method?.bkash_number ?? method?.nagad_number ?? staff.bank_account_number ?? null;
    const accountHolderName =
      method?.account_holder_name ??
      method?.bkash_account_holder_name ??
      method?.nagad_account_holder_name ??
      staff.user?.full_name ??
      null;

    return {
      provider_name: providerName,
      logo_identifier: this.toLogoIdentifier(providerName),
      account_no: accountNumber,
      account_holder_name: accountHolderName,
      current_account_balance: this.toMoney(Math.max(totalEarningsToDate, 0)),
      last_used_at: latestPaidAt ? latestPaidAt.toISOString() : null,
    };
  }

  private parseOptionalDate(value?: string, fieldName?: string) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName || 'date'} must be a valid date`);
    }

    return parsed;
  }

  private buildShowingRange(totalRecords: number, currentPage: number, limit: number, itemCount: number) {
    if (!totalRecords || !itemCount) {
      return '0 - 0 of 0';
    }

    const start = (currentPage - 1) * limit + 1;
    const end = Math.min(start + itemCount - 1, totalRecords);

    return `${start} - ${end} of ${totalRecords}`;
  }

  private toLogoIdentifier(value: string) {
    return value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  private generateReferenceNumber(staff: Staff) {
    return `SAL-${staff.staff_code ?? staff.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
  }

  private getDaysInCurrentMonth() {
    return endOfMonth(new Date()).getDate();
  }

  private roundMoney(value: number | string) {
    return Math.round(Number(value) * 100) / 100;
  }

  private toMoney(value: number | string) {
    return this.roundMoney(value || 0);
  }
}
