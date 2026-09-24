from pathlib import Path
import json
import re


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_ROOT = SCRIPT_PATH.parents[2]

ROUTES_DIR = PROJECT_ROOT / "backend" / "src" / "routes"
INDEX_FILE = ROUTES_DIR / "index.js"

POSTMAN_DIR = PROJECT_ROOT / "docs" / "postman"
COLLECTION_OUTPUT = POSTMAN_DIR / "collections" / "NEFRU.postman_collection.json"
ENV_OUTPUT = POSTMAN_DIR / "environments" / "NEFRU Local.postman_environment.json"
README_OUTPUT = POSTMAN_DIR / "README.md"


CATEGORY_MAP = {
    "authUser": "Authentication",
    "user": "Users",
    "guide": "Guides",
    "guideVerification": "Guides",
    "trip": "Trips",
    "home": "Marketplace",
    "marketplace": "Marketplace",
    "booking": "Bookings",
    "payment": "Payments",
    "review": "Reviews",
    "notification": "Notifications",
    "admin": "Admin",
    "fx": "System",
}

CATEGORY_ORDER = [
    "Authentication",
    "Users",
    "Guides",
    "Trips",
    "Marketplace",
    "Bookings",
    "Payments",
    "Reviews",
    "Notifications",
    "Admin",
    "System",
]

FOLDER_DESCRIPTIONS = {
    "Authentication": "Registration, login, Google authentication, email verification, password recovery, and session operations.",
    "Users": "Traveler profile and saved-trip operations.",
    "Guides": "Guide profiles and guide verification/document operations.",
    "Trips": "Public trip discovery plus guide trip-management operations.",
    "Marketplace": "Home discovery and internal marketplace lifecycle operations.",
    "Bookings": "Tourist and guide booking lifecycle operations.",
    "Payments": "Paymob checkout, reconciliation, payment status, saved methods, and webhook handling.",
    "Reviews": "Public trip reviews and authenticated tourist review operations.",
    "Notifications": "Authenticated notification listing and read-state operations.",
    "Admin": "Administrative dashboard, users, guide verification, moderation, booking operations, and analytics.",
    "System": "Health/readiness and FX utility endpoints.",
}


BODY_EXAMPLES = {
    ("POST", "/auth/register"): {
        "fullName": "Ahmed Mohamed",
        "email": "ahmed@example.com",
        "password": "Password123",
        "confirmPassword": "Password123",
        "role": "tourist",
    },
    ("POST", "/auth/login"): {
        "email": "tourist@example.com",
        "password": "Password123",
        "rememberMe": False,
    },
    ("POST", "/auth/google"): {
        "credential": "{{google_id_token}}",
        "role": "tourist",
        "rememberMe": False,
    },
    ("POST", "/auth/google/complete-signup"): {
        "onboardingToken": "{{google_onboarding_token}}",
        "role": "tourist",
        "rememberMe": False,
    },
    ("POST", "/auth/google/link"): {
        "linkingToken": "{{google_linking_token}}",
        "password": "Password123",
        "rememberMe": False,
    },
    ("POST", "/auth/google/connect"): {
        "credential": "{{google_id_token}}",
    },
    ("POST", "/auth/verify-email"): {
        "token": "{{email_verification_token}}",
    },
    ("POST", "/auth/resend-verification"): {
        "email": "tourist@example.com",
    },
    ("POST", "/auth/forgot-password"): {
        "email": "tourist@example.com",
    },
    ("POST", "/auth/reset-password/verify"): {
        "token": "{{password_reset_token}}",
    },
    ("POST", "/auth/reset-password"): {
        "token": "{{password_reset_token}}",
        "password": "NewPassword123",
        "confirmPassword": "NewPassword123",
    },
    ("PATCH", "/auth/change-password"): {
        "currentPassword": "Password123",
        "newPassword": "NewPassword123",
        "confirmNewPassword": "NewPassword123",
    },
    ("POST", "/bookings/"): {
        "tripId": "{{tripId}}",
        "occurrenceKey": "{{occurrenceKey}}",
        "numberOfGuests": 1,
        "specialRequest": "Optional request",
    },
    ("PATCH", "/bookings/:bookingId/cancel"): {
        "reason": "Plans changed",
    },
    ("PATCH", "/bookings/guide/occurrences/complete"): {
        "tripId": "{{tripId}}",
        "occurrenceKey": "{{occurrenceKey}}",
    },
    ("PATCH", "/bookings/guide/occurrences/cancel"): {
        "tripId": "{{tripId}}",
        "occurrenceKey": "{{occurrenceKey}}",
        "reason": "Guide cancellation reason",
    },
    ("POST", "/payments/checkout"): {
        "bookingId": "{{bookingId}}",
    },
}


