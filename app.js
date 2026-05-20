// Office Navigation Application
class NavigationApp {
    constructor() {
        this.map = null;
        this.baseTileLayers = {};
        this.activeBaseTileLayer = null;
        this.activeMapViewMode = 'animated';
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
        this.destinationPanel = null;
        this.destinationNameEl = null;
        this.destinationRouteEl = null;
        this.mapContainer = null;
        this.appContainer = null;
        this.panoramaClickLocked = false;
        this.mapDisplayCache = '';
        this.lastRouteEndpoint = null;
        this.pendingPanoramaRequest = null;
        this.currentPanoramaProvider = null;
        this.panoramaMarker = null; // Map marker for 360° view
        this.panoramaDirectionLine = null;
        this.panoramaEntranceMarker = null;
        this.pedestrianPathPolyline = null; // Polyline for walking path
        this.streetViewOverlayContainer = null; // Container for Street View overlays
        this.pendingDestination = null;
        this.locationWaitTimeout = null;
        this.locationWaitStart = null;
        this.selectedEntrance = null; // Current entrance for multi-entrance offices
        this.activeRoutePlan = null;
        this.navigationNodeIndex = { panoramas: [], sidewalks: [] };
        this.brandColor = '#414b43';
        this.routeAccentColor = '#f4efe7';
        this.routeCasingColor = '#243127';
        this.maxExpectedRouteDistanceMeters = 50000;
        this.googleMapsApiLoadPromise = null;
        this.officeMarkers = new Map(); // Cache of office markers (not shown by default)
        this.activeOfficeMarker = null;
        this.expandedOfficeMarker = null;
        this.entranceLabelMarker = null;
        this.streetViewMarkerGroup = null;
        this.streetViewMarkers = [];
        this.streetViewLegend = null;
        this.manualPanoramaPoint = null;
        this.developerModeBtn = null;
        this.mapViewToggle = null;
        this.animatedViewBtn = null;
        this.realWorldViewBtn = null;
        this.officeTracePanel = null;
        this.officeTraceTitle = null;
        this.officeTraceStatus = null;
        this.officeTraceProgress = null;
        this.officeTraceVertexCount = null;
        this.officeTraceRotation = null;
        this.toggleTraceModeBtn = null;
        this.traceUndoBtn = null;
        this.traceResetBtn = null;
        this.traceSetOfficePointBtn = null;
        this.traceSetEntrancePointBtn = null;
        this.traceRotateLeftBtn = null;
        this.traceRotateRightBtn = null;
        this.traceRotateResetBtn = null;
        this.traceSaveNextBtn = null;
        this.traceSkipBtn = null;
        this.traceDownloadBtn = null;
        this.officeTraceStorageKey = 'qr-navigation-office-trace-v3';
        this.legacyOfficeTraceStorageKeys = [
            'qr-navigation-office-trace-v1',
            'qr-navigation-office-trace-v2'
        ];
        this.traceModeActive = false;
        this.officeTraceData = {};
        this.currentTraceOfficeIndex = -1;
        this.currentTraceVertices = [];
        this.currentTraceClosed = false;
        this.traceHoverLatLng = null;
        this.traceAxisSnapAngleDegrees = 10;
        this.traceAxisSnapEnabled = false;
        this.traceEditTarget = 'border';
        this.traceReferenceLayerGroup = null;
        this.traceLayerGroup = null;
        this.officeBoundaryLayerGroup = null;
        this.officeBoundaryLayers = [];
        this.mapRotationDegrees = 0;
        this.testingModeStartLocation = { lat: 41.751205, lng: -87.937978 };
        this.testingModeLocation = null;
        this.testingModePickActive = false;
        this.enterTestModeBtn = null;
        this.testModePickPointBtn = null;
        this.exitTestModeBtn = null;
        this.isLocalTestMode = this.shouldEnableLocalTestMode();
        this.testLocations = [
            { label: 'Point 1', lat: 41.750453, lng: -87.937484 },
            { label: 'Point 2', lat: 41.751184, lng: -87.937944 },
            { label: 'Point 3', lat: 41.750596, lng: -87.938739 },
            { label: 'Point 4', lat: 41.750086, lng: -87.939078 },
            { label: 'Point 5', lat: 41.749753, lng: -87.938136 }
        ];
        this.activeTestLocationIndex = 0;
        this.activeOfficeTestIndex = -1;
        this.testLocationPanel = null;
        this.testLocationButtons = null;
        this.testLocationStatusEl = null;
        this.testSearchOfficeBtn = null;
        this.officeTestPrevBtn = null;
        this.officeTestNextBtn = null;
        this.officeTestStatusEl = null;
        this.testPanoramaBtn = null;
        this.panoramaModeActive = false;
        
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
        this.appContainer = document.querySelector('.container');
        this.panoramaBtn = document.getElementById('panoramaBtn');
        this.panoOverlay = document.getElementById('panoOverlay');
        this.panoCloseBtn = document.getElementById('panoClose');
        this.destinationPanel = document.getElementById('destinationPanel');
        this.destinationNameEl = document.getElementById('destinationName');
        this.destinationRouteEl = document.getElementById('destinationRoute');
        this.developerModeBtn = document.getElementById('developerModeBtn');
        this.landingMenu = document.getElementById('landingMenu');
        this.enterTestModeBtn = document.getElementById('enterTestModeBtn');
        this.returnToSearchBtn = document.getElementById('returnToSearchBtn');
        this.testLocationPanel = document.getElementById('testLocationPanel');
        this.testLocationStatusEl = document.getElementById('testLocationStatus');
        this.testSearchOfficeBtn = document.getElementById('testSearchOfficeBtn');
        this.testModePickPointBtn = document.getElementById('testPickPointBtn');
        this.exitTestModeBtn = document.getElementById('exitTestModeBtn');
        this.streetViewLegend = document.getElementById('streetViewLegend');
        this.mapViewToggle = document.getElementById('mapViewToggle');
        this.animatedViewBtn = document.getElementById('animatedViewBtn');
        this.realWorldViewBtn = document.getElementById('realWorldViewBtn');
        this.officeTracePanel = document.getElementById('officeTracePanel');
        this.officeTraceTitle = document.getElementById('officeTraceTitle');
        this.officeTraceStatus = document.getElementById('officeTraceStatus');
        this.officeTraceProgress = document.getElementById('officeTraceProgress');
        this.officeTraceVertexCount = document.getElementById('officeTraceVertexCount');
        this.officeTraceRotation = document.getElementById('officeTraceRotation');
        this.toggleTraceModeBtn = document.getElementById('toggleTraceModeBtn');
        this.traceUndoBtn = document.getElementById('traceUndoBtn');
        this.traceResetBtn = document.getElementById('traceResetBtn');
        this.traceSetOfficePointBtn = document.getElementById('traceSetOfficePointBtn');
        this.traceSetEntrancePointBtn = document.getElementById('traceSetEntrancePointBtn');
        this.traceRotateLeftBtn = document.getElementById('traceRotateLeftBtn');
        this.traceRotateRightBtn = document.getElementById('traceRotateRightBtn');
        this.traceRotateResetBtn = document.getElementById('traceRotateResetBtn');
        this.traceSaveNextBtn = document.getElementById('traceSaveNextBtn');
        this.traceSkipBtn = document.getElementById('traceSkipBtn');
        this.traceDownloadBtn = document.getElementById('traceDownloadBtn');

        if (this.toggleTraceModeBtn) {
            this.toggleTraceModeBtn.addEventListener('click', () => {
                this.setTraceModeActive(!this.traceModeActive);
            });
        }

        if (this.traceUndoBtn) {
            this.traceUndoBtn.addEventListener('click', () => {
                this.undoTracePoint();
            });
        }

        if (this.traceResetBtn) {
            this.traceResetBtn.addEventListener('click', () => {
                this.resetCurrentTraceShape({ announce: true });
            });
        }

        if (this.traceSetOfficePointBtn) {
            this.traceSetOfficePointBtn.addEventListener('click', () => {
                this.setTraceEditTarget(this.traceEditTarget === 'office' ? 'border' : 'office');
            });
        }

        if (this.traceSetEntrancePointBtn) {
            this.traceSetEntrancePointBtn.addEventListener('click', () => {
                this.setTraceEditTarget(this.traceEditTarget === 'entrance' ? 'border' : 'entrance');
            });
        }

        if (this.traceRotateLeftBtn) {
            this.traceRotateLeftBtn.addEventListener('click', () => {
                this.rotateMapByDegrees(-1);
            });
        }

        if (this.traceRotateRightBtn) {
            this.traceRotateRightBtn.addEventListener('click', () => {
                this.rotateMapByDegrees(1);
            });
        }

        if (this.traceRotateResetBtn) {
            this.traceRotateResetBtn.addEventListener('click', () => {
                this.setMapRotation(0);
            });
        }

        if (this.traceSaveNextBtn) {
            this.traceSaveNextBtn.addEventListener('click', () => {
                this.saveCurrentTraceAndAdvance();
            });
        }

        if (this.traceSkipBtn) {
            this.traceSkipBtn.addEventListener('click', () => {
                this.advanceTraceOffice({ announce: true, skipCurrent: true });
            });
        }

        if (this.traceDownloadBtn) {
            this.traceDownloadBtn.addEventListener('click', () => {
                this.downloadOfficeTraceData();
            });
        }

        if (this.developerModeBtn) {
            this.developerModeBtn.addEventListener('click', () => {
                this.handleDeveloperModeToggle();
            });
        }

        if (this.testModePickPointBtn) {
            this.testModePickPointBtn.addEventListener('click', () => {
                this.setTestingModePickActive(!this.testingModePickActive);
            });
        }

        if (this.testSearchOfficeBtn) {
            this.testSearchOfficeBtn.addEventListener('click', () => {
                this.openOfficeSearch();
            });
        }

        if (this.exitTestModeBtn) {
            this.exitTestModeBtn.addEventListener('click', () => {
                this.exitTestingMode();
            });
        }

        if (this.panoramaBtn) {
            this.panoramaBtn.addEventListener('click', () => {
                if (!this.selectedOffice) {
                    this.showStatus('Select an office before opening 360° view.');
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
            const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';

            if (key === 'z' && this.isLocalTestMode && this.traceModeActive && !event.repeat && !this.isTextInputTarget(event.target)) {
                this.traceAxisSnapEnabled = !this.traceAxisSnapEnabled;
                this.updateTracePanel();

                if (!this.currentTraceClosed && this.traceHoverLatLng) {
                    this.traceHoverLatLng = this.getTracePointWithOptionalAxisLock(this.traceHoverLatLng);
                    this.updateTraceDrawing();
                }

                this.showStatus(this.traceAxisSnapEnabled ? 'Axis snap enabled.' : 'Axis snap disabled.');
                return;
            }

            if (event.key === 'Escape') {
                if (this.panoOverlay && this.panoOverlay.style.display === 'block') {
                    this.closePanorama();
                } else if (this.landingMenu && this.landingMenu.style.display === 'none') {
                    // If on map view (landing menu hidden), go back to search
                    this.clearRoute();
                }
            }
        });

        document.addEventListener('pointerdown', (event) => {
            if (this.isOfficeMarkerTarget(event.target)) {
                return;
            }

            this.setOfficeMarkerExpanded(null, false);
        });

        this.updateDestinationPanel(null);
        this.updateDeveloperModeButton();
    }

    async init() {
        try {
            // Load office data
            await this.loadOffices();
            this.loadOfficeTraceData();
            
            // Initialize map
            this.initMap();
            
            // Set up search functionality
            this.setupSearch();

            if (this.isLocalTestMode) {
                this.enterTestingMode({ announce: false, centerMap: true });
                return;
            }
            
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

    shouldEnableLocalTestMode() {
        const host = window.location.hostname;
        const isLocalHost = host === 'localhost' || host === '127.0.0.1';
        if (!isLocalHost) {
            return false;
        }

        if (!window.APP_CONFIG || typeof window.APP_CONFIG !== 'object') {
            return false;
        }

        const value = window.APP_CONFIG.ENABLE_LOCAL_TEST_MODE;
        if (typeof value === 'string') {
            return value.trim().toLowerCase() === 'true';
        }

        return value === true;
    }

    updateDeveloperModeButton() {
        if (!this.developerModeBtn) {
            return;
        }

        const isEnabled = !!this.isLocalTestMode;
        this.developerModeBtn.classList.toggle('is-active', isEnabled);
        this.developerModeBtn.setAttribute('aria-label', isEnabled ? 'Disable developer mode' : 'Enable developer mode');
        this.developerModeBtn.setAttribute('title', isEnabled ? 'Disable developer mode' : 'Enable developer mode');
    }

    handleDeveloperModeToggle() {
        if (this.isLocalTestMode) {
            this.exitTestingMode({ announce: true });
            return;
        }

        const pin = window.prompt('Enter developer PIN');
        if (pin === null) {
            return;
        }

        if (pin.trim() !== '9719') {
            this.showStatus('Incorrect developer PIN.');
            return;
        }

        this.enterTestingMode({ announce: true, centerMap: true });
    }

    async loadOffices() {
        try {
            const [officesResponse, boundariesResponse] = await Promise.all([
                fetch('offices.json'),
                fetch('office-boundaries.json').catch(() => null)
            ]);

            const data = await officesResponse.json();
            const boundaryData = boundariesResponse && boundariesResponse.ok
                ? await boundariesResponse.json()
                : null;

            this.offices = this.mergeOfficeBoundaryData(data.offices, boundaryData);
            this.buildNavigationNodeIndex();
            
            // Set building center from first office or use provided center
            if (boundaryData && boundaryData.buildingCenter && this.isValidCoordinatePair(boundaryData.buildingCenter)) {
                this.buildingCenter = boundaryData.buildingCenter;
            } else if (data.buildingCenter) {
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
            this.buildNavigationNodeIndex();
        }
    }

    mergeOfficeBoundaryData(offices, boundaryData) {
        const officeList = Array.isArray(offices) ? offices : [];
        const boundaryOffices = boundaryData && Array.isArray(boundaryData.offices)
            ? boundaryData.offices
            : [];

        if (boundaryOffices.length === 0) {
            return officeList;
        }

        const boundaryByKey = new Map();
        boundaryOffices.forEach((boundaryOffice) => {
            if (!boundaryOffice || typeof boundaryOffice.key !== 'string') {
                return;
            }

            boundaryByKey.set(boundaryOffice.key, boundaryOffice);
        });

        return officeList.map((office) => {
            if (!office) {
                return office;
            }

            const boundaryOffice = boundaryByKey.get(this.getOfficeKey(office));
            if (!boundaryOffice) {
                return office;
            }

            const mergedOffice = { ...office };

            if (this.isFiniteNumber(boundaryOffice.officeLat) && this.isFiniteNumber(boundaryOffice.officeLng)) {
                mergedOffice.lat = boundaryOffice.officeLat;
                mergedOffice.lng = boundaryOffice.officeLng;
            } else if (this.isFiniteNumber(boundaryOffice.lat) && this.isFiniteNumber(boundaryOffice.lng)) {
                mergedOffice.lat = boundaryOffice.lat;
                mergedOffice.lng = boundaryOffice.lng;
            }

            const mergedEntrance = this.normalizeLatLng(boundaryOffice.entrance)
                || this.normalizeLatLng({ lat: boundaryOffice.entranceLat, lng: boundaryOffice.entranceLng });

            if (mergedEntrance) {
                mergedOffice.entrances = [mergedEntrance];

                if (Array.isArray(mergedOffice.walkingPath) && mergedOffice.walkingPath.length > 0) {
                    mergedOffice.walkingPath = [
                        ...mergedOffice.walkingPath.slice(0, -1),
                        mergedEntrance
                    ];
                }
            }

            const mergedPolygon = this.normalizePolygon(boundaryOffice.polygon);
            if (mergedPolygon) {
                mergedOffice.polygon = mergedPolygon;
            }

            return mergedOffice;
        });
    }

    isFiniteNumber(value) {
        return Number.isFinite(value);
    }

    isValidCoordinatePair(point) {
        return !!(point && this.isFiniteNumber(point.lat) && this.isFiniteNumber(point.lng));
    }

    normalizeLatLng(point) {
        if (!this.isValidCoordinatePair(point)) {
            return null;
        }

        return { lat: point.lat, lng: point.lng };
    }

    normalizePolygon(polygon) {
        if (!Array.isArray(polygon)) {
            return null;
        }

        const normalizedPolygon = polygon
            .map(point => this.normalizeLatLng(point))
            .filter(Boolean);

        return normalizedPolygon.length >= 3 ? normalizedPolygon : null;
    }

    initMap() {
        // Initialize Leaflet map
        this.map = L.map('map', {
            zoomControl: false,
            maxZoom: 22,
            rotate: true,
            bearing: this.mapRotationDegrees,
            rotateControl: false,
            touchRotate: false,
            shiftKeyRotate: false
        }).setView([this.buildingCenter.lat, this.buildingCenter.lng], 18);
        this.map.on('click', (event) => this.handleMapClick(event));
        this.map.on('mousemove', (event) => this.handleMapMouseMove(event));
        this.map.on('mouseout', () => this.handleMapMouseLeave());
        
        this.baseTileLayers = {
            animated: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 22,
                maxNativeZoom: 19
            }),
            'real-world': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
                maxZoom: 22,
                maxNativeZoom: 19
            })
        };

        this.traceReferenceLayerGroup = L.layerGroup().addTo(this.map);
        this.traceLayerGroup = L.layerGroup().addTo(this.map);
        this.officeBoundaryLayerGroup = L.layerGroup().addTo(this.map);
        this.setMapViewMode(this.activeMapViewMode, { announce: false });
        this.setMapRotation(this.mapRotationDegrees, { announce: false });

        if (this.mapViewToggle) {
            this.mapViewToggle.style.display = 'none';
        }

        if (this.officeTracePanel) {
            this.officeTracePanel.style.display = this.isLocalTestMode ? 'flex' : 'none';
        }

        this.updateTracePanel();

        // Prepare office markers (not shown until an office is selected)
        this.addOfficeMarkers();
    }

    loadOfficeTraceData() {
        try {
            if (Array.isArray(this.legacyOfficeTraceStorageKeys)) {
                this.legacyOfficeTraceStorageKeys.forEach((legacyKey) => {
                    if (legacyKey && legacyKey !== this.officeTraceStorageKey) {
                        window.localStorage.removeItem(legacyKey);
                    }
                });
            }

            const rawValue = window.localStorage.getItem(this.officeTraceStorageKey);
            if (!rawValue) {
                this.officeTraceData = {};
                return;
            }

            const parsedValue = JSON.parse(rawValue);
            this.officeTraceData = parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
        } catch (error) {
            console.warn('Unable to read saved office trace data:', error);
            this.officeTraceData = {};
        }
    }

    persistOfficeTraceData() {
        try {
            window.localStorage.setItem(this.officeTraceStorageKey, JSON.stringify(this.officeTraceData));
        } catch (error) {
            console.warn('Unable to persist office trace data:', error);
            this.showStatus('Unable to save tracing progress on this device.');
        }
    }

    setMapViewMode(mode, { announce = true } = {}) {
        if (!this.map || !this.baseTileLayers || !this.baseTileLayers[mode]) {
            this.activeMapViewMode = mode;
            this.updateMapViewButtons();
            return;
        }

        if (this.activeBaseTileLayer && this.map.hasLayer(this.activeBaseTileLayer)) {
            this.map.removeLayer(this.activeBaseTileLayer);
        }

        this.activeBaseTileLayer = this.baseTileLayers[mode];
        this.activeBaseTileLayer.addTo(this.map);
        this.activeMapViewMode = mode;
        this.updateMapViewButtons();

        if (announce) {
            const viewLabel = mode === 'real-world' ? 'Real-world aerial view enabled.' : 'Animated map view enabled.';
            this.showStatus(viewLabel);
        }
    }

    toggleMapViewMode() {
        const nextMode = this.activeMapViewMode === 'animated' ? 'real-world' : 'animated';
        this.setMapViewMode(nextMode);
    }

    rotateMapByDegrees(deltaDegrees) {
        this.setMapRotation(this.mapRotationDegrees + deltaDegrees);
    }

    setMapRotation(degrees, { announce = true } = {}) {
        const normalizedDegrees = ((Math.round(degrees) % 360) + 360) % 360;
        this.mapRotationDegrees = normalizedDegrees;

        if (this.map && typeof this.map.setBearing === 'function') {
            this.map.setBearing(this.mapRotationDegrees);
        }

        this.updateTracePanel();

        if (announce) {
            this.showStatus(`Map rotation ${this.mapRotationDegrees}°.`);
        }
    }

    updateMapViewButtons() {
        const isAnimated = this.activeMapViewMode === 'animated';

        if (this.animatedViewBtn) {
            this.animatedViewBtn.classList.toggle('is-active', isAnimated);
            this.animatedViewBtn.setAttribute('aria-pressed', isAnimated ? 'true' : 'false');
        }

        if (this.realWorldViewBtn) {
            this.realWorldViewBtn.classList.toggle('is-active', !isAnimated);
            this.realWorldViewBtn.setAttribute('aria-pressed', !isAnimated ? 'true' : 'false');
        }
    }

    getTraceWorkingOfficeCenter(office) {
        if (!office) {
            return null;
        }

        const savedRecord = this.getEffectiveTraceRecord(office);
        if (savedRecord && Number.isFinite(savedRecord.officeLat) && Number.isFinite(savedRecord.officeLng)) {
            return { lat: savedRecord.officeLat, lng: savedRecord.officeLng };
        }

        if (Number.isFinite(office.lat) && Number.isFinite(office.lng)) {
            return { lat: office.lat, lng: office.lng };
        }

        return null;
    }

    getTraceWorkingEntrancePoint(office) {
        if (!office) {
            return null;
        }

        const savedRecord = this.getEffectiveTraceRecord(office);
        if (savedRecord && Number.isFinite(savedRecord.entranceLat) && Number.isFinite(savedRecord.entranceLng)) {
            return { lat: savedRecord.entranceLat, lng: savedRecord.entranceLng };
        }

        return this.getOfficeEntrancePoint(office);
    }

    getEffectiveTraceRecord(office) {
        if (!office) {
            return null;
        }

        const savedRecord = this.getSavedTraceRecord(office);
        const officePolygon = this.normalizePolygon(office.polygon);
        const entrancePoint = this.normalizeLatLng(this.getOfficeEntrancePoint(office));

        if (savedRecord) {
            return {
                ...savedRecord,
                officeLat: Number.isFinite(savedRecord.officeLat) ? savedRecord.officeLat : office.lat,
                officeLng: Number.isFinite(savedRecord.officeLng) ? savedRecord.officeLng : office.lng,
                entranceLat: Number.isFinite(savedRecord.entranceLat) ? savedRecord.entranceLat : entrancePoint?.lat,
                entranceLng: Number.isFinite(savedRecord.entranceLng) ? savedRecord.entranceLng : entrancePoint?.lng,
                polygon: this.normalizePolygon(savedRecord.polygon) || officePolygon
            };
        }

        if (!officePolygon && !this.isValidCoordinatePair(office) && !entrancePoint) {
            return null;
        }

        return {
            name: office.name,
            unit: office.unit || '',
            officeLat: office.lat,
            officeLng: office.lng,
            entranceLat: entrancePoint?.lat,
            entranceLng: entrancePoint?.lng,
            polygon: officePolygon,
            savedAt: null
        };
    }

    ensureTraceRecord(office) {
        if (!office) {
            return null;
        }

        const officeKey = this.getOfficeKey(office);
        const existingRecord = this.officeTraceData[officeKey];
        if (existingRecord && typeof existingRecord === 'object') {
            return existingRecord;
        }

        const officeCenter = this.getTraceWorkingOfficeCenter(office) || { lat: office.lat, lng: office.lng };
        const entrancePoint = this.getOfficeEntrancePoint(office) || officeCenter;
        const newRecord = {
            name: office.name,
            unit: office.unit || '',
            officeLat: officeCenter.lat,
            officeLng: officeCenter.lng,
            entranceLat: entrancePoint.lat,
            entranceLng: entrancePoint.lng,
            polygon: null,
            savedAt: null
        };

        this.officeTraceData[officeKey] = newRecord;
        return newRecord;
    }

    setTraceEditTarget(target, { announce = true } = {}) {
        const nextTarget = target === 'office' || target === 'entrance' ? target : 'border';
        this.traceEditTarget = nextTarget;

        if (this.traceSetOfficePointBtn) {
            const isOfficeTarget = nextTarget === 'office';
            this.traceSetOfficePointBtn.classList.toggle('is-active', isOfficeTarget);
            this.traceSetOfficePointBtn.setAttribute('aria-pressed', isOfficeTarget ? 'true' : 'false');
        }

        if (this.traceSetEntrancePointBtn) {
            const isEntranceTarget = nextTarget === 'entrance';
            this.traceSetEntrancePointBtn.classList.toggle('is-active', isEntranceTarget);
            this.traceSetEntrancePointBtn.setAttribute('aria-pressed', isEntranceTarget ? 'true' : 'false');
        }

        this.updateTracePanel();

        if (!announce || !this.traceModeActive) {
            return;
        }

        if (nextTarget === 'office') {
            this.showStatus('Click the map to update the office center coordinate.');
        } else if (nextTarget === 'entrance') {
            this.showStatus('Click the map to update the entrance coordinate.');
        } else {
            this.showStatus('Border tracing mode active.');
        }
    }

    setTraceModeActive(active) {
        this.traceModeActive = !!active;

        if (document.body) {
            document.body.classList.toggle('trace-mode-active', this.traceModeActive);
        }

        if (this.toggleTraceModeBtn) {
            this.toggleTraceModeBtn.textContent = this.traceModeActive ? 'Exit Trace Mode' : 'Trace Offices';
            this.toggleTraceModeBtn.setAttribute('aria-pressed', this.traceModeActive ? 'true' : 'false');
        }

        if (!this.traceModeActive) {
            this.setTraceEditTarget('border', { announce: false });
            this.hideTraceReferenceDots();
            this.traceHoverLatLng = null;
            this.updateTraceDrawing();
            this.updateTracePanel();
            return;
        }

        this.setTestingModePickActive(false);
        this.closePanorama();
        this.clearRoute();
        this.setTraceEditTarget('border', { announce: false });

        if (this.landingMenu) {
            this.landingMenu.style.display = 'none';
        }

        if (this.mapContainer) {
            this.mapContainer.style.display = 'block';
            this.mapContainer.style.visibility = 'visible';
        }

        if (!this.offices.length) {
            this.showTraceReferenceDots();
            this.updateTracePanel();
            return;
        }

        this.showTraceReferenceDots();

        const startingIndex = this.findNextTraceOfficeIndex(0);
        if (startingIndex >= 0) {
            this.setCurrentTraceOfficeIndex(startingIndex, { announce: true, preferSavedShape: false });
        } else {
            this.setCurrentTraceOfficeIndex(0, { announce: false, preferSavedShape: true });
            this.showStatus('All offices already have saved shapes. You can review and re-save them or download the JSON.');
        }
    }

    getSavedTraceRecord(office) {
        if (!office) {
            return null;
        }

        const officeKey = this.getOfficeKey(office);
        return this.officeTraceData[officeKey] || null;
    }

    getCurrentTraceOffice() {
        if (this.currentTraceOfficeIndex < 0 || this.currentTraceOfficeIndex >= this.offices.length) {
            return null;
        }

        return this.offices[this.currentTraceOfficeIndex] || null;
    }

    getTraceProgressCount() {
        return this.offices.reduce((count, office) => count + (this.hasCompletedTraceRecord(office) ? 1 : 0), 0);
    }

    hasCompletedTraceRecord(office) {
        const savedRecord = this.getEffectiveTraceRecord(office);
        return !!(savedRecord && Array.isArray(savedRecord.polygon) && savedRecord.polygon.length >= 3);
    }

    getTraceSavedEntryCount() {
        return this.offices.reduce((count, office) => count + (this.getEffectiveTraceRecord(office) ? 1 : 0), 0);
    }

    findNextTraceOfficeIndex(startIndex = 0) {
        if (!Array.isArray(this.offices) || this.offices.length === 0) {
            return -1;
        }

        const safeStartIndex = Math.max(0, Math.min(startIndex, this.offices.length - 1));

        for (let index = safeStartIndex; index < this.offices.length; index += 1) {
            if (!this.hasCompletedTraceRecord(this.offices[index])) {
                return index;
            }
        }

        return -1;
    }

    getNextTraceOfficeIndex(startIndex = 0) {
        if (!Array.isArray(this.offices) || this.offices.length === 0) {
            return -1;
        }

        const officeCount = this.offices.length;
        const normalizedStartIndex = ((startIndex % officeCount) + officeCount) % officeCount;

        for (let offset = 0; offset < officeCount; offset += 1) {
            const index = (normalizedStartIndex + offset) % officeCount;
            if (!this.hasCompletedTraceRecord(this.offices[index])) {
                return index;
            }
        }

        return normalizedStartIndex;
    }

    setCurrentTraceOfficeIndex(index, { announce = false, preferSavedShape = true } = {}) {
        if (!Array.isArray(this.offices) || !this.offices[index]) {
            this.currentTraceOfficeIndex = -1;
            this.currentTraceVertices = [];
            this.currentTraceClosed = false;
            this.traceHoverLatLng = null;
            this.updateTraceDrawing();
            this.updateTracePanel();
            return;
        }

        const office = this.offices[index];
        this.currentTraceOfficeIndex = index;
        this.traceHoverLatLng = null;

        const savedRecord = preferSavedShape
            ? this.getEffectiveTraceRecord(office)
            : (this.getSavedTraceRecord(office) || this.getEffectiveTraceRecord(office));
        if (savedRecord && Array.isArray(savedRecord.polygon) && savedRecord.polygon.length >= 3) {
            this.currentTraceVertices = savedRecord.polygon.map(point => ({ lat: point.lat, lng: point.lng }));
            this.currentTraceClosed = true;
        } else {
            this.currentTraceVertices = [];
            this.currentTraceClosed = false;
        }

        this.hideAllOfficeMarkers();
        this.showTraceReferenceDots();

        if (this.map) {
            const officeCenter = this.getTraceWorkingOfficeCenter(office) || { lat: office.lat, lng: office.lng };
            this.map.setView([officeCenter.lat, officeCenter.lng], 20);
        }

        this.updateTraceDrawing();
        this.updateTracePanel();

        if (announce) {
            this.showStatus(`Tracing ${this.formatOfficeLabel(office)}.`);
        }
    }

    updateTracePanel() {
        if (!this.officeTracePanel) {
            return;
        }

        const officeCount = Array.isArray(this.offices) ? this.offices.length : 0;
        const savedCount = this.getTraceProgressCount();
        const savedEntryCount = this.getTraceSavedEntryCount();
        const currentOffice = this.getCurrentTraceOffice();
        const vertexCount = this.currentTraceVertices.length;
        const canSave = this.traceModeActive && vertexCount >= 3 && !!currentOffice;

        if (this.officeTraceTitle) {
            this.officeTraceTitle.textContent = this.traceModeActive && currentOffice
                ? this.formatOfficeLabel(currentOffice)
                : 'Ready to trace';
        }

        if (this.officeTraceStatus) {
            if (!this.traceModeActive) {
                this.officeTraceStatus.textContent = 'Turn on Trace Offices, then click around each suite to capture the exact outline.';
            } else if (!currentOffice) {
                this.officeTraceStatus.textContent = 'No offices available to trace.';
            } else if (this.traceEditTarget === 'office') {
                this.officeTraceStatus.textContent = `Click the new office-center location for ${this.formatOfficeLabel(currentOffice)}.`;
            } else if (this.traceEditTarget === 'entrance') {
                this.officeTraceStatus.textContent = `Click the new entrance location for ${this.formatOfficeLabel(currentOffice)}.`;
            } else if (this.currentTraceClosed) {
                this.officeTraceStatus.textContent = 'Shape closed. Save it to move to the next office, or reset it to start over.';
            } else if (vertexCount === 0) {
                this.officeTraceStatus.textContent = 'Click the map to drop the first corner. Keep adding points in order around the office boundary.';
            } else if (vertexCount < 3) {
                this.officeTraceStatus.textContent = 'Add more corners. Save & Next stores the border plus the current office and entrance coordinates.';
            } else {
                this.officeTraceStatus.textContent = 'Keep tracing around the office. The dark dot is the office center and the orange dot is the entrance.';
            }
        }

        if (this.officeTraceProgress) {
            this.officeTraceProgress.textContent = `${savedCount} of ${officeCount} saved`;
        }

        if (this.officeTraceVertexCount) {
            const closedSuffix = this.currentTraceClosed ? ' | closed' : '';
            this.officeTraceVertexCount.textContent = `${vertexCount} ${vertexCount === 1 ? 'point' : 'points'}${closedSuffix}`;
        }

        if (this.officeTraceRotation) {
            const snapText = this.traceAxisSnapEnabled ? ' | Snap On' : ' | Snap Off';
            this.officeTraceRotation.textContent = `Rotation ${this.mapRotationDegrees}°${snapText}`;
        }

        if (this.officeTracePanel) {
            this.officeTracePanel.classList.toggle('is-active', this.traceModeActive);
        }

        if (this.traceUndoBtn) {
            this.traceUndoBtn.disabled = !this.traceModeActive || vertexCount === 0;
        }

        if (this.traceResetBtn) {
            this.traceResetBtn.disabled = !this.traceModeActive || vertexCount === 0;
        }

        if (this.traceSaveNextBtn) {
            this.traceSaveNextBtn.disabled = !canSave;
        }

        if (this.traceSkipBtn) {
            this.traceSkipBtn.disabled = !this.traceModeActive || !currentOffice;
        }

        if (this.traceDownloadBtn) {
            this.traceDownloadBtn.disabled = savedEntryCount === 0;
        }
    }

    handleMapMouseMove(event) {
        if (!this.traceModeActive || this.currentTraceClosed || !event || !event.latlng) {
            return;
        }

        this.traceHoverLatLng = this.getTracePointWithOptionalAxisLock({
            lat: event.latlng.lat,
            lng: event.latlng.lng
        });
        this.updateTraceDrawing();
    }

    handleMapMouseLeave() {
        if (!this.traceModeActive || this.currentTraceClosed) {
            return;
        }

        this.traceHoverLatLng = null;
        this.updateTraceDrawing();
    }

    handleTraceMapClick(event) {
        if (!this.traceModeActive || !event || !event.latlng) {
            return false;
        }

        if (this.traceEditTarget === 'office' || this.traceEditTarget === 'entrance') {
            return this.handleTraceCoordinateEdit(event.latlng);
        }

        if (this.currentTraceClosed) {
            this.showStatus('This shape is already closed. Save it, reset it, or move to the next office.');
            return true;
        }

        const clickedPoint = { lat: event.latlng.lat, lng: event.latlng.lng };
        const resolvedPoint = this.getTracePointWithOptionalAxisLock(clickedPoint);
        this.currentTraceVertices.push(resolvedPoint);
        this.traceHoverLatLng = resolvedPoint;
        this.updateTraceDrawing();
        this.updateTracePanel();
        return true;
    }

    handleTraceCoordinateEdit(latlng) {
        const office = this.getCurrentTraceOffice();
        if (!office || !latlng) {
            return false;
        }

        const traceRecord = this.ensureTraceRecord(office);
        if (!traceRecord) {
            return false;
        }

        if (this.traceEditTarget === 'office') {
            traceRecord.officeLat = latlng.lat;
            traceRecord.officeLng = latlng.lng;
            traceRecord.savedAt = new Date().toISOString();
            this.persistOfficeTraceData();
            this.showTraceReferenceDots();
            this.updateTracePanel();
            this.setTraceEditTarget('border', { announce: false });
            this.showStatus(`Updated office coordinate for ${this.formatOfficeLabel(office)}.`);
            return true;
        }

        if (this.traceEditTarget === 'entrance') {
            traceRecord.entranceLat = latlng.lat;
            traceRecord.entranceLng = latlng.lng;
            traceRecord.savedAt = new Date().toISOString();
            this.persistOfficeTraceData();
            this.showTraceReferenceDots();
            this.updateTracePanel();
            this.setTraceEditTarget('border', { announce: false });
            this.showStatus(`Updated entrance coordinate for ${this.formatOfficeLabel(office)}.`);
            return true;
        }

        return false;
    }

    getTracePointWithOptionalAxisLock(point) {
        if (!this.traceAxisSnapEnabled) {
            return point;
        }

        return this.getOrthogonallySnappedTracePoint(point);
    }

    getOrthogonallySnappedTracePoint(point) {
        if (!point || !this.map || this.currentTraceVertices.length === 0) {
            return point;
        }

        const lastPoint = this.currentTraceVertices[this.currentTraceVertices.length - 1];
        const lastContainerPoint = this.map.latLngToContainerPoint([lastPoint.lat, lastPoint.lng]);
        const currentContainerPoint = this.map.latLngToContainerPoint([point.lat, point.lng]);
        const deltaX = currentContainerPoint.x - lastContainerPoint.x;
        const deltaY = currentContainerPoint.y - lastContainerPoint.y;

        if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
            return point;
        }

        const angleDegrees = Math.atan2(Math.abs(deltaY), Math.abs(deltaX)) * 180 / Math.PI;

        if (angleDegrees <= this.traceAxisSnapAngleDegrees) {
            const snappedLatLng = this.map.containerPointToLatLng([
                currentContainerPoint.x,
                lastContainerPoint.y
            ]);
            return { lat: snappedLatLng.lat, lng: snappedLatLng.lng };
        }

        if (angleDegrees >= (90 - this.traceAxisSnapAngleDegrees)) {
            const snappedLatLng = this.map.containerPointToLatLng([
                lastContainerPoint.x,
                currentContainerPoint.y
            ]);
            return { lat: snappedLatLng.lat, lng: snappedLatLng.lng };
        }

        return point;
    }

