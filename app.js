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
        this.pannellumViewer = null;
        this.googleStreetView = null;
        this.panoramaBtn = null;
        this.panoOverlay = null;
        this.panoCloseBtn = null;
        this.destinationNameEl = null;
        this.destinationDescEl = null;
        this.destinationRouteEl = null;
        this.mapContainer = null;
        this.panoramaClickLocked = false;
        this.mapDisplayCache = '';
        this.lastRouteEndpoint = null;
        this.pendingPanoramaRequest = null;
        this.currentPanoramaProvider = null;
        this.panoramaMarker = null; // Map marker for 360° view
        this.pedestrianPathPolyline = null; // Polyline for walking path
        this.streetViewOverlayContainer = null; // Container for Street View overlays
        
        // Default building location (will be updated from offices.json)
        this.buildingCenter = {
            lat: 34.0522,
            lng: -118.2437
        };
        
        this.cacheDomReferences();
        this.init();
    }

    cacheDomReferences() {
        this.mapContainer = document.getElementById('map');
        this.panoramaBtn = document.getElementById('panoramaBtn');
        this.panoOverlay = document.getElementById('panoOverlay');
        this.panoCloseBtn = document.getElementById('panoClose');
        this.destinationNameEl = document.getElementById('destinationName');
        this.destinationDescEl = document.getElementById('destinationDescription');
        this.destinationRouteEl = document.getElementById('destinationRoute');
        this.landingMenu = document.getElementById('landingMenu');
        this.returnToSearchBtn = document.getElementById('returnToSearchBtn');

        if (this.panoramaBtn) {
            this.panoramaBtn.addEventListener('click', () => {
                if (!this.selectedOffice || !this.selectedOffice.panorama) {
                    return;
                }
                this.openPanorama(this.selectedOffice);
            });
        }

        if (this.panoCloseBtn) {
            this.panoCloseBtn.addEventListener('click', () => this.closePanorama());
        }

        if (this.returnToSearchBtn) {
            this.returnToSearchBtn.addEventListener('click', () => this.clearRoute());
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (this.panoOverlay && this.panoOverlay.style.display === 'block') {
                    this.closePanorama();
                } else if (this.landingMenu && this.landingMenu.style.display === 'none') {
                    // If on map view (landing menu hidden), go back to search
                    this.clearRoute();
                }
            }
        });

        this.updateDestinationPanel(null);
    }

    async init() {
        try {
            // Load office data
            await this.loadOffices();
            
            // Initialize map
            this.initMap();
            
            // Set up search functionality
            this.setupSearch();
            
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
        
        // Add light grey map tiles (CartoDB Positron style - lighter grey)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
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

    createPanoramaMarker(office) {
        // Remove existing panorama marker
        if (this.panoramaMarker) {
            this.map.removeLayer(this.panoramaMarker);
            this.panoramaMarker = null;
        }

        // Only create marker if office has panorama config
        if (!office || !office.panorama || !office.panorama.lat || !office.panorama.lng) {
            return;
        }

        // Create custom 360° icon
        const icon360 = L.divIcon({
            className: 'panorama-map-marker',
            html: `
                <div class="panorama-marker-inner">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="15" fill="#2c2c2c" stroke="white" stroke-width="2"/>
                        <text x="16" y="20" font-size="10" fill="white" text-anchor="middle" font-weight="bold">360°</text>
                    </svg>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        // Add marker to map
        this.panoramaMarker = L.marker([office.panorama.lat, office.panorama.lng], {
            icon: icon360,
            zIndexOffset: 1000 // Keep it above other markers
        }).addTo(this.map);

        // Add click handler
        this.panoramaMarker.on('click', () => {
            if (!this.panoramaClickLocked && office) {
                this.openPanorama(office);
            }
        });

        // Add tooltip
        this.panoramaMarker.bindTooltip('Click for 360° View', {
            direction: 'top',
            offset: [0, -20]
        });
    }

    drawPedestrianPath(office) {
        // Remove existing pedestrian path
        if (this.pedestrianPathPolyline) {
            this.map.removeLayer(this.pedestrianPathPolyline);
            this.pedestrianPathPolyline = null;
        }

        // Only draw if office has walking path
        if (!office || !office.walkingPath || office.walkingPath.length < 2) {
            return;
        }

        // Convert walking path to Leaflet LatLng array
        const pathCoords = office.walkingPath.map(point => [point.lat, point.lng]);

        // Draw polyline with same style as main route (seamless extension)
        this.pedestrianPathPolyline = L.polyline(pathCoords, {
            color: '#4CAF50',
            opacity: 0.8,
            weight: 5
        }).addTo(this.map);
    }

    setupSearch() {
        const searchInput = document.getElementById('officeSearch');
        const searchResults = document.getElementById('searchResults');

        // Search filtering logic
        const filterOffices = (query) => {
            query = query.toLowerCase().trim();
            return this.offices.filter(office => {
                const nameMatch = office.name.toLowerCase().includes(query);
                const descMatch = office.description && office.description.toLowerCase().includes(query);
                const unitMatch = office.unit && office.unit.toLowerCase().includes(query);
                return nameMatch || descMatch || unitMatch;
            });
        };

        // Show all offices when search input is focused and empty
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length === 0) {
                this.showAllOffices();
            } else {
                this.displaySearchResults(filterOffices(searchInput.value));
            }
        });

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query.length === 0) {
                // Show all offices when search is cleared
                this.showAllOffices();
                return;
            }

            this.displaySearchResults(filterOffices(query));
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && 
                !searchResults.contains(e.target)) {
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
            this.offices.forEach(office => this.createSearchResultItem(office, searchResults));
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
            
            results.forEach(office => this.createSearchResultItem(office, searchResults));
        }

        searchResults.classList.add('active');
    }

    createSearchResultItem(office, container) {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        
        const displayName = office.unit 
            ? `<span style="font-weight: 700; color: #2c2c2c;">Unit ${office.unit}:</span> ${office.name}` 
            : office.name;

        item.innerHTML = `
            <div class="search-result-name">${displayName}</div>
            ${office.description ? `<div class="search-result-description">${office.description}</div>` : ''}
        `;
        
        item.addEventListener('click', () => {
            this.selectOffice(office);
            document.getElementById('officeSearch').value = office.name;
            document.getElementById('searchResults').classList.remove('active');
        });
        container.appendChild(item);
    }

    selectOffice(office) {
        this.closePanorama();
        this.selectedOffice = office;
        this.lastRouteEndpoint = null;
        this.updateDestinationPanel(office);
        this.lastRouteUpdatePosition = null; // Reset route update tracking
        
        // Switch to map view
        if (this.landingMenu) {
            this.landingMenu.style.display = 'none';
        }
        if (this.returnToSearchBtn) {
            this.returnToSearchBtn.style.display = 'flex';
        }
        
        // Create panorama marker and pedestrian path
        this.createPanoramaMarker(office);
        this.drawPedestrianPath(office);
        
        // Determine route destination: use panorama location if available, otherwise office location
        const destination = office.panorama && office.panorama.lat && office.panorama.lng
            ? [office.panorama.lat, office.panorama.lng]
            : [office.lat, office.lng];
        
        if (this.userMarker) {
            const userPos = this.userMarker.getLatLng();
            this.lastRouteUpdatePosition = { lat: userPos.lat, lng: userPos.lng };
            this.calculateRoute(userPos, destination, office.name, true);
        } else {
            this.showStatus('Waiting for your location... Please allow location access.');
            // Wait a moment for location, then try again
            setTimeout(() => {
                if (this.userMarker) {
                    const userPos = this.userMarker.getLatLng();
                    this.lastRouteUpdatePosition = { lat: userPos.lat, lng: userPos.lng };
                    this.calculateRoute(userPos, destination, office.name, true);
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
            this.setRouteSummary(distance, duration);
            const endpoint = route.coordinates[route.coordinates.length - 1];
            if (endpoint) {
                this.lastRouteEndpoint = { lat: endpoint.lat, lng: endpoint.lng };
            }
            
            // Update panorama button visibility now that route is active
            if (this.selectedOffice) {
                const hasPanorama = Boolean(this.selectedOffice.panorama);
                this.updatePanoramaButtonState(hasPanorama);
            }
            
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
    
    // ... existing code ...

    clearRoute() {
        if (this.routingControl) {
            this.map.removeControl(this.routingControl);
            this.routingControl = null;
        }
        
        // Remove panorama marker
        if (this.panoramaMarker) {
            this.map.removeLayer(this.panoramaMarker);
            this.panoramaMarker = null;
        }
        
        // Remove pedestrian path
        if (this.pedestrianPathPolyline) {
            this.map.removeLayer(this.pedestrianPathPolyline);
            this.pedestrianPathPolyline = null;
        }
        
        this.selectedOffice = null;
        this.lastRouteUpdatePosition = null; // Reset route tracking
        this.routeDestinationName = null;
        this.lastRouteEndpoint = null;
        this.updateDestinationPanel(null);
        this.closePanorama();
        // Hide panorama button when route is cleared
        if (this.panoramaBtn) {
            this.panoramaBtn.style.display = 'none';
        }
        
        // Switch back to landing menu
        if (this.landingMenu) {
            this.landingMenu.style.display = 'flex';
            const input = document.getElementById('officeSearch');
            if (input) {
                input.value = '';
                input.focus();
            }
        }
        if (this.returnToSearchBtn) {
            this.returnToSearchBtn.style.display = 'none';
        }
    }

    updateDestinationPanel(office) {
        if (!this.destinationNameEl) {
            return;
        }

        if (!office) {
            this.destinationNameEl.textContent = 'Select an office to see details.';
            if (this.destinationDescEl) {
                this.destinationDescEl.textContent = '';
            }
            if (this.destinationRouteEl) {
                this.destinationRouteEl.textContent = '';
            }
            this.updatePanoramaButtonState(false);
            return;
        }

        this.destinationNameEl.textContent = office.name;
        if (this.destinationDescEl) {
            this.destinationDescEl.textContent = office.description || '';
        }
        if (this.destinationRouteEl) {
            this.destinationRouteEl.textContent = '';
        }
        // Enable panorama button only if office has panorama config AND route is active
        const hasPanorama = Boolean(office.panorama);
        this.updatePanoramaButtonState(hasPanorama);
    }

    updatePanoramaButtonState(hasPanorama) {
        if (!this.panoramaBtn) {
            return;
        }
        // Only show button when navigation is active (route exists) and panorama is available
        const shouldShow = Boolean(
            hasPanorama &&
            this.routingControl !== null &&
            this.selectedOffice !== null
        );
        this.panoramaBtn.style.display = shouldShow ? 'inline-flex' : 'none';
        this.panoramaBtn.disabled = !shouldShow;
        this.panoramaBtn.setAttribute('aria-disabled', shouldShow ? 'false' : 'true');
    }

    setRouteSummary(distance, duration) {
        if (!this.destinationRouteEl || !this.selectedOffice) {
            return;
        }
        this.destinationRouteEl.textContent = `Route: ${distance} km (~${duration} min walk)`;
    }

    openPanorama(destination) {
        if (!destination || !destination.panorama || !this.panoOverlay || !this.mapContainer) {
            return;
        }

        if (this.panoramaClickLocked) {
            return;
        }

        this.panoramaClickLocked = true;
        setTimeout(() => {
            this.panoramaClickLocked = false;
        }, 600);

        const panoramaConfig = destination.panorama;
        const provider = (panoramaConfig && panoramaConfig.provider) ? panoramaConfig.provider.toLowerCase() : '';
        if (!panoramaConfig || !provider) {
            this.showStatus('Panorama unavailable.');
            return;
        }

        this.closePanorama({ restoreMap: false });
        this.pendingPanoramaRequest = Date.now();

        if (!this.mapDisplayCache) {
            this.mapDisplayCache = this.mapContainer.style.display || '';
        }
        this.mapContainer.style.display = 'none';

        this.panoOverlay.innerHTML = '';
        this.panoOverlay.style.display = 'block';
        if (typeof this.panoOverlay.focus === 'function') {
            try {
                this.panoOverlay.focus({ preventScroll: true });
            } catch (error) {
                this.panoOverlay.focus();
            }
        }
        if (this.panoCloseBtn) {
            this.panoCloseBtn.style.display = 'block';
        }

        switch (provider) {
            case 'google':
                this.openGooglePanorama(destination, panoramaConfig);
                break;
            case 'local':
                this.openLocalPanorama(panoramaConfig);
                break;
            case 'mapillary':
                this.handleMapillaryPlaceholder();
                break;
            default:
                this.showStatus('Panorama provider not supported.');
                this.closePanorama();
        }
    }

    openGooglePanorama(destination, panoramaConfig) {
        if (!(window.google && window.google.maps && window.google.maps.StreetViewService)) {
            this.showStatus('360° view requires Google Maps API key. Configure and reload.');
            this.closePanorama();
            return;
        }

        const service = new google.maps.StreetViewService();
        const radius = panoramaConfig.radius || 80;
        const panoContainer = document.createElement('div');
        panoContainer.className = 'google-panorama-container';
        panoContainer.style.width = '100%';
        panoContainer.style.height = '100%';
        panoContainer.style.position = 'relative';
        this.panoOverlay.appendChild(panoContainer);
        
        // Use panorama-specific coordinates if available, otherwise use route endpoint or office location
        let location;
        if (panoramaConfig.lat && panoramaConfig.lng) {
            // Use dedicated panorama coordinates (on street)
            location = { lat: panoramaConfig.lat, lng: panoramaConfig.lng };
        } else if (this.lastRouteEndpoint) {
            // Use route endpoint (should be on street)
            location = this.lastRouteEndpoint;
        } else {
            // Fallback to office location (may not have Street View coverage)
            location = { lat: destination.lat, lng: destination.lng };
        }
        
        const requestId = this.pendingPanoramaRequest;

        const requestOptions = {
            location,
            radius
        };
        if (google.maps.StreetViewPreference) {
            requestOptions.preference = google.maps.StreetViewPreference.NEAREST;
        }
        if (google.maps.StreetViewSource) {
            requestOptions.source = google.maps.StreetViewSource.OUTDOOR;
        }

        service.getPanorama(requestOptions, (data, status) => {
            if (this.pendingPanoramaRequest !== requestId) {
                return;
            }
            if (status !== google.maps.StreetViewStatus.OK || !data) {
                this.showStatus('No Street View coverage at this location');
                this.closePanorama();
                return;
            }

            this.googleStreetView = new google.maps.StreetViewPanorama(panoContainer, {
                position: data.location.latLng,
                pov: {
                    heading: 90, // Face east
                    pitch: -10 // Slight downward angle to see ground
                },
                zoom: panoramaConfig.zoom || 1,
                visible: true,
                panControl: true,
                addressControl: false,
                linksControl: false, // Disable navigation arrows
                clickToGo: false, // Disable click-to-move
                motionTracking: false,
                motionTrackingControl: false
            });
            this.currentPanoramaProvider = 'google';

            // Add fixed destination marker if walking path exists
            if (destination.walkingPath && destination.walkingPath.length > 0) {
                const destinationCoords = destination.walkingPath[destination.walkingPath.length - 1];
                console.log('[Street View] Adding destination marker at:', destinationCoords);
                // Wait for panorama to be ready before adding marker
                this.googleStreetView.addListener('status_changed', () => {
                    if (this.googleStreetView.getStatus() === google.maps.StreetViewStatus.OK) {
                        console.log('[Street View] Panorama ready, adding marker');
                        this.addFixedDestinationMarker(this.googleStreetView, destinationCoords, panoContainer);
                    }
                });
                // Also try immediately in case it's already ready
                setTimeout(() => {
                    if (this.googleStreetView.getStatus() === google.maps.StreetViewStatus.OK) {
                        console.log('[Street View] Panorama already ready, adding marker');
                        this.addFixedDestinationMarker(this.googleStreetView, destinationCoords, panoContainer);
                    }
                }, 500);
            }
        });
    }

    calculateHeading(lat1, lng1, lat2, lng2) {
        // Calculate bearing between two points
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        
        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
        
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360; // Normalize to 0-360
    }

    addFixedDestinationMarker(panorama, destinationCoords, container) {
        console.log('[Compass] Creating directional compass indicator');
        console.log('[Compass] Destination coordinates:', destinationCoords);
        
        // Check if compass already exists to prevent duplicates
        if (this.streetViewOverlayContainer && container.contains(this.streetViewOverlayContainer)) {
            console.log('[Compass] Compass already exists, skipping');
            return;
        }
        
        // Create overlay container for the compass
        const overlayContainer = document.createElement('div');
        overlayContainer.className = 'streetview-compass-overlay';
        overlayContainer.style.position = 'absolute';
        overlayContainer.style.bottom = '20px';
        overlayContainer.style.left = '50%';
        overlayContainer.style.transform = 'translateX(-50%)';
        overlayContainer.style.pointerEvents = 'none';
        overlayContainer.style.zIndex = '1000';
        
        container.appendChild(overlayContainer);
        console.log('[Compass] Overlay container added to DOM');

        // Store overlay container reference for cleanup
        this.streetViewOverlayContainer = overlayContainer;

        // Create the compass element
        const compass = document.createElement('div');
        compass.className = 'streetview-compass';
        compass.innerHTML = `
            <div class="compass-arrow-container">
                <svg class="compass-arrow" width="60" height="60" viewBox="0 0 60 60">
                    <defs>
                        <filter id="arrow-shadow">
                            <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.5"/>
                        </filter>
                    </defs>
                    <!-- Outer circle -->
                    <circle cx="30" cy="30" r="28" fill="rgba(44, 44, 44, 0.95)" stroke="white" stroke-width="2"/>
                    <!-- Arrow pointing up (will rotate) -->
                    <g id="arrow-pointer" filter="url(#arrow-shadow)">
                        <path d="M 30 10 L 38 28 L 30 24 L 22 28 Z" fill="#4CAF50" stroke="white" stroke-width="1.5"/>
                        <path d="M 30 24 L 30 42" stroke="#4CAF50" stroke-width="3"/>
                    </g>
                </svg>
            </div>
            <div class="compass-info">
                <div class="compass-label">Building Entrance</div>
                <div class="compass-distance">-- m</div>
            </div>
        `;
        overlayContainer.appendChild(compass);
        console.log('[Compass] Compass element created and added');

        const arrowPointer = compass.querySelector('#arrow-pointer');
        const distanceDisplay = compass.querySelector('.compass-distance');

        // Function to update compass direction
        const updateCompass = () => {
            try {
                const pov = panorama.getPov();
                const position = panorama.getPosition();
                
                if (!position) {
                    console.log('[Compass] No position available yet');
                    return;
                }

                const currentLat = position.lat();
                const currentLng = position.lng();
                
                // Calculate bearing to destination
                const bearing = this.calculateHeading(currentLat, currentLng, destinationCoords.lat, destinationCoords.lng);
                const distance = this.calculateDistance(currentLat, currentLng, destinationCoords.lat, destinationCoords.lng);
                
                console.log('[Compass] Bearing:', bearing, 'Distance:', distance, 'Camera heading:', pov.heading);
                
                // Calculate relative angle (bearing - camera heading)
                // This is the angle we need to rotate the arrow
                const relativeAngle = bearing - pov.heading;
                
                // Update arrow rotation
                arrowPointer.style.transform = `rotate(${relativeAngle}deg)`;
                arrowPointer.style.transformOrigin = '30px 30px';
                
                // Update distance display
                if (distance < 1000) {
                    distanceDisplay.textContent = `${Math.round(distance)}m`;
                } else {
                    distanceDisplay.textContent = `${(distance / 1000).toFixed(2)}km`;
                }
                
                console.log('[Compass] Updated - Relative angle:', relativeAngle, 'Distance:', Math.round(distance), 'm');
            } catch (error) {
                console.error('[Compass] Error updating compass:', error);
            }
        };

        // Update compass on view change
        panorama.addListener('pov_changed', updateCompass);
        console.log('[Compass] POV change listener added');
        
        // Initial update with multiple attempts
        setTimeout(updateCompass, 200);
        setTimeout(updateCompass, 500);
        setTimeout(updateCompass, 1000);
    }

    openLocalPanorama(panoramaConfig) {
        if (!(window.pannellum && typeof window.pannellum.viewer === 'function')) {
            this.showStatus('Panorama viewer unavailable.');
            this.closePanorama();
            return;
        }

        if (!panoramaConfig.image) {
            this.showStatus('Panorama unavailable.');
            this.closePanorama();
            return;
        }

        try {
            this.pannellumViewer = window.pannellum.viewer('panoOverlay', {
                type: 'equirectangular',
                panorama: panoramaConfig.image,
                autoLoad: true,
                yaw: panoramaConfig.heading || panoramaConfig.yaw || 0,
                pitch: panoramaConfig.pitch || 0
            });
            this.currentPanoramaProvider = 'local';

            if (this.pannellumViewer && typeof this.pannellumViewer.on === 'function') {
                this.pannellumViewer.on('error', () => {
                    this.showStatus('Panorama unavailable.');
                    this.closePanorama();
                });
            }
        } catch (error) {
            console.error('Pannellum viewer error:', error);
            this.showStatus('Panorama unavailable.');
            this.closePanorama();
        }
    }

    handleMapillaryPlaceholder() {
        // TODO: Wire up Mapillary JS with imageId when available.
        this.showStatus('Mapillary 360° view coming soon.');
        this.closePanorama();
    }

    closePanorama(options = {}) {
        const { restoreMap = true } = options;
        this.pendingPanoramaRequest = null;
        this.panoramaClickLocked = false;
        this.destroyActivePanorama();

        if (this.panoOverlay) {
            this.panoOverlay.style.display = 'none';
            this.panoOverlay.innerHTML = '';
        }
        if (this.panoCloseBtn) {
            this.panoCloseBtn.style.display = 'none';
        }
        if (restoreMap && this.mapContainer) {
            this.mapContainer.style.display = this.mapDisplayCache || '';
            this.mapDisplayCache = '';
        }
    }

    destroyActivePanorama() {
        if (this.pannellumViewer) {
            try {
                this.pannellumViewer.destroy();
            } catch (error) {
                console.error('Pannellum cleanup error:', error);
            }
            this.pannellumViewer = null;
        }

        if (this.googleStreetView) {
            try {
                this.googleStreetView.setVisible(false);
            } catch (error) {
                console.error('Google Street View cleanup error:', error);
            }
            this.googleStreetView = null;
        }

        // Clean up overlay container
        if (this.streetViewOverlayContainer) {
            try {
                if (this.streetViewOverlayContainer.parentNode) {
                    this.streetViewOverlayContainer.parentNode.removeChild(this.streetViewOverlayContainer);
                }
            } catch (error) {
                console.error('Overlay cleanup error:', error);
            }
            this.streetViewOverlayContainer = null;
        }

        this.currentPanoramaProvider = null;
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


