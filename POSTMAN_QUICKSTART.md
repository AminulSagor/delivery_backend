# 🚀 Quick Start: Test Email Flow in Postman

## 📖 Complete Guide: Merchant Creation → Approval → Email Sent

This is a **visual step-by-step guide** to test the complete merchant email flow using Postman.

---

## 🎯 What You'll Test

```
Merchant Signup → Admin Login → Approve Merchant → Email Sent! 📧
```

---

## 📋 Prerequisites

1. ✅ Server running: `npm run start:dev`
2. ✅ Postman installed
3. ✅ Collection imported: `Courier-API.postman_collection.json`
4. ✅ Email configured in `.env` (or STUB mode for testing)

---

## 🎬 Step-by-Step Visual Guide

### Step 1: 🔐 Admin Login

**Location**: `Authentication` → `Admin Login`

```
POST http://localhost:3000/auth/login
```

**Body**:
```json
{
  "identifier": "admin@courier.com",
  "password": "admin123"
}
```

**Click**: `Send` button

**Expected Result**: 
- ✅ Status: `200 OK`
- ✅ Token automatically saved to variables
- ✅ See "Tokens saved to variables" in Postman Console

**Response Preview**:
```json
{
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJ...",
    "user": {
      "role": "ADMIN"
    }
  }
}
```

---

### Step 2: 📧 Verify Email (Optional but Recommended)

**Location**: `Email Testing` → `Verify Email Connection`

```
POST http://localhost:3000/admin/email/verify
```

**Headers**: Auto-included (uses saved token)

**Click**: `Send` button

**Expected Result**:
```json
{
  "success": true,
  "message": "Email server connection verified successfully"
}
```

**If STUB Mode**:
```json
{
  "success": false,
  "message": "Email service not configured"
}
```

---

### Step 3: ✉️ Send Test Email (Optional)

**Location**: `Email Testing` → `Send Test Email`

```
POST http://localhost:3000/admin/email/test
```

**Body**:
```json
{
  "email": "your-personal-email@gmail.com"
}
```

**Click**: `Send` button

**Expected Result**:
- ✅ Response: `"Test email sent to..."`
- ✅ Check your inbox for test email
- ✅ Subject: "✅ Test Email from Courier Delivery Backend"

---

### Step 4: 👤 Create Merchant Account

**Location**: `Merchants` → `Merchant Signup`

```
POST http://localhost:3000/merchants/signup
```

**Body** (already filled in collection):
```json
{
  "full_name": "ABC Electronics Store",
  "phone": "+8801711222333",
  "email": "merchant.test@gmail.com",
  "password": "Merchant123!",
  "thana": "Gulshan",
  "district": "Dhaka",
  "full_address": "House 15, Road 5, Gulshan-2, Dhaka",
  "secondary_number": "+8801811222333"
}
```

**⚠️ IMPORTANT**: 
- Change `phone` to a unique number each time
- Use a **real email address** you can access

**Click**: `Send` button

**Expected Result**:
```json
{
  "statusCode": 201,
  "message": "Merchant signup successful. Awaiting approval from admin.",
  "data": {
    "merchant": {
      "id": "uuid-merchant-123",
      "status": "PENDING",
      ...
    },
    "user": {
      "email": "merchant.test@gmail.com",
      ...
    }
  }
}
```

**Auto-Saved**:
- ✅ `merchantId` saved to collection variables
- ✅ See "Merchant ID saved: uuid-merchant-123" in Console

---

### Step 5: 🔍 View Pending Merchants (Optional)

**Location**: `Merchants` → `Get Pending Merchants`

```
GET http://localhost:3000/merchants?status=PENDING
```

**Click**: `Send` button

**Expected Result**: List of pending merchants including the one you just created

---

### Step 6: 🎉 Approve Merchant (TRIGGERS EMAIL!)

**Location**: `Merchants` → `Approve Merchant (Triggers Email!)`

```
PATCH http://localhost:3000/merchants/{{merchantId}}/approve
```

**Note**: `{{merchantId}}` is auto-filled from Step 4

**Body**: Empty `{}`

**Click**: `Send` button

**Expected Result**:
```json
{
  "statusCode": 200,
  "message": "Merchant approved successfully",
  "data": {
    "status": "APPROVED",
    "approved_at": "2025-11-12T10:35:00.000Z",
    "user": {
      "email": "merchant.test@gmail.com"
    }
  }
}
```

**🎊 EMAIL SENT!**

**Server Console**:
```
[EmailService] ✅ Approval email sent to merchant.test@gmail.com
[EmailService] Email ID: <message-id@zoho.com>
```

---

### Step 7: 📬 Check Email Inbox

1. Open your email client
2. Go to inbox (or spam folder)
3. Look for email from "Courier Delivery Service"

