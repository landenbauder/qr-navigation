# QR Outdoor Navigation System

A mobile-friendly web application for navigating to office locations using QR codes, GPS tracking, and real-time routing.

## Features

- **QR Code Access**: Scan a QR code to instantly access the navigation interface
- **Office Search**: Search for offices with autocomplete functionality
- **Real-time GPS Tracking**: Your current position is tracked and displayed on the map
- **Walking Directions**: Get optimized walking routes to any office location
- **Mobile Optimized**: Responsive design that works great on smartphones

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

You can deploy this to any static hosting service:

**GitHub Pages (Free)**
1. Create a repository on GitHub
2. Upload all files
3. Go to Settings → Pages
4. Select your branch and click Save
5. Your site will be at: `https://yourusername.github.io/repository-name/`

**Netlify (Free)**
1. Go to [netlify.com](https://www.netlify.com)
2. Drag and drop the project folder
3. Your site will be live instantly with HTTPS

**Other Options:**
- Vercel
- GitHub Pages
- Any web hosting service

### 4. Generate QR Code

1. Get your deployed URL (e.g., `https://yourdomain.com` or `https://yoursite.netlify.app`)
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
└── qr-code-info.md     # QR code generation guide
```

## Technologies Used

- **Leaflet.js**: Open-source mapping library
- **OpenStreetMap**: Free map tiles
- **Leaflet Routing Machine**: Route calculation (uses free OSRM service)
- **Browser Geolocation API**: GPS tracking
- **Vanilla JavaScript**: No framework dependencies

## Customization

### Change Map Style
Edit the tile layer in `app.js`:
```javascript
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    // Options here
})
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
- Make sure you're using HTTPS (required for geolocation)
- Check browser permissions for location access
- Ensure GPS is enabled on your device

**Routes not calculating:**
- Check internet connection (routes use online service)
- Verify office coordinates are correct
- Try refreshing the page

**Map not loading:**
- Check internet connection (needed for map tiles)
- Verify Leaflet CDN links are accessible

## Future Enhancements

- Indoor navigation with floor plans
- Turn-by-turn voice directions
- Multiple building support
- Admin panel for managing offices
- Analytics to track usage

## License

This project is open source and free to use.

