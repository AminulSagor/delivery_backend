/**
 * Fix script to convert method_type column from varchar to enum
 * 
 * Usage: node scripts/fix-method-type-enum.js
 */

require('dotenv').config();
const { Client } = require('pg');

async function fixMethodTypeEnum() {
  console.log('🔧 Converting method_type from varchar to enum...\n');

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

    // Step 1: Check if the enum type exists
    const enumExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'merchant_payout_methods_method_type_enum'
      );
    `);

    if (!enumExists.rows[0].exists) {
      console.log('Creating enum type...');
      await client.query(`
        CREATE TYPE merchant_payout_methods_method_type_enum AS ENUM ('BANK_ACCOUNT', 'BKASH', 'NAGAD', 'CASH');
      `);
      console.log('✅ Created merchant_payout_methods_method_type_enum\n');
    } else {
      console.log('✅ Enum type already exists\n');
    }

    // Step 2: Check current column type
    const columnInfo = await client.query(`
      SELECT data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'merchant_payout_methods' 
      AND column_name = 'method_type';
    `);

    if (columnInfo.rows.length === 0) {
      console.log('Column method_type does not exist. Nothing to fix.');
      return;
    }

    const currentType = columnInfo.rows[0].udt_name;
    console.log(`Current column type: ${currentType}\n`);

    if (currentType === 'merchant_payout_methods_method_type_enum') {
      console.log('✅ method_type column is already using the enum type.\n');
    } else {
      // Step 3: Ensure all values are valid enum values
      console.log('Validating existing values...');
      const invalidValues = await client.query(`
        SELECT DISTINCT method_type 
        FROM merchant_payout_methods 
        WHERE method_type NOT IN ('BANK_ACCOUNT', 'BKASH', 'NAGAD', 'CASH')
        AND method_type IS NOT NULL;
      `);

      if (invalidValues.rows.length > 0) {
        console.log('❌ Found invalid method_type values:');
        console.log(invalidValues.rows);
        console.log('\nPlease fix these values before converting to enum.');
        return;
      }
      console.log('✅ All values are valid\n');

      // Step 4: Handle null values by setting them to CASH (default)
      const updateNulls = await client.query(`
        UPDATE merchant_payout_methods 
        SET method_type = 'CASH' 
        WHERE method_type IS NULL;
      `);
      if (updateNulls.rowCount > 0) {
        console.log(`Updated ${updateNulls.rowCount} null values to 'CASH'\n`);
      }

      // Step 5: Convert the column type
      console.log('Converting column to enum type...');
      await client.query(`
        ALTER TABLE merchant_payout_methods 
        ALTER COLUMN method_type TYPE merchant_payout_methods_method_type_enum 
        USING method_type::merchant_payout_methods_method_type_enum;
      `);
      console.log('✅ Column converted to enum type\n');
    }

    // Step 6: Do the same for status column if needed
    const statusEnumExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'merchant_payout_methods_status_enum'
      );
    `);

    if (!statusEnumExists.rows[0].exists) {
      console.log('Creating status enum type...');
      await client.query(`
        CREATE TYPE merchant_payout_methods_status_enum AS ENUM ('PENDING', 'VERIFIED');
      `);
      console.log('✅ Created merchant_payout_methods_status_enum\n');
    }

    const statusColumnInfo = await client.query(`
      SELECT udt_name
      FROM information_schema.columns 
      WHERE table_name = 'merchant_payout_methods' 
      AND column_name = 'status';
    `);

    if (statusColumnInfo.rows.length > 0 && statusColumnInfo.rows[0].udt_name !== 'merchant_payout_methods_status_enum') {
      console.log('Converting status column to enum type...');
      // First drop the default, then convert, then set default again
      await client.query(`ALTER TABLE merchant_payout_methods ALTER COLUMN status DROP DEFAULT;`);
      await client.query(`
        ALTER TABLE merchant_payout_methods 
        ALTER COLUMN status TYPE merchant_payout_methods_status_enum 
        USING status::merchant_payout_methods_status_enum;
      `);
      await client.query(`ALTER TABLE merchant_payout_methods ALTER COLUMN status SET DEFAULT 'PENDING';`);
      console.log('✅ Status column converted to enum type\n');
    }

    // Step 7: Similar for bkash_account_type
    const bkashEnumExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'merchant_payout_methods_bkash_account_type_enum'
      );
    `);

    if (!bkashEnumExists.rows[0].exists) {
      console.log('Creating bkash_account_type enum type...');
      await client.query(`
        CREATE TYPE merchant_payout_methods_bkash_account_type_enum AS ENUM ('PERSONAL', 'AGENT', 'MERCHANT');
      `);
      console.log('✅ Created merchant_payout_methods_bkash_account_type_enum\n');
    }

    const bkashColumnInfo = await client.query(`
      SELECT udt_name
      FROM information_schema.columns 
      WHERE table_name = 'merchant_payout_methods' 
      AND column_name = 'bkash_account_type';
    `);

    if (bkashColumnInfo.rows.length > 0 && 
        bkashColumnInfo.rows[0].udt_name !== 'merchant_payout_methods_bkash_account_type_enum' &&
        bkashColumnInfo.rows[0].udt_name !== 'bkashaccounttype') {
      console.log('Converting bkash_account_type column to enum type...');
      try {
        await client.query(`
          ALTER TABLE merchant_payout_methods 
          ALTER COLUMN bkash_account_type TYPE merchant_payout_methods_bkash_account_type_enum 
          USING bkash_account_type::merchant_payout_methods_bkash_account_type_enum;
        `);
        console.log('✅ bkash_account_type column converted to enum type\n');
      } catch (e) {
        console.log(`ℹ️  bkash_account_type conversion skipped: ${e.message}\n`);
      }
    }

    // Step 8: Similar for nagad_account_type
    const nagadEnumExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'merchant_payout_methods_nagad_account_type_enum'
      );
    `);

    if (!nagadEnumExists.rows[0].exists) {
      console.log('Creating nagad_account_type enum type...');
      await client.query(`
        CREATE TYPE merchant_payout_methods_nagad_account_type_enum AS ENUM ('PERSONAL', 'MERCHANT');
      `);
      console.log('✅ Created merchant_payout_methods_nagad_account_type_enum\n');
    }

    const nagadColumnInfo = await client.query(`
      SELECT udt_name
      FROM information_schema.columns 
      WHERE table_name = 'merchant_payout_methods' 
      AND column_name = 'nagad_account_type';
    `);

    if (nagadColumnInfo.rows.length > 0 && 
        nagadColumnInfo.rows[0].udt_name !== 'merchant_payout_methods_nagad_account_type_enum' &&
        nagadColumnInfo.rows[0].udt_name !== 'nagadaccounttype') {
      console.log('Converting nagad_account_type column to enum type...');
      try {
        await client.query(`
          ALTER TABLE merchant_payout_methods 
          ALTER COLUMN nagad_account_type TYPE merchant_payout_methods_nagad_account_type_enum 
          USING nagad_account_type::merchant_payout_methods_nagad_account_type_enum;
        `);
        console.log('✅ nagad_account_type column converted to enum type\n');
      } catch (e) {
        console.log(`ℹ️  nagad_account_type conversion skipped: ${e.message}\n`);
      }
    }

    console.log('🎉 Fix complete! You can now start the application.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixMethodTypeEnum();

