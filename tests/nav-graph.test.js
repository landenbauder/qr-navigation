const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../js/nav-geo.js');
const graphLib = require('../js/nav-graph.js');

// Synthetic layout in local meters around [20, 10]; building occupies 0..20 x 0..20, door on the north wall.
const proj = geo.createLocalProjection([20, 10]);
const c = (x, y) => proj.toLngLat({ x, y });
const ring = pts => { const r = pts.map(([x, y]) => c(x, y)); r.push(r[0].slice()); return r; };
const BUILDING = ring([[0, 0], [20, 0], [20, 20], [0, 20]]);

function node(id, x, y, props = {}) {
    return { type: 'Feature', id, geometry: { type: 'Point', coordinates: c(x, y) }, properties: { featureType: 'node', nodeKind: 'junction', verification: 'synthetic', ...props } };
}
function edge(id, a, b, bends = [], props = {}) {
    return {
        type: 'Feature', id,
        geometry: { type: 'LineString', coordinates: [a.geometry.coordinates, ...bends.map(([x, y]) => c(x, y)), b.geometry.coordinates] },
        properties: { featureType: 'edge', from: a.id, to: b.id, edgeKind: 'sidewalk', status: 'open', access: 'public', verification: 'synthetic', ...props }
    };
}
const fc = features => ({ type: 'FeatureCollection', features });
const build = (features, options = {}) => graphLib.buildGraph(fc(features), { allowSynthetic: true, ...options });

// Sign (10,-10) -> east loop around the building -> door (10,20). Alternative loop on the west side.
function scene(overrides = {}) {
    const s = node('n-s', 10, -10);
    const se = node('n-se', 30, -10);
    const ne = node('n-ne', 30, 30);
    const nm = node('n-nm', 10, 30);
    const sw = node('n-sw', -10, -10);
    const nw = node('n-nw', -10, 30);
    const door = node('n-door', 10, 20, { nodeKind: 'entrance', officeId: 'syn-u1' });
    const edges = {
        east1: edge('e-east1', s, se),
        east2: edge('e-east2', se, ne),
        east3: edge('e-east3', ne, nm),
        west1: edge('e-west1', s, sw, [], overrides.west),
        west2: edge('e-west2', sw, nw, [], overrides.west),
        west3: edge('e-west3', nw, nm, [], overrides.west),
        door: edge('e-door', nm, door, [], { edgeKind: 'entrance-connector' })
    };
    return { features: [s, se, ne, nm, sw, nw, door, ...Object.values(edges)], s, door };
}

test('route to a far-side door follows the mapped turns and measures every bend', () => {
    const { features, s } = scene();
    const graph = build(features);
    const route = graphLib.findRoute(graph, s.geometry.coordinates, graph.doors.get('syn-u1'), { obstacles: [BUILDING] });
    assert.equal(route.ok, true);
    // Route lengths are equal either way round the building (90 m); the tie-break is tested separately.
    assert.ok(Math.abs(route.lengthM - 90) < 0.2);
    assert.ok(route.lengthM > geo.haversineMeters(s.geometry.coordinates, graph.nodes.get('n-door').coord) + 50);
    for (let i = 1; i < route.coords.length; i += 1) {
        assert.notEqual(geo.segmentIntersectionType(route.coords[i - 1], route.coords[i], c(0, 0), c(20, 0), proj, 1e-6) === 'cross', true);
    }
    const inside = route.coords.some(p => geo.pointInRing(p, BUILDING, proj) && geo.distanceToRingBoundaryMeters(p, BUILDING, proj) > 1.6);
    assert.equal(inside, false);
    assert.ok(Math.abs(route.estimatedSeconds - route.lengthM / 1.2) < 1e-9);
});

test('ties between equal routes resolve identically on every run', () => {
    const { features, s } = scene();
    const first = graphLib.findRoute(build(features), s.geometry.coordinates, 'n-door');
    const second = graphLib.findRoute(build(features), s.geometry.coordinates, 'n-door');
    assert.deepEqual(first.edgeIds, second.edgeIds);
});

test('bends are part of the length and the drawn route; reversed edges are drawn in travel order', () => {
    const a = node('n-a', 0, 0);
    const b = node('n-b', 100, 0);
    const bendy = edge('e-ab', a, b, [[0, 50], [100, 50]]);
    const graph = build([a, b, bendy]);
    const route = graphLib.findRoute(graph, b.geometry.coordinates, 'n-a');
    assert.ok(Math.abs(route.lengthM - 200) < 0.3);
    assert.equal(route.coords.length, 4);
    assert.deepEqual(route.coords[0], b.geometry.coordinates);
    assert.deepEqual(route.coords[route.coords.length - 1], a.geometry.coordinates);
});

test('closed edges select the alternative; closing both returns no route', () => {
    const closedEast = scene();
    closedEast.features.find(f => f.id === 'e-east2').properties.status = 'closed';
    const graph = build(closedEast.features);
    const route = graphLib.findRoute(graph, closedEast.s.geometry.coordinates, 'n-door');
    assert.equal(route.ok, true);
    assert.ok(route.edgeIds.includes('e-west2'));
    assert.ok(!route.edgeIds.includes('e-east2'));

    closedEast.features.find(f => f.id === 'e-west2').properties.status = 'temporarily-closed';
    const none = graphLib.findRoute(build(closedEast.features), closedEast.s.geometry.coordinates, 'n-door');
    assert.equal(none.ok, false);
    assert.equal(none.reason, 'no-open-path');
    assert.ok(none.message.length > 0);
    assert.equal(none.coords, undefined);
});

