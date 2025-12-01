import { DataSource } from 'typeorm';
import { CoverageArea } from '../src/coverage-areas/entities/coverage-area.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface CoverageAreaCSVRow {
  division: string;
  city: string;
  city_id: string;
  zone: string;
  zone_id: string;
  area: string;
  area_id: string;
  inside_dhaka_flag: string;
}

async function importCoverageAreas() {
  console.log('🚀 Starting Coverage Areas Import from CSV...\n');

  // CSV file path - place your CSV in the project root
  const csvFilePath = path.join(__dirname, '..', 'finalcsv-area.csv');

  // Check if CSV file exists
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found at: ${csvFilePath}`);
    console.log('\n📝 Please place your CSV file at the project root with name: coverage-areas.csv');
    console.log('📋 CSV Format: division,city,city_id,zone,zone_id,area,area_id,inside_dhaka_flag');
    process.exit(1);
  }

  // Create database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password',
    database: process.env.PG_DB || 'courier_db',
    entities: [CoverageArea],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('✅ Database connected\n');

  const coverageAreaRepository = dataSource.getRepository(CoverageArea);

  try {
    // Read CSV file
    console.log('📖 Reading CSV file...');
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n').filter((line) => line.trim() !== '');

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse header
    const header = lines[0].split(',').map((h) => h.trim());
    console.log(`📋 CSV Headers: ${header.join(', ')}`);

    // Validate header
    const requiredHeaders = ['division', 'city', 'city_id', 'zone', 'zone_id', 'area', 'area_id', 'inside_dhaka_flag'];
    const missingHeaders = requiredHeaders.filter((h) => !header.includes(h));

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    console.log(`✅ CSV validation passed\n`);

    // Clear existing data (use DELETE to handle foreign key constraints)
    console.log('🗑️  Clearing existing coverage areas...');
    
    // First, set delivery_coverage_area_id to NULL in parcels
    await dataSource.query(`UPDATE parcels SET delivery_coverage_area_id = NULL`);
    console.log('   ✓ Cleared parcel references');
    
    // Now delete all coverage areas
    await dataSource.query(`DELETE FROM coverage_areas`);
    console.log('✅ Existing data cleared\n');

    // Parse and import data
    console.log('📥 Importing coverage areas...\n');
    const coverageAreas: CoverageArea[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line);
        const row: any = {};

        header.forEach((key, index) => {
          row[key] = values[index] || '';
        });

        // Create coverage area entity
        const coverageArea = new CoverageArea();
        coverageArea.division = row.division.trim();
        coverageArea.city = row.city.trim();
        coverageArea.city_id = parseInt(row.city_id);
        coverageArea.zone = row.zone.trim();
        coverageArea.zone_id = parseInt(row.zone_id);
        coverageArea.area = row.area.trim();
        coverageArea.area_id = parseInt(row.area_id);
        coverageArea.inside_dhaka_flag = row.inside_dhaka_flag.toLowerCase() === 'true' || row.inside_dhaka_flag === '1';

        // Validate required fields
        if (!coverageArea.division || !coverageArea.city || !coverageArea.zone || !coverageArea.area) {
          throw new Error(`Missing required fields in row ${i + 1}`);
        }

        if (isNaN(coverageArea.city_id) || isNaN(coverageArea.zone_id) || isNaN(coverageArea.area_id)) {
          throw new Error(`Invalid ID values in row ${i + 1}`);
        }

        coverageAreas.push(coverageArea);
        successCount++;

        // Log progress every 1000 rows
        if (successCount % 1000 === 0) {
          console.log(`   ✓ Processed ${successCount} rows...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   ✗ Error in row ${i + 1}: ${error.message}`);
      }
    }

    console.log(`\n📊 Parsing Summary:`);
    console.log(`   - Total rows: ${lines.length - 1}`);
    console.log(`   - Successful: ${successCount}`);
    console.log(`   - Errors: ${errorCount}\n`);

    // Batch insert for better performance
    console.log('💾 Saving to database...');
    const batchSize = 500;
    let savedCount = 0;

    for (let i = 0; i < coverageAreas.length; i += batchSize) {
      const batch = coverageAreas.slice(i, i + batchSize);
      await coverageAreaRepository.save(batch);
      savedCount += batch.length;
      console.log(`   ✓ Saved ${savedCount}/${coverageAreas.length} coverage areas...`);
    }

    console.log(`\n✅ Import Complete!`);
    console.log(`📊 Final Summary:`);
    console.log(`   - Total imported: ${savedCount}`);
    console.log(`   - Divisions: ${new Set(coverageAreas.map((c) => c.division)).size}`);
    console.log(`   - Cities: ${new Set(coverageAreas.map((c) => c.city)).size}`);
    console.log(`   - Zones: ${new Set(coverageAreas.map((c) => c.zone)).size}`);
    console.log(`   - Areas: ${coverageAreas.length}`);
    console.log(`   - Inside Dhaka: ${coverageAreas.filter((c) => c.inside_dhaka_flag).length}`);
    console.log(`   - Outside Dhaka: ${coverageAreas.filter((c) => !c.inside_dhaka_flag).length}\n`);

    // Show sample data
    console.log('📋 Sample Data (first 5 rows):');
    coverageAreas.slice(0, 5).forEach((ca, index) => {
      console.log(`   ${index + 1}. ${ca.division} > ${ca.city} (${ca.city_id}) > ${ca.zone} (${ca.zone_id}) > ${ca.area} (${ca.area_id})`);
    });
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    throw error;
  } finally {
    await dataSource.destroy();
    console.log('\n✅ Database connection closed');
  }
}

// Helper function to parse CSV line (handles quoted values)
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

// Run the import
importCoverageAreas()
  .then(() => {
    console.log('✨ Import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Import failed:', error);
    process.exit(1);
  });
