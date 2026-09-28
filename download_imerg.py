import os
import earthaccess
 
# 1. Authenticate with NASA Earthdata
# On the first run, it will prompt you in the terminal for your Earthdata login:
# Username/Email: khushpatel200612@gmail.com
# Password: <your-nasa-earthdata-password>
# earthaccess will cache your credentials locally in a .netrc file.
auth = earthaccess.login(persist=True)
 
if not auth.authenticated:
    print("Authentication failed. Please verify your Earthdata credentials.")
    exit(1)
 
# Bounding box format: (lower_left_lon, lower_left_lat, upper_right_lon, upper_right_lat)
# Coordinates from requirement: 30°N–36°N, 74°E–82°E
BOUNDING_BOX = (74.0, 30.0, 82.0, 36.0)
 
# Dataset short name for IMERG Final Run Half-Hourly V07
SHORT_NAME = "GPM_3IMERGHH"
VERSION = "07"
 
# 2. Define the two target datasets and their output paths
tasks = [
    {
        "name": "Leh 2010 Event",
        "folder": "data/imerg_halfhourly/leh_2010_08_05",
        "temporal": ("2010-08-05 00:00:00", "2010-08-06 06:00:00"),
    },
    {
        "name": "Leh 2011 Event",
        "folder": "data/imerg_halfhourly/leh_2011_07_25",
        "temporal": ("2011-07-25 00:00:00", "2011-07-25 18:00:00"),
    },
]
 
# 3. Search and Download
for task in tasks:
    print(f"\n==========================================")
    print(f"Searching granules for: {task['name']}")
    print(f"Target folder: {task['folder']}")
    print(f"Temporal range: {task['temporal']}")
    print(f"==========================================")
 
    # Ensure destination directory exists inside the project
    os.makedirs(task["folder"], exist_ok=True)
 
    results = earthaccess.search_data(
        short_name=SHORT_NAME,
        version=VERSION,
        bounding_box=BOUNDING_BOX,
        temporal=task["temporal"],
    )
 
    print(f"Found {len(results)} files for {task['name']}.")
 
    if results:
        downloaded_files = earthaccess.download(
            results,
            local_path=task["folder"],
        )
        print(f"Finished downloading {len(downloaded_files)} files to {task['folder']}/")
    else:
        print("No files matched the query parameters.")