const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function createFixture() {
    const elements = new Map();
    const listeners = new Map();
    const document = {
        activeElement: null,
        getElementById: id => elements.get(id) || null,
        querySelector: () => null,
        addEventListener: (type, listener) => listeners.set(type, listener)
    };
    const makeElement = (id) => {
        const classes = new Set();
        const element = {
            value: '',
            textContent: '',
            scrollTop: 0,
            style: { display: 'none' },
            classList: {
                add: name => classes.add(name),
                remove: name => classes.delete(name),
                contains: name => classes.has(name),
                toggle: (name, active) => active ? classes.add(name) : classes.delete(name)
            },
            setAttribute() {},
            addEventListener(type, listener) {
                this[type] = listener;
            },
            focus() {
                document.activeElement = this;
            },
            blur() {
                document.activeElement = null;
            },
            select() {}
        };
        elements.set(id, element);
        return element;
    };
    document.body = makeElement('body');
    const win = {
        confirm: () => true,
        location: { origin: 'http://localhost', pathname: '/' }
    };
    const context = {
        document,
        window: win,
        setTimeout,
        clearTimeout,
        AbortController,
        console: { error() {}, warn() {}, log() {} },
        fetch: (...args) => context.fetchImpl(...args)
    };
    const NavigationApp = vm.runInNewContext(`${source}\nNavigationApp;`, context);
    const app = Object.create(NavigationApp.prototype);
    [
        'adminPanel', 'adminStatus', 'adminSignInfo', 'adminMapAction', 'adminMapActionText',
        'adminMapCancelBtn', 'adminPickEntranceBtn', 'adminSignAddBtn', 'adminSignMoveBtn',
        'adminTenantNameInput', 'adminOfficeSelect', 'adminSignNameInput', 'adminSignSelect',
        'adminSignActions', 'adminSignDraftActions', 'adminSignSaveBtn', 'adminSignRepickBtn', 'adminSignDiscardBtn'
    ].forEach(id => {
        app[id] = makeElement(id);
    });
    const writes = [];
    const sign = { id: 'main', label: 'Main lot', lat: 41.75, lng: -87.938, status: 'active' };
    Object.assign(app, {
        adminModeActive: true,
        adminEntrancePickActive: false,
        adminSignPickMode: null,
        adminMapPickState: null,
        adminSelectedOffice: { adminDocumentId: 'unit-1' },
        adminPendingEntrance: { lat: 41.751, lng: -87.938 },
        adminHasUnsavedChanges: true,
        adminSelectedSignId: sign.id,
        adminSignDraft: null,
        adminSignSaving: false,
        qrSigns: new Map([[sign.id, sign]]),
        walkingConfig: { maxAttachM: 30 },
        updateAdminEntranceMarker() {},
        checkSignPlacement: () => ({ ok: true }),
        saveQrSign: async (value) => {
            writes.push(value);
            return true;
        },
        populateAdminSignSelect() {},
        clearAdminSignMarkers() {},
        checkLocationPermission() {},
        configureDeveloperControls() {},
        updateDestinationPanel() {},
        updateDeveloperModeButton() {}
    });
    app.adminPanel.style.display = 'flex';
    app.adminPanel.scrollTop = 180;
    app.adminTenantNameInput.value = 'Unsaved tenant name';
    app.adminOfficeSelect.value = 'unit-1';
    app.adminSignSelect.value = sign.id;
    app.adminSignNameInput.value = 'Main lot';
    app.adminStatus.textContent = 'Existing unsaved tenant edits';
    app.adminSignInfo.textContent = 'Existing sign information';
    return { app, document, listeners, writes, win, context };
}

const actions = [
    { name: 'front door', begin: app => app.setAdminEntrancePickActive(true), button: 'adminPickEntranceBtn' },
    { name: 'add sign', begin: app => app.startAdminSignAdd(), button: 'adminSignAddBtn' },
    { name: 'move sign', begin: app => app.startAdminSignMove(), button: 'adminSignMoveBtn' }
];

