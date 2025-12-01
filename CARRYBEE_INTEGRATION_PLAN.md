# 🚀 Carrybee Third-Party Integration - Complete Plan

## 📋 Overview

**Goal:** Add Carrybee as a third-party delivery provider option alongside internal rider delivery.

**Flow:**
1. Hub Manager accepts parcel → Parcel status: `IN_HUB`
2. Hub Manager can choose:
   - **Option A:** Assign to internal rider (existing flow)
   - **Option B:** Assign to Carrybee (new flow)
3. If Carrybee selected → Create order in Carrybee → Track via webhooks

---

## 🗂️ Database Changes Required

### 1. **New Enum: Delivery Provider**
```typescript
// src/common/enums/delivery-provider.enum.ts
export enum DeliveryProvider {
  INTERNAL = 'INTERNAL',      // Our own riders
  CARRYBEE = 'CARRYBEE',      // Carrybee third-party
}
```

### 2. **New Entity: Third Party Provider**
```typescript
// src/third-party-providers/entities/third-party-provider.entity.ts
@Entity('third_party_providers')
export class ThirdPartyProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  provider_code: string; // 'CARRYBEE', 'PATHAO', etc.

  @Column({ type: 'varchar', length: 100 })
  provider_name: string; // 'Carrybee', 'Pathao', etc.

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo_url: string;

  @Column({ type: 'json', nullable: true })
  config: any; // Store API credentials, base URL, etc.

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

### 3. **New Entity: Carrybee Location Cache**
```typescript
// src/carrybee/entities/carrybee-location.entity.ts
@Entity('carrybee_locations')
export class CarrybeeLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  city_id: number;

  @Column({ type: 'varchar', length: 100 })
  city_name: string;

  @Column({ type: 'int', nullable: true })
  zone_id: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  zone_name: string | null;

  @Column({ type: 'int', nullable: true })
  area_id: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  area_name: string | null;

  // Map to our coverage area
  @Column({ type: 'uuid', nullable: true })
  coverage_area_id: string | null;

  @ManyToOne(() => CoverageArea)
  @JoinColumn({ name: 'coverage_area_id' })
  coverage_area: CoverageArea;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

### 4. **Update Parcel Entity**
Add these fields to `src/parcels/entities/parcel.entity.ts`:

```typescript
// ===== THIRD PARTY DELIVERY =====
@Column({
  type: 'enum',
  enum: DeliveryProvider,
  default: DeliveryProvider.INTERNAL,
})
delivery_provider: DeliveryProvider;

@Column({ type: 'uuid', nullable: true })
third_party_provider_id: string | null;

@ManyToOne(() => ThirdPartyProvider, { onDelete: 'SET NULL' })
@JoinColumn({ name: 'third_party_provider_id' })
thirdPartyProvider: ThirdPartyProvider | null;

// Carrybee specific fields
@Column({ type: 'varchar', length: 100, nullable: true })
carrybee_consignment_id: string | null;

@Column({ type: 'varchar', length: 100, nullable: true })
carrybee_store_id: string | null;

@Column({ type: 'varchar', length: 100, nullable: true })
carrybee_status: string | null;

@Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
carrybee_delivery_fee: number | null;

@Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
carrybee_cod_fee: number | null;

@Column({ type: 'timestamp', nullable: true })
assigned_to_carrybee_at: Date | null;

@Column({ type: 'timestamp', nullable: true })
carrybee_picked_at: Date | null;

@Column({ type: 'timestamp', nullable: true })
carrybee_delivered_at: Date | null;

@Column({ type: 'text', nullable: true })
carrybee_tracking_events: string | null; // JSON array of events
```

### 5. **Update Store Entity**
Add these fields to `src/stores/entities/store.entity.ts`:

```typescript
// ===== CARRYBEE INTEGRATION =====
@Column({ type: 'varchar', length: 100, nullable: true })
carrybee_store_id: string | null;

@Column({ type: 'int', nullable: true })
carrybee_city_id: number | null;

@Column({ type: 'int', nullable: true })
carrybee_zone_id: number | null;

@Column({ type: 'int', nullable: true })
carrybee_area_id: number | null;

@Column({ type: 'boolean', default: false })
is_carrybee_synced: boolean;

@Column({ type: 'timestamp', nullable: true })
carrybee_synced_at: Date | null;
```

