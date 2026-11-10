# Contributing

The client build is self-contained. Install Node 22.23.1+ and run:

```sh
npm ci
npm run check
npm test
npm run test:native
npm run format:check
npm run plugins:generate -- --check
```

The maintained skill is `skills/atlas/SKILL.md`. Regenerate checked-in plugin copies with `npm run plugins:generate`; do not edit those copies directly. Reviewed public tool schemas and service compatibility metadata live in `contracts/`.

## Release artifacts

`npm run package:native` builds for the current supported OS/CPU. It downloads the official pinned Node runtime, verifies its checksum and bundles the CLI, skill, runtime notices and installer/updater. No globally installed runtime is required by the resulting archive. Tests install that archive into temporary directories, exercise updates and rollback, check corruption rejection, and verify preservation of profiles and unrelated files.

`npm run package:release` creates the optional npm tarball and plugin marketplace export. Only explicit public files enter these packages.

The release workflow builds and tests macOS/Linux x64/ARM64 separately, combines their checksums and creates a GitHub prerelease. It does not publish npm or deploy a service. A release's native-host sign-in, refresh and rendering checks are separate from package tests.

Distribution source, public service availability and authenticated identity are distinct. Never include credentials, environment files, account data or operational logs in a release. Review client changes against `contracts/compatibility.json` and keep release claims accurate.

## Native-only candidate release gate

The source candidate is 0.14.2; the latest verified GitHub stable release is 0.14.1.
The candidate is not published. The optional npm package is not publicly published.
The active catalog excludes the seven retired carrier tools. Native Signal archive
and broker tools remain; historical call.request is unavailable. Current runtime
discovery overrides old installed guides and static references. Computer workers
remain discovery-gated source candidates, not deployed computers.

Before publication, coordinate package/lock versions, compatibility.serverVersion,
the canonical guide version, OpenAPI version and generated plugin manifests. Then
regenerate plugins, run all checks, review the exact public commit, and update the
private service's immutable public-client commit/hash pin through its own reviewed
workflow. Do not copy private implementation or account data into this repository.
A local commit, package build or pin update does not establish publication,
deployment, OAuth acceptance or end-to-end runtime execution.

The Signal OpenAPI preserves unchanged wire shapes and historical carrier receipt
fields, with explicit native-only warnings and HTTP 410 behavior. Those fields
are compatibility records, not available carrier capabilities. Native manifests
omit call.request; old grants do not bypass retirement. Do not remove historical
response fields or invent a replacement schema without a reviewed server export.


### Read-only inspection integration candidate

`0.14.2-rc.2` is an isolated client prerelease for 0.15 assembly, not the coordinated 0.15 server contract. The existing public MCP catalog and compatibility.serverVersion remain 0.14.2; only package/guide identity and OpenAPI release metadata distinguish this build. Do not update a deployed server pin to this branch without reviewing the coordinated release. `npm run test:inspection` covers read-only composition and actual CLI/OAuth transports with synthetic credentials.


### Agent-owned memory mapping

The `0.14.2-rc.2` client candidate adds offline `memory guide` and `memory examples`, a maintained mirror runbook, and schema-validated synthetic call sequences. It changes no backend route, grant, data or synchronization behavior. Run `npm run test:memory-guide` plus the full standard package/native suites. The guide is bundled with the hosted plugin; the detailed runbook is included in the npm/marketplace distribution. Final 0.15 versioning and server guide pinning remain coordinated release work.

### Agent-first setup and operation guidance

`npm run test:setup-guide` verifies offline/no-profile cold starts, schema-checked
read-only MCP examples, independent synthetic CLI profiles, repeated identity
verification and refusal to borrow another profile. Worker tests validate all
published synthetic action examples, changed server schemas and single dispatch.
These loopback fixtures do not establish real OAuth, host acceptance, deployment,
Codex pairing, hosted subscription eligibility or live provider inference. All
new guidance is bundled by the existing public CLI/plugin allowlist workflow.
