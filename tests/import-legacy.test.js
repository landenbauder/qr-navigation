const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../js/nav-geo.js');
const importer = require('../tools/import-legacy.js');

// Synthetic property near [20, 10]; names and coordinates are fictional.
const proj = geo.createLocalProjection([20, 10]);
const ll = (x, y) => {
    const [lng, lat] = proj.toLngLat({ x, y });
    return { lat, lng };
};
const line = (name, point) => `${name} ${point.lat}, ${point.lng}`;
const pair = point => `(${point.lat}, ${point.lng})`;

function syntheticSources() {
    const alphaDoor = ll(0, 0);
    const alphaSecond = ll(0, 30);
    const betaSourceDoor = ll(60, 0);
    const gammaDoor = ll(100, 0);
    const betaOverrideDoor = ll(101, 0);

    const alphaFootprint = [ll(-10, 0), ll(10, 0), ll(10, 30), ll(-10, 30), ll(-10, 0.00001)];

    return {
        snapshotName: 'legacy-snapshot-2000-01-01',
        officesJson: {
            offices: [
                { name: 'Synthetic Alpha', unit: '1', ...ll(0, 10), walkingPath: [ll(0, -20), alphaDoor] },
                { name: 'Synthetic Beta, LLC', unit: '2', ...ll(60, 10), walkingPath: [ll(60, -20), betaSourceDoor] },
                { name: 'Synthetic Gamma', unit: '3', ...ll(100, 10), walkingPath: [ll(100, -20), gammaDoor] }
            ]
        },
        boundariesJson: {
            offices: [
                {
                    key: 'Synthetic Alpha__1',
                    officeLat: ll(0, 15).lat,
                    officeLng: ll(0, 15).lng,
                    entrance: alphaDoor,
                    polygon: alphaFootprint
                },
                {
                    key: 'Synthetic Beta, LLC__2',
                    entranceLat: betaSourceDoor.lat,
                    entranceLng: betaSourceDoor.lng
                }
            ]
        },
        entrancesText: [
            line('Synthetic Alpha', alphaDoor),
            line('Synthetic Beta, LLC', betaSourceDoor),
            line('Synthetic Alpha', alphaSecond),
            line('Synthetic Gamma', gammaDoor)
        ].join('\n'),
        sidewalkText: `${pair(ll(0, -5))}, ${pair(ll(60, -5))}`,
        panoramaText: `${pair(ll(0, -20))}\n${pair(ll(100, -20))}`,
        firestoreSnapshot: {
            documents: [
                {
                    documentId: importer.getAdminDocumentId('Synthetic Beta, LLC__2'),
                    name: 'Beta Renamed',
                    entranceLat: betaOverrideDoor.lat,
                    entranceLng: betaOverrideDoor.lng
                }
            ]
        }
    };
}

const byId = records => Object.fromEntries(records.map(record => [record.officeId, record]));

test('admin document IDs match the browser algorithm, including non-ASCII names', () => {
    const key = 'Café & Søn, LLC__7';
    const bytes = new TextEncoder().encode(key);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    const browserId = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    assert.equal(importer.getAdminDocumentId(key), browserId);
});

test('door precedence mirrors the running app: Firestore > boundary file > source', () => {
    const { records } = importer.buildLegacyReference(syntheticSources());
    const offices = byId(records);

    assert.equal(offices.u1.doorSource, 'office-boundaries');
    assert.equal(offices.u2.doorSource, 'firestore-override');
    assert.equal(offices.u2.tenantName, 'Beta Renamed');
    assert.ok(offices.u2.flags.includes('firestore-override-applied'));
    assert.equal(offices.u3.doorSource, 'source-entrances');
    assert.ok(offices.u3.flags.includes('no-footprint'));
});

test('only one door is kept per office; extra source doors are exported as dropped references', () => {
    const { records, geojson } = importer.buildLegacyReference(syntheticSources());
    const offices = byId(records);
    assert.ok(offices.u1.flags.includes('second-door-dropped'));
    assert.equal(geojson.features.filter(feature => feature.properties.featureType === 'reference-door').length, 3);
    const dropped = geojson.features.filter(feature => feature.properties.featureType === 'reference-dropped-door');
    assert.equal(dropped.length, 1);
    assert.equal(dropped[0].id, 'dropped-door-u1-2');
});

