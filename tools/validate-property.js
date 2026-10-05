// Validates an exported walkway draft with the same rules the editor uses.
//
// Usage:
//   node tools/validate-property.js [path/to/walking-network-draft.geojson]
//
// Exit code 1 when there are errors, so it can gate commits or publishing.

const fs = require('fs');
const path = require('path');
const { validateNetworkDraft } = require('../js/nav-validate.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const DRAFT_DIR = path.join(REPO_ROOT, 'data', 'properties', 'willowbrook', 'draft');
const DEFAULT_DRAFT = path.join(DRAFT_DIR, 'walking-network-draft.geojson');
const REFERENCE_FILE = path.join(DRAFT_DIR, 'reference-points.geojson');
const BBOX_PADDING_DEG = 0.005;

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildOptions() {
    if (!fs.existsSync(REFERENCE_FILE)) {
        console.warn('reference-points.geojson not found; skipping office and bounding-box checks.');
        return { disallowSynthetic: true };
    }
    const doors = readJson(REFERENCE_FILE).features.filter(f => f.properties.featureType === 'reference-door');
    const lngs = doors.map(f => f.geometry.coordinates[0]);
    const lats = doors.map(f => f.geometry.coordinates[1]);
    return {
        disallowSynthetic: true,
        officeIds: doors.map(f => f.properties.officeId),
        bbox: [
            Math.min(...lngs) - BBOX_PADDING_DEG,
            Math.min(...lats) - BBOX_PADDING_DEG,
            Math.max(...lngs) + BBOX_PADDING_DEG,
            Math.max(...lats) + BBOX_PADDING_DEG
        ]
    };
}

function main() {
    const target = path.resolve(process.argv[2] || DEFAULT_DRAFT);
    if (!fs.existsSync(target)) {
        throw new Error(`File not found: ${path.relative(REPO_ROOT, target)}`);
    }
    const result = validateNetworkDraft(readJson(target), buildOptions());
    const s = result.stats;
    console.log(`${path.relative(REPO_ROOT, target)}`);
    console.log(`  ${s.edges} walkways (${Math.round(s.totalEdgeLengthM)} m), ${s.nodes} points, ${s.entrances} doors, ${s.starts} QR signs, ${s.arrivals} parking, ${s.areas} areas, ${s.barriers} barriers, ${s.components} connected group(s)`);
    result.errors.forEach(issue => console.log(`  ERROR   ${issue.code}: ${issue.message}`));
    result.warnings.forEach(issue => console.log(`  warning ${issue.code}: ${issue.message}`));
    console.log(`  ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
    if (!result.ok) {
        process.exitCode = 1;
    }
}

try {
    main();
} catch (error) {
    console.error(`Validation failed: ${error.message}`);
    process.exitCode = 1;
}
