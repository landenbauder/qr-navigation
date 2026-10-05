// Copies the current legacy location files into a dated, read-only snapshot folder so
// later migrations can be re-run from identical inputs.
//
// Usage:
//   node tools/snapshot-legacy.js [--date YYYY-MM-DD] [--firestore]
//
// --firestore performs a read-only GET of the public tenantOverrides collection using
// the Firebase web config in app-config.js. Nothing is written to Firestore.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const PROPERTY_ID = 'willowbrook';
const SNAPSHOT_ROOT = path.join(REPO_ROOT, 'data', 'properties', PROPERTY_ID, 'sources');

const LEGACY_FILES = [
    'offices.json',
    'office-boundaries.json',
    'new_office_locations.json',
    'new_office_building_entrances',
    'sidewalk_locations.txt',
    'panorama_gps_locations.txt',
    'tenant-units-from-pdf.csv',
    'tenant-coordinate-reuse-map.csv',
    'remaining-office-coordinate-capture.csv'
];

const FIRESTORE_SNAPSHOT_FILE = 'firestore-tenant-overrides.json';

function parseArgs(argv) {
    const args = { date: new Date().toISOString().slice(0, 10), firestore: false };
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === '--date') {
            args.date = argv[index + 1];
            index += 1;
        } else if (argv[index] === '--firestore') {
            args.firestore = true;
        } else {
            throw new Error(`Unknown argument: ${argv[index]}`);
        }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
        throw new Error(`Invalid --date value: ${args.date}`);
    }
    return args;
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readFirebaseConfig() {
    const configPath = path.join(REPO_ROOT, 'app-config.js');
    if (!fs.existsSync(configPath)) {
        throw new Error('app-config.js not found; cannot read Firebase settings.');
    }
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(configPath, 'utf8'), sandbox, { timeout: 1000 });
    const firebase = sandbox.window.APP_CONFIG && sandbox.window.APP_CONFIG.FIREBASE;
    const apiKey = firebase && typeof firebase.apiKey === 'string' ? firebase.apiKey.trim() : '';
    const projectId = firebase && typeof firebase.projectId === 'string' ? firebase.projectId.trim() : '';
    if (!apiKey || !projectId || apiKey.startsWith('YOUR_')) {
        throw new Error('Firebase apiKey/projectId are not configured in app-config.js.');
    }
    return { apiKey, projectId };
}

function readFirestoreValue(field) {
    if (!field || typeof field !== 'object') {
        return null;
    }
    if ('stringValue' in field) return field.stringValue;
    if ('doubleValue' in field) return Number(field.doubleValue);
    if ('integerValue' in field) return Number(field.integerValue);
    if ('timestampValue' in field) return field.timestampValue;
    if ('booleanValue' in field) return field.booleanValue;
    return null;
}

async function fetchTenantOverrides() {
    const { apiKey, projectId } = readFirebaseConfig();
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/tenantOverrides`;
    const documents = [];
    let pageToken = '';

    do {
        const url = new URL(baseUrl);
        url.searchParams.set('key', apiKey);
        url.searchParams.set('pageSize', '300');
        if (pageToken) {
            url.searchParams.set('pageToken', pageToken);
        }
        const response = await fetch(url, { method: 'GET' });
        if (response.status === 404) {
            break;
        }
        if (!response.ok) {
            throw new Error(`Firestore returned HTTP ${response.status}`);
        }
        const payload = await response.json();
        (payload.documents || []).forEach((document) => {
            const fields = document.fields || {};
            const record = { documentId: document.name.split('/').pop() };
            Object.keys(fields).sort().forEach((key) => {
                record[key] = readFirestoreValue(fields[key]);
            });
            record.updateTime = document.updateTime || null;
            documents.push(record);
        });
        pageToken = payload.nextPageToken || '';
    } while (pageToken);

    documents.sort((left, right) => left.documentId.localeCompare(right.documentId));
    return {
        collection: 'tenantOverrides',
        fetchedAt: new Date().toISOString(),
        readOnly: true,
        documents
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const snapshotDir = path.join(SNAPSHOT_ROOT, `legacy-snapshot-${args.date}`);

    if (fs.existsSync(snapshotDir)) {
        throw new Error(`Snapshot already exists: ${path.relative(REPO_ROOT, snapshotDir)}. Snapshots are never overwritten.`);
    }

    const manifest = {
        propertyId: PROPERTY_ID,
        snapshotDate: args.date,
        createdAt: new Date().toISOString(),
        note: 'Unmodified copies of legacy inputs. Do not edit; create a new snapshot instead.',
        files: []
    };

    const missing = LEGACY_FILES.filter(file => !fs.existsSync(path.join(REPO_ROOT, file)));
    if (missing.length > 0) {
        throw new Error(`Missing legacy files: ${missing.join(', ')}`);
    }

    let firestoreSnapshot = null;
    if (args.firestore) {
        firestoreSnapshot = await fetchTenantOverrides();
    }

    fs.mkdirSync(snapshotDir, { recursive: true });

    LEGACY_FILES.forEach((file) => {
        const content = fs.readFileSync(path.join(REPO_ROOT, file));
        fs.writeFileSync(path.join(snapshotDir, file), content);
        manifest.files.push({ file, bytes: content.length, sha256: sha256(content) });
    });

    if (firestoreSnapshot) {
        const content = Buffer.from(`${JSON.stringify(firestoreSnapshot, null, 2)}\n`, 'utf8');
        fs.writeFileSync(path.join(snapshotDir, FIRESTORE_SNAPSHOT_FILE), content);
        manifest.files.push({ file: FIRESTORE_SNAPSHOT_FILE, bytes: content.length, sha256: sha256(content) });
    }

    fs.writeFileSync(path.join(snapshotDir, 'snapshot-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    console.log(`Snapshot written to ${path.relative(REPO_ROOT, snapshotDir)}`);
    manifest.files.forEach(entry => console.log(`  ${entry.file} (${entry.bytes} bytes)`));
    if (firestoreSnapshot) {
        console.log(`  Firestore overrides captured: ${firestoreSnapshot.documents.length}`);
    }
}

main().catch((error) => {
    console.error(`Snapshot failed: ${error.message}`);
    process.exitCode = 1;
});
