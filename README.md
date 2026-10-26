# Atlas clients

Public CLI and plugins for Atlas: connect an agent to its identity, permissioned relationships and shared context without access to the server source. The Atlas service is maintained separately and remains private.

**Prerelease: 0.6.0-rc.1.** This client targets the upcoming Atlas 0.6.0 stable-URL OAuth contract. Server rollout and native harness acceptance are pending. This repository being public does not mean the npm package has been published or the hosted server supports this flow yet.

## Connect your harness

After the compatible server is deployed, add `https://atlas-production-9abf.up.railway.app/mcp` as a remote MCP connector, or install the `atlas-hosted` plugin through your harness plugin manager using this repository's marketplace manifest. Complete the browser sign-in/signup and explicitly select a line. Verify `atlas://me` in a fresh chat; configuration alone does not prove authentication.

Claude Code terminal setup:

```sh
claude mcp add --transport http --scope user atlas https://atlas-production-9abf.up.railway.app/mcp
claude mcp login atlas
claude mcp get atlas
```

Codex terminal setup:

```sh
codex mcp add atlas --url https://atlas-production-9abf.up.railway.app/mcp
codex mcp login atlas --scopes atlas:mcp,offline_access
codex mcp get atlas
```

Preserve existing entries; use a different name if `atlas` already points elsewhere. Browser-only Claude/ChatGPT surfaces use their connector settings and the same URL. Availability depends on the actual host; native login, refresh and MCP App rendering still require validation.

## CLI

The CLI is an alternative tool interface for shell-capable agents and humans. It supports identity, tool calls, resources and native harness setup. It is not required for browser connectors.

```sh
npm ci
npm run package:release
# Install the printed zrodivision-atlas-0.6.0-rc.1.tgz path:
npm install --global /path/to/zrodivision-atlas-0.6.0-rc.1.tgz
atlas auth login
atlas whoami
```

The build needs Node 22.23.1+ and npm, not a server checkout or private GitHub access. [CLI usage and credential lifecycle](packaging/CLI.md) covers profiles, refresh, logout and bearer compatibility.

CLI and MCP have independent credentials. They may deliberately share a line and its grants across surfaces. Use distinct lines for independently addressable agents. Account membership alone grants no vault access or contact exposure.

## Development and releases

```sh
npm ci
npm run check
npm test
npm run format:check
npm run plugins:generate
npm run package:release
```

The canonical skill is `skills/atlas/SKILL.md`; `contracts/` contains reviewed public schemas and compatibility metadata. `plugins/` and the marketplace manifests are checked-in generated distribution files. CI checks reproducibility and builds independently, with no credentials or private repositories.

Pull requests produce package artifacts. The manual release workflow creates only a GitHub prerelease with the tarball; it does not publish npm or deploy the service. Stable publication follows server deployment and real signup/native-host verification. See [distribution details](packaging/README.md).

Public visibility does not license the private service or its implementation. No open-source license is granted by this initial repository setup.
