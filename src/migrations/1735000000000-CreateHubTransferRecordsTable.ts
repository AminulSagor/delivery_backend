import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHubTransferRecordsTable1735000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE hub_transfer_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Relationships
        hub_manager_id UUID NOT NULL REFERENCES hub_managers(id) ON DELETE CASCADE,
        hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
        
        -- Transfer Details
        transferred_amount DECIMAL(10, 2) NOT NULL,
        
        -- Admin Bank Account Details
        admin_bank_name VARCHAR(255) NOT NULL,
        admin_bank_account_number VARCHAR(100) NOT NULL,
        admin_account_holder_name VARCHAR(255) NOT NULL,
        
        -- Transaction Reference
        transaction_reference_id VARCHAR(255) NULL,
        
        -- Proof Document
        proof_file_url VARCHAR(500) NOT NULL,
        proof_file_type VARCHAR(10) NOT NULL,
        proof_file_size INTEGER NOT NULL,
        
        -- Status & Approval
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        
        -- Admin Actions
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP NULL,
        admin_notes TEXT NULL,
        rejection_reason TEXT NULL,
        
        -- Hub Manager Notes
        notes TEXT NULL,
        
        -- Timestamps
        transfer_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Constraints
        CONSTRAINT check_transferred_amount_positive CHECK (transferred_amount > 0),
        CONSTRAINT check_proof_file_type CHECK (proof_file_type IN ('jpg', 'jpeg', 'png', 'pdf'))
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX idx_hub_transfer_hub_manager_date 
      ON hub_transfer_records(hub_manager_id, transfer_date DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_hub_transfer_hub_date 
      ON hub_transfer_records(hub_id, transfer_date DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_hub_transfer_status 
      ON hub_transfer_records(status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_hub_transfer_date 
      ON hub_transfer_records(transfer_date DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_hub_transfer_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_hub_transfer_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_hub_transfer_hub_date`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_hub_transfer_hub_manager_date`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS hub_transfer_records`);
  }
}

