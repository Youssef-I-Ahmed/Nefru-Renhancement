# Questions to Decide

- Do we use `/api/v1` from the start?
- Do we use `400` or `422` for validation errors?
- Do all success responses include `message`?
- Do services return models, plain objects, or DTOs?
- Do we use soft delete or hard delete?
- Where does authorization live: middleware, service, or both?
- Which validation library is standard?
- What logging level is required in production?
