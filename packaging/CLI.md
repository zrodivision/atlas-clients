# Atlas CLI

Release candidate: build and review the tarball before publishing. Registry availability is not implied by this repository.

After installation (`npm install -g @zrodivision/atlas` for a published release):

```
atlas auth login
atlas whoami
atlas list
atlas read atlas://me
atlas call atlas_contacts_list '{}'
atlas auth status
atlas auth logout
```

Browser sign-in creates or selects an Atlas account and asks you to select a line. Use an existing line for the same harness across surfaces. An independent agent gets an independent line. Vault grants and contact exposure remain explicit owner decisions. The CLI has the same line authority as MCP; it is not limited to setup.

Use ATLAS_URL to select an HTTPS deployment and ATLAS_PROFILE for named connections. Profiles pin the origin and are stored in a mode-0700 ATLAS_HOME directory (default ~/.config/atlas), with mode-0600 files. This is private file storage, not an OS keychain. Never copy tokens between the CLI and a host MCP connection. All commands lock the profile, including token refresh; concurrent commands fail rather than race a refresh. If a process crashes, remove its exact .lock file only after verifying no command still uses that profile. Refresh-token replay revokes that grant. Lost refresh responses may require a new login. Logout first revokes the grant; failure preserves local credentials for retry. Status shows cached identity; whoami verifies current authority. A new profile is required to preserve an existing connection while authorizing another.

`atlas install-mcp codex|claude [--name NAME]` configures the stable hosted MCP URL using the native host CLI and starts native OAuth. The host owns its credentials independently of CLI profiles. It preserves differently targeted entries by requiring a new name. A fresh chat may be needed; verify atlas://me there. Browser-only connectors do not need this command.

Legacy owner-issued bearers remain supported by `atlas install` (private stdin), using separate profiles. Controller and Pi retain their explicit bearer configuration.
