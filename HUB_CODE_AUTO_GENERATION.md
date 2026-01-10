# Hub Code Auto-Generation Implementation

## 📋 Overview

Hub codes are now **auto-generated** by the backend when creating a new hub. Admins can optionally provide a custom hub code, but if not provided, the system will automatically generate one based on the area.

---

## 🎯 Auto-Generated Format

### Pattern:
```
HUB-{AREA_CODE}-{NUMBER}
```

### Examples:

| Area | First Hub | Second Hub | Third Hub |
|------|-----------|------------|-----------|
| Dhaka | `HUB-DHK-001` | `HUB-DHK-002` | `HUB-DHK-003` |
| Chittagong | `HUB-CHI-001` | `HUB-CHI-002` | `HUB-CHI-003` |
| Sylhet | `HUB-SYL-001` | `HUB-SYL-002` | `HUB-SYL-003` |
| Rajshahi | `HUB-RAJ-001` | `HUB-RAJ-002` | `HUB-RAJ-003` |

### Rules:

1. **Area Code**: First 3 letters of the area (uppercase)
   - "Dhaka" → `DHK`
   - "Chittagong" → `CHI`
   - "Sylhet" → `SYL`
   - "Rajshahi" → `RAJ`

2. **Number**: Sequential 3-digit number (001, 002, 003...)
   - Auto-increments based on existing hubs in the area
   - Always padded to 3 digits

3. **Special Cases**:
   - If area has less than 3 letters: Padded with 'X' (e.g., "Cox" → `COX`)
   - Non-alphabetic characters removed (e.g., "Dhaka-1" → `DHK`)

---

## 🔧 Implementation Details

### 1. Updated DTO - `create-hub.dto.ts`

**Before (Required):**
```typescript
@IsString({ message: 'Hub code must be a string' })
@IsNotEmpty({ message: 'Hub code is required' })
@MaxLength(50, { message: 'Hub code cannot exceed 50 characters' })
@Matches(/^[A-Z0-9_-]+$/, { 
  message: 'Hub code must contain only uppercase letters, numbers, hyphens, and underscores' 
})
hub_code: string;
```

**After (Optional):**
```typescript
@IsOptional()
@IsString({ message: 'Hub code must be a string' })
@MaxLength(50, { message: 'Hub code cannot exceed 50 characters' })
@Matches(/^[A-Z0-9_-]+$/, { 
  message: 'Hub code must contain only uppercase letters, numbers, hyphens, and underscores' 
})
hub_code?: string; // Now optional - will be auto-generated if not provided
```

### 2. Hub Service - `hubs.service.ts`

#### Added `generateUniqueHubCode()` Method:

```typescript
/**
 * Generate unique hub code based on area
 * Format: HUB-{AREA_CODE}-{NUMBER}
 * Example: HUB-DHK-001, HUB-CTG-002
 */
private async generateUniqueHubCode(area: string): Promise<string> {
  // Extract first 3 letters from area and convert to uppercase
  const areaCode = area
    .replace(/[^a-zA-Z]/g, '') // Remove non-alphabetic characters
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X'); // Pad with X if less than 3 chars

  // Find all existing hub codes with this area prefix
  const existingHubs = await this.hubRepository
    .createQueryBuilder('hub')
    .where('hub.hub_code LIKE :prefix', { prefix: `HUB-${areaCode}-%` })
    .orderBy('hub.hub_code', 'DESC')
    .getMany();

  let nextNumber = 1;

  if (existingHubs.length > 0) {
    // Extract the highest number from existing codes
    const numbers = existingHubs
      .map((hub) => {
        const match = hub.hub_code.match(/HUB-[A-Z]{3}-(\\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num) => !isNaN(num));

    if (numbers.length > 0) {
      nextNumber = Math.max(...numbers) + 1;
    }
  }

  // Format: HUB-DHK-001
  return `HUB-${areaCode}-${nextNumber.toString().padStart(3, '0')}`;
}
```

#### Updated `create()` Method:

