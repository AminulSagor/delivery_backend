# Store API Response - Complete Example

## 📡 GET /stores (Merchant View)

### Request
```http
GET {{baseUrl}}/stores
Authorization: Bearer <merchant_jwt_token>
```

### Response
```json
{
  "stores": [
    {
      "id": "e0cde5ef-799d-4529-8430-5789417c2818",
      "store_code": "TSH001",
      "business_name": "Tech Solutions Hub",
      "business_address": "123 Tech Street, Gulshan-2, Dhaka",
      "phone_number": "01712345678",
      "email": "info@techsolutionshub.com",
      "facebook_page": "facebook.com/techsolutionshub",
      "district": "Dhaka",
      "thana": "Gulshan",
      "area": "Gulshan-2",
      "is_default": true,
      "hub_id": "f0cde5ef-799d-4529-8430-5789417c2819",
      "hub_code": "HUB-DHK-001",
      "hub_name": "Dhaka Central Hub",
      "performance": {
        "total_parcels": 1247,
        "successfully_delivered": 1200,
        "total_returns": 47,
        "pending_parcels": 0
      },
      "created_at": "2025-01-01T06:00:00.000Z",
      "updated_at": "2025-01-08T10:30:00.000Z"
    },
    {
      "id": "a1bcd5ef-799d-4529-8430-5789417c2820",
      "store_code": "TSH002",
      "business_name": "Tech Solutions Hub - Branch 2",
      "business_address": "456 Tech Avenue, Banani, Dhaka",
      "phone_number": "01798765432",
      "email": "branch2@techsolutionshub.com",
      "facebook_page": null,
      "district": "Dhaka",
      "thana": "Banani",
      "area": "Banani",
      "is_default": false,
      "hub_id": null,
      "hub_code": null,
      "hub_name": null,
      "performance": {
        "total_parcels": 85,
        "successfully_delivered": 80,
        "total_returns": 5,
        "pending_parcels": 0
      },
      "created_at": "2025-01-05T08:00:00.000Z",
      "updated_at": "2025-01-08T09:00:00.000Z"
    }
  ],
  "total": 2,
  "message": "Stores retrieved successfully"
}
```

---

## 🎨 Frontend Display Example

### Store Card UI

