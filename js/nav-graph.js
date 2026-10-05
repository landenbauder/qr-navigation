// Walking graph and shortest-path routing. Pure functions: no DOM, no network.
// Cost = metric length along the full edge geometry (always >= 0), so Dijkstra is exact.
// Coordinates are GeoJSON order: [longitude, latitude].
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./nav-geo.js'));
    } else {
        root.QRNavCore = root.QRNavCore || {};
        root.QRNavCore.graph = factory(root.QRNavCore.geo);
    }
})(typeof self !== 'undefined' ? self : this, function (geo) {
    'use strict';

    const VERIFICATION_RANK = { unverified: 0, 'imagery-reviewed': 1, 'owner-confirmed': 2, 'field-verified': 3 };
    const DEFAULTS = {
        walkingSpeedMps: 1.2, // Estimate for display only; tune from field walks.
        maxAttachM: 30,
        minVerification: 'imagery-reviewed'
    };

    const MESSAGES = {
        'data-unavailable': 'Walking directions are not available right now.',
        'start-invalid': 'That starting point could not be used.',
        'start-not-on-network': 'That starting point is not close enough to a mapped walkway.',
        'start-blocked': 'That starting point cannot be connected to a walkway without crossing a building. Choose a sign instead.',
        'destination-unavailable': 'Directions to this office are being updated.',
        'destination-disconnected': 'No mapped walkway reaches this office yet.',
        'no-open-path': 'There is no open walking route from here to this office.'
    };

    function pathLength(coords) {
        let total = 0;
        for (let index = 1; index < coords.length; index += 1) {
            total += geo.haversineMeters(coords[index - 1], coords[index]);
        }
        return total;
    }

    function dedupe(coords) {
        return coords.filter((coord, index) => index === 0
            || coord[0] !== coords[index - 1][0] || coord[1] !== coords[index - 1][1]);
    }

    function fail(reason) {
        return { ok: false, reason, message: MESSAGES[reason] || MESSAGES['data-unavailable'] };
    }

    // Binary min-heap ordered by cost, then id for deterministic ties.
    class MinHeap {
        constructor() {
            this.items = [];
        }

        less(a, b) {
            return a.cost < b.cost || (a.cost === b.cost && a.id < b.id);
        }

        push(item) {
            const items = this.items;
            items.push(item);
            let index = items.length - 1;
            while (index > 0) {
                const parent = (index - 1) >> 1;
                if (!this.less(items[index], items[parent])) break;
                [items[index], items[parent]] = [items[parent], items[index]];
                index = parent;
            }
        }

        pop() {
            const items = this.items;
            if (items.length === 0) return null;
            const top = items[0];
            const last = items.pop();
            if (items.length > 0) {
                items[0] = last;
                let index = 0;
                for (;;) {
                    const left = index * 2 + 1;
                    const right = left + 1;
                    let smallest = index;
                    if (left < items.length && this.less(items[left], items[smallest])) smallest = left;
                    if (right < items.length && this.less(items[right], items[smallest])) smallest = right;
                    if (smallest === index) break;
                    [items[index], items[smallest]] = [items[smallest], items[index]];
                    index = smallest;
                }
            }
            return top;
        }

        get size() {
            return this.items.length;
        }
    }

    function rankOf(verification, allowSynthetic) {
        if (verification === 'synthetic') return allowSynthetic ? 3 : -1;
        const rank = VERIFICATION_RANK[verification];
        return rank === undefined ? -1 : rank;
    }

    // Only open, public, sufficiently verified edges become routable; everything else is recorded in `skipped`.
    function buildGraph(collection, options = {}) {
        const minVerification = options.minVerification || DEFAULTS.minVerification;
        if (VERIFICATION_RANK[minVerification] === undefined) {
            throw new Error(`Unknown minVerification "${minVerification}"`);
        }
        const minRank = VERIFICATION_RANK[minVerification];
        const graph = {
            minVerification,
            nodes: new Map(),
            edges: new Map(),
            adjacency: new Map(),
            doors: new Map(),
            starts: [],
            skipped: [],
            projection: null,
            walkingSpeedMps: options.walkingSpeedMps || DEFAULTS.walkingSpeedMps
        };
        if (!collection || !Array.isArray(collection.features)) {
            return graph;
        }

        const features = collection.features.filter(f => f && f.properties && typeof f.id === 'string');
        features.filter(f => f.properties.featureType === 'node').forEach((feature) => {
            if (geo.isValidLngLat(feature.geometry && feature.geometry.coordinates)) {
                graph.nodes.set(feature.id, { id: feature.id, coord: feature.geometry.coordinates.slice(), props: feature.properties });
                if (feature.properties.nodeKind === 'entrance' && feature.properties.officeId) {
                    graph.doors.set(feature.properties.officeId, feature.id);
                }
            }
        });

        features.filter(f => f.properties.featureType === 'edge').forEach((feature) => {
            const props = feature.properties;
            const coords = feature.geometry && feature.geometry.coordinates;
            if (!Array.isArray(coords) || coords.length < 2 || !coords.every(geo.isValidLngLat)) {
                graph.skipped.push({ id: feature.id, reason: 'invalid-geometry' });
                return;
            }
            if (!graph.nodes.has(props.from) || !graph.nodes.has(props.to)) {
                graph.skipped.push({ id: feature.id, reason: 'dangling-reference' });
                return;
            }
            if (props.status !== 'open') {
                graph.skipped.push({ id: feature.id, reason: 'not-open' });
                return;
            }
            if (props.access !== 'public') {
                graph.skipped.push({ id: feature.id, reason: 'not-public' });
                return;
            }
            if (rankOf(props.verification, options.allowSynthetic) < minRank) {
                graph.skipped.push({ id: feature.id, reason: 'not-verified-enough' });
                return;
            }
            const edge = { id: feature.id, from: props.from, to: props.to, coords: coords.map(c => c.slice()), lengthM: pathLength(coords), props };
            graph.edges.set(edge.id, edge);
            [[edge.from, edge.to, false], [edge.to, edge.from, true]].forEach(([a, b, reversed]) => {
                if (!graph.adjacency.has(a)) graph.adjacency.set(a, []);
                graph.adjacency.get(a).push({ edge, to: b, reversed });
            });
        });

        features.filter(f => f.properties.featureType === 'start' && f.properties.status === 'active').forEach((feature) => {
            if (geo.isValidLngLat(feature.geometry && feature.geometry.coordinates)) {
                graph.starts.push({ id: feature.id, label: feature.properties.label, lngLat: feature.geometry.coordinates.slice() });
            }
        });

        const first = graph.edges.values().next().value;
        graph.projection = first ? geo.createLocalProjection(first.coords[0]) : null;
        return graph;
    }

    // Only a proper crossing blocks a connector; touching a wall at a door or walkway end does not.
    function connectorBlocked(from, to, rings, projection) {
        for (const ring of rings) {
            for (let index = 1; index < ring.length; index += 1) {
                if (geo.segmentIntersectionType(from, to, ring[index - 1], ring[index], projection) === 'cross') {
                    return true;
                }
            }
        }
        return false;
    }

    // Connects an arbitrary point to the nearest reachable walkway point. It never joins across an obstacle:
    // candidates whose straight connector would cross one are skipped in favour of the next-nearest.
    function attachPoint(graph, lngLat, options = {}) {
        if (!geo.isValidLngLat(lngLat)) return fail('start-invalid');
        if (!graph || !graph.projection || graph.edges.size === 0) return fail('data-unavailable');
        const maxM = Number.isFinite(options.maxAttachM) ? options.maxAttachM : DEFAULTS.maxAttachM;
        const obstacles = Array.isArray(options.obstacles) ? options.obstacles : [];
        const projection = graph.projection;

        if (obstacles.some(ring => geo.pointInRing(lngLat, ring, projection))) {
            return fail('start-blocked');
        }

        const candidates = [];
        graph.edges.forEach((edge) => {
            const near = geo.nearestPointOnPolyline(lngLat, edge.coords, projection);
            if (near.distanceM <= maxM) candidates.push({ edge, near });
        });
        if (candidates.length === 0) return fail('start-not-on-network');
        candidates.sort((a, b) => a.near.distanceM - b.near.distanceM || (a.edge.id < b.edge.id ? -1 : 1));

        for (const { edge, near } of candidates) {
            if (obstacles.length > 0 && connectorBlocked(lngLat, near.coord, obstacles, projection)) {
                continue;
            }
            const toFrom = dedupe([near.coord, ...edge.coords.slice(0, near.segmentIndex + 1).reverse()]);
            const toTo = dedupe([near.coord, ...edge.coords.slice(near.segmentIndex + 1)]);
            return {
                ok: true,
                edgeId: edge.id,
                snap: near.coord,
                connectorM: near.distanceM,
                sources: [
                    { nodeId: edge.from, cost: near.distanceM + pathLength(toFrom), geometry: toFrom },
                    { nodeId: edge.to, cost: near.distanceM + pathLength(toTo), geometry: toTo }
                ]
            };
        }
        return fail('start-blocked');
    }

    function dijkstra(graph, sources, targetId) {
        const best = new Map();
        const previous = new Map();
        const origin = new Map();
        const heap = new MinHeap();
        sources.forEach((source) => {
            if (!best.has(source.nodeId) || source.cost < best.get(source.nodeId)) {
                best.set(source.nodeId, source.cost);
                origin.set(source.nodeId, source);
                previous.delete(source.nodeId);
                heap.push({ id: source.nodeId, cost: source.cost });
            }
        });

        const settled = new Set();
        while (heap.size > 0) {
            const { id, cost } = heap.pop();
            if (settled.has(id)) continue;
            settled.add(id);
            if (id === targetId) break;
            (graph.adjacency.get(id) || []).forEach((link) => {
                const next = cost + link.edge.lengthM;
                if (!best.has(link.to) || next < best.get(link.to)) {
                    best.set(link.to, next);
                    previous.set(link.to, { from: id, link });
                    origin.delete(link.to);
                    heap.push({ id: link.to, cost: next });
                }
            });
        }

        if (!settled.has(targetId)) return null;
        const links = [];
        let cursor = targetId;
        while (previous.has(cursor)) {
            const step = previous.get(cursor);
            links.unshift(step.link);
            cursor = step.from;
        }
        return { source: origin.get(cursor), links, cost: best.get(targetId) };
    }

    function findRoute(graph, startLngLat, destinationNodeId, options = {}) {
        if (!graph || graph.edges.size === 0) return fail('data-unavailable');
        if (!graph.nodes.has(destinationNodeId)) return fail('destination-unavailable');
        if (!graph.adjacency.has(destinationNodeId)) return fail('destination-disconnected');

        const attachment = attachPoint(graph, startLngLat, options);
        if (!attachment.ok) return attachment;

        const result = dijkstra(graph, attachment.sources, destinationNodeId);
        if (!result) return fail('no-open-path');

        const coords = [startLngLat.slice()];
        if (attachment.connectorM > 0.05) coords.push(attachment.snap);
        coords.push(...result.source.geometry);
        result.links.forEach((link) => {
            coords.push(...(link.reversed ? link.edge.coords.slice().reverse() : link.edge.coords));
        });
        const route = dedupe(coords);
        const lengthM = pathLength(route);
        return {
            ok: true,
            coords: route,
            lengthM,
            estimatedSeconds: lengthM / graph.walkingSpeedMps,
            connectorM: attachment.connectorM,
            edgeIds: [attachment.edgeId, ...result.links.map(link => link.edge.id)],
            destinationNodeId
        };
    }

    return {
        VERIFICATION_RANK,
        DEFAULTS,
        MESSAGES,
        pathLength,
        buildGraph,
        attachPoint,
        findRoute,
        describeFailure: reason => MESSAGES[reason] || MESSAGES['data-unavailable']
    };
});
