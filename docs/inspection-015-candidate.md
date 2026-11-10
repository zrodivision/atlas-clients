# Combined inspection candidate for 0.15

## Delivered slice

The CLI's `atlas inspect` command and generated hosted-plugin skill compose current connection identity, computer settings, scoped memory access and Signal archive observations. Optional workerId and vaultId selections are strict UUIDs, canonicalized before requests and comparisons. The package version is `0.14.2-rc.1`, a local client candidate against the unchanged reviewed 0.14.2 wire catalog. Coordinated 0.15 server/client versioning and immutable guide pinning remain release-assembly work.

Signal and computers are independent. Signal inspection works without a selected or attached computer. Archive access is not evidence that a standalone representative can receive messages or calls; both readiness fields remain explicitly unassessed.

## Boundaries

- Complete bounded discovery precedes reads. Duplicate relevant tool definitions, loops, failed discovery or more than twenty pages send no inspection calls.
- Failed connection verification blocks downstream reads. Other failed sections preserve independent successful observations and never fall back to another identity.
- Computer inspection requires an explicitly selected worker and the strict advertised candidate inspect schema. No worker is created, claimed, run, cancelled or restored.
- Output contains bounded allowlisted metadata. It excludes memory contents, prompts, provider credentials, runtime logs and raw error text. Selected Signal scope uses that vault's own observation; missing selections remain unobserved and partial.
- Reports are independent current reads, not atomic snapshots or reusable authorization. No search, refresh, export, connector operation or permission change is requested.
- Native plugin credentials and the optional CLI profile remain independent. The hosted skill has the equivalent tool workflow; no new server tool or route is invented.

## Verification

Run `npm run check`, `npm test`, `npm run format:check`, `npm run plugins:generate -- --check` and `npm run test:native`. On macOS, the existing worker CLI fixture needs a canonical temporary path; `TMPDIR=/private/tmp` avoids an alias that the real private-profile check correctly rejects.

The inspection tests cover strict inputs, uppercase UUIDs, paginated/duplicate/incomplete discovery, selected and absent computers, mixed-access vaults, missing selections, revocation-style denials, malformed/oversized responses, error redaction, no automatic replay, installation-profile CLI over real loopback MCP and the actual OAuth CLI path through a strict same-origin fetch shim. The OAuth shim does not prove browser consent or live hosted acceptance. Packaged npm and native CLI help are checked outside source execution. Native installation tests use isolated homes and a checksum-verified official runtime, preserving profiles and unrelated files.

No live account credentials, memory, representative messages/calls, provider inference, grant creation, global installation, production service, publication or deployment is part of these tests. Current server computer availability remains a separate release gate. Linux native packaging, actual host/plugin installation, browser OAuth, standalone Signal messaging/calling and live computer inference require their own evidence.
