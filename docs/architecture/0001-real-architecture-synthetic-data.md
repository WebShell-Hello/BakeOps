# ADR 0001: Real architecture with synthetic business data

## Status

Superseded by [ADR 0002](0002-shared-control-and-isolated-business-modes.md) on 2026-08-22.

## Decision

The system will use a real PostgreSQL database, real REST API architecture, and real relational models from the beginning. During development and demonstration, all business records will use synthetic data. The initial schema is provisional and will evolve as real bakery operational requirements become clearer.

The original decision was: synthetic data replaces real business records, not the production architecture; Next.js always communicates with Django REST Framework and does not switch to local JSON or CSV data in development.

This was the original project direction. It remains useful as historical context, but it no longer describes the implemented test-mode data path.

## Environments

- Development: reproducible synthetic data for engineering.
- Demo: curated synthetic data with realistic business narratives.
- Production: real bakery operational data.

All environments use the same application code, migrations, API contracts, permission rules, and analytics logic.
