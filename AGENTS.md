# Atlas clients

This public repository owns Atlas CLI source, plugin manifests, workflow skills, user documentation and client release tooling. The Atlas service implementation and all account data remain private and are never dependencies of this build.

Never copy a server checkout, Git history, credentials, environment files, account records or operational logs into this repository. Review explicit public files before publishing. Contracts here are reviewed public MCP wire schemas, not server code.

Canonical skill: skills/atlas/SKILL.md. Regenerate checked-in plugins with npm run plugins:generate; do not edit generated copies. Run npm ci, npm run check, npm test, and npm run format:check. The package exports only the allowlisted CLI files. Keep prerelease claims truthful: build, publication, deployment, native login and host rendering are separate states. No provider calls or deployment are part of tests.

Use independent CLI/MCP credentials with explicit account/line consent. Same-harness surfaces can share a line; vault and contact grants remain explicit. Preserve unrelated user files and credentials. Do not change global installations during builds or tests.
