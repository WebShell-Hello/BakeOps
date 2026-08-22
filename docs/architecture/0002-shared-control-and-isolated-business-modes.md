# ADR 0002: Shared control data and isolated business modes

## Status

Accepted on 2026-08-22.

## Context

BakeOps needs a production dataset that is protected from testing while retaining one shared identity and permission system. Test changes must survive a browser refresh, but deleting production business rows must not affect test data. Users can be assigned test or production mode individually, while visitors always use test mode and cannot save changes.

Using duplicated PostgreSQL schemas, environment columns on every table, dynamic SQL views or separate databases would increase backend branching and migration complexity for the current single-store system.

## Decision

The system separates data by responsibility:

- Shared control data always uses Django and PostgreSQL: users, Sessions, preferences, roles, page permissions, navigation, system configuration and logs.
- Production business data uses Django and PostgreSQL.
- Test business data uses versioned project JSON baselines plus per-browser IndexedDB mutations.
- A user's `system_mode` is stored on the shared user record. Visitors always use test mode.
- Visitors may read pages granted to the anonymous role but cannot persist test mutations.
- Test-mode actions are still sent to the shared audit API with `system_mode=TEST`.

The frontend data access layer is the routing boundary. Page components call typed functions from `frontend/src/lib/api.ts` and do not select storage engines directly.

## Consequences

### Benefits

- Test mutations and production business writes are physically isolated.
- Accounts, roles, menus and audit records remain consistent across modes.
- Test changes survive refreshes without adding environment fields to every business table.
- The backend production schema stays conventional and migration-friendly.

### Trade-offs

- Test data is browser-specific and is not included in PostgreSQL backups.
- A test business endpoint without a project JSON baseline fails explicitly and never bootstraps from the production backend.
- Test and production business paths must maintain compatible TypeScript contracts and business calculations.
- New business endpoints require an explicit project JSON baseline and local read contract.
- Multi-device shared test scenarios would require a future server-side test datastore.

## Guardrails

- Never add shared control paths to the local test store.
- Never fall through from a test mutation to a production business endpoint.
- Keep guest mutation rejection in the common data access layer.
- Log test actions without copying business payloads or secrets into audit metadata.
- Update [project architecture](project-architecture.md) and [data architecture](data-architecture.md) when the routing boundary changes.