test('unknown, restricted, and unverified edges never become visitor paths', () => {
    for (const patch of [{ access: 'unknown' }, { access: 'restricted' }, { verification: 'unverified' }]) {
        const s = scene();
        s.features.filter(f => f.properties.featureType === 'edge' && f.id !== 'e-door').forEach((f) => { Object.assign(f.properties, patch); });
        const graph = build(s.features, { minVerification: 'imagery-reviewed' });
        const route = graphLib.findRoute(graph, s.s.geometry.coordinates, 'n-door');
        assert.equal(route.ok, false, JSON.stringify(patch));
    }
    const s = scene();
    s.features.forEach((f) => { if (f.properties.featureType === 'edge') f.properties.verification = 'imagery-reviewed'; });
    assert.equal(graphLib.findRoute(build(s.features, { minVerification: 'imagery-reviewed' }), s.s.geometry.coordinates, 'n-door').ok, true);
    assert.equal(graphLib.findRoute(build(s.features, { minVerification: 'field-verified' }), s.s.geometry.coordinates, 'n-door').ok, false);
});

test('synthetic data is refused unless explicitly allowed', () => {
    const { features, s } = scene();
    const graph = graphLib.buildGraph(fc(features));
    assert.equal(graph.edges.size, 0);
    assert.equal(graphLib.findRoute(graph, s.geometry.coordinates, 'n-door').reason, 'data-unavailable');
});

test('disconnected or missing destinations return explicit reasons, never a straight line', () => {
    const { features, s } = scene();
    const island = node('n-island-door', 50, 50, { nodeKind: 'entrance', officeId: 'syn-u2' });
    const graph = build([...features, island]);
    const lonely = graphLib.findRoute(graph, s.geometry.coordinates, 'n-island-door');
    assert.equal(lonely.reason, 'destination-disconnected');
    assert.equal(graphLib.findRoute(graph, s.geometry.coordinates, 'n-nope').reason, 'destination-unavailable');

    const a = node('n-a', 0, 0); const b = node('n-b', 10, 0); const x = node('n-x', 0, 50); const y = node('n-y', 10, 50);
    const split = build([a, b, x, y, edge('e-ab', a, b), edge('e-xy', x, y)]);
    assert.equal(graphLib.findRoute(split, a.geometry.coordinates, 'n-y').reason, 'no-open-path');
});

test('a start in the middle of a walkway can leave in either direction', () => {
    const a = node('n-a', 0, 0); const b = node('n-b', 100, 0); const d = node('n-d', 100, 40);
    const graph = build([a, b, d, edge('e-ab', a, b), edge('e-bd', b, d)]);
    const mid = c(30, 0);
    const toA = graphLib.findRoute(graph, mid, 'n-a');
    const toD = graphLib.findRoute(graph, mid, 'n-d');
    assert.ok(Math.abs(toA.lengthM - 30) < 0.2);
    assert.ok(Math.abs(toD.lengthM - 110) < 0.2);
});

test('a GPS point near a wall does not snap across the wall to a closer path', () => {
    // Wall-side path at y=-10 is 12 m from the point; the inside walkway at y=22 is only 2 m away but across the building.
    const a = node('n-a', -20, -10); const b = node('n-b', 40, -10);
    const inner = node('n-i1', -20, 22); const inner2 = node('n-i2', 40, 22);
    const features = [a, b, inner, inner2, edge('e-near-wall', a, b), edge('e-far-side', inner, inner2)];
    const graph = build(features);
    const point = c(10, 2); // Inside the building footprint.
    const outsidePoint = c(10, -2);
    const ok = graphLib.attachPoint(graph, outsidePoint, { obstacles: [BUILDING], maxAttachM: 40 });
    assert.equal(ok.ok, true);
    assert.equal(ok.edgeId, 'e-near-wall');

    // Point just north of the building top wall (y=21): far-side walkway at y=22 is closest and reachable; building walkway is blocked.
    const north = graphLib.attachPoint(graph, c(10, 21.5), { obstacles: [BUILDING], maxAttachM: 40 });
    assert.equal(north.edgeId, 'e-far-side');

    // A point inside the building is never attached.
    assert.equal(graphLib.attachPoint(graph, point, { obstacles: [BUILDING], maxAttachM: 40 }).reason, 'start-blocked');

    // Only reachable path would cross the wall: refuse instead of fabricating a connector.
    const onlyAcross = build([a, b, edge('e-near-wall', a, b)]);
    const refused = graphLib.attachPoint(onlyAcross, c(10, 21), { obstacles: [BUILDING], maxAttachM: 40 });
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, 'start-blocked');
});

test('points far from any walkway are not attached', () => {
    const { features } = scene();
    const graph = build(features);
    assert.equal(graphLib.attachPoint(graph, c(500, 500)).reason, 'start-not-on-network');
    assert.equal(graphLib.attachPoint(graph, [NaN, 1]).reason, 'start-invalid');
    assert.equal(graphLib.attachPoint(graphLib.buildGraph(fc([])), c(0, 0)).reason, 'data-unavailable');
});

test('two offices sharing nothing keep separate doors in the door index', () => {
    const { features } = scene();
    const second = node('n-door2', 0, 10, { nodeKind: 'entrance', officeId: 'syn-u2' });
    const graph = build([...features, second]);
    assert.equal(graph.doors.get('syn-u1'), 'n-door');
    assert.equal(graph.doors.get('syn-u2'), 'n-door2');
});