    isTextInputTarget(target) {
        if (!(target instanceof HTMLElement)) {
            return false;
        }

        const tagName = target.tagName;
        if (target.isContentEditable) {
            return true;
        }

        return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    }

    showTraceReferenceDots() {
        if (!this.traceReferenceLayerGroup) {
            return;
        }

        this.traceReferenceLayerGroup.clearLayers();

        const office = this.getCurrentTraceOffice();
        if (!office) {
            return;
        }

        const officeCenter = this.getTraceWorkingOfficeCenter(office);
        const entrancePoint = this.getTraceWorkingEntrancePoint(office);

        if (officeCenter) {
            L.circleMarker([officeCenter.lat, officeCenter.lng], {
                radius: 5,
                color: '#000000',
                weight: 1.2,
                fillColor: '#000000',
                fillOpacity: 1,
                interactive: false,
                keyboard: false
            }).addTo(this.traceReferenceLayerGroup);
        }

        if (entrancePoint) {
            L.circleMarker([entrancePoint.lat, entrancePoint.lng], {
                radius: 4,
                color: '#c24d1d',
                weight: 1,
                fillColor: '#ff8a1f',
                fillOpacity: 1,
                interactive: false,
                keyboard: false
            }).addTo(this.traceReferenceLayerGroup);
        }
    }