FORMDATA_EXAMPLES = {
    ("POST", "/users/profile/avatar"): [
        {"key": "avatar", "type": "file", "src": []},
    ],
    ("POST", "/guide-verification/documents"): [
        {"key": "document", "type": "file", "src": []},
    ],
    ("PATCH", "/guide-verification/documents/:documentId"): [
        {"key": "document", "type": "file", "src": []},
    ],
    ("POST", "/trips/:id/upload-media"): [
        {"key": "coverImage", "type": "file", "src": []},
        {"key": "galleryImages", "type": "file", "src": []},
        {"key": "galleryIndexes", "value": "[]", "type": "text"},
    ],
}


RESPONSE_EXAMPLES = {
    ("GET", "/health"): [
        (200, "OK", {"success": True, "message": "NEFRU API is running"}),
    ],
    ("GET", "/ready"): [
        (200, "OK", {"success": True}),
        (503, "Service Unavailable", {"success": False, "message": "Database unavailable"}),
    ],
    ("POST", "/auth/register"): [
        (
            201,
            "Created",
            {
                "success": True,
                "message": "Account created. Check your email to verify your account.",
                "data": {
                    "user": {"id": "<USER_ID>", "email": "ahmed@example.com", "role": "tourist"},
                    "profile": {},
                    "requiresEmailVerification": True,
                    "emailSent": True,
                },
            },
        ),
    ],
    ("POST", "/auth/login"): [
        (
            200,
            "OK",
            {
                "success": True,
                "message": "Logged in successfully",
                "data": {
                    "user": {"id": "<USER_ID>", "email": "tourist@example.com", "role": "tourist"},
                    "profile": {},
                },
                "meta": {"token": "<JWT_TOKEN>"},
            },
        ),
        (
            401,
            "Unauthorized",
            {"success": False, "message": "Invalid email or password"},
        ),
    ],
    ("POST", "/auth/logout"): [
        (200, "OK", {"success": True, "message": "Logged out successfully"}),
    ],
    ("POST", "/bookings/"): [
        (
            201,
            "Created",
            {
                "success": True,
                "message": "Your place is held for 15 minutes",
                "data": {"booking": {"bookingId": "<BOOKING_ID>", "status": "pending_payment"}},
            },
        ),
    ],
}


NAME_OVERRIDES = {
    ("GET", "/health"): "API Health Check",
    ("GET", "/ready"): "Database Readiness Check",
    ("POST", "/auth/register"): "Register",
    ("POST", "/auth/login"): "Login",
    ("POST", "/auth/logout"): "Logout",
    ("POST", "/auth/google"): "Google Login",
    ("POST", "/auth/google/complete-signup"): "Complete Google Signup",
    ("POST", "/auth/google/link"): "Link Google Account",
    ("POST", "/auth/google/connect"): "Connect Google Account",
    ("DELETE", "/auth/google/connect"): "Disconnect Google Account",
    ("POST", "/auth/verify-email"): "Verify Email",
    ("POST", "/auth/resend-verification"): "Resend Verification Email",
    ("POST", "/auth/forgot-password"): "Forgot Password",
    ("POST", "/auth/reset-password/verify"): "Verify Password Reset Token",
    ("POST", "/auth/reset-password"): "Reset Password",
    ("PATCH", "/auth/change-password"): "Change Password",
    ("GET", "/bookings/me"): "My Bookings",
    ("GET", "/bookings/guide/me"): "Guide Bookings",
    ("POST", "/payments/checkout"): "Create Paymob Checkout",
    ("POST", "/payments/paymob/webhook"): "Paymob Webhook",
}


