class AdminDashboard {
    constructor() {
        this.storageKey = 'navigation_offices_data';
        this.officeMarkers = new Map();
        this.toastTimeout = null;
        this.isDirty = false;
        this.fileBaseline = null;
        this.data = { buildingCenter: { lat: 0, lng: 0, name: '' }, offices: [] };

        this.cacheDomElements();
        this.attachStaticListeners();

        this.bootstrap();
    }

    cacheDomElements() {
        this.saveButton = document.getElementById('saveLocalBtn');
        this.downloadButton = document.getElementById('downloadJsonBtn');
        this.resetButton = document.getElementById('resetBtn');
        this.addOfficeButton = document.getElementById('addOfficeBtn');
        this.officeListEl = document.getElementById('officeList');
        this.officeCountBadge = document.getElementById('officeCount');
        this.centerOnBuildingButton = document.getElementById('centerOnBuilding');
        this.toastEl = document.getElementById('adminToast');

        this.buildingNameInput = document.getElementById('buildingName');
        this.buildingLatInput = document.getElementById('buildingLat');
        this.buildingLngInput = document.getElementById('buildingLng');
    }

    attachStaticListeners() {
        this.saveButton?.addEventListener('click', () => this.saveToBrowser());
        this.downloadButton?.addEventListener('click', () => this.downloadJson());
        this.resetButton?.addEventListener('click', () => this.resetChanges());
        this.addOfficeButton?.addEventListener('click', () => this.addOffice());
        this.centerOnBuildingButton?.addEventListener('click', () => this.focusOnBuilding());

        this.buildingNameInput?.addEventListener('input', (event) => {
            if (!this.data?.buildingCenter) return;
            this.data.buildingCenter.name = event.target.value;
            this.setDirty();
        });

        const coordinateHandler = (event, key) => {
            if (!this.data?.buildingCenter) return;
            const value = parseFloat(event.target.value);
            if (Number.isNaN(value)) return;
            this.data.buildingCenter[key] = value;
            if (this.buildingMarker) {
                this.buildingMarker.setLatLng([this.data.buildingCenter.lat, this.data.buildingCenter.lng]);
            }
            this.setDirty();
        };

        this.buildingLatInput?.addEventListener('change', (event) => coordinateHandler(event, 'lat'));
        this.buildingLngInput?.addEventListener('change', (event) => coordinateHandler(event, 'lng'));
    }

    async bootstrap() {
        await this.loadData();
        this.initMap();
        this.renderAll();
        this.setDirty(false);
    }

    async loadData() {
        try {
            this.fileBaseline = await this.fetchFileData();
        } catch (error) {
            console.error('Error fetching offices.json:', error);
            this.showToast('Failed to load offices.json. Check console for details.', 'error');
            this.fileBaseline = this.createEmptyData();
        }

        const stored = this.getStoredData();
        const activeData = stored ?? this.fileBaseline;
        this.data = this.decorateData(activeData);
        this.updateBuildingInputs();
        this.updateOfficeCount();
        if (stored) {
            this.showToast('Loaded data from browser storage.', 'success');
        }
    }

    createEmptyData() {
        return {
            buildingCenter: { lat: 0, lng: 0, name: '' },
            offices: []
        };
    }