    hideTraceReferenceDots() {
        if (!this.traceReferenceLayerGroup) {
            return;
        }

        this.traceReferenceLayerGroup.clearLayers();
    }

    updateTraceDrawing() {
        if (!this.traceLayerGroup) {
            return;
        }

        this.traceLayerGroup.clearLayers();

        if (!this.traceModeActive || this.currentTraceVertices.length === 0) {
            return;
        }

        const vertexLatLngs = this.currentTraceVertices.map(point => [point.lat, point.lng]);
        const drawColor = '#1e63ff';
        const firstPoint = this.currentTraceVertices[0];
        const previewPoint = this.traceHoverLatLng ? [this.traceHoverLatLng.lat, this.traceHoverLatLng.lng] : null;

        if (!this.currentTraceClosed && this.map) {
            const firstContainerPoint = this.map.latLngToContainerPoint([firstPoint.lat, firstPoint.lng]);
            const mapSize = this.map.getSize();
            const horizontalGuide = [
                this.map.containerPointToLatLng([0, firstContainerPoint.y]),
                this.map.containerPointToLatLng([mapSize.x, firstContainerPoint.y])
            ];
            const verticalGuide = [
                this.map.containerPointToLatLng([firstContainerPoint.x, 0]),
                this.map.containerPointToLatLng([firstContainerPoint.x, mapSize.y])
            ];

            L.polyline(horizontalGuide, {
                color: '#5f7cff',
                weight: 1,
                opacity: 0.58,
                dashArray: '2 6',
                interactive: false
            }).addTo(this.traceLayerGroup);

            L.polyline(verticalGuide, {
                color: '#5f7cff',
                weight: 1,
                opacity: 0.58,
                dashArray: '2 6',
                interactive: false
            }).addTo(this.traceLayerGroup);
        }

        if (this.currentTraceClosed) {
            L.polygon(vertexLatLngs, {
                color: drawColor,
                weight: 3,
                fillColor: drawColor,
                fillOpacity: 0.18
            }).addTo(this.traceLayerGroup);
        } else {
            L.polyline(vertexLatLngs, {
                color: drawColor,
                weight: 3,
                opacity: 0.96
            }).addTo(this.traceLayerGroup);

            if (previewPoint) {
                const lastPoint = this.currentTraceVertices[this.currentTraceVertices.length - 1];
                L.polyline([
                    [lastPoint.lat, lastPoint.lng],
                    previewPoint
                ], {
                    color: drawColor,
                    weight: 2,
                    opacity: 0.68,
                    dashArray: '6 8'
                }).addTo(this.traceLayerGroup);
            }
        }

        this.currentTraceVertices.forEach((point, index) => {
            const isFirstPoint = index === 0;
            L.circleMarker([point.lat, point.lng], {
                radius: isFirstPoint ? 7 : 5,
                color: '#ffffff',
                weight: 2,
                fillColor: isFirstPoint ? '#ff8a1f' : drawColor,
                fillOpacity: 1
            }).addTo(this.traceLayerGroup);
        });

        if (!this.currentTraceClosed && this.currentTraceVertices.length >= 3) {
            L.circleMarker([firstPoint.lat, firstPoint.lng], {
                radius: 9,
                color: 'rgba(30, 99, 255, 0.55)',
                weight: 2,
                fillColor: 'rgba(255, 138, 31, 0.12)',
                fillOpacity: 0.12
            }).addTo(this.traceLayerGroup);
        }
    }

    undoTracePoint() {
        if (!this.traceModeActive || this.currentTraceVertices.length === 0) {
            return;
        }

        if (this.currentTraceClosed) {
            this.currentTraceClosed = false;
            this.showStatus('Shape reopened.');
        } else {
            this.currentTraceVertices.pop();
        }

        this.updateTraceDrawing();
        this.updateTracePanel();
    }

    resetCurrentTraceShape({ announce = false } = {}) {
        this.currentTraceVertices = [];
        this.currentTraceClosed = false;
        this.traceHoverLatLng = null;
        this.updateTraceDrawing();
        this.updateTracePanel();

        if (announce) {
            this.showStatus('Current office outline cleared.');
        }
    }

    saveCurrentTraceAndAdvance() {
        const office = this.getCurrentTraceOffice();
        if (!office || this.currentTraceVertices.length < 3) {
            this.showStatus('Add at least 3 points before saving the outline.');
            return;
        }

        this.currentTraceClosed = true;

        const officeKey = this.getOfficeKey(office);
        const traceRecord = this.ensureTraceRecord(office);
        const officeCenter = this.getTraceWorkingOfficeCenter(office) || { lat: office.lat, lng: office.lng };
        const entrancePoint = this.getTraceWorkingEntrancePoint(office) || officeCenter;
        this.officeTraceData[officeKey] = {
            ...(traceRecord || {}),
            name: office.name,
            unit: office.unit || '',
            officeLat: officeCenter.lat,
            officeLng: officeCenter.lng,
            entranceLat: entrancePoint.lat,
            entranceLng: entrancePoint.lng,
            polygon: this.currentTraceVertices.map(point => ({ lat: point.lat, lng: point.lng })),
            savedAt: new Date().toISOString()
        };
        this.persistOfficeTraceData();
        this.showTraceReferenceDots();

        const savedLabel = this.formatOfficeLabel(office);
        this.advanceTraceOffice({
            announce: true,
            savedLabel
        });
    }

