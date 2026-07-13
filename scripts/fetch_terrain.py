import math
import os
import json
import requests
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed

Image.MAX_IMAGE_PIXELS = None

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)

def num2deg(xtile, ytile, zoom):
    n = 2.0 ** zoom
    lon_deg = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
    lat_deg = math.degrees(lat_rad)
    return (lat_deg, lon_deg)

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2) * math.sin(dlat/2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dlon/2) * math.sin(dlon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

center_lat = 37.5846
center_lon = 36.9272
dem_zoom = 13
sat_zoom = 17

radius = 3
center_dem_x, center_dem_y = deg2num(center_lat, center_lon, dem_zoom)
dem_min_x = center_dem_x - radius
dem_max_x = center_dem_x + radius
dem_min_y = center_dem_y - radius
dem_max_y = center_dem_y + radius

factor = 2 ** (sat_zoom - dem_zoom)
sat_min_x = dem_min_x * factor
sat_max_x = (dem_max_x + 1) * factor - 1
sat_min_y = dem_min_y * factor
sat_max_y = (dem_max_y + 1) * factor - 1

max_lat_bound, min_lon_bound = num2deg(dem_min_x, dem_min_y, dem_zoom)
min_lat_bound, max_lon_bound = num2deg(dem_max_x + 1, dem_max_y + 1, dem_zoom)

width_m = haversine(center_lat, min_lon_bound, center_lat, max_lon_bound)
height_m = haversine(min_lat_bound, center_lon, max_lat_bound, center_lon)

sat_url_template = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
dem_url_template = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

total_dem_x = dem_max_x - dem_min_x + 1
total_dem_y = dem_max_y - dem_min_y + 1
dem_img = Image.new('RGB', (total_dem_x * 256, total_dem_y * 256))

total_sat_x = sat_max_x - sat_min_x + 1
total_sat_y = sat_max_y - sat_min_y + 1
sat_img = Image.new('RGB', (total_sat_x * 256, total_sat_y * 256))

def download_tile(x, y, is_sat):
    z = sat_zoom if is_sat else dem_zoom
    url = sat_url_template.format(z=z, x=x, y=y) if is_sat else dem_url_template.format(z=z, x=x, y=y)
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            return (x, y, is_sat, resp.content)
    except Exception:
        pass
    return (x, y, is_sat, None)

tasks = []
with ThreadPoolExecutor(max_workers=30) as executor:
    for x in range(dem_min_x, dem_max_x + 1):
        for y in range(dem_min_y, dem_max_y + 1):
            tasks.append(executor.submit(download_tile, x, y, False))
            
    for x in range(sat_min_x, sat_max_x + 1):
        for y in range(sat_min_y, sat_max_y + 1):
            tasks.append(executor.submit(download_tile, x, y, True))
            
    import io
    for future in as_completed(tasks):
        x, y, is_sat, content = future.result()
        if content:
            img = Image.open(io.BytesIO(content)).convert('RGB')
            if is_sat:
                px = (x - sat_min_x) * 256
                py = (y - sat_min_y) * 256
                sat_img.paste(img, (px, py))
            else:
                px = (x - dem_min_x) * 256
                py = (y - dem_min_y) * 256
                dem_img.paste(img, (px, py))

public_dir = "./public"
os.makedirs(public_dir, exist_ok=True)
sat_img.save(os.path.join(public_dir, "texture.jpg"), quality=90)

pixels = dem_img.load()
width, height = dem_img.size
elevations = []
for y in range(height):
    for x in range(width):
        r, g, b = pixels[x, y]
        elev = (r * 256 + g + b / 256.0) - 32768
        elevations.append(elev)

min_elev = 0
max_elev = 100
valid_elevs = [e for e in elevations if e > -30000]
if valid_elevs:
    min_elev = min(valid_elevs)
    max_elev = max(valid_elevs)

range_elev = max_elev - min_elev
if range_elev == 0: range_elev = 1

heightmap_img = Image.new('L', (width, height))
hm_pixels = heightmap_img.load()

idx = 0
for y in range(height):
    for x in range(width):
        elev = elevations[idx]
        if elev < min_elev: elev = min_elev
        normalized = int(((elev - min_elev) / range_elev) * 255)
        hm_pixels[x, y] = normalized
        idx += 1

heightmap_img.save(os.path.join(public_dir, "heightmap.png"))

config = {
    "minHeight": min_elev,
    "maxHeight": max_elev,
    "range": range_elev,
    "width_m": width_m,
    "height_m": height_m
}
with open(os.path.join(public_dir, "terrain_config.json"), "w") as f:
    json.dump(config, f)