STATIC_ENVIRONMENT_VARIABLES = {
    "base_url": "http://localhost:5000/api",
    "frontend_url": "http://localhost:5173",
    "token": "",
    "refresh_token": "",
    "email_verification_token": "",
    "password_reset_token": "",
    "google_id_token": "",
    "google_onboarding_token": "",
    "google_linking_token": "",
}


def extract_balanced_call(source: str, open_paren_index: int) -> str:
    depth = 0
    quote = None
    escaped = False
    i = open_paren_index

    while i < len(source):
        ch = source[i]

        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            continue

        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return source[open_paren_index : i + 1]

        i += 1

    return source[open_paren_index:]


def extract_use_middleware(content: str):
    uses = []
    pattern = re.compile(r"([A-Za-z_]\w*)\.use\s*\(", re.MULTILINE)

    for match in pattern.finditer(content):
        open_paren = content.find("(", match.start())
        call = extract_balanced_call(content, open_paren)
        uses.append(
            {
                "router": match.group(1),
                "position": match.start(),
                "call": call,
            }
        )

    return uses


def inherited_middleware(uses, router_name: str, position: int):
    applicable = [
        item
        for item in uses
        if item["router"] == router_name and item["position"] < position
    ]
    return "\n".join(item["call"] for item in applicable)


def roles_from_text(text: str):
    roles = []
    for args in re.findall(r"authorizeRoles\s*\((.*?)\)", text, re.DOTALL):
        roles.extend(re.findall(r'["\']([^"\']+)["\']', args))
    return list(dict.fromkeys(roles))


def extract_routes(content: str):
    uses = extract_use_middleware(content)
    routes = []

    direct_pattern = re.compile(
        r'([A-Za-z_]\w*)\.(get|post|put|patch|delete)\s*\(\s*["\'`](.*?)["\'`]',
        re.IGNORECASE | re.DOTALL,
    )

    for match in direct_pattern.finditer(content):
        router_name = match.group(1)
        method = match.group(2).upper()
        path = match.group(3)

        open_paren = content.find("(", match.start())
        call = extract_balanced_call(content, open_paren)
        inherited = inherited_middleware(uses, router_name, match.start())
        middleware_text = inherited + "\n" + call

        routes.append(
            {
                "method": method,
                "path": path,
                "protected": bool(re.search(r"\bprotect\b", middleware_text)),
                "roles": roles_from_text(middleware_text),
                "position": match.start(),
            }
        )

    chain_pattern = re.compile(
        r'([A-Za-z_]\w*)\s*\.route\s*\(\s*["\'`](.*?)["\'`]\s*\)',
        re.IGNORECASE | re.DOTALL,
    )

    for match in chain_pattern.finditer(content):
        router_name = match.group(1)
        path = match.group(2)
        statement_end = content.find(";", match.end())
        if statement_end == -1:
            statement_end = len(content)

        chain = content[match.end() : statement_end]
        inherited = inherited_middleware(uses, router_name, match.start())

        method_pattern = re.compile(r"\.(get|post|put|patch|delete)\s*\(", re.IGNORECASE)
        for method_match in method_pattern.finditer(chain):
            open_paren = chain.find("(", method_match.start())
            call = extract_balanced_call(chain, open_paren)
            middleware_text = inherited + "\n" + call

            routes.append(
                {
                    "method": method_match.group(1).upper(),
                    "path": path,
                    "protected": bool(re.search(r"\bprotect\b", middleware_text)),
                    "roles": roles_from_text(middleware_text),
                    "position": match.start() + method_match.start(),
                }
            )

    routes.sort(key=lambda item: item["position"])

    deduped = []
    seen = set()
    for route in routes:
        key = (route["method"], route["path"], route["position"])
        if key not in seen:
            seen.add(key)
            deduped.append(route)

    return deduped


def parse_mounts(index_text: str):
    imports = {
        alias: filename
        for alias, filename in re.findall(
            r'import\s+([A-Za-z_]\w*)\s+from\s+["\']\./([^"\']+\.routes\.js)["\']',
            index_text,
        )
    }

    mounts = {}
    for prefix, alias in re.findall(
        r'apiRouter\.use\s*\(\s*["\']([^"\']+)["\']\s*,\s*([A-Za-z_]\w*)\s*\)',
        index_text,
    ):
        filename = imports.get(alias)
        if filename:
            mounts[filename] = prefix

    return mounts


