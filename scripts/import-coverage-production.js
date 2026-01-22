/**
 * Production CSV Import for Coverage Areas and Carrybee Locations
 * Runs automatically during Railway deployment
 */

const { DataSource } = require('typeorm');
const fs = require('fs');
const path = require('path');

async function importCsvData() {
  console.log('');
  console.log('========================================');
  console.log('📥 CSV Data Inflation (Coverage + Carrybee)');
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
    console.error('❌ DATABASE_URL not set, cannot import data');
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

    // Check if tables exist
    const tablesCheck = await dataSource.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('coverage_areas', 'carrybee_locations')
    `);

    const existingTables = tablesCheck.map(t => t.table_name);
    if (!existingTables.includes('coverage_areas') || !existingTables.includes('carrybee_locations')) {
      console.log('⚠️  Required tables do not exist yet');
      console.log('⏭️  Skipping CSV import');
      console.log('');
      return false;
    }

    // Check if coverage_areas already has data
    const coverageCount = await dataSource.query(`SELECT COUNT(*) as count FROM coverage_areas`);
    const currentCoverageCount = parseInt(coverageCount[0].count);
    
    // Check if carrybee_locations already has data
    const carrybeeCount = await dataSource.query(`SELECT COUNT(*) as count FROM carrybee_locations`);
    const currentCarrybeeCount = parseInt(carrybeeCount[0].count);

    if (currentCoverageCount > 0 && currentCarrybeeCount > 0) {
      console.log(`✅ Data already exists:`);
      console.log(`   - Coverage Areas: ${currentCoverageCount} records`);
      console.log(`   - Carrybee Locations: ${currentCarrybeeCount} records`);
      console.log('⏭️  Skipping import to preserve existing data');
      console.log('');
      return true;
    }

    console.log('📖 Reading CSV file...');
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n').filter((line) => line.trim() !== '');

    console.log(`📋 Total lines in CSV: ${lines.length}`);
    console.log('');

    const cities = new Map(); // id -> name
    const zones = new Map(); // id -> { name, parent_id }
    const areas = new Map(); // id -> { name, parent_id, city_id }
    const coverageData = [];

    // Parse data
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

        if (!city_id || !zone_id || !area_id) continue;

        // Collect unique locations
        cities.set(city_id, city);
        zones.set(zone_id, { name: zone, parent_id: city_id });
        areas.set(area_id, { name: area, parent_id: zone_id, city_id: city_id });

        // Collect coverage data
        coverageData.push([division, city, city_id, zone, zone_id, area, area_id, inside_dhaka_flag]);

      } catch (e) {
        // Skip malformed lines
      }
    }

    // 1. Inflate Carrybee Locations
    if (currentCarrybeeCount === 0) {
      console.log('🚀 Inflating carrybee_locations...');
      
      // Insert Cities
      const cityValues = Array.from(cities.entries()).map(([id, name]) => [id, name, 'CITY', null, id]);
      if (cityValues.length > 0) {
        await insertCarrybeeBatch(dataSource, cityValues);
        console.log(`   ✓ Inserted ${cityValues.length} cities`);
      }

      // Insert Zones
      const zoneValues = Array.from(zones.entries()).map(([id, info]) => [id, info.name, 'ZONE', info.parent_id, info.parent_id]);
      if (zoneValues.length > 0) {
        await insertCarrybeeBatch(dataSource, zoneValues);
        console.log(`   ✓ Inserted ${zoneValues.length} zones`);
      }

      // Insert Areas
      const areaValues = Array.from(areas.entries()).map(([id, info]) => [id, info.name, 'AREA', info.parent_id, info.city_id]);
      if (areaValues.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < areaValues.length; i += batchSize) {
          const batch = areaValues.slice(i, i + batchSize);
          await insertCarrybeeBatch(dataSource, batch);
        }
        console.log(`   ✓ Inserted ${areaValues.length} areas`);
      }
    }

    // 2. Inflate Coverage Areas
    if (currentCoverageCount === 0) {
      console.log('🚀 Inflating coverage_areas...');
      const batchSize = 500;
      for (let i = 0; i < coverageData.length; i += batchSize) {
        const batch = coverageData.slice(i, i + batchSize);
        await insertCoverageBatch(dataSource, batch);
        if (i % 5000 === 0 && i > 0) {
          console.log(`   ✓ Processed ${i} coverage rows...`);
        }
      }
      console.log(`   ✓ Inserted ${coverageData.length} total coverage areas`);
    }

    console.log('');
    console.log('✅ CSV Inflation Complete!');
    return true;

  } catch (error) {
    console.error('❌ CSV Import Error:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

async function insertCarrybeeBatch(dataSource, values) {
  const placeholders = values.map((_, i) => {
    const base = i * 5;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  }).join(', ');

  const flatValues = values.flat();

  await dataSource.query(
    `INSERT INTO carrybee_locations (carrybee_id, name, type, parent_id, city_id) 
     VALUES ${placeholders}
     ON CONFLICT DO NOTHING`,
    flatValues
  );
}

async function insertCoverageBatch(dataSource, values) {
  const placeholders = values.map((_, i) => {
    const base = i * 8;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  }).join(', ');

  const flatValues = values.flat();

  await dataSource.query(
    `INSERT INTO coverage_areas (division, city, city_id, zone, zone_id, area, area_id, inside_dhaka_flag) 
     VALUES ${placeholders}
     ON CONFLICT DO NOTHING`,
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

module.exports = { importCoverageAreas: importCsvData };

// Allow running standalone
if (require.main === module) {
  importCsvData()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}
