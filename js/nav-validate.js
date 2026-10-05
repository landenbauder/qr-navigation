// Validation rules for the property walking network. Shared by the developer editor,
// tools/validate-property.js, and (later) runtime loading. Never repairs data; it only reports.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./nav-geo.js'));
    } else {
        root.QRNavCore = root.QRNavCore || {};
        root.QRNavCore.validate = factory(root.QRNavCore.geo);
    }
})(typeof self !== 'undefined' ? self : this, function (geo) {
    'use strict';

    const SCHEMA_VERSION = 1;

    const ENUMS = {
        nodeKind: ['junction', 'endpoint', 'entrance', 'gate'],
        edgeKind: ['sidewalk', 'path', 'crosswalk', 'parking-crossing', 'entrance-connector', 'gate-passage', 'ramp', 'stairs'],
        status: ['open', 'closed', 'temporarily-closed'],
        access: ['public', 'private', 'restricted', 'unknown'],
        verification: ['unverified', 'imagery-reviewed', 'owner-confirmed', 'field-verified', 'synthetic'],
        areaKind: ['navigation-boundary', 'building', 'no-walk', 'parking', 'walkable-area'],
        barrierKind: ['fence', 'wall', 'curb', 'planter', 'other'],
        startStatus: ['active', 'retired']
    };

    const PARKING_CROSSING_KINDS = ['crosswalk', 'parking-crossing'];
    const START_ID_PATTERN = /^[a-z0-9-]{1,40}$/;

    // Metric tolerances; tune per property through options.tolerances.
    const DEFAULT_TOLERANCES = {
        endpointMatchM: 0.05,
        minEdgeLengthM: 0.1,
        nearMissM: 3,
        duplicateNodeM: 0.5,
        entranceOnBuildingM: 1.0,
        entranceApproachTrimM: 1.5,
        entranceExteriorProbeM: 0.5,
        gateOnBarrierM: 1.0,
        parkingEdgeClearanceM: 0.5,
        parkingSampleStepM: 2
    };

    const GEOMETRY_BY_TYPE = {
        node: 'Point',
        start: 'Point',
        arrival: 'Point',
        edge: 'LineString',
        barrier: 'LineString',
        area: 'Polygon'
    };

    function createReport() {
        const issues = [];
        return {
            issues,
            add(severity, code, message, featureIds = [], coord = null) {
                issues.push({ severity, code, message, featureIds: featureIds.filter(Boolean), coord });
            }
        };
    }

    function bboxOfXY(points) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        points.forEach((p) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        return { minX, minY, maxX, maxY };
    }

    function bboxesOverlap(a, b, padding = 0) {
        return a.minX - padding <= b.maxX && b.minX - padding <= a.maxX
            && a.minY - padding <= b.maxY && b.minY - padding <= a.maxY;
    }

    function polylineLengthXY(xy) {
        let total = 0;
        for (let index = 1; index < xy.length; index += 1) {
            total += Math.hypot(xy[index].x - xy[index - 1].x, xy[index].y - xy[index - 1].y);
        }
        return total;
    }

    function pointAlongXY(xy, distance) {
        let remaining = distance;
        for (let index = 1; index < xy.length; index += 1) {
            const a = xy[index - 1];
            const b = xy[index];
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            if (remaining <= length && length > 0) {
                const t = remaining / length;
                return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
            }
            remaining -= length;
        }
        return { x: xy[xy.length - 1].x, y: xy[xy.length - 1].y };
    }

    // Returns the part of the polyline between startTrim and (length - endTrim), or null if nothing is left.
    function trimPolylineXY(xy, startTrim, endTrim) {
        const total = polylineLengthXY(xy);
        const from = startTrim;
        const to = total - endTrim;
        if (to - from <= 1e-6) {
            return null;
        }
        if (startTrim === 0 && endTrim === 0) {
            return xy;
        }
        const result = [pointAlongXY(xy, from)];
        let travelled = 0;
        for (let index = 1; index < xy.length; index += 1) {
            travelled += Math.hypot(xy[index].x - xy[index - 1].x, xy[index].y - xy[index - 1].y);
            if (travelled > from && travelled < to) {
                result.push(xy[index]);
            }
        }
        result.push(pointAlongXY(xy, to));
        return result;
    }

    function sampleSegmentsXY(xy, step) {
        const samples = [];
        for (let index = 1; index < xy.length; index += 1) {
            const a = xy[index - 1];
            const b = xy[index];
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            const count = Math.max(1, Math.ceil(length / step));
            for (let i = 0; i <= count; i += 1) {
                const t = i / count;
                samples.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
            }
        }
        return samples;
    }

    function polylineHitsRings(lineXY, ringsXY) {
        for (let i = 1; i < lineXY.length; i += 1) {
            for (const ring of ringsXY) {
                for (let j = 1; j < ring.length; j += 1) {
                    const hit = geo.xy.segmentIntersection(lineXY[i - 1], lineXY[i], ring[j - 1], ring[j]);
                    if (hit.type !== 'none') {
                        return hit.point;
                    }
                }
            }
        }
        return null;
    }

    function pointInPolygonXY(p, ringsXY) {
        if (!geo.xy.pointInRing(p, ringsXY[0])) {
            return false;
        }
        return !ringsXY.slice(1).some(hole => geo.xy.pointInRing(p, hole));
    }

    function distanceToRingsXY(p, ringsXY) {
        return Math.min(...ringsXY.map(ring => geo.xy.distanceToPolyline(p, ring)));
    }

    function describe(feature) {
        const props = feature.properties || {};
        return props.label ? `${feature.id} (${props.label})` : feature.id;
    }

    function validateNetworkDraft(collection, options = {}) {
        const tolerances = { ...DEFAULT_TOLERANCES, ...(options.tolerances || {}) };
        const report = createReport();
        const stats = { nodes: 0, edges: 0, areas: 0, barriers: 0, starts: 0, arrivals: 0, entrances: 0, totalEdgeLengthM: 0, components: 0 };

        if (!collection || collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
            report.add('error', 'E_SCHEMA', 'File is not a GeoJSON FeatureCollection.');
            return finish(report, stats);
        }

        if (options.disallowSynthetic && collection.metadata && collection.metadata.synthetic) {
            report.add('error', 'E_SYNTHETIC_DATA', 'Synthetic test data cannot be loaded as real property data.');
        }

        const byId = new Map();
        const byType = { node: [], edge: [], area: [], barrier: [], start: [], arrival: [] };
        const valid = new Set();
        let projection = null;

        collection.features.forEach((feature, index) => {
            const props = feature && feature.properties;
            const id = feature && feature.id;
            const type = props && props.featureType;
            if (typeof id !== 'string' || !id.trim()) {
                report.add('error', 'E_SCHEMA', `Feature #${index + 1} has no id.`);
                return;
            }
            if (byId.has(id)) {
                report.add('error', 'E_DUP_ID', `Duplicate id "${id}".`, [id]);
                return;
            }
            byId.set(id, feature);
            if (!GEOMETRY_BY_TYPE[type]) {
                report.add('error', 'E_SCHEMA', `${id}: unknown featureType "${type}".`, [id]);
                return;
            }
            byType[type].push(feature);
            if (checkFeatureSchema(feature, type, report, options)) {
                valid.add(id);
                if (!projection) {
                    projection = geo.createLocalProjection(firstCoordinate(feature));
                }
            }
        });

        stats.nodes = byType.node.length;
        stats.edges = byType.edge.length;
        stats.areas = byType.area.length;
        stats.barriers = byType.barrier.length;
        stats.starts = byType.start.length;
        stats.arrivals = byType.arrival.length;

        if (!projection) {
            return finish(report, stats);
        }

        const xyCache = new Map();
        const toXY = coord => projection.toXY(coord);
        const nodeXY = id => xyCache.get(id);

        byType.node.filter(f => valid.has(f.id)).forEach(f => xyCache.set(f.id, toXY(f.geometry.coordinates)));
        const edges = byType.edge.filter(f => valid.has(f.id)).map(f => {
            const xy = f.geometry.coordinates.map(toXY);
            return { feature: f, xy, bbox: bboxOfXY(xy), props: f.properties };
        });
        const barriers = byType.barrier.filter(f => valid.has(f.id)).map(f => {
            const xy = f.geometry.coordinates.map(toXY);
            return { feature: f, xy, bbox: bboxOfXY(xy) };
        });

        const areas = [];
        byType.area.filter(f => valid.has(f.id)).forEach((f) => {
            const ringIssues = f.geometry.coordinates.flatMap(ring => geo.validateRing(ring));
            if (ringIssues.length > 0) {
                [...new Set(ringIssues)].forEach(code => report.add('error', code, `${describe(f)}: ${ringMessage(code)}`, [f.id], f.geometry.coordinates[0][0]));
                return;
            }
            const rings = f.geometry.coordinates.map(ring => ring.map(toXY));
            areas.push({ feature: f, kind: f.properties.areaKind, rings, bbox: bboxOfXY(rings[0]) });
        });
        const buildings = areas.filter(a => a.kind === 'building');
        const noWalk = areas.filter(a => a.kind === 'no-walk');
        const parking = areas.filter(a => a.kind === 'parking');
        const boundaries = areas.filter(a => a.kind === 'navigation-boundary');

        const nodesById = new Map(byType.node.map(f => [f.id, f]));
        const edgesById = new Map(byType.edge.map(f => [f.id, f]));
        const incident = new Map(byType.node.map(f => [f.id, []]));

        // References and endpoint consistency.
        const connectedEdges = [];
        edges.forEach((edge) => {
            const { feature, props, xy } = edge;
            const from = nodesById.get(props.from);
            const to = nodesById.get(props.to);
            if (!from || !to) {
                report.add('error', 'E_DANGLING_REF', `${feature.id}: refers to missing node ${!from ? props.from : props.to}.`, [feature.id], feature.geometry.coordinates[0]);
                return;
            }
            if (props.from === props.to) {
                report.add('error', 'E_EDGE_SELF_LOOP', `${feature.id}: starts and ends at the same node.`, [feature.id], feature.geometry.coordinates[0]);
                return;
            }
            if (!valid.has(from.id) || !valid.has(to.id)) {
                return;
            }
            const startGap = Math.hypot(xy[0].x - nodeXY(from.id).x, xy[0].y - nodeXY(from.id).y);
            const endGap = Math.hypot(xy[xy.length - 1].x - nodeXY(to.id).x, xy[xy.length - 1].y - nodeXY(to.id).y);
            if (startGap > tolerances.endpointMatchM || endGap > tolerances.endpointMatchM) {
                report.add('error', 'E_EDGE_ENDPOINT_MISMATCH', `${feature.id}: line ends do not sit on nodes ${from.id}/${to.id} (gap ${Math.max(startGap, endGap).toFixed(2)} m).`, [feature.id], feature.geometry.coordinates[0]);
                return;
            }
            const length = polylineLengthXY(xy);
            if (length < tolerances.minEdgeLengthM) {
                report.add('error', 'E_ZERO_LENGTH', `${feature.id}: walkway is shorter than ${tolerances.minEdgeLengthM} m.`, [feature.id], feature.geometry.coordinates[0]);
                return;
            }
            stats.totalEdgeLengthM += geo.polylineLengthMeters(feature.geometry.coordinates);
            edge.fromNode = from;
            edge.toNode = to;
            incident.get(from.id).push(edge);
            incident.get(to.id).push(edge);
            connectedEdges.push(edge);
            (props.crossesWithoutConnection || []).forEach((otherId) => {
                if (!edgesById.has(otherId)) {
                    report.add('error', 'E_DANGLING_REF', `${feature.id}: crossesWithoutConnection lists missing walkway ${otherId}.`, [feature.id]);
                }
            });
        });

        [...byType.start, ...byType.arrival].filter(f => valid.has(f.id)).forEach((feature) => {
            const nodeId = feature.properties.nodeId;
            if (!nodesById.has(nodeId)) {
                report.add('error', 'E_DANGLING_REF', `${describe(feature)}: refers to missing node ${nodeId}.`, [feature.id], feature.geometry.coordinates);
            } else if ((incident.get(nodeId) || []).length === 0) {
                report.add('warning', 'W_PLACE_NOT_CONNECTED', `${describe(feature)}: its node has no walkways yet.`, [feature.id, nodeId], feature.geometry.coordinates);
            }
        });

        checkEntrances(byType.node.filter(f => valid.has(f.id)), incident, buildings, nodeXY, tolerances, options, report, stats);
        checkObstacles(connectedEdges, buildings, noWalk, parking, boundaries, barriers, nodeXY, tolerances, report);
        checkGates(byType.node.filter(f => valid.has(f.id) && f.properties.nodeKind === 'gate'), barriers, nodeXY, tolerances, report);
        checkEdgeCrossings(connectedEdges, nodeXY, projection, report);
        checkNodeSpacing(byType.node.filter(f => valid.has(f.id)), connectedEdges, incident, nodeXY, collection, tolerances, report);
        checkConnectivity(byType, valid, connectedEdges, incident, report, stats);

        if (connectedEdges.length > 0 && boundaries.length === 0) {
            report.add('warning', 'W_NO_BOUNDARY', 'No navigation boundary drawn yet.');
        }

        return finish(report, stats);
    }

    function firstCoordinate(feature) {
        const g = feature.geometry;
        if (g.type === 'Point') return g.coordinates;
        if (g.type === 'LineString') return g.coordinates[0];
        return g.coordinates[0][0];
    }

    function ringMessage(code) {
        return {
            E_RING_NOT_CLOSED: 'outline is not closed.',
            E_RING_TOO_FEW_VERTICES: 'outline needs at least 3 corners.',
            E_RING_SELF_INTERSECTION: 'outline crosses itself.',
            E_RING_INVALID_COORDINATE: 'outline has an invalid coordinate.',
            E_RING_NOT_ARRAY: 'outline is malformed.'
        }[code] || code;
    }

    function checkCoordinate(coord, id, report, options) {
        if (!Array.isArray(coord) || coord.length < 2 || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) {
            report.add('error', 'E_COORD_INVALID', `${id}: invalid coordinate ${JSON.stringify(coord)}.`, [id]);
            return false;
        }
        if (options.bbox) {
            const order = geo.classifyCoordinateOrder(coord, options.bbox);
            if (order === 'swapped') {
                report.add('error', 'E_COORD_SWAPPED', `${id}: coordinate looks like [latitude, longitude]; GeoJSON needs [longitude, latitude].`, [id], [coord[1], coord[0]]);
                return false;
            }
            if (order !== 'lnglat') {
                report.add('error', 'E_COORD_OUTSIDE_BBOX', `${id}: coordinate ${JSON.stringify(coord)} is outside the property area.`, [id]);
                return false;
            }
        } else if (!geo.isValidLngLat(coord)) {
            report.add('error', 'E_COORD_INVALID', `${id}: coordinate out of range ${JSON.stringify(coord)}.`, [id]);
            return false;
        }
        return true;
    }

    function checkEnum(props, key, allowed, id, report, { required = true } = {}) {
        const value = props[key];
        if (value === undefined && !required) {
            return true;
        }
        if (!allowed.includes(value)) {
            report.add('error', 'E_SCHEMA_VALUE', `${id}: ${key} must be one of ${allowed.join(', ')} (got ${JSON.stringify(value)}).`, [id]);
            return false;
        }
        return true;
    }

    function checkTriState(props, key, id, report) {
        if (props[key] !== undefined && props[key] !== true && props[key] !== false && props[key] !== null) {
            report.add('error', 'E_SCHEMA_VALUE', `${id}: ${key} must be true, false, or null (unknown).`, [id]);
            return false;
        }
        return true;
    }

    function checkFeatureSchema(feature, type, report, options) {
        const id = feature.id;
        const props = feature.properties;
        const geometry = feature.geometry;
        if (!geometry || geometry.type !== GEOMETRY_BY_TYPE[type]) {
            report.add('error', 'E_SCHEMA', `${id}: ${type} needs ${GEOMETRY_BY_TYPE[type]} geometry.`, [id]);
            return false;
        }

        let coords;
        if (geometry.type === 'Point') {
            coords = [geometry.coordinates];
        } else if (geometry.type === 'LineString') {
            if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
                report.add('error', 'E_SCHEMA', `${id}: line needs at least 2 points.`, [id]);
                return false;
            }
            coords = geometry.coordinates;
        } else {
            if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0 || !geometry.coordinates.every(Array.isArray)) {
                report.add('error', 'E_SCHEMA', `${id}: polygon is malformed.`, [id]);
                return false;
            }
            coords = geometry.coordinates.flat();
        }
        if (!coords.every(coord => checkCoordinate(coord, id, report, options))) {
            return false;
        }

        let ok = checkEnum(props, 'verification', ENUMS.verification, id, report);
        if (type === 'node') {
            ok = checkEnum(props, 'nodeKind', ENUMS.nodeKind, id, report) && ok;
        } else if (type === 'edge') {
            ok = checkEnum(props, 'edgeKind', ENUMS.edgeKind, id, report) && ok;
            ok = checkEnum(props, 'status', ENUMS.status, id, report) && ok;
            ok = checkEnum(props, 'access', ENUMS.access, id, report) && ok;
            ok = checkTriState(props, 'hasSteps', id, report) && ok;
            ok = checkTriState(props, 'curbRamps', id, report) && ok;
            if (props.crossesWithoutConnection !== undefined && !Array.isArray(props.crossesWithoutConnection)) {
                report.add('error', 'E_SCHEMA_VALUE', `${id}: crossesWithoutConnection must be a list of walkway ids.`, [id]);
                ok = false;
            }
        } else if (type === 'area') {
            ok = checkEnum(props, 'areaKind', ENUMS.areaKind, id, report) && ok;
        } else if (type === 'barrier') {
            ok = checkEnum(props, 'barrierKind', ENUMS.barrierKind, id, report) && ok;
        } else if (type === 'start') {
            if (!START_ID_PATTERN.test(id)) {
                report.add('error', 'E_START_ID_INVALID', `${id}: sign IDs use lowercase letters, numbers, and dashes (max 40).`, [id]);
                ok = false;
            }
            ok = checkEnum(props, 'status', ENUMS.startStatus, id, report) && ok;
        } else if (type === 'arrival' && props.driveTo !== undefined && props.driveTo !== null) {
            ok = checkCoordinate(props.driveTo, id, report, options) && ok;
        }
        if ((type === 'start' || type === 'arrival') && (typeof props.label !== 'string' || !props.label.trim())) {
            report.add('error', 'E_SCHEMA_VALUE', `${id}: needs a visitor-facing label.`, [id]);
            ok = false;
        }
        return ok;
    }

    function checkEntrances(nodes, incident, buildings, nodeXY, tolerances, options, report, stats) {
        const entrances = nodes.filter(f => f.properties.nodeKind === 'entrance');
        stats.entrances = entrances.length;
        const seenOffices = new Map();
        const knownOffices = Array.isArray(options.officeIds) ? new Set(options.officeIds) : null;

        if (entrances.length > 0 && buildings.length === 0) {
            report.add('warning', 'W_NO_BUILDINGS', 'No buildings drawn yet; doors cannot be checked against walls.');
        }

        entrances.forEach((node) => {
            const officeId = node.properties.officeId;
            const coord = node.geometry.coordinates;
            if (!officeId) {
                report.add('error', 'E_ENTRANCE_NO_OFFICE', `${node.id}: door is not assigned to an office.`, [node.id], coord);
            } else if (seenOffices.has(officeId)) {
                report.add('error', 'E_ENTRANCE_DUPLICATE_OFFICE', `Office ${officeId} has more than one door (${seenOffices.get(officeId)}, ${node.id}).`, [node.id, seenOffices.get(officeId)], coord);
            } else {
                seenOffices.set(officeId, node.id);
                if (knownOffices && !knownOffices.has(officeId)) {
                    report.add('error', 'E_ENTRANCE_UNKNOWN_OFFICE', `${node.id}: office ${officeId} does not exist.`, [node.id], coord);
                }
            }

            const edgesHere = incident.get(node.id) || [];
            if (edgesHere.length === 0) {
                report.add('warning', 'W_ENTRANCE_NOT_CONNECTED', `Door for ${officeId || node.id} has no walkway.`, [node.id], coord);
            }

            if (buildings.length === 0) {
                return;
            }
            const p = nodeXY(node.id);
            let nearest = null;
            buildings.forEach((building) => {
                const distance = distanceToRingsXY(p, building.rings);
                if (!nearest || distance < nearest.distance) {
                    nearest = { building, distance, inside: pointInPolygonXY(p, building.rings) };
                }
            });
            if (nearest.inside && nearest.distance > tolerances.entranceOnBuildingM) {
                report.add('error', 'E_ENTRANCE_INSIDE_BUILDING', `Door for ${officeId || node.id} is ${nearest.distance.toFixed(1)} m inside ${describe(nearest.building.feature)}.`, [node.id, nearest.building.feature.id], coord);
                return;
            }
            if (nearest.distance > tolerances.entranceOnBuildingM) {
                report.add('error', 'E_ENTRANCE_NOT_ON_BUILDING', `Door for ${officeId || node.id} is ${nearest.distance.toFixed(1)} m from the nearest building wall.`, [node.id], coord);
                return;
            }
            edgesHere.forEach((edge) => {
                const fromEntrance = edge.props.from === node.id ? edge.xy : edge.xy.slice().reverse();
                if (polylineLengthXY(fromEntrance) < tolerances.entranceExteriorProbeM) {
                    return;
                }
                const probe = pointAlongXY(fromEntrance, tolerances.entranceExteriorProbeM);
                if (pointInPolygonXY(probe, nearest.building.rings)) {
                    report.add('error', 'E_ENTRANCE_INTERIOR_APPROACH', `${edge.feature.id} reaches the door for ${officeId || node.id} from inside the building.`, [edge.feature.id, node.id], node.geometry.coordinates);
                }
            });
        });

        if (knownOffices) {
            const missing = [...knownOffices].filter(id => !seenOffices.has(id));
            if (missing.length > 0) {
                report.add('warning', 'W_OFFICES_WITHOUT_DOOR', `${missing.length} office(s) have no door yet: ${missing.join(', ')}.`, []);
            }
        }
    }

    function checkObstacles(edges, buildings, noWalk, parking, boundaries, barriers, nodeXY, tolerances, report) {
        edges.forEach((edge) => {
            const { feature, props, xy, bbox } = edge;
            const startTrim = edge.fromNode.properties.nodeKind === 'entrance' ? tolerances.entranceApproachTrimM : 0;
            const endTrim = edge.toNode.properties.nodeKind === 'entrance' ? tolerances.entranceApproachTrimM : 0;
            const trimmed = trimPolylineXY(xy, startTrim, endTrim);

            if (trimmed) {
                for (const building of buildings) {
                    if (!bboxesOverlap(bbox, building.bbox)) continue;
                    if (polylineHitsRings(trimmed, building.rings) || trimmed.some(p => pointInPolygonXY(p, building.rings))) {
                        report.add('error', 'E_EDGE_CROSSES_BUILDING', `${feature.id} passes through ${describe(building.feature)}.`, [feature.id, building.feature.id], feature.geometry.coordinates[0]);
                        break;
                    }
                }
            }

            for (const zone of noWalk) {
                if (!bboxesOverlap(bbox, zone.bbox)) continue;
                if (polylineHitsRings(xy, zone.rings) || xy.some(p => pointInPolygonXY(p, zone.rings))) {
                    report.add('error', 'E_EDGE_IN_NO_WALK', `${feature.id} enters no-walk area ${describe(zone.feature)}.`, [feature.id, zone.feature.id], feature.geometry.coordinates[0]);
                    break;
                }
            }

            if (boundaries.length > 0) {
                const outside = xy.some(p => !boundaries.some(b => pointInPolygonXY(p, b.rings)))
                    || boundaries.length === 1 && polylineHitsRings(xy, boundaries[0].rings);
                if (outside) {
                    report.add('error', 'E_EDGE_OUTSIDE_BOUNDARY', `${feature.id} leaves the navigation boundary.`, [feature.id], feature.geometry.coordinates[0]);
                }
            }

            if (!PARKING_CROSSING_KINDS.includes(props.edgeKind)) {
                const samples = sampleSegmentsXY(xy, tolerances.parkingSampleStepM);
                for (const lot of parking) {
                    if (!bboxesOverlap(bbox, lot.bbox)) continue;
                    const inside = samples.some(p => pointInPolygonXY(p, lot.rings) && distanceToRingsXY(p, lot.rings) > tolerances.parkingEdgeClearanceM);
                    if (inside) {
                        report.add('error', 'E_PARKING_TRAVERSAL', `${feature.id} (${props.edgeKind}) runs through parking ${describe(lot.feature)}; only crosswalk or parking-crossing walkways may.`, [feature.id, lot.feature.id], feature.geometry.coordinates[0]);
                        break;
                    }
                }
            }

            const gateEnds = [edge.fromNode, edge.toNode].filter(n => n.properties.nodeKind === 'gate');
            for (const barrier of barriers) {
                if (!bboxesOverlap(bbox, barrier.bbox, tolerances.gateOnBarrierM)) continue;
                let blocked = false;
                for (let i = 1; i < xy.length && !blocked; i += 1) {
                    for (let j = 1; j < barrier.xy.length && !blocked; j += 1) {
                        const hit = geo.xy.segmentIntersection(xy[i - 1], xy[i], barrier.xy[j - 1], barrier.xy[j]);
                        if (hit.type === 'none') continue;
                        const throughGate = gateEnds.some((gate) => {
                            const g = nodeXY(gate.id);
                            return Math.hypot(g.x - hit.point.x, g.y - hit.point.y) <= tolerances.gateOnBarrierM;
                        });
                        blocked = !throughGate;
                    }
                }
                if (blocked) {
                    report.add('error', 'E_EDGE_CROSSES_BARRIER', `${feature.id} crosses ${describe(barrier.feature)} without a gate.`, [feature.id, barrier.feature.id], feature.geometry.coordinates[0]);
                }
            }
        });
    }

    function checkGates(gates, barriers, nodeXY, tolerances, report) {
        gates.forEach((gate) => {
            const p = nodeXY(gate.id);
            const onBarrier = barriers.some(b => geo.xy.distanceToPolyline(p, b.xy) <= tolerances.gateOnBarrierM);
            if (!onBarrier) {
                report.add('warning', 'W_GATE_NOT_ON_BARRIER', `Gate ${gate.id} is not on any drawn barrier.`, [gate.id], gate.geometry.coordinates);
            }
        });
    }

    function checkEdgeCrossings(edges, nodeXY, projection, report) {
        for (let a = 0; a < edges.length; a += 1) {
            for (let b = a + 1; b < edges.length; b += 1) {
                const first = edges[a];
                const second = edges[b];
                if (!bboxesOverlap(first.bbox, second.bbox, 0.01)) continue;
                const shared = [first.props.from, first.props.to].filter(id => id === second.props.from || id === second.props.to);
                const acknowledged = (first.props.crossesWithoutConnection || []).includes(second.feature.id)
                    || (second.props.crossesWithoutConnection || []).includes(first.feature.id);
                let reported = false;
                for (let i = 1; i < first.xy.length && !reported; i += 1) {
                    for (let j = 1; j < second.xy.length && !reported; j += 1) {
                        const hit = geo.xy.segmentIntersection(first.xy[i - 1], first.xy[i], second.xy[j - 1], second.xy[j]);
                        if (hit.type === 'none') continue;
                        const atSharedNode = shared.some((id) => {
                            const n = nodeXY(id);
                            return Math.hypot(n.x - hit.point.x, n.y - hit.point.y) <= 0.1;
                        });
                        if (atSharedNode || acknowledged) continue;
                        report.add('error', 'E_UNACKNOWLEDGED_CROSSING', `${first.feature.id} and ${second.feature.id} cross without a junction. Split both at a real junction, or mark them as crossing without a connection.`, [first.feature.id, second.feature.id], projection.toLngLat(hit.point));
                        reported = true;
                    }
                }
            }
        }
    }

    function checkNodeSpacing(nodes, edges, incident, nodeXY, collection, tolerances, report) {
        const placeNodes = new Set(collection.features
            .filter(f => f && f.properties && (f.properties.featureType === 'start' || f.properties.featureType === 'arrival'))
            .map(f => f.properties.nodeId));

        for (let a = 0; a < nodes.length; a += 1) {
            for (let b = a + 1; b < nodes.length; b += 1) {
                const pa = nodeXY(nodes[a].id);
                const pb = nodeXY(nodes[b].id);
                const distance = Math.hypot(pa.x - pb.x, pa.y - pb.y);
                if (distance < tolerances.duplicateNodeM) {
                    report.add('warning', 'W_DUPLICATE_NODE', `Nodes ${nodes[a].id} and ${nodes[b].id} are only ${distance.toFixed(2)} m apart; merge them if they are the same place.`, [nodes[a].id, nodes[b].id], nodes[a].geometry.coordinates);
                }
            }
        }

        nodes.forEach((node) => {
            const degree = (incident.get(node.id) || []).length;
            const kind = node.properties.nodeKind;
            if (degree === 0 && kind !== 'entrance' && !placeNodes.has(node.id)) {
                report.add('warning', 'W_ORPHAN_NODE', `Node ${node.id} has no walkways.`, [node.id], node.geometry.coordinates);
                return;
            }
            if (degree !== 1 || kind === 'entrance' || placeNodes.has(node.id)) {
                return;
            }
            const p = nodeXY(node.id);
            const ownEdge = incident.get(node.id)[0];
            const neighborId = ownEdge.props.from === node.id ? ownEdge.props.to : ownEdge.props.from;
            let nearest = null;
            nodes.forEach((other) => {
                if (other.id === node.id || other.id === neighborId) return;
                const q = nodeXY(other.id);
                const distance = Math.hypot(p.x - q.x, p.y - q.y);
                if (distance < tolerances.nearMissM && (!nearest || distance < nearest.distance)) {
                    nearest = { id: other.id, distance };
                }
            });
            edges.forEach((edge) => {
                if (edge === ownEdge) return;
                const distance = geo.xy.distanceToPolyline(p, edge.xy);
                if (distance < tolerances.nearMissM && (!nearest || distance < nearest.distance)) {
                    nearest = { id: edge.feature.id, distance };
                }
            });
            if (nearest) {
                report.add('warning', 'W_NEAR_MISS', `Dead end ${node.id} is ${nearest.distance.toFixed(1)} m from ${nearest.id} but not connected. Connect it only if people can really walk between them.`, [node.id, nearest.id], node.geometry.coordinates);
            }
        });
    }

    function checkConnectivity(byType, valid, edges, incident, report, stats) {
        const parent = new Map();
        const find = (id) => {
            while (parent.get(id) !== id) {
                parent.set(id, parent.get(parent.get(id)));
                id = parent.get(id);
            }
            return id;
        };
        edges.forEach((edge) => {
            [edge.props.from, edge.props.to].forEach(id => { if (!parent.has(id)) parent.set(id, id); });
            const rootA = find(edge.props.from);
            const rootB = find(edge.props.to);
            if (rootA !== rootB) parent.set(rootA, rootB);
        });
        const components = new Map();
        parent.forEach((_, id) => {
            const rootId = find(id);
            if (!components.has(rootId)) components.set(rootId, []);
            components.get(rootId).push(id);
        });
        stats.components = components.size;
        if (components.size > 1) {
            const sorted = [...components.values()].sort((a, b) => b.length - a.length);
            sorted.slice(1).forEach((members) => {
                const node = byType.node.find(f => f.id === members[0]);
                report.add('warning', 'W_DISCONNECTED_COMPONENT', `${members.length} node(s) are not connected to the main walkway network (e.g. ${members[0]}).`, members.slice(0, 20), node ? node.geometry.coordinates : null);
            });
        }

        const usable = edges.filter(e => e.props.status === 'open' && e.props.access === 'public');
        const notFieldVerified = edges.filter(e => e.props.verification !== 'field-verified').length;
        if (notFieldVerified > 0) {
            report.add('warning', 'W_NOT_FIELD_VERIFIED', `${notFieldVerified} of ${edges.length} walkway(s) are not field-verified yet; they cannot be published.`);
        }
        const unknownAccess = edges.filter(e => e.props.access === 'unknown').length;
        if (unknownAccess > 0) {
            report.add('warning', 'W_UNKNOWN_ACCESS', `${unknownAccess} walkway(s) have unknown access and will not be used for routes.`);
        }

        const activeStarts = byType.start.filter(f => valid.has(f.id) && f.properties.status === 'active');
        const entrances = byType.node.filter(f => valid.has(f.id) && f.properties.nodeKind === 'entrance');
        if (activeStarts.length === 0) {
            if (entrances.length > 0) {
                report.add('warning', 'W_NO_STARTS', 'No active QR sign starts yet, so door reachability cannot be checked.');
            }
            return;
        }

        const adjacency = new Map();
        usable.forEach((edge) => {
            [[edge.props.from, edge.props.to], [edge.props.to, edge.props.from]].forEach(([a, b]) => {
                if (!adjacency.has(a)) adjacency.set(a, []);
                adjacency.get(a).push(b);
            });
        });
        const reached = new Set(activeStarts.map(f => f.properties.nodeId));
        const queue = [...reached];
        while (queue.length > 0) {
            const current = queue.shift();
            (adjacency.get(current) || []).forEach((next) => {
                if (!reached.has(next)) {
                    reached.add(next);
                    queue.push(next);
                }
            });
        }
        entrances.forEach((node) => {
            if (!reached.has(node.id)) {
                report.add('warning', 'W_ENTRANCE_UNREACHABLE', `Door for ${node.properties.officeId || node.id} cannot be reached from any QR sign using open public walkways.`, [node.id], node.geometry.coordinates);
            }
        });
    }

    function finish(report, stats) {
        const errors = report.issues.filter(issue => issue.severity === 'error');
        const warnings = report.issues.filter(issue => issue.severity === 'warning');
        return { ok: errors.length === 0, errors, warnings, stats };
    }

    return {
        SCHEMA_VERSION,
        ENUMS,
        DEFAULT_TOLERANCES,
        validateNetworkDraft
    };
});
