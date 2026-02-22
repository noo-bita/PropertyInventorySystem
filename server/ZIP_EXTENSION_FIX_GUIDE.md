# Fix: ZipArchive Extension Not Found - Complete Guide

## Problem
The DOCX download fails with error: `Class "ZipArchive" not found`

## Root Cause
The PHP `zip` extension is not loaded in Apache's PHP configuration. This is required by PhpWord to create DOCX files.

## Quick Diagnosis

### Step 1: Check if ZipArchive is loaded in Apache's PHP

Visit this URL in your browser:
```
http://127.0.0.1:8000/check-zip.php
```

This will show you:
- Whether ZipArchive is loaded
- Which php.ini file Apache is using
- PHP version

### Step 2: Check Full PHP Configuration

Visit:
```
http://127.0.0.1:8000/phpinfo.php
```

This shows:
- All loaded extensions
- PHP configuration files
- Full phpinfo() if needed

## Solution

### Option A: Enable Zip Extension in php.ini (Recommended)

1. **Find the correct php.ini file:**
   - Check `http://127.0.0.1:8000/phpinfo.php` to see which php.ini Apache uses
   - Usually: `C:\xampp\php\php.ini`

2. **Edit php.ini:**
   - Open `C:\xampp\php\php.ini` in a text editor (as Administrator)
   - Search for: `;extension=zip`
   - Remove the semicolon: `extension=zip`
   - Save the file

3. **Restart Apache:**
   - Open XAMPP Control Panel
   - **Stop** Apache
   - **Start** Apache again
   - ⚠️ **IMPORTANT:** Just stopping and starting may not be enough. Try:
     - Stop Apache
     - Wait 5 seconds
     - Start Apache
     - Or restart XAMPP completely

4. **Verify:**
   - Visit `http://127.0.0.1:8000/check-zip.php`
   - Should show: `"zip_extension_loaded": true`

### Option B: Check if Apache uses a different php.ini

Sometimes Apache uses a different php.ini than the CLI:

1. Check `http://127.0.0.1:8000/phpinfo.php`
2. Look for "Loaded Configuration File"
3. Edit THAT file (not the CLI one)
4. Enable `extension=zip` in that file
5. Restart Apache

## Verification Steps

After enabling and restarting:

1. **Check extension:**
   ```bash
   # Visit in browser:
   http://127.0.0.1:8000/check-zip.php
   ```

2. **Test DOCX download:**
   - Go to Reports page
   - Generate a report
   - Click "Download as DOCX"
   - Should download successfully

3. **Check Laravel logs:**
   - Should see: `DOCX file generated successfully`
   - No more "ZipArchive not found" errors

## Common Issues

### Issue 1: Extension enabled but still not working
- **Cause:** Apache not restarted
- **Fix:** Fully restart Apache (stop, wait, start)

### Issue 2: CLI shows enabled but Apache doesn't
- **Cause:** Apache uses different php.ini
- **Fix:** Check `phpinfo.php` and edit the correct file

### Issue 3: Multiple php.ini files
- **Cause:** XAMPP may have multiple PHP versions
- **Fix:** Ensure you're editing the one Apache uses (check phpinfo.php)

## After Fixing

Once ZipArchive is enabled:
- ✅ DOCX downloads will work
- ✅ No more "Class ZipArchive not found" errors
- ✅ Reports can be generated and downloaded

## Security Note

**Delete diagnostic files after fixing:**
- `server/public/phpinfo.php`
- `server/public/check-zip.php`

These files expose PHP configuration and should not be left in production.

