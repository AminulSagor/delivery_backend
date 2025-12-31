import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMerchantPayoutSystem1734876000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create merchant_payout_methods table
    await queryRunner.query(`
      CREATE TABLE merchant_payout_methods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        
        -- Method Type
        method_type VARCHAR(50) NOT NULL,
        
        -- Status
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        is_default BOOLEAN DEFAULT false,
        
        -- Bank Account Details (nullable, used only for BANK_ACCOUNT)
        bank_name VARCHAR(255),
        branch_name VARCHAR(255),
        account_holder_name VARCHAR(255),
        account_number VARCHAR(100),
        routing_number VARCHAR(50),
        
        -- bKash Details (nullable, used only for BKASH)
        bkash_number VARCHAR(20),
        bkash_account_holder_name VARCHAR(255),
        bkash_account_type VARCHAR(50),
        
        -- Nagad Details (nullable, used only for NAGAD)
        nagad_number VARCHAR(20),
        nagad_account_holder_name VARCHAR(255),
        nagad_account_type VARCHAR(50),
        
        -- Verification
        verified_at TIMESTAMP,
        verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Constraints
        CONSTRAINT unique_merchant_method UNIQUE(merchant_id, method_type),
        CONSTRAINT check_method_details CHECK (
          (method_type = 'BANK_ACCOUNT' AND bank_name IS NOT NULL) OR
          (method_type = 'BKASH' AND bkash_number IS NOT NULL) OR
          (method_type = 'NAGAD' AND nagad_number IS NOT NULL) OR
          (method_type = 'CASH')
        )
      )
    `);

    // Create index for default method query
    await queryRunner.query(`
      CREATE INDEX idx_merchant_payout_default ON merchant_payout_methods(merchant_id, is_default)
    `);

    // Create payout_transactions table
    await queryRunner.query(`
      CREATE TABLE payout_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        payout_method_id UUID NOT NULL REFERENCES merchant_payout_methods(id) ON DELETE RESTRICT,
        
        -- Transaction Details
        amount DECIMAL(10, 2) NOT NULL,
        reference_number VARCHAR(100) UNIQUE,
        
        -- Status
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        
        -- Notes
        admin_notes TEXT,
        failure_reason TEXT,
        
        -- Timestamps
        initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        completed_at TIMESTAMP,
        
        -- Who initiated
        initiated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for payout_transactions
    await queryRunner.query(`
      CREATE INDEX idx_payout_merchant ON payout_transactions(merchant_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_payout_status ON payout_transactions(status)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_payout_date ON payout_transactions(created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payout_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payout_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payout_merchant`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_merchant_payout_default`);
    
    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS payout_transactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS merchant_payout_methods`);
  }
}

