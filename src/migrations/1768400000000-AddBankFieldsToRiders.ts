import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBankFieldsToRiders1768400000000 implements MigrationInterface {
  name = 'AddBankFieldsToRiders1768400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('riders');
    
    if (!tableExists) {
      console.log('⚠️ riders table does not exist, skipping migration');
      return;
    }

    // Add bank_name column if not exists
    const bankNameExists = await queryRunner.hasColumn('riders', 'bank_name');
    if (!bankNameExists) {
      await queryRunner.addColumn('riders', new TableColumn({
        name: 'bank_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }));
      console.log('✅ Added bank_name column to riders table');
    } else {
      console.log('✅ bank_name column already exists in riders table');
    }

    // Add bank_account_number column if not exists
    const bankAccountExists = await queryRunner.hasColumn('riders', 'bank_account_number');
    if (!bankAccountExists) {
      await queryRunner.addColumn('riders', new TableColumn({
        name: 'bank_account_number',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }));
      console.log('✅ Added bank_account_number column to riders table');
    } else {
      console.log('✅ bank_account_number column already exists in riders table');
    }

    // Add bank_branch column if not exists
    const bankBranchExists = await queryRunner.hasColumn('riders', 'bank_branch');
    if (!bankBranchExists) {
      await queryRunner.addColumn('riders', new TableColumn({
        name: 'bank_branch',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }));
      console.log('✅ Added bank_branch column to riders table');
    } else {
      console.log('✅ bank_branch column already exists in riders table');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('riders');
    
    if (!tableExists) {
      return;
    }

    // Remove columns in reverse order
    const bankBranchExists = await queryRunner.hasColumn('riders', 'bank_branch');
    if (bankBranchExists) {
      await queryRunner.dropColumn('riders', 'bank_branch');
      console.log('✅ Dropped bank_branch column from riders table');
    }

    const bankAccountExists = await queryRunner.hasColumn('riders', 'bank_account_number');
    if (bankAccountExists) {
      await queryRunner.dropColumn('riders', 'bank_account_number');
      console.log('✅ Dropped bank_account_number column from riders table');
    }

    const bankNameExists = await queryRunner.hasColumn('riders', 'bank_name');
    if (bankNameExists) {
      await queryRunner.dropColumn('riders', 'bank_name');
      console.log('✅ Dropped bank_name column from riders table');
    }
  }
}

