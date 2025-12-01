import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function migrateAndImport() {
  console.log('🚀 Starting Coverage Areas Migration & Import...\n');

  // CSV file path
  const csvFilePath = path.join(__dirname, '..', 'finalcsv-area.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found at: ${csvFilePath}`);
    process.exit(1);
  }

  // Create database connection (without entities to avoid conflicts)
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password',
    database: process.env.PG_DB || 'courier_db',
    synchronize: false,
    logging: true,
  });

  await dataSource.initialize();
  console.log('✅ Database connected\n');

  try {
    // Step 1: Clear parcel references
    console.log('🗑️  Step 1: Clearing parcel references...');
    await dataSource.query(`UPDATE parcels SET delivery_coverage_area_id = NULL`);
    console.log('   ✓ Parcel references cleared\n');

    // Step 2: Delete existing coverage areas
    console.log('🗑️  Step 2: Deleting existing coverage areas...');
    await dataSource.query(`DELETE FROM coverage_areas`);
    console.log('   ✓ Coverage areas deleted\n');

    // Step 3: Check current table structure
    console.log('🔍 Step 3: Checking table structure...');
    const columns = await dataSource.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'coverage_areas' AND table_schema = 'public'
    `);
    const columnNames = columns.map((c: any) => c.column_name);
    console.log(`   Current columns: ${columnNames.join(', ')}\n`);

    // Step 4: Migrate table structure if needed
    console.log('🔧 Step 4: Migrating table structure...');
    
    // Check if city column exists
    if (!columnNames.includes('city')) {
      // Add city column
      await dataSource.query(`ALTER TABLE coverage_areas ADD COLUMN IF NOT EXISTS city VARCHAR(100)`);
      console.log('   ✓ Added city column');
    }

    // Check if city_id column exists
    if (!columnNames.includes('city_id')) {
      await dataSource.query(`ALTER TABLE coverage_areas ADD COLUMN IF NOT EXISTS city_id INTEGER`);
      console.log('   ✓ Added city_id column');
    }

    // Check if zone_id column exists
    if (!columnNames.includes('zone_id')) {
      await dataSource.query(`ALTER TABLE coverage_areas ADD COLUMN IF NOT EXISTS zone_id INTEGER`);
      console.log('   ✓ Added zone_id column');
    }

    // Check if area_id column exists
    if (!columnNames.includes('area_id')) {
      await dataSource.query(`ALTER TABLE coverage_areas ADD COLUMN IF NOT EXISTS area_id INTEGER`);
      console.log('   ✓ Added area_id column');
    }

    // Check if inside_dhaka_flag exists
    if (!columnNames.includes('inside_dhaka_flag')) {
      await dataSource.query(`ALTER TABLE coverage_areas ADD COLUMN IF NOT EXISTS inside_dhaka_flag BOOLEAN DEFAULT FALSE`);
      console.log('   ✓ Added inside_dhaka_flag column');
    }

    // Drop old columns if they exist
    if (columnNames.includes('district')) {
      await dataSource.query(`ALTER TABLE coverage_areas DROP COLUMN IF EXISTS district`);
      console.log('   ✓ Dropped district column');
    }
    if (columnNames.includes('coverage')) {
      await dataSource.query(`ALTER TABLE coverage_areas DROP COLUMN IF EXISTS coverage`);
      console.log('   ✓ Dropped coverage column');
    }
    if (columnNames.includes('delivery_type')) {
      await dataSource.query(`ALTER TABLE coverage_areas DROP COLUMN IF EXISTS delivery_type`);
      console.log('   ✓ Dropped delivery_type column');
    }
    if (columnNames.includes('pickup')) {
      await dataSource.query(`ALTER TABLE coverage_areas DROP COLUMN IF EXISTS pickup`);
      console.log('   ✓ Dropped pickup column');
    }

    console.log('   ✓ Table migration complete\n');

    // Step 5: Create indexes if not exist
    console.log('🔧 Step 5: Creating indexes...');
    try {
      await dataSource.query(`CREATE INDEX IF NOT EXISTS "IDX_coverage_areas_city_id" ON coverage_areas (city_id)`);
      await dataSource.query(`CREATE INDEX IF NOT EXISTS "IDX_coverage_areas_zone_id" ON coverage_areas (zone_id)`);
      await dataSource.query(`CREATE INDEX IF NOT EXISTS "IDX_coverage_areas_area_id" ON coverage_areas (area_id)`);
      console.log('   ✓ Indexes created\n');
    } catch (e) {
      console.log('   ✓ Indexes already exist\n');
    }

    // Step 6: Import CSV data
    console.log('📥 Step 6: Importing CSV data...\n');
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n').filter((line) => line.trim() !== '');

    console.log(`   📋 Total lines in CSV: ${lines.length}`);

    // Parse header
    const header = lines[0].split(',').map((h) => h.trim());
    console.log(`   📋 Headers: ${header.slice(0, 8).join(', ')}`);

    // Parse and insert data
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 500;
    let values: any[][] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const cols = parseCSVLine(line);
        
        const division = cols[0]?.trim() || '';
        const city = cols[1]?.trim() || '';
        const city_id = parseInt(cols[2]) || 0;
        const zone = cols[3]?.trim() || '';
        const zone_id = parseInt(cols[4]) || 0;
        const area = cols[5]?.trim() || '';
        const area_id = parseInt(cols[6]) || 0;
        const inside_dhaka_flag = cols[7]?.trim().toUpperCase() === 'TRUE' || cols[7]?.trim() === '1';

        if (!division || !city || !zone || !area) {
          throw new Error('Missing required fields');
        }

        values.push([division, city, city_id, zone, zone_id, area, area_id, inside_dhaka_flag]);
        successCount++;

        // Batch insert every 500 rows
        if (values.length >= batchSize) {
          await insertBatch(dataSource, values);
          console.log(`   ✓ Inserted ${successCount} rows...`);
          values = [];
        }
      } catch (error) {
        errorCount++;
        if (errorCount <= 5) {
          console.error(`   ✗ Error in row ${i}: ${error.message}`);
        }
      }
    }

    // Insert remaining rows
    if (values.length > 0) {
      await insertBatch(dataSource, values);
      console.log(`   ✓ Inserted ${successCount} rows...`);
    }

    console.log(`\n✅ Import Complete!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total rows: ${lines.length - 1}`);
    console.log(`   - Successful: ${successCount}`);
    console.log(`   - Errors: ${errorCount}`);

    // Verify
    const count = await dataSource.query(`SELECT COUNT(*) as count FROM coverage_areas`);
    console.log(`   - In database: ${count[0].count}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await dataSource.destroy();
    console.log('✅ Database connection closed');
  }
}

async function insertBatch(dataSource: DataSource, values: any[][]) {
  const placeholders = values.map((_, i) => {
    const base = i * 8;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  }).join(', ');

  const flatValues = values.flat();

  await dataSource.query(
    `INSERT INTO coverage_areas (division, city, city_id, zone, zone_id, area, area_id, inside_dhaka_flag) VALUES ${placeholders}`,
    flatValues
  );
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

migrateAndImport()
  .then(() => {
    console.log('✨ Migration & Import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