    advanceTraceOffice({ announce = true, skipCurrent = false, savedLabel = '' } = {}) {
        if (!Array.isArray(this.offices) || this.offices.length === 0) {
            return;
        }

        const currentIndex = Math.max(0, this.currentTraceOfficeIndex);
        const nextIndex = this.getNextTraceOfficeIndex(currentIndex + 1);
        if (nextIndex >= 0) {
            this.setCurrentTraceOfficeIndex(nextIndex, { announce: false, preferSavedShape: false });
            if (announce) {
                const prefix = skipCurrent ? 'Skipped current office.' : (savedLabel ? `Saved ${savedLabel}.` : 'Saved office outline.');
                this.showStatus(`${prefix} Next up: ${this.formatOfficeLabel(this.offices[nextIndex])}.`);
            }
            return;
        }

        this.updateTracePanel();
        if (announce) {
            const completionPrefix = skipCurrent ? 'Reached the end of the office list.' : (savedLabel ? `Saved ${savedLabel}.` : 'Saved office outline.');
            this.showStatus(`${completionPrefix} All remaining offices are complete.`);
        }
    }

    downloadOfficeTraceData() {
        const savedEntryCount = this.getTraceSavedEntryCount();
        if (savedEntryCount === 0) {
            this.showStatus('No saved office trace data to download yet.');
            return;
        }

        const exportPayload = {
            exportedAt: new Date().toISOString(),
            buildingCenter: this.buildingCenter,
            offices: this.offices.map(office => {
                const officeKey = this.getOfficeKey(office);
                const savedRecord = this.officeTraceData[officeKey] || null;
                return {
                    key: officeKey,
                    name: office.name,
                    unit: office.unit || '',
                    lat: savedRecord && Number.isFinite(savedRecord.officeLat) ? savedRecord.officeLat : office.lat,
                    lng: savedRecord && Number.isFinite(savedRecord.officeLng) ? savedRecord.officeLng : office.lng,
                    officeLat: savedRecord && Number.isFinite(savedRecord.officeLat) ? savedRecord.officeLat : office.lat,
                    officeLng: savedRecord && Number.isFinite(savedRecord.officeLng) ? savedRecord.officeLng : office.lng,
                    entranceLat: savedRecord && Number.isFinite(savedRecord.entranceLat) ? savedRecord.entranceLat : (this.getOfficeEntrancePoint(office)?.lat ?? null),
                    entranceLng: savedRecord && Number.isFinite(savedRecord.entranceLng) ? savedRecord.entranceLng : (this.getOfficeEntrancePoint(office)?.lng ?? null),
                    entrance: savedRecord && Number.isFinite(savedRecord.entranceLat) && Number.isFinite(savedRecord.entranceLng)
                        ? { lat: savedRecord.entranceLat, lng: savedRecord.entranceLng }
                        : this.getOfficeEntrancePoint(office),
                    polygon: savedRecord ? savedRecord.polygon : null,
                    savedAt: savedRecord ? savedRecord.savedAt || null : null
                };
            })
        };

        const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'office-boundaries.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        this.showStatus('Downloaded office boundary JSON.');
    }

    setupTestLocationControls() {
        if (!this.testLocationPanel) {
            return;
        }

        this.testLocationPanel.style.display = this.isLocalTestMode ? 'flex' : 'none';
        this.updateTestLocationControls();
    }

    updateTestLocationControls() {
        if (!this.testLocationPanel) {
            return;
        }

        this.testLocationPanel.style.display = this.isLocalTestMode ? 'flex' : 'none';

        if (this.testModePickPointBtn) {
            this.testModePickPointBtn.classList.toggle('is-active', this.testingModePickActive);
            this.testModePickPointBtn.setAttribute('aria-pressed', this.testingModePickActive ? 'true' : 'false');
        }

        if (this.testLocationStatusEl) {
            const activeLocation = this.testingModeLocation || this.testingModeStartLocation;
            const locationText = activeLocation
                ? `${activeLocation.lat.toFixed(6)}, ${activeLocation.lng.toFixed(6)}`
                : '';
            this.testLocationStatusEl.textContent = this.testingModePickActive
                ? `Tap the map to move the marker. Current: ${locationText}`
                : `Marker at ${locationText}`;
        }
    }

    updateOfficeTestControls() {
        this.updateTestLocationControls();
    }

    updateTestPanoramaControl(office = null) {
        return;
    }

    getOfficeTestIndex(office) {
        if (!office || !Array.isArray(this.offices)) {
            return -1;
        }

        const targetKey = this.getOfficeKey(office);
        return this.offices.findIndex(candidate => this.getOfficeKey(candidate) === targetKey);
    }

    syncOfficeTestSelection(office) {
        const officeIndex = this.getOfficeTestIndex(office);
        if (officeIndex >= 0) {
            this.activeOfficeTestIndex = officeIndex;
        }

        this.updateOfficeTestControls();
    }

    navigateOfficeForTesting(direction) {
        if (!Array.isArray(this.offices) || this.offices.length === 0) {
            return;
        }

        const officeCount = this.offices.length;
        const currentIndex = this.activeOfficeTestIndex >= 0 ? this.activeOfficeTestIndex : 0;
        const nextIndex = (currentIndex + direction + officeCount) % officeCount;
        this.selectOfficeByTestIndex(nextIndex);
    }

    selectOfficeByTestIndex(index, { announce = true } = {}) {
        const office = Array.isArray(this.offices) ? this.offices[index] : null;
        if (!office) {
            return;
        }

        this.activeOfficeTestIndex = index;
        this.updateOfficeTestControls();
        this.selectOffice(office);

        if (announce) {
            this.showStatus(`Testing ${this.formatOfficeLabel(office)} (${index + 1} of ${this.offices.length}).`);
        }
    }

    buildSimulatedPosition(lat, lng, accuracy = 5) {
        return {
            coords: {
                latitude: lat,
                longitude: lng,
                accuracy
            }
        };
    }

    stopLiveLocationWatch() {
        if (!this.watchId || !navigator.geolocation || typeof navigator.geolocation.clearWatch !== 'function') {
            this.watchId = null;
            return;
        }

        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
    }

    removeUserLocationArtifacts() {
        if (this.userMarker && this.map && this.map.hasLayer(this.userMarker)) {
            this.map.removeLayer(this.userMarker);
        }
        this.userMarker = null;

        if (this.accuracyCircle && this.map && this.map.hasLayer(this.accuracyCircle)) {
            this.map.removeLayer(this.accuracyCircle);
        }
        this.accuracyCircle = null;
        this.lastRouteUpdatePosition = null;
    }

    setTestingModePickActive(active) {
        this.testingModePickActive = !!active && this.isLocalTestMode;

        if (document.body) {
            document.body.classList.toggle('testing-mode-targeting', this.testingModePickActive);
        }

        this.updateTestLocationControls();
    }

