# Atlas CLI

This branch is the unreleased 0.14.2 native-only source candidate; the published baseline is 0.14.1. Cellular calls and SMS are not production capabilities. Browser app: https://connectatlas.io/app; `ATLAS_URL` remains https://connectatlas.io and MCP remains https://connectatlas.io/mcp.

## Everyday commands

| Command | Purpose |
| --- | --- |
| `atlas auth login` | Sign in through your browser and approve a line. |
| `atlas whoami` | Verify the current account, connection and line. |
| `atlas auth status` | Show cached profile status without contacting Atlas. |
| `atlas auth diagnose` | Inspect local browser-login prerequisites without reading profiles, creating access or using the network. |
| `atlas auth logout` | Revoke this CLI connection and remove its credentials. |
| `atlas list` | List the tools available to your line. |
| `atlas read atlas://me` | Read your authenticated identity resource. |
| `atlas call TOOL '{}'` | Call an Atlas tool with JSON arguments. |
| `atlas skill install codex` | Install or refresh the bundled Codex skill. |
| `atlas skill install claude` | Install or refresh the bundled Claude Code skill. |
| `atlas skill install cursor` | Install or refresh the bundled Cursor skill. |
| `atlas install-mcp codex` | Configure Codex’s independent MCP connection. |
| `atlas install-mcp claude` | Configure Claude Code’s independent MCP connection. |
| `atlas install-mcp cursor` | Print a credential-free Cursor configuration handoff; does not configure or authenticate Cursor. |
| `atlas update` | Update a standalone installation. |
| `atlas update --version VERSION` | Install a particular published version, including rollback. |
| `atlas --version` | Print the installed version. |
| `atlas workers help` | Explain the optional, discovery-gated worker client interface. |
| `atlas workers capabilities` | Inspect whether this server advertises the worker tool. Does not start work. |
| `atlas workers contract` | Emit offline JSON request schemas and semantic limits for agents. |
| `atlas workers guide` | Emit an offline agent workflow, use-case suggestions, decision points and user-facing templates. |
| `atlas workers validate ACTION JSON\|@request.json` | Validate saved candidate intent offline, without a profile or network request. |

## Computer-backed worker interface (source candidate)

This client branch adds an optional adapter for a future `atlas_workers` MCP
tool. Atlas 0.14.1 does not implement or advertise that tool. The adapter does
not install a computer, run an agent, grant authority or make the separate
runtime prototype available through the hosted service. Current servers return
`available: false`; mutation commands stop before sending a worker operation.
No catalog entry or maintained skill advertises this candidate as a deployed
capability. Server integration, reviewed contracts, versioning, the immutable
client pin and actual host/runtime acceptance remain separate work.

After ordinary browser login, use `atlas workers capabilities` to inspect the
current server's tool discovery. `available: true` means only that the tool was
advertised, not that a computer or model is ready or permission was granted.
The client requires the requested action to appear in that tool's schema and
uses the same authenticated MCP connection as `atlas call`. OAuth and
owner-issued installation profiles keep their existing authority boundaries.

Agents should read `atlas workers guide` for goal-fit suggestions, what to ask
the user, which existing answers to reuse, permission gates, recovery decisions
and how to present verified results. `atlas workers contract` exposes complete
native MCP request variants and CLI conventions as JSON. Both are offline,
require no login, and explicitly identify themselves as source-only guidance.
They never attest server capability, grant authority or start execution.

For a host-independent rehearsal, first use `atlas workers validate create
@create-request.json`. Validation works before login and returns no request
contents. `valid: true` means the local candidate accepts the request structure,
not that a server, owner, computer or model accepted it. It reports
`serverChecked: false` and `operationSent: false`. Use the same saved file for
dispatch only after current discovery and owner authority permit it. See
[the cross-harness walkthrough](computers-walkthrough.md) for the setup sequence
and evidence required before calling a worker deployed.

The candidate command is:

```sh
atlas workers create @create-request.json
atlas workers inspect '{"workerId":"11111111-1111-4111-8111-111111111111"}'
```

Supply either a JSON object or an exact `@request.json` regular file of at most
64 KiB. Using a file keeps long task prompts out of shell arguments and helps
retain exact intent for recovery. The CLI reads but never rewrites it. Do not
include credentials, secret values, owner sessions or permission approvals in
worker arguments. The file is not a secret store.

The adapter currently understands these candidate fields; deployed backend
authority and validation remain decisive:

| Action | Fields |
| --- | --- |
| `create` | `workerId`, `requestId`, `lineId`, `label` |
| `inspect` | `workerId` |
| `run` | `workerId`, `requestId`, `expectedRevision`, `taskId`, `taskVersion`, `prompt` |
| `cancel` | `workerId`, `requestId`, `expectedRevision` |
| `checkpoint` | `workerId`, `requestId`, `expectedRevision` |
| `restore` | `workerId`, `requestId`, `expectedRevision`, `checkpointId` |

