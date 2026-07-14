# Domain Documentation Layout

This repository uses a single-context domain documentation layout.

## Location
Domain docs are stored at the repo root and in subfolders:
- `CONTEXT.md` - Overall system context, domain model, and terminology.
- `docs/adr/` - Architecture Decision Records (ADRs).

## Consumer Rules
- Agents must check for the existence of `CONTEXT.md` and read it before modifying code.
- Architecture modifications must be proposed as a new ADR under `docs/adr/` before implementation.