for (const action of actions) {
    test(`${action.name}: minimize, cancel and preserve existing drafts without publishing`, () => {
        const { app, document, writes } = createFixture();
        const entrance = app.adminPendingEntrance;
        const sign = app.qrSigns.get('main');
        app.adminSignNameInput.focus();
        action.begin(app);
        assert.equal(document.body.classList.contains('admin-map-pick-active'), true);
        assert.equal(app.adminMapAction.style.display, 'flex');
        assert.match(app.adminMapActionText.textContent, /Tap/);
        assert.equal(document.activeElement, app.adminMapCancelBtn);

        app.cancelAdminMapAction();
        assert.equal(document.body.classList.contains('admin-map-pick-active'), false);
        assert.equal(app.adminMapAction.style.display, 'none');
        assert.equal(app.adminMapPickState, null);
        assert.equal(app.adminEntrancePickActive, false);
        assert.equal(app.adminSignPickMode, null);
        assert.equal(app.adminModeActive, true);
        assert.equal(app.adminPendingEntrance, entrance);
        assert.equal(app.qrSigns.get('main'), sign);
        assert.equal(app.adminHasUnsavedChanges, true);
        assert.equal(app.adminTenantNameInput.value, 'Unsaved tenant name');
        assert.equal(app.adminSignNameInput.value, 'Main lot');
        assert.equal(app.adminSignSelect.value, 'main');
        assert.equal(app.adminSelectedOffice.adminDocumentId, 'unit-1');
        assert.equal(app.adminSelectedSignId, 'main');
        assert.equal(app.adminPanel.scrollTop, 180);
        assert.equal(document.activeElement, app[action.button]);
        assert.match(action.name === 'front door' ? app.adminStatus.textContent : app.adminSignInfo.textContent, /cancelled/);

        app.handleAdminMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
        assert.equal(app.adminPendingEntrance, entrance);
        assert.equal(writes.length, 0);
    });
}

test('new signs default to "New sign", then "New sign 1", "New sign 2"', () => {
    const { app } = createFixture();
    assert.equal(app.getDefaultSignName(), 'New sign');
    app.qrSigns.set('new-sign', { id: 'new-sign', label: 'New sign', lat: 1, lng: 1, status: 'active' });
    assert.equal(app.getDefaultSignName(), 'New sign 1');
    app.qrSigns.set('new-sign-1', { id: 'new-sign-1', label: 'New sign 1', lat: 1, lng: 1, status: 'active' });
    assert.equal(app.getDefaultSignName(), 'New sign 2');
    app.qrSigns.set('new-sign', { id: 'new-sign', label: 'New sign', lat: 1, lng: 1, status: 'removed' });
    assert.equal(app.getDefaultSignName(), 'New sign');
});

test('Add sign starts placement without requiring a typed name', () => {
    const { app, writes } = createFixture();
    app.adminSignNameInput.value = '';
    app.startAdminSignAdd();
    assert.equal(app.adminSignPickMode, 'add');
    assert.equal(app.adminMapAction.style.display, 'flex');
    assert.match(app.adminMapActionText.textContent, /^Tap the map where the new sign stands/);
    assert.equal(writes.length, 0);
});

test('invalid sign placement stays active and reports the error in the visible strip', () => {
    const { app, writes } = createFixture();
    app.startAdminSignMove();
    app.checkSignPlacement = () => ({ ok: false, message: 'Tap closer to a mapped walkway.' });
    app.handleAdminSignMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
    assert.equal(app.adminSignPickMode, 'move');
    assert.equal(app.adminSignDraft, null);
    assert.equal(app.adminMapAction.style.display, 'flex');
    assert.equal(app.adminMapActionText.textContent, 'Tap closer to a mapped walkway.');
    assert.equal(writes.length, 0);
    app.cancelAdminMapAction();
    assert.equal(app.adminMapAction.style.display, 'none');
});

test('front-door completion restores the editor and stages rather than publishes', () => {
    const { app, document, writes } = createFixture();
    app.adminHasUnsavedChanges = false;
    app.setAdminEntrancePickActive(true);
    app.handleAdminMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
    assert.equal(app.adminPendingEntrance.lat, 41.752);
    assert.equal(app.adminPendingEntrance.lng, -87.939);
    assert.equal(app.adminHasUnsavedChanges, true);
    assert.equal(app.adminEntrancePickActive, false);
    assert.equal(app.adminMapAction.style.display, 'none');
    assert.match(app.adminStatus.textContent, /Save changes to publish/);
    assert.equal(app.adminTenantNameInput.value, 'Unsaved tenant name');
    assert.equal(document.activeElement, app.adminPickEntranceBtn);
    assert.equal(writes.length, 0);
});