IDs except `checkpointId` are RFC UUIDs with version 1–8 and variant 8, 9, a or b,
without whitespace. Revisions and task versions are positive safe integers.
Labels are nonblank and at most 80 UTF-16 code units; prompts are nonblank and
at most 32 KiB of UTF-8. Neither may contain NUL. Checkpoint IDs are `v` followed
by 1–20 digits and must come from the selected worker's checkpoint response.
Do not include an `action` property; the command supplies it. Unknown
fields and missing saved mutation request IDs are rejected before connecting.
The tool cannot be used to impersonate an owner, select a credential, authorize
a provider or inherit the daily driver's private tools, history or data grants.

Save the entire request before mutating. The CLI makes one tool call and never
automatically retries, changes a request ID, resumes a worker or polls in the
background. After a lost reply, inspect the saved worker ID and reconcile the
operation through the backend's documented recovery protocol. Do not create a
new request to repeat an uncertain external effect. A revision conflict needs
fresh inspection and an intentional decision, not automatic rebasing.

Runtime results are returned unchanged. Admission, provisioning, an active
process, model completion, task outcome and artifact verification are distinct.
Cancellation is a request until the runtime confirms stopping; checkpoints do
not promise browser, network or in-flight operation restoration. `UNCERTAIN`
must remain uncertain. Tool-level errors exit nonzero. Local fixture tests
prove only adapter behavior, not production worker execution or native host
acceptance. Listing workers, logs and artifacts needs a separately reviewed
server contract and is not supplied by these aliases.

Local worker validation and discovery failures emit JSON diagnostics on stderr
and exit nonzero. `worker_request_fields_invalid` includes known missing and
allowed field names plus an unsupported-field count, without echoing request
values or unknown keys. `worker_capability_unavailable`,
`worker_discovery_ambiguous` and `worker_discovery_incomplete` mean no worker
operation was sent. Tool responses remain unchanged; do not treat a local
validation success as a remote receipt.

## Profiles and accounts

Use `ATLAS_PROFILE` to keep independent connections:

```sh
ATLAS_PROFILE=work atlas auth login
ATLAS_PROFILE=work atlas whoami
```

A profile is tied to its Atlas origin. Set `ATLAS_URL` when connecting to another HTTPS Atlas deployment. Existing profiles are not silently redirected to a different server or overwritten by another login.

Credentials live in private files in `~/.config/atlas` (override with `ATLAS_HOME`). This is file storage, not an OS keychain. Do not copy tokens into chat, shell arguments or another harness. Logout revokes the connection first; if revocation fails, credentials remain available for retry.

Before attempting CLI login on a cloud or remote computer, run
`atlas auth diagnose`. It emits JSON local prerequisites without reading a
profile, opening a browser, binding a port or contacting Atlas. A possible
local flow is not proof of browser or server access. Remote sessions and
explicit browser handlers are unverified warnings; a missing launcher or
missing Linux display/browser handler blocks the automatic flow before any
OAuth request or profile creation. Login then emits
`ATLAS_LOCAL_BROWSER_LOGIN_BLOCKED` with safe next steps.

The CLI uses authorization-code PKCE with an ephemeral `127.0.0.1` callback.
The approving browser must reach the CLI's own loopback address. Device
authorization and manual callback entry are not implemented. Use native
hosted MCP sign-in for a hosted agent, or run the separate CLI connection on
a computer with a reachable local browser. Never borrow a native host token.

Commands lock their profile to avoid concurrent refresh. If a command was interrupted and left a `.lock` file, verify that no command uses that profile before removing that lock. A lost refresh response may require a new login.

## Installation and updates

The standalone installer supports macOS and glibc-based Linux on x64 and ARM64. Windows users can use WSL; native Windows and Alpine/musl packages are not provided.

By default, the executable is linked into `~/.local/bin`; versioned bundles are stored in `~/.local/share/atlas`. `ATLAS_BIN_DIR` and `ATLAS_INSTALL_DIR` can select absolute, non-symlink directories. No sudo is needed. An existing unrelated `atlas` executable is never overwritten.

The installer verifies the archive against the release's SHA-256 manifest over HTTPS. This verifies download integrity; the checksum is not a publisher signature. If download, validation or startup checks fail, the active version remains available. Previous bundles are retained; `atlas update --version VERSION` selects a published version without touching login profiles.

To follow a stable release, run `atlas update --version` with that stable version. A preview client otherwise follows the most recently published preview or stable release. Updates are explicit, not automatic background work.

## Skills and plugins

`atlas skill install codex|claude|cursor|both` installs the skill included with that CLI version. Codex uses `~/.agents/skills/atlas`; Claude Code uses `~/.claude/skills/atlas`; Cursor uses `~/.cursor/skills/atlas`. `both` retains its existing meaning: Codex and Claude Code only. These are standard per-user skill locations. The command preserves unrelated files, refuses symlink targets and backs up changed `SKILL.md` files before replacing them. Updating the CLI does not silently update a separately installed skill.

