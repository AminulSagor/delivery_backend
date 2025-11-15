import AppDataSource from '../data-source';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Import Coverage Areas from CSV
 * 
 * Run: npm run build && ts-node -r tsconfig-paths/register src/database/import-coverage-areas.ts
 */

async function importCoverageAreas() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected\n');

    const csvPath = path.join(__dirname, '../../data/data.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.log(`❌ File not found: ${csvPath}`);
      return;
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    console.log(`📊 Total lines in CSV: ${lines.length}\n`);

    // Skip first 2 rows (header rows)
    const dataLines = lines.slice(2);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      
      // Split by comma but handle quoted values
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      // Skip if the area column (index 3 or D column) is empty
      const area = values[3] || values[8]; // Check both possible positions
      
      if (!area || area === '') {
        skippedCount++;
        continue;
      }

      try {
        // Map the CSV columns to database columns
        const division = values[0] || values[5] || null;
        const district = values[1] || values[6] || null;
        const zone = values[2] || values[7] || null;
        const coverage = values[4] || values[9] || null;
        const deliveryType = values[5] || values[10] || null;
        const pickup = values[6] || values[11] || null;
        const insideDhakaFlag = (values[7] || values[12] || '').toUpperCase() === 'TRUE';

        await AppDataSource.query(
          `INSERT INTO coverage_areas 
           (division, district, zone, area, coverage, delivery_type, pickup, inside_dhaka_flag) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [division, district, zone, area, coverage, deliveryType, pickup, insideDhakaFlag]
        );
        
        successCount++;
        
        if (successCount % 100 === 0) {
          console.log(`✅ Imported ${successCount} records...`);
        }
      } catch (error: any) {
        errorCount++;
        console.error(`❌ Error on line ${i + 3}:`, error.message);
        if (errorCount <= 5) {
          console.error(`   Data:`, values.slice(0, 8));
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Successfully imported: ${successCount} records`);
    console.log(`⏭️  Skipped (empty): ${skippedCount} records`);
    if (errorCount > 0) {
      console.log(`❌ Failed: ${errorCount} records`);
    }
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Import failed:', error.message);
  } finally {
    await AppDataSource.destroy();
  }
}

importCoverageAreas();
