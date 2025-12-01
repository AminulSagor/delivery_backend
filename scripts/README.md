# 📊 Carrybee Locations Export Script

## 🎯 Purpose

This script exports all Carrybee locations (Cities, Zones, Areas) from your database into multiple formats that can be easily imported into Google Docs, Google Sheets, or shared with your team.

---

## 🚀 How to Run

### **Step 1: Make sure locations are synced**

First, ensure you have synced locations from Carrybee:

```bash
# Call the sync endpoint via Postman or curl
POST http://localhost:3000/carrybee-locations/sync
Authorization: Bearer <admin_token>
```

### **Step 2: Run the export script**

```bash
npm run export:locations
```

---

## 📁 Output Files

The script generates **4 different formats** in the root directory:

### **1. CSV File** (`carrybee-locations.csv`)
- **Best for:** Google Sheets, Excel
- **How to use:**
  1. Open Google Sheets
  2. File → Import
  3. Upload `carrybee-locations.csv`
  4. Select "Comma" as separator
  5. Click "Import data"

**Format:**
```csv
City,City ID,Zone,Zone ID,Area,Area ID
"Dhaka",1,"Gulshan",5,"Gulshan 1",23
"Dhaka",1,"Gulshan",5,"Gulshan 2",24
```

---

### **2. Markdown Table** (`carrybee-locations.md`)
- **Best for:** GitHub, GitLab, Notion, Markdown editors
- **How to use:**
  1. Open the `.md` file
  2. Copy the table
  3. Paste into your Markdown document

**Format:**
```markdown
| City | City ID | Zone | Zone ID | Area | Area ID |
|------|---------|------|---------|------|---------|
| Dhaka | 1 | Gulshan | 5 | Gulshan 1 | 23 |
| Dhaka | 1 | Gulshan | 5 | Gulshan 2 | 24 |
```

---

### **3. HTML Table** (`carrybee-locations.html`)
- **Best for:** Google Docs, Email, Web pages
- **How to use:**
  1. Open `carrybee-locations.html` in a web browser
  2. Select all (Ctrl+A / Cmd+A)
  3. Copy (Ctrl+C / Cmd+C)
  4. Paste into Google Docs (Ctrl+V / Cmd+V)
  5. The table will be formatted automatically!

**Features:**
- ✅ Styled table with alternating row colors
- ✅ Hover effects
- ✅ Header with green background
- ✅ Summary section with total records
- ✅ Numbered rows

---

### **4. JSON File** (`carrybee-locations.json`)
- **Best for:** Developers, API integration, data processing
- **How to use:** Import into your application or use for data analysis

**Format:**
```json
[
  {
    "city": "Dhaka",
    "cityId": 1,
    "zone": "Gulshan",
    "zoneId": 5,
    "area": "Gulshan 1",
    "areaId": 23
  },
  {
    "city": "Dhaka",
    "cityId": 1,
    "zone": "Gulshan",
    "zoneId": 5,
    "area": "Gulshan 2",
    "areaId": 24
  }
]
```

---

## 📋 Example Output

When you run the script, you'll see:

```
🚀 Starting Carrybee Locations Export...

📍 Found 8 cities

Processing: Dhaka (ID: 1)
  ├─ Zones: 12
  │  ├─ Gulshan (ID: 5) - 8 areas
  │  ├─ Dhanmondi (ID: 6) - 6 areas
  │  ├─ Banani (ID: 7) - 5 areas
  ...

Processing: Chittagong (ID: 2)
  ├─ Zones: 10
  │  ├─ Agrabad (ID: 15) - 7 areas
  ...

✅ Export Complete!
📊 Summary:
   - Cities: 8
   - Zones: 45
   - Areas: 523
   - Total Records: 523

✅ CSV exported: E:\ShafaCode\delivery_backend\carrybee-locations.csv
✅ Markdown exported: E:\ShafaCode\delivery_backend\carrybee-locations.md
✅ JSON exported: E:\ShafaCode\delivery_backend\carrybee-locations.json
✅ HTML exported: E:\ShafaCode\delivery_backend\carrybee-locations.html

🎉 All files generated successfully!

📁 Output files:
   - carrybee-locations.csv (Import to Google Sheets)
   - carrybee-locations.md (Markdown table)
   - carrybee-locations.json (JSON format)
   - carrybee-locations.html (HTML table for Google Docs)
```

---

## 🎨 Google Docs Import Guide

### **Method 1: HTML Import (Recommended)**

1. Run the script: `npm run export:locations`
2. Open `carrybee-locations.html` in Chrome/Firefox
3. Press `Ctrl+A` (Select All)
4. Press `Ctrl+C` (Copy)
5. Open Google Docs
6. Press `Ctrl+V` (Paste)
7. ✅ Done! Table is formatted and ready!

### **Method 2: Google Sheets → Google Docs**

1. Import CSV to Google Sheets (see CSV section above)
2. Select the table in Google Sheets
3. Copy (`Ctrl+C`)
4. Paste into Google Docs (`Ctrl+V`)
5. Format as needed

---

## 📊 Data Structure

Each row contains:

| Column | Description | Example |
|--------|-------------|---------|
| **City** | City name | Dhaka |
| **City ID** | Carrybee city ID | 1 |
| **Zone** | Zone/Thana name | Gulshan |
| **Zone ID** | Carrybee zone ID | 5 |
| **Area** | Area name | Gulshan 1 |
| **Area ID** | Carrybee area ID | 23 |

---

## 🔧 Troubleshooting

### **Error: "Cannot find module"**

**Solution:** Make sure you're in the project root directory:
```bash
cd e:\ShafaCode\delivery_backend
npm run export:locations
```

### **Error: "No locations found"**

**Solution:** Sync locations first:
```bash
# Via Postman
POST http://localhost:3000/carrybee-locations/sync
Authorization: Bearer <admin_token>
```

### **Error: "Database connection failed"**

**Solution:** Check your `.env` file and ensure database is running:
```bash
# Check if PostgreSQL is running
# Windows: Check Services
# Linux/Mac: sudo systemctl status postgresql
```

---

## 💡 Use Cases

### **1. Documentation**
Export to Google Docs for team reference

### **2. Frontend Development**
Use JSON file for dropdown options

### **3. Data Analysis**
Import CSV to Excel/Sheets for analysis

### **4. API Testing**
Use location IDs in Postman tests

### **5. Customer Support**
Share HTML table with support team

---

## 🎯 Tips

1. **Re-run anytime:** The script can be run multiple times safely
2. **Fresh data:** Run after syncing new locations from Carrybee
3. **Share easily:** HTML file is self-contained and can be emailed
4. **Version control:** Add output files to `.gitignore` if needed

---

## 📝 Notes

- The script reads from your **local database**, not directly from Carrybee API
- Make sure to sync locations first using the `/carrybee-locations/sync` endpoint
- Output files are generated in the project root directory
- Files are overwritten each time you run the script

---

## ✅ Success Checklist

- [ ] Locations synced from Carrybee
- [ ] Script executed successfully
- [ ] 4 output files generated
- [ ] Files opened and verified
- [ ] Data imported to Google Docs/Sheets
- [ ] Team has access to the data

---

## 🎉 Done!

You now have all Carrybee locations exported in multiple formats, ready to share with your team or import into Google Docs!

**Need help?** Check the console output for detailed progress and error messages.
