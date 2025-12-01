# 🚀 Quick Guide: Export Carrybee Locations

## ⚡ TL;DR

```bash
# 1. Sync locations from Carrybee (one-time or when updated)
POST http://localhost:3000/carrybee-locations/sync
Authorization: Bearer <admin_token>

# 2. Export to files
npm run export:locations

# 3. Open carrybee-locations.html in browser
# 4. Copy all (Ctrl+A) and paste into Google Docs (Ctrl+V)
```

---

## 📁 What You Get

After running `npm run export:locations`, you'll have:

### **1. carrybee-locations.csv**
```csv
City,City ID,Zone,Zone ID,Area,Area ID
"Dhaka",1,"Gulshan",5,"Gulshan 1",23
"Dhaka",1,"Gulshan",5,"Gulshan 2",24
"Dhaka",1,"Dhanmondi",6,"Dhanmondi 15",30
```
**→ Import to Google Sheets**

---

### **2. carrybee-locations.html**
Beautiful styled table with:
- ✅ Green header
- ✅ Alternating row colors
- ✅ Hover effects
- ✅ Summary section

**→ Copy/paste to Google Docs**

---

### **3. carrybee-locations.md**
```markdown
| City | City ID | Zone | Zone ID | Area | Area ID |
|------|---------|------|---------|------|---------|
| Dhaka | 1 | Gulshan | 5 | Gulshan 1 | 23 |
```
**→ Use in GitHub/Notion**

---

### **4. carrybee-locations.json**
```json
[
  {
    "city": "Dhaka",
    "cityId": 1,
    "zone": "Gulshan",
    "zoneId": 5,
    "area": "Gulshan 1",
    "areaId": 23
  }
]
```
**→ Use in code/API**

---

## 🎯 Google Docs Import (Easiest Way)

### **Step-by-Step:**

1. **Run export:**
   ```bash
   npm run export:locations
   ```

2. **Open HTML file:**
   - Double-click `carrybee-locations.html`
   - Opens in your browser

3. **Copy table:**
   - Press `Ctrl+A` (Select All)
   - Press `Ctrl+C` (Copy)

4. **Paste to Google Docs:**
   - Open Google Docs
   - Press `Ctrl+V` (Paste)
   - ✅ Done! Formatted table appears!

---

## 📊 Google Sheets Import

### **Step-by-Step:**

1. **Run export:**
   ```bash
   npm run export:locations
   ```

2. **Open Google Sheets**

3. **Import CSV:**
   - File → Import
   - Upload → Select `carrybee-locations.csv`
   - Separator: Comma
   - Click "Import data"

4. **✅ Done!** Data appears in spreadsheet

---

## 🔄 When to Re-Export

Run the export script again when:

- ✅ New cities/zones/areas added to Carrybee
- ✅ Location names updated
- ✅ You need fresh data
- ✅ Sharing with new team members

**Remember:** Always sync from Carrybee first!

```bash
# 1. Sync (via Postman/API)
POST /carrybee-locations/sync

# 2. Export
npm run export:locations
```

---

## 📋 Sample Output

```
🚀 Starting Carrybee Locations Export...

📍 Found 8 cities

Processing: Dhaka (ID: 1)
  ├─ Zones: 12
  │  ├─ Gulshan (ID: 5) - 8 areas
  │  ├─ Dhanmondi (ID: 6) - 6 areas
  │  ├─ Banani (ID: 7) - 5 areas

Processing: Chittagong (ID: 2)
  ├─ Zones: 10
  │  ├─ Agrabad (ID: 15) - 7 areas

✅ Export Complete!
📊 Summary:
   - Cities: 8
   - Zones: 45
   - Areas: 523
   - Total Records: 523

🎉 All files generated successfully!
```

---

## 💡 Pro Tips

1. **HTML is best for Google Docs** - Preserves formatting
2. **CSV is best for Google Sheets** - Easy data manipulation
3. **JSON is best for developers** - Use in code
4. **Markdown is best for documentation** - GitHub, Notion, etc.

---

## ⚠️ Common Issues

### **"No locations found"**
**Fix:** Sync locations first via API endpoint

### **"Database connection failed"**
**Fix:** Check `.env` and ensure database is running

### **"Cannot find module"**
**Fix:** Run from project root: `cd e:\ShafaCode\delivery_backend`

---

## 🎉 That's It!

You now have all Carrybee locations exported and ready to use!

**Files location:** Project root directory  
**Command:** `npm run export:locations`  
**Time:** ~30 seconds for 500+ locations

---

## 📞 Need Help?

Check the detailed guide: `scripts/README.md`
