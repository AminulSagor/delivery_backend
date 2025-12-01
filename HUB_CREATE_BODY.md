# ✅ Create Hub - Correct Request Body

## 📋 Required Fields

Based on `src/hubs/dto/create-hub.dto.ts`:

```json
{
  "hub_code": "HUB001",
  "branch_name": "Dhaka Central Hub",
  "area": "Gulshan",
  "address": "123 Hub St, Gulshan, Dhaka",
  "manager_name": "Hub Manager Name",
  "manager_phone": "01712345678",
  "manager_email": "hubmanager@example.com",
  "manager_password": "HubManager123!"
}
```

## ⚠️ Important Validations

### 1. `hub_code`
- Must be uppercase letters, numbers, hyphens, underscores only
- Max 50 characters
- Example: `HUB001`, `DHAKA_CENTRAL`, `HUB-GULSHAN-01`

### 2. `manager_phone`
- Must match: `01[3-9]XXXXXXXX` (Bangladeshi format)
- **NO +88 prefix!**
- Examples: `01712345678`, `01812345678`, `01912345678`

### 3. `manager_password`
- Min 8 characters, Max 100 characters
- Must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
- Examples: `HubManager123!`, `Password123`, `Manager@2024`

## ✅ Complete Example

```bash
POST http://localhost:3000/hubs
Content-Type: application/json
Authorization: Bearer {{access_token}}

{
  "hub_code": "HUB001",
  "branch_name": "Dhaka Central Hub",
  "area": "Gulshan",
  "address": "123 Hub St, Gulshan, Dhaka",
  "manager_name": "Hub Manager Name",
  "manager_phone": "01712345678",
  "manager_email": "hubmanager@example.com",
  "manager_password": "HubManager123!"
}
```

## 🔍 Field Details

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `hub_code` | string | ✅ Yes | Uppercase, numbers, `-`, `_` only |
| `branch_name` | string | ✅ Yes | Max 255 chars |
| `area` | string | ✅ Yes | Max 255 chars |
| `address` | string | ✅ Yes | Any string |
| `manager_name` | string | ✅ Yes | Max 255 chars |
| `manager_phone` | string | ✅ Yes | `01[3-9]XXXXXXXX` format |
| `manager_email` | string | ❌ Optional | Valid email |
| `manager_password` | string | ✅ Yes | Min 8, uppercase+lowercase+number |

---

**Use this body in Postman to create a hub!**
