# What Was Built In This Step

## 1. Database connection layer
The NestJS backend now has a PostgreSQL pool wrapper.

Files:
- `backend/nestjs/src/shared/database/database.module.ts`
- `backend/nestjs/src/shared/database/database.service.ts`
- `backend/nestjs/src/shared/database/migration.service.ts`

Why this matters:
- The app can now talk to PostgreSQL through one shared service.
- Migration execution now understands `\i` includes and can expand the base schema file.

## 2. Authentication and scope control skeleton
The backend now has a global auth guard and a second guard for scope enforcement.

Files:
- `backend/nestjs/src/modules/auth/*`

What it does:
- Builds authenticated user context
- Supports mock mode through request headers
- Rejects region/store access that is outside the user's scope

Example:
- A user with only one store scope cannot call another store's headcount endpoint.

## 3. Real query path for core reads
Two application paths now use SQL-backed repository logic instead of placeholder responses.

Files:
- `backend/nestjs/src/modules/store-ops/infrastructure/store-ops.repository.ts`
- `backend/nestjs/src/modules/store-ops/application/org.service.ts`
- `backend/nestjs/src/modules/store-ops/application/workforce.service.ts`

What it does:
- Scoped store listing
- Planned vs active headcount gap query

## 4. Async command skeletons
Import and snapshot flows now have concrete module/service/controller placeholders.

Files:
- `backend/nestjs/src/modules/integration/*`
- `backend/nestjs/src/modules/snapshot/*`

What it does:
- Accepts import batch command requests
- Prepares monthly snapshot scheduling path

## 5. Runtime foundation
The NestJS app now has a clearer runnable base.

Files:
- `backend/nestjs/package.json`
- `backend/nestjs/src/main.ts`
- `backend/nestjs/src/app.module.ts`
- `backend/nestjs/.env.example`

Why this matters:
- The project is now closer to a real backend app instead of only documentation and structure.
