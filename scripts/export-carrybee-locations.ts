import { DataSource } from 'typeorm';
import { CarrybeeLocation } from '../src/carrybee-locations/entities/carrybee-location.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

enum LocationType {
  CITY = 'CITY',
  ZONE = 'ZONE',
  AREA = 'AREA',
}

interface LocationData {
  city: string;
  cityId: number;
  zone: string;
  zoneId: number;
  area: string;
  areaId: number;
}

async function exportCarrybeeLocations() {
  console.log('🚀 Starting Carrybee Locations Export...\n');

  // Create database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password',
    database: process.env.PG_DB || 'courier_db',
    entities: [CarrybeeLocation],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('✅ Database connected\n');

  const locationRepository = dataSource.getRepository(CarrybeeLocation);

  try {
    // Fetch all cities
    const cities = await locationRepository.find({
      where: { type: LocationType.CITY, is_active: true },
      order: { name: 'ASC' },
    });

    console.log(`📍 Found ${cities.length} cities\n`);

    const allLocations: LocationData[] = [];
    let totalZones = 0;
    let totalAreas = 0;

    // Iterate through each city
    for (const city of cities) {
      console.log(`Processing: ${city.name} (ID: ${city.carrybee_id})`);

      // Fetch zones for this city
      const zones = await locationRepository.find({
        where: { type: LocationType.ZONE, parent_id: city.carrybee_id, is_active: true },
        order: { name: 'ASC' },
      });
      totalZones += zones.length;

      console.log(`  ├─ Zones: ${zones.length}`);

      // Iterate through each zone
      for (const zone of zones) {
        // Fetch areas for this zone
        const areas = await locationRepository.find({
          where: { type: LocationType.AREA, parent_id: zone.carrybee_id, is_active: true },
          order: { name: 'ASC' },
        });
        totalAreas += areas.length;

        console.log(`  │  ├─ ${zone.name} (ID: ${zone.carrybee_id}) - ${areas.length} areas`);

        // Add each area to the list
        for (const area of areas) {
          allLocations.push({
            city: city.name,
            cityId: city.carrybee_id,
            zone: zone.name,
            zoneId: zone.carrybee_id,
            area: area.name,
            areaId: area.carrybee_id,
          });
        }
      }

      console.log('');
    }

    console.log(`\n✅ Export Complete!`);
    console.log(`📊 Summary:`);
    console.log(`   - Cities: ${cities.length}`);
    console.log(`   - Zones: ${totalZones}`);
    console.log(`   - Areas: ${totalAreas}`);
    console.log(`   - Total Records: ${allLocations.length}\n`);

    // Generate outputs
    await generateCSV(allLocations);
    await generateMarkdownTable(allLocations);
    await generateJSON(allLocations);
    await generateHTMLTable(allLocations);

    console.log('\n🎉 All files generated successfully!\n');
    console.log('📁 Output files:');
    console.log('   - carrybee-locations.csv (Import to Google Sheets)');
    console.log('   - carrybee-locations.md (Markdown table)');
    console.log('   - carrybee-locations.json (JSON format)');
    console.log('   - carrybee-locations.html (HTML table for Google Docs)\n');

  } catch (error) {
    console.error('❌ Error exporting locations:', error.message);
    throw error;
  } finally {
    await dataSource.destroy();
    console.log('\n✅ Database connection closed');
  }
}

async function generateCSV(locations: LocationData[]) {
  const outputPath = path.join(__dirname, '..', 'carrybee-locations.csv');

  // CSV Header
  let csvContent = 'City,City ID,Zone,Zone ID,Area,Area ID\n';

  // CSV Rows
  for (const loc of locations) {
    csvContent += `"${loc.city}",${loc.cityId},"${loc.zone}",${loc.zoneId},"${loc.area}",${loc.areaId}\n`;
  }

  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  console.log(`✅ CSV exported: ${outputPath}`);
}

async function generateMarkdownTable(locations: LocationData[]) {
  const outputPath = path.join(__dirname, '..', 'carrybee-locations.md');

  let mdContent = '# Carrybee Locations\n\n';
  mdContent += `**Total Records:** ${locations.length}\n\n`;
  mdContent += '| City | City ID | Zone | Zone ID | Area | Area ID |\n';
  mdContent += '|------|---------|------|---------|------|----------|\n';

  for (const loc of locations) {
    mdContent += `| ${loc.city} | ${loc.cityId} | ${loc.zone} | ${loc.zoneId} | ${loc.area} | ${loc.areaId} |\n`;
  }

  fs.writeFileSync(outputPath, mdContent, 'utf-8');
  console.log(`✅ Markdown exported: ${outputPath}`);
}

async function generateJSON(locations: LocationData[]) {
  const outputPath = path.join(__dirname, '..', 'carrybee-locations.json');

  const jsonContent = JSON.stringify(locations, null, 2);

  fs.writeFileSync(outputPath, jsonContent, 'utf-8');
  console.log(`✅ JSON exported: ${outputPath}`);
}

async function generateHTMLTable(locations: LocationData[]) {
  const outputPath = path.join(__dirname, '..', 'carrybee-locations.html');

  let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Carrybee Locations</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
    }
    h1 {
      color: #333;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #4CAF50;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f2f2f2;
    }
    tr:hover {
      background-color: #ddd;
    }
    .summary {
      background-color: #e7f3fe;
      padding: 15px;
      border-left: 4px solid #2196F3;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <h1>🌍 Carrybee Locations Database</h1>
  
  <div class="summary">
    <strong>Total Records:</strong> ${locations.length}<br>
    <strong>Generated:</strong> ${new Date().toLocaleString()}
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>City</th>
        <th>City ID</th>
        <th>Zone</th>
        <th>Zone ID</th>
        <th>Area</th>
        <th>Area ID</th>
      </tr>
    </thead>
    <tbody>
`;

  locations.forEach((loc, index) => {
    htmlContent += `      <tr>
        <td>${index + 1}</td>
        <td>${loc.city}</td>
        <td>${loc.cityId}</td>
        <td>${loc.zone}</td>
        <td>${loc.zoneId}</td>
        <td>${loc.area}</td>
        <td>${loc.areaId}</td>
      </tr>
`;
  });

  htmlContent += `    </tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(outputPath, htmlContent, 'utf-8');
  console.log(`✅ HTML exported: ${outputPath}`);
}

// Run the export
exportCarrybeeLocations()
  .then(() => {
    console.log('✨ Export completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Export failed:', error);
    process.exit(1);
  });
