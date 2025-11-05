# Deployment Guide - GitHub Pages

## Why GitHub Pages?
- ✅ Automatic HTTPS (required for geolocation API)
- ✅ Free hosting with no credit card required
- ✅ Easy deployment through Git
- ✅ Fast CDN for quick loading
- ✅ Custom domain support (optional)
- ✅ Version control built-in

## Step-by-Step Instructions

### Step 1: Prepare Your Files
Make sure you have all these files ready:
- ✅ `index.html`
- ✅ `styles.css`
- ✅ `app.js`
- ✅ `offices.json`
- ✅ `README.md` (optional)
- ✅ `qr-code-info.md` (optional)
- ✅ `DEPLOYMENT.md` (optional)

**Important Notes:**
- Make sure your `offices.json` file has the correct coordinates
- GitHub Pages automatically provides HTTPS, which is required for geolocation to work
- The `_headers` file is not needed for GitHub Pages (it's Netlify-specific)

### Step 2: Create GitHub Account
1. Go to [github.com](https://github.com)
2. Click **"Sign up"** in the top right
3. Create an account with:
   - Email
   - Username
   - Password
4. Verify your email address if prompted

### Step 3: Create New Repository
1. After signing in, click the **"+"** icon in the top right
2. Select **"New repository"**
3. Name your repository (e.g., "qr-navigation" or "willowbrook-navigation")
4. Set it to **Public** (required for free GitHub Pages)
5. **DO NOT** initialize with README, .gitignore, or license (since you already have files)
6. Click **"Create repository"**

### Step 4: Upload Your Files

**Option A: Using GitHub Web Interface (Easiest)**
1. On your new repository page, click **"uploading an existing file"**
2. Drag and drop all your project files:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `offices.json`
   - `README.md` (if you want it)
   - `qr-code-info.md` (if you want it)
   - `DEPLOYMENT.md` (if you want it)
3. Scroll down to the bottom
4. Enter a commit message (e.g., "Initial deployment")
5. Click **"Commit changes"**

**Option B: Using Git Command Line**
If you have Git installed:
```bash
cd C:\Users\baude\OneDrive\Documents\Cursor\QRLocation
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### Step 5: Enable GitHub Pages
1. Go to your repository page on GitHub
2. Click the **"Settings"** tab (top menu)
3. Scroll down to the **"Pages"** section (in the left sidebar)
4. Under **"Source"**, select **"Deploy from a branch"**
5. Select **"main"** branch
6. Select **"/ (root)"** folder
7. Click **"Save"**
8. Wait a few minutes for GitHub Pages to build your site

### Step 6: Get Your Site URL
After GitHub Pages is enabled, your site will be available at:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

For example:
```
https://yourusername.github.io/qr-navigation/
```

**Note**: It may take 1-5 minutes for the site to be available after enabling Pages.

### Step 7: Test Your Site
1. Visit your GitHub Pages URL
2. The site should load with the map
3. Allow location permissions when prompted
4. Try searching for an office
5. Test the navigation functionality

### Step 8: Generate QR Code
1. Copy your GitHub Pages URL (e.g., `https://yourusername.github.io/qr-navigation/`)
2. Go to a QR code generator: [qr-code-generator.com](https://www.qr-code-generator.com/)
3. Select "URL" type
4. Paste your GitHub Pages URL
5. Generate and download the QR code
6. Print and place at building entrances!

## Updating Your Site Later

If you need to update `offices.json` or make changes:

**Method 1: GitHub Web Interface**
1. Go to your repository on GitHub
2. Click on the file you want to edit (e.g., `offices.json`)
3. Click the **"pencil icon"** (Edit) button
4. Make your changes
5. Scroll down and click **"Commit changes"**
6. GitHub Pages will automatically rebuild your site (usually within 1-2 minutes)

**Method 2: Using Git Command Line**
```bash
cd C:\Users\baude\OneDrive\Documents\Cursor\QRLocation
git add .
git commit -m "Update offices.json"
git push
```

**Note**: GitHub Pages automatically rebuilds when you push changes. Wait 1-2 minutes for updates to go live.

## Troubleshooting

**Site not loading?**
- Wait a few minutes - GitHub Pages can take 1-5 minutes to build initially
- Check that all files were uploaded correctly
- Verify `index.html` is in the root directory
- Check the repository's "Actions" tab for build errors

**Geolocation not working?**
- Make sure you're accessing via HTTPS (GitHub Pages provides this automatically)
- Check browser permissions (the app provides browser-specific instructions)
- **Safari/iOS users**: Requires permissions in TWO places - website settings AND system settings (app shows detailed instructions)
- Test on a mobile device (GPS works better outdoors)
- Try refreshing the page after granting permissions
- Verify you're accessing the site via the `.github.io` HTTPS URL, not HTTP

**Map not showing?**
- Check internet connection (needs connection for map tiles)
- Open browser console (F12) to check for errors
- Verify Leaflet CDN links are accessible

**Repository name changed?**
- If you rename your repository, your GitHub Pages URL will change
- You'll need to update your QR codes if you change the repository name

## Custom Domain (Optional)

If you want to use your own domain:

1. Go to repository **Settings** → **Pages**
2. Under **"Custom domain"**, enter your domain
3. Configure DNS records:
   - Add a CNAME record pointing to `YOUR_USERNAME.github.io`
   - Or add A records pointing to GitHub's IP addresses
4. GitHub will automatically provision SSL certificate

## Advantages of GitHub Pages

- ✅ Free forever
- ✅ Automatic HTTPS
- ✅ Version control built-in
- ✅ Easy updates through Git
- ✅ No file size limits for static sites
- ✅ Fast global CDN

## Recommendation

**GitHub Pages is perfect for this app** - It provides free HTTPS hosting, automatic deployments, and works seamlessly with geolocation APIs. The web interface makes it easy to update `offices.json` without needing Git knowledge.
