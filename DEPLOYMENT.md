# Deployment Guide - Netlify (Recommended)

## Why Netlify?
- ✅ Automatic HTTPS (required for geolocation API)
- ✅ Drag-and-drop deployment (super easy)
- ✅ Free tier with no credit card required
- ✅ Fast CDN for quick loading
- ✅ Custom domain support (optional)

## Step-by-Step Instructions

### Step 1: Prepare Your Files
Make sure you have all these files ready:
- ✅ `index.html`
- ✅ `styles.css`
- ✅ `app.js`
- ✅ `offices.json`
- ✅ `README.md` (optional)
- ✅ `qr-code-info.md` (optional)

**Important**: Make sure your `offices.json` file has the correct coordinates (I can see you've already updated it!).

### Step 2: Create Netlify Account
1. Go to [netlify.com](https://www.netlify.com)
2. Click **"Sign up"** in the top right
3. You can sign up with:
   - Email (requires email verification)
   - GitHub account (easiest if you have one)
   - Google account
4. No credit card required!

### Step 3: Deploy Your Site

**Option A: Drag and Drop (Easiest)**
1. After signing in, you'll see the Netlify dashboard
2. Look for a box that says **"Want to deploy a new site without connecting to Git? Drag and drop your site output folder here"**
3. Open File Explorer (Windows) and navigate to your project folder:
   ```
   C:\Users\baude\OneDrive\Documents\Cursor\QRLocation
   ```
4. Select ALL files in the folder:
   - Hold `Ctrl` and click each file, OR
   - Press `Ctrl+A` to select all
5. Drag the selected files and drop them onto the Netlify box
6. Wait 10-30 seconds for deployment to complete
7. You'll see a success message with your site URL!

**Option B: Manual Upload**
1. In Netlify dashboard, click **"Add new site"** → **"Deploy manually"**
2. Click **"Browse to upload"**
3. Create a ZIP file of your project:
   - Right-click your `QRLocation` folder
   - Select "Send to" → "Compressed (zipped) folder"
4. Upload the ZIP file
5. Netlify will automatically extract and deploy

### Step 4: Get Your Site URL
After deployment, Netlify will give you a URL like:
```
https://random-name-123456.netlify.app
```
Or you can click **"Site settings"** → **"Change site name"** to customize it to something like:
```
https://willowbrook-navigation.netlify.app
```

### Step 5: Test Your Site
1. Click on your site URL (or the "Open production deploy" button)
2. The site should load with the map
3. Allow location permissions when prompted
4. Try searching for an office
5. Test the navigation functionality

### Step 6: Generate QR Code
1. Copy your Netlify URL (e.g., `https://willowbrook-navigation.netlify.app`)
2. Go to a QR code generator: [qr-code-generator.com](https://www.qr-code-generator.com/)
3. Select "URL" type
4. Paste your Netlify URL
5. Generate and download the QR code
6. Print and place at building entrances!

## Updating Your Site Later

If you need to update `offices.json` or make changes:

**Method 1: Drag and Drop Again**
- Simply drag and drop the updated files to the same Netlify deployment box
- Netlify will automatically update your site

**Method 2: Site Settings**
1. Go to your site in Netlify dashboard
2. Go to **"Deploys"** tab
3. Find the deploy box and drag new files there

## Troubleshooting

**Site not loading?**
- Wait a minute and refresh
- Check that all files were uploaded
- Verify `index.html` is in the root

**Geolocation not working?**
- Make sure you're accessing via HTTPS (Netlify provides this automatically)
- Check browser permissions
- Test on a mobile device (GPS works better outdoors)

**Map not showing?**
- Check internet connection (needs connection for map tiles)
- Open browser console (F12) to check for errors

## Alternative: GitHub Pages

If you prefer GitHub Pages instead:

1. **Create GitHub Account** (if you don't have one)
   - Go to [github.com](https://github.com) and sign up

2. **Create New Repository**
   - Click "+" → "New repository"
   - Name it (e.g., "qr-navigation")
   - Make it public
   - Don't initialize with README
   - Click "Create repository"

3. **Upload Files**
   - On the repository page, click "uploading an existing file"
   - Drag and drop all your files
   - Scroll down and click "Commit changes"

4. **Enable GitHub Pages**
   - Go to repository Settings
   - Scroll to "Pages" section
   - Under "Source", select "main" branch
   - Click "Save"
   - Your site will be at: `https://yourusername.github.io/qr-navigation`

**Note**: GitHub Pages is free but requires a GitHub account. Netlify is faster to set up for this use case.

## Recommendation

**Use Netlify** - It's the fastest and easiest option for your needs. The drag-and-drop deployment makes it perfect for a static site like this.

