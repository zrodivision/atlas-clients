# Owner-selected Signal context

The unreleased 0.14.2 native-only source candidate retains an explicit owner-selected record authority without new MCP tools. Check the deployed server guide before using this setup path; release, deployment and live acceptance are distinct.

The owner-only `POST /v1/admin/signal-profiles` API with action `create` accepts `contextAuthority: "owner_selected_records"` with `acceptOwnerSelectedRecordSharing: true`. The existing `memoryIds` array lists the selected IDs, and `memoryRevisions: {"SELECTED_RECORD_UUID": REVIEWED_REVISION}` must contain exactly those IDs and their reviewed integer revisions. Preview-to-create edits are rejected. Selected records are pinned by revision and digest in a new immutable profile, and every resolver rechecks current records and authority. Selection gives the represented source Line no general Vault rights. Existing/default `contextAuthority: "source_grants"` profiles retain their existing permission checks.

Owner note creation uses `POST /v1/admin/signal` with the existing strict write fields, without the legacy `vaultLineId` alias or import action. These are owner control-plane operations, not new agent MCP tools.

For a scoped test, use the owner Add note control for the exact approved non-sensitive content, then select only that record for the Signal profile. Do not broaden source installation permissions to compensate for a missing owner writer. Sharing context requires approval for the configured model recipient and purpose. It does not import private conversations, connect host services, or authorize actions.

Changing approved content or scope must not silently rewrite immutable profile authority. Inspect current authority before using records. Explicit native capability grants, quotas, expiry and spending limits remain separate. Cellular calls, SMS and the historical call.request capability are unavailable in native production. Successful setup is not evidence that a native conversation test passed.
