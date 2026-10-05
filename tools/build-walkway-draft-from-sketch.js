// One-time conversion of the owner's walkway sketch (2026-10-04) into the editable draft network,
// plus the starting QR sign list. Walkway shapes follow the sketch; positions are anchored to the
// reference door points and the surveyed sidewalk points S1-S30. Everything is marked unverified.
//
// Usage:
//   node tools/build-walkway-draft-from-sketch.js [--force]
//
// Refuses to overwrite existing outputs unless --force, so later editor work is not lost.

const fs = require('fs');
const path = require('path');
const geo = require('../js/nav-geo.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const PROPERTY_DIR = path.join(REPO_ROOT, 'data', 'properties', 'willowbrook');
const REFERENCE_FILE = path.join(PROPERTY_DIR, 'draft', 'reference-points.geojson');
const DRAFT_FILE = path.join(PROPERTY_DIR, 'draft', 'walking-network-draft.geojson');
const SOURCE = 'owner-sketch:2026-10-04';

// Local meters (x east, y north) around the building center used by offices.json.
const projection = geo.createLocalProjection([-87.937808, 41.750197]);
const at = (x, y) => projection.toLngLat({ x, y }).map(v => Math.round(v * 1e8) / 1e8);

const JUNCTIONS = {
    // West building block (units 628-648)
    wSW: [-91.5, -20.5], w636: [-91.5, -15.3], wSign: [-91.5, -6.0], w638: [-91.5, 2.9], wPass: [-91.5, 5.5],
    w642: [-91.5, 14.0], w646: [-91.5, 15.9], wNW: [-91.5, 31.5], eNE: [-65.5, 31.5], e648: [-65.5, 16.0],
    eB: [-65.5, 12.0], ePass: [-65.5, 5.5], s632: [-75.4, -20.5], s628: [-72.7, -20.5],
    // Courtyard walkway along the main lot and its stubs to the north-facing doors
    b624: [-55.5, 13.25], b620: [-39.5, 15.8], f620: [-40.0, 8.0], b618: [-31.0, 18.2],
    // Walkway along the north face of the long building; east of cD it runs in the gap below units 7670/7668
    cW: [-25.4, 8.2], c614: [-14.7, 8.2], c612: [-11.3, 8.2], cD: [-8.4, 8.2], c610: [1.4, 6.0], cE: [18.2, 6.0], cSE: [24.5, 6.0],
    // South-east corner (units 600-608)
    se600: [24.5, -15.0], seC: [24.5, -19.8], s604: [5.2, -19.8], s608: [3.6, -19.8],
    // West walkway up the north buildings
    d7670: [-8.4, 12.3], dS8: [-8.2, 30.7], dLoopB: [-8.4, 45.4], dLoopT: [-6.4, 63.5],
    d7632: [-1.8, 94.4], d7630: [-1.7, 96.4], dNW: [-1.7, 105.0],
    // Inner walkway along the west face of units 7646-7654
    lB: [-1.0, 45.4], l7654: [-1.0, 46.6], l7650: [-1.0, 47.3], l7646: [-1.0, 61.8], lT: [-1.0, 63.5],
    // North and east of the white-roof building
    nNE: [28.6, 105.0], nEnd: [33.0, 105.0], wbSE: [28.6, 70.5],
    // East walkway (units 7648-7668)
    eTop: [23.0, 59.0], e7648: [23.0, 49.4], e7652: [23.0, 46.9], e7656: [18.2, 32.8], e7660: [18.2, 30.8],
    eSign: [18.2, 25.0], e7664: [18.2, 18.0], e7668: [18.2, 14.7]
};

// Sequences of junction names and [x, y] bends. Bends with S-labels come from sidewalk_locations.txt.
const WALKWAYS = [
    { kind: 'sidewalk', path: ['wSW', 'w636', 'wSign', 'w638', 'wPass', 'w642', 'w646', 'wNW'] },
    { kind: 'sidewalk', path: ['wNW', 'eNE'] },
    { kind: 'sidewalk', path: ['eNE', 'e648', 'eB', 'ePass'] },
    { kind: 'sidewalk', path: ['wPass', 'ePass'], notes: 'Passage between the west buildings (from sketch).' },
    { kind: 'sidewalk', path: ['wSW', 's632', 's628'] },
    { kind: 'sidewalk', path: ['eB', [-59.3, 12.8], 'b624', [-42.5, 14.8], 'b620', [-35.5, 17.2], 'b618', [-27.5, 19.0], [-15.2, 25.7], 'dS8'] },
    { kind: 'path', path: ['b620', 'f620'], notes: 'Sketch stub toward doors 620/622; confirm where it meets the building.' },
    { kind: 'path', path: ['b618', 'cW'], notes: 'Diagonal path through the landscaping (from sketch).' },
    { kind: 'sidewalk', path: ['cW', 'c614', 'c612', 'cD', [-6.5, 6.0], 'c610', 'cE', 'cSE'] },
    { kind: 'sidewalk', path: ['cSE', 'se600', 'seC', 's604', 's608'] },
    { kind: 'sidewalk', path: ['cD', 'd7670', 'dS8', [-8.4, 34.4], 'dLoopB', [-8.7, 48.4], [-8.4, 49.7], [-8.3, 54.7], 'dLoopT', [-5.6, 67.2], [-3.2, 76.6], [-2.6, 80.4], [-1.6, 87.1], [-1.9, 90.0], 'd7632', 'd7630', 'dNW'] },
    { kind: 'sidewalk', path: ['dLoopB', 'lB'] },
    { kind: 'sidewalk', path: ['lB', 'l7654', 'l7650', 'l7646', 'lT'] },
    { kind: 'sidewalk', path: ['lT', 'dLoopT'] },
    { kind: 'sidewalk', path: ['dNW', 'nNE', 'nEnd'] },
    { kind: 'sidewalk', path: ['nNE', 'wbSE'], notes: 'Sketch line ends near the east walkway of the next building; not connected until confirmed.' },
    { kind: 'sidewalk', path: ['eTop', 'e7648', 'e7652', [23.0, 38.5], [18.2, 35.5], 'e7656', 'e7660', 'eSign', 'e7664', 'e7668', 'cE'] }
];

const DOOR_CONNECTORS = {
    u600: 'se600', u604: 's604', u608: 's608', u610: 'c610', u612: 'c612', u614: 'c614', u618: 'cW',
    u620: 'f620', u622: 'f620', u624: 'b624', u626: 'ePass', u628: 's628', u632: 's632', u636: 'w636',
    u638: 'w638', u642: 'w642', u646: 'w646', u648: 'e648', u7630: 'd7630', u7632: 'd7632', u7646: 'l7646',
    u7648: 'e7648', u7650: 'l7650', u7652: 'e7652', u7654: 'l7654', u7656: 'e7656', u7660: 'e7660',
    u7664: 'e7664', u7668: 'e7668', u7670: 'd7670'
};
const ASSUMED_CONNECTORS = new Set(['u620', 'u622', 'u626', 'u7630', 'u7632']);

const SIGNS = [
    { id: 'main-lot', label: 'Main parking lot', junction: 'b620' },
    { id: 'west-lot', label: 'West parking lot', junction: 'wSign' },
    { id: 'east-lot', label: 'East parking lot', junction: 'eSign' }
];

function main() {
    const force = process.argv.includes('--force');
    if (fs.existsSync(DRAFT_FILE) && !force) {
        throw new Error(`${path.relative(REPO_ROOT, DRAFT_FILE)} already exists. Re-run with --force to overwrite it.`);
    }

    const reference = JSON.parse(fs.readFileSync(REFERENCE_FILE, 'utf8'));
    const doors = new Map(reference.features
        .filter(f => f.properties.featureType === 'reference-door')
        .map(f => [f.properties.officeId, f]));

    const features = [];
    const nodeId = name => `n-${name}`;
    const base = { verification: 'owner-confirmed', source: [SOURCE] };

    Object.entries(JUNCTIONS).forEach(([name, [x, y]]) => {
        features.push({
            type: 'Feature',
            id: nodeId(name),
            geometry: { type: 'Point', coordinates: at(x, y) },
            properties: { featureType: 'node', nodeKind: 'junction', ...base }
        });
    });

    doors.forEach((door, officeId) => {
        features.push({
            type: 'Feature',
            id: `door-${officeId}`,
            geometry: { type: 'Point', coordinates: door.geometry.coordinates.slice() },
            properties: { featureType: 'node', nodeKind: 'entrance', officeId, ...base, source: [...door.properties.source] }
        });
    });

    const coordOf = id => features.find(f => f.id === id).geometry.coordinates;
    let edgeCount = 0;
    const addEdge = (from, to, bends, props) => {
        edgeCount += 1;
        features.push({
            type: 'Feature',
            id: `e${edgeCount}`,
            geometry: { type: 'LineString', coordinates: [coordOf(from), ...bends, coordOf(to)] },
            properties: {
                featureType: 'edge', from, to, status: 'open', access: 'public',
                hasSteps: null, curbRamps: null, ...base, ...props
            }
        });
    };

    WALKWAYS.forEach((walkway) => {
        let from = null;
        let bends = [];
        walkway.path.forEach((step) => {
            if (typeof step === 'string') {
                if (!JUNCTIONS[step]) throw new Error(`Unknown junction ${step}`);
                if (from) addEdge(nodeId(from), nodeId(step), bends, { edgeKind: walkway.kind, ...(walkway.notes ? { notes: walkway.notes } : {}) });
                from = step;
                bends = [];
            } else {
                bends.push(at(step[0], step[1]));
            }
        });
    });

    Object.entries(DOOR_CONNECTORS).forEach(([officeId, junction]) => {
        if (!doors.has(officeId)) throw new Error(`No reference door for ${officeId}`);
        addEdge(nodeId(junction), `door-${officeId}`, [], {
            edgeKind: 'entrance-connector',
            ...(ASSUMED_CONNECTORS.has(officeId) ? { verification: 'imagery-reviewed', notes: 'Door connection inferred from the aerial image, not drawn in the sketch; confirm on site.' } : {})
        });
    });

    SIGNS.forEach((sign) => {
        features.push({
            type: 'Feature',
            id: sign.id,
            geometry: { type: 'Point', coordinates: coordOf(nodeId(sign.junction)) },
            properties: { featureType: 'start', nodeId: nodeId(sign.junction), label: sign.label, status: 'active', signInstalled: false, ...base }
        });
    });

    const collection = {
        type: 'FeatureCollection',
        metadata: {
            propertyId: 'willowbrook',
            schemaVersion: 1,
            status: 'draft',
            coordinateOrder: '[longitude, latitude] WGS84',
            source: SOURCE,
            notes: [
                'Walkway shapes follow the owner sketch; positions are anchored to reference doors and sidewalk points S1-S30.',
                'Owner statement 2026-10-04: anywhere in the parking lots is walkable. Parking lots are not drawn yet.',
                'Buildings and the navigation boundary are not drawn yet; trace them in the walkway editor on aerial imagery.'
            ]
        },
        features
    };

    fs.writeFileSync(DRAFT_FILE, `${JSON.stringify(collection, null, 2)}\n`);
    console.log(`Wrote ${path.relative(REPO_ROOT, DRAFT_FILE)} (${features.length} features, ${edgeCount} walkways, ${SIGNS.length} QR signs)`);
}

try {
    main();
} catch (error) {
    console.error(`Draft build failed: ${error.message}`);
    process.exitCode = 1;
}
