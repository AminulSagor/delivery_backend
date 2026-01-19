import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bank } from './entities/bank.entity';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

@Injectable()
export class BanksService {
  private readonly logger = new Logger(BanksService.name);

  constructor(
    @InjectRepository(Bank)
    private bankRepository: Repository<Bank>,
  ) {}

  /**
   * Create a new bank (Admin only)
   */
  async create(createBankDto: CreateBankDto): Promise<Bank> {
    // Check if bank with same name or short_name exists
    const existing = await this.bankRepository.findOne({
      where: [
        { name: createBankDto.name },
        { short_name: createBankDto.short_name },
      ],
    });

    if (existing) {
      throw new ConflictException(
        `Bank with name "${createBankDto.name}" or short name "${createBankDto.short_name}" already exists`,
      );
    }

    const bank = this.bankRepository.create(createBankDto);
    const savedBank = await this.bankRepository.save(bank);

    this.logger.log(`[BANK CREATED] ${savedBank.name} (${savedBank.short_name})`);
    return savedBank;
  }

  /**
   * Get all banks (Admin - includes inactive)
   */
  async findAll(): Promise<Bank[]> {
    return this.bankRepository.find({
      order: { display_order: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Get all active banks (for merchants/public)
   */
  async findAllActive(): Promise<Bank[]> {
    return this.bankRepository.find({
      where: { is_active: true },
      order: { display_order: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Get a single bank by ID
   */
  async findOne(id: string): Promise<Bank> {
    const bank = await this.bankRepository.findOne({ where: { id } });
    if (!bank) {
      throw new NotFoundException(`Bank with ID ${id} not found`);
    }
    return bank;
  }

  /**
   * Update a bank (Admin only)
   */
  async update(id: string, updateBankDto: UpdateBankDto): Promise<Bank> {
    const bank = await this.findOne(id);

    // Check for duplicate name/short_name if being updated
    if (updateBankDto.name || updateBankDto.short_name) {
      const existing = await this.bankRepository
        .createQueryBuilder('bank')
        .where('bank.id != :id', { id })
        .andWhere(
          '(bank.name = :name OR bank.short_name = :short_name)',
          {
            name: updateBankDto.name || bank.name,
            short_name: updateBankDto.short_name || bank.short_name,
          },
        )
        .getOne();

      if (existing) {
        throw new ConflictException(
          'Bank with this name or short name already exists',
        );
      }
    }

    Object.assign(bank, updateBankDto);
    const updatedBank = await this.bankRepository.save(bank);

    this.logger.log(`[BANK UPDATED] ${updatedBank.name}`);
    return updatedBank;
  }

  /**
   * Delete a bank (Admin only)
   */
  async remove(id: string): Promise<{ message: string }> {
    const bank = await this.findOne(id);
    await this.bankRepository.remove(bank);

    this.logger.log(`[BANK DELETED] ${bank.name}`);
    return { message: `Bank "${bank.name}" has been deleted` };
  }

  /**
   * Toggle bank active status (Admin only)
   */
  async toggleActive(id: string): Promise<Bank> {
    const bank = await this.findOne(id);
    bank.is_active = !bank.is_active;
    const updatedBank = await this.bankRepository.save(bank);

    this.logger.log(
      `[BANK ${bank.is_active ? 'ACTIVATED' : 'DEACTIVATED'}] ${bank.name}`,
    );
    return updatedBank;
  }

  /**
   * Seed default Bangladeshi banks
   */
  async seedDefaultBanks(): Promise<{ message: string; created: number }> {
    const defaultBanks = [
      { name: 'Dutch Bangla Bank Limited', short_name: 'DBBL', display_order: 1 },
      { name: 'BRAC Bank Limited', short_name: 'BRAC', display_order: 2 },
      { name: 'City Bank Limited', short_name: 'CBL', display_order: 3 },
      { name: 'Eastern Bank Limited', short_name: 'EBL', display_order: 4 },
      { name: 'Islami Bank Bangladesh Limited', short_name: 'IBBL', display_order: 5 },
      { name: 'Prime Bank Limited', short_name: 'PBL', display_order: 6 },
      { name: 'Pubali Bank Limited', short_name: 'PUBALI', display_order: 7 },
      { name: 'Sonali Bank Limited', short_name: 'SBL', display_order: 8 },
      { name: 'Janata Bank Limited', short_name: 'JBL', display_order: 9 },
      { name: 'Agrani Bank Limited', short_name: 'ABL', display_order: 10 },
      { name: 'Rupali Bank Limited', short_name: 'RBL', display_order: 11 },
      { name: 'Bangladesh Krishi Bank', short_name: 'BKB', display_order: 12 },
      { name: 'Standard Chartered Bank', short_name: 'SCB', display_order: 13 },
      { name: 'HSBC Bangladesh', short_name: 'HSBC', display_order: 14 },
      { name: 'Mutual Trust Bank Limited', short_name: 'MTB', display_order: 15 },
      { name: 'United Commercial Bank Limited', short_name: 'UCB', display_order: 16 },
      { name: 'Uttara Bank Limited', short_name: 'UBL', display_order: 17 },
      { name: 'Bank Asia Limited', short_name: 'BAL', display_order: 18 },
      { name: 'Social Islami Bank Limited', short_name: 'SIBL', display_order: 19 },
      { name: 'Al-Arafah Islami Bank Limited', short_name: 'AIBL', display_order: 20 },
      { name: 'Exim Bank Limited', short_name: 'EXIM', display_order: 21 },
      { name: 'Jamuna Bank Limited', short_name: 'JAMUNA', display_order: 22 },
      { name: 'Southeast Bank Limited', short_name: 'SEBL', display_order: 23 },
      { name: 'One Bank Limited', short_name: 'OBL', display_order: 24 },
      { name: 'Trust Bank Limited', short_name: 'TBL', display_order: 25 },
      { name: 'Dhaka Bank Limited', short_name: 'DBL', display_order: 26 },
      { name: 'NCC Bank Limited', short_name: 'NCCBL', display_order: 27 },
      { name: 'Mercantile Bank Limited', short_name: 'MBL', display_order: 28 },
      { name: 'AB Bank Limited', short_name: 'AB', display_order: 29 },
      { name: 'National Bank Limited', short_name: 'NBL', display_order: 30 },
    ];

    let created = 0;

    for (const bankData of defaultBanks) {
      const exists = await this.bankRepository.findOne({
        where: [{ name: bankData.name }, { short_name: bankData.short_name }],
      });

      if (!exists) {
        await this.bankRepository.save(
          this.bankRepository.create({ ...bankData, is_active: true }),
        );
        created++;
      }
    }

    this.logger.log(`[BANKS SEEDED] Created ${created} new banks`);
    return {
      message: `Successfully seeded banks. Created ${created} new banks.`,
      created,
    };
  }
}

