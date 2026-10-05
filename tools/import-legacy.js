// Converts a legacy snapshot into draft review artifacts for the walking network:
//   data/properties/willowbrook/draft/reference-points.geojson  (numbered reference features, no edges)
//   data/properties/willowbrook/draft/door-review.csv           (one front door per office, for owner review)
//
// Usage:
//   node tools/import-legacy.js [--snapshot legacy-snapshot-YYYY-MM-DD]
//
// Reads only from the snapshot folder so output is reproducible. Never infers walking
// connectivity: sidewalk and panorama points are exported as standalone references.

const fs = require('fs');
const path = require('path');
const geo = require('../js/nav-geo.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const PROPERTY_ID = 'willowbrook';
const PROPERTY_DIR = path.join(REPO_ROOT, 'data', 'properties', PROPERTY_ID);
const SOURCES_DIR = path.join(PROPERTY_DIR, 'sources');
const DRAFT_DIR = path.join(PROPERTY_DIR, 'draft');

const NEAR_OTHER_DOOR_M = 3;
const SOURCES_DISAGREE_M = 3;
const DOOR_INSIDE_FOOTPRINT_M = 0.5;
const DOOR_FAR_FROM_FOOTPRINT_M = 2;

function parseCoordinatePairs(text) {
    const points = [];
    text.split(/\r?\n/).forEach((line, lineIndex) => {
        for (const match of line.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)) {
            const lat = Number(match[1]);
            const lng = Number(match[2]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                points.push({ lat, lng, sourceLine: lineIndex + 1 });
            }
        }
    });
    return points;
}

function parseEntranceLines(text) {
    const entrances = [];
    const pattern = /^(.*?)\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;
    text.split(/\r?\n/).forEach((rawLine, lineIndex) => {
        const line = rawLine.trim();
        if (!line) {
            return;
        }
        const match = line.match(pattern);
        if (!match) {
            throw new Error(`Invalid entrance line ${lineIndex + 1}: ${line}`);
        }
        entrances.push({ name: match[1], lat: Number(match[2]), lng: Number(match[3]), sourceLine: lineIndex + 1 });
    });
    return entrances;
}

function getLegacyKey(office) {
    return `${office.name}${office.unit ? `__${office.unit}` : ''}`;
}

