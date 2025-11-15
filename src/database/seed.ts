import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_DB || 'postgres',
    entities: ['dist/**/*.entity.js'],
    migrations: ['dist/migrations/*.js'],
  });
  
  await dataSource.initialize();

  // Check if admin already exists
  const existingAdmin = await dataSource.query(
    "SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1"
  );

  if (existingAdmin && existingAdmin.length > 0) {
    console.log('✅ Admin user already exists. Skipping seed.');
    await dataSource.destroy();
    return;
  }

  // Create admin user
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
  const passwordHash = await bcrypt.hash('admin123', saltRounds);

  await dataSource.query(
    `INSERT INTO users (full_name, phone, email, password_hash, role, is_active) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      'System Administrator',
      '+8801700000000',
      'admin@courier.com',
      passwordHash,
      'ADMIN',
      true,
    ]
  );

  console.log('✅ Admin user created successfully!');
  console.log('📧 Email: admin@courier.com');
  console.log('📱 Phone: +8801700000000');
  console.log('🔑 Password: admin123');
  console.log('\n⚠️  Please change the password after first login!');

  await dataSource.destroy();
}

seed()
  .then(() => {
    console.log('\n✅ Seeding completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
