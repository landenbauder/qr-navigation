/**
 * Office Data Generator
 * 
 * This script processes the input data files and generates the offices.json
 * with calculated walking paths, panorama locations, and headings.
 */

const fs = require('fs');

// ============== Input Data ==============

// Panorama GPS locations from panorama_gps_locations.txt
const panoramaLocations = [
    { lat: 41.7511194, lng: -87.9379323 },
    { lat: 41.750734, lng: -87.938074 },
    { lat: 41.7505959, lng: -87.9383613 },
    { lat: 41.7505913, lng: -87.9385998 },
    { lat: 41.7505951, lng: -87.9388395 },
    { lat: 41.7503311, lng: -87.939071 },
    { lat: 41.7501557, lng: -87.9390648 },
    { lat: 41.7499133, lng: -87.9383599 },
    { lat: 41.7499151, lng: -87.9381163 },
    { lat: 41.7499172, lng: -87.9376287 },
    { lat: 41.7503195, lng: -87.9371575 },
    { lat: 41.7505893, lng: -87.9371618 },
    { lat: 41.7509454, lng: -87.9371685 }
];

// Sidewalk locations from sidewalk_locations.txt
const sidewalkLocations = [
    { lat: 41.750445923674235, lng: -87.9386316210123 },
    { lat: 41.750365520430144, lng: -87.938629747798 },
    { lat: 41.75031197517248, lng: -87.93852274374395 },
    { lat: 41.75032979431038, lng: -87.93831995112046 },
    { lat: 41.75035165357097, lng: -87.93823567379341 },
    { lat: 41.750367983166406, lng: -87.93813921914038 },
    { lat: 41.75042804258351, lng: -87.93799083941116 },
    { lat: 41.75047325035494, lng: -87.9379069720579 },
    { lat: 41.75063241588521, lng: -87.93791285977184 },
    { lat: 41.75050647368678, lng: -87.93790865688118 },
    { lat: 41.75064434500341, lng: -87.93790871435489 },
    { lat: 41.750689050964624, lng: -87.93790808981116 },
    { lat: 41.75080103413551, lng: -87.93787531453482 },
    { lat: 41.75088607570387, lng: -87.93784600469861 },
    { lat: 41.75092046629779, lng: -87.93783978333184 },
    { lat: 41.75104540367769, lng: -87.93783009569648 },
    { lat: 41.750979881791054, lng: -87.93782764943904 },
    { lat: 41.75100649196475, lng: -87.93783089838844 },
    { lat: 41.751052946886105, lng: -87.93782710994861 },
    { lat: 41.75062977670847, lng: -87.93755200302425 },
    { lat: 41.75047133883866, lng: -87.93761708598252 },
    { lat: 41.750351783994866, lng: -87.937624572321 },
    { lat: 41.75023136042119, lng: -87.93754627804522 },
    { lat: 41.75004652104912, lng: -87.93774352444832 },
    { lat: 41.750035315943144, lng: -87.93870902584237 },
    { lat: 41.75005406114093, lng: -87.93893635645779 },
    { lat: 41.75023484528061, lng: -87.93893971865157 },
    { lat: 41.750331764642524, lng: -87.93894030809467 },
    { lat: 41.75049621594158, lng: -87.93890021744136 },
    { lat: 41.75034620493217, lng: -87.93863273701585 }
];

