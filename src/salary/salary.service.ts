import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Staff } from '../staff/entities/staff.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Parcel, ParcelStatus, RIDER_DELIVERY_STATUSES } from '../parcels/entities/parcel.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { StaffPosition } from '../common/enums/staff-position.enum';
import { PayoutTransactionStatus } from '../common/enums/payout-transaction-status.enum';
import { GenerateSalaryDto } from './dto/generate-salary.dto';
import { ProcessSalaryPaymentDto } from './dto/process-salary-payment.dto';
import { format, endOfMonth, startOfMonth } from 'date-fns';
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
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
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
          attendance: {
            present: 0,
            total_days: this.getDaysInCurrentMonth(),
          },
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
          attendance: breakdown.attendance,
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
      status: PayoutTransactionStatus.COMPLETED,
      admin_notes: `Processed via ${dto.payment_method} (${dto.account_id})`,
      failure_reason: null,
      initiated_by: initiatedBy,
      initiated_at: new Date(),
      processed_at: new Date(),
      completed_at: new Date(),
    });

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
        completed_at: saved.completed_at,
      },
    };
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
        account_id: `bank_${staff.id}`,
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
