const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const ring = offset => [
    { lat: 41.75 + offset, lng: -87.938 },
    { lat: 41.7501 + offset, lng: -87.938 },
    { lat: 41.75 + offset, lng: -87.9379 }
];

function fixture() {
    const layers = [];
    const makeLayer = type => (coords, options) => ({
        addTo() {
            layers.push({ type, coords, options });
        }
    });
    const NavigationApp = vm.runInNewContext(`${source}\nNavigationApp;`, {
        document: { addEventListener() {} },
        window: {},
        L: { polygon: makeLayer('polygon'), circleMarker: makeLayer('dot') }
    });
    const app = Object.create(NavigationApp.prototype);
    Object.assign(app, {
        traceModeActive: true,
        currentTraceOfficeIndex: 0,
        officeTraceData: {},
        traceReferenceLayerGroup: { clearLayers: () => { layers.length = 0; } },
        offices: [
            { name: 'Current', unit: '1', lat: 41.75, lng: -87.938, polygon: ring(0) },
            { name: 'Neighbor', unit: '2', lat: 41.751, lng: -87.938, polygon: ring(0.001) },
            { name: 'Untraced', unit: '3', lat: 41.752, lng: -87.938 }
        ]
    });
    return { app, layers };
}

test('tracing shows other saved outlines without fill or tap interception', () => {
    const { app, layers } = fixture();
    app.showTraceReferenceDots();
    const polygons = layers.filter(layer => layer.type === 'polygon');
    assert.equal(polygons.length, 1);
    assert.equal(JSON.stringify(polygons[0].coords), JSON.stringify(ring(0.001).map(p => [p.lat, p.lng])));
    assert.equal(polygons[0].options.fill, false);
    assert.equal(polygons[0].options.interactive, false);
    assert.equal(layers.filter(layer => layer.type === 'dot').length, 2);
});

test('reference outlines use browser-local saved edits before loaded polygons', () => {
    const { app, layers } = fixture();
    app.officeTraceData[app.getOfficeKey(app.offices[1])] = { polygon: ring(0.002) };
    app.showTraceReferenceDots();
    assert.equal(JSON.stringify(layers[0].coords), JSON.stringify(ring(0.002).map(p => [p.lat, p.lng])));
    app.hideTraceReferenceDots();
    assert.equal(layers.length, 0);
});

test('reference outlines are not drawn outside tracing or without a current office', () => {
    const { app, layers } = fixture();
    app.traceModeActive = false;
    app.showTraceReferenceDots();
    assert.equal(layers.filter(layer => layer.type === 'polygon').length, 0);
    app.currentTraceOfficeIndex = -1;
    app.showTraceReferenceDots();
    assert.equal(layers.length, 0);
});