### 6. **New Parcel Statuses**
Update `ParcelStatus` enum in `src/parcels/entities/parcel.entity.ts`:

```typescript
export enum ParcelStatus {
  PENDING = 'PENDING',
  PICKED_UP = 'PICKED_UP',
  IN_HUB = 'IN_HUB',
  ASSIGNED_TO_RIDER = 'ASSIGNED_TO_RIDER',
  ASSIGNED_TO_THIRD_PARTY = 'ASSIGNED_TO_THIRD_PARTY',  // NEW
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  OUT_FOR_PICKUP = 'OUT_FOR_PICKUP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  FAILED_DELIVERY = 'FAILED_DELIVERY',
  RETURNED_TO_HUB = 'RETURNED_TO_HUB',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}
```

---

## 📁 New Modules to Create

### 1. **Third Party Providers Module**
```
src/third-party-providers/
├── dto/
│   ├── create-third-party-provider.dto.ts
│   └── update-third-party-provider.dto.ts
├── entities/
│   └── third-party-provider.entity.ts
├── third-party-providers.controller.ts
├── third-party-providers.service.ts
└── third-party-providers.module.ts
```

### 2. **Carrybee Module**
```
src/carrybee/
├── dto/
│   ├── carrybee-create-store.dto.ts
│   ├── carrybee-create-order.dto.ts
│   ├── carrybee-webhook-event.dto.ts
│   └── assign-to-carrybee.dto.ts
├── entities/
│   └── carrybee-location.entity.ts
├── carrybee.controller.ts
├── carrybee.service.ts
├── carrybee-api.service.ts      // HTTP client for Carrybee API
├── carrybee-webhook.service.ts  // Handle webhooks
└── carrybee.module.ts
```

---

## 🔌 API Endpoints to Add

### **Third Party Providers Endpoints**

#### 1. Get All Active Providers (for Hub Manager)
```
GET /third-party-providers/active
Role: HUB_MANAGER, ADMIN
Response: List of active providers (Carrybee, etc.)
```

#### 2. Admin - Manage Providers
```
POST   /third-party-providers        (Create provider)
GET    /third-party-providers        (Get all)
GET    /third-party-providers/:id    (Get one)
PATCH  /third-party-providers/:id    (Update)
DELETE /third-party-providers/:id    (Delete)
Role: ADMIN
```

---

### **Carrybee Integration Endpoints**

#### 1. Get Parcels for Third-Party Assignment
```
GET /parcels/hub/for-third-party-assignment
Role: HUB_MANAGER
Query: ?page=1&limit=20
Response: Parcels with status IN_HUB (same as rider assignment)
```

#### 2. Assign Parcel to Carrybee
```
POST /parcels/:id/assign-to-carrybee
Role: HUB_MANAGER
Body: {
  "provider_id": "uuid",  // Third party provider ID
  "notes": "string (optional)"
}
Response: {
  "success": true,
  "carrybee_consignment_id": "FX1212124433",
  "delivery_fee": "60",
  "cod_fee": 15.92
}
```

#### 3. Sync Store to Carrybee
```
POST /stores/:id/sync-to-carrybee
Role: MERCHANT, ADMIN
Body: {
  "city_id": 14,
  "zone_id": 5,
  "area_id": 282
}
Response: {
  "success": true,
  "carrybee_store_id": "a1b2c3d4"
}
```

#### 4. Get Carrybee Locations (for store sync)
```
GET /carrybee/cities
GET /carrybee/cities/:cityId/zones
GET /carrybee/cities/:cityId/zones/:zoneId/areas
GET /carrybee/area-suggestion?search=sector
Role: MERCHANT, HUB_MANAGER, ADMIN
```

#### 5. Get Parcel Carrybee Status
```
GET /parcels/:id/carrybee-status
Role: MERCHANT, HUB_MANAGER, ADMIN
Response: {
  "consignment_id": "FX1212124433",
  "status": "In transit",
  "tracking_events": [...],
  "delivery_fee": "60",
  "cod_fee": 15.92
}
```

#### 6. Carrybee Webhook Receiver
```
POST /webhooks/carrybee
Public endpoint (verify signature)
Body: Carrybee webhook payload
Action: Update parcel status based on event
```

