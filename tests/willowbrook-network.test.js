const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const geo = require('../js/nav-geo.js');
const graphLib = require('../js/nav-graph.js');

// Software checks on the real pilot data. These do not prove a path is physically walkable.
const NETWORK = path.join(__dirname, '..', 'data', 'properties', 'willowbrook', 'network.geojson');
const REFERENCE = path.join(__dirname, '..', 'data', 'properties', 'willowbrook', 'draft', 'reference-points.geojson');
const present = fs.existsSync(NETWORK) && fs.existsSync(REFERENCE);

test('every active sign reaches every office door, and no route cuts across an office outline', { skip: !present }, () => {
    const collection = JSON.parse(fs.readFileSync(NETWORK, 'utf8'));
    const reference = JSON.parse(fs.readFileSync(REFERENCE, 'utf8'));
    const graph = graphLib.buildGraph(collection, { minVerification: 'imagery-reviewed' });
    const footprints = reference.features
        .filter(f => f.properties.featureType === 'reference-unit-footprint')
        .map(f => f.geometry.coordinates[0]);
    const projection = graph.projection;

    assert.ok(graph.starts.length >= 3);
    assert.equal(graph.doors.size, 30);

    graph.starts.forEach((start) => {
        graph.doors.forEach((doorNodeId, officeId) => {
            const route = graphLib.findRoute(graph, start.lngLat, doorNodeId, { obstacles: footprints });
            assert.equal(route.ok, true, `${start.id} -> ${officeId}: ${route.reason}`);
            assert.ok(route.lengthM > 0 && route.lengthM < 600, `${start.id} -> ${officeId}: ${Math.round(route.lengthM)} m`);
            for (let i = 1; i < route.coords.length; i += 1) {
                footprints.forEach((ring) => {
                    for (let j = 1; j < ring.length; j += 1) {
                        const hit = geo.segmentIntersectionType(route.coords[i - 1], route.coords[i], ring[j - 1], ring[j], projection);
                        assert.notEqual(hit, 'cross', `${start.id} -> ${officeId} crosses an office outline`);
                    }
                });
            }
        });
    });
});
