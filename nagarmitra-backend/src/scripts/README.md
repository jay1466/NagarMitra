# Mock Data Generation Scripts

This directory contains scripts to generate realistic mock data for testing the NagarMitra application, particularly the heatmap functionality.

## generateMockData.js

A comprehensive script to generate mock complaint data for heatmap visualization testing.

### Features

- **Realistic Data**: Generates complaints with realistic categories, statuses, priorities, and descriptions
- **Geographic Distribution**: Places data points within Bhubaneswar city bounds
- **Hotspot Areas**: Creates concentrated complaint areas around major landmarks
- **Time-based Status**: Generates realistic status progression based on creation dates
- **Cleanup Function**: Ability to remove all mock data

### Usage

```bash
# Navigate to backend directory
cd nagarmitra-backend

# Generate 100 mock complaints (default)
npm run mock-generate

# Generate 200 mock complaints
npm run mock-generate 200

# Generate hotspot areas with concentrated complaints
npm run mock-hotspots

# Full setup: cleanup + generate regular data + hotspots
npm run mock-full 150

# Clean up all mock data
npm run mock-cleanup
```

### Available Commands

| Command | Description |
|---------|-------------|
| `mock-generate [count]` | Generate regular mock complaints |
| `mock-hotspots` | Generate concentrated complaints in hotspot areas |
| `mock-full [count]` | Complete setup: cleanup + generate + hotspots |
| `mock-cleanup` | Remove all mock data |

### Hotspot Locations

The script creates concentrated complaint areas around these major Bhubaneswar landmarks:

- **Kalpana Square** (High intensity: 15-35 complaints)
- **Station Square** (Medium intensity: 8-23 complaints)  
- **Patia** (High intensity: 15-35 complaints)
- **Chandrasekharpur** (Medium intensity: 8-23 complaints)
- **Nayapalli** (Low intensity: 3-13 complaints)

### Data Categories

- Potholes
- Sanitation
- Waste Management
- Water Supply
- Electricity & Lighting
- Miscellaneous

### Status Distribution

- **Recent complaints** (<2 days): Mostly 'submitted' or 'acknowledged'
- **Weekly complaints** (2-7 days): Mix of all statuses
- **Monthly complaints** (7-30 days): Mostly 'in_progress' or 'resolved'
- **Older complaints** (>30 days): Mostly 'resolved'

### Priority Distribution

- Critical: 10%
- High: 15%
- Medium: 60%
- Low: 15%

### Database Requirements

- MongoDB connection (configured via MONGODB_URI environment variable)
- Complaint model with proper schema

### Notes

- Mock data is identified by reportId pattern: `NM-WARD##-YYYYMMDD-####`
- Coordinates are within Bhubaneswar city bounds
- All mock data is marked as public and verified
- Cleanup function uses regex pattern to identify mock data safely

### Frontend Integration

The frontend DashboardScreen also includes additional mock data generation for enhanced heatmap visualization without requiring backend changes. This includes:

- 8 hotspot areas around Bhubaneswar
- 50 additional scattered data points
- Realistic coordinate distribution within city bounds