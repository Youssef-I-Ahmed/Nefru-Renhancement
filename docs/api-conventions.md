# API Conventions

Use one predictable response shape across the backend.

## Success
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {}
}

## Error
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": []
  }
}

## Status Codes
- `200` OK: normal successful fetch/update
- `201` Created: successful create
- `204` No Content: successful delete with no body
- `400` Bad Request: malformed request
- `401` Unauthorized: invalid or missing auth
- `403` Forbidden: authenticated but not allowed
- `404` Not Found: resource missing
- `409` Conflict: duplicate or conflicting state
- `422` Unprocessable Entity: validation/business-rule failure
- `500` Internal Server Error: unexpected error