// Building entrances from new_office_building_entrances
const buildingEntrances = [
    { name: "Firmus Medical, LLC", lat: 41.750732234024795, lng: -87.93782490440809 },
    { name: "Advanced Physicians, SC", lat: 41.75091151786369, lng: -87.93774959455097 },
    { name: "Advanced Physicians, SC", lat: 41.750910198631985, lng: -87.93750238104288 },
    { name: "Precise Bioscience, LLC", lat: 41.75105449411903, lng: -87.93775206372628 },
    { name: "Precise Bioscience, LLC", lat: 41.75105136724749, lng: -87.93750584390918 },
    { name: "Ecodrive, Inc.", lat: 41.75080586913622, lng: -87.93782966730564 },
    { name: "Firmus Medical, LLC", lat: 41.75073166442561, lng: -87.9378235955908 },
    { name: "Firmus Medical, LLC", lat: 41.75076925924362, lng: -87.937576371582 },
    { name: "Donnelly Transportation, Inc.", lat: 41.750601873157436, lng: -87.93782359652893 },
    { name: "Henrich Electronics Corporation", lat: 41.750623885117584, lng: -87.9375746756993 },
    { name: "Charland, LLC", lat: 41.75050024575575, lng: -87.93763306554625 },
    { name: "Charland, LLC", lat: 41.75050163842362, lng: -87.93789059631246 },
    { name: "Thomas Murphy", lat: 41.750462265609734, lng: -87.93764724280851 },
    { name: "Perform Technologies, Inc.", lat: 41.75036020568787, lng: -87.93762971599958 },
    { name: "Perform Technologies, Inc.", lat: 41.750345172837974, lng: -87.9378900740968 },
    { name: "Shahid Khwaja", lat: 41.75030795495643, lng: -87.93788651518841 },
    { name: "SFUSA", lat: 41.750331356400984, lng: -87.93764202219648 },
    { name: "Airtex Manufacturing Inc.", lat: 41.75022785236671, lng: -87.93755539583547 },
    { name: "Airtex Manufacturing Inc.", lat: 41.75005177898899, lng: -87.93773303928613 },
    { name: "Syndem, LLC", lat: 41.750062045203144, lng: -87.93777526876156 },
    { name: "Clean Slate, Inc.", lat: 41.7502426935211, lng: -87.93779071170579 },
    { name: "Lifetime Restoration, Inc. (Unit 608)", lat: 41.75005758372081, lng: -87.93793661490287 },
    { name: "John Devae Insurance Agency, Inc.", lat: 41.750241481857415, lng: -87.93794284863885 },
    { name: "Donald E. Morris Architect, PC", lat: 41.75023932447109, lng: -87.93798513810351 },
    { name: "Redwood Construction Group LLC", lat: 41.75024166605386, lng: -87.93810643467737 },
    { name: "Equitec Group LLC", lat: 41.7502413146349, lng: -87.93814273176567 },
    { name: "Armond Cozzi", lat: 41.75023913053949, lng: -87.93834800614171 },
    { name: "The Forest Electric Company", lat: 41.75023670187888, lng: -87.93849439390733 },
    { name: "Lifetime Restoration, Inc. (Unit 624)", lat: 41.750236162629214, lng: -87.93851952320344 },
    { name: "Nightingale Home Healthcare of Illinois, Inc.", lat: 41.75004975419288, lng: -87.93869447638328 },
    { name: "Green Home Makeover, LLC", lat: 41.75005620420816, lng: -87.93889915239004 },
    { name: "Envirotest Perry Labs, Inc.", lat: 41.750220103388344, lng: -87.93890116392828 },
    { name: "Jay Building Group, LLC", lat: 41.750049517397905, lng: -87.93869642771517 },
    { name: "Jay Building Group, LLC", lat: 41.75023403155062, lng: -87.93870921767343 },
    { name: "Law Office of Robert J. Chio", lat: 41.750322613780995, lng: -87.93890340427834 },
    { name: "The Best Veneer Company LLC", lat: 41.75033974786989, lng: -87.9389043549276 },
    { name: "Troop Contracting, Inc.", lat: 41.75047508768822, lng: -87.93889530946517 },
    { name: "Troop Contracting, Inc.", lat: 41.750477501546996, lng: -87.93867110104341 },
    { name: "Troop Contracting, Inc.", lat: 41.75034001148625, lng: -87.93866092702801 }
];

// Office icon locations from new_office_locations.json
const officeIconLocations = {
    "Firmus Medical, LLC": { lat: 41.750736, lng: -87.937705 },
    "Donnelly Transportation, Inc.": { lat: 41.750599, lng: -87.937755 },
    "Henrich Electronics Corporation": { lat: 41.750595, lng: -87.937635 },
    "Charland, LLC": { lat: 41.750521, lng: -87.937774 },
    "Thomas Murphy": { lat: 41.750450, lng: -87.937711 },
    "Perform Technologies, Inc.": { lat: 41.750379, lng: -87.937771 },
    "Shahid Khwaja": { lat: 41.750312, lng: -87.937817 },
    "SFUSA": { lat: 41.750312, lng: -87.937718 },
    "Airtex Manufacturing Inc.": { lat: 41.750162, lng: -87.937614 },
    "Syndem, LLC": { lat: 41.750109, lng: -87.937680 },
    "Lifetime Restoration, Inc. (Unit 608)": { lat: 41.750105, lng: -87.937768 },
    "Clean Slate, Inc.": { lat: 41.750188, lng: -87.937774 },
    "John Devae Insurance Agency, Inc.": { lat: 41.750151, lng: -87.937897 },
    "Donald E. Morris Architect, PC": { lat: 41.750150, lng: -87.937977 },
    "Redwood Construction Group LLC": { lat: 41.750153, lng: -87.938083 },
    "Equitec Group LLC": { lat: 41.750150, lng: -87.938168 },
    "Armond Cozzi": { lat: 41.750185, lng: -87.938375 },
    "The Forest Electric Company": { lat: 41.750143, lng: -87.938458 },
    "Lifetime Restoration, Inc. (Unit 624)": { lat: 41.750142, lng: -87.938557 },
    "Nightingale Home Healthcare of Illinois, Inc.": { lat: 41.750097, lng: -87.938663 },
    "Green Home Makeover, LLC": { lat: 41.750098, lng: -87.938846 },
    "Envirotest Perry Labs, Inc.": { lat: 41.7501802267786, lng: -87.93884586603167 },
    "Jay Building Group, LLC": { lat: 41.75014513538613, lng: -87.9387571728452 },
    "Law Office of Robert J. Chio": { lat: 41.750302, lng: -87.938853 },
    "The Best Veneer Company LLC": { lat: 41.750370, lng: -87.938831 },
    "Troop Contracting, Inc.": { lat: 41.750408, lng: -87.938720 }
};

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

