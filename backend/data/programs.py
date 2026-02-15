programs = [
    {
        "id": "urban_bird_census",
        "title": "Urban Bird Census 2026",
        "organization": "Audubon Society",
        "category": "Biodiversity",
        "description": "Track bird populations in urban areas to measure the impact of green infrastructure on avian biodiversity. Volunteers use a standardized checklist to record species, counts, and habitat types.",
        "location": "Nationwide",
        "participants": 2340,
        "data_points": 58200,
        "status": "active",
        "tags": ["Birds", "Urban Ecology", "Biodiversity"],
        "deadline": "Dec 2026",
        "contribution_spec": {
            "accepted_files": ["image", "csv"],
            "fields": [
                {"name": "species", "type": "STRING", "required": True, "description": "Species name"},
                {"name": "latitude", "type": "FLOAT", "required": True, "description": "Latitude"},
                {"name": "longitude", "type": "FLOAT", "required": True, "description": "Longitude"},
                {"name": "observed_on", "type": "DATE", "required": True, "description": "Observation date"},
                {"name": "count", "type": "INT", "required": True, "description": "Number observed"},
            ],
        },
    },
]
