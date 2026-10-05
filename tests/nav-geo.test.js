const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../js/nav-geo.js');

// Synthetic origin far from any real property.
const ORIGIN = [20, 10];
const proj = geo.createLocalProjection(ORIGIN);
const at = (x, y) => proj.toLngLat({ x, y });

test('haversine matches the spherical arc length for 0.001 degrees of latitude', () => {
    const expected = geo.EARTH_RADIUS_M * Math.PI / 180 * 0.001;
    assert.ok(Math.abs(geo.haversineMeters([20, 10], [20, 10.001]) - expected) < 0.001);
});

test('haversine rejects swapped or invalid input instead of returning a number', () => {
    assert.throws(() => geo.haversineMeters([20, 95], [20, 10]), TypeError);
    assert.throws(() => geo.haversineMeters([NaN, 10], [20, 10]), TypeError);
    assert.throws(() => geo.haversineMeters({ lat: 10, lng: 20 }, [20, 10]), TypeError);
});

test('local projection distances agree with haversine within 0.1% over 500 m', () => {
    const projection = geo.createLocalProjection([-87.9378, 41.7502]);
    const a = [-87.9378, 41.7502];
    const b = projection.toLngLat({ x: 300, y: 400 });
    const projected = projection.toXY(b);
    const planar = Math.hypot(projected.x, projected.y);
    const spherical = geo.haversineMeters(a, b);
    assert.ok(Math.abs(planar - 500) < 1e-6);
    assert.ok(Math.abs(spherical - planar) / spherical < 0.001);
});

test('polyline length includes every bend, not just endpoint distance', () => {
    const lShape = [at(0, 0), at(100, 0), at(100, 50)];
    const length = geo.polylineLengthMeters(lShape);
    const direct = geo.haversineMeters(lShape[0], lShape[2]);
    assert.ok(Math.abs(length - 150) < 0.2);
    assert.ok(length > direct + 30);
    assert.throws(() => geo.polylineLengthMeters([at(0, 0)]), TypeError);
});

test('point-to-segment distance is metric and clamps to segment ends', () => {
    assert.ok(Math.abs(geo.pointToSegmentDistanceMeters(at(50, 10), at(0, 0), at(100, 0)) - 10) < 0.01);
    assert.ok(Math.abs(geo.pointToSegmentDistanceMeters(at(-30, 40), at(0, 0), at(100, 0)) - 50) < 0.01);
    assert.ok(Math.abs(geo.pointToPolylineDistanceMeters(at(95, 25), [at(0, 0), at(100, 0), at(100, 50)]) - 5) < 0.01);
});

test('segment intersection distinguishes crossing, touching, and separate segments', () => {
    assert.equal(geo.segmentIntersectionType(at(0, 0), at(10, 10), at(0, 10), at(10, 0)), 'cross');
    assert.equal(geo.segmentIntersectionType(at(0, 0), at(10, 0), at(10, 0), at(10, 10)), 'touch');
    assert.equal(geo.segmentIntersectionType(at(0, 0), at(10, 0), at(5, 0), at(5, 10)), 'touch');
    assert.equal(geo.segmentIntersectionType(at(0, 0), at(10, 0), at(2, 0), at(8, 0)), 'touch');
    assert.equal(geo.segmentIntersectionType(at(0, 0), at(10, 0), at(0, 1), at(10, 1)), 'none');
    assert.equal(geo.segmentIntersectionType(at(0, 0), at(10, 0), at(11, -5), at(11, 5)), 'none');
});

test('point in polygon handles concave shapes and holes', () => {
    // U-shaped building: the notch between the arms is outside.
    const uShape = [at(0, 0), at(30, 0), at(30, 30), at(20, 30), at(20, 10), at(10, 10), at(10, 30), at(0, 30), at(0, 0)];
    assert.equal(geo.pointInPolygon(at(5, 20), [uShape]), true);
    assert.equal(geo.pointInPolygon(at(15, 20), [uShape]), false);
    assert.equal(geo.pointInPolygon(at(15, 5), [uShape]), true);
    assert.equal(geo.pointInPolygon(at(-1, 5), [uShape]), false);

    const outer = [at(0, 0), at(40, 0), at(40, 40), at(0, 40), at(0, 0)];
    const hole = [at(10, 10), at(20, 10), at(20, 20), at(10, 20), at(10, 10)];
    assert.equal(geo.pointInPolygon(at(15, 15), [outer, hole]), false);
    assert.equal(geo.pointInPolygon(at(30, 30), [outer, hole]), true);
});

test('distance to ring boundary is zero-ish on an edge and positive inside', () => {
    const square = [at(0, 0), at(20, 0), at(20, 20), at(0, 20), at(0, 0)];
    assert.ok(geo.distanceToRingBoundaryMeters(at(10, 0), square) < 0.01);
    assert.ok(Math.abs(geo.distanceToRingBoundaryMeters(at(10, 5), square) - 5) < 0.01);
});

test('ring validation reports open, degenerate, self-intersecting, and invalid rings', () => {
    const square = [at(0, 0), at(10, 0), at(10, 10), at(0, 10), at(0, 0)];
    assert.deepEqual(geo.validateRing(square), []);
    assert.ok(geo.validateRing(square.slice(0, -1)).includes('E_RING_NOT_CLOSED'));
    assert.ok(geo.validateRing([at(0, 0), at(10, 0), at(0, 0)]).includes('E_RING_TOO_FEW_VERTICES'));
    const bowtie = [at(0, 0), at(10, 10), at(10, 0), at(0, 10), at(0, 0)];
    assert.ok(geo.validateRing(bowtie).includes('E_RING_SELF_INTERSECTION'));
    assert.deepEqual(geo.validateRing([[20, 10], [NaN, 10], [20, 10.1], [20, 10]]), ['E_RING_INVALID_COORDINATE']);
    assert.deepEqual(geo.validateRing('not a ring'), ['E_RING_NOT_ARRAY']);
});

test('coordinate order classification detects swapped [lat, lng] input using the property bbox', () => {
    const bbox = [19.99, 9.99, 20.01, 10.01];
    assert.equal(geo.classifyCoordinateOrder([20, 10], bbox), 'lnglat');
    assert.equal(geo.classifyCoordinateOrder([10, 20], bbox), 'swapped');
    assert.equal(geo.classifyCoordinateOrder([0, 0], bbox), 'outside');
    assert.equal(geo.classifyCoordinateOrder(['20', 10], bbox), 'invalid');
    assert.equal(geo.classifyCoordinateOrder([20], bbox), 'invalid');
});

test('Leaflet-style {lat, lng} objects convert to and from GeoJSON order', () => {
    assert.deepEqual(geo.latLngObjectToLngLat({ lat: 10, lng: 20 }), [20, 10]);
    assert.deepEqual(geo.lngLatToLatLngObject([20, 10]), { lat: 10, lng: 20 });
    assert.equal(geo.latLngObjectToLngLat({ lat: '10', lng: 20 }), null);
    assert.equal(geo.lngLatToLatLngObject([200, 10]), null);
});

test('bearing points north and east correctly', () => {
    assert.ok(Math.abs(geo.bearingDegrees(at(0, 0), at(0, 100)) - 0) < 0.01);
    assert.ok(Math.abs(geo.bearingDegrees(at(0, 0), at(100, 0)) - 90) < 0.01);
});