for (const mode of ['add', 'move']) {
    test(`${mode} sign: a map tap only previews; Save sign publishes`, async () => {
        const { app, document, writes } = createFixture();
        if (mode === 'add') {
            app.startAdminSignAdd();
        } else {
            app.startAdminSignMove();
        }
        app.handleAdminMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
        assert.equal(writes.length, 0);
        assert.equal(app.adminMapAction.style.display, 'none');
        assert.equal(app.adminSignPickMode, null);
        assert.equal(document.body.classList.contains('admin-map-pick-active'), false);
        assert.equal(app.adminSignDraft.lat, 41.752);
        assert.equal(app.adminSignDraftActions.style.display, 'grid');
        assert.equal(app.adminSignActions.style.display, 'none');
        assert.equal(app.adminSignSelect.disabled, true);
        assert.equal(app.adminSignNameInput.value, mode === 'add' ? 'New sign' : 'Main lot');
        assert.match(app.adminSignInfo.textContent, /Preview/);
        assert.equal(app.qrSigns.get('main').lat, 41.75);

        await app.saveAdminSignDraft();
        assert.equal(writes.length, 1);
        assert.equal(writes[0].id, mode === 'add' ? 'new-sign' : 'main');
        assert.equal(writes[0].label, mode === 'add' ? 'New sign' : 'Main lot');
        assert.equal(writes[0].lat, 41.752);
        assert.equal(app.adminSignDraft, null);
        assert.equal(app.adminSignDraftActions.style.display, 'none');
        assert.equal(app.adminSignActions.style.display, 'grid');
        assert.equal(app.adminSignSelect.disabled, false);
        assert.match(app.adminSignInfo.textContent, mode === 'add' ? /Sign added/ : /Sign saved/);
    });
}

test('an edited draft name is used for the saved sign and its ID', async () => {
    const { app, writes } = createFixture();
    app.startAdminSignAdd();
    app.handleAdminMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
    app.adminSignNameInput.value = 'North lot';
    await app.saveAdminSignDraft();
    assert.equal(writes[0].id, 'north-lot');
    assert.equal(writes[0].label, 'North lot');
});

test('draft names must be non-empty and unique before saving', async () => {
    const { app, writes } = createFixture();
    app.startAdminSignAdd();
    app.handleAdminMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
    for (const [name, message] of [['', /Enter a sign name/], ['main LOT', /already named/]]) {
        app.adminSignNameInput.value = name;
        await app.saveAdminSignDraft();
        assert.match(app.adminSignInfo.textContent, message);
    }
    assert.equal(writes.length, 0);
    assert.notEqual(app.adminSignDraft, null);
});

test('Discard drops the preview without publishing and restores the selected sign name', () => {
    const { app, writes } = createFixture();
    app.startAdminSignAdd();
    app.handleAdminMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
    app.discardAdminSignDraft();
    assert.equal(app.adminSignDraft, null);
    assert.equal(app.adminSignNameInput.value, 'Main lot');
    assert.equal(app.adminSignActions.style.display, 'grid');
    assert.match(app.adminSignInfo.textContent, /discarded/);
    assert.equal(writes.length, 0);
});

test('Change spot re-picks the preview; cancelling keeps the previous preview', () => {
    const { app, document, writes } = createFixture();
    app.startAdminSignMove();
    app.handleAdminMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
    app.startAdminSignRepick();
    assert.equal(app.adminSignPickMode, 'move');
    assert.equal(app.adminMapAction.style.display, 'flex');
    app.cancelAdminMapAction();
    assert.equal(app.adminSignDraft.lat, 41.752);
    assert.match(app.adminSignInfo.textContent, /previewed spot was kept/);
    assert.equal(document.activeElement, app.adminSignRepickBtn);
    app.startAdminSignRepick();
    app.handleAdminMapClick({ latlng: { lat: 41.753, lng: -87.94 } });
    assert.equal(app.adminSignDraft.lat, 41.753);
    assert.equal(app.adminSignDraft.mode, 'move');
    assert.equal(writes.length, 0);
});

