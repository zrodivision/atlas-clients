# Client distribution

This repository owns all maintained public client source. Atlas service source and operational state are not included or needed.

- `npm run package:client`: local development setup-only plugin at http://127.0.0.1:8080/mcp/connect. Requires a separately available local Atlas service and Mailpit; it never provides that service.
- `npm run package:hosted`: authenticated hosted `/mcp` plugin, generated from the canonical skill and reviewed tool schema.
- `npm run plugins:generate`: regenerate checked-in hosted plugin and marketplace manifests, preserving unrelated files.
- `npm run package:release`: create an isolated public marketplace tree and independently installable CLI tarball in ignored build output. No publication or installation occurs.

The local skill refresh helpers (`client:status`, `client:install-skill`, `client:package-status`) are explicit owner operations; normal package generation does not alter an installation. Server UI changes require a server rebuild/restart. Plugin changes require an authorized host refresh/reconnect and verification of identity/discovery/rendering.

The CLI source is in scripts/atlas.ts, scripts/cli-oauth.ts and scripts/mcp-install.ts. Only their compiled output, package metadata and CLI README enter the npm tarball. No backend code, configuration, data or Git history is copied. The source repository and package build must remain usable without private GitHub credentials.

Client releases have their own prerelease version and declare the compatible service contract in contracts/compatibility.json. Update reviewed schemas and skills when that contract changes. Native host validation and public service availability are separate release gates. See [CLI usage](CLI.md).
