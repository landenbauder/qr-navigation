// Developer-only walkway editor. Loaded on demand from developer mode; never shipped to visitors.
// Draws the property walking network and exports it as GeoJSON ([longitude, latitude]).
(function (root) {
    'use strict';

    const core = root.QRNavCore || {};
    const geo = core.geo;
    const validator = core.validate;
    if (!geo || !validator) {
        throw new Error('nav-geo.js and nav-validate.js must load before dev-network-editor.js');
    }

    const PROPERTY_ID = 'willowbrook';
    const STORAGE_KEY = 'qr-navigation-walking-network-draft-v1';
    const REPO_DRAFT_URL = 'data/properties/willowbrook/draft/walking-network-draft.geojson';
    const REFERENCE_URL = 'data/properties/willowbrook/draft/reference-points.geojson';
    const NODE_HIT_PX = 14;
    const LINE_HIT_PX = 10;
    const MIN_SPLIT_END_GAP_M = 0.3;
    const HISTORY_LIMIT = 100;

    const TOOLS = [
        { id: 'select', label: 'Select', hint: 'Tap anything to inspect or edit it. Delete removes the selection; Ctrl+Z undoes.' },
        { id: 'walkway', label: 'Walkway', hint: 'Tap a start point, tap along the bends, then tap an existing point to connect. Enter or Finish ends at the last tap. Walkways only connect where you tap an existing point.' },
        { id: 'split', label: 'Split', hint: 'Tap a walkway to add a real junction there. Use this before connecting a new walkway into the middle of an existing one.' },
        { id: 'door', label: 'Door', hint: 'Pick an office, then tap its door. Tapping an orange reference door assigns that office automatically. Connect the door to a walkway with the Walkway tool.' },
        { id: 'sign', label: 'QR sign', hint: 'Tap the point where a QR sign stands (or an empty spot to create one). You will be asked for its ID and label.' },
        { id: 'parking', label: 'Parking', hint: 'Tap the point where drivers start walking, give it a name, then tap where map apps should navigate to.' },
        { id: 'gate', label: 'Gate', hint: 'Tap a walkway where it passes through a fence or wall to add a gate, or tap a point to toggle it as a gate.' },
        { id: 'area', label: 'Area', hint: 'Choose the area type, tap its corners, then press Finish. Parking areas are never walkable on their own.' },
        { id: 'barrier', label: 'Barrier', hint: 'Tap along a fence, wall, curb, or planter, then press Finish.' }
    ];

    const LABELS = {
        edgeKind: { sidewalk: 'Sidewalk', path: 'Path', crosswalk: 'Crosswalk', 'parking-crossing': 'Parking crossing', 'entrance-connector': 'Door connector', 'gate-passage': 'Gate passage', ramp: 'Ramp', stairs: 'Stairs' },
        status: { open: 'Open', closed: 'Closed', 'temporarily-closed': 'Temporarily closed' },
        access: { public: 'Public', private: 'Private', restricted: 'Restricted', unknown: 'Unknown' },
        verification: { unverified: 'Unverified', 'imagery-reviewed': 'Checked on aerial', 'owner-confirmed': 'Owner confirmed', 'field-verified': 'Walked on site', synthetic: 'Synthetic (tests only)' },
        areaKind: { building: 'Building', 'no-walk': 'No-walk zone', parking: 'Parking (not walkable)', 'navigation-boundary': 'Navigation boundary', 'walkable-area': 'Walkable area (stored only)' },
        barrierKind: { fence: 'Fence', wall: 'Wall', curb: 'Curb (no ramp)', planter: 'Planter / landscaping', other: 'Other' },
        nodeKind: { junction: 'Junction', endpoint: 'End point', entrance: 'Door', gate: 'Gate' },
        startStatus: { active: 'Active', retired: 'Retired' }
    };

    const AREA_STYLES = {
        building: { color: '#37474f', weight: 2, fillColor: '#546e7a', fillOpacity: 0.35 },
        'no-walk': { color: '#c62828', weight: 2, fillColor: '#e53935', fillOpacity: 0.22, dashArray: '6 4' },
        parking: { color: '#1565c0', weight: 1.5, fillColor: '#64b5f6', fillOpacity: 0.16 },
        'navigation-boundary': { color: '#2e7d32', weight: 3, fill: false, dashArray: '10 6' },
        'walkable-area': { color: '#558b2f', weight: 1, fillColor: '#aed581', fillOpacity: 0.18 }
    };

    const EDGE_COLORS = {
        sidewalk: '#1565c0', path: '#1565c0', ramp: '#00838f', stairs: '#212121',
        crosswalk: '#6a1b9a', 'parking-crossing': '#6a1b9a', 'entrance-connector': '#ef6c00', 'gate-passage': '#5d4037'
    };

    function round8(value) {
        return Math.round(value * 1e8) / 1e8;
    }

    function toCoord(latlng) {
        return [round8(latlng.lng), round8(latlng.lat)];
    }

    function toLatLng(coord) {
        return [coord[1], coord[0]];
    }

    function toOfficeId(unit) {
        const normalized = String(unit || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalized ? `u${normalized}` : null;
    }

    function slugify(text) {
        return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'arrival';
    }

    function el(tag, attrs = {}, children = []) {
        const node = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (value === undefined || value === null || value === false) return;
            if (key === 'text') node.textContent = value;
            else if (key === 'className') node.className = value;
            else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
            else node.setAttribute(key, value === true ? '' : value);
        });
        (Array.isArray(children) ? children : [children]).filter(Boolean).forEach(child => node.appendChild(child));
        return node;
    }

    function labelElement(text) {
        return el('span', { text });
    }

    function isTextTarget(target) {
        return !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    }

    class NetworkEditor {
        constructor(app) {
            this.app = app;
            this.map = app.map;
            this.features = [];
            this.byId = new Map();
            this.history = [];
            this.tool = 'select';
            this.drawing = null;
            this.selectedId = null;
            this.moveNodeId = null;
            this.validation = null;
            this.referenceFeatures = [];
            this.showReferences = true;
            this.edgeDefaults = { edgeKind: 'sidewalk', status: 'open', access: 'public' };
            this.areaKind = 'building';
            this.barrierKind = 'fence';
            this.offices = (app.offices || [])
                .map(office => ({ officeId: toOfficeId(office.unit), label: app.formatOfficeLabel(office), unit: Number(office.unit) }))
                .filter(office => office.officeId)
                .sort((a, b) => a.unit - b.unit);
            this.doorOfficeId = this.offices.length ? this.offices[0].officeId : '';
            this.validationOptions = this.buildValidationOptions(app.offices || []);
            this.layers = null;
            this.panel = null;
            this.onKeyDown = event => this.handleKeyDown(event);
        }

        buildValidationOptions(offices) {
            const lats = offices.map(o => o.lat).filter(Number.isFinite);
            const lngs = offices.map(o => o.lng).filter(Number.isFinite);
            const padding = 0.005;
            return {
                officeIds: this.offices.map(o => o.officeId),
                bbox: lats.length
                    ? [Math.min(...lngs) - padding, Math.min(...lats) - padding, Math.max(...lngs) + padding, Math.max(...lats) + padding]
                    : null
            };
        }

        async open() {
            if (this.panel) {
                return;
            }
            this.app.setTraceModeActive(false);
            this.app.setTestingModePickActive(false);
            this.app.closePanorama();
            this.app.clearRoute();
            if (this.app.landingMenu) this.app.landingMenu.style.display = 'none';
            if (this.app.mapContainer) {
                this.app.mapContainer.style.display = 'block';
                this.app.mapContainer.style.visibility = 'visible';
            }
            document.body.classList.add('network-editor-active');
            this.app.networkEditorActive = true;
            this.map.doubleClickZoom.disable();

            this.layers = {
                references: L.layerGroup().addTo(this.map),
                areas: L.layerGroup().addTo(this.map),
                barriers: L.layerGroup().addTo(this.map),
                edges: L.layerGroup().addTo(this.map),
                nodes: L.layerGroup().addTo(this.map),
                places: L.layerGroup().addTo(this.map),
                issues: L.layerGroup().addTo(this.map),
                drawing: L.layerGroup().addTo(this.map)
            };
            this.buildPanel();
            document.addEventListener('keydown', this.onKeyDown);

            await Promise.all([this.loadDraft(), this.loadReferences()]);
            this.afterChange({ persist: false });
            this.fitToContent();
            this.app.invalidateMapLayout(40);
        }

        close() {
            if (!this.panel) {
                return;
            }
            this.drawing = null;
            this.moveNodeId = null;
            document.removeEventListener('keydown', this.onKeyDown);
            Object.values(this.layers).forEach(layer => this.map.removeLayer(layer));
            this.layers = null;
            this.panel.remove();
            this.panel = null;
            this.map.doubleClickZoom.enable();
            document.body.classList.remove('network-editor-active');
            this.app.networkEditorActive = false;
            if (this.app.isLocalTestMode && this.app.officeTracePanel) {
                this.app.officeTracePanel.style.display = 'flex';
            }
            this.app.showStatus('Walkway editor closed. Your draft is saved in this browser.');
        }

        // ---------- data loading and persistence ----------

        async loadDraft() {
            try {
                const saved = window.localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed && Array.isArray(parsed.features) && parsed.features.length > 0) {
                        this.features = parsed.features;
                        this.status(`Loaded your saved draft (${this.features.length} items).`);
                        return;
                    }
                }
            } catch (error) {
                console.warn('Unable to read the saved walkway draft:', error);
            }
            try {
                const response = await fetch(REPO_DRAFT_URL, { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
                        this.features = data.features;
                        this.status(`Loaded the repository draft (${this.features.length} items).`);
                    }
                }
            } catch (error) {
                // No repository draft yet.
            }
        }

        async loadReferences() {
            try {
                const response = await fetch(REFERENCE_URL, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const data = await response.json();
                this.referenceFeatures = Array.isArray(data.features) ? data.features : [];
            } catch (error) {
                this.referenceFeatures = [];
                this.status('Reference points not found. Run: node tools/import-legacy.js');
            }
        }

        persist() {
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    schemaVersion: validator.SCHEMA_VERSION,
                    propertyId: PROPERTY_ID,
                    savedAt: new Date().toISOString(),
                    features: this.features
                }));
            } catch (error) {
                console.warn('Unable to save walkway draft:', error);
                this.status('Could not save the draft in this browser. Export it to keep your work.');
            }
        }

        indexFeatures() {
            this.byId = new Map(this.features.map(f => [f.id, f]));
        }

        get(id) {
            return this.byId.get(id) || null;
        }

        ofType(type) {
            return this.features.filter(f => f.properties && f.properties.featureType === type);
        }

        nextId(prefix) {
            let max = 0;
            const pattern = new RegExp(`^${prefix}(\\d+)$`);
            this.features.forEach((f) => {
                const match = typeof f.id === 'string' && f.id.match(pattern);
                if (match) max = Math.max(max, Number(match[1]));
            });
            return `${prefix}${max + 1}`;
        }

        mutate(change) {
            this.history.push(JSON.stringify(this.features));
            if (this.history.length > HISTORY_LIMIT) this.history.shift();
            change();
            this.afterChange();
        }

        afterChange({ persist = true } = {}) {
            this.indexFeatures();
            this.normalizeNodeKinds();
            if (this.selectedId && !this.get(this.selectedId)) this.selectedId = null;
            if (persist) this.persist();
            this.validation = validator.validateNetworkDraft(this.toFeatureCollection(), this.validationOptions);
            this.render();
            this.renderPanel();
        }

        normalizeNodeKinds() {
            const degree = new Map();
            this.ofType('edge').forEach((edge) => {
                [edge.properties.from, edge.properties.to].forEach(id => degree.set(id, (degree.get(id) || 0) + 1));
            });
            this.ofType('node').forEach((node) => {
                const kind = node.properties.nodeKind;
                if (kind === 'junction' || kind === 'endpoint') {
                    node.properties.nodeKind = (degree.get(node.id) || 0) >= 2 ? 'junction' : 'endpoint';
                }
            });
        }

        undo() {
            if (this.history.length === 0) return;
            this.features = JSON.parse(this.history.pop());
            this.drawing = null;
            this.moveNodeId = null;
            this.afterChange();
            this.status('Undone.');
        }

        toFeatureCollection() {
            return { type: 'FeatureCollection', features: this.features };
        }

        // ---------- feature operations ----------

        createNode(coord, nodeKind = 'endpoint', extra = {}) {
            const id = this.nextId('n');
            this.features.push({
                type: 'Feature',
                id,
                geometry: { type: 'Point', coordinates: coord.slice() },
                properties: { featureType: 'node', nodeKind, verification: 'unverified', ...extra }
            });
            this.indexFeatures();
            return id;
        }

        createEdge(fromId, toId, bends) {
            const id = this.nextId('e');
            const from = this.get(fromId);
            const to = this.get(toId);
            this.features.push({
                type: 'Feature',
                id,
                geometry: { type: 'LineString', coordinates: [from.geometry.coordinates.slice(), ...bends.map(c => c.slice()), to.geometry.coordinates.slice()] },
                properties: {
                    featureType: 'edge',
                    from: fromId,
                    to: toId,
                    edgeKind: this.edgeDefaults.edgeKind,
                    status: this.edgeDefaults.status,
                    access: this.edgeDefaults.access,
                    hasSteps: null,
                    curbRamps: null,
                    verification: 'unverified'
                }
            });
            this.indexFeatures();
            return id;
        }

        moveNode(nodeId, coord) {
            const node = this.get(nodeId);
            node.geometry.coordinates = coord.slice();
            this.ofType('edge').forEach((edge) => {
                const coords = edge.geometry.coordinates;
                if (edge.properties.from === nodeId) coords[0] = coord.slice();
                if (edge.properties.to === nodeId) coords[coords.length - 1] = coord.slice();
            });
            this.features.forEach((f) => {
                const type = f.properties.featureType;
                if ((type === 'start' || type === 'arrival') && f.properties.nodeId === nodeId) {
                    f.geometry.coordinates = coord.slice();
                }
            });
        }

        splitEdge(edgeId, coord, segmentIndex, nodeKind = 'junction') {
            const edge = this.get(edgeId);
            const coords = edge.geometry.coordinates;
            const nodeId = this.createNode(coord, nodeKind);
            const firstPart = coords.slice(0, segmentIndex + 1).concat([coord.slice()]);
            const secondPart = [coord.slice()].concat(coords.slice(segmentIndex + 1));
            const dedupe = line => line.filter((c, i) => i === 0 || c[0] !== line[i - 1][0] || c[1] !== line[i - 1][1]);
            const newEdgeId = this.nextId('e');
            const props = JSON.parse(JSON.stringify(edge.properties));
            const originalTo = props.to;
            edge.geometry.coordinates = dedupe(firstPart);
            edge.properties.to = nodeId;
            this.features.push({
                type: 'Feature',
                id: newEdgeId,
                geometry: { type: 'LineString', coordinates: dedupe(secondPart) },
                properties: { ...props, from: nodeId, to: originalTo }
            });
            this.indexFeatures();
            return nodeId;
        }

        deleteFeature(id) {
            const feature = this.get(id);
            if (!feature) return;
            const type = feature.properties.featureType;
            if (type === 'node') {
                const edges = this.ofType('edge').filter(e => e.properties.from === id || e.properties.to === id);
                const places = this.features.filter(f => ['start', 'arrival'].includes(f.properties.featureType) && f.properties.nodeId === id);
                const extras = edges.length + places.length;
                if (extras > 0 && !window.confirm(`Delete this point and ${edges.length} walkway(s)${places.length ? ` and ${places.length} sign/parking marker(s)` : ''} attached to it?`)) {
                    return;
                }
                const remove = new Set([id, ...edges.map(e => e.id), ...places.map(p => p.id)]);
                this.mutate(() => { this.features = this.features.filter(f => !remove.has(f.id)); });
            } else {
                this.mutate(() => { this.features = this.features.filter(f => f.id !== id); });
            }
            this.selectedId = null;
            this.renderPanel();
        }

        // ---------- hit testing ----------

        containerPoint(coord) {
            return this.map.latLngToContainerPoint(toLatLng(coord));
        }

        hitNode(point) {
            let best = null;
            this.ofType('node').forEach((node) => {
                const distance = this.containerPoint(node.geometry.coordinates).distanceTo(point);
                if (distance <= NODE_HIT_PX && (!best || distance < best.distance)) best = { feature: node, distance };
            });
            return best ? best.feature : null;
        }

        lineDistancePx(point, coords) {
            const pts = coords.map(c => this.containerPoint(c));
            let best = Infinity;
            for (let i = 1; i < pts.length; i += 1) {
                best = Math.min(best, L.LineUtil.pointToSegmentDistance(point, pts[i - 1], pts[i]));
            }
            return best;
        }

        hitLine(point, type) {
            let best = null;
            this.ofType(type).forEach((feature) => {
                const distance = this.lineDistancePx(point, feature.geometry.coordinates);
                if (distance <= LINE_HIT_PX && (!best || distance < best.distance)) best = { feature, distance };
            });
            return best ? best.feature : null;
        }

        hitArea(coord) {
            const hits = this.ofType('area').filter((area) => {
                try {
                    return geo.pointInPolygon(coord, area.geometry.coordinates);
                } catch (error) {
                    return false;
                }
            });
            const size = area => {
                const ring = area.geometry.coordinates[0];
                const lngs = ring.map(c => c[0]);
                const lats = ring.map(c => c[1]);
                return (Math.max(...lngs) - Math.min(...lngs)) * (Math.max(...lats) - Math.min(...lats));
            };
            hits.sort((a, b) => size(a) - size(b));
            return hits[0] || null;
        }

        hitVertex(point) {
            let best = null;
            [...this.ofType('area'), ...this.ofType('barrier')].forEach((feature) => {
                const coords = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[0] : feature.geometry.coordinates;
                coords.forEach((coord) => {
                    const distance = this.containerPoint(coord).distanceTo(point);
                    if (distance <= NODE_HIT_PX && (!best || distance < best.distance)) best = { coord, distance };
                });
            });
            return best ? best.coord.slice() : null;
        }

        hitReferenceDoor(point) {
            if (!this.showReferences) return null;
            let best = null;
            this.referenceFeatures.filter(f => f.properties.featureType === 'reference-door').forEach((ref) => {
                const distance = this.containerPoint(ref.geometry.coordinates).distanceTo(point);
                if (distance <= NODE_HIT_PX && (!best || distance < best.distance)) best = { feature: ref, distance };
            });
            return best ? best.feature : null;
        }

        // ---------- map events ----------

        handleMapClick(event) {
            if (!event || !event.latlng || !event.containerPoint) return;
            const coord = toCoord(event.latlng);
            const point = event.containerPoint;
            try {
                switch (this.tool) {
                    case 'walkway': this.clickWalkway(coord, point); break;
                    case 'split': this.clickSplit(coord, point, 'junction'); break;
                    case 'door': this.clickDoor(coord, point); break;
                    case 'sign': this.clickSign(coord, point); break;
                    case 'parking': this.clickParking(coord, point); break;
                    case 'gate': this.clickGate(coord, point); break;
                    case 'area':
                    case 'barrier': this.clickShape(coord, point); break;
                    default: this.clickSelect(coord, point);
                }
            } catch (error) {
                console.error('Walkway editor error:', error);
                this.status(`Something went wrong: ${error.message}`);
            }
        }

        handleMapMouseMove(event) {
            if (!this.drawing || !event || !event.latlng) return;
            this.renderDrawing(toCoord(event.latlng));
        }

        handleKeyDown(event) {
            if (isTextTarget(event.target)) return;
            const key = event.key;
            if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z') {
                event.preventDefault();
                this.undo();
            } else if (key === 'Escape') {
                event.preventDefault();
                if (this.drawing || this.moveNodeId) this.cancelDrawing();
                else { this.selectedId = null; this.render(); this.renderPanel(); }
            } else if (key === 'Enter') {
                if (event.target && event.target.tagName === 'BUTTON') return;
                event.preventDefault();
                this.finishDrawing();
            } else if (key === 'Backspace' && this.drawing) {
                event.preventDefault();
                this.removeLastDrawingPoint();
            } else if (key === 'Delete' && this.selectedId) {
                event.preventDefault();
                this.deleteFeature(this.selectedId);
            }
        }

        clickSelect(coord, point) {
            if (this.moveNodeId) {
                const nodeId = this.moveNodeId;
                this.moveNodeId = null;
                this.mutate(() => this.moveNode(nodeId, coord));
                this.status('Point moved. Connected walkways were re-checked.');
                return;
            }
            const hit = this.hitNode(point)
                || this.hitLine(point, 'edge')
                || this.hitLine(point, 'barrier')
                || this.hitArea(coord);
            this.selectedId = hit ? hit.id : null;
            this.render();
            this.renderPanel();
        }

        clickWalkway(coord, point) {
            const nodeHit = this.hitNode(point);
            if (!this.drawing) {
                if (!nodeHit && this.hitLine(point, 'edge')) {
                    this.status('That spot is on an existing walkway. Use Split first so the junction is explicit.');
                    return;
                }
                this.drawing = nodeHit
                    ? { type: 'walkway', fromNodeId: nodeHit.id, fromCoord: nodeHit.geometry.coordinates.slice(), bends: [] }
                    : { type: 'walkway', fromNodeId: null, fromCoord: coord, bends: [] };
                this.renderDrawing();
                this.renderPanel();
                return;
            }
            if (nodeHit) {
                if (nodeHit.id === this.drawing.fromNodeId) {
                    if (this.drawing.bends.length > 0) this.status('A walkway cannot end where it starts.');
                    return;
                }
                const drawing = this.drawing;
                this.mutate(() => {
                    const fromId = drawing.fromNodeId || this.createNode(drawing.fromCoord);
                    this.createEdge(fromId, nodeHit.id, drawing.bends);
                });
                this.drawing = { type: 'walkway', fromNodeId: nodeHit.id, fromCoord: nodeHit.geometry.coordinates.slice(), bends: [] };
                this.status('Connected. Keep tapping to continue from here, or press Esc to stop.');
                this.renderDrawing();
                this.renderPanel();
                return;
            }
            this.drawing.bends.push(coord);
            this.renderDrawing();
            this.renderPanel();
        }

        clickSplit(coord, point, nodeKind) {
            const edge = this.hitLine(point, 'edge');
            if (!edge) {
                this.status('Tap directly on a walkway line.');
                return false;
            }
            const coords = edge.geometry.coordinates;
            const nearest = geo.nearestPointOnPolyline(coord, coords);
            const total = geo.polylineLengthMeters(coords);
            if (nearest.distanceAlongM < MIN_SPLIT_END_GAP_M || total - nearest.distanceAlongM < MIN_SPLIT_END_GAP_M) {
                this.status('That is the end of the walkway; there is already a point there.');
                return false;
            }
            const splitCoord = [round8(nearest.coord[0]), round8(nearest.coord[1])];
            let nodeId = null;
            this.mutate(() => { nodeId = this.splitEdge(edge.id, splitCoord, nearest.segmentIndex, nodeKind); });
            this.selectedId = nodeId;
            this.render();
            this.renderPanel();
            this.status(nodeKind === 'gate' ? `Gate ${nodeId} added on ${edge.id}.` : `Junction ${nodeId} added. ${edge.id} is now two walkways.`);
            return true;
        }

        currentDoorNode(officeId) {
            return this.ofType('node').find(n => n.properties.nodeKind === 'entrance' && n.properties.officeId === officeId) || null;
        }

        officeLabel(officeId) {
            const office = this.offices.find(o => o.officeId === officeId);
            return office ? office.label : officeId;
        }

        clickDoor(coord, point) {
            const ref = this.hitReferenceDoor(point);
            const nodeHit = this.hitNode(point);
            if (ref && !nodeHit) {
                this.doorOfficeId = ref.properties.officeId;
                coord = ref.geometry.coordinates.slice();
            }
            const officeId = this.doorOfficeId;
            if (!officeId) {
                this.status('Choose an office first.');
                return;
            }
            const officeLabel = this.officeLabel(officeId);
            const existing = this.currentDoorNode(officeId);

            if (nodeHit) {
                if (nodeHit.properties.nodeKind === 'entrance' && nodeHit.properties.officeId && nodeHit.properties.officeId !== officeId
                    && !window.confirm(`This point is the door for ${this.officeLabel(nodeHit.properties.officeId)}. Reassign it to ${officeLabel}? Offices do not share doors.`)) {
                    return;
                }
                if (existing && existing.id !== nodeHit.id
                    && !window.confirm(`${officeLabel} already has a door (${existing.id}). Use this point instead? The old point stays as a plain point.`)) {
                    return;
                }
                this.mutate(() => {
                    if (existing && existing.id !== nodeHit.id) {
                        existing.properties.nodeKind = 'endpoint';
                        delete existing.properties.officeId;
                    }
                    nodeHit.properties.nodeKind = 'entrance';
                    nodeHit.properties.officeId = officeId;
                });
                this.selectedId = nodeHit.id;
            } else if (existing) {
                if (!window.confirm(`Move the door for ${officeLabel} here? Connected walkways will be re-checked.`)) return;
                this.mutate(() => this.moveNode(existing.id, coord));
                this.selectedId = existing.id;
            } else {
                let nodeId = null;
                this.mutate(() => { nodeId = this.createNode(coord, 'entrance', { officeId }); });
                this.selectedId = nodeId;
            }
            this.status(`Door set for ${officeLabel}. Connect it to a walkway with the Walkway tool.`);
            const next = this.offices.find(o => !this.currentDoorNode(o.officeId));
            if (next) this.doorOfficeId = next.officeId;
            this.render();
            this.renderPanel();
        }

        resolvePlaceNode(coord, point) {
            const nodeHit = this.hitNode(point);
            if (nodeHit) return { nodeId: nodeHit.id, coord: nodeHit.geometry.coordinates.slice(), isNew: false };
            if (this.hitLine(point, 'edge')) {
                this.status('That spot is on a walkway. Use Split first to add a point there.');
                return null;
            }
            return { nodeId: null, coord, isNew: true };
        }

        clickSign(coord, point) {
            const target = this.resolvePlaceNode(coord, point);
            if (!target) return;
            if (target.nodeId && this.ofType('start').some(s => s.properties.nodeId === target.nodeId)) {
                this.status('This point already has a QR sign.');
                return;
            }
            const rawId = window.prompt('Sign ID for the QR link (lowercase, numbers, dashes), e.g. parking-west');
            if (rawId === null) return;
            const id = rawId.trim();
            if (!/^[a-z0-9-]{1,40}$/.test(id)) {
                this.status('Sign IDs use only lowercase letters, numbers, and dashes (max 40).');
                return;
            }
            if (this.get(id)) {
                this.status(`ID "${id}" is already used.`);
                return;
            }
            const label = window.prompt('Label visitors will see, e.g. West parking lot sign');
            if (label === null || !label.trim()) return;
            this.mutate(() => {
                const nodeId = target.nodeId || this.createNode(target.coord);
                this.features.push({
                    type: 'Feature',
                    id,
                    geometry: { type: 'Point', coordinates: this.get(nodeId).geometry.coordinates.slice() },
                    properties: { featureType: 'start', nodeId, label: label.trim(), status: 'active', signInstalled: null, verification: 'unverified' }
                });
            });
            this.selectedId = id;
            this.render();
            this.renderPanel();
            this.status(`QR sign "${id}" added. Its link will be ?property=${PROPERTY_ID}&start=${id}`);
        }

        clickParking(coord, point) {
            if (this.drawing && this.drawing.type === 'drive-to') {
                const arrivalId = this.drawing.arrivalId;
                this.drawing = null;
                this.mutate(() => { this.get(arrivalId).properties.driveTo = coord; });
                this.status('Drive-to point saved.');
                return;
            }
            const target = this.resolvePlaceNode(coord, point);
            if (!target) return;
            const label = window.prompt('Parking name visitors will see, e.g. Visitor parking - west lot');
            if (label === null || !label.trim()) return;
            let id = `arrival-${slugify(label)}`;
            let suffix = 2;
            while (this.get(id)) id = `arrival-${slugify(label)}-${suffix++}`;
            this.mutate(() => {
                const nodeId = target.nodeId || this.createNode(target.coord);
                this.features.push({
                    type: 'Feature',
                    id,
                    geometry: { type: 'Point', coordinates: this.get(nodeId).geometry.coordinates.slice() },
                    properties: { featureType: 'arrival', nodeId, label: label.trim(), driveTo: null, verification: 'unverified' }
                });
            });
            this.selectedId = id;
            this.drawing = { type: 'drive-to', arrivalId: id };
            this.render();
            this.renderPanel();
            this.status('Now tap where map apps should send drivers (for example the lot entrance), or press Skip.');
        }

        clickGate(coord, point) {
            const nodeHit = this.hitNode(point);
            if (nodeHit) {
                if (nodeHit.properties.nodeKind === 'entrance') {
                    this.status('Doors cannot also be gates.');
                    return;
                }
                const makeGate = nodeHit.properties.nodeKind !== 'gate';
                this.mutate(() => { nodeHit.properties.nodeKind = makeGate ? 'gate' : 'endpoint'; });
                this.status(makeGate ? `${nodeHit.id} is now a gate.` : `${nodeHit.id} is no longer a gate.`);
                return;
            }
            if (this.hitLine(point, 'edge')) {
                this.clickSplit(coord, point, 'gate');
                return;
            }
            let nodeId = null;
            this.mutate(() => { nodeId = this.createNode(coord, 'gate'); });
            this.selectedId = nodeId;
            this.render();
            this.renderPanel();
            this.status(`Gate ${nodeId} added. Connect walkways to it on both sides of the barrier.`);
        }

        clickShape(coord, point) {
            const snapped = this.hitVertex(point) || coord;
            if (!this.drawing) {
                this.drawing = { type: this.tool, points: [] };
            }
            this.drawing.points.push(snapped);
            this.renderDrawing();
            this.renderPanel();
        }

        finishDrawing() {
            const drawing = this.drawing;
            if (!drawing) return;
            if (drawing.type === 'walkway') {
                if (drawing.bends.length === 0) {
                    this.cancelDrawing();
                    return;
                }
                this.mutate(() => {
                    const fromId = drawing.fromNodeId || this.createNode(drawing.fromCoord);
                    const bends = drawing.bends.slice();
                    const endCoord = bends.pop();
                    const endId = this.createNode(endCoord);
                    this.createEdge(fromId, endId, bends);
                });
                this.drawing = null;
                this.status('Walkway added with a dead end. Connect it later by drawing from that point.');
            } else if (drawing.type === 'area') {
                if (drawing.points.length < 3) {
                    this.status('An area needs at least 3 corners.');
                    return;
                }
                const ring = drawing.points.map(p => p.slice());
                ring.push(ring[0].slice());
                this.mutate(() => {
                    this.features.push({
                        type: 'Feature',
                        id: this.nextId('a'),
                        geometry: { type: 'Polygon', coordinates: [ring] },
                        properties: { featureType: 'area', areaKind: this.areaKind, verification: 'unverified' }
                    });
                });
                this.drawing = null;
                this.status(`${LABELS.areaKind[this.areaKind]} added.`);
            } else if (drawing.type === 'barrier') {
                if (drawing.points.length < 2) {
                    this.status('A barrier needs at least 2 points.');
                    return;
                }
                this.mutate(() => {
                    this.features.push({
                        type: 'Feature',
                        id: this.nextId('b'),
                        geometry: { type: 'LineString', coordinates: drawing.points.map(p => p.slice()) },
                        properties: { featureType: 'barrier', barrierKind: this.barrierKind, verification: 'unverified' }
                    });
                });
                this.drawing = null;
                this.status(`${LABELS.barrierKind[this.barrierKind]} added.`);
            } else if (drawing.type === 'drive-to') {
                this.drawing = null;
                this.status('Drive-to point skipped. You can set it later from the inspector.');
            }
            this.renderDrawing();
            this.renderPanel();
        }

        cancelDrawing() {
            this.drawing = null;
            this.moveNodeId = null;
            this.renderDrawing();
            this.renderPanel();
        }

        removeLastDrawingPoint() {
            if (!this.drawing) return;
            if (this.drawing.type === 'walkway' && this.drawing.bends.length > 0) this.drawing.bends.pop();
            else if (this.drawing.points && this.drawing.points.length > 0) this.drawing.points.pop();
            this.renderDrawing();
            this.renderPanel();
        }

        setTool(toolId) {
            this.drawing = null;
            this.moveNodeId = null;
            this.tool = toolId;
            this.renderDrawing();
            this.renderPanel();
        }

        // ---------- map rendering ----------

        render() {
            if (!this.layers) return;
            Object.entries(this.layers).forEach(([name, layer]) => { if (name !== 'drawing') layer.clearLayers(); });
            this.renderReferences();

            this.ofType('area').forEach((area) => {
                const style = AREA_STYLES[area.properties.areaKind] || AREA_STYLES.building;
                const selected = area.id === this.selectedId;
                L.polygon(area.geometry.coordinates.map(ring => ring.map(toLatLng)), {
                    ...style,
                    color: selected ? '#ffd600' : style.color,
                    weight: selected ? 4 : style.weight,
                    interactive: false
                }).addTo(this.layers.areas);
            });

            this.ofType('barrier').forEach((barrier) => {
                L.polyline(barrier.geometry.coordinates.map(toLatLng), {
                    color: barrier.id === this.selectedId ? '#ffd600' : '#6d4c41',
                    weight: barrier.id === this.selectedId ? 7 : 5,
                    dashArray: '2 6',
                    lineCap: 'butt',
                    interactive: false
                }).addTo(this.layers.barriers);
            });

            this.ofType('edge').forEach((edge) => {
                const props = edge.properties;
                const selected = edge.id === this.selectedId;
                let color = EDGE_COLORS[props.edgeKind] || '#1565c0';
                let dashArray = null;
                if (props.status !== 'open') {
                    color = '#c62828';
                    dashArray = '2 8';
                } else if (props.access !== 'public') {
                    dashArray = '8 6';
                }
                L.polyline(edge.geometry.coordinates.map(toLatLng), {
                    color: selected ? '#ffd600' : color,
                    weight: selected ? 8 : 5,
                    opacity: 0.92,
                    dashArray,
                    interactive: false
                }).addTo(this.layers.edges);
            });

            this.ofType('node').forEach((node) => {
                const kind = node.properties.nodeKind;
                const selected = node.id === this.selectedId || node.id === this.moveNodeId;
                const style = {
                    entrance: { radius: 7, color: '#bf360c', fillColor: '#ff9800', fillOpacity: 1, weight: 2 },
                    gate: { radius: 7, color: '#3e2723', fillColor: '#bcaaa4', fillOpacity: 1, weight: 3 },
                    junction: { radius: 5, color: '#0d47a1', fillColor: '#ffffff', fillOpacity: 1, weight: 2 },
                    endpoint: { radius: 5, color: '#b71c1c', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }
                }[kind] || { radius: 5, color: '#0d47a1', fillColor: '#ffffff', fillOpacity: 1, weight: 2 };
                const marker = L.circleMarker(toLatLng(node.geometry.coordinates), {
                    ...style,
                    color: selected ? '#ffd600' : style.color,
                    weight: selected ? 4 : style.weight,
                    interactive: false
                }).addTo(this.layers.nodes);
                if (kind === 'entrance' && node.properties.officeId) {
                    marker.bindTooltip(labelElement(node.properties.officeId.replace(/^u/, '')), { permanent: true, direction: 'right', offset: [8, 0], className: 'nwe-label' });
                }
            });

            this.ofType('start').forEach((start) => {
                L.circleMarker(toLatLng(start.geometry.coordinates), { radius: 11, color: '#2e7d32', weight: 3, fill: false, interactive: false })
                    .bindTooltip(labelElement(`QR ${start.id}`), { permanent: true, direction: 'left', offset: [-10, 0], className: 'nwe-label nwe-label--start' })
                    .addTo(this.layers.places);
            });

            this.ofType('arrival').forEach((arrival) => {
                const latlng = toLatLng(arrival.geometry.coordinates);
                L.circleMarker(latlng, { radius: 11, color: '#1565c0', weight: 3, fill: false, interactive: false })
                    .bindTooltip(labelElement(`P ${arrival.properties.label}`), { permanent: true, direction: 'left', offset: [-10, 0], className: 'nwe-label nwe-label--arrival' })
                    .addTo(this.layers.places);
                const driveTo = arrival.properties.driveTo;
                if (Array.isArray(driveTo)) {
                    L.polyline([latlng, toLatLng(driveTo)], { color: '#1565c0', weight: 2, dashArray: '4 6', interactive: false }).addTo(this.layers.places);
                    L.circleMarker(toLatLng(driveTo), { radius: 6, color: '#1565c0', fillColor: '#bbdefb', fillOpacity: 1, weight: 2, interactive: false }).addTo(this.layers.places);
                }
            });

            if (this.validation) {
                [...this.validation.warnings, ...this.validation.errors].forEach((issue) => {
                    if (!Array.isArray(issue.coord)) return;
                    L.circleMarker(toLatLng(issue.coord), {
                        radius: issue.severity === 'error' ? 13 : 10,
                        color: issue.severity === 'error' ? '#c62828' : '#f9a825',
                        weight: 2,
                        fill: false,
                        interactive: false
                    }).addTo(this.layers.issues);
                });
            }

            this.renderDrawing();
        }

        renderReferences() {
            if (!this.showReferences) return;
            this.referenceFeatures.forEach((ref) => {
                const type = ref.properties.featureType;
                if (type === 'reference-unit-footprint') {
                    L.polygon(ref.geometry.coordinates.map(ring => ring.map(toLatLng)), {
                        color: '#8d6e63', weight: 1, dashArray: '3 4', fill: false, interactive: false
                    }).addTo(this.layers.references);
                } else if (type === 'reference-door') {
                    L.circleMarker(toLatLng(ref.geometry.coordinates), { radius: 6, color: '#ef6c00', weight: 2, fill: false, interactive: false })
                        .bindTooltip(labelElement(ref.properties.unit), { permanent: true, direction: 'top', offset: [0, -6], className: 'nwe-label nwe-label--ref' })
                        .addTo(this.layers.references);
                } else if (type === 'reference-sidewalk-point' || type === 'reference-panorama-point') {
                    const isPano = type === 'reference-panorama-point';
                    L.circleMarker(toLatLng(ref.geometry.coordinates), { radius: 3, color: isPano ? '#7b1fa2' : '#00838f', weight: 2, fill: false, interactive: false })
                        .bindTooltip(labelElement(ref.properties.label), { permanent: true, direction: 'bottom', offset: [0, 4], className: 'nwe-label nwe-label--ref' })
                        .addTo(this.layers.references);
                }
            });
        }

        renderDrawing(cursor = null) {
            if (!this.layers) return;
            this.layers.drawing.clearLayers();
            const drawing = this.drawing;
            if (!drawing) return;
            let points = [];
            if (drawing.type === 'walkway') points = [drawing.fromCoord, ...drawing.bends];
            else if (drawing.points) points = drawing.points.slice();
            if (cursor && drawing.type !== 'drive-to') points.push(cursor);
            if (points.length === 0) return;
            const latlngs = points.map(toLatLng);
            if (drawing.type === 'area' && latlngs.length >= 3) {
                L.polygon(latlngs, { color: '#ffd600', weight: 2, dashArray: '6 4', fillOpacity: 0.12, interactive: false }).addTo(this.layers.drawing);
            } else if (latlngs.length >= 2) {
                L.polyline(latlngs, { color: '#ffd600', weight: 4, dashArray: '6 4', interactive: false }).addTo(this.layers.drawing);
            }
            latlngs.slice(0, cursor ? -1 : undefined).forEach((latlng) => {
                L.circleMarker(latlng, { radius: 4, color: '#f57f17', fillColor: '#ffd600', fillOpacity: 1, weight: 2, interactive: false }).addTo(this.layers.drawing);
            });
        }

        fitToContent() {
            const coords = [];
            this.features.forEach((f) => {
                const g = f.geometry;
                if (!g) return;
                if (g.type === 'Point') coords.push(g.coordinates);
                else if (g.type === 'LineString') coords.push(...g.coordinates);
                else if (g.type === 'Polygon') coords.push(...g.coordinates[0]);
            });
            if (coords.length === 0) {
                this.referenceFeatures.forEach((ref) => {
                    if (ref.geometry.type === 'Point') coords.push(ref.geometry.coordinates);
                });
            }
            if (coords.length > 0) {
                this.map.fitBounds(L.latLngBounds(coords.map(toLatLng)), { padding: [40, 40], maxZoom: 20 });
            }
        }

        // ---------- panel ----------

        buildPanel() {
            this.toolButtons = new Map();
            const tools = el('div', { className: 'nwe-tools', role: 'toolbar', 'aria-label': 'Editor tools' });
            TOOLS.forEach((tool) => {
                const button = el('button', { className: 'nwe-button', type: 'button', text: tool.label, onclick: () => this.setTool(tool.id) });
                this.toolButtons.set(tool.id, button);
                tools.appendChild(button);
            });

            this.contextEl = el('div', { className: 'nwe-section' });
            this.hintEl = el('p', { className: 'nwe-hint', 'aria-live': 'polite' });
            this.inspectorEl = el('div', { className: 'nwe-section' });
            this.issuesSummaryEl = el('summary');
            this.issuesListEl = el('ol');
            const issues = el('details', { className: 'nwe-issues nwe-section', open: true }, [this.issuesSummaryEl, this.issuesListEl]);

            this.fileInput = el('input', { type: 'file', accept: '.geojson,.json,application/geo+json,application/json', hidden: true, onchange: event => this.importFile(event) });
            this.undoButton = el('button', { className: 'nwe-button', type: 'button', text: 'Undo', onclick: () => this.undo() });
            this.referencesButton = el('button', { className: 'nwe-button', type: 'button', text: 'References', onclick: () => { this.showReferences = !this.showReferences; this.render(); this.renderPanel(); } });
            this.aerialButton = el('button', {
                className: 'nwe-button',
                type: 'button',
                text: 'Aerial',
                onclick: () => {
                    this.app.setMapViewMode(this.app.activeMapViewMode === 'real-world' ? 'animated' : 'real-world', { announce: false });
                    this.renderPanel();
                }
            });
            const footer = el('div', { className: 'nwe-footer nwe-section' }, [
                this.undoButton,
                this.aerialButton,
                this.referencesButton,
                el('button', { className: 'nwe-button', type: 'button', text: 'Fit', onclick: () => this.fitToContent() }),
                el('button', { className: 'nwe-button', type: 'button', text: 'Import', onclick: () => this.fileInput.click() }),
                el('button', { className: 'nwe-button nwe-button--primary', type: 'button', text: 'Export', onclick: () => this.exportFile() }),
                el('button', { className: 'nwe-button nwe-button--danger', type: 'button', text: 'Clear', onclick: () => this.clearDraft() }),
                this.fileInput
            ]);

            this.panel = el('section', { className: 'nwe-panel', 'aria-label': 'Walkway editor' }, [
                el('div', { className: 'nwe-header' }, [
                    el('div', {}, [el('span', { className: 'nwe-eyebrow', text: 'Developer tool' }), el('span', { className: 'nwe-title', text: 'Walkway Editor' })]),
                    el('button', { className: 'nwe-button', type: 'button', text: 'Close', onclick: () => this.close() })
                ]),
                tools,
                this.hintEl,
                this.contextEl,
                this.inspectorEl,
                issues,
                footer
            ]);
            // Stop panel taps from reaching the map underneath.
            L.DomEvent.disableClickPropagation(this.panel);
            L.DomEvent.disableScrollPropagation(this.panel);
            document.body.appendChild(this.panel);
            this.renderPanel();
        }

        status(message) {
            this.app.showStatus(message);
        }

        renderPanel() {
            if (!this.panel) return;
            this.toolButtons.forEach((button, id) => {
                button.classList.toggle('is-active', id === this.tool);
                button.setAttribute('aria-pressed', id === this.tool ? 'true' : 'false');
            });
            const tool = TOOLS.find(t => t.id === this.tool);
            this.hintEl.textContent = this.moveNodeId
                ? `Tap the new location for ${this.moveNodeId}. Esc cancels.`
                : (this.drawing && this.drawing.type === 'drive-to' ? 'Tap where map apps should send drivers, or press Skip.' : tool.hint);
            this.undoButton.disabled = this.history.length === 0;
            this.referencesButton.classList.toggle('is-active', this.showReferences);
            this.aerialButton.classList.toggle('is-active', this.app.activeMapViewMode === 'real-world');
            this.renderContext();
            this.renderInspector();
            this.renderIssues();
        }

        selectField(label, options, value, onChange) {
            const select = el('select', { onchange: event => onChange(event.target.value) });
            Object.entries(options).forEach(([optionValue, optionLabel]) => {
                const option = el('option', { value: optionValue, text: optionLabel });
                if (String(optionValue) === String(value)) option.selected = true;
                select.appendChild(option);
            });
            return el('label', { className: 'nwe-field' }, [el('span', { text: label }), select]);
        }

        textField(label, value, onChange, { readOnly = false } = {}) {
            const input = el('input', { type: 'text', value: value || '', readonly: readOnly, onchange: event => onChange(event.target.value) });
            return el('label', { className: 'nwe-field' }, [el('span', { text: label }), input]);
        }

        renderContext() {
            const ctx = this.contextEl;
            ctx.replaceChildren();
            if (this.tool === 'walkway') {
                ctx.appendChild(this.selectField('New walkway', LABELS.edgeKind, this.edgeDefaults.edgeKind, (v) => { this.edgeDefaults.edgeKind = v; }));
                ctx.appendChild(this.selectField('Access', LABELS.access, this.edgeDefaults.access, (v) => { this.edgeDefaults.access = v; }));
            } else if (this.tool === 'area') {
                ctx.appendChild(this.selectField('Area type', LABELS.areaKind, this.areaKind, (v) => { this.areaKind = v; }));
            } else if (this.tool === 'barrier') {
                ctx.appendChild(this.selectField('Barrier type', LABELS.barrierKind, this.barrierKind, (v) => { this.barrierKind = v; }));
            } else if (this.tool === 'door') {
                const options = {};
                this.offices.forEach((office) => { options[office.officeId] = `${this.currentDoorNode(office.officeId) ? '✓ ' : ''}${office.label}`; });
                ctx.appendChild(this.selectField('Office', options, this.doorOfficeId, (v) => { this.doorOfficeId = v; }));
                const done = this.offices.filter(o => this.currentDoorNode(o.officeId)).length;
                ctx.appendChild(el('span', { className: 'nwe-muted', text: `${done} of ${this.offices.length} offices have a door.` }));
            }

            if (this.drawing) {
                const count = this.drawing.type === 'walkway' ? this.drawing.bends.length : (this.drawing.points || []).length;
                const row = el('div', { className: 'nwe-row' }, [
                    el('button', { className: 'nwe-button nwe-button--primary', type: 'button', text: this.drawing.type === 'drive-to' ? 'Skip' : 'Finish', onclick: () => this.finishDrawing() }),
                    this.drawing.type !== 'drive-to' ? el('button', { className: 'nwe-button', type: 'button', text: 'Remove last point', disabled: count === 0, onclick: () => this.removeLastDrawingPoint() }) : null,
                    el('button', { className: 'nwe-button', type: 'button', text: 'Cancel', onclick: () => this.cancelDrawing() })
                ]);
                ctx.appendChild(row);
            }
            ctx.style.display = ctx.childElementCount ? 'flex' : 'none';
        }

        updateProp(feature, key, value) {
            this.mutate(() => {
                if (value === undefined) delete feature.properties[key];
                else feature.properties[key] = value;
            });
        }

        renderInspector() {
            const box = this.inspectorEl;
            box.replaceChildren();
            const feature = this.selectedId ? this.get(this.selectedId) : null;
            if (!feature) {
                const s = this.validation ? this.validation.stats : null;
                box.appendChild(el('span', { className: 'nwe-section-title', text: 'Draft' }));
                box.appendChild(el('span', { className: 'nwe-muted', text: s
                    ? `${s.edges} walkways (${Math.round(s.totalEdgeLengthM)} m), ${s.nodes} points, ${s.entrances} doors, ${s.starts} QR signs, ${s.arrivals} parking, ${s.areas} areas, ${s.barriers} barriers.`
                    : 'Empty.' }));
                return;
            }
            const props = feature.properties;
            const type = props.featureType;
            const triState = { '': 'Unknown', yes: 'Yes', no: 'No' };
            const toTri = v => (v === true ? 'yes' : v === false ? 'no' : '');
            const fromTri = v => (v === 'yes' ? true : v === 'no' ? false : null);
            const title = { node: 'Point', edge: 'Walkway', area: 'Area', barrier: 'Barrier', start: 'QR sign', arrival: 'Parking arrival' }[type] || type;
            box.appendChild(el('span', { className: 'nwe-section-title', text: `${title} ${feature.id}` }));

            if (type === 'node') {
                box.appendChild(this.selectField('Kind', LABELS.nodeKind, props.nodeKind, (v) => this.mutate(() => {
                    props.nodeKind = v;
                    if (v !== 'entrance') delete props.officeId;
                })));
                if (props.nodeKind === 'entrance') {
                    const options = { '': 'Choose office' };
                    this.offices.forEach((office) => { options[office.officeId] = office.label; });
                    box.appendChild(this.selectField('Office', options, props.officeId || '', v => this.updateProp(feature, 'officeId', v || undefined)));
                }
                const places = this.features.filter(f => ['start', 'arrival'].includes(f.properties.featureType) && f.properties.nodeId === feature.id);
                places.forEach((place) => {
                    box.appendChild(el('button', { className: 'nwe-button', type: 'button', text: `Open ${place.properties.featureType === 'start' ? 'QR sign' : 'parking'} ${place.id}`, onclick: () => { this.selectedId = place.id; this.render(); this.renderPanel(); } }));
                });
            } else if (type === 'edge') {
                box.appendChild(el('span', { className: 'nwe-muted', text: `${props.from} → ${props.to}, ${geo.polylineLengthMeters(feature.geometry.coordinates).toFixed(1)} m including bends` }));
                box.appendChild(this.selectField('Kind', LABELS.edgeKind, props.edgeKind, v => this.updateProp(feature, 'edgeKind', v)));
                box.appendChild(this.selectField('Status', LABELS.status, props.status, v => this.updateProp(feature, 'status', v)));
                box.appendChild(this.selectField('Access', LABELS.access, props.access, v => this.updateProp(feature, 'access', v)));
                box.appendChild(this.selectField('Has steps', triState, toTri(props.hasSteps), v => this.updateProp(feature, 'hasSteps', fromTri(v))));
                box.appendChild(this.selectField('Curb ramps', triState, toTri(props.curbRamps), v => this.updateProp(feature, 'curbRamps', fromTri(v))));
                box.appendChild(this.textField('Crosses without junction', (props.crossesWithoutConnection || []).join(', '), (v) => {
                    const ids = v.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
                    this.updateProp(feature, 'crossesWithoutConnection', ids.length ? ids : undefined);
                }));
            } else if (type === 'area') {
                box.appendChild(this.selectField('Type', LABELS.areaKind, props.areaKind, v => this.updateProp(feature, 'areaKind', v)));
            } else if (type === 'barrier') {
                box.appendChild(this.selectField('Type', LABELS.barrierKind, props.barrierKind, v => this.updateProp(feature, 'barrierKind', v)));
            } else if (type === 'start') {
                box.appendChild(el('span', { className: 'nwe-muted', text: `Link: ?property=${PROPERTY_ID}&start=${feature.id}` }));
                box.appendChild(this.textField('Visitor label', props.label, v => v.trim() && this.updateProp(feature, 'label', v.trim())));
                box.appendChild(this.selectField('Status', LABELS.startStatus, props.status, v => this.updateProp(feature, 'status', v)));
                box.appendChild(this.selectField('Sign installed', triState, toTri(props.signInstalled), v => this.updateProp(feature, 'signInstalled', fromTri(v))));
            } else if (type === 'arrival') {
                box.appendChild(this.textField('Visitor label', props.label, v => v.trim() && this.updateProp(feature, 'label', v.trim())));
                box.appendChild(el('span', { className: 'nwe-muted', text: Array.isArray(props.driveTo) ? `Drive-to: ${props.driveTo[1].toFixed(6)}, ${props.driveTo[0].toFixed(6)}` : 'No drive-to point yet.' }));
                box.appendChild(el('button', { className: 'nwe-button', type: 'button', text: 'Pick drive-to point', onclick: () => { this.tool = 'parking'; this.drawing = { type: 'drive-to', arrivalId: feature.id }; this.renderPanel(); } }));
            }

            box.appendChild(this.selectField('Verification', LABELS.verification, props.verification, v => this.updateProp(feature, 'verification', v)));
            if (type !== 'start' && type !== 'arrival') {
                box.appendChild(this.textField('Label', props.label, v => this.updateProp(feature, 'label', v.trim() || undefined)));
            }
            box.appendChild(this.textField('Notes', props.notes, v => this.updateProp(feature, 'notes', v.trim() || undefined)));

            const actions = el('div', { className: 'nwe-row' });
            if (type === 'node') {
                actions.appendChild(el('button', { className: 'nwe-button', type: 'button', text: 'Move', onclick: () => { this.tool = 'select'; this.moveNodeId = feature.id; this.render(); this.renderPanel(); } }));
            }
            actions.appendChild(el('button', { className: 'nwe-button nwe-button--danger', type: 'button', text: 'Delete', onclick: () => this.deleteFeature(feature.id) }));
            actions.appendChild(el('button', { className: 'nwe-button', type: 'button', text: 'Deselect', onclick: () => { this.selectedId = null; this.render(); this.renderPanel(); } }));
            box.appendChild(actions);
        }

        renderIssues() {
            const result = this.validation;
            this.issuesListEl.replaceChildren();
            if (!result) {
                this.issuesSummaryEl.textContent = 'Checks';
                return;
            }
            this.issuesSummaryEl.textContent = `Checks: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`;
            [...result.errors, ...result.warnings].forEach((issue) => {
                const button = el('button', {
                    className: `nwe-issue${issue.severity === 'warning' ? ' nwe-issue--warning' : ''}`,
                    type: 'button',
                    onclick: () => this.focusIssue(issue)
                }, [el('span', { className: 'nwe-issue-code', text: issue.code }), el('span', { text: issue.message })]);
                this.issuesListEl.appendChild(el('li', {}, button));
            });
            if (result.errors.length === 0 && result.warnings.length === 0) {
                this.issuesListEl.appendChild(el('li', { className: 'nwe-muted', text: 'No problems found.' }));
            }
        }

        focusIssue(issue) {
            const id = issue.featureIds.find(fid => this.get(fid));
            if (id) this.selectedId = id;
            if (Array.isArray(issue.coord)) {
                this.map.setView(toLatLng(issue.coord), Math.max(this.map.getZoom(), 20));
            }
            this.render();
            this.renderPanel();
        }

        // ---------- import / export ----------

        exportFile() {
            const result = this.validation || validator.validateNetworkDraft(this.toFeatureCollection(), this.validationOptions);
            const collection = {
                type: 'FeatureCollection',
                metadata: {
                    propertyId: PROPERTY_ID,
                    schemaVersion: validator.SCHEMA_VERSION,
                    status: 'draft',
                    coordinateOrder: '[longitude, latitude] WGS84',
                    exportedAt: new Date().toISOString(),
                    validation: { errors: result.errors.length, warnings: result.warnings.length }
                },
                features: this.features
            };
            const blob = new Blob([`${JSON.stringify(collection, null, 2)}\n`], { type: 'application/geo+json' });
            const url = URL.createObjectURL(blob);
            const link = el('a', { href: url, download: `walking-network-draft-${new Date().toISOString().slice(0, 10)}.geojson` });
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.status(result.errors.length
                ? `Exported with ${result.errors.length} error(s) still to fix.`
                : 'Exported. Save it as data/properties/willowbrook/draft/walking-network-draft.geojson.');
        }

        importFile(event) {
            const file = event.target.files && event.target.files[0];
            event.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(String(reader.result));
                    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
                        throw new Error('not a GeoJSON FeatureCollection');
                    }
                    if (data.metadata && data.metadata.synthetic) {
                        throw new Error('this is synthetic test data');
                    }
                    if (this.features.length > 0 && !window.confirm(`Replace the current draft (${this.features.length} items) with ${file.name}? You can undo this.`)) {
                        return;
                    }
                    this.mutate(() => { this.features = data.features; });
                    this.selectedId = null;
                    this.fitToContent();
                    this.status(`Imported ${data.features.length} items from ${file.name}.`);
                } catch (error) {
                    this.status(`Import failed: ${error.message}.`);
                }
            };
            reader.onerror = () => this.status('Import failed: the file could not be read.');
            reader.readAsText(file);
        }

        clearDraft() {
            if (this.features.length === 0) return;
            if (!window.confirm('Clear the whole draft? Export first if you want a copy. You can undo this.')) return;
            this.mutate(() => { this.features = []; });
            this.selectedId = null;
            this.renderPanel();
        }
    }

    core.NetworkEditor = NetworkEditor;
    root.QRNavCore = core;
})(typeof self !== 'undefined' ? self : this);
