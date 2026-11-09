# Build and deploy a computer worker with Atlas

## Honest demo boundary

The published client baseline is 0.14.1. This branch adds unreleased Cursor
setup and worker validation commands. The `atlas_workers` lifecycle is a
source candidate, not an advertised hosted capability. A successful client
installation is not a deployed worker. Until the server advertises the
capability and an operator proves the runtime ready, stop at the capability
gate below. Do not substitute the older bounded text-inference service and
describe it as a general computer worker.

The same intent and receipts must work in Claude Code, Codex/Dots and Cursor.
Only native installation and consent differ. The daily-driver harness need
not match the worker's execution harness.

## 1. Connect the daily driver

Use a reviewed release or the reviewed source candidate. A checkout-only
command is `npm run atlas -- ...`; do not assume a published installation
contains branch-only commands.

- Claude Code: `atlas skill install claude`, then `atlas install-mcp claude`.
- Codex: `atlas skill install codex`, then `atlas install-mcp codex`.
- Cursor: `atlas skill install cursor`, then `atlas install-mcp cursor`.
  Merge its printed entry into `~/.cursor/mcp.json` without overwriting other
  entries. Complete OAuth in Cursor's MCP settings. The printed handoff does
  not write configuration or establish authentication.
- Hosted Dots: connect the remote MCP service at
  `https://connectatlas.io/mcp`, complete its own consent, and read the served
  guide. Do not assume a local skill or CLI profile exists on a cloud worker.

Open a fresh conversation, discover tools, inspect registration and read
`atlas://me`. Confirm the exact account, installation and line with the owner.
Read the current guide at `atlas://guides/atlas`; the server reports its
version. Refresh stale installed guidance explicitly.

If using the CLI in addition to MCP, `atlas auth login` obtains a separate
credential; `atlas whoami` verifies it. Sharing a line is deliberate, not
credential copying. CLI browser login currently requires a browser and
loopback callback on that same computer. A hosted MCP connection does not
automatically solve headless CLI sign-in. Neither installing a skill nor
authenticating grants computer execution, contacts, vaults or spending.

## 2. Turn the idea into bounded work

Use this starting request in any harness:

> Help me build a computer worker for this goal: [goal]. First inspect Atlas
> identity, guide and current capabilities. Propose the exact inputs, intended
> output, allowed tools and data, compute/model budget, deadline and cleanup.
> Show me what needs approval. Do not deploy or claim success until authority
> is verified and there is a terminal task receipt plus a checked artifact.

Agree on a small first task and verifiable result. For example, use only an
owner-selected synthetic input and produce a local report. Keep external
messages, production access and paid effects outside the first test unless
the owner explicitly approves them. The task's request text is not a grant.

## 3. Stop at current capability and authority gates

Run `atlas workers capabilities` in a logged-in CLI, or inspect the native
MCP tool list. If `atlas_workers` is absent, report that blocker and stop.
An advertised tool alone does not prove a runtime, model or grant is ready.
Inspect the advertised schema and current owner authorization before use.

For the source candidate, the operator still must provide a trusted dispatch
bridge, installed runtime, protected durable storage, isolated credentials,
whole-job stop evidence and current data/tool/result adapters. These are
server/runtime release gates, not permissions an agent can grant itself.
The canonical skill, public schemas, server pin and released client must be
versioned together before teaching installed agents this lifecycle as live.

## 4. Rehearse the exact request offline

Save a credential-free request as `create-request.json`:

```json
{
  "workerId": "11111111-1111-4111-8111-111111111111",
  "requestId": "22222222-2222-4222-8222-222222222222",
  "lineId": "33333333-3333-4333-8333-333333333333",
  "label": "Demo computer"
}
```

These IDs are synthetic test data, not an authorized line. For a real task,
select the exact authorized line and generate fresh UUIDs for new worker and
request identities. Then retain that complete request for identical recovery.

```sh
atlas workers validate create @create-request.json
```

This runs without login, writes nothing, sends nothing and does not echo the
request. A valid result is structural validation only. Use the same local
validator for `inspect`, `run`, `cancel`, `checkpoint` and `restore`; see
[the request field table](cli.md#computer-backed-worker-interface-source-candidate).
Validation is not server acceptance and does not create a canonical task.

## 5. Execute only once the live gates are met

Use only currently advertised actions and the server's reviewed workflow:

1. Create the worker with the retained request. Inspect its exact ID and state.
2. Create or select an authorized canonical task using the current task tools.
   A random task UUID is not a task. Read its current admission version.
3. Save a run request with that task ID/version, current worker revision and
   bounded prompt. Validate it, then submit it once.
4. Inspect state and durable receipts. Admission, provisioned compute, an
   active process, model completion, business-task completion and verified
   artifacts are separate claims. Read the artifact before saying it works.
5. Exercise the approved cancellation and cleanup path. Cancellation is a
   request until whole-job stopping is confirmed. Ending the daily-driver
   chat does not stop the remote worker or prove billing stopped.

After a lost reply, inspect the saved worker ID and use the server's documented
recovery path. Do not mint a new request ID, blindly replay an effect, change
identities to bypass revocation or automatically rebase a stale revision.
Keep `UNCERTAIN` outcomes uncertain. Checkpoint restoration does not restore
in-flight external effects or grant new permissions.

## Walkthrough acceptance record

For each of Claude Code, Codex/Dots and Cursor, record:

- Client and served-guide versions; exact verified installation and line.
- Native authentication and fresh tool discovery, not just configuration.
- Local invalid-request refusal and missing-capability refusal.
- For an authorized live trial: one exact create/run, terminal canonical
  receipt, verified artifact, interruption/recovery and confirmed cleanup.
- What was tested locally, simulated, deployed or not tested.

Do not mark the walkthrough complete from package tests alone. Cursor native
OAuth/UI, hosted Dots orchestration, live compute/model execution and cleanup
require their own observed acceptance.

Host references: [Cursor skills](https://cursor.com/docs/skills),
[Cursor MCP](https://cursor.com/docs/mcp), and
[Cursor CLI MCP authentication](https://cursor.com/docs/cli/mcp).