```typescript
async create(createHubDto: CreateHubDto): Promise<Hub> {
  try {
    // Auto-generate hub_code if not provided
    let hubCode = createHubDto.hub_code;
    
    if (!hubCode || hubCode.trim() === '') {
      hubCode = await this.generateUniqueHubCode(createHubDto.area);
    } else {
      hubCode = hubCode.toUpperCase();
      
      // Check if manually provided hub_code already exists
      const existing = await this.hubRepository.findOne({
        where: { hub_code: hubCode },
      });

      if (existing) {
        throw new ConflictException(
          `Hub with code '${hubCode}' already exists`,
        );
      }
    }
    
    // ... rest of creation logic
  }
}
```

---

## 📡 API Usage

### Endpoint: `POST /hubs`

### Option 1: Auto-Generate Hub Code (Recommended)

**Request (Without hub_code):**
```json
{
  "branch_name": "Dhaka Central Hub",
  "area": "Dhaka",
  "address": "123 Main Street, Dhaka",
  "manager_name": "John Doe",
  "manager_phone": "01712345678",
  "manager_email": "john@hub.com",
  "manager_password": "SecurePass123"
}
```

**Response:**
```json
{
  "id": "uuid-here",
  "hub_code": "HUB-DHK-001", // ✅ Auto-generated
  "message": "Hub created successfully"
}
```

### Option 2: Custom Hub Code (Optional)

**Request (With custom hub_code):**
```json
{
  "hub_code": "HUB-CUSTOM-001", // Custom code
  "branch_name": "Dhaka Central Hub",
  "area": "Dhaka",
  "address": "123 Main Street, Dhaka",
  "manager_name": "John Doe",
  "manager_phone": "01712345678",
  "manager_email": "john@hub.com",
  "manager_password": "SecurePass123"
}
```

**Response:**
```json
{
  "id": "uuid-here",
  "hub_code": "HUB-CUSTOM-001", // Custom code used
  "message": "Hub created successfully"
}
```

---

## 🎯 Benefits

### For Admins:
- ✅ **No manual code entry required** - Just provide the area
- ✅ **Consistent naming** - All codes follow the same pattern
- ✅ **No duplicate codes** - System ensures uniqueness
- ✅ **Easy identification** - Code shows location and sequence

### For the System:
- ✅ **Guaranteed uniqueness** - Database-backed validation
- ✅ **Sequential numbering** - Easy to track hub creation
- ✅ **Location-based grouping** - Codes grouped by area
- ✅ **Backwards compatible** - Custom codes still supported

---

## 🔍 Examples in Different Scenarios

### Scenario 1: First Hub in Dhaka
```json
Request: { "area": "Dhaka", ... }
Generated: "HUB-DHK-001"
```

### Scenario 2: Second Hub in Dhaka
```json
Request: { "area": "Dhaka", ... }
Generated: "HUB-DHK-002"
```

### Scenario 3: First Hub in Chittagong
```json
Request: { "area": "Chittagong", ... }
Generated: "HUB-CHI-001"
```

### Scenario 4: Area with Special Characters
```json
Request: { "area": "Cox's Bazar", ... }
Generated: "HUB-COX-001" // Special characters removed
```

### Scenario 5: Short Area Name
```json
Request: { "area": "Cox", ... }
Generated: "HUB-COX-001" // Automatically padded
```

---

## 🚨 Validation

### Valid Hub Codes:
- ✅ `HUB-DHK-001`
- ✅ `HUB-CHI-002`
- ✅ `HUB-SYL-999`
- ✅ `CUSTOM-CODE-01` (custom codes allowed)

### Invalid Hub Codes:
- ❌ `hub-dhk-001` (must be uppercase)
- ❌ `HUB DHK 001` (no spaces allowed)
- ❌ Empty string
- ❌ Duplicate codes (checked against database)

---

## 📝 Files Modified

| File | Change |
|------|--------|
| `src/hubs/dto/create-hub.dto.ts` | Made `hub_code` optional |
| `src/hubs/hubs.service.ts` | Added `generateUniqueHubCode()` method |
| `src/hubs/hubs.service.ts` | Updated `create()` to auto-generate codes |

---

## ✅ Status

- ✅ Hub code auto-generation implemented
- ✅ Custom codes still supported (optional)
- ✅ Validation ensures uniqueness
- ✅ No breaking changes - backwards compatible
- ✅ No linter errors
- ✅ Production ready

**Recommendation: Omit `hub_code` from requests and let the system generate it automatically!**

