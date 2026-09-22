from pathlib import Path
import re
import json


ROUTES_DIR = Path("backend/src/routes")
OUTPUT = Path("docs/postman/collections/NEFRU.postman_collection.json")


collection = {
    "info": {
        "name": "NEFRU API",
        "description": "Professional Postman documentation for NEFRU backend APIs",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    "variable": [
        {
            "key": "base_url",
            "value": "http://localhost:5000/api",
            "type": "string"
        },
        {
            "key": "token",
            "value": "",
            "type": "string"
        }
    ],
    "item": []
}


CATEGORY_MAP = {
    "authUser": "Authentication",
    "admin": "Admin",
    "guide": "Guide",
    "marketplace": "Marketplace",
    "booking": "Bookings",
    "payment": "Payments",
    "review": "Reviews",
    "trip": "Trips",
    "user": "Users",
    "fx": "System"
}


def extract_routes(file_path):
    content = file_path.read_text(encoding="utf-8")

    pattern = r'router\.(get|post|put|patch|delete)\(["\'`](.*?)["\'`]'

    matches = re.findall(pattern, content)

    routes = []

    for method, path in matches:
        routes.append({
            "method": method.upper(),
            "path": path
        })

    return routes


for route_file in ROUTES_DIR.glob("*.routes.js"):

    route_name = route_file.stem.replace(".routes", "")

    folder_name = CATEGORY_MAP.get(
        route_name,
        route_name.replace("-", " ").title()
    )

    folder = {
        "name": folder_name,
        "item": []
    }

    routes = extract_routes(route_file)

    for route in routes:

        request = {
            "name": f'{route["method"]} {route["path"]}',
            "request": {
                "method": route["method"],
                "header": [
                    {
                        "key": "Authorization",
                        "value": "Bearer {{token}}",
                        "type": "text"
                    }
                ],
                "description": (
                    f"{route['method']} endpoint for NEFRU {folder_name} module."
                ),
                "url": {
                    "raw": "{{base_url}}" + route["path"]
                }
            }
        }

        folder["item"].append(request)

    if folder["item"]:
        collection["item"].append(folder)


OUTPUT.parent.mkdir(
    parents=True,
    exist_ok=True
)


OUTPUT.write_text(
    json.dumps(collection, indent=2),
    encoding="utf-8"
)


print("✅ NEFRU Postman documentation generated")
print(f"📁 {OUTPUT}")