// Office Navigation Application
class NavigationApp {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.routingControl = null;
        this.offices = [];
        this.currentRoute = null;
        this.watchId = null;
        this.selectedOffice = null;
        
        // Default building location (will be updated from offices.json)
        this.buildingCenter = {
            lat: 34.0522,
            lng: -118.2437
        };
        
        this.init();
    }

    async init() {
        try {
            // Load office data
            await this.loadOffices();
            
            // Initialize map
            this.initMap();
            
            // Set up search functionality
            this.setupSearch();
            
            // Request location permission and start tracking
            this.requestLocation();
            
            // Set up clear route button
            document.getElementById('clearRoute').addEventListener('click', () => this.clearRoute());
        } catch (error) {
            console.error('Initialization error:', error);
            this.showStatus('Error loading navigation. Please refresh the page.');
        }
    }

    async loadOffices() {
        try {
            const response = await fetch('offices.json');
            const data = await response.json();
            this.offices = data.offices;
            
            // Set building center from first office or use provided center
            if (data.buildingCenter) {
                this.buildingCenter = data.buildingCenter;
            } else if (this.offices.length > 0) {
                this.buildingCenter = {
                    lat: this.offices[0].lat,
                    lng: this.offices[0].lng
                };
            }
        } catch (error) {
            console.error('Error loading offices:', error);
            this.showStatus('Error loading office locations.');
            // Use default empty data
            this.offices = [];
        }
    }

    initMap() {
        // Initialize Leaflet map
        this.map = L.map('map').setView([this.buildingCenter.lat, this.buildingCenter.lng], 18);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add office markers
        this.addOfficeMarkers();
    }

    addOfficeMarkers() {
        this.offices.forEach(office => {
            const marker = L.marker([office.lat, office.lng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                    shadowSize: [41, 41]
                })
            }).addTo(this.map);

            const popupContent = `<strong>${office.name}</strong>${office.description ? `<br>${office.description}` : ''}`;
            marker.bindPopup(popupContent);
        });
    }

    setupSearch() {
        const searchInput = document.getElementById('officeSearch');
        const searchResults = document.getElementById('searchResults');

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query.length === 0) {
                searchResults.classList.remove('active');
                return;
            }

            const filtered = this.offices.filter(office => 
                office.name.toLowerCase().includes(query) ||
                (office.description && office.description.toLowerCase().includes(query))
            );

            this.displaySearchResults(filtered);
        });

        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length > 0) {
                const query = searchInput.value.toLowerCase().trim();
                const filtered = this.offices.filter(office => 
                    office.name.toLowerCase().includes(query) ||
                    (office.description && office.description.toLowerCase().includes(query))
                );
                this.displaySearchResults(filtered);
            }
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.remove('active');
            }
        });
    }

    displaySearchResults(results) {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '';

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item" style="color: #999; cursor: default;">No offices found</div>';
        } else {
            results.forEach(office => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div class="search-result-name">${office.name}</div>
                    ${office.description ? `<div class="search-result-description">${office.description}</div>` : ''}
                `;
                item.addEventListener('click', () => {
                    this.selectOffice(office);
                    document.getElementById('officeSearch').value = office.name;
                    searchResults.classList.remove('active');
                });
                searchResults.appendChild(item);
            });
        }

        searchResults.classList.add('active');
    }

    selectOffice(office) {
        this.selectedOffice = office;
        document.getElementById('clearRoute').style.display = 'block';
        
        if (this.userMarker) {
            const userPos = this.userMarker.getLatLng();
            this.calculateRoute(userPos, [office.lat, office.lng], office.name);
        } else {
            this.showStatus('Waiting for your location... Please allow location access.');
            // Wait a moment for location, then try again
            setTimeout(() => {
                if (this.userMarker) {
                    const userPos = this.userMarker.getLatLng();
                    this.calculateRoute(userPos, [office.lat, office.lng], office.name);
                } else {
                    this.showStatus('Unable to get your location. Please enable location services.');
                }
            }, 2000);
        }
    }

    calculateRoute(start, end, destinationName) {
        // Clear existing route
        if (this.routingControl) {
            this.map.removeControl(this.routingControl);
        }

        // Create new route
        this.routingControl = L.Routing.control({
            waypoints: [
                L.latLng(start.lat, start.lng),
                L.latLng(end[0], end[1])
            ],
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: 'foot' // Walking profile
            }),
            routeWhileDragging: false,
            showAlternatives: false,
            addWaypoints: false,
            lineOptions: {
                styles: [
                    {
                        color: '#4CAF50',
                        opacity: 0.8,
                        weight: 5
                    }
                ]
            },
            createMarker: function() { return null; } // Don't create default markers
        }).addTo(this.map);

        this.routingControl.on('routesfound', (e) => {
            const route = e.routes[0];
            const distance = (route.summary.totalDistance / 1000).toFixed(2);
            const duration = Math.round(route.summary.totalTime / 60);
            
            this.showStatus(`Route to ${destinationName}: ${distance} km, ~${duration} min walk`);
            
            // Fit map to show entire route
            const bounds = L.latLngBounds(
                route.coordinates.map(coord => [coord.lat, coord.lng])
            );
            this.map.fitBounds(bounds, { padding: [50, 50] });
        });

        this.routingControl.on('routingerror', (error) => {
            console.error('Routing error:', error);
            this.showStatus('Unable to calculate route. Please try again.');
        });
    }

    requestLocation() {
        if (!navigator.geolocation) {
            this.showLocationInstructions('Geolocation is not supported by your browser. Please use a modern browser.');
            return;
        }

        // Check protocol (warn but don't block - let browser handle it)
        const protocol = window.location.protocol;
        const isSecure = protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (!isSecure) {
            console.warn('Site is not using HTTPS. Geolocation may not work.');
            this.showStatus('Warning: HTTPS required for location access. Protocol: ' + protocol);
        } else {
            console.log('Protocol check passed:', protocol);
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 20000, // Increased timeout for mobile GPS
            maximumAge: 30000 // Allow cached position for 30 seconds
        };

        // Show initial message
        this.showStatus('Requesting location access...');

        // Get initial position
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.hideLocationInstructions();
                this.updateUserLocation(position);
                this.showStatus('Location found! You can now search for offices.');
            },
            (error) => {
                console.error('Geolocation error:', error.code, error.message);
                this.handleLocationError(error);
            },
            options
        );

        // Watch position for updates
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.hideLocationInstructions();
                this.updateUserLocation(position);
            },
            (error) => {
                console.error('Geolocation watch error:', error.code, error.message);
                // Don't show error repeatedly if user denied
                if (error.code !== error.PERMISSION_DENIED) {
                    this.handleLocationError(error);
                }
            },
            options
        );
    }

    updateUserLocation(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        if (!this.userMarker) {
            // Create user marker
            this.userMarker = L.marker([lat, lng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                    shadowSize: [41, 41]
                })
            }).addTo(this.map);
            
            // Center map on user initially
            this.map.setView([lat, lng], 18);
        } else {
            // Update existing marker position
            this.userMarker.setLatLng([lat, lng]);
        }

        // Add accuracy circle (optional visual indicator)
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }
        
        this.accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            fillColor: '#4CAF50',
            fillOpacity: 0.1,
            color: '#4CAF50',
            weight: 1,
            opacity: 0.3
        }).addTo(this.map);

        // Update route if one is active
        if (this.routingControl && this.selectedOffice) {
            const userPos = { lat, lng };
            this.calculateRoute(userPos, [this.selectedOffice.lat, this.selectedOffice.lng], this.selectedOffice.name);
        }
    }

    handleLocationError(error) {
        let message = '';
        let instructions = '';
        const protocol = window.location.protocol;
        const url = window.location.href;
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location permission denied';
                instructions = this.getMobileLocationInstructions();
                
                // Add diagnostic info
                console.log('Permission denied. URL:', url);
                console.log('Protocol:', protocol);
                console.log('User agent:', navigator.userAgent);
                
                // Add specific iOS Safari troubleshooting
                if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                    instructions += '<br><br><strong>iOS Safari Tips:</strong><br>';
                    instructions += '• Make sure you\'re accessing via HTTPS (Netlify sites should auto-redirect)<br>';
                    instructions += '• Try closing Safari completely and reopening<br>';
                    instructions += '• Settings → Privacy & Security → Location Services → ON<br>';
                    instructions += '• Settings → Safari → Location Services → ON';
                }
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location unavailable. Make sure GPS is enabled.';
                instructions = this.getMobileLocationInstructions();
                instructions += '<br><br><strong>Additional checks:</strong><br>';
                instructions += '• Ensure Location Services is ON in Settings<br>';
                instructions += '• Make sure you\'re outdoors or near a window<br>';
                instructions += '• Check that Airplane Mode is OFF';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out. GPS may be slow to acquire signal.';
                instructions = '<div style="text-align: left; max-width: 90%; margin: 0 auto;">';
                instructions += '<strong>GPS signal timeout:</strong><br><br>';
                instructions += '• Make sure you\'re outdoors (GPS works better outside)<br>';
                instructions += '• Check that Location Services is enabled<br>';
                instructions += '• Try moving to a location with better sky view<br>';
                instructions += '<br><button onclick="location.reload()" style="margin-top: 10px; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;">Retry</button>';
                instructions += '</div>';
                break;
            default:
                message = 'Unable to get location. Error code: ' + error.code;
                instructions = this.getMobileLocationInstructions();
                break;
        }
        
        // Add protocol info if not HTTPS
        if (protocol !== 'https:') {
            instructions += '<br><br><div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px;">';
            instructions += '<strong>⚠️ HTTPS Issue Detected</strong><br>';
            instructions += 'Current protocol: ' + protocol + '<br>';
            instructions += 'Geolocation requires HTTPS. Make sure your Netlify URL starts with https://';
            instructions += '</div>';
        }
        
        this.showStatus(message);
        if (instructions) {
            this.showLocationInstructions(instructions);
        }
    }

    getMobileLocationInstructions() {
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const protocol = window.location.protocol;
        const url = window.location.href;
        
        let instructions = '<div style="text-align: left; max-width: 90%; margin: 0 auto;">';
        instructions += '<strong>To enable location access:</strong><br><br>';
        
        if (isIOS) {
            instructions += '1. Tap the <strong>AA icon</strong> (left of URL bar) or the <strong>website name</strong><br>';
            instructions += '2. Tap <strong>"Website Settings"</strong><br>';
            instructions += '3. Set <strong>Location</strong> to "Allow" (not "Ask" or "Deny")<br>';
            instructions += '4. Close this popup and refresh the page<br><br>';
            instructions += '<strong>System Settings:</strong><br>';
            instructions += '• Settings → Privacy & Security → Location Services → ON<br>';
            instructions += '• Settings → Safari → Location Services → ON<br><br>';
            instructions += '<strong>Diagnostic Info:</strong><br>';
            instructions += 'Protocol: ' + protocol + '<br>';
            instructions += 'URL: ' + url.substring(0, 50) + '...<br>';
        } else if (isAndroid) {
            instructions += '1. Tap the <strong>menu icon</strong> (3 dots) in your browser<br>';
            instructions += '2. Go to <strong>Settings</strong> → <strong>Site settings</strong><br>';
            instructions += '3. Find this site and enable <strong>Location</strong> permissions<br>';
            instructions += '4. Refresh this page<br><br>';
            instructions += 'Also check: Phone Settings → Location → On';
        } else {
            instructions += '1. Click the <strong>lock/padlock icon</strong> in the address bar<br>';
            instructions += '2. Enable <strong>Location</strong> permissions<br>';
            instructions += '3. Refresh this page<br><br>';
            instructions += 'Make sure location services are enabled on your device.';
        }
        
        instructions += '<br><button onclick="location.reload()" style="margin-top: 10px; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;">Reload Page</button>';
        instructions += '</div>';
        
        return instructions;
    }

    showLocationInstructions(content) {
        // Create backdrop if it doesn't exist
        let backdrop = document.getElementById('locationInstructionsBackdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'locationInstructionsBackdrop';
            backdrop.className = 'location-instructions-backdrop';
            backdrop.onclick = () => this.hideLocationInstructions();
            document.body.appendChild(backdrop);
        }
        backdrop.style.display = 'block';

        // Create or update instruction box
        let instructionBox = document.getElementById('locationInstructions');
        if (!instructionBox) {
            instructionBox = document.createElement('div');
            instructionBox.id = 'locationInstructions';
            instructionBox.className = 'location-instructions';
            document.body.appendChild(instructionBox);
        }
        instructionBox.innerHTML = content;
        instructionBox.style.display = 'block';
    }

    hideLocationInstructions() {
        const instructionBox = document.getElementById('locationInstructions');
        const backdrop = document.getElementById('locationInstructionsBackdrop');
        if (instructionBox) {
            instructionBox.style.display = 'none';
        }
        if (backdrop) {
            backdrop.style.display = 'none';
        }
    }

    clearRoute() {
        if (this.routingControl) {
            this.map.removeControl(this.routingControl);
            this.routingControl = null;
        }
        this.selectedOffice = null;
        document.getElementById('officeSearch').value = '';
        document.getElementById('clearRoute').style.display = 'none';
    }

    showStatus(message) {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = message;
        statusEl.classList.add('show');
        
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NavigationApp();
});

