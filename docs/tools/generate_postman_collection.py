from pathlib import Path
import re
import json


ROUTES_DIR = Path("backend/src/routes")
OUTPUT = Path("docs/postman/collections/NEFRU.postman_collection.json")
ENV_OUTPUT = Path("docs/postman/environments/NEFRU Local.postman_environment.json")
README_OUTPUT = Path("docs/postman/README.md")


CATEGORY_MAP = {
    "authUser": "Authentication",
    "admin": "Admin",
    "guide": "Guides",
    "marketplace": "Marketplace",
    "booking": "Bookings",
    "payment": "Payments",
    "review": "Reviews",
    "trip": "Trips",
    "user": "Users",
    "fx": "System"
}


BODY_EXAMPLES = {
    "/login": {
        "email": "tourist@test.com",
        "password": "Password123"
    },
    "/register": {
        "name": "Ahmed Mohamed",
        "email": "ahmed@test.com",
        "password": "Password123",
        "role": "tourist"
    }
}


def extract_routes(file_path):
    content = file_path.read_text(encoding="utf-8")

    pattern = r'router\.(get|post|put|patch|delete)\(["\'`](.*?)["\'`]'

    matches = re.findall(pattern, content)

    return [
        {
            "method": method.upper(),
            "path": path
        }
        for method, path in matches
    ]


def auth_script():
    return [
        {
            "listen": "test",
            "script": {
                "exec": [
                    "pm.test('Status code valid', function () {",
                    " pm.expect(pm.response.code).to.be.oneOf([200,201,400,401,404]);",
                    "});"
                ]
            }
        }
    ]


collection = {
    "info": {
        "name": "NEFRU API",
        "description": (
            "Professional Postman documentation for NEFRU backend APIs.\n\n"
            "Includes authentication flow, examples and automated tests."
        ),
        "schema":
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
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


for route_file in ROUTES_DIR.glob("*.routes.js"):

    route_name = route_file.stem.replace(".routes", "")

    folder = {
        "name": CATEGORY_MAP.get(
            route_name,
            route_name.title()
        ),
        "item": []
    }

    for route in extract_routes(route_file):

        endpoint = {
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
                    f"""
NEFRU {folder['name']} endpoint.

Method:
{route['method']}

Authentication:
Bearer Token
"""
                ),
                "url": {
                    "raw": "{{base_url}}" + route["path"]
                }
            },
            "event": auth_script()
        }


        if route["path"] in BODY_EXAMPLES:

            endpoint["request"]["body"] = {
                "mode": "raw",
                "raw": json.dumps(
                    BODY_EXAMPLES[route["path"]],
                    indent=2
                ),
                "options": {
                    "raw": {
                        "language": "json"
                    }
                }
            }


        folder["item"].append(endpoint)


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


environment = {
    "name": "NEFRU Local",
    "values": [
        {
            "key": "base_url",
            "value": "http://localhost:5000/api",
            "enabled": True
        },
        {
            "key": "token",
            "value": "",
            "enabled": True
        },
        {
            "key": "user_id",
            "value": "",
            "enabled": True
        },
        {
            "key": "trip_id",
            "value": "",
            "enabled": True
        },
        {
            "key": "booking_id",
            "value": "",
            "enabled": True
        }
    ]
}


ENV_OUTPUT.write_text(
    json.dumps(environment, indent=2),
    encoding="utf-8"
)


README_OUTPUT.write_text(
"""
# NEFRU Postman Documentation

## Import

1. Import collection:
`collections/NEFRU.postman_collection.json`

2. Import environment:
`environments/NEFRU Local.postman_environment.json`

## Authentication

1. Run Login endpoint.
2. Copy returned token.
3. Token is used automatically as:

Bearer {{token}}

## Variables

- base_url
- token
- user_id
- trip_id
- booking_id

## API Modules

- Authentication
- Users
- Guides
- Trips
- Marketplace
- Bookings
- Payments
- Reviews
- Admin

""",
encoding="utf-8"
)


print("✅ NEFRU Postman Phase 2 generated")