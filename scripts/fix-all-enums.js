/**
 * Comprehensive enum fix script
 * Fixes all enum type issues to allow TypeORM synchronization
 */

require('dotenv').config();
const { Client } = require('pg');

async function fixAllEnums() {
  console.log('🔧 Fixing all enum types...\n');

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

    // Step 1: Drop all _old enum types with CASCADE
    console.log('Step 1: Dropping _old enum types...');
    const oldEnums = await client.query(`
      SELECT typname FROM pg_type 
      WHERE typname LIKE '%_old' AND typtype = 'e'
    `);
    
    for (const row of oldEnums.rows) {
      console.log(`  Dropping: ${row.typname}`);
      await client.query(`DROP TYPE IF EXISTS "${row.typname}" CASCADE`);
    }
    console.log('  ✅ Done\n');

    // Step 2: Create TypeORM expected enum types for delivery_verifications
    console.log('Step 2: Creating TypeORM expected enum types...');
    
    // Check and create delivery_verifications_otp_recipient_type_enum
    const otpRecipientEnumExists = await client.query(`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_verifications_otp_recipient_type_enum')
    `);
    if (!otpRecipientEnumExists.rows[0].exists) {
      await client.query(`
        CREATE TYPE delivery_verifications_otp_recipient_type_enum AS ENUM ('MERCHANT', 'CUSTOMER')
      `);
      console.log('  Created delivery_verifications_otp_recipient_type_enum');
    }

    // Check and create delivery_verifications_otp_verified_by_enum (same values)
    const otpVerifiedByEnumExists = await client.query(`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_verifications_otp_verified_by_enum')
    `);
    if (!otpVerifiedByEnumExists.rows[0].exists) {
      await client.query(`
        CREATE TYPE delivery_verifications_otp_verified_by_enum AS ENUM ('MERCHANT', 'CUSTOMER')
      `);
      console.log('  Created delivery_verifications_otp_verified_by_enum');
    }

    // Check and create delivery_verifications_verification_status_enum
    const verStatusEnumExists = await client.query(`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_verifications_verification_status_enum')
    `);
    if (!verStatusEnumExists.rows[0].exists) {
      await client.query(`
        CREATE TYPE delivery_verifications_verification_status_enum AS ENUM ('PENDING', 'OTP_SENT', 'OTP_VERIFIED', 'OTP_FAILED', 'COMPLETED')
      `);
      console.log('  Created delivery_verifications_verification_status_enum');
    }
    console.log('  ✅ Done\n');

    // Step 3: Update delivery_verifications columns to use TypeORM expected enum types
    console.log('Step 3: Updating delivery_verifications columns...');

    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'delivery_verifications'
      )
    `);

    if (tableExists.rows[0].exists) {
      // Get current column info
      const colInfo = await client.query(`
        SELECT column_name, udt_name
        FROM information_schema.columns 
        WHERE table_name = 'delivery_verifications' 
        AND column_name IN ('otp_recipient_type', 'otp_verified_by', 'verification_status')
      `);

      for (const col of colInfo.rows) {
        let expectedType;
        if (col.column_name === 'otp_recipient_type') {
          expectedType = 'delivery_verifications_otp_recipient_type_enum';
        } else if (col.column_name === 'otp_verified_by') {
          expectedType = 'delivery_verifications_otp_verified_by_enum';
        } else if (col.column_name === 'verification_status') {
          expectedType = 'delivery_verifications_verification_status_enum';
        }

        if (col.udt_name !== expectedType) {
          console.log(`  Converting ${col.column_name} from ${col.udt_name} to ${expectedType}...`);
          
          // Drop default first
          try {
            await client.query(`
              ALTER TABLE delivery_verifications ALTER COLUMN "${col.column_name}" DROP DEFAULT
            `);
          } catch (e) { /* ignore */ }

          // Convert column
          await client.query(`
            ALTER TABLE delivery_verifications 
            ALTER COLUMN "${col.column_name}" 
            TYPE "${expectedType}" 
            USING "${col.column_name}"::text::"${expectedType}"
          `);

          // Set default back if needed
          if (col.column_name === 'otp_recipient_type') {
            await client.query(`
              ALTER TABLE delivery_verifications 
              ALTER COLUMN otp_recipient_type SET DEFAULT 'MERCHANT'
            `);
          } else if (col.column_name === 'verification_status') {
            await client.query(`
              ALTER TABLE delivery_verifications 
              ALTER COLUMN verification_status SET DEFAULT 'PENDING'
            `);
          }
          
          console.log(`    ✅ Converted`);
        } else {
          console.log(`  ${col.column_name} already uses correct type`);
        }
      }
    }
    console.log('  ✅ Done\n');

    // Step 4: Drop old enum types that are no longer needed
    console.log('Step 4: Cleaning up old unused enum types...');
    const unusedEnums = ['otp_recipient_type_enum', 'delivery_verification_status'];
    for (const enumName of unusedEnums) {
      try {
        // Check if any column still uses this enum
        const usages = await client.query(`
          SELECT COUNT(*) as count FROM information_schema.columns 
          WHERE udt_name = $1
        `, [enumName]);
        
        if (parseInt(usages.rows[0].count) === 0) {
          await client.query(`DROP TYPE IF EXISTS "${enumName}" CASCADE`);
          console.log(`  Dropped unused: ${enumName}`);
        } else {
          console.log(`  ${enumName} is still in use, skipping`);
        }
      } catch (e) {
        console.log(`  Could not drop ${enumName}: ${e.message}`);
      }
    }
    console.log('  ✅ Done\n');

    console.log('🎉 All enum fixes complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixAllEnums();

