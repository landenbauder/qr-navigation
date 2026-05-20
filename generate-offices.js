/**
 * Office Data Generator
 *
 * Generates offices.json from the source data files in this repository.
 */

const fs = require('fs');

const DEFAULT_BUILDING_CENTER = {
    lat: 41.750197,
    lng: -87.937808,
    name: 'Willowbrook Office Building'
};

function readTextFile(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function isValidCoordinate(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng);
}

function normalizeOfficeName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/\s*\(\s*unit\s+[^\)]+\)\s*$/i, '')
        .replace(/[^a-z0-9]/g, '');
}

function parseCoordinatePairs(filePath) {
    const content = readTextFile(filePath);
    const matches = content.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g);
    const points = [];

    for (const match of matches) {
        const lat = Number(match[1]);
        const lng = Number(match[2]);
        if (isValidCoordinate(lat, lng)) {
            points.push({ lat, lng });
        }
    }

    if (points.length === 0) {
        throw new Error(`No coordinate pairs found in ${filePath}`);
    }

    return points;
}

function parseOfficeLocations(filePath) {
    const content = readTextFile(filePath);
    const data = JSON.parse(content);

    if (!data || !Array.isArray(data.offices)) {
        throw new Error(`Invalid office locations file: ${filePath}`);
    }

    const officeLocations = {};

    for (const office of data.offices) {
        const lat = Number(office.lat);
        const lng = Number(office.lng);
        if (!office.name || !isValidCoordinate(lat, lng)) {
            throw new Error(`Invalid office location entry for ${office.name || 'unknown office'}`);
        }

        officeLocations[office.name] = { lat, lng };
    }

    return officeLocations;
}

function parseBuildingEntrances(filePath) {
    const lines = readTextFile(filePath)
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const entrances = [];
    const linePattern = /^(.*?)\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;

    for (const line of lines) {
        const match = line.match(linePattern);
        if (!match) {
            throw new Error(`Invalid entrance line: ${line}`);
        }

        const lat = Number(match[2]);
        const lng = Number(match[3]);
        if (!isValidCoordinate(lat, lng)) {
            throw new Error(`Invalid entrance coordinates for ${match[1]}`);
        }

        entrances.push({ name: match[1], lat, lng });
    }

    return entrances;
}

function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const nextChar = line[index + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current.trim());
    return values;
}

function parseUnitMap(filePath) {
    const lines = readTextFile(filePath)
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        throw new Error(`Unit CSV is empty: ${filePath}`);
    }

    const header = parseCsvLine(lines[0]);
    const nameIndex = header.indexOf('lease_name');
    const unitIndex = header.indexOf('unit_number');

    if (nameIndex === -1 || unitIndex === -1) {
        throw new Error(`Unit CSV is missing required headers: ${filePath}`);
    }

    const unitMap = new Map();

    for (const line of lines.slice(1)) {
        const columns = parseCsvLine(line);
        const leaseName = columns[nameIndex];
        const unitNumber = columns[unitIndex];

        if (!leaseName || !unitNumber) {
            continue;
        }

        unitMap.set(normalizeOfficeName(leaseName), unitNumber);
    }

    return unitMap;
}

// ============== Helper Functions ==============

/**
 * Calculate distance between two points using Haversine formula
 * @returns distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

/**
 * Calculate heading/bearing between two points
 * @returns bearing in degrees (0-360)
 */
function calculateHeading(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

/**
 * Find nearest point from a list of points
 */
function findNearest(targetLat, targetLng, points) {
    let nearest = null;
    let minDistance = Infinity;
    
    for (const point of points) {
        const distance = calculateDistance(targetLat, targetLng, point.lat, point.lng);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = point;
        }
    }
    
    return { point: nearest, distance: minDistance };
}

/**
 * Calculate centroid of multiple points
 */
function calculateCentroid(points) {
    if (points.length === 0) return null;
    
    let sumLat = 0;
    let sumLng = 0;
    
    for (const point of points) {
        sumLat += point.lat;
        sumLng += point.lng;
    }
    
    return {
        lat: sumLat / points.length,
        lng: sumLng / points.length
    };
}

function buildPathForEntrance(entrance, sidewalkLocations, panoramaLocations) {
    const nearestSidewalk = findNearest(entrance.lat, entrance.lng, sidewalkLocations);
    const nearestPanorama = findNearest(nearestSidewalk.point.lat, nearestSidewalk.point.lng, panoramaLocations);

    return {
        entrance,
        sidewalk: nearestSidewalk.point,
        panorama: nearestPanorama.point,
        walkingPath: [
            { lat: nearestPanorama.point.lat, lng: nearestPanorama.point.lng },
            { lat: nearestSidewalk.point.lat, lng: nearestSidewalk.point.lng },
            { lat: entrance.lat, lng: entrance.lng }
        ]
    };
}

