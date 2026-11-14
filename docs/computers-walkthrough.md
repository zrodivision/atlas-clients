# Use a persistent Atlas computer

Connect the agent you already use through native MCP or the supported CLI.
Read `atlas://guides/atlas` and current authenticated discovery before starting.
Source, packages and deployed capability are separate; verify each needed gate.

## Hosted persistent computers through Atlas

Use this path when current authenticated discovery advertises `atlas_computers`.
Call it directly through MCP, or `atlas call atlas_computers JSON` through the
CLI. Tool discovery proves availability of a
contract, not a deployed computer or successful paid inference.

1. Call `atlas_computers` with `{"action":"describe"}`. Choose a returned
   profile and one of its regions. Read the current owner approval, Energy and
   task workflow requirements. The human must approve the intended account,
   this requester installation, consent duration (including durable consent when supported), computer/storage limits and bounded
   cloud/per-task Energy. Credit, allowance and spending consent are separate;
   a stated dollar allocation is not unlimited spend or a provider hard cap.
   If configuration, funding or approval is missing, report that exact gate.
   Do not ask the user to create a Fly Machine, supply provider credentials or
   authenticate a Fly CLI; Atlas assembles the provider resources.
2. Save one UUID `requestId` and the exact provision intent. Call
   `atlas_computers` with action `provision`, that requestId, and `spec` containing
   **all six** fields: `profileId`, `region`, `label`, `volumeSizeGb` (integer
   provisioned GiB within the approved limit), `autoBackupEnabled` (boolean),
   and `snapshotRetention` (integer days, 1..60). For example, after selecting
   the actual profile/region, the spec can use label `Research workspace`,
   volumeSizeGb `1`, autoBackupEnabled `false`, snapshotRetention `1` if the
   owner's retention decision permits it. Save the returned `computerId`,
   Machine and volume identities. Never invent profile IDs or replace an
   uncertain allocation with a fresh request.
3. Retain a concrete owner-authorized task through `atlas_computers`:
   `{"action":"prepare-task","requestId":"<saved-new-UUID>","text":"Write workflow.md in /workspace with the approved plan, then read it and report its contents.","ttlSeconds":3600}`.
   This creates a canonical SUBMITTED task assigned to this current agent;
   it does not wake compute, spend Energy, impersonate a human or require a
   second agent. Save its `id` and `metadata.atlasVersion`. Only include context
   the user authorized for this computer; credentials and private host history
   do not transfer.
4. Claim that task through `atlas_tasks`:
   `{"action":"report","taskId":"<returned-id>","expectedVersion":<returned-metadata.atlasVersion>,"idempotencyKey":"<saved-new-key>","state":"WORKING","text":"Accepted the owner-authorized workspace task."}`.
   Use the returned `metadata.atlasVersion`, not an assumed version. Existing
   tasks already assigned to this agent may instead be inspected and claimed
   using the ordinary task workflow. A stale claim requires inspection.
5. Wake the saved computer through `atlas_computers` with action `wake`,
   computerId and a saved new requestId. Run with
   `{"action":"run","computerId":"<saved-id>","requestId":"<saved-run-UUID>","taskId":"<claimed-id>","taskVersion":<claimed-metadata.atlasVersion>}`.
   Run accepts retained task input, not an inline prompt or provider key.
   Retrieve `artifact` with computerId and `runRequestId` equal to that run's
   requestId. Inspect the returned artifact and useful result before claiming
   success; fixtures and a running Machine do not prove live inference.
6. Pause with action `pause`, computerId and a saved new requestId. Wake the
   **same computerId**, then prepare and claim a **new** dependent task such as
   `Read the existing /workspace/workflow.md before updating the next step; report the retained plan and the change.`
   Run it and retrieve its artifact. A new run requestId cannot repurchase an
   already claimed task. Record matching Machine/volume identity and retained
   file evidence across pause/wake. Explicit task status reports remain claims
   by the agent; report completion only after inspecting the actual result.

On a known admission denial, restore verified funding/current owner approval
and retry the identical provision intent. On unknown effects, inspect and
reconcile; do not allocate a replacement. Funding/reset does not renew expired or revoked
computer consent: the owner must explicitly renew the same computer before
wake/run. Durable owner consent has no arbitrary testing expiry; task TTL,
short-lived execution credentials, revocation and budget limits still apply. Pausing retains storage and its costs. Delete retains the volume;
permanent data cleanup needs its own explicit authorization and receipt.

Energy covers metered compute, retained storage and inference. A reservation is
not consumption. Inspect available, reserved, consumed and refunded amounts
separately where returned; reconciliation releases unused holds and accounts for
provider refunds. Reset changes an allowance, not purchased credit or permission.
An unresolved effect can keep a hold pending; do not release it by inventing a
new task or claim a refund before it is observed.

The current computer path uses Atlas-managed Fly Machines and API-funded Codex
execution. The owner does not log a Fly CLI into the agent's terminal or transfer
a personal model subscription. Request only selected inputs and allowed
connectors; an attached tool, Vault grant or disk file is not execution authority.
A successful run requires a readable useful artifact. Prove retained workspace
state with a later dependent task on the same computer, not only a wake receipt.



## Acceptance record

Record account/installation/Line, served guide version, computer and volume IDs,
current authority, useful task result, independently read artifact, retained files
after pause/wake, and Energy/recovery state. Mark missing gates BLOCKED or NOT_RUN,
not successful. A frontend, fixture or running Machine does not prove useful work.
