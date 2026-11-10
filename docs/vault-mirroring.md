# A useful, maintainable Vault mirror

Atlas can already retain selected text memories with stable identities, revisions and recoverable source imports. The simplest dependable workflow is a one-way, source-owned mirror with an explicit local ledger. It is not a filesystem mount, an all-history backup or an automatic two-way merge.

`atlas memory guide` provides a structured offline runbook. `atlas memory examples` provides schema-checked synthetic calls. Neither reads source memory or sends anything. The hosted plugin bundles the same mapping guidance, so agents can work through existing MCP tools without installing the CLI.

The normal loop is short: discover access once, map source IDs, import selected records, then read/compare/import only real changes. Keep a durable receipt ledger so interruptions are recoverable. The sections below explain the few cases that must stop rather than overwrite.

## Decide what is being mirrored

Use the memory interface the host actually exposes. Define the user-selected records, destination vault and permission to transfer that information. Hidden host internals, inaccessible chat history, credentials and unrelated private data are not export sources. A tool grant is necessary but does not replace consent to transmit the selected content.

Keep the original source authoritative for ordinary imports. Independent curated Vault edits become protected records and need deliberate conflict resolution. If the user wants Vault to become authoritative instead, plan that as a separate migration with the host's supported write interface; export alone does not authorize overwriting local memory.

## Map identities once

| Source concept | Vault representation | Rule |
| --- | --- | --- |
| Memory system | sourceId | Stable logical identity, not the current chat/session |
| Source record | externalId | Native stable ID, or locally persisted logical ID for file-only memories |
| Visibility grouping | original namespace | Canonical logical path; part of source identity, not a filesystem address |
| Mirrored record | id | Stable UUID for vault + namespace + sourceId + externalId |
| Topic | key | Nonunique search label; not an upsert key |
| Selected source text | content | Exact selected UTF-8 text, with source uncertainty preserved |
| Provenance | sourceRef | Safe reference approved for sharing, without tokens or unnecessary private paths |
| Source observation | observedAt | Actual observation with timezone; never inflated to force an update |
| Current remote state | expectedRevision | 0 creates; later writes use inspected current revision |
| One deliberate mutation | operationId | Full target-bound token, retained with the complete request before sending |

Source identifiers are exact bytes. Do not lowercase or trim them, merge different sources because their text matches, or use a mutable title/content hash as identity. A file rename should keep its logical identity. Moving namespaces is not a normal import update because the original namespace is part of the source binding.

One content field supports 1–16,000 UTF-8 bytes. For larger source records, design durable chunks and a manifest with explicit coverage. Preserve chunk IDs across ordinary edits. Do not silently truncate or invent automatic deletion for removed chunks.

## Keep a durable private ledger

For each mapping retain vaultId, connectionId, sourceId, externalId, original namespace, memory UUID, last confirmed revision, mapped-payload digest, actual observation time, last verification time, exact pending request, receipt and sync/conflict state. Pending requests contain selected text: keep them in an authorized private durable store, never in logs or public artifacts. Do not put credentials in the ledger.

Before saving a new intent, canonicalize UUIDs and construct title, key, namespace and sourceRef without surrounding whitespace, matching server metadata trimming. Preserve content, sourceId, externalId and tag bytes exactly, along with array order. Compare observedAt timestamps as instants. Never normalize or edit a saved pending request during recovery.

Hash the complete normalized mapped semantic payload, not just content: metadata-only edits also matter. Track observation freshness separately from the comparison digest. Before every changed operation, save its exact request and full operation token. A transient chat transcript is not a durable retry ledger.

## Initial import and refresh