def join_paths(prefix: str, local_path: str) -> str:
    prefix = "/" + prefix.strip("/") if prefix and prefix != "/" else ""
    local = "/" + local_path.lstrip("/") if local_path else ""

    if local_path == "/":
        return f"{prefix}/" if prefix else "/"

    result = f"{prefix}{local}"
    return result or "/"


def route_file_key(filename: str) -> str:
    return filename.replace(".routes.js", "")


def category_for_file(filename: str) -> str:
    key = route_file_key(filename)
    return CATEGORY_MAP.get(key, re.sub(r"([a-z])([A-Z])", r"\1 \2", key).title())


def parameter_name(full_path: str, raw_name: str) -> str:
    if raw_name != "id":
        return raw_name

    parts = [part for part in full_path.split("/") if part]
    try:
        idx = parts.index(":id")
    except ValueError:
        return "id"

    previous = parts[idx - 1] if idx > 0 else "item"
    mapping = {
        "guides": "guideId",
        "guide": "guideId",
        "trips": "tripId",
        "trip": "tripId",
        "reviews": "reviewId",
        "accounts": "accountId",
        "user": "userId",
        "users": "userId",
        "verification": "verificationId",
        "occurrences": "occurrenceId",
        "revisions": "revisionId",
        "cases": "caseId",
        "audit": "auditId",
        "booking-operations": "bookingOperationId",
        "tour-reviews": "tourReviewId",
        "merchandising": "itemId",
    }
    return mapping.get(previous, "id")


def postman_path(full_path: str):
    params = []

    def repl(match):
        raw_name = match.group(1)
        name = parameter_name(full_path, raw_name)
        params.append(name)
        return "{{" + name + "}}"

    converted = re.sub(r":([A-Za-z_]\w*)", repl, full_path)
    return converted, params


def friendly_request_name(method: str, full_path: str):
    override = NAME_OVERRIDES.get((method, full_path))
    if override:
        return override

    clean = full_path.strip("/") or "root"
    clean = re.sub(r":([A-Za-z_]\w*)", r"\1", clean)
    clean = clean.replace("-", " ").replace("_", " ")
    clean = "/".join(
        " ".join(part.capitalize() for part in segment.split())
        for segment in clean.split("/")
    )

    verb = {
        "GET": "Get",
        "POST": "Create / Action",
        "PUT": "Replace",
        "PATCH": "Update",
        "DELETE": "Delete",
    }.get(method, method.title())

    return f"{verb} {clean}"


def build_body(method: str, full_path: str):
    example = BODY_EXAMPLES.get((method, full_path))
    if example is not None:
        return {
            "mode": "raw",
            "raw": json.dumps(example, indent=2),
            "options": {"raw": {"language": "json"}},
        }

    formdata = FORMDATA_EXAMPLES.get((method, full_path))
    if formdata is not None:
        return {
            "mode": "formdata",
            "formdata": formdata,
        }

    return None


def token_capture_script():
    return [
        "if (pm.response.code >= 200 && pm.response.code < 300) {",
        "    let json = {};",
        "    try { json = pm.response.json(); } catch (e) {}",
        "",
        "    const token =",
        "        json.token ||",
        "        json.accessToken ||",
        "        json.access_token ||",
        "        (json.meta && json.meta.token) ||",
        "        (json.data && (json.data.token || json.data.accessToken || json.data.access_token));",
        "",
        "    const refreshToken =",
        "        json.refreshToken ||",
        "        json.refresh_token ||",
        "        (json.meta && json.meta.refreshToken) ||",
        "        (json.data && (json.data.refreshToken || json.data.refresh_token));",
        "",
        "    if (token) pm.environment.set('token', token);",
        "    if (refreshToken) pm.environment.set('refresh_token', refreshToken);",
        "}",
    ]


def build_events(method: str, full_path: str):
    script = [
        "pm.test('No server error', function () {",
        "    pm.expect(pm.response.code).to.be.below(500);",
        "});",
        "",
        "pm.test('Response time is acceptable', function () {",
        "    pm.expect(pm.response.responseTime).to.be.below(5000);",
        "});",
    ]

    if (method, full_path) in {
        ("POST", "/auth/login"),
        ("POST", "/auth/register"),
        ("POST", "/auth/google"),
        ("POST", "/auth/google/complete-signup"),
        ("POST", "/auth/google/link"),
    }:
        script += [""] + token_capture_script()

    return [
        {
            "listen": "test",
            "script": {
                "type": "text/javascript",
                "exec": script,
            },
        }
    ]


