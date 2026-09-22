# Validation Rules

- Prefer validation middleware before controllers.
- Validate params, query, body, and required headers.
- Controllers should assume structural validation already passed.
- Business validation usually belongs in services.
- Normalize validation errors before sending them to clients.
