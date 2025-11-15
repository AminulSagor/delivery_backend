-- Import CSV data into PostgreSQL tables
-- Replace '/path/to/your/file.csv' with actual file paths

-- Example: Import users from CSV
-- COPY users(full_name, phone, email, password_hash, role, is_active)
-- FROM 'C:/data/users.csv'
-- DELIMITER ','
-- CSV HEADER;

-- Example: Import merchants from CSV
-- COPY merchants(user_id, thana, district, full_address, secondary_number, status)
-- FROM 'C:/data/merchants.csv'
-- DELIMITER ','
-- CSV HEADER;

-- Example: Import stores from CSV
-- COPY stores(merchant_id, business_name, business_address, phone_number, email, facebook_page, is_default)
-- FROM 'C:/data/stores.csv'
-- DELIMITER ','
-- CSV HEADER;

-- Example: Import hubs from CSV
-- COPY hubs(name, address, phone_number, capacity)
-- FROM 'C:/data/hubs.csv'
-- DELIMITER ','
-- CSV HEADER;

-- Example: Import riders from CSV
-- COPY riders(user_id, hub_id, vehicle_type, vehicle_number, license_number, is_available)
-- FROM 'C:/data/riders.csv'
-- DELIMITER ','
-- CSV HEADER;

-- Note: 
-- 1. Use absolute paths for CSV files
-- 2. Ensure PostgreSQL user has read permissions for the files
-- 3. For Windows, use forward slashes (/) or escape backslashes (\\)
-- 4. CSV HEADER means first row contains column names
