# ADR-001: Hexagonal Architecture with Bounded Contexts

**Date:** 2025-05-05
**Status:** Accepted

## Context

We need a scalable architecture for a Next.js platform starter that supports multiple domains and clean separation of concerns.

## Decision

Adopt hexagonal architecture (ports & adapters) with each bounded context as a self-contained directory named `src/<name>/` (e.g. `src/classroom/`).

Note: bounded contexts are named `<name>/` — **without** a `-hexagone` suffix. (Earlier examples used `<name>-hexagone/`; that suffix is dropped as a naming choice. The layering below is what matters, not the folder suffix.)

## Structure

```
src/<name>/
├── domain/          ← entities, value objects, errors
├── application/     ← use cases, ports, DTOs, queries
├── adapters/        ← prisma, in-memory, http
└── <name>.module.ts ← composition root
```

## Alternatives Considered

...

## Consequences

- Each bounded context is independently testable by swapping adapters
- Adding a new bounded context is a matter of creating a new `src/<name>/` directory
- Slightly more boilerplate than a flat structure, but scales better
