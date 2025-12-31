import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceSystemFields1735200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add financial tracking fields to parcels table
    await queryRunner.query(`
      ALTER TABLE parcels 
      ADD COLUMN cod_collected_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
      ADD COLUMN return_charge DECIMAL(10,2) DEFAULT 0 NOT NULL,
      ADD COLUMN delivery_charge_applicable BOOLEAN DEFAULT true NOT NULL,
      ADD COLUMN return_charge_applicable BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN financial_status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
      ADD COLUMN invoice_id UUID NULL,
      ADD COLUMN clearance_required BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN clearance_done BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN clearance_invoice_id UUID NULL,
      ADD COLUMN paid_amount DECIMAL(10,2) NULL
    `);

    // Create merchant_invoices table
    await queryRunner.query(`
      CREATE TABLE merchant_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_no VARCHAR(50) UNIQUE NOT NULL,
        merchant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        -- Parcel summary
        total_parcels INTEGER DEFAULT 0 NOT NULL,
        delivered_count INTEGER DEFAULT 0 NOT NULL,
        partial_delivery_count INTEGER DEFAULT 0 NOT NULL,
        returned_count INTEGER DEFAULT 0 NOT NULL,
        paid_return_count INTEGER DEFAULT 0 NOT NULL,
        
        -- Financial summary
        total_cod_amount DECIMAL(12,2) DEFAULT 0 NOT NULL,
        total_cod_collected DECIMAL(12,2) DEFAULT 0 NOT NULL,
        total_delivery_charges DECIMAL(12,2) DEFAULT 0 NOT NULL,
        total_return_charges DECIMAL(12,2) DEFAULT 0 NOT NULL,
        payable_amount DECIMAL(12,2) DEFAULT 0 NOT NULL,
        
        -- Status
        invoice_status VARCHAR(50) DEFAULT 'GENERATED' NOT NULL,
        
        -- Payment tracking
        paid_at TIMESTAMP NULL,
        paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
        payment_reference VARCHAR(100) NULL,
        notes TEXT NULL,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Create indexes for parcels
    await queryRunner.query(`
      CREATE INDEX idx_parcels_financial_status 
      ON parcels(financial_status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_parcels_invoice_id 
      ON parcels(invoice_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_parcels_clearance 
      ON parcels(clearance_required, clearance_done)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_parcels_merchant_financial 
      ON parcels(merchant_id, financial_status, paid_to_merchant)
    `);

    // Create indexes for merchant_invoices
    await queryRunner.query(`
      CREATE INDEX idx_merchant_invoices_merchant 
      ON merchant_invoices(merchant_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_merchant_invoices_status 
      ON merchant_invoices(invoice_status)
    `);

    // Add foreign key constraint for invoice_id in parcels
    await queryRunner.query(`
      ALTER TABLE parcels 
      ADD CONSTRAINT fk_parcels_invoice 
      FOREIGN KEY (invoice_id) 
      REFERENCES merchant_invoices(id) 
      ON DELETE SET NULL
    `);

    // Sync existing data: set cod_collected_amount from cod_amount for delivered parcels
    await queryRunner.query(`
      UPDATE parcels 
      SET cod_collected_amount = cod_amount 
      WHERE status IN ('DELIVERED', 'PARTIAL_DELIVERY') 
        AND payment_status = 'COD_COLLECTED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.query(`
      ALTER TABLE parcels 
      DROP CONSTRAINT IF EXISTS fk_parcels_invoice
    `);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_merchant_invoices_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_merchant_invoices_merchant`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_parcels_merchant_financial`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_parcels_clearance`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_parcels_invoice_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_parcels_financial_status`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS merchant_invoices`);

    // Drop columns from parcels
    await queryRunner.query(`
      ALTER TABLE parcels 
      DROP COLUMN IF EXISTS paid_amount,
      DROP COLUMN IF EXISTS clearance_invoice_id,
      DROP COLUMN IF EXISTS clearance_done,
      DROP COLUMN IF EXISTS clearance_required,
      DROP COLUMN IF EXISTS invoice_id,
      DROP COLUMN IF EXISTS financial_status,
      DROP COLUMN IF EXISTS return_charge_applicable,
      DROP COLUMN IF EXISTS delivery_charge_applicable,
      DROP COLUMN IF EXISTS return_charge,
      DROP COLUMN IF EXISTS cod_collected_amount
    `);
  }
}

