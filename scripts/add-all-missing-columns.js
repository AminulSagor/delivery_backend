/**
 * Add all missing columns to the database
 * This script adds columns that entities expect but don't exist in the database
 */

require('dotenv').config();
const { Client } = require('pg');

async function addAllMissingColumns() {
  console.log('🔧 Adding all missing columns...\n');

  const client = new Client({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB || 'courier_db',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Helper function to add column if not exists
    async function addColumn(table, column, type, defaultVal = null) {
      try {
        const exists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
          )
        `, [table, column]);

        if (!exists.rows[0].exists) {
          const defaultClause = defaultVal !== null ? ` DEFAULT ${defaultVal}` : '';
          await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type}${defaultClause}`);
          console.log(`  ✅ Added ${table}.${column}`);
          return true;
        }
        return false;
      } catch (e) {
        console.log(`  ⚠️ Could not add ${table}.${column}: ${e.message}`);
        return false;
      }
    }

    // ============================================
    // USERS TABLE
    // ============================================
    console.log('📋 Checking users table...');
    await addColumn('users', 'reset_otp', 'VARCHAR(6)', 'NULL');
    await addColumn('users', 'reset_otp_expires', 'TIMESTAMP', 'NULL');
    await addColumn('users', 'refresh_token', 'TEXT', 'NULL');
    console.log('');

    // ============================================
    // STORES TABLE
    // ============================================
    console.log('📋 Checking stores table...');
    await addColumn('stores', 'status', 'VARCHAR(50)', "'PENDING'");
    await addColumn('stores', 'assigned_hub_id', 'UUID', 'NULL');
    await addColumn('stores', 'is_default', 'BOOLEAN', 'false');
    await addColumn('stores', 'store_code', 'VARCHAR(50)', 'NULL');
    console.log('');

    // ============================================
    // MERCHANTS TABLE
    // ============================================
    console.log('📋 Checking merchants table...');
    await addColumn('merchants', 'status', 'merchants_status_enum', "'PENDING'");
    await addColumn('merchants', 'company_name', 'VARCHAR(255)', 'NULL');
    await addColumn('merchants', 'trade_license_number', 'VARCHAR(100)', 'NULL');
    await addColumn('merchants', 'tin_number', 'VARCHAR(100)', 'NULL');
    await addColumn('merchants', 'bin_number', 'VARCHAR(100)', 'NULL');
    await addColumn('merchants', 'nid_front_url', 'TEXT', 'NULL');
    await addColumn('merchants', 'nid_back_url', 'TEXT', 'NULL');
    await addColumn('merchants', 'trade_license_url', 'TEXT', 'NULL');
    await addColumn('merchants', 'tin_certificate_url', 'TEXT', 'NULL');
    await addColumn('merchants', 'bin_certificate_url', 'TEXT', 'NULL');
    console.log('');

    // ============================================
    // PARCELS TABLE
    // ============================================
    console.log('📋 Checking parcels table...');
    await addColumn('parcels', 'payment_status', 'parcels_payment_status_enum', "'UNPAID'");
    await addColumn('parcels', 'is_cod', 'BOOLEAN', 'true');
    await addColumn('parcels', 'invoice_id', 'UUID', 'NULL');
    await addColumn('parcels', 'paid_to_merchant', 'BOOLEAN', 'false');
    await addColumn('parcels', 'return_charge', 'DECIMAL(10,2)', '0');
    await addColumn('parcels', 'pickup_request_id', 'UUID', 'NULL');
    await addColumn('parcels', 'assigned_rider_id', 'UUID', 'NULL');
    await addColumn('parcels', 'current_hub_id', 'UUID', 'NULL');
    await addColumn('parcels', 'destination_hub_id', 'UUID', 'NULL');
    await addColumn('parcels', 'third_party_provider_id', 'UUID', 'NULL');
    await addColumn('parcels', 'third_party_tracking_id', 'VARCHAR(255)', 'NULL');
    await addColumn('parcels', 'scheduled_delivery_date', 'DATE', 'NULL');
    await addColumn('parcels', 'delivery_notes', 'TEXT', 'NULL');
    console.log('');

    // ============================================
    // HUBS TABLE
    // ============================================
    console.log('📋 Checking hubs table...');
    await addColumn('hubs', 'hub_code', 'VARCHAR(50)', 'NULL');
    await addColumn('hubs', 'is_active', 'BOOLEAN', 'true');
    console.log('');

    // ============================================
    // RIDERS TABLE
    // ============================================
    console.log('📋 Checking riders table...');
    await addColumn('riders', 'bike_type', 'bike_type_enum', 'NULL');
    await addColumn('riders', 'bike_registration', 'VARCHAR(50)', 'NULL');
    await addColumn('riders', 'is_active', 'BOOLEAN', 'true');
    console.log('');

    // ============================================
    // PICKUP_REQUESTS TABLE
    // ============================================
    console.log('📋 Checking pickup_requests table...');
    await addColumn('pickup_requests', 'assigned_rider_id', 'UUID', 'NULL');
    await addColumn('pickup_requests', 'preferred_date', 'DATE', 'NULL');
    await addColumn('pickup_requests', 'preferred_time_slot', 'VARCHAR(50)', 'NULL');
    console.log('');

    // ============================================
    // DELIVERY_VERIFICATIONS TABLE
    // ============================================
    console.log('📋 Checking delivery_verifications table...');
    await addColumn('delivery_verifications', 'rider_id', 'UUID', 'NULL');
    await addColumn('delivery_verifications', 'selected_status', 'VARCHAR(50)', 'NULL');
    await addColumn('delivery_verifications', 'otp_sent_to_phone', 'VARCHAR(20)', 'NULL');
    await addColumn('delivery_verifications', 'customer_phone_used', 'VARCHAR(20)', 'NULL');
    console.log('');

    // ============================================
    // PRICING TABLE
    // ============================================
    console.log('📋 Checking pricing table...');
    await addColumn('pricing', 'store_id', 'UUID', 'NULL');
    await addColumn('pricing', 'zone', 'pricing_zone_enum', 'NULL');
    console.log('');

    // ============================================
    // MERCHANT_INVOICES TABLE (if exists)
    // ============================================
    const invoiceTableExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'merchant_invoices')
    `);
    if (invoiceTableExists.rows[0].exists) {
      console.log('📋 Checking merchant_invoices table...');
      await addColumn('merchant_invoices', 'payout_method_id', 'UUID', 'NULL');
      await addColumn('merchant_invoices', 'paid_at', 'TIMESTAMP', 'NULL');
      await addColumn('merchant_invoices', 'transaction_reference', 'VARCHAR(255)', 'NULL');
      console.log('');
    }

    // ============================================
    // Create missing enum types
    // ============================================
    console.log('📋 Creating any missing enum types...');
    
    const enumsToCreate = [
      { name: 'stores_status_enum', values: ['PENDING', 'APPROVED', 'DECLINED'] },
      { name: 'bike_type_enum', values: ['BICYCLE', 'MOTORCYCLE', 'SCOOTER'] },
    ];

    for (const e of enumsToCreate) {
      const exists = await client.query(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = $1)`, [e.name]);
      if (!exists.rows[0].exists) {
        const values = e.values.map(v => `'${v}'`).join(', ');
        await client.query(`CREATE TYPE ${e.name} AS ENUM (${values})`);
        console.log(`  ✅ Created ${e.name}`);
      }
    }
    console.log('');

    console.log('🎉 All missing columns added!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addAllMissingColumns();