1. Discover the current installation and selected vault. Require the documented Vault identity/write/import protocol versions, full current read/write access and no migration requirement. Same ownership, a connected Line or a computer does not imply access. If the current deployment exposes no owner grant/review workflow, report that onboarding blocker; do not promise an obsolete Console screen or use human cookies through agent tools.
2. Recover any pending request first. Identical requests under the same installation return the original committed receipt. A replacement installation cannot claim old receipts as its own; inspect and reconcile under current authority.
3. Inspect the current mapped record, including source identity, current revision, explicit-edit status and tombstone status. Use the current state, not a cached receipt, as the next CAS basis.
4. If the source's complete mapped payload and the remote revision are unchanged, update the local verification checkpoint only. A newly accepted import consumes a revision even when the text is unchanged.
5. For an intentional source change, preserve source coordinates and memory UUID, use the inspected revision and actual observedAt, create one fresh target-bound operation token, and persist the complete request.
6. Send `atlas_context_import`. Retain the target/revision receipt, then read current state to verify the intended content and provenance. A concurrent later revision is a new observation, not evidence that the earlier receipt was false.
7. Report selected scope, confirmed records, conflicts, omissions and last verification time. Do not claim whole-host completeness or atomic synchronization.

Use `atlas_context_write` for a deliberate curated edit. It makes the record explicitly edited and prevents later imports from silently overwriting it. It is not the normal refresh operation for a source-owned mirror.

## Conflicts and interruptions

- Lost response, vault_busy or uncertain commit: retain pending intent; bounded recovery uses exactly the same request and operation token. Do not mint another ID to escape uncertainty.
- `idempotency_conflict`: recover the original exact intent. Do not rewrite a saved pending request or switch its target to make a token reusable. A deliberate new edit gets a new operation only after reconciliation.
- Revision conflict: reread and deliberately reconcile. Never blindly overwrite or rebase a stale edit.
- Source identity conflict: recover the original mapping and inspect source metadata. Do not change namespace/source IDs to avoid the conflict.
- Older observation or changed text at the same timestamp: verify source history. Do not manufacture a new timestamp.
- Explicit edit protection: keep the edit and surface the conflict. Imports cannot clear protection.
- Missing local source: verify inventory and record a local missing/conflict state. One incomplete scan does not authorize deleting the Vault record.
- Tombstone: respect it. Restore is human-only; importing the same source under a fresh UUID cannot resurrect it.
- Revoked authority or `vault_migration_required`: stop affected transfers and report the exact issue. Another identity or replacement records are not a recovery path.

## Reading a mirror accurately

Search returns metadata and excerpts. Pagination is by stable ID but is not a snapshot during concurrent writes. Full readers can inspect source metadata and revisions; current-subtree readers have reduced current-only projections and cannot safely act as full mirror controllers.

Use read for selected full current content. Export is one consistent, all-or-error selection of 1–50 IDs within 32,000 logical JSON bytes. Multiple exports do not share a snapshot. An export error returns no partial export; explicitly reduce the selection rather than assuming partial success.

Signal can use owner-selected Vault records without an attached computer or a source-agent Vault grant. Those selected historical revisions do not automatically advance when the mirror changes. Review and update the explicit Signal selection separately. A memory mirror grants neither new access nor representative messaging/calling capability.

## Remaining product work

- An exposed, supported owner grant/review workflow on deployments whose native admin omits the older Shared context UI. The underlying owner APIs do not make an absent product flow available to an agent.
- Durable mapping/checkpoint runner with crash recovery and explicit user-approved scheduling.
- Exact source-coordinate lookup so a lost ledger can recover without broad enumeration.
- Change feed or bounded snapshot protocol, including deletion and concurrent-update semantics.
- Explicit batch admission/results and optional unchanged-import suppression without weakening replay semantics.
- Supported adapters for actual host memory interfaces and deliberate bidirectional conflict resolution.
- Owner-controlled deletion/move workflows for source-driven changes; no agent delete exists today.

`vault_limit` reports retained-memory capacity. The guide labels capacity, migration and missing-source cases as recovery scenarios, not invented protocol error names. Current storage bounds are 5,000 retained records per vault including tombstones and 1,000 revisions per record. These make no-op suppression important. Do not rotate IDs to evade capacity. This source candidate adds guidance and validated examples, not these missing backend capabilities.