#### 7. Cancel Carrybee Order
```
POST /parcels/:id/cancel-carrybee-order
Role: HUB_MANAGER, ADMIN
Body: {
  "cancellation_reason": "string"
}
```

---

## 🔄 Integration Workflow

### **Step 1: Store Setup (One-time per store)**

1. Merchant creates store in YOUR system
2. Merchant/Admin syncs store to Carrybee:
   - Select Carrybee location (city/zone/area)
   - Call Carrybee API to create store
   - Store `carrybee_store_id` in database
   - Mark `is_carrybee_synced = true`

### **Step 2: Parcel Assignment to Carrybee**

1. Merchant creates parcel → Status: `PENDING`
2. Hub receives parcel → Status: `IN_HUB`
3. Hub Manager goes to "Third Party Assignment" page
4. Hub Manager sees:
   - List of parcels with status `IN_HUB`
   - List of available providers (Carrybee)
5. Hub Manager selects parcel(s) and Carrybee
6. System:
   - Validates store is synced to Carrybee
   - Maps delivery location to Carrybee location
   - Creates order in Carrybee API
   - Updates parcel:
     - `delivery_provider = CARRYBEE`
     - `status = ASSIGNED_TO_THIRD_PARTY`
     - `carrybee_consignment_id = FX1212124433`
     - `carrybee_delivery_fee = 60`
     - `carrybee_cod_fee = 15.92`

### **Step 3: Tracking via Webhooks**

1. Carrybee sends webhook events
2. Your system receives webhook at `/webhooks/carrybee`
3. Verify signature
4. Update parcel status based on event:
   - `order.picked` → `carrybee_status = "Picked"`
   - `order.in-transit` → `status = IN_TRANSIT`
   - `order.delivered` → `status = DELIVERED`, `carrybee_delivered_at = now()`
   - `order.delivery-failed` → `status = FAILED_DELIVERY`
   - etc.
5. Store all events in `carrybee_tracking_events` JSON field
6. Notify merchant of status changes

---

## 🛠️ Missing Fields Analysis

### **Your Current System vs Carrybee Requirements**

| Carrybee Field | Your Field | Status | Action |
|----------------|------------|--------|--------|
| `store_id` | `store_id` | ✅ Exists | Add `carrybee_store_id` mapping |
| `merchant_order_id` | `merchant_order_id` | ✅ Exists | Use as-is |
| `delivery_type` | `delivery_type` | ✅ Exists | Map: 1=Normal, 2=Express |
| `product_type` | `parcel_type` | ✅ Exists | Map: 1=Parcel, 2=Book, 3=Document |
| `recipient_phone` | `customer_phone` | ✅ Exists | Use as-is |
| `recipient_name` | `customer_name` | ✅ Exists | Use as-is |
| `recipient_address` | `delivery_address` | ✅ Exists | Use as-is |
| `city_id` | - | ❌ Missing | Get from Carrybee location mapping |
| `zone_id` | - | ❌ Missing | Get from Carrybee location mapping |
| `area_id` | - | ❌ Missing | Get from Carrybee location mapping |
| `item_weight` | `product_weight` | ✅ Exists | Convert kg to grams |
| `item_quantity` | - | ❌ Missing | Add to Parcel entity |
| `collectable_amount` | `cod_amount` | ✅ Exists | Use as-is |
| `special_instruction` | `special_instructions` | ✅ Exists | Use as-is |
| `product_description` | `product_description` | ✅ Exists | Use as-is |
| `recipient_secondary_phone` | - | ❌ Missing | Add to Parcel entity |

### **Fields to Add to Parcel Entity**
```typescript
@Column({ type: 'int', nullable: true })
item_quantity: number | null;

@Column({ type: 'varchar', length: 20, nullable: true })
customer_secondary_phone: string | null;
```

---

## 🗺️ Location Mapping Strategy

### **Problem:**
- Your system uses: `division/district/zone/area` (CoverageArea)
- Carrybee uses: `city_id/zone_id/area_id` (integers)

### **Solution:**

1. **Create Mapping Table** (`carrybee_locations`)
   - Store Carrybee locations (cities, zones, areas)
   - Link to your `coverage_area_id`