`atlas install-mcp cursor` prints the `mcpServers` entry to merge into
`~/.cursor/mcp.json`, plus verification instructions. It does not write that
file, replace existing entries, copy CLI credentials or start login. Complete
native authentication in Cursor's MCP settings, or with the documented
`agent mcp login atlas` command when that CLI is installed. Restart or open a
fresh chat, load `/atlas`, discover tools and read `atlas://me` to verify the
selected account and line. Native Cursor OAuth and UI acceptance must be
tested separately; printed JSON is not evidence of a connected client.

The hosted plugin includes its own skill and is updated through the harness. Installing the standalone skill as well is optional and usually unnecessary. Neither skill installation nor a plugin update grants account access.

## Connection troubleshooting

- **`atlas` not found:** add the printed bin directory to your PATH, then open a new terminal.
- **Release not found:** check the published Releases page. Before the first stable release, pass an explicit preview version to the installer.
- **Login fails during preview:** the compatible Atlas 0.6.0 service must be deployed first. Installing the client cannot change server availability.
- **Wrong account or line:** inspect `atlas whoami`; use a separate profile or log out and authorize again.
- **Installed but tools absent:** reconnect the harness and start a fresh chat. Verify `atlas://me` before using account tools.

Owner-issued bearer installations remain supported through `atlas install` using private stdin. This is an advanced alternative; ordinary users should use browser login. npm distribution remains optional and requires Node.js; npm-installed clients use their package manager for updates.


## Combined read-only inspection (0.15 preparation)

`atlas inspect` observes the selected CLI connection, scoped memory access and Signal archive status together. To include a known computer, use `atlas inspect '{"workerId":"11111111-1111-4111-8111-111111111111"}'`. An optional `vaultId` limits the displayed memory selection and Signal discovery. `atlas inspect --help` requires no profile or network.

This unreleased 0.14.2-rc.4 client builds toward 0.15 while retaining the reviewed 0.14.2 wire catalog. It does not publish a new server contract. Discovery is paginated and bounded; duplicate or incomplete discovery sends no inspection calls. Only advertised read tools are called. A failed identity read blocks the remaining sections. Individual permission, compatibility and transport failures are reported without raw server errors or automatic retries.

Reports contain bounded allowlisted metadata, not memory contents, prompts, provider credentials or runtime logs. They are independent reads and may differ if permissions change between calls. Missing tools, a denied read or a non-selected computer makes the report partial, never an empty-resource assertion. The computer adapter remains unavailable on current production and cannot be enabled by this command. No worker creation, mutation, Signal refresh or connector search occurs. Native MCP plugin users can follow the equivalent workflow in the bundled skill without a separate CLI login.

Signal and computers are independent. No worker selection is needed for Signal status. The archive report explicitly leaves standalone representative messaging and calling readiness unassessed; it is not a live-representative acceptance test.


## Map a memory system to Vault

`atlas memory guide` is an offline agent-facing field map and reconciliation runbook. It covers stable source IDs, durable local mapping/receipt state, import versus deliberate edits, unchanged-payload checks, exact-request retries, conflicts, deletion limitations and read/export boundaries. `atlas memory examples` returns complete synthetic first-import, update, exact-retry, read and export calls validated against the checked-in public MCP schemas. Both commands work without a profile and do not inspect local memories or contact Atlas. There is no `memory sync` runner.

See [the mirror workflow](vault-mirroring.md) for scope, normal operation and remaining service gaps. Native hosted-plugin agents use the same guidance in the canonical skill and call only currently advertised Vault tools under the user's explicit transfer scope.

## Machine-readable cold start (source candidate)

`atlas setup guide` (also `atlas setup --help`) returns offline JSON without reading
profiles or contacting Atlas. It selects native MCP or standalone CLI setup, gives
schema-checked read-only verification examples, separates independent installations
from deliberately shared Lines and explains pending/revoked/stale recovery.
`atlas setup` retains its Console link. Extra setup arguments fail without side effects.

The Personal Computer section records conversation → assembly → deployment →
pairing → interaction as acceptance stages, not executable verbs. Codex pairing is
conditional on the actual supported deployment and authentication model. A separate
platform-funded Luna fallback requires explicit selection and its own adapter,
budget and authority. No provider credentials or model-selection fields are added.

`atlas workers contract` includes synthetic examples for each of the six existing
actions, precise descriptions, authority checks and safe recovery. The examples are
not a lifecycle sequence. `atlas workers ACTION --help` gives the corresponding
example and contract. Before dispatch the CLI validates against live discovery;
`worker_contract_mismatch` means the current request/schema could not be validated
and no worker operation was sent. It does not mean the remote deployment is broken.
Inspect the server guide before preparing a deliberate new intent. Response loss,
revocation and stale revisions never trigger automatic mutation retries.
