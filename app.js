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
        this.preciseLocationWarningShown = false;
        this.lastRouteUpdatePosition = null; // Track last position used for route update
        this.minRouteUpdateDistance = 15; // Minimum distance in meters to trigger route update
        this.routeDestinationName = null; // Store destination name to avoid showing status repeatedly
        
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
            
            // Set up clear route button
            document.getElementById('clearRoute').addEventListener('click', () => this.clearRoute());
            
            // Set up location enable button
            const enableLocationBtn = document.getElementById('enableLocationBtn');
            if (enableLocationBtn) {
                enableLocationBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Detect browser for instructions
                    const userAgent = navigator.userAgent;
                    const isIOS = /iPhone|iPad|iPod/.test(userAgent);
                    const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS|Firefox|FxiOS/.test(userAgent);
                    const isAndroid = /Android/.test(userAgent);
                    const isChrome = /Chrome/.test(userAgent) && !/Edge|OPR/.test(userAgent);
                    const isFirefox = /Firefox/.test(userAgent);
                    
                    this.hideLocationPrompt();
                    this.showStatus('Requesting location access...');
                    
                    // Request location
                    if (!navigator.geolocation) {
                        this.showBrowserInstructions('unsupported');
                        return;
                    }
                    
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            // Success!
                            this.updateUserLocation(position);
                            this.showStatus('Location found! You can now search for offices.');
                            
                            // Start watching position
                            this.watchId = navigator.geolocation.watchPosition(
                                (pos) => this.updateUserLocation(pos),
                                (err) => {
                                    if (err.code !== 1) {
                                        console.error('Watch error:', err);
                                    }
                                },
                                { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
                            );
                            
                        },
                        (error) => {
                            // Failed - show browser-specific instructions
                            if (error.code === 1) { // PERMISSION_DENIED
                                if (isIOS || isSafari) {
                                    this.showBrowserInstructions('safari');
                                } else if (isAndroid) {
                                    this.showBrowserInstructions('android');
                                } else if (isChrome) {
                                    this.showBrowserInstructions('chrome');
                                } else if (isFirefox) {
                                    this.showBrowserInstructions('firefox');
                                } else {
                                    this.showBrowserInstructions('other');
                                }
                            } else {
                                this.showStatus(`Error: ${error.message}`);
                                this.showLocationPrompt();
                            }
                        },
                        {
                            enableHighAccuracy: false,
                            timeout: 10000,
                            maximumAge: 0
                        }
                    );
                }, { once: false, capture: true });
            }
            
            // Check if we should show the prompt or auto-request
            this.checkLocationPermission();
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
        
        // Add dark/grey map tiles (CartoDB Dark Matter style)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
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
        const viewAllBtn = document.getElementById('viewAllBtn');

        // Show all offices when clicking "View All" button
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAllOffices();
            });
        }

        // Show all offices when search input is focused and empty
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length === 0) {
                this.showAllOffices();
            } else {
                const query = searchInput.value.toLowerCase().trim();
                const filtered = this.offices.filter(office => 
                    office.name.toLowerCase().includes(query) ||
                    (office.description && office.description.toLowerCase().includes(query))
                );
                this.displaySearchResults(filtered);
            }
        });

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query.length === 0) {
                // Show all offices when search is cleared
                this.showAllOffices();
                return;
            }

            const filtered = this.offices.filter(office => 
                office.name.toLowerCase().includes(query) ||
                (office.description && office.description.toLowerCase().includes(query))
            );

            this.displaySearchResults(filtered);
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && 
                !searchResults.contains(e.target) && 
                !viewAllBtn.contains(e.target)) {
                searchResults.classList.remove('active');
            }
        });
    }

    showAllOffices() {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '';
        
        if (this.offices.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item" style="color: #999; cursor: default;">No offices available</div>';
        } else {
            // Add header
            const header = document.createElement('div');
            header.className = 'search-result-header';
            header.innerHTML = `<strong>All Offices (${this.offices.length})</strong>`;
            searchResults.appendChild(header);
            
            // Show all offices
            this.offices.forEach(office => {
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

    displaySearchResults(results) {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '';

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item" style="color: #999; cursor: default;">No offices found</div>';
        } else {
            // Add header showing count
            const header = document.createElement('div');
            header.className = 'search-result-header';
            header.innerHTML = `<strong>Found ${results.length} ${results.length === 1 ? 'office' : 'offices'}</strong>`;
            searchResults.appendChild(header);
            
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
        this.lastRouteUpdatePosition = null; // Reset route update tracking
        document.getElementById('clearRoute').style.display = 'block';
        
        if (this.userMarker) {
            const userPos = this.userMarker.getLatLng();
            this.lastRouteUpdatePosition = { lat: userPos.lat, lng: userPos.lng };
            this.calculateRoute(userPos, [office.lat, office.lng], office.name, true);
        } else {
            this.showStatus('Waiting for your location... Please allow location access.');
            // Wait a moment for location, then try again
            setTimeout(() => {
                if (this.userMarker) {
                    const userPos = this.userMarker.getLatLng();
                    this.lastRouteUpdatePosition = { lat: userPos.lat, lng: userPos.lng };
                    this.calculateRoute(userPos, [office.lat, office.lng], office.name, true);
                } else {
                    this.showStatus('Unable to get your location. Please enable location services.');
                }
            }, 2000);
        }
    }

    // Helper function to calculate distance between two points in meters
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }

    calculateRoute(start, end, destinationName, isInitialRoute = false) {
        // If route exists and we're just updating, use setWaypoints instead of recreating
        if (this.routingControl && !isInitialRoute) {
            // Update waypoints dynamically without recreating the route
            if (typeof this.routingControl.setWaypoints === 'function') {
                this.routingControl.setWaypoints([
                    L.latLng(start.lat, start.lng),
                    L.latLng(end[0], end[1])
                ]);
                
                // Update the stored destination name
                this.routeDestinationName = destinationName;
                
                // The routesfound event will fire and update instructions automatically
                // Don't show status message on updates - it's distracting
                return;
            } else {
                // Fallback: if setWaypoints doesn't exist, recreate the route
                // (this shouldn't happen with Leaflet Routing Machine, but just in case)
                console.warn('setWaypoints not available, recreating route');
            }
        }

        // Clear existing route only if creating new one
        if (this.routingControl) {
            this.map.removeControl(this.routingControl);
        }

        // Store destination name
        this.routeDestinationName = destinationName;

        // Create new route (only on initial route calculation)
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

        // Track if this is the first routesfound event for this route
        let isFirstRouteFound = true;

        this.routingControl.on('routesfound', (e) => {
            const route = e.routes[0];
            const distance = (route.summary.totalDistance / 1000).toFixed(2);
            const duration = Math.round(route.summary.totalTime / 60);
            
            // Only show status message on initial route calculation
            if (isFirstRouteFound) {
                this.showStatus(`Route to ${destinationName}: ${distance} km, ~${duration} min walk`);
                isFirstRouteFound = false;
                
                // Fit map to show entire route only on initial route
                const bounds = L.latLngBounds(
                    route.coordinates.map(coord => [coord.lat, coord.lng])
                );
                this.map.fitBounds(bounds, { padding: [50, 50] });
            }
        });

        this.routingControl.on('routingerror', (error) => {
            console.error('Routing error:', error);
            // Only show error if it's an initial route calculation
            if (isInitialRoute) {
                this.showStatus('Unable to calculate route. Please try again.');
            }
        });
    }

    checkLocationPermission() {
        // Detect Safari specifically
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|Firefox|FxiOS/.test(navigator.userAgent);
        
        console.log('Browser detection:', { isIOS, isSafari, userAgent: navigator.userAgent });
        
        if (isIOS || isSafari) {
            // Always show button for Safari - it requires explicit user gesture
            this.showLocationPrompt();
        } else {
            // For other browsers, try auto-request
            setTimeout(() => {
                this.requestLocation();
            }, 500);
        }
    }

    showLocationPrompt() {
        const prompt = document.getElementById('locationPrompt');
        if (prompt) {
            prompt.style.display = 'flex';
        }
    }

    hideLocationPrompt() {
        const prompt = document.getElementById('locationPrompt');
        if (prompt) {
            prompt.style.display = 'none';
        }
    }

    showBrowserInstructions(browser) {
        const promptContent = document.querySelector('.location-prompt-content');
        if (!promptContent) return;
        
        let instructions = '';
        
        if (browser === 'safari') {
            instructions = 
                '<h3 style="color: #f44336; margin-top: 0;">📍 Enable Location for Safari</h3>' +
                '<div style="text-align: left; font-size: 14px; line-height: 1.8;">' +
                '<p><strong>Safari requires location access in TWO places. Both must be enabled:</strong></p>' +
                
                '<div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">' +
                '<strong style="font-size: 16px;">📍 Step 1: Website-Specific Permission</strong><br><br>' +
                '1. Tap the <strong>AA icon</strong> (left of URL bar)<br>' +
                '2. Tap <strong>"Website Settings"</strong><br>' +
                '3. Find <strong>"Location"</strong><br>' +
                '4. Set it to <strong>"Allow"</strong> (not "Ask" or "Deny")<br>' +
                '5. Make sure <strong>"Precise Location"</strong> toggle is ON' +
                '</div>' +
                
                '<div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">' +
                '<strong style="font-size: 16px;">📍 Step 2: System-Level Permission (IMPORTANT!)</strong><br><br>' +
                '1. Go to iPhone <strong>Settings</strong> app<br>' +
                '2. Tap <strong>Privacy & Security</strong><br>' +
                '3. Tap <strong>Location Services</strong><br>' +
                '4. Scroll down and find <strong>"Safari Websites"</strong><br>' +
                '5. Tap on <strong>"Safari Websites"</strong><br>' +
                '6. Select <strong>"Ask Next Time Or When I Share"</strong> OR <strong>"While Using the App"</strong><br>' +
                '<strong style="color: #f44336;">⚠️ DO NOT select "Never" - this will block location!</strong>' +
                '</div>' +
                
                '<div style="background: #f3e5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">' +
                '<strong>Step 3: Close and Reopen Safari</strong><br><br>' +
                '1. Swipe up from bottom to see app switcher<br>' +
                '2. Swipe Safari away to fully close it<br>' +
                '3. Reopen Safari<br>' +
                '4. Return to this page<br>' +
                '5. Tap "Enable Location" again' +
                '</div>' +
                
                '<button id="enableLocationBtn" class="enable-location-btn">' +
                'Enable Location' +
                '</button>' +
                '<p class="location-prompt-note">After completing both steps above, close Safari completely, then reopen and try again.</p>' +
                '</div>';
        } else if (browser === 'android') {
            instructions = 
                '<h3>📍 Enable Location for Android</h3>' +
                '<div style="text-align: left; font-size: 14px; line-height: 1.8;">' +
                '1. Tap the <strong>menu icon</strong> (3 dots) in your browser<br>' +
                '2. Go to <strong>Settings</strong> → <strong>Site settings</strong><br>' +
                '3. Find this website and enable <strong>Location</strong> permissions<br><br>' +
                '<strong>Also check:</strong><br>' +
                'Phone Settings → Location → ON<br><br>' +
                '<button id="enableLocationBtn" class="enable-location-btn">Try Again</button>' +
                '</div>';
        } else if (browser === 'chrome') {
            instructions = 
                '<h3>📍 Enable Location for Chrome</h3>' +
                '<div style="text-align: left; font-size: 14px; line-height: 1.8;">' +
                '1. Click the <strong>lock icon</strong> in the address bar<br>' +
                '2. Find <strong>"Location"</strong><br>' +
                '3. Select <strong>"Allow"</strong><br><br>' +
                '<button id="enableLocationBtn" class="enable-location-btn">Try Again</button>' +
                '</div>';
        } else if (browser === 'firefox') {
            instructions = 
                '<h3>📍 Enable Location for Firefox</h3>' +
                '<div style="text-align: left; font-size: 14px; line-height: 1.8;">' +
                '1. Click the <strong>shield icon</strong> in the address bar<br>' +
                '2. Find <strong>"Permissions"</strong><br>' +
                '3. Enable <strong>"Location"</strong><br><br>' +
                '<button id="enableLocationBtn" class="enable-location-btn">Try Again</button>' +
                '</div>';
        } else if (browser === 'unsupported') {
            instructions = 
                '<h3>⚠️ Geolocation Not Supported</h3>' +
                '<p>Your browser does not support location services. Please use a modern browser.</p>';
        } else {
            instructions = 
                '<h3>📍 Enable Location</h3>' +
                '<div style="text-align: left; font-size: 14px; line-height: 1.8;">' +
                '1. Check your browser settings for location permissions<br>' +
                '2. Ensure location services are enabled on your device<br><br>' +
                '<button id="enableLocationBtn" class="enable-location-btn">Try Again</button>' +
                '</div>';
        }
        
        promptContent.innerHTML = instructions;
        
        // Reattach button listener
        const btn = document.getElementById('enableLocationBtn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const userAgent = navigator.userAgent;
                const isIOS = /iPhone|iPad|iPod/.test(userAgent);
                const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS|Firefox/.test(userAgent);
                
                if (isIOS || isSafari) {
                    this.showBrowserInstructions('safari');
                } else {
                    location.reload();
                }
            }, { once: false, capture: true });
        }
        
        this.showLocationPrompt();
    }


    requestLocation() {
        // For non-Safari browsers
        if (!navigator.geolocation) {
            this.showLocationInstructions('Geolocation is not supported by your browser. Please use a modern browser.');
            return;
        }

        const protocol = window.location.protocol;
        const isSecure = protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (!isSecure) {
            console.warn('Site is not using HTTPS. Geolocation may not work.');
            this.showStatus('Warning: HTTPS required for location access.');
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 30000
        };

        this.hideLocationPrompt();
        this.showStatus('Requesting location access...');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.hideLocationInstructions();
                this.updateUserLocation(position);
                this.showStatus('Location found! You can now search for offices.');
                
                this.watchId = navigator.geolocation.watchPosition(
                    (pos) => {
                        this.hideLocationInstructions();
                        this.updateUserLocation(pos);
                    },
                    (error) => {
                        if (error.code !== error.PERMISSION_DENIED) {
                            this.handleLocationError(error);
                        }
                    },
                    options
                );
                
            },
            (error) => {
                this.handleLocationError(error);
            },
            options
        );
    }


    // Create a clean, simple icon for user location (no directionality)
    createUserLocationIcon() {
        // Create a canvas-based icon - simple circle with subtle border
        const size = 40;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Draw outer circle with border
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 16, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw inner circle for depth
        ctx.fillStyle = '#66BB6A';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 12, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw center dot
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add subtle shadow/border
        ctx.strokeStyle = '#2E7D32';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 16, 0, 2 * Math.PI);
        ctx.stroke();
        
        return canvas.toDataURL();
    }


    updateUserLocation(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        // Check for poor accuracy on iOS Safari (Precise Location might be off)
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);
        
        if (accuracy > 50 && isIOS && isSafari && !this.preciseLocationWarningShown) {
            // Accuracy is poor - user might need to enable "Precise Location"
            this.showStatus(`Location accuracy is ±${Math.round(accuracy)}m. For better navigation, enable Precise Location in Safari settings.`);
            this.preciseLocationWarningShown = true;
        }

        if (!this.userMarker) {
            // Create user marker with clean circular icon
            const iconUrl = this.createUserLocationIcon();
            this.userMarker = L.marker([lat, lng], {
                icon: L.icon({
                    iconUrl: iconUrl,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                    popupAnchor: [0, -20]
                })
            }).addTo(this.map);
            
            // Center map on user initially
            this.map.setView([lat, lng], 18);
        } else {
            // Update existing marker position
            this.userMarker.setLatLng([lat, lng]);
        }

        // Add accuracy circle (optional visual indicator) - smaller and more subtle for close navigation
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }
        
        this.accuracyCircle = L.circle([lat, lng], {
            radius: Math.min(accuracy, 20), // Cap at 20m for close navigation
            fillColor: '#4CAF50',
            fillOpacity: 0.15,
            color: '#4CAF50',
            weight: 1.5,
            opacity: 0.4
        }).addTo(this.map);

        // Update route if one is active, but only if user has moved significantly
        if (this.routingControl && this.selectedOffice) {
            const userPos = { lat, lng };
            
            // Check if we should update the route based on distance moved
            let shouldUpdate = false;
            
            if (!this.lastRouteUpdatePosition) {
                // First update after selecting office
                shouldUpdate = true;
                this.lastRouteUpdatePosition = { lat, lng };
            } else {
                // Calculate distance from last route update position
                const distance = this.calculateDistance(
                    lat, lng,
                    this.lastRouteUpdatePosition.lat,
                    this.lastRouteUpdatePosition.lng
                );
                
                // Only update if user has moved more than minimum distance
                if (distance >= this.minRouteUpdateDistance) {
                    shouldUpdate = true;
                    this.lastRouteUpdatePosition = { lat, lng };
                }
            }
            
            if (shouldUpdate) {
                // Update route dynamically (not initial route)
                this.calculateRoute(userPos, [this.selectedOffice.lat, this.selectedOffice.lng], this.selectedOffice.name, false);
            }
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
                
                // For Safari, update the prompt content directly instead of showing separate popup
                const isSafariBrowser = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|Firefox/.test(navigator.userAgent);
                const isIOSDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
                
                if (isSafariBrowser || isIOSDevice) {
                    // Show Safari-specific instructions
                    this.showBrowserInstructions('safari');
                    break;
                } else {
                    // Detect other browsers
                    const isAndroid = /Android/.test(navigator.userAgent);
                    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge|OPR/.test(navigator.userAgent);
                    const isFirefox = /Firefox/.test(navigator.userAgent);
                    
                    if (isAndroid) {
                        this.showBrowserInstructions('android');
                    } else if (isChrome) {
                        this.showBrowserInstructions('chrome');
                    } else if (isFirefox) {
                        this.showBrowserInstructions('firefox');
                    } else {
                        this.showBrowserInstructions('other');
                    }
                    break;
                }
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
        this.lastRouteUpdatePosition = null; // Reset route tracking
        this.routeDestinationName = null;
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


