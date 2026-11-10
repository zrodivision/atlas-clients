/** Offline mapping guidance and synthetic wire examples, never a sync runner or grant. */
const vaultId = "11111111-1111-4111-8111-111111111111";
const memoryId = "22222222-2222-4222-8222-222222222222";
const operation = (nonce: string) => `v1:${vaultId}:${memoryId}:${nonce}`;

export function memoryGuide() {
  return {
    schemaVersion: 1,
    authority: "guidance_only",
    networkChecked: false,
    sourceRead: false,
    operationSent: false,
    commands: ["memory guide", "memory examples"],
    goal: "Maintain a recoverable, source-owned mirror of explicitly selected accessible memory records. Keep the source authoritative; preserve independent Vault edits as conflicts.",
    start: [
      "Inspect the host's documented memory interfaces and user-selected exportable scope, without assuming access to hidden history, credentials or private host internals.",
      "Confirm permission to send that selected information to this Atlas vault. Tool availability, an existing grant or generic memory usefulness does not itself authorize transmission.",
      "Discover current connection and Vault tools. Require vaultIdentityVersion=2, writeProtocolVersion=2, importProtocolVersion=1, can_read=true, can_write=true, read_scope=full and migration_required=false for a writable mirror.",
      "Choose one stable sourceId and a canonical namespace root. Persist a local mapping ledger before sending the first import. Do not derive source identity from content or a mutable title.",
    ],
    mapping: {
      sourceId:
        "Stable logical memory-system identity, not a session ID or access token. Preserve exact case and bytes; max 200 UTF-8 bytes.",
      externalId:
        "Stable source-native record ID. For file-only sources, persist a logical record ID across renames; max 500 UTF-8 bytes. Do not merge identical text from unrelated sources.",
      namespace:
        "Stable original namespace is part of import identity. Use logical ASCII segments, not a local filesystem path. Moving it is not a normal mirror update.",
      id: "One memory UUID per (vaultId, original namespace, sourceId, externalId), retained locally and reused forever for this item.",
      key: "A nonunique subject/search label, never record identity. Conflicting sources may share a key.",
      content:
        "Exact selected UTF-8 text, 1..16000 bytes. Preserve uncertainty, provenance and source boundaries. Split larger records with durable chunk IDs and an explicit manifest, not silent truncation.",
      kind: "Use source for mirrored source material. fact/conflict are caller claims, not verification or authority.",
      sourceRef:
        "A safe provenance reference that the user permits sharing, with no credential-bearing URL or unnecessary private local path.",
      observedAt:
        "Actual source observation timestamp with timezone, monotonic for this source item. Changed content at the same timestamp and older observations are rejected; never invent a later time to force acceptance.",
      expectedRevision:
        "0 for first creation, otherwise the currently inspected Vault revision. Never assume a read-only subtree projection supplies CAS state.",
      operationId:
        "v1:<vault UUID>:<memory UUID>:<fresh operation UUID> for a deliberate changed operation. Save this complete token and request before dispatch; reuse the exact request for recovery.",
    },
    ledger: {
      required: [
        "vaultId",
        "connectionId",
        "originalNamespace",
        "sourceId",
        "externalId",
        "memoryId",
        "lastConfirmedRevision",
        "lastConfirmedMappedDigest",
        "sourceObservedAt",
        "pendingExactRequest",
        "lastReceipt",
        "lastVerifiedAt",
        "syncState",
      ],
      location:
        "An authorized private durable local store, not transient chat state. Treat pending requests as containing the selected source text; never store credentials here.",
      normalization:
        "Before saving a new intent, canonicalize UUIDs and construct title/key/namespace/sourceRef without surrounding whitespace, matching server metadata trimming. Preserve content, sourceId, externalId and tag bytes exactly, and preserve array order. Compare observedAt as an instant. Never normalize or edit an already saved pending request during recovery.",
      digest:
        "Hash the complete mapped semantic payload, including text, title, key, kind, tags, sourceRef and relatedIds. Do not use content-only equality to suppress metadata changes. Keep observation freshness separately.",
      states: [
        "unmapped",
        "pending",
        "confirmed",
        "conflict",
        "source_missing",
        "blocked",
      ],
    },
    routine: [
      {
        step: "recover",
        action:
          "Resolve any pending exact request before creating another one. Same installation and current authority are required for replay; a replacement installation must inspect and reconcile, not impersonate the old one.",
      },
      {
        step: "observe",
        action:
          "Read only the selected source records. Read the mapped current Vault IDs, checking currentRevision, source identity, manualEdited and deleted. Search is for discovery, not full content verification.",
      },
      {
        step: "compare",
        action:
          "When the complete mapped payload and current Vault revision remain unchanged, update only the private local verification checkpoint. Do not import unchanged content on every poll: every accepted new operation consumes a revision.",
      },
      {
        step: "prepare",
        action:
          "For an intentional source change, preserve identity, use the inspected revision and actual new observedAt, allocate one operation token, and durably save the full request.",
      },
      {
        step: "send",
        action:
          "Call atlas_context_import once within the authorized transfer scope. Use atlas_context_write only for a deliberate curated edit, not routine source refresh: it protects the record against later imports.",
      },
      {
        step: "verify",
        action:
          "Retain the receipt's exact target and committed revision. Read current state to verify intended content/provenance and record any later revision separately. A recovered old receipt does not mean it is still the newest state.",
      },
      {
        step: "report",
        action:
          "Report selected scope, confirmed records, conflicts, missing source items and last verification time. Describe a bounded eventually reconciled mirror, not atomic synchronization or complete host memory.",
      },
    ],
    recoveryKeyMeaning:
      "Recovery keys describe scenarios; use wireErrors for actual protocol error codes. Some scenarios, such as response loss or a missing source, have no server error code.",
    wireErrors: {
      idempotency_conflict: "saved_request_mismatch",
      vault_limit: "capacity_reached",
      vault_migration_required: "migration_required",
      vault_busy: "vault_busy",
      vault_write_uncertain: "vault_write_uncertain",
      revision_conflict: "revision_conflict",
      source_conflict: "source_conflict",
      source_stale: "source_stale",
      manual_edit_protected: "manual_edit_protected",
      memory_deleted: "memory_deleted",
    },
    recovery: {
      saved_request_mismatch:
        "Stop and recover the original retained intent. idempotency_conflict means a token was reused with changed target or request; do not alter the saved pending request or allocate a new identity to recover it. Only a deliberate new edit after reconciliation gets a new operation.",
      response_lost:
        "Keep pendingExactRequest. Retry only the identical complete request/operation under the same current installation; do not create a replacement memory or a new operation to recover uncertainty.",
      vault_busy:
        "Bounded backoff of the exact saved request only; recheck authority. Never turn a retry into a new import.",
      vault_write_uncertain:
        "Keep uncertainty visible and recover the exact saved request. Do not claim failure means no commit.",
      revision_conflict:
        "Read current state and deliberately reconcile; only then prepare a new operation. Never blind overwrite or silently rebase.",
      source_conflict:
        "Recover the original stable mapping and inspect candidate source metadata. Do not evade the conflict by changing namespace, sourceId or memoryId.",
      source_stale:
        "Inspect actual source history and timestamps. Same-time different content or older observations need reconciliation, not timestamp inflation.",
      manual_edit_protected:
        "Keep the explicit Vault edit. Record a conflict and ask which version should be authoritative; no automatic protection reset.",
      memory_deleted:
        "Respect the tombstone. Agent import cannot resurrect it; human restore remains separate. Missing source files are not deletion instructions.",
      source_missing:
        "Record a local missing/conflict state and verify the source inventory. No agent forget/delete tool or absence-based deletion is available.",
      authority_changed:
        "Stop affected transfers; inspect current connection/grants. Never use another identity or create a grant as a retry.",
      migration_required:
        "Stop and report the migration requirement. Never create replacement records to hide unavailable data.",
      capacity_reached:
        "Stop and report capacity. Current bounds are 5000 retained records including tombstones and 1000 revisions per record; do not evade them with new identities.",
    },
    retrieval: {
      search:
        "Start with 10 records/12000 bytes. Empty query enumerates visible records; follow nextAfterId while hasMore. Pages can change during writes and contain excerpts, not full content.",
      read: "Read the mapped ID for full current content and revision under full access. Current-subtree readers have reduced metadata and no historical/CAS promise.",
      export:
        "A selected batch of 1..50 IDs and <=32000 logical JSON bytes is consistent and all-or-error. Multiple exports are not one snapshot; reduce the explicit selection after export_too_large.",
      reverseDirection:
        "Vault-to-host edits require a separately supported host write interface and user authority. Export alone does not authorize rewriting local memory.",
    },
    signal:
      "Signal can use explicitly owner-selected Vault records independently of any computer. Mirroring does not automatically update an already selected historical revision or grant a representative access; refresh/review the exact selection separately. Archive access does not prove message/call readiness.",
    gaps: [
      "No change feed or snapshot cursor",
      "Owner grant/review workflow must be exposed by the deployment; an old Console screen reference is not evidence it exists",
      "No atomic batch import or whole-store export",
      "No installed durable checkpoint/scheduler runner",
      "No agent delete/tombstone/restore",
      "No exact source-coordinate lookup endpoint",
      "No automatic host-memory adapter or bidirectional merge",
      "No automatic source synchronization, completeness or factual-confidence guarantee",
    ],
  };
}

