/** Build the optional npm package and plugin marketplace distribution. */
import { mkdir, mkdtemp, writeFile, readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { buildPackage } from "./client-package.js";
const root = resolve(import.meta.dirname, "..");
const origin =
  process.env.ATLAS_URL ?? "https://atlas-production-9abf.up.railway.app";
await mkdir(join(root, "build"), { recursive: true });
const parent = await mkdtemp(join(root, "build/atlas-release-"));
const marketplace = join(parent, "marketplace");
await mkdir(join(marketplace, "plugins"), { recursive: true });
await buildPackage(join(marketplace, "plugins/atlas-hosted"), origin);
const manifest = {
  name: "atlas",
  owner: { name: "Zero Division" },
  plugins: [
    {
      name: "atlas-hosted",
      source: "./plugins/atlas-hosted",
      description: "Atlas shared context and permissioned agent network",
    },
  ],
};
const codexManifest = {
  name: "atlas",
  interface: { displayName: "Atlas" },
  plugins: [
    {
      name: "atlas-hosted",
      source: { source: "local", path: "./plugins/atlas-hosted" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Productivity",
    },
  ],
};
for (const [dir, value] of [
  [".agents/plugins", codexManifest],
  [".claude-plugin", manifest],
] as const) {
  await mkdir(join(marketplace, dir), { recursive: true });
  await writeFile(
    join(marketplace, dir, "marketplace.json"),
    JSON.stringify(value, null, 2),
  );
}
await writeFile(
  join(marketplace, "README.md"),
  `# Atlas connector distribution\n\nThis tree contains the Atlas hosted plugin and marketplace manifests for Codex and Claude. Add this distribution through your harness plugin manager, install atlas-hosted, then complete browser sign-in and consent. No private server checkout is required.\n\nThe connector URL is ${origin}/mcp. You may also add that URL directly in a remote MCP client. Verify atlas://me after authorization.\n\nThe separately installable CLI uses independent credentials and may share your selected line. See [CLI usage](CLI.md). This is a release candidate export; availability in public registries and native host acceptance must be verified when releasing.\n`,
);
await writeFile(
  join(marketplace, "CLI.md"),
  await readFile(join(root, "docs/cli.md")),
);
const build = spawnSync(
  join(root, "node_modules/.bin/tsx"),
  [join(root, "scripts/package-cli.ts")],
  { encoding: "utf8" },
);
if (build.status !== 0) throw Error("CLI build failed");
const cli = build.stdout.trim().split("\n").at(-1)!;
const pack = spawnSync(
  "npm",
  ["pack", "--json", "--pack-destination", parent],
  { cwd: cli, encoding: "utf8" },
);
if (pack.status !== 0) throw Error("CLI pack failed");
const info = JSON.parse(pack.stdout)[0];
if (
  info.files.some(
    (f: { path: string }) =>
      ![
        "README.md",
        "package.json",
        "dist/atlas.js",
        "dist/cli-oauth.js",
        "dist/mcp-install.js",
        "dist/distribution.js",
        "skills/atlas/SKILL.md",
      ].includes(f.path),
  )
)
  throw Error("Unexpected public package file");
console.log(
  JSON.stringify(
    {
      directory: parent,
      marketplace,
      tarball: join(parent, info.filename),
      files: await readdir(parent),
      published: false,
    },
    null,
    2,
  ),
);
