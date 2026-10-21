const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const NavigationApp = vm.runInNewContext(`${source}\nNavigationApp;`, { document: { addEventListener() {} }, window: {} });
const app = Object.create(NavigationApp.prototype);

test('sign names gain a "sign" suffix only when they do not already end in one', () => {
    assert.equal(app.formatSignName('Main parking lot'), 'Main parking lot sign');
    assert.equal(app.formatSignName('  West lot  '), 'West lot sign');
    assert.equal(app.formatSignName('New sign'), 'New sign');
    assert.equal(app.formatSignName('New sign 2'), 'New sign 2');
    assert.equal(app.formatSignName('Lobby SIGN'), 'Lobby SIGN');
    assert.equal(app.formatSignName('Design studio'), 'Design studio sign');
    assert.equal(app.formatSignName(''), 'Sign');
});

test('route distances are shown in feet, then miles', () => {
    assert.equal(app.formatDistanceImperial(93), '310 ft');
    assert.equal(app.formatDistanceImperial(5), '15 ft');
    assert.equal(app.formatDistanceImperial(0.5), '5 ft');
    assert.equal(app.formatDistanceImperial(302), '990 ft');
    assert.equal(app.formatDistanceImperial(304), '0.2 mi');
    assert.equal(app.formatDistanceImperial(1609.344 * 2.25), '2.3 mi');
    assert.equal(app.formatDistanceImperial(1609.344 * 12), '12 mi');
    assert.equal(app.formatDistanceImperial(NaN), '--');
    assert.equal(app.formatDistanceImperial(-1), '--');
});
