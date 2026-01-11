import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserResetOtpColumns1736523700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add reset_otp column if it doesn't exist
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(6) DEFAULT NULL;
    `);

    // Add reset_otp_expires column if it doesn't exist
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS reset_otp_expires TIMESTAMP DEFAULT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS reset_otp;`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS reset_otp_expires;`);
  }
}

