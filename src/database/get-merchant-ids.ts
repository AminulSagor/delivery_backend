import AppDataSource from '../data-source';

/**
 * Helper script to get merchant IDs for CSV imports
 * 
 * Run: ts-node -r tsconfig-paths/register src/database/get-merchant-ids.ts
 */

async function getMerchantIds() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected\n');

    const merchants = await AppDataSource.query(`
      SELECT 
        m.id as merchant_id,
        m.user_id,
        u.full_name,
        u.phone,
        u.email,
        m.status
      FROM merchants m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at DESC
    `);

    console.log('📋 Merchant IDs:\n');
    console.log('merchant_id,user_id,full_name,phone,email,status');
    console.log('─'.repeat(120));
    
    merchants.forEach((m: any) => {
      console.log(`${m.merchant_id},${m.user_id},${m.full_name},${m.phone},${m.email || 'N/A'},${m.status}`);
    });

    console.log('\n💡 Copy the merchant_id from above and use it in your stores.csv file\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await AppDataSource.destroy();
  }
}

getMerchantIds();