**Email Details**:
- **Subject**: 🎉 Your Merchant Account Has Been Approved!
- **From**: Courier Delivery Service <md.nayem@shafacode.com>
- **To**: merchant.test@gmail.com

**Email Content Includes**:
- Congratulations message
- Merchant account details
- Approval timestamp
- Next steps
- Professional HTML design

---

## 🔄 Testing Again?

To create another merchant:

1. Go to Step 4 (Merchant Signup)
2. **Change these values**:
   ```json
   {
     "full_name": "New Merchant Name",
     "phone": "+8801711222444",  // ← Must be unique!
     "email": "another@gmail.com",
     ...
   }
   ```
3. Click `Send`
4. Go to Step 6 (Approve)
5. Click `Send`
6. Check email again!

---

## 📊 Collection Structure

```
Courier Delivery Backend API
│
├── 📁 Authentication
│   ├── ✅ Admin Login ← START HERE
│   ├── Merchant Login
│   ├── Refresh Token
│   └── Logout
│
├── 📁 Email Testing ← NEW!
│   ├── ✅ Verify Email Connection ← Test email setup
│   └── ✅ Send Test Email ← Send test to your inbox
│
├── 📁 Merchants
│   ├── ✅ Merchant Signup ← Create merchant
│   ├── Get All Merchants
│   ├── ✅ Get Pending Merchants ← View pending
│   ├── Get Approved Merchants
│   ├── Get Merchants by District
│   ├── Get Merchant by ID
│   ├── Update Merchant
│   └── ✅ Approve Merchant (Triggers Email!) ← SENDS EMAIL
│
├── 📁 Hubs (Future)
└── 📁 Riders (Future)
```

---

## ✅ Success Indicators

After completing all steps, you should have:

| Step | Success Indicator |
|------|------------------|
| 1. Admin Login | ✅ Token saved, console shows "Tokens saved" |
| 2. Verify Email | ✅ "success: true" in response |
| 3. Test Email | ✅ Email in your inbox within 30 seconds |
| 4. Create Merchant | ✅ Status 201, merchantId saved |
| 5. View Pending | ✅ See merchant in list with PENDING status |
| 6. Approve | ✅ Status 200, "APPROVED" in response |
| 7. Email Received | ✅ Professional approval email in inbox |

---

## 🐛 Troubleshooting

### Problem: "Unauthorized" error

**Solution**: 
1. Run "Admin Login" first (Step 1)
2. Check if token is saved in Variables tab
3. Retry the request

### Problem: Merchant ID not auto-saved

**Solution**:
1. Manually copy merchant ID from Step 4 response
2. Go to Collection Variables
3. Set `merchantId` manually
4. Continue to Step 6

### Problem: "Phone already exists"

**Solution**: Change the phone number in Step 4:
```json
{
  "phone": "+8801711222444"  // Different number
}
```

### Problem: Email not received

**Check**:
1. ✅ Did Step 4 include `"email"` field?
2. ✅ Is email valid?
3. ✅ Check spam folder
4. ✅ Server console shows email sent log?
5. ✅ Run "Verify Email Connection" (Step 2)

### Problem: STUB mode logs but no email

**Solution**: This is expected in development!
- Update `.env` with real Zoho credentials
- Restart server
- See `ZOHO_EMAIL_TESTING.md` for setup

---

## 🎯 Quick Test Checklist

- [ ] Server running (`npm run start:dev`)
- [ ] Postman collection imported
- [ ] Admin login successful
- [ ] Email connection verified (optional)
- [ ] Test email received (optional)
- [ ] Merchant created with email address
- [ ] Merchant approved successfully
- [ ] Approval email received in inbox
- [ ] Email has correct content and formatting

---

## 📚 Related Documentation

- **POSTMAN_EMAIL_TESTING.md** - This detailed guide (you are here!)
- **ZOHO_EMAIL_TESTING.md** - Zoho Mail setup and configuration
- **EMAIL_INTEGRATION_SUMMARY.md** - Implementation details
- **API_ENDPOINTS_DEMO.md** - Complete API reference

---

## 🎉 You're Done!

You've successfully tested the complete merchant email flow!

**What you tested**:
1. ✅ Admin authentication
2. ✅ Email service verification
3. ✅ Merchant registration
4. ✅ Admin approval workflow
5. ✅ Automated email notifications
6. ✅ Professional email templates

**Next Steps**:
- Test with real merchants
- Configure production Zoho credentials
- Implement Hubs and Riders modules
- Add more email templates (welcome, password reset, etc.)

---

## 💡 Pro Tips

1. **Use Postman Environments**: Create Dev, Staging, Production environments
2. **Save Collections**: Export and version control your collections
3. **Use Variables**: Leverage `{{merchantId}}` for dynamic IDs
4. **Check Console**: Enable Postman console to see auto-save logs
5. **Test STUB First**: Test flow in STUB mode before configuring email

---

Happy Testing! 🚀📧
