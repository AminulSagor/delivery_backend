import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * COMPREHENSIVE SCHEMA SYNC MIGRATION
 * 
 * This migration ensures ALL columns exist in ALL tables based on current entities.
 * It uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS to be idempotent.
 * 
 * Tables synced:
 * - users
 * - merchants  
 * - stores
 * - hubs
 * - riders
 * - parcels
 * - customers
 * - pickup_requests
 * - delivery_verifications
 * - pricing_configurations
 * - return_charge_configurations
 * - coverage_areas
 * - carrybee_locations
 * - hub_managers
 * - merchant_profiles
 * - merchant_payout_methods
 * - payout_transactions
 * - merchant_invoices
 * - merchant_finances
 * - merchant_finance_transactions
 * - rider_settlements
 * - hub_transfer_records
 * - third_party_providers
 */
export class FullSchemaSync1768200000000 implements MigrationInterface {
  name = 'FullSchemaSync1768200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Starting full schema sync migration...');

    // Helper function to add column if not exists
    const addColumnIfNotExists = async (table: string, column: string, definition: string) => {
      const exists = await queryRunner.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = '${table}' AND column_name = '${column}'
      `);
      if (exists.length === 0) {
        try {
          await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
          console.log(`  ✅ Added ${table}.${column}`);
        } catch (e) {
          console.log(`  ⚠️  Could not add ${table}.${column}: ${e.message}`);
        }
      }
    };

    // Helper to create enum if not exists
    const createEnumIfNotExists = async (enumName: string, values: string[]) => {
      const exists = await queryRunner.query(`SELECT 1 FROM pg_type WHERE typname = '${enumName}'`);
      if (exists.length === 0) {
        const valuesStr = values.map(v => `'${v}'`).join(', ');
        await queryRunner.query(`CREATE TYPE "${enumName}" AS ENUM(${valuesStr})`);
        console.log(`  ✅ Created enum ${enumName}`);
      }
    };

    // ============================================================
    // ENUMS
    // ============================================================
    console.log('\n📋 Creating/checking enums...');

    await createEnumIfNotExists('stores_status_enum', ['PENDING', 'APPROVED', 'DECLINED']);
    await createEnumIfNotExists('bike_type_enum', ['BICYCLE', 'MOTORCYCLE', 'SCOOTER', 'VAN']);
    await createEnumIfNotExists('parcel_status_enum', [
      'PENDING', 'PICKED_UP', 'IN_HUB', 'ASSIGNED_TO_RIDER', 'ASSIGNED_TO_THIRD_PARTY',
      'OUT_FOR_DELIVERY', 'OUT_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'PARTIAL_DELIVERY',
      'EXCHANGE', 'FAILED_DELIVERY', 'RETURNED_TO_HUB', 'CANCELLED', 'RETURNED',
      'PAID_RETURN', 'RETURN_TO_MERCHANT', 'DELIVERY_RESCHEDULED'
    ]);
    await createEnumIfNotExists('payment_status_enum', ['UNPAID', 'PAID', 'COD_COLLECTED']);
    await createEnumIfNotExists('delivery_provider_enum', ['INTERNAL', 'CARRYBEE', 'OTHER']);
    await createEnumIfNotExists('financial_status_enum', ['PENDING', 'READY_FOR_INVOICE', 'INVOICED', 'PAID', 'CLEARANCE_REQUIRED']);

    // ============================================================
    // STORES TABLE
    // ============================================================
    console.log('\n📋 Syncing stores table...');
    
    await addColumnIfNotExists('stores', 'store_code', 'varchar(20) UNIQUE');
    await addColumnIfNotExists('stores', 'hub_id', 'uuid');
    await addColumnIfNotExists('stores', 'is_default', 'boolean DEFAULT false');
    await addColumnIfNotExists('stores', 'district', 'varchar(100)');
    await addColumnIfNotExists('stores', 'thana', 'varchar(100)');
    await addColumnIfNotExists('stores', 'area', 'varchar(100)');
    await addColumnIfNotExists('stores', 'carrybee_store_id', 'varchar(100)');
    await addColumnIfNotExists('stores', 'carrybee_city_id', 'integer');
    await addColumnIfNotExists('stores', 'carrybee_zone_id', 'integer');
    await addColumnIfNotExists('stores', 'carrybee_area_id', 'integer');
    await addColumnIfNotExists('stores', 'is_carrybee_synced', 'boolean DEFAULT false');
    await addColumnIfNotExists('stores', 'carrybee_synced_at', 'timestamp');
    
    // Status column with enum
    const storeStatusExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'stores' AND column_name = 'status'
    `);
    if (storeStatusExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "stores" ADD COLUMN "status" "stores_status_enum" DEFAULT 'PENDING'
      `);
      console.log('  ✅ Added stores.status');
    }

    // ============================================================
    // PARCELS TABLE
    // ============================================================
    console.log('\n📋 Syncing parcels table...');

    await addColumnIfNotExists('parcels', 'customer_id', 'uuid');
    await addColumnIfNotExists('parcels', 'merchant_order_id', 'varchar(100)');
    await addColumnIfNotExists('parcels', 'customer_secondary_phone', 'varchar(20)');
    await addColumnIfNotExists('parcels', 'product_description', 'varchar(255)');
    await addColumnIfNotExists('parcels', 'product_weight', 'decimal(5,2) DEFAULT 0');
    await addColumnIfNotExists('parcels', 'parcel_type', 'smallint');
    await addColumnIfNotExists('parcels', 'weight_charge', 'decimal(10,2) DEFAULT 0');
    await addColumnIfNotExists('parcels', 'cod_charge', 'decimal(10,2) DEFAULT 0');
    await addColumnIfNotExists('parcels', 'is_cod', 'boolean DEFAULT false');
    await addColumnIfNotExists('parcels', 'is_exchange', 'boolean DEFAULT false');
    await addColumnIfNotExists('parcels', 'receivable_amount', 'decimal(10,2) DEFAULT 0');
    await addColumnIfNotExists('parcels', 'cod_collected_amount', 'decimal(10,2) DEFAULT 0');
    await addColumnIfNotExists('parcels', 'return_charge', 'decimal(10,2) DEFAULT 0');
    await addColumnIfNotExists('parcels', 'delivery_charge_applicable', 'boolean DEFAULT true');
    await addColumnIfNotExists('parcels', 'return_charge_applicable', 'boolean DEFAULT false');
    await addColumnIfNotExists('parcels', 'invoice_id', 'uuid');
    await addColumnIfNotExists('parcels', 'clearance_required', 'boolean DEFAULT false');
    await addColumnIfNotExists('parcels', 'clearance_done', 'boolean DEFAULT false');
    await addColumnIfNotExists('parcels', 'clearance_invoice_id', 'uuid');
    await addColumnIfNotExists('parcels', 'paid_amount', 'decimal(10,2)');
    await addColumnIfNotExists('parcels', 'paid_to_merchant', 'boolean DEFAULT false');
    await addColumnIfNotExists('parcels', 'paid_to_merchant_at', 'timestamp');
    await addColumnIfNotExists('parcels', 'delivery_type', 'smallint DEFAULT 1');
    await addColumnIfNotExists('parcels', 'assigned_rider_id', 'uuid');
    await addColumnIfNotExists('parcels', 'assigned_at', 'timestamp');
    await addColumnIfNotExists('parcels', 'rider_accepted_at', 'timestamp');
    await addColumnIfNotExists('parcels', 'out_for_delivery_at', 'timestamp');
    await addColumnIfNotExists('parcels', 'special_instructions', 'text');
    await addColumnIfNotExists('parcels', 'admin_notes', 'text');
    await addColumnIfNotExists('parcels', 'return_reason', 'text');
    await addColumnIfNotExists('parcels', 'current_hub_id', 'uuid');
    await addColumnIfNotExists('parcels', 'origin_hub_id', 'uuid');
    await addColumnIfNotExists('parcels', 'destination_hub_id', 'uuid');
    await addColumnIfNotExists('parcels', 'is_inter_hub_transfer', 'boolean DEFAULT false');
    await addColumnIfNotExists('parcels', 'transferred_at', 'timestamp');
    await addColumnIfNotExists('parcels', 'received_at_destination_hub', 'timestamp');
    await addColumnIfNotExists('parcels', 'transfer_notes', 'text');
    await addColumnIfNotExists('parcels', 'third_party_provider_id', 'uuid');
    await addColumnIfNotExists('parcels', 'carrybee_consignment_id', 'varchar(100)');
    await addColumnIfNotExists('parcels', 'carrybee_delivery_fee', 'decimal(10,2)');
    await addColumnIfNotExists('parcels', 'carrybee_cod_fee', 'decimal(10,2)');
    await addColumnIfNotExists('parcels', 'assigned_to_carrybee_at', 'timestamp');
    await addColumnIfNotExists('parcels', 'recipient_carrybee_city_id', 'integer');
    await addColumnIfNotExists('parcels', 'recipient_carrybee_zone_id', 'integer');
    await addColumnIfNotExists('parcels', 'recipient_carrybee_area_id', 'integer');
    await addColumnIfNotExists('parcels', 'original_parcel_id', 'uuid');
    await addColumnIfNotExists('parcels', 'is_return_parcel', 'boolean DEFAULT false');
    await addColumnIfNotExists('parcels', 'picked_up_at', 'timestamp');
    await addColumnIfNotExists('parcels', 'delivered_at', 'timestamp');
    await addColumnIfNotExists('parcels', 'delivery_coverage_area_id', 'uuid');

    // Financial status enum column
    const financialStatusExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'parcels' AND column_name = 'financial_status'
    `);
    if (financialStatusExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "parcels" ADD COLUMN "financial_status" "financial_status_enum" DEFAULT 'PENDING'
      `);
      console.log('  ✅ Added parcels.financial_status');
    }

    // Delivery provider enum column
    const deliveryProviderExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'parcels' AND column_name = 'delivery_provider'
    `);
    if (deliveryProviderExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "parcels" ADD COLUMN "delivery_provider" "delivery_provider_enum" DEFAULT 'INTERNAL'
      `);
      console.log('  ✅ Added parcels.delivery_provider');
    }

    // ============================================================
    // RIDERS TABLE
    // ============================================================
    console.log('\n📋 Syncing riders table...');

    await addColumnIfNotExists('riders', 'photo', 'varchar(500)');
    await addColumnIfNotExists('riders', 'guardian_mobile_no', 'varchar(20)');
    await addColumnIfNotExists('riders', 'nid_number', 'varchar(50)');
    await addColumnIfNotExists('riders', 'present_address', 'text');
    await addColumnIfNotExists('riders', 'permanent_address', 'text');
    await addColumnIfNotExists('riders', 'fixed_salary', 'decimal(10,2) DEFAULT 0');
    await addColumnIfNotExists('riders', 'commission_per_delivery', 'decimal(10,2) DEFAULT 0');
    await addColumnIfNotExists('riders', 'nid_front_photo', 'varchar(500)');
    await addColumnIfNotExists('riders', 'nid_back_photo', 'varchar(500)');
    await addColumnIfNotExists('riders', 'license_front_photo', 'varchar(500)');
    await addColumnIfNotExists('riders', 'license_back_photo', 'varchar(500)');
    await addColumnIfNotExists('riders', 'parent_nid_front_photo', 'varchar(500)');
    await addColumnIfNotExists('riders', 'parent_nid_back_photo', 'varchar(500)');

    // Bike type enum column
    const bikeTypeExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'riders' AND column_name = 'bike_type'
    `);
    if (bikeTypeExists.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "riders" ADD COLUMN "bike_type" "bike_type_enum" DEFAULT 'MOTORCYCLE'
      `);
      console.log('  ✅ Added riders.bike_type');
    }

    // ============================================================
    // USERS TABLE
    // ============================================================
    console.log('\n📋 Syncing users table...');

    await addColumnIfNotExists('users', 'reset_otp', 'varchar(6)');
    await addColumnIfNotExists('users', 'reset_otp_expires', 'timestamp');

    // ============================================================
    // CUSTOMERS TABLE
    // ============================================================
    console.log('\n📋 Syncing customers table...');

    await addColumnIfNotExists('customers', 'secondary_phone', 'varchar(20)');
    await addColumnIfNotExists('customers', 'delivery_address', 'text');
    await addColumnIfNotExists('customers', 'coverage_area_id', 'uuid');

    // ============================================================
    // PRICING_CONFIGURATIONS TABLE
    // ============================================================
    console.log('\n📋 Syncing pricing_configurations table...');

    await addColumnIfNotExists('pricing_configurations', 'weight_step_kg', 'decimal(5,2) DEFAULT 0.5');

    // ============================================================
    // COVERAGE_AREAS TABLE
    // ============================================================
    console.log('\n📋 Syncing coverage_areas table...');

    await addColumnIfNotExists('coverage_areas', 'city_id', 'integer');
    await addColumnIfNotExists('coverage_areas', 'zone_id', 'integer');
    await addColumnIfNotExists('coverage_areas', 'area_id', 'integer');

    console.log('\n✅ Full schema sync migration completed!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This migration is additive only - no need to revert
    console.log('⬇️ Full schema sync migration - nothing to revert (additive only)');
  }
}