2. **Sync Process:**
   - Admin fetches Carrybee cities/zones/areas
   - Admin maps them to your coverage areas
   - Store mapping in database

3. **On Parcel Assignment:**
   - Get parcel's `delivery_coverage_area_id`
   - Look up Carrybee location mapping
   - Use Carrybee `city_id/zone_id/area_id` in API call

---

## 📝 Environment Variables to Add

```env
# Carrybee Configuration
CARRYBEE_ENV=sandbox  # or production
CARRYBEE_SANDBOX_BASE_URL=https://stage-sandbox.carrybee.com/
CARRYBEE_PRODUCTION_BASE_URL=https://developers.carrybee.com/
CARRYBEE_SANDBOX_CLIENT_ID=1a89c1a6-fc68-4395-9c09-628e0d3eaafc
CARRYBEE_SANDBOX_CLIENT_SECRET=1d7152c9-5b2d-4e4e-9c20-652b93333704
CARRYBEE_SANDBOX_CLIENT_CONTEXT=DzJwPsx31WaTbS745XZoBjmQLcNqwK
CARRYBEE_PRODUCTION_CLIENT_ID=your_production_client_id
CARRYBEE_PRODUCTION_CLIENT_SECRET=your_production_client_secret
CARRYBEE_PRODUCTION_CLIENT_CONTEXT=your_production_client_context
CARRYBEE_WEBHOOK_SIGNATURE=your_webhook_signature
```

---

## 🎯 Implementation Phases

### **Phase 1: Database & Entities** (Day 1-2)
- [ ] Create migration for new fields
- [ ] Add `DeliveryProvider` enum
- [ ] Update `Parcel` entity
- [ ] Update `Store` entity
- [ ] Create `ThirdPartyProvider` entity
- [ ] Create `CarrybeeLocation` entity
- [ ] Run migrations

### **Phase 2: Carrybee API Service** (Day 3-4)
- [ ] Create Carrybee module
- [ ] Implement `CarrybeeApiService` (HTTP client)
- [ ] Implement location endpoints (cities, zones, areas)
- [ ] Implement store creation
- [ ] Implement order creation
- [ ] Implement order cancellation
- [ ] Implement order details fetch
- [ ] Add error handling and logging

### **Phase 3: Third Party Providers** (Day 5)
- [ ] Create Third Party Providers module
- [ ] Admin CRUD endpoints
- [ ] Seed Carrybee provider in database
- [ ] Get active providers endpoint

### **Phase 4: Store Sync** (Day 6)
- [ ] Store sync to Carrybee endpoint
- [ ] Location selection UI support
- [ ] Update store service
- [ ] Test store creation in Carrybee

### **Phase 5: Parcel Assignment** (Day 7-8)
- [ ] Get parcels for third-party assignment endpoint
- [ ] Assign to Carrybee endpoint
- [ ] Location mapping logic
- [ ] Field validation and transformation
- [ ] Update parcel service
- [ ] Test order creation in Carrybee

### **Phase 6: Webhook Integration** (Day 9-10)
- [ ] Create webhook receiver endpoint
- [ ] Implement signature verification
- [ ] Map Carrybee events to parcel statuses
- [ ] Update parcel on webhook
- [ ] Store tracking events
- [ ] Test with Carrybee sandbox

### **Phase 7: UI & Testing** (Day 11-12)
- [ ] Update Postman collection
- [ ] Test all flows end-to-end
- [ ] Handle edge cases
- [ ] Add logging and monitoring
- [ ] Documentation

---

## 🚨 Important Considerations

### **1. Store Sync Requirement**
- Store MUST be synced to Carrybee before assigning parcels
- Add validation: Check `is_carrybee_synced` before assignment
- Show error if store not synced

### **2. Location Mapping**
- Not all your coverage areas may exist in Carrybee
- Need fallback: Use area suggestion API
- Admin should review and map locations

### **3. Phone Number Format**
- Your system: `+8801XXXXXXXXX`
- Carrybee accepts: `01XXXXXXXXX` or `8801XXXXXXXXX`
- Need transformation logic

### **4. Weight Conversion**
- Your system: `product_weight` in kg (decimal)
- Carrybee: `item_weight` in grams (integer 1-25000)
- Convert: `kg * 1000`

### **5. Webhook Security**
- Verify `X-Carrybee-Webhook-Signature` header
- Reject unsigned requests
- Log all webhook events

