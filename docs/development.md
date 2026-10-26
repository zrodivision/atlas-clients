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