```
╔══════════════════════════════════════════════════════════════╗
║  📦 Tech Solutions Hub                            [DEFAULT]  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  🆔 Unique ID                                                ║
║  TSH001                                                      ║
║                                                              ║
║  📱 Phone/Whatsapp                                           ║
║  +880 1712-345678                                            ║
║                                                              ║
║  📧 Email                                                     ║
║  info@techsolutionshub.com                                  ║
║                                                              ║
║  📍 Business Address                                          ║
║  123 Tech Street, Gulshan-2, Dhaka                          ║
║                                                              ║
║  🌐 Facebook Page                                             ║
║  facebook.com/techsolutionshub                              ║
║                                                              ║
║  🏢 Assigned Hub                                              ║
║  Dhaka Central Hub (HUB-DHK-001)                            ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  📊 Performance                                               ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Total Parcels Handled      1,247                           ║
║  ✅ Successfully Delivered   1,200 (96.2%)                   ║
║  📦 Total Returns              47 (3.8%)                     ║
║  ⏳ Pending Parcels             0                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### React Component Example

```jsx
function StoreCard({ store }) {
  const deliveryRate = (
    (store.performance.successfully_delivered / store.performance.total_parcels) * 100
  ).toFixed(1);

  const returnRate = (
    (store.performance.total_returns / store.performance.total_parcels) * 100
  ).toFixed(1);

  return (
    <div className="store-card">
      <div className="store-header">
        <h3>{store.business_name}</h3>
        {store.is_default && <span className="badge">DEFAULT</span>}
      </div>

      <div className="store-info">
        <div className="info-item">
          <label>Unique ID</label>
          <span className="store-code">{store.store_code}</span>
        </div>

        <div className="info-item">
          <label>Phone/Whatsapp</label>
          <span>{store.phone_number}</span>
        </div>

        {store.email && (
          <div className="info-item">
            <label>Email</label>
            <span>{store.email}</span>
          </div>
        )}

        <div className="info-item">
          <label>Address</label>
          <span>{store.business_address}</span>
        </div>

        {store.facebook_page && (
          <div className="info-item">
            <label>Facebook Page</label>
            <a href={`https://${store.facebook_page}`} target="_blank">
              {store.facebook_page}
            </a>
          </div>
        )}

        {store.hub_code && (
          <div className="info-item">
            <label>Assigned Hub</label>
            <span>
              {store.hub_name} ({store.hub_code})
            </span>
          </div>
        )}
      </div>

      <div className="store-performance">
        <h4>Performance</h4>
        <div className="metrics">
          <div className="metric">
            <label>Total Parcels</label>
            <span>{store.performance.total_parcels.toLocaleString()}</span>
          </div>
          <div className="metric success">
            <label>Successfully Delivered</label>
            <span>
              {store.performance.successfully_delivered.toLocaleString()}
              <small>({deliveryRate}%)</small>
            </span>
          </div>
          <div className="metric warning">
            <label>Total Returns</label>
            <span>
              {store.performance.total_returns.toLocaleString()}
              <small>({returnRate}%)</small>
            </span>
          </div>
          {store.performance.pending_parcels > 0 && (
            <div className="metric pending">
              <label>Pending</label>
              <span>{store.performance.pending_parcels.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 🔑 Key Fields Explained

### Auto-Generated by Backend:

| Field | Description | Example |
|-------|-------------|---------|
| `store_code` | Unique identifier (auto-generated) | `TSH001` |
| `hub_code` | Hub identifier (from hub assignment) | `HUB-DHK-001` |
| `hub_name` | Hub branch name | `Dhaka Central Hub` |
| `performance.*` | Real-time metrics (calculated) | See below |

### Performance Metrics:

| Metric | Calculation | Meaning |
|--------|-------------|---------|
| `total_parcels` | COUNT(*) | All parcels ever created |
| `successfully_delivered` | DELIVERED + PARTIAL + EXCHANGE | Successfully completed |
| `total_returns` | RETURNED + PAID_RETURN + etc. | Failed deliveries |
| `pending_parcels` | Not delivered/returned/cancelled | In progress |

---

## 🎯 Frontend Implementation Tips

### 1. Display Store Code Prominently
```jsx
<div className="store-id">
  <label>Store ID</label>
  <code>{store.store_code}</code>
  <button onClick={() => copyToClipboard(store.store_code)}>
    📋 Copy
  </button>
</div>
```

### 2. Show Hub Assignment Status
```jsx
{store.hub_code ? (
  <div className="hub-assigned">
    ✅ Assigned to {store.hub_name} ({store.hub_code})
  </div>
) : (
  <div className="hub-unassigned">
    ⚠️ Not assigned to any hub yet
  </div>
)}
```

### 3. Performance Dashboard
```jsx
<div className="performance-grid">
  <div className="stat-card">
    <h3>{store.performance.total_parcels}</h3>
    <p>Total Parcels</p>
  </div>
  <div className="stat-card success">
    <h3>{store.performance.successfully_delivered}</h3>
    <p>Delivered</p>
    <span className="percentage">
      {((store.performance.successfully_delivered / store.performance.total_parcels) * 100).toFixed(1)}%
    </span>
  </div>
  <div className="stat-card danger">
    <h3>{store.performance.total_returns}</h3>
    <p>Returns</p>
    <span className="percentage">
      {((store.performance.total_returns / store.performance.total_parcels) * 100).toFixed(1)}%
    </span>
  </div>
</div>
```

### 4. Success Rate Indicator
```jsx
function getSuccessRate(performance) {
  return (performance.successfully_delivered / performance.total_parcels) * 100;
}

function getRatingColor(rate) {
  if (rate >= 95) return 'green';
  if (rate >= 85) return 'yellow';
  return 'red';
}

<div className={`success-rate ${getRatingColor(successRate)}`}>
  Success Rate: {successRate.toFixed(1)}%
</div>
```

---

## 📊 Response Fields Reference

### Complete Field List:

```typescript
interface StoreResponse {
  id: string;                    // UUID
  store_code: string | null;     // ✅ Auto-generated (e.g., "TSH001")
  business_name: string;          // Merchant input
  business_address: string;       // Merchant input
  phone_number: string;           // Merchant input (01XXXXXXXXX)
  email: string | null;           // Merchant input (optional)
  facebook_page: string | null;   // Merchant input (optional)
  district: string | null;        // Merchant input
  thana: string | null;           // Merchant input
  area: string | null;            // Merchant input (optional)
  is_default: boolean;            // Merchant can set
  hub_id: string | null;          // ✅ Admin assigns
  hub_code: string | null;        // ✅ Auto-included from hub
  hub_name: string | null;        // ✅ Auto-included from hub
  performance: {                  // ✅ Auto-calculated
    total_parcels: number;
    successfully_delivered: number;
    total_returns: number;
    pending_parcels: number;
  };
  created_at: string;             // ISO 8601 timestamp
  updated_at: string;             // ISO 8601 timestamp
}
```

---

## 🎉 Summary

### What Merchants Get Now:

1. **Unique Store ID** (`store_code`) - Auto-generated, never changes
2. **Hub Information** (`hub_code`, `hub_name`) - Auto-included when assigned
3. **Real-time Performance** - Calculated from actual parcel data
4. **Professional Display** - All information ready for UI

### What Merchants DON'T Need to Do:

- ❌ Enter store code manually
- ❌ Calculate performance metrics
- ❌ Fetch hub information separately
- ❌ Track parcel counts manually

### Everything is **AUTO-GENERATED** by the backend! 🎉

