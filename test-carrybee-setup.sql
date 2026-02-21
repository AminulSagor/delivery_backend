-- Carrybee Testing Database Setup
-- Run this before testing Carrybee integration

-- 1. Ensure Carrybee provider exists
INSERT INTO third_party_providers (
  id,
  provider_name,
  provider_code,
  api_base_url,
  is_active,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Carrybee',
  'CARRYBEE',
  'https://stage-sandbox.carrybee.com/',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (provider_code) DO UPDATE SET
  is_active = true,
  updated_at = NOW();

-- Get the Carrybee provider ID
SELECT 
  id as carrybee_provider_id,
  provider_name,
  provider_code,
  is_active
FROM third_party_providers 
WHERE provider_code = 'CARRYBEE';

-- 2. Check if coverage areas have Carrybee location IDs
SELECT 
  id,
  division,
  city,
  city_id,
  zone,
  zone_id,
  area,
  area_id,
  inside_dhaka_flag
FROM coverage_areas 
WHERE city_id IS NOT NULL 
  AND zone_id IS NOT NULL 
  AND area_id IS NOT NULL
LIMIT 5;

-- 3. Optional: Enable auto-assignment for a test store
-- UPDATE stores 
-- SET auto_assign_to_carrybee = true 
-- WHERE business_name = 'Your Test Store Name';

-- 4. Verify store sync status
SELECT 
  id,
  business_name,
  carrybee_store_id,
  is_carrybee_synced,
  carrybee_city_id,
  carrybee_zone_id,
  carrybee_area_id,
  auto_assign_to_carrybee
FROM stores 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. Check recent parcels
SELECT 
  id,
  tracking_number,
  status,
  delivery_provider,
  carrybee_consignment_id,
  recipient_carrybee_city_id,
  recipient_carrybee_zone_id,
  recipient_carrybee_area_id
FROM parcels 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Test webhook events (if any exist)
-- SELECT * FROM carrybee_webhook_events ORDER BY created_at DESC LIMIT 10;
