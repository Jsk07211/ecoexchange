export interface Program {
  id: string
  title: string
  organization: string
  category: string
  description: string
  location: string
  participants: number
  dataPoints: number
  status: "active" | "upcoming" | "completed"
  tags: string[]
  deadline?: string
}

export interface Dataset {
  id: string
  title: string
  program: string
  organization: string
  category: string
  records: number
  format: string
  license: string
  lastUpdated: string
  qualityScore: number
  downloads: number
  description: string
  tags: string[]
}

export const programs: Program[] = [
  {
    id: "p1",
    title: "Urban Bird Census 2026",
    organization: "Audubon Society",
    category: "Biodiversity",
    description:
      "Track bird populations in urban areas to measure the impact of green infrastructure on avian biodiversity. Volunteers use a standardized checklist to record species, counts, and habitat types.",
    location: "Nationwide",
    participants: 2340,
    dataPoints: 58200,
    status: "active",
    tags: ["Birds", "Urban Ecology", "Biodiversity"],
    deadline: "Dec 2026",
  },
  {
    id: "p2",
    title: "Freshwater Quality Monitoring",
    organization: "River Network",
    category: "Water Quality",
    description:
      "Measure dissolved oxygen, pH, nitrate, and turbidity at local stream sites. Data feeds regional water quality models used by state agencies.",
    location: "Pacific Northwest",
    participants: 870,
    dataPoints: 24100,
    status: "active",
    tags: ["Water", "Chemistry", "Streams"],
    deadline: "Ongoing",
  },
  {
    id: "p3",
    title: "Pollinator Habitat Survey",
    organization: "Xerces Society",
    category: "Biodiversity",
    description:
      "Document pollinator species and flowering plants along transect routes. Helps identify critical habitat corridors for conservation planning.",
    location: "Midwest US",
    participants: 1560,
    dataPoints: 41300,
    status: "active",
    tags: ["Pollinators", "Habitat", "Plants"],
  },
  {
    id: "p4",
    title: "Community Air Quality Network",
    organization: "Clean Air Alliance",
    category: "Air Quality",
    description:
      "Deploy low-cost PM2.5 and ozone sensors at community sites. Calibrated against regulatory monitors to produce research-grade data.",
    location: "California",
    participants: 450,
    dataPoints: 182000,
    status: "active",
    tags: ["Air Quality", "Sensors", "PM2.5"],
  },
  {
    id: "p5",
    title: "Coastal Erosion Watch",
    organization: "NOAA Partnership",
    category: "Climate",
    description:
      "Photograph and measure shoreline positions at fixed benchmarks. Long-term dataset supports sea-level-rise adaptation planning.",
    location: "Eastern Seaboard",
    participants: 310,
    dataPoints: 9800,
    status: "upcoming",
    tags: ["Coastal", "Erosion", "Sea Level"],
    deadline: "Mar 2026",
  },
  {
    id: "p6",
    title: "Urban Heat Island Mapping",
    organization: "City Climate Lab",
    category: "Climate",
    description:
      "Measure street-level temperatures across urban neighborhoods during heat events using standardized thermometers and GPS coordinates.",
    location: "Phoenix, AZ",
    participants: 680,
    dataPoints: 15400,
    status: "active",
    tags: ["Heat", "Urban", "Temperature"],
  },
]

export const datasets: Dataset[] = [
  {
    id: "d1",
    title: "North American Bird Observations 2024-2025",
    program: "Urban Bird Census",
    organization: "Audubon Society",
    category: "Biodiversity",
    records: 58200,
    format: "CSV",
    license: "CC BY 4.0",
    lastUpdated: "2026-01-15",
    qualityScore: 94,
    downloads: 1280,
    description:
      "Standardized bird observation records from 2,300+ volunteers across urban areas in North America. Includes species ID, count, GPS coordinates, habitat type, and weather conditions.",
    tags: ["Birds", "Urban", "Biodiversity"],
  },
  {
    id: "d2",
    title: "Pacific NW Stream Chemistry Dataset",
    program: "Freshwater Quality Monitoring",
    organization: "River Network",
    category: "Water Quality",
    records: 24100,
    format: "CSV",
    license: "CC BY-SA 4.0",
    lastUpdated: "2026-02-01",
    qualityScore: 91,
    downloads: 540,
    description:
      "Water chemistry measurements from 120 stream sites across Oregon and Washington. Parameters: dissolved oxygen, pH, nitrate, phosphate, turbidity, temperature.",
    tags: ["Water", "Chemistry", "Streams"],
  },
  {
    id: "d3",
    title: "Midwest Pollinator Transect Data",
    program: "Pollinator Habitat Survey",
    organization: "Xerces Society",
    category: "Biodiversity",
    records: 41300,
    format: "GeoJSON",
    license: "CC0 1.0",
    lastUpdated: "2025-11-20",
    qualityScore: 88,
    downloads: 920,
    description:
      "Pollinator observations along 300+ transect routes in Midwest US. Includes species, behavior, plant association, GPS track, and photo verification status.",
    tags: ["Pollinators", "Habitat", "Geospatial"],
  },
  {
    id: "d4",
    title: "California PM2.5 Sensor Network Readings",
    program: "Community Air Quality Network",
    organization: "Clean Air Alliance",
    category: "Air Quality",
    records: 182000,
    format: "JSON",
    license: "ODbL 1.0",
    lastUpdated: "2026-02-10",
    qualityScore: 96,
    downloads: 2100,
    description:
      "Hourly PM2.5 and ozone readings from 45 community sensor sites across California. Calibrated against EPA regulatory monitors with quality flags.",
    tags: ["Air Quality", "Sensors", "Time Series"],
  },
  {
    id: "d5",
    title: "Eastern Seaboard Shoreline Measurements",
    program: "Coastal Erosion Watch",
    organization: "NOAA Partnership",
    category: "Climate",
    records: 9800,
    format: "CSV",
    license: "Public Domain",
    lastUpdated: "2025-09-30",
    qualityScore: 92,
    downloads: 340,
    description:
      "Shoreline position measurements from 85 fixed benchmarks along the US East Coast. Includes photo documentation, GPS coordinates, and tidal conditions.",
    tags: ["Coastal", "Erosion", "Geospatial"],
  },
  {
    id: "d6",
    title: "Phoenix Urban Temperature Grid 2025",
    program: "Urban Heat Island Mapping",
    organization: "City Climate Lab",
    category: "Climate",
    records: 15400,
    format: "CSV",
    license: "CC BY 4.0",
    lastUpdated: "2025-10-15",
    qualityScore: 89,
    downloads: 670,
    description:
      "Street-level temperature measurements during 12 heat events in metro Phoenix. Includes time, GPS, land cover type, shade status, and surface temperature.",
    tags: ["Heat", "Urban", "Temperature"],
  },
]

export const categories = [
  "All",
  "Biodiversity",
  "Water Quality",
  "Air Quality",
  "Climate",
]

export const statuses = ["All", "Active", "Upcoming", "Completed"]