test('a failed save keeps the preview so it can be retried', async () => {
    const { app } = createFixture();
    let finishSave;
    app.saveQrSign = () => new Promise(resolve => { finishSave = resolve; });
    app.startAdminSignMove();
    app.handleAdminMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
    const saving = app.saveAdminSignDraft();
    assert.equal(app.adminSignInfo.textContent, 'Saving sign...');
    assert.equal(app.adminSignSaveBtn.disabled, true);
    app.setAdminSignInfo('Save failed. Sign in again and retry.');
    finishSave(false);
    await saving;
    assert.notEqual(app.adminSignDraft, null);
    assert.equal(app.adminSignSaveBtn.disabled, false);
    assert.match(app.adminSignInfo.textContent, /Save failed/);
    assert.equal(app.qrSigns.get('main').lat, 41.75);
});

test('a stalled sign save times out and keeps the preview recoverable', async () => {
    const { app, context } = createFixture();
    delete app.saveQrSign;
    Object.assign(app, {
        adminIdToken: 'test-token',
        adminSaveTimeoutMs: 20,
        getFirebaseAdminConfig: () => ({ apiKey: 'key', projectId: 'project' })
    });
    context.fetchImpl = (url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
        });
    });
    app.startAdminSignMove();
    app.handleAdminMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
    await app.saveAdminSignDraft();
    assert.equal(app.adminSignSaving, false);
    assert.notEqual(app.adminSignDraft, null);
    assert.equal(app.adminSignSaveBtn.disabled, false);
    assert.equal(app.adminSignDiscardBtn.disabled, false);
    assert.match(app.adminSignInfo.textContent, /timed out/);
    assert.equal(app.qrSigns.get('main').lat, 41.75);
});

test('exiting admin with an unsaved sign preview asks first', () => {
    const { app, win } = createFixture();
    app.adminHasUnsavedChanges = false;
    app.startAdminSignAdd();
    app.handleAdminMapClick({ latlng: { lat: 41.752, lng: -87.939 } });
    const prompts = [];
    win.confirm = (message) => {
        prompts.push(message);
        return false;
    };
    app.exitAdminMode();
    assert.equal(prompts.length, 1);
    assert.equal(app.adminModeActive, true);
    assert.notEqual(app.adminSignDraft, null);

    win.confirm = () => true;
    app.exitAdminMode();
    assert.equal(app.adminModeActive, false);
    assert.equal(app.adminSignDraft, null);
});

test('switching pick types keeps exactly one active action and restores the latest trigger', () => {
    const { app, document } = createFixture();
    app.startAdminSignAdd();
    app.setAdminEntrancePickActive(true);
    assert.equal(app.adminSignPickMode, null);
    assert.equal(app.adminEntrancePickActive, true);
    app.startAdminSignMove();
    assert.equal(app.adminEntrancePickActive, false);
    assert.equal(app.adminSignPickMode, 'move');
    app.cancelAdminMapAction();
    assert.equal(document.activeElement, app.adminSignMoveBtn);
    assert.equal(app.adminPanel.scrollTop, 180);
});

test('Cancel button and Escape cancel placement before Escape exits admin', () => {
    const { app, document, listeners } = createFixture();
    app.cacheDomReferences();
    let exits = 0;
    app.exitAdminMode = () => { exits += 1; };
    app.setAdminEntrancePickActive(true);
    app.adminMapCancelBtn.click();
    assert.equal(app.adminEntrancePickActive, false);
    assert.equal(exits, 0);
    app.startAdminSignMove();
    let prevented = false;
    listeners.get('keydown')({ key: 'Escape', preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(app.adminSignPickMode, null);
    assert.equal(document.body.classList.contains('admin-map-pick-active'), false);
    assert.equal(exits, 0);
    listeners.get('keydown')({ key: 'Escape' });
    assert.equal(exits, 1);
});

test('exiting admin cleans up transient placement UI', () => {
    const { app, document } = createFixture();
    app.startAdminSignAdd();
    app.exitAdminMode();
    assert.equal(app.adminModeActive, false);
    assert.equal(app.adminEntrancePickActive, false);
    assert.equal(app.adminSignPickMode, null);
    assert.equal(app.adminMapPickState, null);
    assert.equal(app.adminPanel.style.display, 'none');
    assert.equal(app.adminMapAction.style.display, 'none');
    assert.equal(document.body.classList.contains('admin-map-pick-active'), false);
});
