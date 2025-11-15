import AppDataSource from '../data-source';

/**
 * Verify Coverage Areas Import
 * 
 * Run: ts-node -r tsconfig-paths/register src/database/verify-coverage-areas.ts
 */

async function verifyCoverageAreas() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected\n');

    // Get total count
    const totalCount = await AppDataSource.query(
      `SELECT COUNT(*) as count FROM coverage_areas`
    );
    console.log(`📊 Total Coverage Areas: ${totalCount[0].count}\n`);

    // Get count by division
    const byDivision = await AppDataSource.query(`
      SELECT division, COUNT(*) as count
      FROM coverage_areas
      WHERE division IS NOT NULL AND division != ''
      GROUP BY division
      ORDER BY count DESC
    `);

    console.log('📍 Coverage Areas by Division:');
    console.log('─'.repeat(50));
    byDivision.forEach((row: any) => {
      console.log(`${row.division.padEnd(30)} ${row.count.toString().padStart(6)} areas`);
    });

    // Get some sample data
    console.log('\n📋 Sample Data (First 5 records):');
    console.log('─'.repeat(100));
    const samples = await AppDataSource.query(`
      SELECT division, district, zone, area, delivery_type, inside_dhaka_flag
      FROM coverage_areas
      LIMIT 5
    `);

    samples.forEach((row: any, index: number) => {
      console.log(`${index + 1}. ${row.division} > ${row.district} > ${row.zone} > ${row.area}`);
      console.log(`   Delivery: ${row.delivery_type} | Inside Dhaka: ${row.inside_dhaka_flag}`);
    });

    // Check for Dhaka areas
    const dhakaCount = await AppDataSource.query(`
      SELECT COUNT(*) as count 
      FROM coverage_areas 
      WHERE inside_dhaka_flag = true
    `);
    console.log(`\n🏙️  Inside Dhaka Areas: ${dhakaCount[0].count}`);

    // Check delivery types
    const deliveryTypes = await AppDataSource.query(`
      SELECT delivery_type, COUNT(*) as count
      FROM coverage_areas
      WHERE delivery_type IS NOT NULL
      GROUP BY delivery_type
      ORDER BY count DESC
    `);

    console.log('\n📦 Delivery Types:');
    console.log('─'.repeat(50));
    deliveryTypes.forEach((row: any) => {
      console.log(`${row.delivery_type.padEnd(30)} ${row.count.toString().padStart(6)} areas`);
    });

    console.log('\n✅ Verification complete!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await AppDataSource.destroy();
  }
}

verifyCoverageAreas();
