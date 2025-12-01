import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateDeliveryVerificationsTable1732350000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM type for verification status
    await queryRunner.query(`
      CREATE TYPE delivery_verification_status AS ENUM (
        'PENDING',
        'OTP_SENT',
        'OTP_VERIFIED',
        'OTP_FAILED',
        'COMPLETED'
      );
    `);

    // Create delivery_verifications table
    await queryRunner.createTable(
      new Table({
        name: 'delivery_verifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'parcel_id',
            type: 'uuid',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'expected_cod_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'collected_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'amount_difference',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'has_amount_difference',
            type: 'boolean',
            default: false,
          },
          {
            name: 'difference_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'requires_otp_verification',
            type: 'boolean',
            default: false,
          },
          {
            name: 'otp_code',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'otp_sent_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'otp_verified_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'otp_attempts',
            type: 'int',
            default: 0,
          },
          {
            name: 'otp_expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'verification_status',
            type: 'delivery_verification_status',
            default: "'PENDING'",
          },
          {
            name: 'merchant_phone_used',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'merchant_approved',
            type: 'boolean',
            default: false,
          },
          {
            name: 'merchant_approved_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'delivery_attempted_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'delivery_completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add foreign key to parcels
    await queryRunner.createForeignKey(
      'delivery_verifications',
      new TableForeignKey({
        columnNames: ['parcel_id'],
        referencedTableName: 'parcels',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add indexes
    await queryRunner.createIndex(
      'delivery_verifications',
      new TableIndex({
        name: 'idx_delivery_verifications_parcel_id',
        columnNames: ['parcel_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'delivery_verifications',
      new TableIndex({
        name: 'idx_delivery_verifications_status',
        columnNames: ['verification_status'],
      }),
    );

    await queryRunner.createIndex(
      'delivery_verifications',
      new TableIndex({
        name: 'idx_delivery_verifications_otp_expires',
        columnNames: ['otp_expires_at'],
      }),
    );

    // Add generated column for amount_difference using raw SQL
    await queryRunner.query(`
      ALTER TABLE delivery_verifications 
      DROP COLUMN amount_difference;
    `);

    await queryRunner.query(`
      ALTER TABLE delivery_verifications 
      ADD COLUMN amount_difference DECIMAL(10,2) 
      GENERATED ALWAYS AS (collected_amount - expected_cod_amount) STORED;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('delivery_verifications', 'idx_delivery_verifications_otp_expires');
    await queryRunner.dropIndex('delivery_verifications', 'idx_delivery_verifications_status');
    await queryRunner.dropIndex('delivery_verifications', 'idx_delivery_verifications_parcel_id');

    // Drop foreign key
    const table = await queryRunner.getTable('delivery_verifications');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('delivery_verifications', foreignKey);
      }
    }

    // Drop table
    await queryRunner.dropTable('delivery_verifications');

    // Drop ENUM type
    await queryRunner.query(`DROP TYPE IF EXISTS delivery_verification_status;`);
  }
}
