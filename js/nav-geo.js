// Geometry helpers for property walking navigation.
// Coordinates are GeoJSON order: [longitude, latitude] in WGS84 degrees.
(function (root, factory) {
    const geo = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = geo;
    } else {
        root.QRNavCore = root.QRNavCore || {};
        root.QRNavCore.geo = geo;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Mean Earth radius (IUGG). Spherical error is well under 0.5% at property scale.
    const EARTH_RADIUS_M = 6371008.8;
    const DEG_TO_RAD = Math.PI / 180;

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function isValidLngLat(coord) {
        return Array.isArray(coord)
            && coord.length >= 2
            && isFiniteNumber(coord[0])
            && isFiniteNumber(coord[1])
            && coord[0] >= -180 && coord[0] <= 180
            && coord[1] >= -90 && coord[1] <= 90;
    }

    function assertLngLat(coord, label = 'coordinate') {
        if (!isValidLngLat(coord)) {
            throw new TypeError(`Invalid ${label}: expected [longitude, latitude], got ${JSON.stringify(coord)}`);
        }
    }

    function latLngObjectToLngLat(point) {
        if (!point || !isFiniteNumber(point.lat) || !isFiniteNumber(point.lng)) {
            return null;
        }
        return [point.lng, point.lat];
    }

    function lngLatToLatLngObject(coord) {
        if (!isValidLngLat(coord)) {
            return null;
        }
        return { lat: coord[1], lng: coord[0] };
    }

    function haversineMeters(a, b) {
        assertLngLat(a, 'start');
        assertLngLat(b, 'end');
        const phi1 = a[1] * DEG_TO_RAD;
        const phi2 = b[1] * DEG_TO_RAD;
        const dPhi = (b[1] - a[1]) * DEG_TO_RAD;
        const dLambda = (b[0] - a[0]) * DEG_TO_RAD;
        const h = Math.sin(dPhi / 2) ** 2
            + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
        return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }

    // Local equirectangular projection to meters around an origin; suitable for areas under a few km.
    function createLocalProjection(origin) {
        assertLngLat(origin, 'projection origin');
        const originLng = origin[0];
        const originLat = origin[1];
        const cosLat = Math.cos(originLat * DEG_TO_RAD);

        return {
            origin: [originLng, originLat],
            toXY(coord) {
                assertLngLat(coord);
                return {
                    x: (coord[0] - originLng) * DEG_TO_RAD * EARTH_RADIUS_M * cosLat,
                    y: (coord[1] - originLat) * DEG_TO_RAD * EARTH_RADIUS_M
                };
            },
            toLngLat(point) {
                return [
                    originLng + point.x / (EARTH_RADIUS_M * cosLat * DEG_TO_RAD),
                    originLat + point.y / (EARTH_RADIUS_M * DEG_TO_RAD)
                ];
            }
        };
    }

    function polylineLengthMeters(coords) {
        if (!Array.isArray(coords) || coords.length < 2) {
            throw new TypeError('A polyline needs at least two coordinates');
        }
        let total = 0;
        for (let index = 1; index < coords.length; index += 1) {
            total += haversineMeters(coords[index - 1], coords[index]);
        }
        return total;
    }

    function projectionFor(coords, projection) {
        return projection || createLocalProjection(coords[0]);
    }

    function closestPointOnSegmentXY(p, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared === 0
            ? 0
            : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
        return { x: a.x + t * dx, y: a.y + t * dy, t };
    }

    function pointToSegmentDistanceMeters(point, segmentStart, segmentEnd, projection = null) {
        const proj = projectionFor([segmentStart], projection);
        const p = proj.toXY(point);
        const closest = closestPointOnSegmentXY(p, proj.toXY(segmentStart), proj.toXY(segmentEnd));
        return Math.hypot(p.x - closest.x, p.y - closest.y);
    }

    function pointToPolylineDistanceMeters(point, coords, projection = null) {
        return nearestPointOnPolyline(point, coords, projection).distanceM;
    }

    // Returns { coord, segmentIndex, distanceM, distanceAlongM } for the closest location on the polyline.
    function nearestPointOnPolyline(point, coords, projection = null) {
        if (!Array.isArray(coords) || coords.length < 2) {
            throw new TypeError('A polyline needs at least two coordinates');
        }
        const proj = projectionFor(coords, projection);
        const p = proj.toXY(point);
        let best = null;
        let travelled = 0;
        for (let index = 1; index < coords.length; index += 1) {
            const a = proj.toXY(coords[index - 1]);
            const b = proj.toXY(coords[index]);
            const closest = closestPointOnSegmentXY(p, a, b);
            const distance = Math.hypot(p.x - closest.x, p.y - closest.y);
            const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
            if (!best || distance < best.distanceM) {
                best = {
                    coord: proj.toLngLat(closest),
                    segmentIndex: index - 1,
                    distanceM: distance,
                    distanceAlongM: travelled + closest.t * segmentLength
                };
            }
            travelled += segmentLength;
        }
        return best;
    }

    function orientation(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    function onSegment(a, b, p, epsilon) {
        return Math.min(a.x, b.x) - epsilon <= p.x && p.x <= Math.max(a.x, b.x) + epsilon
            && Math.min(a.y, b.y) - epsilon <= p.y && p.y <= Math.max(a.y, b.y) + epsilon;
    }

    // Planar segments in meters. Returns { type: 'none' | 'cross' | 'touch', point }, where 'cross'
    // means the interiors cross and 'touch' means endpoint contact or collinear overlap.
    function segmentIntersectionXY(p1, p2, q1, q2, epsilonMeters = 1e-6) {
        const d1 = orientation(q1, q2, p1);
        const d2 = orientation(q1, q2, p2);
        const d3 = orientation(p1, p2, q1);
        const d4 = orientation(p1, p2, q2);
        const scaleP = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
        const scaleQ = Math.hypot(q2.x - q1.x, q2.y - q1.y) || 1;
        const s1 = Math.abs(d1) / scaleQ <= epsilonMeters ? 0 : Math.sign(d1);
        const s2 = Math.abs(d2) / scaleQ <= epsilonMeters ? 0 : Math.sign(d2);
        const s3 = Math.abs(d3) / scaleP <= epsilonMeters ? 0 : Math.sign(d3);
        const s4 = Math.abs(d4) / scaleP <= epsilonMeters ? 0 : Math.sign(d4);

        if (s1 * s2 < 0 && s3 * s4 < 0) {
            const t = d1 / (d1 - d2);
            return { type: 'cross', point: { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) } };
        }

        if (s1 === 0 && onSegment(q1, q2, p1, epsilonMeters)) return { type: 'touch', point: { x: p1.x, y: p1.y } };
        if (s2 === 0 && onSegment(q1, q2, p2, epsilonMeters)) return { type: 'touch', point: { x: p2.x, y: p2.y } };
        if (s3 === 0 && onSegment(p1, p2, q1, epsilonMeters)) return { type: 'touch', point: { x: q1.x, y: q1.y } };
        if (s4 === 0 && onSegment(p1, p2, q2, epsilonMeters)) return { type: 'touch', point: { x: q2.x, y: q2.y } };

        return { type: 'none', point: null };
    }

    function segmentIntersectionType(a1, a2, b1, b2, projection = null, epsilonMeters = 1e-6) {
        const proj = projectionFor([a1], projection);
        return segmentIntersectionXY(proj.toXY(a1), proj.toXY(a2), proj.toXY(b1), proj.toXY(b2), epsilonMeters).type;
    }

    function pointInRingXY(p, xy) {
        let inside = false;
        for (let i = 0, j = xy.length - 1; i < xy.length; j = i, i += 1) {
            const a = xy[i];
            const b = xy[j];
            if ((a.y > p.y) !== (b.y > p.y)
                && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) {
                inside = !inside;
            }
        }
        return inside;
    }

    function distanceToPolylineXY(p, xy) {
        let best = Infinity;
        for (let index = 1; index < xy.length; index += 1) {
            const closest = closestPointOnSegmentXY(p, xy[index - 1], xy[index]);
            best = Math.min(best, Math.hypot(p.x - closest.x, p.y - closest.y));
        }
        return best;
    }

    function ringWithoutClosure(ring) {
        if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) {
            return ring.slice(0, -1);
        }
        return ring;
    }

    // Even-odd ray cast in projected meters. Points exactly on the boundary may return either value;
    // callers that care must check boundary distance separately.
    function pointInRing(point, ring, projection = null) {
        const vertices = ringWithoutClosure(ring);
        if (vertices.length < 3) {
            return false;
        }
        const proj = projectionFor(vertices, projection);
        return pointInRingXY(proj.toXY(point), vertices.map(coord => proj.toXY(coord)));
    }

    // GeoJSON Polygon coordinates: [outerRing, ...holes].
    function pointInPolygon(point, polygonCoords, projection = null) {
        if (!Array.isArray(polygonCoords) || polygonCoords.length === 0) {
            return false;
        }
        const proj = projectionFor(polygonCoords[0], projection);
        if (!pointInRing(point, polygonCoords[0], proj)) {
            return false;
        }
        return !polygonCoords.slice(1).some(hole => pointInRing(point, hole, proj));
    }

    function distanceToRingBoundaryMeters(point, ring, projection = null) {
        const proj = projectionFor(ring, projection);
        const closed = ringWithoutClosure(ring).concat([ring[0]]);
        return pointToPolylineDistanceMeters(point, closed, proj);
    }

    // Validates a single GeoJSON linear ring. Returns a list of issue codes (empty when valid).
    function validateRing(ring, projection = null) {
        const issues = [];
        if (!Array.isArray(ring)) {
            return ['E_RING_NOT_ARRAY'];
        }
        if (!ring.every(isValidLngLat)) {
            return ['E_RING_INVALID_COORDINATE'];
        }
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (ring.length < 2 || first[0] !== last[0] || first[1] !== last[1]) {
            issues.push('E_RING_NOT_CLOSED');
        }
        const vertices = ringWithoutClosure(ring);
        if (vertices.length < 3) {
            issues.push('E_RING_TOO_FEW_VERTICES');
            return issues;
        }

        const proj = projectionFor(vertices, projection);
        const count = vertices.length;
        for (let i = 0; i < count; i += 1) {
            const a1 = vertices[i];
            const a2 = vertices[(i + 1) % count];
            for (let j = i + 1; j < count; j += 1) {
                const adjacent = j === i + 1 || (i === 0 && j === count - 1);
                if (adjacent) {
                    continue;
                }
                const b1 = vertices[j];
                const b2 = vertices[(j + 1) % count];
                if (segmentIntersectionType(a1, a2, b1, b2, proj) !== 'none') {
                    issues.push('E_RING_SELF_INTERSECTION');
                    return issues;
                }
            }
        }
        return issues;
    }

    // bbox: [minLng, minLat, maxLng, maxLat]
    function bboxContains(bbox, coord) {
        return coord[0] >= bbox[0] && coord[0] <= bbox[2] && coord[1] >= bbox[1] && coord[1] <= bbox[3];
    }

    // Detects swapped [lat, lng] input using the property bounding box; a range check alone
    // cannot catch it because many longitudes are valid latitudes.
    function classifyCoordinateOrder(coord, bbox) {
        if (!Array.isArray(coord) || coord.length < 2 || !isFiniteNumber(coord[0]) || !isFiniteNumber(coord[1])) {
            return 'invalid';
        }
        if (isValidLngLat(coord) && bboxContains(bbox, coord)) {
            return 'lnglat';
        }
        const swapped = [coord[1], coord[0]];
        if (isValidLngLat(swapped) && bboxContains(bbox, swapped)) {
            return 'swapped';
        }
        return 'outside';
    }

    function bearingDegrees(from, to) {
        assertLngLat(from, 'start');
        assertLngLat(to, 'end');
        const phi1 = from[1] * DEG_TO_RAD;
        const phi2 = to[1] * DEG_TO_RAD;
        const dLambda = (to[0] - from[0]) * DEG_TO_RAD;
        const y = Math.sin(dLambda) * Math.cos(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
        return (Math.atan2(y, x) / DEG_TO_RAD + 360) % 360;
    }

    return {
        EARTH_RADIUS_M,
        isValidLngLat,
        latLngObjectToLngLat,
        lngLatToLatLngObject,
        haversineMeters,
        createLocalProjection,
        polylineLengthMeters,
        pointToSegmentDistanceMeters,
        pointToPolylineDistanceMeters,
        nearestPointOnPolyline,
        segmentIntersectionType,
        pointInRing,
        pointInPolygon,
        distanceToRingBoundaryMeters,
        validateRing,
        bboxContains,
        classifyCoordinateOrder,
        bearingDegrees,
        xy: {
            closestPointOnSegment: closestPointOnSegmentXY,
            segmentIntersection: segmentIntersectionXY,
            pointInRing: pointInRingXY,
            distanceToPolyline: distanceToPolylineXY
        }
    };
});