    applyTestingModePosition(lat, lng, { announce = true, centerMap = false } = {}) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
        }

        this.testingModeLocation = { lat, lng };
        this.hideLocationPrompt();
        this.hideLocationInstructions();
        this.lastRouteUpdatePosition = null;
        this.updateUserLocation(this.buildSimulatedPosition(lat, lng));

        if (centerMap && this.map) {
            this.map.setView([lat, lng], 18);
        }

        this.updateTestLocationControls();

        if (announce) {
            this.showStatus(`Testing marker moved to ${lat.toFixed(6)}, ${lng.toFixed(6)}.`);
        }
    }

    enterTestingMode({ announce = true, centerMap = true } = {}) {
        this.isLocalTestMode = true;
        this.stopLiveLocationWatch();
        this.setupTestLocationControls();
        this.setTestingModePickActive(false);
        this.updateDeveloperModeButton();

        if (this.officeTracePanel) {
            this.officeTracePanel.style.display = 'flex';
        }

        if (this.landingMenu) {
            this.landingMenu.style.display = 'none';
        }
        if (this.mapContainer) {
            this.mapContainer.style.display = 'block';
            this.mapContainer.style.visibility = 'visible';
        }
        this.invalidateMapLayout(40);

        this.applyTestingModePosition(this.testingModeStartLocation.lat, this.testingModeStartLocation.lng, {
            announce: false,
            centerMap
        });

        if (announce) {
            this.showStatus('Testing mode enabled. Marker placed at the default test position.');
        }
    }

    exitTestingMode({ announce = true } = {}) {
        if (!this.isLocalTestMode) {
            return;
        }

        this.isLocalTestMode = false;
        this.testingModeLocation = null;
        this.setupTestLocationControls();
        this.setTestingModePickActive(false);
        this.setTraceModeActive(false);
        this.updateDeveloperModeButton();

        if (this.officeTracePanel) {
            this.officeTracePanel.style.display = 'none';
        }

        this.removeUserLocationArtifacts();
        this.clearRoute();
        this.checkLocationPermission();

        if (announce) {
            this.showStatus('Testing mode disabled. Live location is restored when permission is available.');
        }
    }

    handleMapClick(event) {
        if (this.traceModeActive) {
            this.handleTraceMapClick(event);
            return;
        }

        if (!this.isLocalTestMode || !this.testingModePickActive || !event || !event.latlng) {
            return;
        }

        this.applyTestingModePosition(event.latlng.lat, event.latlng.lng, { announce: true, centerMap: false });
        this.setTestingModePickActive(false);
    }

    applyTestLocation(index, { announce = true, centerMap = false } = {}) {
        const location = this.testLocations[index];
        if (!location) {
            return;
        }

        this.activeTestLocationIndex = index;
        this.applyTestingModePosition(location.lat, location.lng, { announce, centerMap });
    }

    getOfficeKey(office) {
        const unitPart = office.unit ? `__${office.unit}` : '';
        return `${office.name}${unitPart}`;
    }

    getBaseOfficeName(office) {
        if (!office || typeof office.name !== 'string') {
            return '';
        }

        const rawName = office.name.trim();
        if (!office.unit) {
            return rawName;
        }

        const unitSuffixMatch = rawName.match(/\(\s*Unit\s+([^\)]+)\s*\)$/i);
        if (!unitSuffixMatch) {
            return rawName;
        }

        const matchedUnit = unitSuffixMatch[1].trim().toLowerCase();
        const expectedUnit = String(office.unit).trim().toLowerCase();
        if (matchedUnit !== expectedUnit) {
            return rawName;
        }

        return rawName.replace(/\s*\(\s*Unit\s+[^\)]+\s*\)$/i, '').trim();
    }

    formatOfficeLabel(office, separator = ' - ') {
        const baseName = this.getBaseOfficeName(office);
        if (!office || !office.unit) {
            return baseName;
        }

        return `Unit ${office.unit}${separator}${baseName}`;
    }

    createSvgDataUrl(svgMarkup) {
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`;
    }

    escapeHtml(text) {
        if (text === null || text === undefined) {
            return '';
        }

        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    truncateMarkerText(text, maxLength = 28) {
        if (typeof text !== 'string') {
            return '';
        }

        if (text.length <= maxLength) {
            return text;
        }

        return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
    }

    buildOfficeMarkerHtml(office, { expanded = false } = {}) {
        const fullLabel = this.formatOfficeLabel(office);
        const markerTitle = expanded
            ? fullLabel
            : this.truncateMarkerText(fullLabel, 35);

        return `
            <div class="office-pin${expanded ? ' is-expanded' : ''}" aria-hidden="true" title="${this.escapeHtml(fullLabel)}">
                <span class="office-pin__title">${this.escapeHtml(markerTitle)}</span>
                <svg class="office-pin__svg" viewBox="0 0 36 46" focusable="false" aria-hidden="true">
                    <defs>
                        <linearGradient id="officePinBody" x1="18" y1="3" x2="18" y2="37" gradientUnits="userSpaceOnUse">
                            <stop offset="0" stop-color="#5e6b61"/>
                            <stop offset="0.58" stop-color="#414b43"/>
                            <stop offset="1" stop-color="#283028"/>
                        </linearGradient>
                    </defs>
                    <ellipse cx="18" cy="42" rx="9" ry="3.5" fill="rgba(20,24,21,0.18)"/>
                    <path d="M18 2.8c-8.3 0-15 6.5-15 14.7c0 11 10.9 13.8 14.2 24.5c.2.7 1.2.7 1.5 0C22.1 31.3 33 28.5 33 17.5C33 9.3 26.3 2.8 18 2.8Z" fill="url(#officePinBody)" stroke="#ffffff" stroke-width="2.2"/>
                    <path d="M10.2 12.1h15.6v12.8H10.2V12.1Zm2.6 2.4v3.1h2.9v-3.1h-2.9Zm4.2 0v3.1h2.1v-3.1H17Zm3.4 0v3.1h2.9v-3.1h-2.9Zm-7.6 4.4V24h2.9v-5.1h-2.9Zm4.2 0V24h2.1v-5.1H17Zm3.4 0V24h2.9v-5.1h-2.9Zm-5.1 9h5.4v7.3h-5.4v-7.3Z" fill="#f4efe7"/>
                </svg>
            </div>
        `;
    }

    createOfficeMarkerIcon(office, expanded = false) {
        return L.divIcon({
            className: 'office-marker',
            html: this.buildOfficeMarkerHtml(office, { expanded }),
            iconSize: [420, 150],
            iconAnchor: [18, 42]
        });
    }

    createOfficeMarker(office) {
        const marker = L.marker([office.lat, office.lng], {
            icon: this.createOfficeMarkerIcon(office, false)
        });

        marker.officeData = office;
        marker.isExpanded = false;
        marker.on('click', () => {
            this.setOfficeMarkerExpanded(marker, true);
        });

        return marker;
    }

    updateOfficeMarkerAppearance(marker, expanded) {
        if (!marker || !marker.officeData) {
            return;
        }

        marker.isExpanded = expanded;
        marker.setIcon(this.createOfficeMarkerIcon(marker.officeData, expanded));
    }

    setOfficeMarkerExpanded(marker, expanded) {
        if (this.expandedOfficeMarker && this.expandedOfficeMarker !== marker) {
            this.updateOfficeMarkerAppearance(this.expandedOfficeMarker, false);
            this.expandedOfficeMarker = null;
        }

        if (!marker || !expanded) {
            if (this.expandedOfficeMarker) {
                this.updateOfficeMarkerAppearance(this.expandedOfficeMarker, false);
                this.expandedOfficeMarker = null;
            }
            return;
        }

        this.updateOfficeMarkerAppearance(marker, true);
        this.expandedOfficeMarker = marker;
    }

    isOfficeMarkerTarget(target) {
        return !!(target && typeof target.closest === 'function' && target.closest('.office-marker'));
    }

    addOfficeMarkers() {
        // Cache markers but do not show them by default
        this.offices.forEach(office => {
            const key = this.getOfficeKey(office);
            if (!this.officeMarkers.has(key)) {
                this.officeMarkers.set(key, this.createOfficeMarker(office));
            }
        });
    }

    buildNavigationNodeIndex() {
        const panoramaNodes = [];
        const sidewalkNodes = [];

        this.offices.forEach(office => {
            if (office.panorama && office.panorama.lat && office.panorama.lng) {
                panoramaNodes.push({ lat: office.panorama.lat, lng: office.panorama.lng });
            }

            if (Array.isArray(office.walkingPath) && office.walkingPath.length >= 2) {
                const firstPoint = office.walkingPath[0];
                if (firstPoint && typeof firstPoint.lat === 'number' && typeof firstPoint.lng === 'number') {
                    panoramaNodes.push({ lat: firstPoint.lat, lng: firstPoint.lng });
                }

                for (let index = 1; index < office.walkingPath.length - 1; index++) {
                    const point = office.walkingPath[index];
                    if (point && typeof point.lat === 'number' && typeof point.lng === 'number') {
                        sidewalkNodes.push({ lat: point.lat, lng: point.lng });
                    }
                }
            }

            if (office.walkingPathsByEntrance && typeof office.walkingPathsByEntrance === 'object') {
                Object.values(office.walkingPathsByEntrance).forEach(path => {
                    if (!Array.isArray(path) || path.length < 2) {
                        return;
                    }

                    const firstPoint = path[0];
                    if (firstPoint && typeof firstPoint.lat === 'number' && typeof firstPoint.lng === 'number') {
                        panoramaNodes.push({ lat: firstPoint.lat, lng: firstPoint.lng });
                    }

                    for (let index = 1; index < path.length - 1; index++) {
                        const point = path[index];
                        if (point && typeof point.lat === 'number' && typeof point.lng === 'number') {
                            sidewalkNodes.push({ lat: point.lat, lng: point.lng });
                        }
                    }
                });
            }
        });

        this.navigationNodeIndex = {
            panoramas: this.dedupeGeoPoints(panoramaNodes),
            sidewalks: this.dedupeGeoPoints(sidewalkNodes)
        };
    }

    dedupeGeoPoints(points, precision = 7) {
        const uniquePoints = [];
        const seen = new Set();

        points.forEach(point => {
            if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
                return;
            }

            const key = `${point.lat.toFixed(precision)}:${point.lng.toFixed(precision)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniquePoints.push({ lat: point.lat, lng: point.lng });
            }
        });

        return uniquePoints;
    }

    toMeters(point, referenceLatitude) {
        const latToMeters = 110540;
        const lngToMeters = 111320 * Math.cos(referenceLatitude * Math.PI / 180);
        return {
            x: point.lng * lngToMeters,
            y: point.lat * latToMeters
        };
    }

    distancePointToSegmentMeters(point, segmentStart, segmentEnd) {
        const referenceLatitude = (segmentStart.lat + segmentEnd.lat) / 2;
        const pointMeters = this.toMeters(point, referenceLatitude);
        const startMeters = this.toMeters(segmentStart, referenceLatitude);
        const endMeters = this.toMeters(segmentEnd, referenceLatitude);

        const segmentDx = endMeters.x - startMeters.x;
        const segmentDy = endMeters.y - startMeters.y;
        const segmentLengthSquared = segmentDx * segmentDx + segmentDy * segmentDy;

        if (segmentLengthSquared === 0) {
            const dx = pointMeters.x - startMeters.x;
            const dy = pointMeters.y - startMeters.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        const projection = ((pointMeters.x - startMeters.x) * segmentDx + (pointMeters.y - startMeters.y) * segmentDy) / segmentLengthSquared;
        const clampedProjection = Math.max(0, Math.min(1, projection));

        const closestX = startMeters.x + clampedProjection * segmentDx;
        const closestY = startMeters.y + clampedProjection * segmentDy;
        const dx = pointMeters.x - closestX;
        const dy = pointMeters.y - closestY;

        return Math.sqrt(dx * dx + dy * dy);
    }

    calculatePathSmoothnessScore(pathPoints) {
        if (!Array.isArray(pathPoints) || pathPoints.length < 3) {
            return Infinity;
        }

        const panoramaPoint = pathPoints[0];
        const entrancePoint = pathPoints[pathPoints.length - 1];
        let totalDistance = 0;

        for (let index = 0; index < pathPoints.length - 1; index++) {
            const current = pathPoints[index];
            const next = pathPoints[index + 1];
            totalDistance += this.calculateDistance(current.lat, current.lng, next.lat, next.lng);
        }

        const directDistance = this.calculateDistance(
            panoramaPoint.lat,
            panoramaPoint.lng,
            entrancePoint.lat,
            entrancePoint.lng
        );

        const keySidewalkPoint = pathPoints.length >= 3 ? pathPoints[1] : entrancePoint;
        const segmentOffset = this.distancePointToSegmentMeters(keySidewalkPoint, panoramaPoint, entrancePoint);
        const detourPenalty = Math.max(0, totalDistance - directDistance);

        return totalDistance + detourPenalty * 2 + segmentOffset * 1.2;
    }

    findBestPanoramaAndSidewalk(entrancePoint, fallbackPath = null) {
        if (!entrancePoint) {
            return null;
        }

        const fallbackPanorama = Array.isArray(fallbackPath) && fallbackPath.length >= 1 ? fallbackPath[0] : null;
        const fallbackSidewalk = Array.isArray(fallbackPath) && fallbackPath.length >= 2 ? fallbackPath[1] : null;

        const panoramaCandidates = this.dedupeGeoPoints([
            ...this.navigationNodeIndex.panoramas,
            ...(fallbackPanorama ? [fallbackPanorama] : [])
        ]);

        const sidewalkCandidates = this.dedupeGeoPoints([
            ...this.navigationNodeIndex.sidewalks,
            ...(fallbackSidewalk ? [fallbackSidewalk] : [])
        ]);

        if (panoramaCandidates.length === 0 || sidewalkCandidates.length === 0) {
            return null;
        }

        const nearestPanoramaCandidates = panoramaCandidates
            .map(point => ({
                point,
                distanceToEntrance: this.calculateDistance(point.lat, point.lng, entrancePoint.lat, entrancePoint.lng)
            }))
            .sort((left, right) => left.distanceToEntrance - right.distanceToEntrance)
            .slice(0, 5);

        let bestCandidate = null;

        nearestPanoramaCandidates.forEach(panoramaCandidate => {
            const panoramaPoint = panoramaCandidate.point;
            const directDistance = panoramaCandidate.distanceToEntrance;

            sidewalkCandidates.forEach(sidewalkPoint => {
                const distancePanoramaToSidewalk = this.calculateDistance(
                    panoramaPoint.lat,
                    panoramaPoint.lng,
                    sidewalkPoint.lat,
                    sidewalkPoint.lng
                );
                const distanceSidewalkToEntrance = this.calculateDistance(
                    sidewalkPoint.lat,
                    sidewalkPoint.lng,
                    entrancePoint.lat,
                    entrancePoint.lng
                );

                const totalDistance = distancePanoramaToSidewalk + distanceSidewalkToEntrance;
                const detourPenalty = Math.max(0, totalDistance - directDistance);
                const segmentOffset = this.distancePointToSegmentMeters(sidewalkPoint, panoramaPoint, entrancePoint);

                let score = totalDistance + detourPenalty * 2 + segmentOffset * 1.2;

                if (distanceSidewalkToEntrance > directDistance * 1.2) {
                    score += 80;
                }

                if (distancePanoramaToSidewalk > directDistance * 1.5) {
                    score += 40;
                }

                if (!bestCandidate || score < bestCandidate.score) {
                    bestCandidate = {
                        panorama: { lat: panoramaPoint.lat, lng: panoramaPoint.lng },
                        sidewalk: { lat: sidewalkPoint.lat, lng: sidewalkPoint.lng },
                        score
                    };
                }
            });
        });

        return bestCandidate;
    }

    resolveOfficeNavigationPlan(office, userPosition = null) {
        if (!office) {
            return null;
        }

        const entrance = userPosition
            ? this.findClosestEntrance(office, userPosition)
            : this.findClosestEntrance(office, { lat: office.lat, lng: office.lng });

        const fallbackPath = this.getDynamicWalkingPath(office, entrance);
        const bestCandidate = this.findBestPanoramaAndSidewalk(entrance, fallbackPath);

        let selectedPath = fallbackPath && fallbackPath.length >= 2
            ? fallbackPath.map(point => ({ lat: point.lat, lng: point.lng }))
            : null;

        if (bestCandidate) {
            const candidatePath = [bestCandidate.panorama, bestCandidate.sidewalk, entrance];
            const candidateScore = this.calculatePathSmoothnessScore(candidatePath);
            const fallbackScore = this.calculatePathSmoothnessScore(selectedPath);
            const hasEntranceSpecificPaths = !!(office.walkingPathsByEntrance && Object.keys(office.walkingPathsByEntrance).length > 0);
            const improvementThreshold = hasEntranceSpecificPaths ? 20 : 3;

            if (!selectedPath || candidateScore + improvementThreshold < fallbackScore) {
                selectedPath = candidatePath;
            }
        }

        if (!selectedPath || selectedPath.length < 2) {
            if (office.panorama && office.panorama.lat && office.panorama.lng) {
                selectedPath = [
                    { lat: office.panorama.lat, lng: office.panorama.lng },
                    entrance
                ];
            } else {
                selectedPath = [
                    { lat: office.lat, lng: office.lng },
                    entrance
                ];
            }
        }

        const panoramaPoint = selectedPath[0] || (
            office.panorama && office.panorama.lat && office.panorama.lng
                ? { lat: office.panorama.lat, lng: office.panorama.lng }
                : { lat: office.lat, lng: office.lng }
        );

        return {
            entrance,
            panorama: { lat: panoramaPoint.lat, lng: panoramaPoint.lng },
            walkingPath: selectedPath
        };
    }

    getRouteDestinationCoords(office) {
        const entrance = this.getOfficeEntrancePoint(office);
        if (entrance) {
            return [entrance.lat, entrance.lng];
        }

        return office ? [office.lat, office.lng] : null;
    }

    getOfficeEntrancePoint(office) {
        if (!office) {
            return null;
        }

        if (this.selectedOffice === office) {
            if (this.activeRoutePlan && this.activeRoutePlan.entrance) {
                return this.activeRoutePlan.entrance;
            }

            if (this.selectedEntrance) {
                return this.selectedEntrance;
            }
        }

        if (office.entrances && office.entrances.length > 0) {
            return office.entrances[0];
        }

        if (office.walkingPath && office.walkingPath.length > 0) {
            return office.walkingPath[office.walkingPath.length - 1];
        }

        return { lat: office.lat, lng: office.lng };
    }

    renderOfficeBoundaries(selectedOffice = null) {
        if (!this.officeBoundaryLayerGroup) {
            return;
        }

        this.officeBoundaryLayerGroup.clearLayers();
        this.officeBoundaryLayers = [];

        if (!selectedOffice || !Array.isArray(selectedOffice.polygon) || selectedOffice.polygon.length < 3) {
            return;
        }

        const polygonLatLngs = selectedOffice.polygon
            .map(point => this.normalizeLatLng(point))
            .filter(Boolean)
            .map(point => [point.lat, point.lng]);

        if (polygonLatLngs.length < 3) {
            return;
        }

        const polygon = L.polygon(polygonLatLngs, {
            stroke: true,
            color: '#2f3e34',
            weight: 1.8,
            opacity: 0.4,
            fillColor: '#657366',
            fillOpacity: 0.1,
            interactive: false,
            keyboard: false,
            pane: 'overlayPane'
        }).addTo(this.officeBoundaryLayerGroup);

        this.officeBoundaryLayers.push(polygon);
    }

    clearOfficeBoundaries() {
        if (!this.officeBoundaryLayerGroup) {
            return;
        }

        this.officeBoundaryLayerGroup.clearLayers();
        this.officeBoundaryLayers = [];
    }

    formatCoordinateText(lat, lng) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return '--';
        }

        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    getMarkerBannerHtml(label, iconType) {
        const iconMarkup = iconType === 'door'
            ? `
                <span class="map-banner-marker__icon map-banner-marker__icon--door" aria-hidden="true">
                    <span class="map-banner-marker__door"></span>
                    <span class="map-banner-marker__door-window"></span>
                </span>
            `
            : `
                <span class="map-banner-marker__icon map-banner-marker__icon--camera" aria-hidden="true">
                    <span class="map-banner-marker__camera-pulse"></span>
                    <span class="map-banner-marker__camera-cone"></span>
                    <span class="map-banner-marker__camera-core"></span>
                    <span class="map-banner-marker__camera-lens"></span>
                </span>
            `;

        return `
            <span class="map-banner-marker map-banner-marker--${iconType}">
                ${iconMarkup}
                <span class="map-banner-marker__label">${label}</span>
            </span>
        `;
    }

    getStreetViewIconHtml(heading = 0, { active = false } = {}) {
        const normalizedHeading = this.normalizeHeading(heading);
        const coneMarkup = active ? '<span class="map-banner-marker__camera-cone"></span>' : '';

        return `
            <span class="street-view-point-marker map-banner-marker__icon map-banner-marker__icon--camera${active ? ' is-active' : ''}" aria-hidden="true" style="--panorama-camera-heading: ${normalizedHeading}deg;">
                <span class="map-banner-marker__camera-pulse"></span>
                ${coneMarkup}
                <span class="map-banner-marker__camera-core"></span>
                <span class="map-banner-marker__camera-lens"></span>
            </span>
        `;
    }

    areGeoPointsEqual(left, right, precision = 7) {
        if (!left || !right) {
            return false;
        }

        if (typeof left.lat !== 'number' || typeof left.lng !== 'number' || typeof right.lat !== 'number' || typeof right.lng !== 'number') {
            return false;
        }

        return left.lat.toFixed(precision) === right.lat.toFixed(precision)
            && left.lng.toFixed(precision) === right.lng.toFixed(precision);
    }

    getActiveStreetViewPoint() {
        if (!this.panoramaModeActive) {
            return null;
        }

        if (this.manualPanoramaPoint) {
            return this.manualPanoramaPoint;
        }

        if (this.activeRoutePlan && this.activeRoutePlan.panorama) {
            return this.activeRoutePlan.panorama;
        }

        return null;
    }

    clearEntranceLabel() {
        if (!this.entranceLabelMarker) {
            return;
        }

        if (this.map && this.map.hasLayer(this.entranceLabelMarker)) {
            this.map.removeLayer(this.entranceLabelMarker);
        }

        this.entranceLabelMarker = null;
    }

    updateEntranceLabel(entrancePoint) {
        if (this.panoramaModeActive || !this.map || !entrancePoint) {
            this.clearEntranceLabel();
            return;
        }

        if (!this.entranceLabelMarker) {
            this.entranceLabelMarker = L.marker([entrancePoint.lat, entrancePoint.lng], {
                icon: L.divIcon({
                    className: 'map-banner-marker-anchor',
                    html: this.getMarkerBannerHtml('Entrance', 'door'),
                    iconSize: [132, 36],
                    iconAnchor: [14, 18]
                }),
                interactive: false,
                keyboard: false,
                zIndexOffset: 780
            }).addTo(this.map);
        } else {
            this.entranceLabelMarker.setLatLng([entrancePoint.lat, entrancePoint.lng]);
            this.entranceLabelMarker.setIcon(L.divIcon({
                className: 'map-banner-marker-anchor',
                html: this.getMarkerBannerHtml('Entrance', 'door'),
                iconSize: [132, 36],
                iconAnchor: [14, 18]
            }));

            if (!this.map.hasLayer(this.entranceLabelMarker)) {
                this.entranceLabelMarker.addTo(this.map);
            }
        }
    }

    showOfficeMarker(office) {
        this.setOfficeMarkerExpanded(null, false);

        // Hide current active marker
        if (this.activeOfficeMarker) {
            this.map.removeLayer(this.activeOfficeMarker);
            this.activeOfficeMarker = null;
        }

        if (!office) return;

        const key = this.getOfficeKey(office);
        let marker = this.officeMarkers.get(key);
        if (!marker) {
            marker = this.createOfficeMarker(office);
            this.officeMarkers.set(key, marker);
        }
        this.updateOfficeMarkerAppearance(marker, false);
        marker.addTo(this.map);
        this.activeOfficeMarker = marker;
    }

    hideAllOfficeMarkers() {
        this.setOfficeMarkerExpanded(null, false);
        this.officeMarkers.forEach(marker => {
            if (this.map.hasLayer(marker)) {
                this.map.removeLayer(marker);
            }
        });
        this.activeOfficeMarker = null;
    }

    ensureStreetViewMarkers() {
        if (!this.map || this.streetViewMarkerGroup) {
            return;
        }

        this.streetViewMarkerGroup = L.layerGroup();
        this.streetViewMarkers = [];

        this.navigationNodeIndex.panoramas.forEach(point => {
            const marker = L.marker([point.lat, point.lng], {
                icon: this.createPanoramaContextIcon('camera', 0, { compact: true }),
                title: 'Street View',
                zIndexOffset: 640
            });

            marker.streetViewPoint = { lat: point.lat, lng: point.lng };
            marker.on('click', () => {
                this.handleStreetViewMarkerSelect(marker.streetViewPoint);
            });

            this.streetViewMarkerGroup.addLayer(marker);
            this.streetViewMarkers.push(marker);
        });
    }

    handleStreetViewMarkerSelect(point) {
        if (!point || !this.selectedOffice) {
            this.showStatus('Select an office before opening Street View.');
            return;
        }

        this.manualPanoramaPoint = { lat: point.lat, lng: point.lng };
        this.refreshStreetViewMarkers();
        this.openPanorama(this.selectedOffice, { panoramaPointOverride: this.manualPanoramaPoint });
    }

    showStreetViewMarkers() {
        this.ensureStreetViewMarkers();

        if (!this.map || !this.streetViewMarkerGroup || !this.selectedOffice || this.panoramaModeActive) {
            this.hideStreetViewMarkers();
            return;
        }

        if (!this.map.hasLayer(this.streetViewMarkerGroup)) {
            this.streetViewMarkerGroup.addTo(this.map);
        }

        if (this.streetViewLegend) {
            this.streetViewLegend.style.display = 'flex';
        }

        this.refreshStreetViewMarkers();
    }

    hideStreetViewMarkers() {
        if (this.map && this.streetViewMarkerGroup && this.map.hasLayer(this.streetViewMarkerGroup)) {
            this.map.removeLayer(this.streetViewMarkerGroup);
        }

        if (this.streetViewLegend) {
            this.streetViewLegend.style.display = 'none';
        }
    }

    refreshStreetViewMarkers() {
        const activePoint = this.getActiveStreetViewPoint();

        this.streetViewMarkers.forEach(marker => {
            const isActive = !!activePoint && this.areGeoPointsEqual(marker.streetViewPoint, activePoint);
            marker.setIcon(this.createPanoramaContextIcon('camera', 0, { compact: true, active: isActive }));
        });
    }

    createPanoramaMarker(office, panoramaPoint = null) {
        // Remove existing panorama marker. 360 access now uses the side button instead.
        if (this.panoramaMarker) {
            this.map.removeLayer(this.panoramaMarker);
            this.panoramaMarker = null;
        }
        return;
    }

    drawPedestrianPath(office, closestEntrance = null, pathOverride = null) {
        // Remove existing pedestrian path
        if (this.pedestrianPathPolyline) {
            this.map.removeLayer(this.pedestrianPathPolyline);
            this.pedestrianPathPolyline = null;
        }

        if (!office) {
            return;
        }

        // Get the walking path, preferring override path when available
        let walkingPath = pathOverride && Array.isArray(pathOverride)
            ? pathOverride
            : null;
        if (!walkingPath && office.walkingPathsByEntrance && Object.keys(office.walkingPathsByEntrance).length > 0) {
            let entranceIndex = -1;
            if (closestEntrance) {
                entranceIndex = this.findEntranceIndex(office, closestEntrance);
            }

            const pathKey = entranceIndex >= 0
                ? String(entranceIndex)
                : Object.keys(office.walkingPathsByEntrance)[0];

            walkingPath = office.walkingPathsByEntrance[pathKey] || null;
        } else if (!walkingPath && office.walkingPath && office.walkingPath.length >= 2) {
            // Fallback to legacy single walking path, with dynamic endpoint for multi-entrance offices
            if (closestEntrance && office.entrances && office.entrances.length > 1) {
                walkingPath = this.getDynamicWalkingPath(office, closestEntrance);
            } else {
                walkingPath = office.walkingPath;
            }
        }

        if (!walkingPath || walkingPath.length < 2) {
            return;
        }

        // Convert walking path to Leaflet LatLng array
        const pathCoords = walkingPath.map(point => [point.lat, point.lng]);

        // Draw polyline with same style as main route (seamless extension)
        this.pedestrianPathPolyline = L.polyline(pathCoords, {
            color: this.brandColor,
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

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const searchResults = document.getElementById('searchResults');
            
            if (query.length === 0) {
                // Hide results when search is cleared
                searchResults.classList.remove('active');
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

            openOfficeSearch() {
                if (this.landingMenu) {
                    this.landingMenu.style.display = 'flex';
                }

                const searchInput = document.getElementById('officeSearch');
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                }

                this.showAllOffices();
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
            ? `<span style="font-weight: 700; color: #2c2c2c;">Unit ${office.unit}:</span> ${this.getBaseOfficeName(office)}`
            : this.getBaseOfficeName(office);

        item.innerHTML = `
            <div class="search-result-name">${displayName}</div>
            ${office.description ? `<div class="search-result-description">${office.description}</div>` : ''}
        `;
        
        item.addEventListener('click', () => {
            this.selectOffice(office);
            document.getElementById('officeSearch').value = this.formatOfficeLabel(office);
            document.getElementById('searchResults').classList.remove('active');
        });
        container.appendChild(item);
    }

    /**
     * Find the closest entrance to a given position for offices with multiple entrances
     * @param {Object} office - The office object
     * @param {Object} userPosition - The user's current position {lat, lng}
     * @returns {Object} The closest entrance coordinates {lat, lng}
     */
    findClosestEntrance(office, userPosition) {
        // If no entrances array, use the last point of walkingPath or office location
        if (!office.entrances || office.entrances.length === 0) {
            if (office.walkingPath && office.walkingPath.length > 0) {
                return office.walkingPath[office.walkingPath.length - 1];
            }
            return { lat: office.lat, lng: office.lng };
        }

        // If only one entrance, return it
        if (office.entrances.length === 1) {
            return office.entrances[0];
        }

        // Find closest entrance to user position
        let closestEntrance = office.entrances[0];
        let minDistance = Infinity;

        for (const entrance of office.entrances) {
            const distance = this.calculateDistance(
                userPosition.lat, userPosition.lng,
                entrance.lat, entrance.lng
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestEntrance = entrance;
            }
        }

        return closestEntrance;
    }

    /**
     * Find the index of an entrance that matches provided coordinates within a small tolerance
     * @param {Object} office - The office object
     * @param {Object} entranceCoords - The entrance coordinates to match
     * @param {number} toleranceMeters - Distance tolerance in meters
     * @returns {number} The matching entrance index or -1 if not found
     */
    findEntranceIndex(office, entranceCoords, toleranceMeters = 1.5) {
        if (!office || !office.entrances || !entranceCoords) {
            return -1;
        }

        for (let i = 0; i < office.entrances.length; i++) {
            const entrance = office.entrances[i];
            const distance = this.calculateDistance(
                entrance.lat, entrance.lng,
                entranceCoords.lat, entranceCoords.lng
            );

            if (distance <= toleranceMeters) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Get the dynamic walking path for an office based on closest entrance
     * @param {Object} office - The office object
     * @param {Object} closestEntrance - The closest entrance coordinates
     * @returns {Array} The walking path array
     */
    getDynamicWalkingPath(office, closestEntrance) {
        if (office.walkingPathsByEntrance && closestEntrance) {
            const entranceIndex = this.findEntranceIndex(office, closestEntrance);
            if (entranceIndex >= 0) {
                const walkingPath = office.walkingPathsByEntrance[String(entranceIndex)];
                if (walkingPath && walkingPath.length >= 2) {
                    return walkingPath;
                }
            }
        }

        if (!office.walkingPath || office.walkingPath.length < 2) {
            return null;
        }

        // If office has multiple entrances, update the walking path endpoint
        if (office.entrances && office.entrances.length > 1) {
            // Copy the walking path and update the last point to the closest entrance
            const dynamicPath = office.walkingPath.slice(0, -1);
            dynamicPath.push(closestEntrance);
            return dynamicPath;
        }

        return office.walkingPath;
    }

    selectOffice(office) {
        this.closePanorama();
        this.clearPendingDestination();
        this.manualPanoramaPoint = null;
        this.selectedOffice = office;
        this.selectedEntrance = null; // Will be set when we have user position
        this.activeRoutePlan = null;
        this.lastRouteEndpoint = null;

        if (this.isLocalTestMode) {
            this.syncOfficeTestSelection(office);
        }

        this.updateDestinationPanel(office);
        this.lastRouteUpdatePosition = null; // Reset route update tracking
        
        // Switch to map view
        if (this.landingMenu) {
            this.landingMenu.style.display = 'none';
        }
        if (this.mapContainer) {
            this.mapContainer.style.display = 'block';
            this.mapContainer.style.visibility = 'visible';
        }
        if (this.returnToSearchBtn) {
            this.returnToSearchBtn.style.display = 'flex';
        }
        
        // Resize map to fit container now that it's visible
        if (this.map) {
            this.map.invalidateSize();
        }

        this.renderOfficeBoundaries(office);
        
        // Show only the selected office marker
        this.showOfficeMarker(office);

        const currentUserPosition = this.userMarker
            ? this.userMarker.getLatLng()
            : null;

        this.activeRoutePlan = this.resolveOfficeNavigationPlan(
            office,
            currentUserPosition ? { lat: currentUserPosition.lat, lng: currentUserPosition.lng } : null
        );
        this.selectedEntrance = this.activeRoutePlan ? this.activeRoutePlan.entrance : null;
        this.showStreetViewMarkers();

        const destination = this.getRouteDestinationCoords(office);
        
        if (this.userMarker) {
            const userPos = this.userMarker.getLatLng();
            this.lastRouteUpdatePosition = { lat: userPos.lat, lng: userPos.lng };

            this.activeRoutePlan = this.resolveOfficeNavigationPlan(office, { lat: userPos.lat, lng: userPos.lng });
            this.selectedEntrance = this.activeRoutePlan ? this.activeRoutePlan.entrance : this.selectedEntrance;
            this.refreshStreetViewMarkers();
            
            this.calculateRoute(userPos, this.getRouteDestinationCoords(office), office.name, true);
            return;
        }

        // Prepare to wait for location before starting navigation
        this.pendingDestination = {
            coords: this.getRouteDestinationCoords(office),
            name: office.name
        };
        this.locationWaitStart = null;

        this.showStatus('Waiting for your location... Please allow location access.');
        this.requestLocation();
        this.startLocationWaitLoop();
    }

    startLocationWaitLoop() {
        if (!this.pendingDestination) {
            return;
        }

        if (this.locationWaitTimeout) {
            clearTimeout(this.locationWaitTimeout);
            this.locationWaitTimeout = null;
        }

        if (this.userMarker) {
            const userPos = this.userMarker.getLatLng();
            this.lastRouteUpdatePosition = { lat: userPos.lat, lng: userPos.lng };
            
            // Set entrance once when location becomes available
            if (this.selectedOffice) {
                this.activeRoutePlan = this.resolveOfficeNavigationPlan(this.selectedOffice, { lat: userPos.lat, lng: userPos.lng });
                this.selectedEntrance = this.activeRoutePlan ? this.activeRoutePlan.entrance : this.selectedEntrance;
                this.pendingDestination.coords = this.getRouteDestinationCoords(this.selectedOffice);
            }

            this.calculateRoute(userPos, this.pendingDestination.coords, this.pendingDestination.name, true);
            this.clearPendingDestination();
            return;
        }

        if (!this.locationWaitStart) {
            this.locationWaitStart = Date.now();
        } else if (Date.now() - this.locationWaitStart > 20000) {
            this.showStatus('Unable to get your location. Please enable location services.');
            this.clearPendingDestination();
            return;
        }

        this.locationWaitTimeout = setTimeout(() => this.startLocationWaitLoop(), 1000);
    }

    clearPendingDestination() {
        if (this.locationWaitTimeout) {
            clearTimeout(this.locationWaitTimeout);
            this.locationWaitTimeout = null;
        }
        this.pendingDestination = null;
        this.locationWaitStart = null;
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
            waypointMode: 'connect',
            routeWhileDragging: false,
            show: false,
            showAlternatives: false,
            addWaypoints: false,
            lineOptions: {
                extendToWaypoints: true,
                styles: [
                    {
                        color: this.routeCasingColor,
                        opacity: 0.94,
                        weight: 10,
                        lineCap: 'round',
                        lineJoin: 'round'
                    },
                    {
                        color: this.brandColor,
                        opacity: 0.95,
                        weight: 7,
                        lineCap: 'round',
                        lineJoin: 'round'
                    },
                    {
                        color: this.routeAccentColor,
                        opacity: 0.9,
                        weight: 2.5,
                        dashArray: '10 14',
                        lineCap: 'round',
                        lineJoin: 'round'
                    }
                ],
                missingRouteStyles: [
                    {
                        color: this.routeCasingColor,
                        opacity: 0.94,
                        weight: 8,
                        lineCap: 'round',
                        lineJoin: 'round'
                    },
                    {
                        color: this.brandColor,
                        opacity: 0.95,
                        weight: 5,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }
                ]
            },
            createMarker: function() { return null; } // Don't create default markers
        }).addTo(this.map);

        // Track if this is the first routesfound event for this route
        let isFirstRouteFound = true;

        this.routingControl.on('routesfound', (e) => {
            const route = e.routes[0];
            const distanceMeters = route.summary.totalDistance;
            const durationSeconds = route.summary.totalTime;
            this.setRouteSummary(distanceMeters, durationSeconds);

            if (distanceMeters > this.maxExpectedRouteDistanceMeters) {
                this.showStatus('Your location appears far from this building. Enable precise location and try again.');
                return;
            }

            const endpoint = route.coordinates[route.coordinates.length - 1];
            if (endpoint) {
                this.lastRouteEndpoint = { lat: endpoint.lat, lng: endpoint.lng };
            }

            if (this.selectedOffice) {
                this.updateEntranceLabel(this.getOfficeEntrancePoint(this.selectedOffice));
            }
            
            // Update panorama button visibility now that route is active
            if (this.selectedOffice) {
                // No top panel button to update
            }
            
            // Only show status message on initial route calculation
            if (isFirstRouteFound) {
                const distanceKm = (distanceMeters / 1000).toFixed(2);
                const durationMin = Math.round(durationSeconds / 60);
                this.showStatus(`Route to ${destinationName}: ${distanceKm} km, ~${durationMin} min walk`);
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
                '<h3 style="color: #f44336; margin-top: 0;">Enable Location for Safari</h3>' +
                '<div style="text-align: left; font-size: 14px; line-height: 1.8;">' +
                '<p><strong>Safari requires location access in TWO places. Both must be enabled:</strong></p>' +
                
                '<div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">' +
                '<strong style="font-size: 16px;">Step 1: Website-Specific Permission</strong><br><br>' +
                '1. Tap the <strong>AA icon</strong> (left of URL bar)<br>' +
                '2. Tap <strong>"Website Settings"</strong><br>' +
                '3. Find <strong>"Location"</strong><br>' +
                '4. Set it to <strong>"Allow"</strong> (not "Ask" or "Deny")<br>' +
                '5. Make sure <strong>"Precise Location"</strong> toggle is ON' +
                '</div>' +
                
                '<div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0;">' +
                '<strong style="font-size: 16px;">Step 2: System-Level Permission (IMPORTANT!)</strong><br><br>' +
                '1. Go to iPhone <strong>Settings</strong> app<br>' +
                '2. Tap <strong>Privacy & Security</strong><br>' +
                '3. Tap <strong>Location Services</strong><br>' +
                '4. Scroll down and find <strong>"Safari Websites"</strong><br>' +
                '5. Tap on <strong>"Safari Websites"</strong><br>' +
                '6. Select <strong>"Ask Next Time Or When I Share"</strong> OR <strong>"While Using the App"</strong><br>' +
                '<strong style="color: #f44336;">DO NOT select "Never" - this will block location!</strong>' +
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
                '<h3>Enable Location for Android</h3>' +
                '<div style="text-align: left; font-size: 14px; line-height: 1.8;">' +
                '1. Tap the <strong>menu icon</strong> (3 dots) in your browser<br>' +
                '2. Go to <strong>Settings</strong> -> <strong>Site settings</strong><br>' +
                '3. Find this website and enable <strong>Location</strong> permissions<br><br>' +
                '<strong>Also check:</strong><br>' +
                'Phone Settings -> Location -> ON<br><br>' +
                '<button id="enableLocationBtn" class="enable-location-btn">Try Again</button>' +
                '</div>';
        } else if (browser === 'chrome') {
            instructions = 
                '<h3>Enable Location for Chrome</h3>' +
                '<div style="text-align: left; font-size: 14px; line-height: 1.8;">' +
                '1. Click the <strong>lock icon</strong> in the address bar<br>' +
                '2. Find <strong>"Location"</strong><br>' +
                '3. Select <strong>"Allow"</strong><br><br>' +
                '<button id="enableLocationBtn" class="enable-location-btn">Try Again</button>' +
                '</div>';
        } else if (browser === 'firefox') {
            instructions = 
                '<h3>Enable Location for Firefox</h3>' +
                '<div style="text-align: left; font-size: 14px; line-height: 1.8;">' +
                '1. Click the <strong>shield icon</strong> in the address bar<br>' +
                '2. Find <strong>"Permissions"</strong><br>' +
                '3. Enable <strong>"Location"</strong><br><br>' +
                '<button id="enableLocationBtn" class="enable-location-btn">Try Again</button>' +
                '</div>';
        } else if (browser === 'unsupported') {
            instructions = 
                '<h3>Geolocation Not Supported</h3>' +
                '<p>Your browser does not support location services. Please use a modern browser.</p>';
        } else {
            instructions = 
                '<h3>Enable Location</h3>' +
                '<div style="text-align: left; font-size: 14px; line-height: 1.8;">' +
                '1. Check your browser settings for location permissions<br>' +
                '2. Ensure location services are enabled on your device<br><br>' +
                '<button id="enableLocationBtn" class="enable-location-btn">Try Again</button>' +
                '</div>';
        }
        
        promptContent.innerHTML = instructions;
        
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
                
                if (!this.watchId) {
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
                }
                
            },
            (error) => {
                this.handleLocationError(error);
            },
            options
        );
    }

    createUserLocationIcon() {
        return this.createSvgDataUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
                <defs>
                    <filter id="userShadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#182019" flood-opacity="0.25"/>
                    </filter>
                </defs>
                <circle cx="26" cy="26" r="22" fill="#243127" fill-opacity="0.14"/>
                <circle cx="26" cy="26" r="18" fill="#414b43" filter="url(#userShadow)"/>
                <circle cx="26" cy="26" r="14" fill="#5f7065"/>
                <circle cx="26" cy="26" r="9.5" fill="#ffffff"/>
                <path d="M20.8 31.6c0-3.2 2.3-5.6 5.2-5.6s5.2 2.4 5.2 5.6v1.3h-2.5v-1.1c0-1.9-1.1-3.3-2.7-3.3s-2.7 1.4-2.7 3.3v1.1h-2.5v-1.3Zm5.2-14.1a3.7 3.7 0 1 1 0 7.4a3.7 3.7 0 0 1 0-7.4Z" fill="#2e352f"/>
                <path d="M17.1 21.4c-1.4 1.6-2 3.4-2 5.3c0 2.6 1.1 5.1 3 7.3" fill="none" stroke="#2e352f" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M34.9 21.4c1.4 1.6 2 3.4 2 5.3c0 2.6-1.1 5.1-3 7.3" fill="none" stroke="#2e352f" stroke-width="2.2" stroke-linecap="round"/>
            </svg>
        `);
    }

    updateUserLocation(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);
        
        if (accuracy > 50 && isIOS && isSafari && !this.preciseLocationWarningShown) {
            this.showStatus(`Location accuracy is +/-${Math.round(accuracy)}m. For better navigation, enable Precise Location in Safari settings.`);
            this.preciseLocationWarningShown = true;
        }

        if (!this.userMarker) {
            const iconUrl = this.createUserLocationIcon();
            this.userMarker = L.marker([lat, lng], {
                icon: L.icon({
                    iconUrl: iconUrl,
                    iconSize: [52, 52],
                    iconAnchor: [26, 26],
                    popupAnchor: [0, -26]
                })
            }).addTo(this.map);

            this.userMarker.bindTooltip('You Are Here', {
                permanent: true,
                direction: 'right',
                offset: [26, 0],
                className: 'map-caption-tooltip map-caption-tooltip--user'
            });
            
            this.map.setView([lat, lng], 18);
        } else {
            this.userMarker.setLatLng([lat, lng]);
        }

        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }
        
        this.accuracyCircle = L.circle([lat, lng], {
            radius: Math.min(accuracy, 20),
            fillColor: this.brandColor,
            fillOpacity: 0.15,
            color: this.brandColor,
            weight: 1.5,
            opacity: 0.4
        }).addTo(this.map);

        if (this.pendingDestination) {
            this.startLocationWaitLoop();
        }

        if (this.routingControl && this.selectedOffice) {
            const userPos = { lat, lng };
            let shouldUpdate = false;
            
            if (!this.lastRouteUpdatePosition) {
                shouldUpdate = true;
                this.lastRouteUpdatePosition = { lat, lng };
            } else {
                const distance = this.calculateDistance(
                    lat, lng,
                    this.lastRouteUpdatePosition.lat,
                    this.lastRouteUpdatePosition.lng
                );
                
                if (distance >= this.minRouteUpdateDistance) {
                    shouldUpdate = true;
                    this.lastRouteUpdatePosition = { lat, lng };
                }
            }
            
            if (shouldUpdate) {
                this.activeRoutePlan = this.resolveOfficeNavigationPlan(this.selectedOffice, userPos);
                this.selectedEntrance = this.activeRoutePlan ? this.activeRoutePlan.entrance : this.selectedEntrance;
                const destination = this.getRouteDestinationCoords(this.selectedOffice);
                this.calculateRoute(userPos, destination, this.selectedOffice.name, false);
            }
        }

        if (this.panoramaModeActive) {
            this.refreshPanoramaMapContextFromViewer();
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
                
                console.log('Permission denied. URL:', url);
                console.log('Protocol:', protocol);
                console.log('User agent:', navigator.userAgent);
                
                const isSafariBrowser = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|Firefox/.test(navigator.userAgent);
                const isIOSDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
                
                if (isSafariBrowser || isIOSDevice) {
                    this.showBrowserInstructions('safari');
                    break;
                } else {
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
                instructions += '- Ensure Location Services is ON in Settings<br>';
                instructions += '- Make sure you are outdoors or near a window<br>';
                instructions += '- Check that Airplane Mode is OFF';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out. GPS may be slow to acquire signal.';
                instructions = '<div style="text-align: left; max-width: 90%; margin: 0 auto;">';
                instructions += '<strong>GPS signal timeout:</strong><br><br>';
                instructions += '- Make sure you are outdoors (GPS works better outside)<br>';
                instructions += '- Check that Location Services is enabled<br>';
                instructions += '- Try moving to a location with better sky view<br>';
                instructions += `<br><button onclick="location.reload()" style="margin-top: 10px; padding: 10px 20px; background: ${this.brandColor}; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;">Retry</button>`;
                instructions += '</div>';
                break;
            default:
                message = 'Unable to get location. Error code: ' + error.code;
                instructions = this.getMobileLocationInstructions();
                break;
        }
        
        if (protocol !== 'https:') {
            instructions += '<br><br><div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px;">';
            instructions += '<strong>HTTPS Issue Detected</strong><br>';
            instructions += 'Current protocol: ' + protocol + '<br>';
            instructions += 'Geolocation requires HTTPS. Make sure your site URL starts with https://';
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
            instructions += '- Settings -> Privacy & Security -> Location Services -> ON<br>';
            instructions += '- Settings -> Safari -> Location Services -> ON<br><br>';
            instructions += '<strong>Diagnostic Info:</strong><br>';
            instructions += 'Protocol: ' + protocol + '<br>';
            instructions += 'URL: ' + url.substring(0, 50) + '...<br>';
        } else if (isAndroid) {
            instructions += '1. Tap the <strong>menu icon</strong> (3 dots) in your browser<br>';
            instructions += '2. Go to <strong>Settings</strong> -> <strong>Site settings</strong><br>';
            instructions += '3. Find this site and enable <strong>Location</strong> permissions<br>';
            instructions += '4. Refresh this page<br><br>';
            instructions += 'Also check: Phone Settings -> Location -> On';
        } else {
            instructions += '1. Click the <strong>lock/padlock icon</strong> in the address bar<br>';
            instructions += '2. Enable <strong>Location</strong> permissions<br>';
            instructions += '3. Refresh this page<br><br>';
            instructions += 'Make sure location services are enabled on your device.';
        }
        
        instructions += `<br><button onclick="location.reload()" style="margin-top: 10px; padding: 10px 20px; background: ${this.brandColor}; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;">Reload Page</button>`;
        instructions += '</div>';
        
        return instructions;
    }

    showLocationInstructions(content) {
        let backdrop = document.getElementById('locationInstructionsBackdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'locationInstructionsBackdrop';
            backdrop.className = 'location-instructions-backdrop';
            backdrop.onclick = () => this.hideLocationInstructions();
            document.body.appendChild(backdrop);
        }
        backdrop.style.display = 'block';

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
        this.clearEntranceLabel();
        
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
        
        // Remove office marker
        this.hideAllOfficeMarkers();
        this.clearOfficeBoundaries();

        this.selectedOffice = null;
        this.selectedEntrance = null; // Clear selected entrance
        this.activeRoutePlan = null;
        this.manualPanoramaPoint = null;
        this.lastRouteUpdatePosition = null; // Reset route tracking
        this.routeDestinationName = null;
        this.lastRouteEndpoint = null;
        this.updateDestinationPanel(null);
        this.closePanorama();
        // Hide panorama button when route is cleared
        if (this.panoramaBtn) {
            // Button removed
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

        this.clearPendingDestination();
    }

    updateDestinationPanel(office) {
        if (!this.destinationPanel || !this.destinationNameEl || !this.destinationRouteEl) {
            return;
        }

        if (!office) {
            this.destinationPanel.style.display = 'none';
            this.destinationNameEl.textContent = 'Select an office to get directions';
            this.destinationRouteEl.textContent = '--';
            if (this.panoramaBtn) {
                this.panoramaBtn.style.display = 'none';
            }
            this.updateTestPanoramaControl(null);
            this.hideStreetViewMarkers();
            return;
        }

        const nameText = this.formatOfficeLabel(office);

        this.destinationPanel.style.display = 'flex';
        this.destinationNameEl.textContent = nameText;
        this.destinationRouteEl.textContent = 'Calculating route...';

        this.updateTestPanoramaControl(office);
    }

    // Removed updatePanoramaButtonState as button is gone from panel

    setRouteSummary(distanceMeters, durationSeconds) {
        if (!this.destinationRouteEl || !this.selectedOffice) {
            return;
        }

        if (distanceMeters > this.maxExpectedRouteDistanceMeters) {
            this.destinationRouteEl.textContent = 'Location too far';
            return;
        }

        let distanceText;
        if (distanceMeters >= 1000) {
            distanceText = `${(distanceMeters / 1000).toFixed(1)} km`;
        } else {
            distanceText = `${Math.round(distanceMeters)} m`;
        }

        const minutes = Math.max(1, Math.round(durationSeconds / 60));
        this.destinationRouteEl.textContent = `${distanceText} | ${minutes} min walk`;
    }

    invalidateMapLayout(delay = 80) {
        if (!this.map) {
            return;
        }

        window.setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
            }
        }, delay);
    }

    setPanoramaLayoutState(isActive) {
        this.panoramaModeActive = isActive;

        if (document.body) {
            document.body.classList.toggle('panorama-split-active', isActive);
        }

        if (this.appContainer) {
            this.appContainer.classList.toggle('panorama-split-active', isActive);
        }

        if (isActive) {
            this.clearEntranceLabel();
            this.hideStreetViewMarkers();
        } else if (this.selectedOffice) {
            this.updateEntranceLabel(this.getOfficeEntrancePoint(this.selectedOffice));
            this.showStreetViewMarkers();
        }

        this.invalidateMapLayout(isActive ? 120 : 80);
    }

    openPanorama(destination, options = {}) {
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
        this.setPanoramaLayoutState(true);

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
                this.openGooglePanorama(destination, panoramaConfig, options);
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

    getGoogleMapsApiKey() {
        if (!window.APP_CONFIG || typeof window.APP_CONFIG !== 'object') {
            return '';
        }

        const key = window.APP_CONFIG.GOOGLE_MAPS_API_KEY || window.APP_CONFIG.googleMapsApiKey;
        return typeof key === 'string' ? key.trim() : '';
    }

    async ensureGoogleMapsApiLoaded() {
        if (window.google && window.google.maps && window.google.maps.StreetViewService) {
            return true;
        }

        const apiKey = this.getGoogleMapsApiKey();
        if (!apiKey) {
            console.warn('Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY in app-config.js');
            this.showStatus('360° Street View needs a Google Maps API key. Set GOOGLE_MAPS_API_KEY in app-config.js.');
            return false;
        }

        if (this.googleMapsApiLoadPromise) {
            try {
                await this.googleMapsApiLoadPromise;
            } catch (error) {
                return false;
            }
            return !!(window.google && window.google.maps && window.google.maps.StreetViewService);
        }

        this.googleMapsApiLoadPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector('script[data-google-maps-api="true"]');
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(), { once: true });
                existingScript.addEventListener('error', () => reject(new Error('Google Maps API failed to load')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
            script.async = true;
            script.defer = true;
            script.dataset.googleMapsApi = 'true';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Google Maps API failed to load'));
            document.head.appendChild(script);
        });

        try {
            await this.googleMapsApiLoadPromise;

            for (let attempt = 0; attempt < 20; attempt++) {
                if (window.google && window.google.maps && window.google.maps.StreetViewService) {
                    return true;
                }

                await new Promise(resolve => window.setTimeout(resolve, 100));
            }

            return false;
        } catch (error) {
            console.error('Google Maps API load error:', error);
            this.googleMapsApiLoadPromise = null;
            this.showStatus('Unable to load Google Maps 360° view. Check API key and network.');
            return false;
        }
    }

    async openGooglePanorama(destination, panoramaConfig, options = {}) {
        const isLoaded = await this.ensureGoogleMapsApiLoaded();
        if (!isLoaded || !(window.google && window.google.maps && window.google.maps.StreetViewService)) {
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
        
        // Use dynamically selected panorama coordinates when available,
        // otherwise use office panorama config, route endpoint, or office location
        let location;
        if (options.panoramaPointOverride) {
            location = {
                lat: options.panoramaPointOverride.lat,
                lng: options.panoramaPointOverride.lng
            };
        } else if (this.manualPanoramaPoint) {
            location = {
                lat: this.manualPanoramaPoint.lat,
                lng: this.manualPanoramaPoint.lng
            };
        } else if (this.activeRoutePlan && this.activeRoutePlan.panorama) {
            location = {
                lat: this.activeRoutePlan.panorama.lat,
                lng: this.activeRoutePlan.panorama.lng
            };
        } else if (panoramaConfig.lat && panoramaConfig.lng) {
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

            // Determine the entrance coordinates for heading calculation
            const entranceCoords = this.getOfficeEntrancePoint(destination);

            // Calculate heading from panorama location to entrance
            const panoPosition = data.location.latLng;
            const dynamicHeading = this.calculateHeading(
                panoPosition.lat(),
                panoPosition.lng(),
                entranceCoords.lat,
                entranceCoords.lng
            );

            // Prefer dynamic heading when an active route plan is in use
            const heading = (this.activeRoutePlan && this.activeRoutePlan.panorama)
                ? dynamicHeading
                : (panoramaConfig.heading !== undefined ? panoramaConfig.heading : dynamicHeading);

            this.googleStreetView = new google.maps.StreetViewPanorama(panoContainer, {
                position: data.location.latLng,
                pov: {
                    heading: heading, // Face toward building entrance
                    pitch: -10 // Slight downward angle to see ground
                },
                zoom: panoramaConfig.zoom || 1,
                visible: true,
                panControl: false, // Remove compass/pan control
                zoomControl: false, // Remove zoom buttons
                fullscreenControl: false,
                addressControl: false,
                linksControl: false, // Disable navigation arrows
                clickToGo: false, // Disable click-to-move
                motionTracking: false,
                motionTrackingControl: false
            });
            this.currentPanoramaProvider = 'google';

            this.renderPanoramaMapContext({
                panoramaPoint: {
                    lat: panoPosition.lat(),
                    lng: panoPosition.lng()
                },
                entrancePoint: entranceCoords,
                heading,
                fitBounds: true
            });

            this.googleStreetView.addListener('pov_changed', () => {
                this.refreshPanoramaMapContextFromViewer();
            });

            this.googleStreetView.addListener('position_changed', () => {
                this.refreshPanoramaMapContextFromViewer();
            });
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

    normalizeHeading(heading) {
        if (!Number.isFinite(heading)) {
            return 0;
        }

        return ((heading % 360) + 360) % 360;
    }

    projectPoint(lat, lng, distanceMeters, headingDegrees) {
        const heading = this.normalizeHeading(headingDegrees) * Math.PI / 180;
        const angularDistance = distanceMeters / 6371e3;
        const latRad = lat * Math.PI / 180;
        const lngRad = lng * Math.PI / 180;

        const projectedLat = Math.asin(
            Math.sin(latRad) * Math.cos(angularDistance) +
            Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(heading)
        );

        const projectedLng = lngRad + Math.atan2(
            Math.sin(heading) * Math.sin(angularDistance) * Math.cos(latRad),
            Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(projectedLat)
        );

        return {
            lat: projectedLat * 180 / Math.PI,
            lng: ((projectedLng * 180 / Math.PI + 540) % 360) - 180
        };
    }

    createPanoramaContextIcon(type, heading = 0, options = {}) {
        const normalizedHeading = this.normalizeHeading(heading);

        if (type === 'camera') {
            if (options.compact) {
                return L.divIcon({
                    className: 'panorama-context-marker panorama-context-marker--compact',
                    html: this.getStreetViewIconHtml(normalizedHeading, { active: !!options.active }),
                    iconSize: [42, 42],
                    iconAnchor: [21, 21]
                });
            }

            return L.divIcon({
                className: 'panorama-context-marker',
                html: `
                    <span class="map-banner-marker map-banner-marker--camera" style="--panorama-camera-heading: ${normalizedHeading}deg;">
                        ${this.getStreetViewIconHtml(normalizedHeading, { active: true })}
                        <span class="map-banner-marker__label">Street View</span>
                    </span>
                `,
                iconSize: [136, 40],
                iconAnchor: [19, 20]
            });
        }

        return L.divIcon({
            className: 'panorama-context-marker',
            html: this.getMarkerBannerHtml('Entrance', 'door'),
            iconSize: [132, 36],
            iconAnchor: [14, 18]
        });
    }

    clearPanoramaMapContext() {
        if (!this.map) {
            return;
        }

        if (this.panoramaDirectionLine) {
            this.map.removeLayer(this.panoramaDirectionLine);
            this.panoramaDirectionLine = null;
        }

        if (this.panoramaEntranceMarker) {
            this.map.removeLayer(this.panoramaEntranceMarker);
            this.panoramaEntranceMarker = null;
        }

        if (this.panoramaMarker) {
            this.map.removeLayer(this.panoramaMarker);
            this.panoramaMarker = null;
        }
    }

    renderPanoramaMapContext({ panoramaPoint, entrancePoint, heading, fitBounds = false }) {
        if (!this.map || !panoramaPoint || !entrancePoint) {
            return;
        }

        const normalizedHeading = this.normalizeHeading(heading);
        const directionPoint = this.projectPoint(panoramaPoint.lat, panoramaPoint.lng, 28, normalizedHeading);

        if (!this.panoramaMarker) {
            this.panoramaMarker = L.marker([panoramaPoint.lat, panoramaPoint.lng], {
                icon: this.createPanoramaContextIcon('camera', normalizedHeading),
                interactive: false,
                keyboard: false,
                zIndexOffset: 800
            }).addTo(this.map);
        } else {
            this.panoramaMarker.setLatLng([panoramaPoint.lat, panoramaPoint.lng]);
            this.panoramaMarker.setIcon(this.createPanoramaContextIcon('camera', normalizedHeading));
        }

        if (!this.panoramaEntranceMarker) {
            this.panoramaEntranceMarker = L.marker([entrancePoint.lat, entrancePoint.lng], {
                icon: this.createPanoramaContextIcon('entrance'),
                interactive: false,
                keyboard: false,
                zIndexOffset: 700
            }).addTo(this.map);
        } else {
            this.panoramaEntranceMarker.setLatLng([entrancePoint.lat, entrancePoint.lng]);
        }

        if (fitBounds) {
            const points = [
                [panoramaPoint.lat, panoramaPoint.lng],
                [entrancePoint.lat, entrancePoint.lng],
                [directionPoint.lat, directionPoint.lng]
            ];

            if (this.userMarker) {
                const userPosition = this.userMarker.getLatLng();
                points.push([userPosition.lat, userPosition.lng]);
            }

            this.map.fitBounds(L.latLngBounds(points), {
                padding: [28, 28],
                maxZoom: 19
            });
        }
    }

    refreshPanoramaMapContextFromViewer(options = {}) {
        if (!this.panoramaModeActive || !this.selectedOffice) {
            return;
        }

        const { fitBounds = false } = options;
        const entrancePoint = this.getOfficeEntrancePoint(this.selectedOffice);
        if (!entrancePoint) {
            return;
        }

        let panoramaPoint = this.activeRoutePlan && this.activeRoutePlan.panorama
            ? { lat: this.activeRoutePlan.panorama.lat, lng: this.activeRoutePlan.panorama.lng }
            : null;
        let heading = this.selectedOffice.panorama && Number.isFinite(this.selectedOffice.panorama.heading)
            ? this.selectedOffice.panorama.heading
            : 0;

        if (this.googleStreetView) {
            const position = this.googleStreetView.getPosition();
            if (position) {
                panoramaPoint = { lat: position.lat(), lng: position.lng() };
            }

            const pov = this.googleStreetView.getPov();
            if (pov && Number.isFinite(pov.heading)) {
                heading = pov.heading;
            }
        }

        if (!panoramaPoint && this.selectedOffice.panorama && Number.isFinite(this.selectedOffice.panorama.lat) && Number.isFinite(this.selectedOffice.panorama.lng)) {
            panoramaPoint = {
                lat: this.selectedOffice.panorama.lat,
                lng: this.selectedOffice.panorama.lng
            };
        }

        if (!panoramaPoint) {
            panoramaPoint = {
                lat: this.selectedOffice.lat,
                lng: this.selectedOffice.lng
            };
        }

        if (this.pannellumViewer && typeof this.pannellumViewer.getYaw === 'function') {
            const yaw = this.pannellumViewer.getYaw();
            if (Number.isFinite(yaw)) {
                heading = yaw;
            }
        }

        this.renderPanoramaMapContext({
            panoramaPoint,
            entrancePoint,
            heading,
            fitBounds
        });
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
        overlayContainer.style.bottom = '180px'; // Moved up significantly to avoid cutoff
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
                        <path d="M 30 10 L 38 28 L 30 24 L 22 28 Z" fill="${this.brandColor}" stroke="white" stroke-width="1.5"/>
                        <path d="M 30 24 L 30 42" stroke="${this.brandColor}" stroke-width="3"/>
                    </g>
                </svg>
            </div>
            <div class="compass-info">
                <div class="compass-label">Front Door</div>
                <div class="compass-distance">-- m</div>
                <div class="compass-coordinate-list">
                    <div class="compass-coordinate-row">
                        <span class="compass-coordinate-key">Door</span>
                        <span class="compass-coordinate-value">${this.formatCoordinateText(destinationCoords.lat, destinationCoords.lng)}</span>
                    </div>
                    <div class="compass-coordinate-row">
                        <span class="compass-coordinate-key">Camera</span>
                        <span class="compass-coordinate-value">--</span>
                    </div>
                </div>
            </div>
        `;
        overlayContainer.appendChild(compass);
        console.log('[Compass] Compass element created and added');

        const arrowPointer = compass.querySelector('#arrow-pointer');
        const distanceDisplay = compass.querySelector('.compass-distance');
        const cameraDisplay = compass.querySelector('.compass-coordinate-row:last-child .compass-coordinate-value');

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

                if (cameraDisplay) {
                    cameraDisplay.textContent = this.formatCoordinateText(currentLat, currentLng);
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

            this.refreshPanoramaMapContextFromViewer({ fitBounds: true });

            if (this.pannellumViewer && typeof this.pannellumViewer.on === 'function') {
                const syncLocalContext = () => {
                    this.refreshPanoramaMapContextFromViewer();
                };

                this.pannellumViewer.on('load', syncLocalContext);
                this.pannellumViewer.on('mouseup', syncLocalContext);
                this.pannellumViewer.on('touchend', syncLocalContext);
                this.pannellumViewer.on('animatefinished', syncLocalContext);
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
        if (restoreMap) {
            this.setPanoramaLayoutState(false);
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

        this.clearPanoramaMapContext();

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


