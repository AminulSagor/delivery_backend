/**
 * Fix script to clean up enum type issues
 * Handles leftover _old enum types from failed TypeORM synchronizations
 * 
 * Usage: node scripts/fix-enum-types.js
 */

require('dotenv').config();
const { Client } = require('pg');

async function fixEnumTypes() {
  console.log('🔧 Fixing enum types...\n');

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

    // Find all _old enum types
    const oldEnums = await client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname LIKE '%_old'
      AND typtype = 'e';
    `);

    console.log(`Found ${oldEnums.rows.length} old enum types to clean up\n`);

    for (const row of oldEnums.rows) {
      const oldEnumName = row.typname;
      const newEnumName = oldEnumName.replace('_old', '');
      
      console.log(`Processing: ${oldEnumName}`);

      // Find columns using the old enum
      const dependentColumns = await client.query(`
        SELECT 
          c.table_name,
          c.column_name,
          c.udt_name
        FROM information_schema.columns c
        WHERE c.udt_name = $1
        AND c.table_schema = 'public';
      `, [oldEnumName]);

      if (dependentColumns.rows.length > 0) {
        console.log(`  Found ${dependentColumns.rows.length} columns using old enum:`);
        
        for (const col of dependentColumns.rows) {
          console.log(`    - ${col.table_name}.${col.column_name}`);
          
          // Check if new enum exists
          const newEnumExists = await client.query(`
            SELECT EXISTS (
              SELECT 1 FROM pg_type WHERE typname = $1
            );
          `, [newEnumName]);

          if (newEnumExists.rows[0].exists) {
            // Convert column to use new enum
            console.log(`    Converting to use ${newEnumName}...`);
            
            // First drop default if exists
            try {
              await client.query(`
                ALTER TABLE "${col.table_name}" 
                ALTER COLUMN "${col.column_name}" DROP DEFAULT;
              `);
            } catch (e) {
              // Ignore if no default
            }

            // Convert column type
            await client.query(`
              ALTER TABLE "${col.table_name}" 
              ALTER COLUMN "${col.column_name}" 
              TYPE "${newEnumName}" 
              USING "${col.column_name}"::text::"${newEnumName}";
            `);
            
            console.log(`    ✅ Converted`);
          } else {
            // Rename old enum to be the new one
            console.log(`    New enum doesn't exist, renaming ${oldEnumName} to ${newEnumName}...`);
            await client.query(`ALTER TYPE "${oldEnumName}" RENAME TO "${newEnumName}";`);
            console.log(`    ✅ Renamed`);
            continue; // Skip the drop since we renamed it
          }
        }
      }

      // Now drop the old enum
      try {
        await client.query(`DROP TYPE IF EXISTS "${oldEnumName}" CASCADE;`);
        console.log(`  ✅ Dropped ${oldEnumName}\n`);
      } catch (e) {
        console.log(`  ⚠️  Could not drop ${oldEnumName}: ${e.message}\n`);
      }
    }

    // Also fix any enum naming inconsistencies between entity and database
    console.log('Checking for enum naming inconsistencies...\n');

    // Check delivery_verifications enums
    const dvEnums = [
      { column: 'otp_recipient_type', expectedEnum: 'delivery_verifications_otp_recipient_type_enum' },
      { column: 'otp_verified_by', expectedEnum: 'delivery_verifications_otp_verified_by_enum' },
      { column: 'verification_status', expectedEnum: 'delivery_verifications_verification_status_enum' },
    ];

    for (const { column, expectedEnum } of dvEnums) {
      const colInfo = await client.query(`
        SELECT udt_name
        FROM information_schema.columns 
        WHERE table_name = 'delivery_verifications' 
        AND column_name = $1;
      `, [column]);

      if (colInfo.rows.length > 0) {
        const currentEnum = colInfo.rows[0].udt_name;
        console.log(`  ${column}: using ${currentEnum}`);
        
        // Check if the current enum has _old suffix or other issues
        if (currentEnum.endsWith('_old')) {
          const baseEnum = currentEnum.replace('_old', '');
          
          // Check if base enum exists
          const baseExists = await client.query(`
            SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = $1);
          `, [baseEnum]);

          if (baseExists.rows[0].exists) {
            console.log(`    Converting from ${currentEnum} to ${baseEnum}...`);
            try {
              await client.query(`
                ALTER TABLE delivery_verifications 
                ALTER COLUMN "${column}" DROP DEFAULT;
              `);
            } catch (e) { /* ignore */ }

            await client.query(`
              ALTER TABLE delivery_verifications 
              ALTER COLUMN "${column}" 
              TYPE "${baseEnum}" 
              USING "${column}"::text::"${baseEnum}";
            `);
            console.log(`    ✅ Converted`);
          }
        }
      }
    }

    console.log('\n🎉 Enum fixes complete! You can now start the application.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixEnumTypes();