def description_for(category: str, route):
    auth = "Public / no auth" if not route["protected"] else "Authenticated"
    if route["roles"]:
        auth += f" — roles: {', '.join(route['roles'])}"

    return (
        f"### NEFRU {category}\n\n"
        f"**Method:** `{route['method']}`  \n"
        f"**Path:** `{route['full_path']}`  \n"
        f"**Access:** {auth}\n\n"
        "Generated from the actual Express router mount and route declaration. "
        "Saved examples are included only where the backend contract was explicitly documented in the generator."
    )


def build_saved_examples(method: str, full_path: str, postman_url: str):
    items = []
    for code, status, payload in RESPONSE_EXAMPLES.get((method, full_path), []):
        items.append(
            {
                "name": f"{code} {status}",
                "originalRequest": {
                    "method": method,
                    "header": [],
                    "url": {"raw": "{{base_url}}" + postman_url},
                },
                "status": status,
                "code": code,
                "_postman_previewlanguage": "json",
                "header": [{"key": "Content-Type", "value": "application/json"}],
                "cookie": [],
                "body": json.dumps(payload, indent=2),
            }
        )
    return items


def request_item(category: str, route):
    url_path, params = postman_path(route["full_path"])
    body = build_body(route["method"], route["full_path"])

    request = {
        "method": route["method"],
        "header": [],
        "description": description_for(category, route),
        "url": {"raw": "{{base_url}}" + url_path},
    }

    if not route["protected"]:
        request["auth"] = {"type": "noauth"}

    if body:
        request["body"] = body
        if body["mode"] == "raw":
            request["header"].append(
                {"key": "Content-Type", "value": "application/json", "type": "text"}
            )

    return {
        "name": friendly_request_name(route["method"], route["full_path"]),
        "request": request,
        "event": build_events(route["method"], route["full_path"]),
        "response": build_saved_examples(route["method"], route["full_path"], url_path),
        "_nefru_params": params,
    }


def add_folder(folder_map, category: str):
    if category not in folder_map:
        folder_map[category] = {
            "name": category,
            "description": FOLDER_DESCRIPTIONS.get(category, f"NEFRU {category} API endpoints."),
            "item": [],
        }


if not INDEX_FILE.exists():
    raise FileNotFoundError(f"Missing routes index: {INDEX_FILE}")

index_text = INDEX_FILE.read_text(encoding="utf-8")
mounts = parse_mounts(index_text)

folder_map = {}
all_parameter_names = set()

system_routes = []
for route in extract_routes(index_text):
    if route["path"] in {"/health", "/ready"}:
        route["full_path"] = route["path"]
        system_routes.append(route)

if system_routes:
    add_folder(folder_map, "System")
    for route in system_routes:
        item = request_item("System", route)
        all_parameter_names.update(item.pop("_nefru_params"))
        folder_map["System"]["item"].append(item)

for route_file in sorted(ROUTES_DIR.glob("*.routes.js")):
    if route_file.name == "index.js":
        continue

    prefix = mounts.get(route_file.name)
    if prefix is None:
        print(f"⚠️  Skipping unmounted route file: {route_file.name}")
        continue

    category = category_for_file(route_file.name)
    add_folder(folder_map, category)

    content = route_file.read_text(encoding="utf-8")
    for route in extract_routes(content):
        route["full_path"] = join_paths(prefix, route["path"])
        item = request_item(category, route)
        all_parameter_names.update(item.pop("_nefru_params"))
        folder_map[category]["item"].append(item)


ordered_folders = []
for category in CATEGORY_ORDER:
    folder = folder_map.pop(category, None)
    if folder and folder["item"]:
        ordered_folders.append(folder)

for category in sorted(folder_map):
    folder = folder_map[category]
    if folder["item"]:
        ordered_folders.append(folder)


