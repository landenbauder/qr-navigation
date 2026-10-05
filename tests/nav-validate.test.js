const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../js/nav-geo.js');
const { validateNetworkDraft } = require('../js/nav-validate.js');

// Synthetic property near [20, 10]; all layouts are in local meters.
const proj = geo.createLocalProjection([20, 10]);
const c = (x, y) => proj.toLngLat({ x, y });
const BBOX = [19.99, 9.99, 20.01, 10.01];

function node(id, x, y, props = {}) {
    return { type: 'Feature', id, geometry: { type: 'Point', coordinates: c(x, y) }, properties: { featureType: 'node', nodeKind: 'junction', verification: 'synthetic', ...props } };
}
function edge(id, from, to, bends = [], props = {}) {
    return {
        type: 'Feature',
        id,
        geometry: { type: 'LineString', coordinates: [from.geometry.coordinates, ...bends.map(([x, y]) => c(x, y)), to.geometry.coordinates] },
        properties: { featureType: 'edge', from: from.id, to: to.id, edgeKind: 'sidewalk', status: 'open', access: 'public', hasSteps: null, curbRamps: null, verification: 'synthetic', ...props }
    };
}
function area(id, areaKind, points) {
    const ring = points.map(([x, y]) => c(x, y));
    ring.push(ring[0].slice());
    return { type: 'Feature', id, geometry: { type: 'Polygon', coordinates: [ring] }, properties: { featureType: 'area', areaKind, verification: 'synthetic' } };
}
function barrier(id, points) {
    return { type: 'Feature', id, geometry: { type: 'LineString', coordinates: points.map(([x, y]) => c(x, y)) }, properties: { featureType: 'barrier', barrierKind: 'fence', verification: 'synthetic' } };
}
function start(id, atNode) {
    return { type: 'Feature', id, geometry: { type: 'Point', coordinates: atNode.geometry.coordinates }, properties: { featureType: 'start', nodeId: atNode.id, label: `Sign ${id}`, status: 'active', verification: 'synthetic' } };
}
const fc = features => ({ type: 'FeatureCollection', metadata: { synthetic: true }, features });
const codes = result => [...result.errors, ...result.warnings].map(issue => issue.code);
const errorCodes = result => result.errors.map(issue => issue.code);

// Building 0..20 x 0..20 with its door on the far (north) wall; the sign is south.
function farSideDoorScene() {
    const s = node('n-sign', 10, -10);
    const j1 = node('n-j1', 30, -10);
    const j2 = node('n-j2', 30, 30);
    const j3 = node('n-j3', 10, 30);
    const door = node('n-door', 10, 20, { nodeKind: 'entrance', officeId: 'syn-u1' });
    return {
        s, j1, j2, j3, door,
        features: [
            area('a-building', 'building', [[0, 0], [20, 0], [20, 20], [0, 20]]),
            area('a-boundary', 'navigation-boundary', [[-50, -50], [100, -50], [100, 60], [-50, 60]]),
            s, j1, j2, j3, door,
            edge('e-1', s, j1),
            edge('e-2', j1, j2),
            edge('e-3', j2, j3),
            edge('e-door', j3, door, [], { edgeKind: 'entrance-connector' }),
            start('sign-south', s)
        ]
    };
}

test('a valid far-side door layout has no errors and every door is reachable', () => {
    const result = validateNetworkDraft(fc(farSideDoorScene().features), { bbox: BBOX, officeIds: ['syn-u1'] });
    assert.deepEqual(result.errors, []);
    assert.ok(!codes(result).includes('W_ENTRANCE_UNREACHABLE'));
    assert.equal(result.stats.entrances, 1);
    assert.equal(result.stats.components, 1);
    assert.ok(Math.abs(result.stats.totalEdgeLengthM - (20 + 40 + 20 + 10)) < 0.1);
});

test('a walkway straight through the building is rejected', () => {
    const scene = farSideDoorScene();
    const result = validateNetworkDraft(fc([...scene.features, edge('e-shortcut', scene.s, scene.door)]), { bbox: BBOX });
    assert.ok(errorCodes(result).includes('E_EDGE_CROSSES_BUILDING'));
});

test('a door reached from inside the building is rejected', () => {
    const scene = farSideDoorScene();
    const inner = node('n-inner', 10, 10);
    const features = scene.features.filter(f => f.id !== 'e-door').concat([inner, edge('e-inner', inner, scene.door), edge('e-door', scene.j3, scene.door)]);
    const result = validateNetworkDraft(fc(features), { bbox: BBOX });
    assert.ok(errorCodes(result).includes('E_ENTRANCE_INTERIOR_APPROACH'));
});

