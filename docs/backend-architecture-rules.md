# Backend Architecture Rules

## Request Flow
Route -> Middleware -> Controller -> Service -> Model -> Database

## Responsibilities

### Routes
- define endpoint paths
- attach middleware
- map to controllers

### Controllers
- read request data
- call services
- choose status code
- return response

### Services
- hold business logic
- coordinate multiple models
- handle workflows and rules

### Models
- define schema
- define indexes
- represent persistence layer

### Utils
- contain generic reusable helpers
- should not know feature-specific business logic

### Middlewares
- auth
- validation
- error handling
- request preprocessing

## Decision Rules
- If code depends on `req` or `res`, it belongs in a controller or middleware.
- If code contains business rules, it belongs in a service.
- If code is generic and reusable, it belongs in utils.
- If code only describes data shape/persistence, it belongs in models.