// Mirrors NavigationApp.getAdminDocumentId so Firestore overrides stay linked.
function getAdminDocumentId(legacyKey) {
    return Buffer.from(legacyKey, 'utf8').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toOfficeId(unit) {
    const normalized = String(unit || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalized ? `u${normalized}` : null;
}

function isLatLng(point) {
    return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

function toLngLat(point) {
    return [point.lng, point.lat];
}

function roundMeters(value) {
    return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function buildFootprintRing(polygon) {
    if (!Array.isArray(polygon)) {
        return { ring: null, issues: ['no-footprint'] };
    }
    const coords = polygon.filter(isLatLng).map(toLngLat);
    if (coords.length < 3) {
        return { ring: null, issues: ['footprint-too-few-points'] };
    }
    const issues = [];
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        // Traced rings end near, not exactly on, the first vertex; close exactly for GeoJSON.
        if (geo.haversineMeters(first, last) < 1) {
            coords[coords.length - 1] = first.slice();
        } else {
            coords.push(first.slice());
            issues.push('footprint-ring-was-open');
        }
    }
    geo.validateRing(coords).forEach(code => issues.push(code === 'E_RING_SELF_INTERSECTION' ? 'footprint-self-intersection' : code));
    return { ring: coords, issues };
}

function buildLegacyReference(sources) {
    const { officesJson, boundariesJson, entrancesText, sidewalkText, panoramaText, firestoreSnapshot, snapshotName } = sources;
    const offices = officesJson && Array.isArray(officesJson.offices) ? officesJson.offices : [];
    if (offices.length === 0) {
        throw new Error('offices.json has no offices');
    }

    const boundaryByKey = new Map();
    ((boundariesJson && boundariesJson.offices) || []).forEach((record) => {
        if (record && typeof record.key === 'string') {
            boundaryByKey.set(record.key, record);
        }
    });

    const sourceEntrancesByName = new Map();
    parseEntranceLines(entrancesText).forEach((entrance) => {
        if (!sourceEntrancesByName.has(entrance.name)) {
            sourceEntrancesByName.set(entrance.name, []);
        }
        sourceEntrancesByName.get(entrance.name).push(entrance);
    });

    const firestoreById = new Map();
    ((firestoreSnapshot && firestoreSnapshot.documents) || []).forEach((document) => {
        firestoreById.set(document.documentId, document);
    });

    const seenOfficeIds = new Set();
    const records = offices.map((office) => {
        const officeId = toOfficeId(office.unit);
        if (!officeId) {
            throw new Error(`Office without unit cannot get a stable ID: ${office.name}`);
        }
        if (seenOfficeIds.has(officeId)) {
            throw new Error(`Duplicate office ID ${officeId} (unit ${office.unit})`);
        }
        seenOfficeIds.add(officeId);

        const legacyKey = getLegacyKey(office);
        const adminDocumentId = getAdminDocumentId(legacyKey);
        const boundary = boundaryByKey.get(legacyKey) || null;
        const override = firestoreById.get(adminDocumentId) || null;
        const sourceDoors = sourceEntrancesByName.get(office.name) || [];

        const boundaryDoor = boundary
            ? ([boundary.entrance, { lat: boundary.entranceLat, lng: boundary.entranceLng }].find(isLatLng) || null)
            : null;
        const overrideDoor = override && isLatLng({ lat: override.entranceLat, lng: override.entranceLng })
            ? { lat: override.entranceLat, lng: override.entranceLng }
            : null;
        const walkingPathEnd = Array.isArray(office.walkingPath) && office.walkingPath.length > 0
            ? office.walkingPath[office.walkingPath.length - 1]
            : null;

        // Same precedence the running app uses: Firestore override > boundary file > source/offices.json.
        let door = null;
        let doorSource = null;
        const doorRefs = [];
        if (overrideDoor) {
            door = overrideDoor;
            doorSource = 'firestore-override';
            doorRefs.push(`firestore:tenantOverrides/${adminDocumentId}`);
        } else if (boundaryDoor) {
            door = boundaryDoor;
            doorSource = 'office-boundaries';
            doorRefs.push(`legacy:office-boundaries.json#${legacyKey}`);
        } else if (sourceDoors.length > 0) {
            door = sourceDoors[0];
            doorSource = 'source-entrances';
            doorRefs.push(`legacy:new_office_building_entrances#L${sourceDoors[0].sourceLine}`);
        } else if (isLatLng(walkingPathEnd)) {
            door = walkingPathEnd;
            doorSource = 'offices-walking-path';
            doorRefs.push(`legacy:offices.json#${legacyKey}`);
        }

        const flags = [];
        if (!door) {
            flags.push('no-door');
        }
        if (overrideDoor) {
            flags.push('firestore-override-applied');
        }
        if (sourceDoors.length === 0) {
            flags.push('missing-from-source-entrances');
        }
        const droppedDoors = sourceDoors.slice(1);
        if (droppedDoors.length > 0) {
            flags.push('second-door-dropped');
        }

        const firstSourceDoor = sourceDoors[0] || null;
        const sourceToDoorM = door && firstSourceDoor
            ? geo.haversineMeters(toLngLat(firstSourceDoor), toLngLat(door))
            : null;
        if (sourceToDoorM !== null && sourceToDoorM > SOURCES_DISAGREE_M) {
            flags.push('sources-disagree');
        }

        const footprint = buildFootprintRing(boundary ? boundary.polygon : null);
        footprint.issues.forEach(issue => flags.push(issue));
        let doorToFootprintEdgeM = null;
        let doorInsideFootprint = null;
        if (door && footprint.ring && !footprint.issues.includes('footprint-self-intersection')) {
            const doorCoord = toLngLat(door);
            doorToFootprintEdgeM = geo.distanceToRingBoundaryMeters(doorCoord, footprint.ring);
            doorInsideFootprint = geo.pointInRing(doorCoord, footprint.ring);
            if (doorInsideFootprint && doorToFootprintEdgeM > DOOR_INSIDE_FOOTPRINT_M) {
                flags.push('door-inside-footprint');
            } else if (!doorInsideFootprint && doorToFootprintEdgeM > DOOR_FAR_FROM_FOOTPRINT_M) {
                flags.push('door-far-from-footprint');
            }
        }

        const icon = boundary && isLatLng({ lat: boundary.officeLat, lng: boundary.officeLng })
            ? { lat: boundary.officeLat, lng: boundary.officeLng }
            : (isLatLng(office) ? { lat: office.lat, lng: office.lng } : null);

        return {
            officeId,
            unit: String(office.unit),
            sourceName: office.name,
            tenantName: override && typeof override.name === 'string' && override.name.trim() ? override.name.trim() : office.name,
            legacyKey,
            adminDocumentId,
            door,
            doorSource,
            doorRefs,
            firstSourceDoor,
            boundaryDoor,
            overrideDoor,
            droppedDoors,
            sourceToDoorM,
            footprintRing: footprint.ring,
            doorToFootprintEdgeM,
            doorInsideFootprint,
            icon,
            flags,
            nearestOtherDoor: null
        };
    });

    records.forEach((record) => {
        if (!record.door) {
            return;
        }
        records.forEach((other) => {
            if (other === record || !other.door) {
                return;
            }
            const distance = geo.haversineMeters(toLngLat(record.door), toLngLat(other.door));
            if (!record.nearestOtherDoor || distance < record.nearestOtherDoor.distanceM) {
                record.nearestOtherDoor = { officeId: other.officeId, distanceM: distance };
            }
        });
        if (record.nearestOtherDoor && record.nearestOtherDoor.distanceM < NEAR_OTHER_DOOR_M) {
            record.flags.push('near-other-door');
        }
    });

    const features = [];
    const unverified = { verification: 'unverified' };

    records.forEach((record) => {
        if (record.door) {
            features.push({
                type: 'Feature',
                id: `door-${record.officeId}`,
                geometry: { type: 'Point', coordinates: toLngLat(record.door) },
                properties: {
                    featureType: 'reference-door',
                    officeId: record.officeId,
                    unit: record.unit,
                    tenantName: record.tenantName,
                    legacyKey: record.legacyKey,
                    adminDocumentId: record.adminDocumentId,
                    doorSource: record.doorSource,
                    reviewFlags: record.flags.slice(),
                    source: record.doorRefs.slice(),
                    ...unverified
                }
            });
        }
        record.droppedDoors.forEach((dropped, index) => {
            features.push({
                type: 'Feature',
                id: `dropped-door-${record.officeId}-${index + 2}`,
                geometry: { type: 'Point', coordinates: toLngLat(dropped) },
                properties: {
                    featureType: 'reference-dropped-door',
                    officeId: record.officeId,
                    note: 'Second listed door removed by owner decision (one door per office).',
                    source: [`legacy:new_office_building_entrances#L${dropped.sourceLine}`],
                    ...unverified
                }
            });
        });
        if (record.icon) {
            features.push({
                type: 'Feature',
                id: `icon-${record.officeId}`,
                geometry: { type: 'Point', coordinates: toLngLat(record.icon) },
                properties: {
                    featureType: 'reference-office-icon',
                    officeId: record.officeId,
                    source: [`legacy:office-boundaries.json#${record.legacyKey}`],
                    ...unverified
                }
            });
        }
        if (record.footprintRing) {
            features.push({
                type: 'Feature',
                id: `footprint-${record.officeId}`,
                geometry: { type: 'Polygon', coordinates: [record.footprintRing] },
                properties: {
                    featureType: 'reference-unit-footprint',
                    officeId: record.officeId,
                    blocksWalking: null,
                    note: 'Traced unit footprint, not a verified building obstacle.',
                    source: [`legacy:office-boundaries.json#${record.legacyKey}`],
                    ...unverified
                }
            });
        }
    });

    parseCoordinatePairs(sidewalkText).forEach((point, index) => {
        features.push({
            type: 'Feature',
            id: `sidewalk-S${index + 1}`,
            geometry: { type: 'Point', coordinates: toLngLat(point) },
            properties: {
                featureType: 'reference-sidewalk-point',
                label: `S${index + 1}`,
                note: 'Standalone reference; file order does not imply connectivity.',
                source: [`legacy:sidewalk_locations.txt#L${point.sourceLine}`],
                ...unverified
            }
        });
    });

    parseCoordinatePairs(panoramaText).forEach((point, index) => {
        features.push({
            type: 'Feature',
            id: `panorama-P${index + 1}`,
            geometry: { type: 'Point', coordinates: toLngLat(point) },
            properties: {
                featureType: 'reference-panorama-point',
                label: `P${index + 1}`,
                note: 'Street View camera reference; not proof of pedestrian access.',
                source: [`legacy:panorama_gps_locations.txt#L${point.sourceLine}`],
                ...unverified
            }
        });
    });

    const geojson = {
        type: 'FeatureCollection',
        metadata: {
            propertyId: PROPERTY_ID,
            status: 'draft-reference-only',
            coordinateOrder: '[longitude, latitude] WGS84',
            sourceSnapshot: snapshotName || null,
            firestoreOverridesIncluded: !!firestoreSnapshot,
            note: 'Reference features for drawing the walking network. Contains no walking edges.'
        },
        features
    };

    return { records, geojson };
}

const CSV_COLUMNS = [
    'office_id', 'unit', 'tenant_name', 'legacy_key',
    'door_lat', 'door_lng', 'door_source',
    'source_door_lat', 'source_door_lng', 'boundary_door_lat', 'boundary_door_lng',
    'firestore_door_lat', 'firestore_door_lng', 'source_to_door_m',
    'dropped_door_lat', 'dropped_door_lng',
    'door_to_footprint_edge_m', 'door_inside_footprint',
    'nearest_other_door_office', 'nearest_other_door_m',
    'review_flags', 'owner_decision', 'owner_notes'
];

function csvEscape(value) {
    if (value === null || value === undefined) {
        return '';
    }
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildDoorReviewCsv(records) {
    const rows = records.map((record) => {
        const dropped = record.droppedDoors[0] || null;
        return [
            record.officeId, record.unit, record.tenantName, record.legacyKey,
            record.door ? record.door.lat : '', record.door ? record.door.lng : '', record.doorSource || '',
            record.firstSourceDoor ? record.firstSourceDoor.lat : '', record.firstSourceDoor ? record.firstSourceDoor.lng : '',
            record.boundaryDoor ? record.boundaryDoor.lat : '', record.boundaryDoor ? record.boundaryDoor.lng : '',
            record.overrideDoor ? record.overrideDoor.lat : '', record.overrideDoor ? record.overrideDoor.lng : '',
            roundMeters(record.sourceToDoorM),
            dropped ? dropped.lat : '', dropped ? dropped.lng : '',
            roundMeters(record.doorToFootprintEdgeM),
            record.doorInsideFootprint === null ? '' : (record.doorInsideFootprint ? 'yes' : 'no'),
            record.nearestOtherDoor ? record.nearestOtherDoor.officeId : '',
            record.nearestOtherDoor ? roundMeters(record.nearestOtherDoor.distanceM) : '',
            record.flags.join(';'),
            '', ''
        ].map(csvEscape).join(',');
    });
    return `${CSV_COLUMNS.join(',')}\n${rows.join('\n')}\n`;
}

function findLatestSnapshot() {
    if (!fs.existsSync(SOURCES_DIR)) {
        return null;
    }
    const snapshots = fs.readdirSync(SOURCES_DIR)
        .filter(name => /^legacy-snapshot-\d{4}-\d{2}-\d{2}$/.test(name))
        .sort();
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

function readSnapshot(snapshotName) {
    const dir = path.join(SOURCES_DIR, snapshotName);
    const read = file => fs.readFileSync(path.join(dir, file), 'utf8');
    const firestorePath = path.join(dir, 'firestore-tenant-overrides.json');
    return {
        snapshotName,
        officesJson: JSON.parse(read('offices.json')),
        boundariesJson: JSON.parse(read('office-boundaries.json')),
        entrancesText: read('new_office_building_entrances'),
        sidewalkText: read('sidewalk_locations.txt'),
        panoramaText: read('panorama_gps_locations.txt'),
        firestoreSnapshot: fs.existsSync(firestorePath) ? JSON.parse(fs.readFileSync(firestorePath, 'utf8')) : null
    };
}

function main() {
    const argv = process.argv.slice(2);
    let snapshotName = null;
    for (let index = 0; index < argv.length; index += 1) {
        if (argv[index] === '--snapshot') {
            snapshotName = argv[index + 1];
            index += 1;
        } else {
            throw new Error(`Unknown argument: ${argv[index]}`);
        }
    }
    snapshotName = snapshotName || findLatestSnapshot();
    if (!snapshotName || !/^legacy-snapshot-\d{4}-\d{2}-\d{2}$/.test(snapshotName)) {
        throw new Error('No legacy snapshot found. Run: node tools/snapshot-legacy.js --firestore');
    }

    const { records, geojson } = buildLegacyReference(readSnapshot(snapshotName));

    fs.mkdirSync(DRAFT_DIR, { recursive: true });
    fs.writeFileSync(path.join(DRAFT_DIR, 'reference-points.geojson'), `${JSON.stringify(geojson, null, 2)}\n`);
    fs.writeFileSync(path.join(DRAFT_DIR, 'door-review.csv'), buildDoorReviewCsv(records));

    const flagged = records.filter(record => record.flags.length > 0);
    console.log(`Imported ${records.length} offices from ${snapshotName}`);
    console.log(`Features: ${geojson.features.length}; offices with review flags: ${flagged.length}`);
    flagged.forEach(record => console.log(`  ${record.officeId} ${record.tenantName}: ${record.flags.join(', ')}`));
    console.log(`Wrote ${path.relative(REPO_ROOT, DRAFT_DIR)}${path.sep}reference-points.geojson and door-review.csv`);
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(`Import failed: ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    parseCoordinatePairs,
    parseEntranceLines,
    getAdminDocumentId,
    toOfficeId,
    buildLegacyReference,
    buildDoorReviewCsv
};