test('doors deep inside a building or away from any wall are rejected', () => {
    const scene = farSideDoorScene();
    const inside = scene.features.map(f => (f.id === 'n-door' ? node('n-door', 10, 15, { nodeKind: 'entrance', officeId: 'syn-u1' }) : f));
    assert.ok(errorCodes(validateNetworkDraft(fc(inside))).includes('E_ENTRANCE_INSIDE_BUILDING'));

    const away = scene.features.map(f => (f.id === 'n-door' ? node('n-door', 10, 25, { nodeKind: 'entrance', officeId: 'syn-u1' }) : f));
    assert.ok(errorCodes(validateNetworkDraft(fc(away))).includes('E_ENTRANCE_NOT_ON_BUILDING'));
});

test('parking lots only allow crosswalk or parking-crossing walkways through them', () => {
    const a = node('n-a', 40, -20);
    const b = node('n-b', 90, -20);
    const lot = area('a-lot', 'parking', [[50, -40], [80, -40], [80, 0], [50, 0]]);
    const shortcut = validateNetworkDraft(fc([lot, a, b, edge('e-lot', a, b)]));
    assert.ok(errorCodes(shortcut).includes('E_PARKING_TRAVERSAL'));

    const crossing = validateNetworkDraft(fc([lot, a, b, edge('e-lot', a, b, [], { edgeKind: 'parking-crossing' })]));
    assert.ok(!errorCodes(crossing).includes('E_PARKING_TRAVERSAL'));
});

test('barriers block walkways except through a gate node on the barrier', () => {
    const fence = barrier('b-fence', [[50, -30], [50, 30]]);
    const west = node('n-west', 40, 0);
    const east = node('n-east', 60, 0);
    const blocked = validateNetworkDraft(fc([fence, west, east, edge('e-through', west, east)]));
    assert.ok(errorCodes(blocked).includes('E_EDGE_CROSSES_BARRIER'));

    const gate = node('n-gate', 50, 0, { nodeKind: 'gate' });
    const gated = validateNetworkDraft(fc([fence, west, east, gate, edge('e-w', west, gate), edge('e-e', gate, east)]));
    assert.ok(!errorCodes(gated).includes('E_EDGE_CROSSES_BARRIER'));
    assert.ok(!codes(gated).includes('W_GATE_NOT_ON_BARRIER'));
});

test('walkways that visually cross need a junction or an explicit no-connection acknowledgement', () => {
    const a = node('n-a', 0, 0);
    const b = node('n-b', 20, 20);
    const d = node('n-d', 0, 20);
    const e = node('n-e', 20, 0);
    const crossing = validateNetworkDraft(fc([a, b, d, e, edge('e-ab', a, b), edge('e-de', d, e)]));
    assert.ok(errorCodes(crossing).includes('E_UNACKNOWLEDGED_CROSSING'));

    const acknowledged = validateNetworkDraft(fc([a, b, d, e, edge('e-ab', a, b, [], { crossesWithoutConnection: ['e-de'] }), edge('e-de', d, e)]));
    assert.ok(!errorCodes(acknowledged).includes('E_UNACKNOWLEDGED_CROSSING'));

    const tee = node('n-tee', 10, 10);
    const tJunction = validateNetworkDraft(fc([a, b, d, tee, edge('e-ab', a, b), edge('e-dt', d, tee)]));
    assert.ok(errorCodes(tJunction).includes('E_UNACKNOWLEDGED_CROSSING'));
});

test('near misses are reported for review and never joined automatically', () => {
    const a = node('n-a', 0, 0);
    const b = node('n-b', 40, 0);
    const c1 = node('n-c', 20, 20);
    const dead = node('n-dead', 20, 1.5);
    const features = [a, b, c1, dead, edge('e-ab', a, b), edge('e-cd', c1, dead)];
    const result = validateNetworkDraft(fc(features));
    const nearMiss = result.warnings.find(issue => issue.code === 'W_NEAR_MISS');
    assert.ok(nearMiss);
    assert.ok(nearMiss.featureIds.includes('e-ab'));
    assert.equal(result.stats.components, 2);
    assert.equal(features.length, 6);
});

