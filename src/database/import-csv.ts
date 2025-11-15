import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import AppDataSource from '../data-source';

/**
 * CSV Import Utility
 * 
 * Usage:
 * 1. Place your CSV files in the 'data' folder
 * 2. Run: ts-node -r tsconfig-paths/register src/database/import-csv.ts
 * 
 * CSV Format Examples:
 * 
 * users.csv:
 * full_name,phone,email,password_hash,role,is_active
 * John Doe,+8801712345678,john@example.com,$2b$10$...,MERCHANT,true
 * 
 * merchants.csv:
 * user_id,thana,district,full_address,secondary_number,status
 * uuid-here,Gulshan,Dhaka,House 123,+8801812345678,APPROVED
 * 
 * stores.csv:
 * merchant_id,business_name,business_address,phone_number,email,facebook_page,is_default
 * uuid-here,Main Store,123 Dhaka Street,01712345678,store@example.com,fb.com/store,true
 */

interface ImportConfig {
  tableName: string;
  csvFileName: string;
  columnMapping?: Record<string, string>; // CSV column -> DB column mapping
}

async function importCSV(config: ImportConfig, dataSource: DataSource) {
  const { tableName, csvFileName, columnMapping } = config;
  
  try {
    const csvPath = path.join(__dirname, '../../data', csvFileName);
    
    if (!fs.existsSync(csvPath)) {
      console.log(`⚠️  File not found: ${csvPath}`);
      return;
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Simple CSV parsing (assuming comma-separated, with header row)
    const lines = fileContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const records = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const record: any = {};
      headers.forEach((header, index) => {
        record[header] = values[index];
      });
      return record;
    });

    console.log(`📊 Found ${records.length} records in ${csvFileName}`);

    if (records.length === 0) {
      console.log('⚠️  No records to import');
      return;
    }

    // Transform records if column mapping is provided
    const transformedRecords = records.map((record: any) => {
      if (columnMapping) {
        const transformed: any = {};
        for (const [csvCol, dbCol] of Object.entries(columnMapping)) {
          if (record[csvCol] !== undefined) {
            transformed[dbCol] = record[csvCol];
          }
        }
        return transformed;
      }
      return record;
    });

    // Get column names from first record
    const columns = Object.keys(transformedRecords[0]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnList = columns.join(', ');

    let successCount = 0;
    let errorCount = 0;

    for (const record of transformedRecords) {
      try {
        const values = columns.map(col => {
          let value = record[col];
          
          // Handle boolean values
          if (value === 'true' || value === 'TRUE') return true;
          if (value === 'false' || value === 'FALSE') return false;
          
          // Handle null/empty values
          if (value === '' || value === 'NULL' || value === 'null') return null;
          
          return value;
        });

        await dataSource.query(
          `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`,
          values
        );
        successCount++;
      } catch (error: any) {
        errorCount++;
        console.error(`❌ Error importing record:`, record);
        console.error(`   Error: ${error.message}`);
      }
    }

    console.log(`✅ Successfully imported ${successCount} records into ${tableName}`);
    if (errorCount > 0) {
      console.log(`❌ Failed to import ${errorCount} records`);
    }
  } catch (error: any) {
    console.error(`❌ Error importing ${csvFileName}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting CSV import...\n');

  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected\n');

    // Define your imports here
    const imports: ImportConfig[] = [
      // Example: Import users
      // {
      //   tableName: 'users',
      //   csvFileName: 'users.csv',
      // },
      
      // Example: Import merchants
      // {
      //   tableName: 'merchants',
      //   csvFileName: 'merchants.csv',
      // },
      
      // Example: Import stores
      // {
      //   tableName: 'stores',
      //   csvFileName: 'stores.csv',
      // },
      
      // Example: Import hubs
      // {
      //   tableName: 'hubs',
      //   csvFileName: 'hubs.csv',
      // },
      
      // Example: Import riders
      // {
      //   tableName: 'riders',
      //   csvFileName: 'riders.csv',
      // },
    ];

    // Run imports sequentially
    for (const config of imports) {
      await importCSV(config, AppDataSource);
      console.log('');
    }

    console.log('✅ CSV import completed!');
  } catch (error: any) {
    console.error('❌ Import failed:', error.message);
  } finally {
    await AppDataSource.destroy();
  }
}

main();
