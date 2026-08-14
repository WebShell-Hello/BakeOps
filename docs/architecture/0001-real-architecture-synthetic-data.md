# ADR 0001: Real architecture with synthetic business data

## Status

Accepted

## Decision

The system will use a real PostgreSQL database, real REST API architecture, and real relational models from the beginning. During development and demonstration, all business records will use synthetic data. The initial schema is provisional and will evolve as real bakery operational requirements become clearer.

Synthetic data replaces real business records, not the production architecture. Next.js always communicates with Django REST Framework and must not switch to local JSON or CSV data in development.

## Environments

- Development: reproducible synthetic data for engineering.
- Demo: curated synthetic data with realistic business narratives.
- Production: real bakery operational data.

All environments use the same application code, migrations, API contracts, permission rules, and analytics logic.

