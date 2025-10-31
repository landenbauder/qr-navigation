# QR Code Generation Guide

This guide will help you create QR codes that link to your navigation app.

## Step 1: Deploy Your App

Before creating a QR code, you need to deploy your navigation app to a public URL. See `README.md` for deployment options.

Examples of deployed URLs:
- `https://yourusername.github.io/qr-navigation/`
- `https://your-building-navigation.netlify.app/`
- `https://navigation.yourbuilding.com/`

## Step 2: Generate QR Code

### Option A: Online QR Code Generators (Free)

**Recommended Services:**

1. **QR Code Generator** (https://www.qr-code-generator.com/)
   - Select "URL" as the type
   - Paste your deployed URL
   - Click "Generate"
   - Download as PNG or SVG
   - Free option is available

2. **QRCode Monkey** (https://www.qrcode-monkey.com/)
   - Select "Website URL"
   - Enter your URL
   - Customize design (optional)
   - Download

3. **QRCode.space** (https://www.qrcode.space/)
   - Simple and free
   - No account required

### Option B: Using Command Line (For Developers)

If you have Node.js installed:
```bash
npm install -g qrcode
qrcode "https://your-deployed-url.com" -o qr-code.png
```

### Option C: Using Python

```python
import qrcode
img = qrcode.make('https://your-deployed-url.com')
img.save('qr-code.png')
```

## Step 3: Print and Place QR Codes

### Best Practices:

1. **Size**: QR codes should be at least 2x2 inches (5x5 cm) for easy scanning
2. **Placement**: 
   - Building entrances
   - Parking lot entrances
   - Reception desks
   - Main lobby areas
3. **Height**: Place at eye level (approximately 5-6 feet)
4. **Lighting**: Ensure good lighting for easy scanning
5. **Protection**: Use weatherproof materials if placing outdoors

### Printing Options:

- **Signage**: Have QR codes printed on professional signs
- **Stickers**: Use weatherproof stickers for doors/windows
- **Posters**: Include in building directory posters
- **Table Tents**: Place on reception desks

## Step 4: Test Your QR Code

Before placing QR codes:
1. Generate the QR code
2. Test scan with your phone's camera
3. Verify it opens the correct URL
4. Test the navigation functionality
5. Make sure it works on both iOS and Android

## QR Code Design Tips

While functionality is most important, you can customize:

1. **Colors**: Use your building/brand colors (but ensure high contrast)
2. **Logo**: Add a small logo in the center (don't cover too much of the code)
3. **Frame**: Add a border or frame with building name
4. **Instructions**: Add text like "Scan for Navigation" near the code

## Troubleshooting

**QR code won't scan:**
- Make sure the code is large enough
- Check for damage or smudges
- Ensure good lighting
- Try generating a new code with error correction set to "High"

**Wrong URL:**
- Double-check the URL when generating
- Update the QR code if you change your deployment URL

**Low scanning success rate:**
- Increase QR code size
- Improve lighting conditions
- Use high-contrast colors (black on white is best)
- Ensure the code is flat and not curved

## Mobile Testing

Test with multiple devices:
- iPhone (iOS)
- Android phones
- Different camera apps (built-in camera, QR code apps)
- Different lighting conditions

## Maintenance

- **Update if URL changes**: If you change your deployment URL, you'll need to regenerate QR codes
- **Check periodically**: Verify QR codes still work after building renovations or changes
- **Backup copies**: Keep digital copies of your QR code designs for easy reprinting

## Alternative: Short URLs

For easier QR codes and URL management:
1. Use a URL shortener (like bit.ly or TinyURL)
2. Generate QR code from the short URL
3. If you need to change your deployment, just update the redirect

Example:
- Short URL: `bit.ly/building-nav`
- QR code points to short URL
- Short URL redirects to your actual navigation app
- Easier to update without reprinting QR codes

