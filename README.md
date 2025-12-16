# QR Outdoor Navigation System

A mobile-friendly web application for navigating to office locations using QR codes, GPS tracking, and real-time routing.

## Features

- **QR Code Access**: Scan a QR code to instantly access the navigation interface
- **Office Search**: Search for offices with autocomplete functionality and "View All" button
- **Real-time GPS Tracking**: Your current position is continuously tracked and displayed on the map with accuracy indicator
- **Dynamic Route Updates**: Routes automatically update as you move (updates every 15+ meters)
- **Walking Directions**: Get optimized walking routes to any office location using OSRM routing
- **Browser-Specific Location Handling**: Smart prompts with detailed instructions for Safari, Chrome, Firefox, and Android browsers
- **Mobile Optimized**: Responsive design optimized for smartphone use with touch-friendly controls
- **Light Map Style**: Uses CartoDB Positron tiles for a clean, light grey map appearance ideal for outdoor navigation

## Setup Instructions

### 1. Update Office Locations

Edit `offices.json` with your actual office locations:

```json
{
  "buildingCenter": {
    "lat": YOUR_BUILDING_LATITUDE,
    "lng": YOUR_BUILDING_LONGITUDE,
    "name": "Your Building Name"
  },
  "offices": [
    {
      "name": "Suite 101",
      "lat": OFFICE_LATITUDE,
      "lng": OFFICE_LONGITUDE,
      "description": "Optional description"
    }
  ]
}
```

**How to get coordinates:**
1. Use Google Maps: Right-click on a location → Click coordinates → Copy lat/lng
2. Or use an online tool like [LatLong.net](https://www.latlong.net/)
3. Make sure to get coordinates for:
   - The building center (where to center the map)
   - Each office/unit location (where routes will navigate to)

### 2. Test Locally

Since the Geolocation API requires HTTPS, you have a few options:

**Option A: Use a local HTTPS server**
```bash
# Install a simple HTTPS server (if you have Python)
python -m http.server 8000 --bind localhost

# Or use Node.js http-server with HTTPS
npx http-server --ssl --cert cert.pem --key key.pem
```

**Option B: Test on a mobile device**
- Deploy to a free hosting service (see below)
- Access from your phone to test

### 3. Deploy

**GitHub Pages (Recommended - Free)**
1. Create a repository on GitHub
2. Upload all files to the repository
3. Go to Settings → Pages
4. Select your branch (main) and click Save
5. Your site will be at: `https://yourusername.github.io/repository-name/`
6. See `DEPLOYMENT.md` for detailed step-by-step instructions

**Other Options:**
- Any static hosting service that supports HTTPS
- GitHub Pages is recommended because it's free, provides HTTPS automatically, and makes updates easy

### 4. Generate QR Code

1. Get your deployed URL (e.g., `https://yourusername.github.io/repository-name/`)
2. Use a free QR code generator:
   - [QR Code Generator](https://www.qr-code-generator.com/)
   - [QRCode Monkey](https://www.qrcode-monkey.com/)
3. Enter your URL and generate the QR code
4. Print and place the QR code at building entrances

## File Structure

```
QRLocation/
├── index.html          # Main HTML file
├── styles.css          # Styles and mobile responsiveness
├── app.js              # Application logic
├── offices.json        # Office location data
├── README.md           # This file
├── DEPLOYMENT.md       # Deployment guide
└── qr-code-info.md     # QR code generation guide
```

## Technologies Used

- **Leaflet.js** (v1.9.4): Open-source mapping library
- **CartoDB Positron**: Light grey map tiles for better outdoor visibility
- **Leaflet Routing Machine** (v3.2.12): Route calculation using free OSRM service
- **OSRM Routing**: Walking route optimization via Project OSRM public API
- **Browser Geolocation API**: Real-time GPS tracking with high accuracy support
- **Vanilla JavaScript**: No framework dependencies - pure ES6+ JavaScript

## Customization

### Change Map Style
Edit the tile layer in `app.js` (currently using CartoDB Positron):
```javascript
// Current: Light grey CartoDB Positron
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(this.map);

// Alternative: Standard OpenStreetMap
// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     attribution: '&copy; OpenStreetMap contributors'
// }).addTo(this.map);
```

### Adjust Initial Zoom Level
In `app.js`, change the zoom level:
```javascript
this.map = L.map('map').setView([lat, lng], 18); // Change 18 to desired zoom
```

### Modify Route Line Color
In `app.js`, edit the `lineOptions`:
```javascript
lineOptions: {
    styles: [{
        color: '#4CAF50', // Change this color
        opacity: 0.8,
        weight: 5
    }]
}
```

## Troubleshooting

**Location not working:**
- Make sure you're using HTTPS (required for geolocation - GitHub Pages provides this automatically)
- Check browser permissions for location access
- **Safari/iOS**: The app provides detailed instructions - both website settings AND system settings must allow location
- Ensure GPS is enabled on your device
- Try refreshing the page after granting permissions
- Verify you're accessing the site via the HTTPS URL (GitHub Pages automatically provides HTTPS)

**Routes not calculating:**
- Check internet connection (routes use online OSRM service)
- Verify office coordinates are correct in `offices.json`
- Make sure you've selected an office and granted location permission
- Try refreshing the page

**Map not loading:**
- Check internet connection (needed for map tiles)
- Verify Leaflet CDN links are accessible
- Check browser console (F12) for errors

**Safari-specific issues:**
- Safari requires location permissions in TWO places (website settings AND system settings)
- The app shows detailed Safari instructions when needed
- Make sure "Precise Location" is enabled for better accuracy

## Future Enhancements

- Indoor navigation with floor plans
- Turn-by-turn voice directions
- Multiple building support
- Admin panel for managing offices
- Analytics to track usage

## License

This project is open source and free to use.

