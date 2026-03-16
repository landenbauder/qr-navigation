---
name: add-office
description: "Add a new office to the QR Navigation system with entrance coordinates and data pipeline processing."
agent: agent
---
# Add New Office

## Office Details
${input:name:Office/business name}
${input:entrance:Entrance GPS coordinates (lat, lng)}
${input:unit:Unit/suite number (if applicable)}

Add this office to the navigation system:

1. **Validate** the GPS coordinates are valid decimal degrees
2. **Add entrance** to `new_office_building_entrances` in the format: `Office Name lat, lng`
3. **Add icon location** to `new_office_locations.json` with the office name and coordinates
4. **Run** `node generate-offices.js` to regenerate `offices.json`
5. **Verify** the new entry appears in `offices.json` with valid `panorama`, `walkingPath`, and `unit` fields
6. **Report** the total office count before and after

If the office has multiple entrances, add each entrance on a separate line in `new_office_building_entrances`.
