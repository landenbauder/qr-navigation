// Validates the walkway draft and publishes it as the file the app loads.
//
// Usage:
//   node tools/publish-network.js [--status pilot|published] [--draft path]
//
// pilot     routes allowed over owner-confirmed / imagery-reviewed walkways, only for sign (?start=) links.
// published routes for every visitor; requires every walkway to be field-verified (physically walked).
// Validation errors always block publishing. Rollback = revert network.geojson in git and redeploy.

const fs = require('fs');
const path = require('path');
const { validateNetworkDraft } = require('../js/nav-validate.js');
const graphLib = require('../js/nav-graph.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const PROPERTY_DIR = path.join(REPO_ROOT, 'data', 'properties', 'willowbrook');
const DEFAULT_DRAFT = path.join(PROPERTY_DIR, 'draft', 'walking-network-draft.geojson');
const REFERENCE_FILE = path.join(PROPERTY_DIR, 'draft', 'reference-points.geojson');
const OUTPUT_FILE = path.join(PROPERTY_DIR, 'network.geojson');
const BBOX_PADDING_DEG = 0.005;

function parseArgs(argv) {
    const args = { status: 'pilot', draft: DEFAULT_DRAFT };
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === '--status') {
            args.status = argv[index + 1];
            index += 1;
        } else if (argv[index] === '--draft') {
            args.draft = path.resolve(argv[index + 1]);
            index += 1;
        } else {
            throw new Error(`Unknown argument: ${argv[index]}`);
        }
    }
    if (!['pilot', 'published'].includes(args.status)) {
        throw new Error('--status must be pilot or published');
    }
    return args;
}

function nextDataVersion() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    let revision = 1;
    if (fs.existsSync(OUTPUT_FILE)) {
        const previous = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')).metadata || {};
        const match = typeof previous.dataVersion === 'string' && previous.dataVersion.match(/^(\d{4}\.\d{2}\.\d{2})-(\d+)$/);
        if (match && match[1] === date) {
            revision = Number(match[2]) + 1;
        }
    }
    return `${date}-${revision}`;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(args.draft)) {
        throw new Error(`Draft not found: ${path.relative(REPO_ROOT, args.draft)}`);
    }
    const draft = JSON.parse(fs.readFileSync(args.draft, 'utf8'));
    const doors = JSON.parse(fs.readFileSync(REFERENCE_FILE, 'utf8')).features
        .filter(f => f.properties.featureType === 'reference-door');
    const lngs = doors.map(f => f.geometry.coordinates[0]);
    const lats = doors.map(f => f.geometry.coordinates[1]);

    const result = validateNetworkDraft(draft, {
        disallowSynthetic: true,
        officeIds: doors.map(f => f.properties.officeId),
        bbox: [Math.min(...lngs) - BBOX_PADDING_DEG, Math.min(...lats) - BBOX_PADDING_DEG, Math.max(...lngs) + BBOX_PADDING_DEG, Math.max(...lats) + BBOX_PADDING_DEG]
    });
    result.errors.forEach(issue => console.error(`ERROR ${issue.code}: ${issue.message}`));
    if (!result.ok) {
        throw new Error(`${result.errors.length} validation error(s); nothing published.`);
    }

    const minVerification = args.status === 'published' ? 'field-verified' : 'imagery-reviewed';
    const graph = graphLib.buildGraph(draft, { minVerification });
    if (args.status === 'published' && graph.skipped.length > 0) {
        throw new Error(`${graph.skipped.length} walkway(s) are not field-verified, closed, or not public; cannot publish as "published".`);
    }

    const activeStarts = graph.starts;
    const unreachable = [];
    graph.doors.forEach((doorNodeId, officeId) => {
        const reachable = activeStarts.some(start => graphLib.findRoute(graph, start.lngLat, doorNodeId).ok);
        if (!reachable) unreachable.push(officeId);
    });
    const missingDoors = doors.map(f => f.properties.officeId).filter(id => !graph.doors.has(id));
    if (args.status === 'published' && (unreachable.length > 0 || missingDoors.length > 0)) {
        throw new Error(`Cannot publish: unreachable ${unreachable.join(', ') || 'none'}; no door ${missingDoors.join(', ') || 'none'}.`);
    }

    const output = {
        ...draft,
        metadata: {
            ...draft.metadata,
            status: args.status,
            publishStatus: args.status,
            dataVersion: nextDataVersion(),
            publishedAt: new Date().toISOString(),
            minVerification,
            routableWalkways: graph.edges.size,
            skippedWalkways: graph.skipped.length
        }
    };
    fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);

    console.log(`Published ${path.relative(REPO_ROOT, OUTPUT_FILE)} as ${args.status} (${output.metadata.dataVersion})`);
    console.log(`  ${graph.edges.size} routable walkways, ${graph.skipped.length} skipped, ${activeStarts.length} active signs, ${graph.doors.size}/${doors.length} doors`);
    if (unreachable.length > 0) console.log(`  Not reachable from any sign (visitors will see "no route"): ${unreachable.join(', ')}`);
    if (missingDoors.length > 0) console.log(`  No door in the network: ${missingDoors.join(', ')}`);
    result.warnings.filter(w => !['W_NOT_FIELD_VERIFIED', 'W_NO_BUILDINGS', 'W_NO_BOUNDARY'].includes(w.code))
        .forEach(w => console.log(`  warning ${w.code}: ${w.message}`));
}

try {
    main();
} catch (error) {
    console.error(`Publish failed: ${error.message}`);
    process.exitCode = 1;
}
