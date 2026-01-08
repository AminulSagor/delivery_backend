/**
 * Production CSV Import for Coverage Areas
 * Runs automatically during Railway deployment
 */

const { DataSource } = require('typeorm');
const fs = require('fs');
const path = require('path');

async function importCoverageAreas() {
  console.log('');
  console.log('========================================');
  console.log('📥 Coverage Areas CSV Import');
  console.log('========================================');
  console.log('');

  // CSV file path - in production it's at the root
  const csvFilePath = path.join(__dirname, '..', 'finalcsv-area.csv');

  // Check if CSV file exists
  if (!fs.existsSync(csvFilePath)) {
    console.log('⚠️  CSV file not found at:', csvFilePath);
    console.log('⏭️  Skipping CSV import');
    console.log('');
    return false;
  }

  console.log('✅ CSV file found');

  // Get database connection info from environment
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set, cannot import coverage areas');
    return false;
  }

  let dataSource;
  
  try {
    // Parse DATABASE_URL
    const dbUrl = new URL(databaseUrl);
    
    // Create database connection
    dataSource = new DataSource({
      type: 'postgres',
      host: dbUrl.hostname,
      port: parseInt(dbUrl.port || '5432', 10),
      username: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.substring(1),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
    console.log('✅ Database connected');
    console.log('');

    // Check if coverage_areas table exists and has data
    const tableExists = await dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'coverage_areas'
      );
    `);

    if (!tableExists[0].exists) {
      console.log('⚠️  coverage_areas table does not exist yet');
      console.log('⏭️  Skipping CSV import (table will be created by migrations)');
      console.log('');
      return false;
    }

    // Check if table already has data
    const count = await dataSource.query(`SELECT COUNT(*) as count FROM coverage_areas`);
    const currentCount = parseInt(count[0].count);
    
    if (currentCount > 0) {
      console.log(`✅ Coverage areas already populated (${currentCount} records)`);
      console.log('⏭️  Skipping import to preserve existing data');
      console.log('');
      return true;
    }

    console.log('📖 Reading CSV file...');
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n').filter((line) => line.trim() !== '');

    console.log(`📋 Total lines in CSV: ${lines.length}`);

    // Parse header
    const header = lines[0].split(',').map((h) => h.trim());
    console.log('');

    // Parse and insert data
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 500;
    let values = [];

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
    }

    console.log('');
    console.log('✅ CSV Import Complete!');
    console.log(`📊 Summary:`);
    console.log(`   - Total rows processed: ${lines.length - 1}`);
    console.log(`   - Successfully imported: ${successCount}`);
    console.log(`   - Errors: ${errorCount}`);
    
    // Verify final count
    const finalCount = await dataSource.query(`SELECT COUNT(*) as count FROM coverage_areas`);
    console.log(`   - Records in database: ${finalCount[0].count}`);
    console.log('');

    return true;

  } catch (error) {
    console.error('❌ CSV Import Error:', error.message);
    console.error('');
    return false;
  } finally {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

async function insertBatch(dataSource, values) {
  const placeholders = values.map((_, i) => {
    const base = i * 8;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  }).join(', ');

  const flatValues = values.flat();

  await dataSource.query(
    `INSERT INTO coverage_areas (division, city, city_id, zone, zone_id, area, area_id, inside_dhaka_flag) 
     VALUES ${placeholders}`,
    flatValues
  );
}

function parseCSVLine(line) {
  const result = [];
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

module.exports = { importCoverageAreas };

// Allow running standalone
if (require.main === module) {
  importCoverageAreas()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

