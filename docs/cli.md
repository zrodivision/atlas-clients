# Atlas CLI

## Everyday commands

| Command | Purpose |
| --- | --- |
| `atlas auth login` | Sign in through your browser and approve a line. |
| `atlas whoami` | Verify the current account, connection and line. |
| `atlas auth status` | Show cached profile status without contacting Atlas. |
| `atlas auth logout` | Revoke this CLI connection and remove its credentials. |
| `atlas list` | List the tools available to your line. |
| `atlas read atlas://me` | Read your authenticated identity resource. |
| `atlas call TOOL '{}'` | Call an Atlas tool with JSON arguments. |
| `atlas skill install codex` | Install or refresh the bundled Codex skill. |
| `atlas skill install claude` | Install or refresh the bundled Claude Code skill. |
| `atlas install-mcp codex` | Configure Codex’s independent MCP connection. |
| `atlas install-mcp claude` | Configure Claude Code’s independent MCP connection. |
| `atlas update` | Update a standalone installation. |
| `atlas update --version VERSION` | Install a particular published version, including rollback. |
| `atlas --version` | Print the installed version. |
| `atlas workers help` | Explain the optional, discovery-gated worker client interface. |
| `atlas workers capabilities` | Inspect whether this server advertises the worker tool. Does not start work. |

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

IDs except `checkpointId` are UUIDs. Revisions and task versions are positive
integers. Do not include an `action` property; the command supplies it. Unknown
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

## Profiles and accounts

Use `ATLAS_PROFILE` to keep independent connections:

```sh
ATLAS_PROFILE=work atlas auth login
ATLAS_PROFILE=work atlas whoami
```

A profile is tied to its Atlas origin. Set `ATLAS_URL` when connecting to another HTTPS Atlas deployment. Existing profiles are not silently redirected to a different server or overwritten by another login.

Credentials live in private files in `~/.config/atlas` (override with `ATLAS_HOME`). This is file storage, not an OS keychain. Do not copy tokens into chat, shell arguments or another harness. Logout revokes the connection first; if revocation fails, credentials remain available for retry.

Commands lock their profile to avoid concurrent refresh. If a command was interrupted and left a `.lock` file, verify that no command uses that profile before removing that lock. A lost refresh response may require a new login.

## Installation and updates

The standalone installer supports macOS and glibc-based Linux on x64 and ARM64. Windows users can use WSL; native Windows and Alpine/musl packages are not provided.

By default, the executable is linked into `~/.local/bin`; versioned bundles are stored in `~/.local/share/atlas`. `ATLAS_BIN_DIR` and `ATLAS_INSTALL_DIR` can select absolute, non-symlink directories. No sudo is needed. An existing unrelated `atlas` executable is never overwritten.

The installer verifies the archive against the release's SHA-256 manifest over HTTPS. This verifies download integrity; the checksum is not a publisher signature. If download, validation or startup checks fail, the active version remains available. Previous bundles are retained; `atlas update --version VERSION` selects a published version without touching login profiles.

To follow a stable release, run `atlas update --version` with that stable version. A preview client otherwise follows the most recently published preview or stable release. Updates are explicit, not automatic background work.

## Skills and plugins

`atlas skill install codex|claude|both` installs the skill included with that CLI version. Codex uses `~/.agents/skills/atlas`; Claude Code uses `~/.claude/skills/atlas`. These are standard per-user skill locations. The command preserves unrelated files, refuses symlink targets and backs up changed `SKILL.md` files before replacing them. Updating the CLI does not silently update a separately installed skill.

The hosted plugin includes its own skill and is updated through the harness. Installing the standalone skill as well is optional and usually unnecessary. Neither skill installation nor a plugin update grants account access.

## Connection troubleshooting

- **`atlas` not found:** add the printed bin directory to your PATH, then open a new terminal.
- **Release not found:** check the published Releases page. Before the first stable release, pass an explicit preview version to the installer.
- **Login fails during preview:** the compatible Atlas 0.6.0 service must be deployed first. Installing the client cannot change server availability.
- **Wrong account or line:** inspect `atlas whoami`; use a separate profile or log out and authorize again.
- **Installed but tools absent:** reconnect the harness and start a fresh chat. Verify `atlas://me` before using account tools.

Owner-issued bearer installations remain supported through `atlas install` using private stdin. This is an advanced alternative; ordinary users should use browser login. npm distribution remains optional and requires Node.js; npm-installed clients use their package manager for updates.
