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

The active package catalogue excludes retired carrier tools. Native Signal
archive and broker tools remain. Computer capability is discovered dynamically
on the authenticated server; package contents do not establish deployment,
current permission, runtime readiness or live acceptance.

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


### Current-only agent guidance

`skills/atlas/SKILL.md` is the canonical installed and served guide. Keep it about
current supported usage, not accumulated release notes or retired deployment
paths. Preserve precise identity, grants, idempotency, Energy and recovery rules.
`atlas setup guide` and compatibility help must direct agents to the same current
computer workflow. Do not publish subscription-pairing or provider-console workarounds.

Update the client version, OpenAPI release metadata and lockfile together when
guide text changes. Regenerate plugins with `npm run plugins:generate`; do not edit
copies. Coordinate the immutable atlas-core client pin and byte-identical served
copy only after review. Publication and deployment remain separate actions.

Run `npm run check`, `npm test`, `npm run format:check` and generated-plugin parity.
`test:current-guidance` protects current lifecycle coverage and prevents retired
instructions leaking through installed guides or compatibility help. Static
catalogue entries are reviewed public schemas; dynamically advertised computer
tools must be checked against their implemented server contract. Do not fabricate
availability by adding a schema to a plugin.