test('broken references, mismatched endpoints, loops, zero-length lines and duplicate ids are errors', () => {
    const a = node('n-a', 0, 0);
    const b = node('n-b', 10, 0);
    const dangling = edge('e-dangling', a, b);
    dangling.properties.to = 'n-missing';
    const mismatch = edge('e-mismatch', a, b);
    mismatch.geometry.coordinates[1] = c(10, 2);
    const loop = edge('e-loop', a, a, [[5, 5]]);
    const close = node('n-close', 0.05, 0);
    const result = validateNetworkDraft(fc([a, b, close, dangling, mismatch, loop, edge('e-short', a, close), node('n-a', 1, 1)]));
    const found = errorCodes(result);
    ['E_DANGLING_REF', 'E_EDGE_ENDPOINT_MISMATCH', 'E_EDGE_SELF_LOOP', 'E_ZERO_LENGTH', 'E_DUP_ID'].forEach(code => assert.ok(found.includes(code), code));
});

test('reversed [lat, lng] coordinates are detected with the property bounding box', () => {
    const swapped = node('n-swapped', 0, 0);
    swapped.geometry.coordinates = [swapped.geometry.coordinates[1], swapped.geometry.coordinates[0]];
    const result = validateNetworkDraft(fc([swapped]), { bbox: BBOX });
    assert.ok(errorCodes(result).includes('E_COORD_SWAPPED'));
    assert.ok(errorCodes(validateNetworkDraft(fc([node('n-far', 5000, 0)]), { bbox: BBOX })).includes('E_COORD_OUTSIDE_BBOX'));
});

test('each office gets exactly one known door', () => {
    const scene = farSideDoorScene();
    const second = node('n-door-2', 20, 10, { nodeKind: 'entrance', officeId: 'syn-u1' });
    const stranger = node('n-door-3', 0, 10, { nodeKind: 'entrance', officeId: 'syn-u404' });
    const result = validateNetworkDraft(fc([...scene.features, second, stranger]), { officeIds: ['syn-u1', 'syn-u2'] });
    assert.ok(errorCodes(result).includes('E_ENTRANCE_DUPLICATE_OFFICE'));
    assert.ok(errorCodes(result).includes('E_ENTRANCE_UNKNOWN_OFFICE'));
    assert.ok(codes(result).includes('W_OFFICES_WITHOUT_DOOR'));
});

test('a door behind a closed or disconnected walkway is reported unreachable', () => {
    const scene = farSideDoorScene();
    const closed = scene.features.map(f => (f.id === 'e-2' ? edge('e-2', scene.j1, scene.j2, [], { status: 'closed' }) : f));
    assert.ok(codes(validateNetworkDraft(fc(closed))).includes('W_ENTRANCE_UNREACHABLE'));

    const disconnected = scene.features.filter(f => f.id !== 'e-2');
    const result = validateNetworkDraft(fc(disconnected));
    assert.ok(codes(result).includes('W_ENTRANCE_UNREACHABLE'));
    assert.ok(codes(result).includes('W_DISCONNECTED_COMPONENT'));
});

test('unknown access is never treated as public', () => {
    const scene = farSideDoorScene();
    const unknown = scene.features.map(f => (f.id === 'e-2' ? edge('e-2', scene.j1, scene.j2, [], { access: 'unknown' }) : f));
    const result = validateNetworkDraft(fc(unknown));
    assert.ok(codes(result).includes('W_UNKNOWN_ACCESS'));
    assert.ok(codes(result).includes('W_ENTRANCE_UNREACHABLE'));
});

test('walkways may not enter no-walk areas or leave the navigation boundary', () => {
    const scene = farSideDoorScene();
    const zone = area('a-dock', 'no-walk', [[25, 0], [35, 0], [35, 10], [25, 10]]);
    assert.ok(errorCodes(validateNetworkDraft(fc([...scene.features, zone]))).includes('E_EDGE_IN_NO_WALK'));

    const far = node('n-far', 200, -10);
    assert.ok(errorCodes(validateNetworkDraft(fc([...scene.features, far, edge('e-far', scene.j1, far)]))).includes('E_EDGE_OUTSIDE_BOUNDARY'));
});

test('malformed outlines, enum values, sign IDs and files are reported', () => {
    const bowtie = area('a-bowtie', 'building', [[0, 0], [10, 10], [10, 0], [0, 10]]);
    const badKind = node('n-bad', 0, 0, { nodeKind: 'teleporter' });
    const badStart = start('Sign West!', node('n-x', 1, 1));
    const result = validateNetworkDraft(fc([bowtie, badKind, badStart]));
    const found = errorCodes(result);
    ['E_RING_SELF_INTERSECTION', 'E_SCHEMA_VALUE', 'E_START_ID_INVALID'].forEach(code => assert.ok(found.includes(code), code));

    assert.deepEqual(errorCodes(validateNetworkDraft({ features: [] })), ['E_SCHEMA']);
    assert.ok(errorCodes(validateNetworkDraft(fc([]), { disallowSynthetic: true })).includes('E_SYNTHETIC_DATA'));
});
