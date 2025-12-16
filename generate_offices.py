import json
import math
import re

def calculate_distance(lat1, lng1, lat2, lng2):
    R = 6371e3 # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = math.sin(delta_phi/2) * math.sin(delta_phi/2) + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda/2) * math.sin(delta_lambda/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c

def calculate_heading(lat1, lng1, lat2, lng2):
    d_lng = math.radians(lng2 - lng1)
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    
    y = math.sin(d_lng) * math.cos(lat2_rad)
    x = math.cos(lat1_rad) * math.sin(lat2_rad) - \
        math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(d_lng)
    
    bearing = math.atan2(y, x) * 180 / math.pi
    return (bearing + 360) % 360

def parse_coordinate_file(content):
    coords = []
    # Matches (lat, lng) or lat, lng patterns
    matches = re.finditer(r'\(?\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\)?', content)
    for match in matches:
        coords.append({
            'lat': float(match.group(1)),
            'lng': float(match.group(2))
        })
    return coords

def parse_entrances_file(content):
    lines = [line.strip() for line in content.split('\n') if line.strip()]
    entrances = []
    
    for line in lines:
        # Regex to capture Name and lat, lng
        # "Firmus Medical, LLC 41.750732234024795, -87.93782490440809"
        match = re.match(r'^(.*?)\s+(-?\d+\.\d+),\s*(-?\d+\.\d+)\s*$', line)
        
        if match:
            entrances.append({
                'name': match.group(1).strip(),
                'lat': float(match.group(2)),
                'lng': float(match.group(3))
            })
        else:
            print(f"Failed to parse line: {line}")
    print(f"Parsed {len(entrances)} entrances.")
    return entrances

def find_nearest(target, points):
    min_dist = float('inf')
    nearest = None
    
    for point in points:
        dist = calculate_distance(target['lat'], target['lng'], point['lat'], point['lng'])
        if dist < min_dist:
            min_dist = dist
            nearest = point
    return nearest

def generate():
    print("Starting generation...")
    try:
        # Read files
        with open('new_office_locations.json', 'r', encoding='utf-8-sig') as f:
            content = f.read()
            # Fix trailing commas
            content = re.sub(r',\s*}', '}', content)
            content = re.sub(r',\s*]', ']', content)
            office_locations_raw = json.loads(content)
        
        with open('new_office_building_entrances', 'r', encoding='utf-8') as f:
            entrances_raw = f.read()
            
        with open('sidewalk_locations.txt', 'r', encoding='utf-8') as f:
            sidewalks_raw = f.read()
            
        with open('panorama_gps_locations.txt', 'r', encoding='utf-8') as f:
            panoramas_raw = f.read()

        # Parse data
        office_locations = office_locations_raw['offices']
        all_entrances = parse_entrances_file(entrances_raw)
        sidewalk_points = parse_coordinate_file(sidewalks_raw)
        panorama_points = parse_coordinate_file(panoramas_raw)

        # Map entrances to offices
        entrances_by_name = {}
        for ent in all_entrances:
            if ent['name'] not in entrances_by_name:
                entrances_by_name[ent['name']] = []
            entrances_by_name[ent['name']].append(ent)

        new_offices = []
        lifetime_processed_count = 0

        for office in office_locations:
            office_name = office['name']
            office_entrances = entrances_by_name.get(office_name, [])

            # Special handling for Lifetime Restoration
            if office_name == "Lifetime Restoration, Inc.":
                if office_entrances:
                    # Sort by distance to this specific office icon location
                    office_entrances.sort(key=lambda x: calculate_distance(office['lat'], office['lng'], x['lat'], x['lng']))
                    
                    # Take closest
                    closest = office_entrances[0]
                    
                    if lifetime_processed_count == 0:
                        office['unit'] = "608"
                    else:
                        office['unit'] = "624"
                    lifetime_processed_count += 1
                    
                    office_entrances = [closest]
            
            if not office_entrances:
                print(f"Warning: No entrances found for {office_name}. Using office location.")
                office_entrances = [{'lat': office['lat'], 'lng': office['lng']}]

            processed_entrances = []
            for ent in office_entrances:
                # 1. Nearest sidewalk
                nearest_sidewalk = find_nearest(ent, sidewalk_points)
                if not nearest_sidewalk:
                    # Fallback if no sidewalk points (unlikely given file)
                    nearest_sidewalk = ent
                
                # 2. Nearest panorama to sidewalk
                nearest_panorama = find_nearest(nearest_sidewalk, panorama_points)
                if not nearest_panorama:
                    nearest_panorama = nearest_sidewalk

                # 3. Path
                walking_path = [
                    nearest_panorama,
                    nearest_sidewalk,
                    {'lat': ent['lat'], 'lng': ent['lng']}
                ]

                # 4. Heading
                heading = calculate_heading(nearest_panorama['lat'], nearest_panorama['lng'], ent['lat'], ent['lng'])

                processed_entrances.append({
                    'lat': ent['lat'],
                    'lng': ent['lng'],
                    'walkingPath': walking_path,
                    'panorama': {
                        'provider': 'google',
                        'lat': nearest_panorama['lat'],
                        'lng': nearest_panorama['lng'],
                        'heading': heading,
                        'pitch': 0,
                        'radius': 60
                    }
                })

            office['entrances'] = processed_entrances
            new_offices.append(office)

        output = {
            "buildingCenter": {
                "lat": 41.750197,
                "lng": -87.937808,
                "name": "Willowbrook Office Building"
            },
            "offices": new_offices
        }

        with open('offices.json', 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2)
            
        print(f"Successfully generated offices.json with {len(new_offices)} offices.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    generate()

