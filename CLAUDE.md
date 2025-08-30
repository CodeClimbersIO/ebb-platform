# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `bun install` - Install dependencies
- `bun dev` - Start development server with file watching
- `bun start` - Start production server
- `bun test` - Run all tests
- `bun test --watch` - Run tests in watch mode
- `bun test tests/e2e/` - Run only end-to-end tests

### Docker
- `docker compose up -d` - Start services (includes Redis for job queue)
- `docker compose down` - Stop services

## Code Architecture

### Tech Stack
- **Runtime**: Bun (TypeScript)
- **Framework**: Express.js
- **Database**: PostgreSQL (via Knex.js)
- **Authentication**: Supabase JWT
- **Job Queue**: BullMQ with Redis
- **Geolocation**: MaxMind GeoIP2

### Project Structure
```
controllers/     # Express route handlers (REST API endpoints)
services/        # Business logic layer
repos/           # Data access layer (database operations)
middleware/      # Express middleware (auth, error handling)
types/           # TypeScript type definitions
config/          # Database, Redis, Supabase configuration
utils/           # Shared utilities (caching)
tests/           # Unit tests and E2E tests
```

### Service Architecture
The application follows a layered architecture:
1. **Controllers** handle HTTP requests/responses and route to services
2. **Services** contain business logic and orchestrate data operations
3. **Repos** handle database queries and data persistence
4. **Middleware** handles cross-cutting concerns (auth, errors)

#### Service Conventions
Services should follow these patterns:
- Export individual functions as `const` declarations
- Export a single service object at the end: `export const ServiceName = { func1, func2 }`
- Import dependencies at the top (repos, config, middleware)
- Use proper error handling with `ApiError` for business logic errors
- Functions should be focused on single responsibilities
- Use descriptive function names that clearly indicate their purpose

### Key Services
- **JobQueueService**: Manages background jobs with BullMQ (user monitoring, notifications)
- **GeoLocationService**: IP-based location detection using MaxMind database
- **UserProfileService**: User data management and location tracking
- **FriendsService**: Social features and friend connections
- **NotificationService**: User notification system
- **WebhookService**: Handles Stripe webhook event processing
- **StripeService**: Stripe API interactions and checkout session creation
- **LicenseService**: User license management and validation

### Authentication
- Uses Supabase JWT tokens for API authentication
- Test mode available with `valid_test_token` for automated testing
- Auth middleware protects all `/api` routes except `/api/marketing`

### Job Queue System
- Background job processing with Redis/BullMQ
- Scheduled jobs: new user checks (10min), paid user checks (10min), inactive user checks (daily 9AM)
- Manual job triggers available via `/api/jobs` endpoints
- Graceful shutdown handling with job queue cleanup

### Database
- PostgreSQL with Knex.js query builder
- Connection pooling configured (min: 2, max: 10)
- Environment-based configuration

### Environment Setup
- Copy `.env.example` to `.env`
- Required: Supabase credentials, PostgreSQL connection, Redis connection
- Optional: GEOIP_DATABASE_PATH for location features

### Error Handling
- Global error handling with ApiError class
- Development vs production error details
- Graceful service degradation (GeoIP, job queue failures don't crash server)

### Testing
- Unit tests with Bun test runner
- E2E tests using Supertest
- Test authentication with mock tokens
- Fixtures and helpers in `tests/` directory

## Cursor Rules
- Avoid `return await` in async functions - prefer direct return of promises