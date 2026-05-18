# Codex Review Readiness Fixes Design

## Goal

Close the Codex bot findings from the last merged readiness PRs in one focused change set, without broad refactors or frontend work.

## Scope

This change addresses seven review findings:

- Keep upload parse concurrency slots occupied until timed-out worker threads have actually exited.
- Probe Redis health whenever Redis is required by queue durability or Redis-backed rate limiting.
- Fail alert-routing smoke when deployed backend observability is degraded.
- Preserve degraded observability startup visibility even when the configured Nest log level omits warnings.
- Resolve Nest log levels from loaded app configuration rather than raw pre-dotenv environment reads.
- Provide `TRUST_PROXY_HOPS` in staging compose defaults when it runs with production settings.
- Scope the Supabase backup capability No-Go to Supabase managed restore drills, not local/disposable logical restore drills.

## Architecture

The changes stay inside the existing readiness surfaces. Runtime code keeps current service boundaries: upload parsing owns worker lifecycle, health owns dependency probing, observability owns startup status logging, and staging compose owns staging defaults. Script and documentation changes strengthen existing gates instead of adding new systems.

## Error Handling

Timeout paths still return the existing retryable `503` upload error. Redis dependency errors stay sanitized. Alert smoke failures expose only status metadata, not secrets. Startup degraded observability is logged at error severity so it remains visible under `LOG_LEVEL=error`.

## Testing

Add or adjust focused tests around each changed behavior, then run backend tests, script tests, lint, and build before opening the PR.
