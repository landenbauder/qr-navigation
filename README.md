# QR Outdoor Navigation System

A mobile-friendly web application for navigating to office locations using QR codes, GPS tracking, and real-time routing.

## Features

- **QR Code Access**: Scan a QR code to instantly access the navigation interface
- **Office Search**: Search for offices with autocomplete functionality and "View All" button
- **Real-time GPS Tracking**: Your current position is continuously tracked and displayed on the map with accuracy indicator
- **Dynamic Route Updates**: Routes automatically update as you move (updates every 15+ meters)
- **Walking Directions**: Get optimized walking routes directly to the selected office entrance using OSRM routing
- **Split-Screen 360 Preview**: Open Street View in the top half of the screen with an interactive context map in the bottom half showing the camera location, viewing direction, and front door target
- **Office Boundary Tracing Tools**: Trace each office footprint point by point, snap the closing point back to the start, save progress locally, and export the collected polygons as JSON
- **Navigation Boundary Overlay**: When navigation starts, the map can show faint office outlines above the basemap and below the office icons, with the selected destination slightly more visible
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

If `office-boundaries.json` is present, the app also merges those saved office-center coordinates, entrance coordinates, and footprint polygons at runtime. That file is the intended place to apply tracing/export updates without manually rewriting the generated `offices.json` structure.

If you make more edits in the tracer later, export the JSON again and replace `office-boundaries.json` with the new file contents. The app reads that file at runtime, so the latest saved export becomes the live override for office centers, entrances, and polygons.

**How to get coordinates:**
1. Use Google Maps: Right-click on a location → Click coordinates → Copy lat/lng
2. Or use an online tool like [LatLong.net](https://www.latlong.net/)
3. Make sure to get coordinates for:
   - The building center (where to center the map)
   - Each office/unit location (where routes will navigate to)

### 2. Configure Google Maps key (for 360° view)

The app now reads the Google Maps key from `app-config.js` instead of hardcoding it in `index.html`.

1. Open `app-config.js`
2. Set:
```javascript
window.APP_CONFIG = {
  GOOGLE_MAPS_API_KEY: "YOUR_RESTRICTED_GOOGLE_MAPS_KEY",
  ENABLE_LOCAL_TEST_MODE: false
};
```
3. In Google Cloud Console, restrict this key by:
   - API restrictions: Maps JavaScript API only
   - Application restrictions: HTTP referrers for your domain(s)

If this key is empty, core navigation still works and only 360° Street View is disabled. The Street View map markers will still appear for offices with panorama data, but opening them will show the unavailable message until a valid key is configured.

### 3. Test Locally

For local development, `localhost` is enough. You do not need to push to GitHub Pages just to see content updates, and modern browsers treat `localhost` as a secure context for geolocation testing.

**Fastest local loop in VS Code**
1. Open the Command Palette.
2. Run `Tasks: Run Task`.
3. Choose `Serve QR Navigation Locally`.
4. Your browser will open to `http://127.0.0.1:4173/`.
5. For phone testing on the same Wi-Fi network, use the `LAN URL` printed in the terminal instead of `127.0.0.1`.
6. Make edits, then refresh the page to see the updated files.
7. Stop the server with `Ctrl+C` in the task terminal.

**Manual local server**
```powershell
./serve-local.ps1 -OpenBrowser
```

Optional custom port:
```powershell
./serve-local.ps1 -Port 8000 -OpenBrowser
```

**Important notes for local testing**
- Local edits show up after a normal browser refresh because the app reads files directly from your workspace through the local server.
- GitHub Pages will not reflect changes until you commit and push.
- Testing on `127.0.0.1` or `localhost` is ideal for quick data checks, search behavior, and route rendering.
- `127.0.0.1` on your phone points back to the phone itself. For mobile testing, open the PC's `LAN URL` from the terminal, such as `http://10.0.0.150:4173/`.
- If you want to test the exact public deployment, push to `main` and then open the GitHub Pages URL.

**Developer-only localhost testing**
- Opening the app on `127.0.0.1` or `localhost` now shows the normal production search flow by default.
- To enable local testing tools in VS Code, set `ENABLE_LOCAL_TEST_MODE: true` in `app-config.js`, then refresh the page.
- You can also use the small lock button and enter PIN `9719` to enable developer mode at runtime. On small screens it moves to the bottom-right corner so it stays clear of the search UI.
- When that flag is on, the app starts in testing mode, shows the testing toolbar, and exposes the office tracing panel.
- While testing mode is active, use the target button in the testing toolbar to arm map placement, then tap any point on the map to move the user marker and recalculate the route.
- Set `ENABLE_LOCAL_TEST_MODE: false` again before publishing.

**Street View access**
- After selecting an office, the map shows all saved Street View points as camera icons.
- Tap any camera icon to open that exact Street View location.
- The bottom legend `Press for Street View` indicates those camera markers are interactive.

**Office boundary tracing**
- Open the map first, then use the `Trace Offices` panel in the lower-left corner.
- The tracer starts on the first office without a saved shape.
- Entering trace mode shows the current office center as a black dot and the current entrance coordinate as an orange dot.
- Click each corner in sequence around the office perimeter.
- Press `Z` to toggle axis snap on or off while tracing.
- Use `Set Office Dot` and `Set Entrance Dot`, then click the map to update those coordinates for the current office.
- Use `Save & Next` to store that office polygon in browser local storage and automatically advance to the next office. The app closes the polygon for you when it saves.
- If every office already has a saved polygon, `Save & Next` and `Skip` still continue through the office list so you can do a full review/edit pass.
- Saved traces persist across refreshes in the same browser on the same device unless you clear browser storage or the trace storage version is intentionally reset in code.
- Use `Download JSON` at any time to export the collected trace data into a file you can merge back into your office data.
- The downloaded file contains one entry per office with the saved office center, entrance coordinate, and either a saved `polygon` array or `null` if that office border has not been traced yet.

**Trace map controls**
- Use `Rotate -1°`, `Rotate +1°`, and `Reset Rotation` to rotate the Leaflet map degree by degree while tracing.

**Navigation office outlines**
- After you select an office and navigation starts, the app draws only that office's saved polygon as a faint overlay above the map tiles and below the office icons.

### 4. Deploy

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

### 5. Generate QR Code

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
├── app-config.js       # Runtime config (Google Maps key)
├── app-config.example.js # Example config template
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
The app now includes a built-in toggle between the default animated map and a real-world aerial view. If you still want to change the underlying default tiles in code, edit the tile layer configuration in `app.js`:
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

**360° Street View not opening:**
- Check `app-config.js` and confirm `GOOGLE_MAPS_API_KEY` is set to a valid Google Maps JavaScript API key
- In Google Cloud Console, make sure the key allows the Maps JavaScript API and your current site referrer
- If you see `360° Street View needs a Google Maps API key. Set GOOGLE_MAPS_API_KEY in app-config.js.`, the key is missing or blank rather than the office panorama coordinates being the first problem

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