test('doors closer than 3 m to another office door are flagged for review', () => {
    const { records } = importer.buildLegacyReference(syntheticSources());
    const offices = byId(records);
    assert.ok(offices.u2.flags.includes('near-other-door'));
    assert.ok(offices.u3.flags.includes('near-other-door'));
    assert.ok(!offices.u1.flags.includes('near-other-door'));
    assert.ok(offices.u2.flags.includes('sources-disagree'));
});

test('a door on the footprint edge is not flagged; a door deep inside is', () => {
    const clean = byId(importer.buildLegacyReference(syntheticSources()).records);
    assert.ok(!clean.u1.flags.includes('door-inside-footprint'));
    assert.ok(clean.u1.doorToFootprintEdgeM < 0.01);

    const sources = syntheticSources();
    sources.boundariesJson.offices[0].entrance = ll(0, 15);
    const moved = byId(importer.buildLegacyReference(sources).records);
    assert.ok(moved.u1.flags.includes('door-inside-footprint'));
});

test('output is GeoJSON [lng, lat], contains no walking edges, and closes footprint rings', () => {
    const { geojson } = importer.buildLegacyReference(syntheticSources());
    assert.equal(geojson.type, 'FeatureCollection');
    assert.ok(geojson.features.every(feature => feature.geometry.type !== 'LineString'));
    const door = geojson.features.find(feature => feature.id === 'door-u1');
    assert.deepEqual(door.geometry.coordinates, [ll(0, 0).lng, ll(0, 0).lat]);
    const footprint = geojson.features.find(feature => feature.id === 'footprint-u1');
    const ring = footprint.geometry.coordinates[0];
    assert.deepEqual(ring[0], ring[ring.length - 1]);
    assert.deepEqual(geo.validateRing(ring), []);
    assert.equal(footprint.properties.blocksWalking, null);
    assert.ok(geojson.features.every(feature => feature.properties.verification === 'unverified'));
    assert.deepEqual(
        geojson.features.filter(feature => feature.properties.featureType === 'reference-sidewalk-point').map(feature => feature.id),
        ['sidewalk-S1', 'sidewalk-S2']
    );
});

test('import is deterministic for identical inputs', () => {
    const first = importer.buildLegacyReference(syntheticSources());
    const second = importer.buildLegacyReference(syntheticSources());
    assert.equal(JSON.stringify(first.geojson), JSON.stringify(second.geojson));
    assert.equal(importer.buildDoorReviewCsv(first.records), importer.buildDoorReviewCsv(second.records));
});

test('door review CSV escapes commas and leaves owner columns blank', () => {
    const { records } = importer.buildLegacyReference(syntheticSources());
    const lines = importer.buildDoorReviewCsv(records).trim().split('\n');
    assert.equal(lines.length, 4);
    assert.ok(lines[0].startsWith('office_id,unit,tenant_name'));
    assert.ok(lines[0].endsWith('owner_decision,owner_notes'));
    assert.ok(lines.some(row => row.includes('"Synthetic Beta, LLC__2"')));
    assert.ok(lines.slice(1).every(row => row.endsWith(',,')));
});

test('missing or duplicate units fail loudly instead of producing unstable IDs', () => {
    const duplicate = syntheticSources();
    duplicate.officesJson.offices[2].unit = '1';
    assert.throws(() => importer.buildLegacyReference(duplicate), /Duplicate office ID u1/);

    const missing = syntheticSources();
    delete missing.officesJson.offices[0].unit;
    assert.throws(() => importer.buildLegacyReference(missing), /without unit/);
});

test('malformed entrance lines are rejected with the line number', () => {
    const sources = syntheticSources();
    sources.entrancesText += '\nNot a coordinate line';
    assert.throws(() => importer.buildLegacyReference(sources), /line 5/);
});