export function memoryExamples() {
  const first = {
    vaultId,
    id: memoryId,
    expectedRevision: 0,
    namespace: "mirror/demo/preferences",
    key: "writing-style",
    title: "Synthetic writing preference",
    kind: "source",
    content: "Synthetic example: use concise status updates.",
    sourceRef: "memory-example:preferences/writing-style",
    tags: ["example"],
    relatedIds: [],
    sourceId: "synthetic-memory-system",
    externalId: "record-writing-style",
    observedAt: "2026-11-10T10:00:00Z",
    operationId: operation("33333333-3333-4333-8333-333333333333"),
  };
  const update = {
    ...first,
    expectedRevision: 1,
    content: "Synthetic example: use concise updates with exact blockers.",
    observedAt: "2026-11-10T11:00:00Z",
    operationId: operation("44444444-4444-4444-8444-444444444444"),
  };
  return {
    schemaVersion: 1,
    authority: "guidance_only",
    synthetic: true,
    operationSent: false,
    warning:
      "Illustrative IDs and text only. Never dispatch these examples as real user memory or treat fixture receipts as server state.",
    initial: {
      tool: "atlas_context_import",
      arguments: first,
      expectedReceipt: { id: memoryId, vaultLineId: vaultId, revision: 1 },
    },
    update: {
      tool: "atlas_context_import",
      arguments: update,
      expectedReceipt: { id: memoryId, vaultLineId: vaultId, revision: 2 },
    },
    lostReplyRecovery: {
      tool: "atlas_context_import",
      arguments: structuredClone(update),
      expectedReceipt: { id: memoryId, vaultLineId: vaultId, revision: 2 },
    },
    verify: {
      tool: "atlas_context_read",
      arguments: { vaultId, id: memoryId },
    },
    explicitExport: {
      tool: "atlas_context_export",
      arguments: { vaultId, ids: [memoryId], maxBytes: 32000 },
    },
    unchanged: {
      tool: null,
      reason:
        "Verified payload and remote revision unchanged; update local checkpoint only.",
    },
  };
}