    async fetchFileData() {
        const response = await fetch('offices.json', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch offices.json (${response.status})`);
        }
        const data = await response.json();
        return this.normalizeIncomingData(data);
    }

    getStoredData() {
        try {
            const raw = window.localStorage?.getItem(this.storageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return this.normalizeIncomingData(parsed);
        } catch (error) {
            console.warn('Unable to parse stored data:', error);
            this.showToast('Stored office data is corrupted and was ignored.', 'error');
            return null;
        }
    }

    normalizeIncomingData(raw) {
        if (!raw || typeof raw !== 'object') {
            return this.createEmptyData();
        }

        const buildingCenter = raw.buildingCenter ?? {};
        const lat = parseFloat(buildingCenter.lat);
        const lng = parseFloat(buildingCenter.lng);

        return {
            buildingCenter: {
                lat: Number.isFinite(lat) ? lat : 0,
                lng: Number.isFinite(lng) ? lng : 0,
                name: (buildingCenter.name ?? '').toString()
            },
            offices: Array.isArray(raw.offices) ? raw.offices.map((office, index) => {
                const officeLat = parseFloat(office.lat);
                const officeLng = parseFloat(office.lng);
                return {
                    name: office.name ? office.name.toString() : `Office ${index + 1}`,
                    lat: Number.isFinite(officeLat) ? officeLat : 0,
                    lng: Number.isFinite(officeLng) ? officeLng : 0,
                    description: office.description ? office.description.toString() : ''
                };
            }) : []
        };
    }

    decorateData(data) {
        const mapOffices = data.offices.map((office) => ({
            ...office,
            id: this.generateId()
        }));

        return {
            buildingCenter: {
                lat: data.buildingCenter?.lat ?? 0,
                lng: data.buildingCenter?.lng ?? 0,
                name: data.buildingCenter?.name ?? ''
            },
            offices: mapOffices
        };
    }

    initMap() {
        if (this.map) {
            this.map.remove();
        }

        const { lat, lng } = this.data.buildingCenter;
        const hasValidCenter = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
        const initialLat = hasValidCenter ? lat : 34.0522;
        const initialLng = hasValidCenter ? lng : -118.2437;

        this.map = L.map('adminMap').setView([initialLat, initialLng], 18);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);

        this.buildingMarker = L.marker([initialLat, initialLng], {
            draggable: true,
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                shadowSize: [41, 41]
            })
        }).addTo(this.map);

        this.buildingMarker.bindPopup('Building center');

        this.buildingMarker.on('dragend', () => {
            const position = this.buildingMarker.getLatLng();
            this.data.buildingCenter.lat = position.lat;
            this.data.buildingCenter.lng = position.lng;
            this.updateBuildingInputs();
            this.setDirty();
            this.showToast('Updated building center.', 'info');
        });

        this.map.on('click', (event) => {
            this.data.buildingCenter.lat = event.latlng.lat;
            this.data.buildingCenter.lng = event.latlng.lng;
            this.buildingMarker.setLatLng(event.latlng);
            this.updateBuildingInputs();
            this.setDirty();
            this.showToast('Building center moved to clicked location.', 'info');
        });

        this.renderMarkers();
    }

    renderMarkers() {
        this.officeMarkers.forEach((marker) => marker.remove());
        this.officeMarkers.clear();

        this.data.offices.forEach((office) => {
            const marker = L.marker([office.lat, office.lng], {
                draggable: true,
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                    shadowSize: [41, 41]
                })
            }).addTo(this.map);

            marker.bindPopup(() => `<strong>${office.name || 'Untitled office'}</strong>`);

            marker.on('dragend', () => {
                const position = marker.getLatLng();
                office.lat = position.lat;
                office.lng = position.lng;
                this.refreshOfficeInputs(office.id);
                this.setDirty();
                this.showToast(`Updated coordinates for "${office.name}".`, 'info');
            });

            this.officeMarkers.set(office.id, marker);
        });
    }

    renderAll() {
        this.updateBuildingInputs();
        this.renderOfficeList();
        this.renderMarkers();
    }

    updateBuildingInputs() {
        if (!this.data?.buildingCenter) return;
        const center = this.data.buildingCenter ?? {};
        const lat = Number(center.lat);
        const lng = Number(center.lng);

        if (this.buildingNameInput) {
            this.buildingNameInput.value = center.name ?? '';
        }
        if (this.buildingLatInput) {
            this.buildingLatInput.value = Number.isFinite(lat) ? lat.toFixed(6) : '';
        }
        if (this.buildingLngInput) {
            this.buildingLngInput.value = Number.isFinite(lng) ? lng.toFixed(6) : '';
        }
    }

    renderOfficeList() {
        if (!this.officeListEl) return;

        this.officeListEl.innerHTML = '';

        if (this.data.offices.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'No offices yet. Add your first office to get started.';
            this.officeListEl.appendChild(emptyState);
            this.updateOfficeCount();
            return;
        }

        this.data.offices.forEach((office) => {
            const item = document.createElement('article');
            item.className = 'office-item';
            item.dataset.officeId = office.id;

            item.innerHTML = `
                <header class="office-item-header">
                    <input type="text" class="office-name-input" value="${this.escapeHtml(office.name)}" placeholder="Office name">
                    <div class="office-item-actions">
                        <button type="button" class="admin-btn subtle focus-btn" title="Focus on map">Focus</button>
                        <button type="button" class="admin-btn danger remove-btn" title="Remove office">Delete</button>
                    </div>
                </header>
                <div class="coordinate-row">
                    <label>
                        Latitude
                        <input type="number" step="0.000001" class="office-lat-input" value="${office.lat.toFixed(6)}">
                    </label>
                    <label>
                        Longitude
                        <input type="number" step="0.000001" class="office-lng-input" value="${office.lng.toFixed(6)}">
                    </label>
                </div>
                <label class="description-label">
                    Notes
                    <textarea rows="2" class="office-description-input" placeholder="Optional description">${this.escapeHtml(office.description ?? '')}</textarea>
                </label>
            `;

            const nameInput = item.querySelector('.office-name-input');
            const latInput = item.querySelector('.office-lat-input');
            const lngInput = item.querySelector('.office-lng-input');
            const descInput = item.querySelector('.office-description-input');
            const focusBtn = item.querySelector('.focus-btn');
            const deleteBtn = item.querySelector('.remove-btn');

            nameInput?.addEventListener('input', (event) => {
                office.name = event.target.value;
                const marker = this.officeMarkers.get(office.id);
                if (marker) {
                    marker.setPopupContent(`<strong>${this.escapeHtml(office.name || 'Untitled office')}</strong>`);
                }
                this.setDirty();
            });

            const handleCoordinateChange = (event, key) => {
                const value = parseFloat(event.target.value);
                if (Number.isNaN(value)) {
                    event.target.classList.add('input-error');
                    return;
                }
                event.target.classList.remove('input-error');
                office[key] = value;
                const marker = this.officeMarkers.get(office.id);
                if (marker) {
                    marker.setLatLng([office.lat, office.lng]);
                }
                this.setDirty();
            };

            latInput?.addEventListener('change', (event) => handleCoordinateChange(event, 'lat'));
            lngInput?.addEventListener('change', (event) => handleCoordinateChange(event, 'lng'));

            descInput?.addEventListener('input', (event) => {
                office.description = event.target.value;
                this.setDirty();
            });

            focusBtn?.addEventListener('click', () => this.focusOnOffice(office.id));
            deleteBtn?.addEventListener('click', () => this.removeOffice(office.id));

            this.officeListEl.appendChild(item);
        });

        this.updateOfficeCount();
    }

    refreshOfficeInputs(officeId) {
        const office = this.data.offices.find((item) => item.id === officeId);
        if (!office) return;

        const item = this.officeListEl?.querySelector(`[data-office-id="${officeId}"]`);
        if (!item) return;

        const latInput = item.querySelector('.office-lat-input');
        const lngInput = item.querySelector('.office-lng-input');

        if (latInput) {
            latInput.value = office.lat.toFixed(6);
        }
        if (lngInput) {
            lngInput.value = office.lng.toFixed(6);
        }
    }

    focusOnBuilding() {
        if (!this.map || !this.buildingMarker) return;
        const { lat, lng } = this.data.buildingCenter;
        this.map.setView([lat, lng], 19);
        this.buildingMarker.openPopup();
    }

    focusOnOffice(officeId) {
        const office = this.data.offices.find((item) => item.id === officeId);
        const marker = this.officeMarkers.get(officeId);
        if (!office || !marker || !this.map) return;

        this.map.setView([office.lat, office.lng], 19);
        marker.openPopup();
        marker.setZIndexOffset(1000);
        setTimeout(() => marker.setZIndexOffset(0), 1500);
    }

    addOffice() {
        const { lat, lng } = this.data.buildingCenter;
        const newOffice = {
            id: this.generateId(),
            name: 'New Office',
            lat: Number.isFinite(lat) ? lat : 0,
            lng: Number.isFinite(lng) ? lng : 0,
            description: ''
        };

        this.data.offices.push(newOffice);
        this.renderOfficeList();
        this.renderMarkers();
        this.setDirty();
        this.showToast('New office created near the building center.', 'success');

        // Focus on newly added office
        setTimeout(() => this.focusOnOffice(newOffice.id), 150);
    }

    removeOffice(officeId) {
        const office = this.data.offices.find((item) => item.id === officeId);
        if (!office) return;

        const confirmed = window.confirm(`Delete "${office.name}"? This cannot be undone.`);
        if (!confirmed) return;

        this.data.offices = this.data.offices.filter((item) => item.id !== officeId);
        const marker = this.officeMarkers.get(officeId);
        if (marker) {
            marker.remove();
            this.officeMarkers.delete(officeId);
        }
        this.renderOfficeList();
        this.setDirty();
        this.showToast('Office removed.', 'info');
    }

    updateOfficeCount() {
        if (this.officeCountBadge) {
            this.officeCountBadge.textContent = String(this.data.offices.length);
        }
    }

    setDirty(state = true) {
        this.isDirty = state;
        if (!this.saveButton) return;
        if (state) {
            this.saveButton.classList.add('dirty');
            this.saveButton.textContent = 'Save to browser (unsaved)';
        } else {
            this.saveButton.classList.remove('dirty');
            this.saveButton.textContent = 'Save to browser';
        }
    }

    validateData() {
        const errors = [];

        const { lat, lng } = this.data.buildingCenter;
        if (!this.isValidLatitude(lat)) {
            errors.push('Building latitude must be between -90 and 90.');
        }
        if (!this.isValidLongitude(lng)) {
            errors.push('Building longitude must be between -180 and 180.');
        }

        this.data.offices.forEach((office, index) => {
            if (!office.name || !office.name.trim()) {
                errors.push(`Office ${index + 1} must have a name.`);
            }
            if (!this.isValidLatitude(office.lat)) {
                errors.push(`Office ${index + 1} latitude must be between -90 and 90.`);
            }
            if (!this.isValidLongitude(office.lng)) {
                errors.push(`Office ${index + 1} longitude must be between -180 and 180.`);
            }
        });

        return errors;
    }

    saveToBrowser() {
        const errors = this.validateData();
        if (errors.length > 0) {
            this.showToast(errors.join(' '), 'error');
            return;
        }

        try {
            const payload = this.stripMeta(this.data);
            window.localStorage?.setItem(this.storageKey, JSON.stringify(payload));
            this.setDirty(false);
            this.showToast('Changes saved to this browser.', 'success');
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            this.showToast('Unable to save changes to the browser.', 'error');
        }
    }

    downloadJson() {
        const errors = this.validateData();
        if (errors.length > 0) {
            this.showToast(errors.join(' '), 'error');
            return;
        }

        const payload = this.stripMeta(this.data);
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
        link.download = `offices-${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast('Downloaded updated offices.json.', 'success');
    }

    resetChanges() {
        const confirmed = window.confirm('Reset all changes? Local browser data will be cleared.');
        if (!confirmed) return;

        try {
            window.localStorage?.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Unable to clear stored data:', error);
        }

        this.data = this.decorateData(this.fileBaseline ?? this.createEmptyData());
        this.renderAll();
        this.setDirty(false);
        this.showToast('Changes reset to offices.json baseline.', 'info');
    }

    stripMeta(data) {
        const buildingCenter = {
            lat: Number(data.buildingCenter.lat),
            lng: Number(data.buildingCenter.lng)
        };

        if (data.buildingCenter.name && data.buildingCenter.name.trim()) {
            buildingCenter.name = data.buildingCenter.name.trim();
        }

        const offices = data.offices.map((office) => {
            const entry = {
                name: (office.name ?? '').trim(),
                lat: Number(office.lat),
                lng: Number(office.lng)
            };
            if (office.description && office.description.trim()) {
                entry.description = office.description.trim();
            }
            return entry;
        });

        return { buildingCenter, offices };
    }

    isValidLatitude(value) {
        return Number.isFinite(value) && value >= -90 && value <= 90;
    }

    isValidLongitude(value) {
        return Number.isFinite(value) && value >= -180 && value <= 180;
    }

    showToast(message, type = 'info') {
        if (!this.toastEl) return;
        this.toastEl.textContent = message;
        this.toastEl.className = `admin-toast show ${type}`;

        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.toastEl.classList.remove('show');
        }, 3200);
    }

    escapeHtml(value) {
        if (value === undefined || value === null) {
            return '';
        }
        return value
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    generateId() {
        if (window.crypto?.randomUUID) {
            return window.crypto.randomUUID();
        }
        return `office-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
});