### **6. Idempotency**
- Prevent duplicate order creation
- Check if `carrybee_consignment_id` already exists
- Handle webhook duplicate events

### **7. Error Handling**
- Carrybee API may fail
- Store error in parcel notes
- Allow retry mechanism
- Notify hub manager of failures

---

## 📊 Database Migration Script

```typescript
// migration/XXXXXX-add-carrybee-integration.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCarrybeeIntegration1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create delivery_provider enum
    await queryRunner.query(`
      CREATE TYPE "delivery_provider_enum" AS ENUM ('INTERNAL', 'CARRYBEE')
    `);

    // 2. Create third_party_providers table
    await queryRunner.query(`
      CREATE TABLE "third_party_providers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "provider_code" varchar(50) UNIQUE NOT NULL,
        "provider_name" varchar(100) NOT NULL,
        "description" text,
        "is_active" boolean DEFAULT true,
        "logo_url" varchar(255),
        "config" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `);

    // 3. Create carrybee_locations table
    await queryRunner.query(`
      CREATE TABLE "carrybee_locations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "city_id" int NOT NULL,
        "city_name" varchar(100) NOT NULL,
        "zone_id" int,
        "zone_name" varchar(100),
        "area_id" int,
        "area_name" varchar(100),
        "coverage_area_id" uuid,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        FOREIGN KEY ("coverage_area_id") REFERENCES "coverage_areas"("id")
      )
    `);

    // 4. Add fields to parcels table
    await queryRunner.query(`
      ALTER TABLE "parcels"
      ADD COLUMN "delivery_provider" delivery_provider_enum DEFAULT 'INTERNAL',
      ADD COLUMN "third_party_provider_id" uuid,
      ADD COLUMN "carrybee_consignment_id" varchar(100),
      ADD COLUMN "carrybee_store_id" varchar(100),
      ADD COLUMN "carrybee_status" varchar(100),
      ADD COLUMN "carrybee_delivery_fee" decimal(10,2),
      ADD COLUMN "carrybee_cod_fee" decimal(10,2),
      ADD COLUMN "assigned_to_carrybee_at" timestamp,
      ADD COLUMN "carrybee_picked_at" timestamp,
      ADD COLUMN "carrybee_delivered_at" timestamp,
      ADD COLUMN "carrybee_tracking_events" text,
      ADD COLUMN "item_quantity" int,
      ADD COLUMN "customer_secondary_phone" varchar(20),
      ADD FOREIGN KEY ("third_party_provider_id") REFERENCES "third_party_providers"("id")
    `);

    // 5. Add fields to stores table
    await queryRunner.query(`
      ALTER TABLE "stores"
      ADD COLUMN "carrybee_store_id" varchar(100),
      ADD COLUMN "carrybee_city_id" int,
      ADD COLUMN "carrybee_zone_id" int,
      ADD COLUMN "carrybee_area_id" int,
      ADD COLUMN "is_carrybee_synced" boolean DEFAULT false,
      ADD COLUMN "carrybee_synced_at" timestamp
    `);

    // 6. Update ParcelStatus enum
    await queryRunner.query(`
      ALTER TYPE "parcel_status_enum" ADD VALUE 'ASSIGNED_TO_THIRD_PARTY'
    `);

    // 7. Seed Carrybee provider
    await queryRunner.query(`
      INSERT INTO "third_party_providers" 
      ("provider_code", "provider_name", "description", "is_active", "config")
      VALUES 
      ('CARRYBEE', 'Carrybee', 'Third-party delivery service provider', true, '{}')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse all changes
  }
}
```

---

## ✅ Summary

**Total Work:**
- 2 new modules (Third Party Providers, Carrybee)
- 2 new entities (ThirdPartyProvider, CarrybeeLocation)
- 15+ new fields across Parcel and Store entities
- 12+ new API endpoints
- 1 webhook receiver
- Location mapping system
- Database migration

**Estimated Time:** 10-12 days

**Priority Order:**
1. Database changes (critical)
2. Carrybee API service (core functionality)
3. Store sync (prerequisite)
4. Parcel assignment (main feature)
5. Webhook integration (tracking)
6. Testing & documentation

---

**Ready to start implementation?** 🚀