// ============== Main Processing ==============

function generateOffices() {
    // Group entrances by office name
    const entrancesByOffice = {};
    
    for (const entrance of buildingEntrances) {
        if (!entrancesByOffice[entrance.name]) {
            entrancesByOffice[entrance.name] = [];
        }
        entrancesByOffice[entrance.name].push({ lat: entrance.lat, lng: entrance.lng });
    }
    
    // Generate office data
    const offices = [];
    
    for (const [officeName, entrances] of Object.entries(entrancesByOffice)) {
        // Get icon location (from predefined or calculate centroid)
        let iconLocation = officeIconLocations[officeName];
        if (!iconLocation) {
            // Calculate centroid of entrances for offices not in the predefined list
            iconLocation = calculateCentroid(entrances);
            console.log(`Calculated centroid for ${officeName}: ${iconLocation.lat}, ${iconLocation.lng}`);
        }
        
        // Use the first entrance as the primary reference for path calculation
        const primaryEntrance = entrances[0];
        
        // Find nearest sidewalk point to the primary entrance
        const nearestSidewalk = findNearest(primaryEntrance.lat, primaryEntrance.lng, sidewalkLocations);
        
        // Find nearest panorama to that sidewalk point
        const nearestPanorama = findNearest(nearestSidewalk.point.lat, nearestSidewalk.point.lng, panoramaLocations);
        
        // Calculate heading from panorama toward entrance
        const heading = calculateHeading(
            nearestPanorama.point.lat, 
            nearestPanorama.point.lng,
            primaryEntrance.lat,
            primaryEntrance.lng
        );
        
        // Build walking path: panorama -> sidewalk -> entrance
        const walkingPath = [
            { lat: nearestPanorama.point.lat, lng: nearestPanorama.point.lng },
            { lat: nearestSidewalk.point.lat, lng: nearestSidewalk.point.lng },
            { lat: primaryEntrance.lat, lng: primaryEntrance.lng }
        ];
        
        // Extract unit number if present in name
        let unit = null;
        const unitMatch = officeName.match(/\(Unit (\d+)\)/);
        if (unitMatch) {
            unit = unitMatch[1];
        }
        
        const office = {
            name: officeName,
            lat: iconLocation.lat,
            lng: iconLocation.lng,
            panorama: {
                provider: "google",
                lat: nearestPanorama.point.lat,
                lng: nearestPanorama.point.lng,
                heading: Math.round(heading),
                pitch: 0,
                radius: 60
            },
            walkingPath: walkingPath
        };
        
        // Add unit if present
        if (unit) {
            office.unit = unit;
        }
        
        // Add entrances array if multiple entrances exist
        if (entrances.length > 1) {
            office.entrances = entrances;
        }
        
        offices.push(office);
        
        console.log(`Processed: ${officeName}`);
        console.log(`  Icon: ${iconLocation.lat}, ${iconLocation.lng}`);
        console.log(`  Panorama: ${nearestPanorama.point.lat}, ${nearestPanorama.point.lng} (distance: ${nearestPanorama.distance.toFixed(1)}m)`);
        console.log(`  Sidewalk: ${nearestSidewalk.point.lat}, ${nearestSidewalk.point.lng} (distance: ${nearestSidewalk.distance.toFixed(1)}m)`);
        console.log(`  Heading: ${Math.round(heading)}°`);
        console.log(`  Entrances: ${entrances.length}`);
        console.log('');
    }
    
    // Sort offices by name for consistency
    offices.sort((a, b) => a.name.localeCompare(b.name));
    
    return offices;
}

// Generate and save
const newOffices = generateOffices();

// Read existing offices.json to preserve TRP Investments
let existingData = { buildingCenter: { lat: 41.750197, lng: -87.937808, name: "Willowbrook Office Building" }, offices: [] };
try {
    const existingContent = fs.readFileSync('offices.json', 'utf8');
    existingData = JSON.parse(existingContent);
} catch (e) {
    console.log('Could not read existing offices.json, creating new one');
}

// Combine existing offices with new ones
const allOffices = [...existingData.offices, ...newOffices];

const outputData = {
    buildingCenter: existingData.buildingCenter,
    offices: allOffices
};

fs.writeFileSync('offices.json', JSON.stringify(outputData, null, 2));
console.log(`\nGenerated offices.json with ${allOffices.length} offices total`);
console.log(`  - Existing offices: ${existingData.offices.length}`);
console.log(`  - New offices: ${newOffices.length}`);