// ============== Main Processing ==============

function generateOffices({ panoramaLocations, sidewalkLocations, buildingEntrances, officeIconLocations, unitMap }) {
    const entrancesByOffice = {};

    for (const entrance of buildingEntrances) {
        if (!entrancesByOffice[entrance.name]) {
            entrancesByOffice[entrance.name] = [];
        }
        entrancesByOffice[entrance.name].push({ lat: entrance.lat, lng: entrance.lng });
    }

    const offices = [];

    for (const [officeName, entrances] of Object.entries(entrancesByOffice)) {
        let iconLocation = officeIconLocations[officeName];
        if (!iconLocation) {
            iconLocation = calculateCentroid(entrances);
            console.log(`Calculated centroid for ${officeName}: ${iconLocation.lat}, ${iconLocation.lng}`);
        }

        const unit = unitMap.get(normalizeOfficeName(officeName));
        if (!unit) {
            throw new Error(`Missing unit mapping for ${officeName}`);
        }

        const entrancePlans = entrances.map(entrance => buildPathForEntrance(entrance, sidewalkLocations, panoramaLocations));
        const primaryPlan = entrancePlans[0];

        const heading = calculateHeading(
            primaryPlan.panorama.lat,
            primaryPlan.panorama.lng,
            primaryPlan.entrance.lat,
            primaryPlan.entrance.lng
        );

        const office = {
            name: officeName,
            unit,
            lat: iconLocation.lat,
            lng: iconLocation.lng,
            panorama: {
                provider: 'google',
                lat: primaryPlan.panorama.lat,
                lng: primaryPlan.panorama.lng,
                heading: Math.round(heading),
                pitch: 0,
                radius: 60
            },
            walkingPath: primaryPlan.walkingPath
        };

        if (entrances.length > 1) {
            office.entrances = entrances;
            office.walkingPathsByEntrance = Object.fromEntries(
                entrancePlans.map((plan, index) => [String(index), plan.walkingPath])
            );
        }

        offices.push(office);

        console.log(`Processed: ${officeName}`);
        console.log(`  Icon: ${iconLocation.lat}, ${iconLocation.lng}`);
        console.log(`  Unit: ${unit}`);
        console.log(`  Panorama: ${primaryPlan.panorama.lat}, ${primaryPlan.panorama.lng}`);
        console.log(`  Sidewalk: ${primaryPlan.sidewalk.lat}, ${primaryPlan.sidewalk.lng}`);
        console.log(`  Heading: ${Math.round(heading)}°`);
        console.log(`  Entrances: ${entrances.length}`);
        console.log('');
    }

    offices.sort((left, right) => {
        const leftUnit = Number(left.unit);
        const rightUnit = Number(right.unit);
        if (Number.isFinite(leftUnit) && Number.isFinite(rightUnit) && leftUnit !== rightUnit) {
            return leftUnit - rightUnit;
        }
        return left.name.localeCompare(right.name);
    });

    return offices;
}

function readBuildingCenter() {
    try {
        const existingContent = readTextFile('offices.json');
        const existingData = JSON.parse(existingContent);
        return existingData.buildingCenter || DEFAULT_BUILDING_CENTER;
    } catch (error) {
        return DEFAULT_BUILDING_CENTER;
    }
}

const panoramaLocations = parseCoordinatePairs('panorama_gps_locations.txt');
const sidewalkLocations = parseCoordinatePairs('sidewalk_locations.txt');
const buildingEntrances = parseBuildingEntrances('new_office_building_entrances');
const officeIconLocations = parseOfficeLocations('new_office_locations.json');
const unitMap = parseUnitMap('tenant-units-from-pdf.csv');

const newOffices = generateOffices({
    panoramaLocations,
    sidewalkLocations,
    buildingEntrances,
    officeIconLocations,
    unitMap
});

const outputData = {
    buildingCenter: readBuildingCenter(),
    offices: newOffices
};

try {
    fs.writeFileSync('offices.json', JSON.stringify(outputData, null, 2));
    console.log(`\nGenerated offices.json with ${newOffices.length} offices total`);
} catch (error) {
    console.error(`Failed to write offices.json: ${error.message}`);
    process.exitCode = 1;
}