dynamic_defaults = {
    "page": "1",
    "action": "",
    "kind": "",
    "tripId": "",
    "bookingId": "",
    "guideId": "",
    "userId": "",
    "accountId": "",
    "reviewId": "",
    "caseId": "",
    "verificationId": "",
    "occurrenceId": "",
    "revisionId": "",
    "documentId": "",
    "methodId": "",
    "auditId": "",
    "bookingOperationId": "",
    "tourReviewId": "",
    "itemId": "",
}

extra_workflow_variables = {
    "occurrenceKey": "",
}

environment_values = dict(STATIC_ENVIRONMENT_VARIABLES)
for name in sorted(all_parameter_names):
    environment_values.setdefault(name, dynamic_defaults.get(name, ""))
environment_values.update(extra_workflow_variables)


collection = {
    "info": {
        "name": "NEFRU API",
        "description": (
            "# NEFRU API\n\n"
            "Postman documentation generated from the real Express route mounts and route declarations.\n\n"
            "## Recommended flow\n"
            "1. Select **NEFRU Local**.\n"
            "2. Run **Authentication → Login**.\n"
            "3. On successful login, the script captures the backend `meta.token` automatically.\n"
            "4. Fill any route variables needed for the flow you are testing.\n\n"
            "No real credentials or provider secrets are written by this generator."
        ),
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "auth": {
        "type": "bearer",
        "bearer": [
            {"key": "token", "value": "{{token}}", "type": "string"},
        ],
    },
    "variable": [
        {"key": key, "value": value, "type": "string"}
        for key, value in environment_values.items()
    ],
    "item": ordered_folders,
}


environment = {
    "name": "NEFRU Local",
    "values": [
        {"key": key, "value": value, "enabled": True}
        for key, value in environment_values.items()
    ],
    "_postman_variable_scope": "environment",
    "_postman_exported_using": "NEFRU Postman Generator",
}


route_count = sum(len(folder["item"]) for folder in ordered_folders)

readme = f"""# NEFRU Postman Documentation

Generated from the actual Express route mounts in `backend/src/routes/index.js`
and the route declarations in `backend/src/routes/*.routes.js`.

## Current generated coverage

- Folders: {len(ordered_folders)}
- Requests: {route_count}
- Collection schema: Postman Collection v2.1

## Files

- `collections/NEFRU.postman_collection.json`
- `environments/NEFRU Local.postman_environment.json`

## Regenerate

From the repository root:

```powershell
python docs/tools/generate_postman_collection.py
```

## Import into Postman

1. Import the collection.
2. Import the `NEFRU Local` environment.
3. Select the environment.
4. Start the backend.
5. Run **Authentication → Login** before protected flows.

Local API base URL:

```text
http://localhost:5000/api
```

## Authentication

The backend supports an HttpOnly authentication cookie and temporarily exposes
the JWT to API clients under `meta.token`. The Login test script captures that
token automatically into `{{{{token}}}}`.

Public requests explicitly use Postman's `noauth` mode so they do not inherit
the collection Bearer token.

## Important variables

- `base_url`
- `token`
- `tripId`
- `bookingId`
- `guideId`
- `occurrenceKey`
- `documentId`
- `methodId`
- `action`
- `page`

Additional path variables are generated automatically from Express `:params`.

## Suggested demo flow

```text
Register / Login
      ↓
Browse Trips
      ↓
Check Availability
      ↓
Create Booking
      ↓
Create Paymob Checkout
      ↓
Check Payment Status
      ↓
Tourist / Guide Booking Views
      ↓
Admin Booking Operations
```

## Safety

Do not put MongoDB credentials, JWT secrets, Cloudinary credentials, Paymob
keys, Gmail app passwords, or any other real secret in these tracked Postman
files.

Saved response examples are included only for selected endpoints whose response
shape is explicitly represented by the backend code used for this generator.
"""


COLLECTION_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
ENV_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

COLLECTION_OUTPUT.write_text(
    json.dumps(collection, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
ENV_OUTPUT.write_text(
    json.dumps(environment, indent=2, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
README_OUTPUT.write_text(readme, encoding="utf-8")

print("✅ NEFRU Postman Phase 2 generated successfully")
print(f"📚 Folders: {len(ordered_folders)}")
print(f"🔗 Requests: {route_count}")
print(f"📁 Collection: {COLLECTION_OUTPUT}")
print(f"🌐 Environment: {ENV_OUTPUT}")
print(f"📝 README: {README_OUTPUT}")
