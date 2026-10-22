const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('office loading bypasses cached data and makes new offices available to the tracer', async () => {
    const requests = [];
    const NavigationApp = vm.runInNewContext(`${source}\nNavigationApp;`, {
        document: { addEventListener() {} },
        window: {},
        console,
        fetch: async (file, options) => {
            requests.push({ file, cache: options.cache });
            return {
                ok: true,
                json: async () => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
            };
        }
    });
    const app = Object.create(NavigationApp.prototype);
    app.officeTraceData = {};
    app.assignAdminDocumentIds = () => {};
    app.loadTenantOverrides = async () => {};
    app.buildNavigationNodeIndex = () => {};
    app.showStatus = message => assert.fail(message);

    await app.loadOffices();

    assert.deepEqual(requests, [
        { file: 'offices.json', cache: 'no-store' },
        { file: 'office-boundaries.json', cache: 'no-store' }
    ]);
    assert.equal(app.offices.length, 32);
    for (const [unit, name] of [['616', 'Birth Pray Love'], ['7628', 'Real Property Advisors, LLC.']]) {
        const index = app.offices.findIndex(office => office.unit === unit);
        assert.ok(index >= 0, `Unit ${unit} loaded`);
        assert.equal(app.offices[index].name, name);
        const boundary = JSON.parse(fs.readFileSync(path.join(root, 'office-boundaries.json'), 'utf8'))
            .offices.find(office => office.unit === unit);
        assert.equal(app.offices[index].lat, boundary.officeLat);
        assert.equal(app.offices[index].lng, boundary.officeLng);
        assert.equal(JSON.stringify(app.getOfficeEntrancePoint(app.offices[index])), JSON.stringify(boundary.entrance));
        assert.equal(JSON.stringify(app.offices[index].polygon), JSON.stringify(boundary.polygon));
        assert.equal(app.hasCompletedTraceRecord(app.offices[index]), true);
    }
    assert.equal(app.getTraceProgressCount(), 32);
    assert.equal(app.findNextTraceOfficeIndex(0), -1);
});
