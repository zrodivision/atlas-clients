# Atlas

Connect your assistant to the context, people and agents you choose. Use Atlas from your terminal, or connect it directly to your assistant through MCP.

Source is unreleased `0.7.2` for server `0.7.2`; deployed 0.7.1 does not include draft handoffs. Publishing a release, deploying the service and native host acceptance are separate steps. Until a stable release exists, the installer selects the newest published preview; pass `--version vX.Y.Z-rc.N` to pin one.

For remote MCP, open your harness’s custom connector settings, add the hosted `/mcp` URL, choose OAuth and approve in the browser. No Atlas CLI, plugin or source build is required. CLI installation below is optional.

## Install

macOS (Apple Silicon or Intel) and Linux (ARM64 or x64, glibc; including WSL):

```sh
curl -fsSL https://raw.githubusercontent.com/zrodivision/atlas-clients/main/install.sh | sh
```

No Node.js, npm or source checkout is required. The installer downloads a versioned bundle, verifies its SHA-256 checksum and installs `atlas` for your user without sudo. If your shell cannot find it, add the installer’s printed bin directory to your PATH.

You can install the Atlas skill at the same time. Choose your harness:

```sh
# Codex
curl -fsSL https://raw.githubusercontent.com/zrodivision/atlas-clients/main/install.sh | sh -s -- --skills codex

# Claude Code: use --skills claude. To install for both: --skills both.
```

## Sign in and use Atlas

Once the compatible service is available:

```sh
atlas auth login
atlas whoami
atlas list
atlas read atlas://me
```

Your browser opens for sign-in or signup. Choose an existing line to share its identity and permissions, or create a separate line for an independent agent. Return to your terminal after approval.

A CLI login and an MCP connection have separate credentials. They can share the same line. Neither automatically grants access to vault contents, contacts or paid services.

## Add the skill

The skill teaches your assistant how to use Atlas tools and respect account permissions. It is included in every CLI bundle and in the hosted plugin.

```sh
atlas skill install codex
atlas skill install claude
# Or: atlas skill install both
```

Start a fresh chat after installation. Changed skill files are backed up before replacement; unrelated skills and files are preserved. Skill installation does not sign you in or change MCP credentials. If you already use the Atlas plugin, its bundled skill is sufficient. Remote connectors with no installed skill read the same guide from the server at `atlas://guides/atlas`. The server reports its guide version, so an assistant can tell when an installed skill is stale.

## Connect your assistant with MCP

Browser-only assistants do not need the CLI. In the assistant’s connector or remote MCP settings, add:

```text
https://atlas-production-9abf.up.railway.app/mcp
```

Complete browser authorization, then ask the assistant to read `atlas://me` and confirm your account and line. This requires the server rollout noted above.

For terminal harnesses, the CLI can configure the connection using the harness’s own commands:

```sh
atlas install-mcp codex
atlas install-mcp claude
```

If an existing `atlas` entry points elsewhere, preserve it and use `--name another-name`. The harness owns its OAuth credentials; the CLI does not copy them.

You can also add `zrodivision/atlas-clients` through your harness’s plugin marketplace flow and select **atlas-hosted**. The plugin bundles the connector configuration and skill. Host support varies; verify the connection rather than assuming installation means sign-in succeeded.

## Update

```sh
atlas update
```

Preview installations follow published preview releases; stable installations follow stable releases. Updates replace the CLI atomically and preserve your login profiles. Refresh a separately installed skill explicitly:

```sh
atlas skill install codex
```

To pin a version or roll back:

```sh
atlas update --version v0.6.0-rc.2
```

Plugin updates are managed by your harness. CLI updates do not alter installed plugins or their credentials.

## More

- [CLI commands, profiles and troubleshooting](docs/cli.md)
- [Releases and downloads](https://github.com/zrodivision/atlas-clients/releases)
- [Atlas skill](skills/atlas/SKILL.md)

<details>
<summary>Build from source</summary>

Node 22.23.1+ and npm are needed only for development:

```sh
npm ci
npm run check
npm test
npm run test:native
npm run package:native
```

See [contributing and release checks](docs/development.md).
</details>

## Try your own two-agent handoff

With server 0.6.2, connect Codex and Claude through the hosted `/mcp` custom connector and approve distinct lines on your Atlas account. No CLI, plugin or source install is needed for remote MCP. `atlas_contacts_list` returns your other active lines in `ownLines`; send a memo to the intended line ID and ask that harness to check its inbox. No email invitation is needed. Shared-line connections share identity; draft server 0.7.2 adds explicit passive `atlas_handoffs_leave` notes with expiry. Resume a named consumer by installation-scoped clientKey, check explicitly, then acknowledge only for that consumer. Ordinary self-send remains rejected; discover same-line registered labels/keys, disambiguate duplicates and supply recipient to target a consumer. Labels are claimed metadata, not host-session attestation. Vault seeding/sharing still requires explicit line grants, and messages never wake a harness or authorize execution. Cross-account messaging still requires acceptance and line exposure. Native host support and deployed server version must be checked separately.

With server 0.6.3, ordinary inbox checks use `atlas_inbox_check` without an endpoint: each installation has a durable default consumer. Fetching leaves a message pending until explicitly acknowledged. Sessions sharing the same installation share that state; other connections do not. Check recent history when a new session needs an already acknowledged briefing. Token refresh keeps state; a new OAuth installation starts independently. Messages are pulled, never automatic harness wake-ups.

Native builds keep verified Node archives in ignored `build/node-runtime-cache`, keyed by the pinned runtime version, platform and architecture. Every build fetches the checksum manifest again from the same official `nodejs.org` version URL and verifies an isolated copy before extraction; neither a cache hit nor a partial download is trusted. Transient transfers get at most three attempts, with a 20-second connection limit, 300-second attempt limit and a 30-second low-speed cutoff below 16 KiB/s. Archive retries resume partial bytes; a rejected Range request falls back to a fresh download. HTTP authorization/errors and checksum failures fail closed. The CI cache avoids downloading the same runtime again for native tests and distributable packaging. Runtime version, source and checksum verification are unchanged.
