/** Self-contained archive: official Node runtime, bundled CLI, skill and updater. */
import { build } from "esbuild";
import { officialNodeArchive } from "./node-runtime.js";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  copyFile,
  chmod,
  readdir,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const runtime = "22.23.1";
if (
  !["darwin", "linux"].includes(process.platform) ||
  !["arm64", "x64"].includes(process.arch)
)
  throw Error("Unsupported native build platform");
const platform = process.platform,
  arch = process.arch;
await mkdir(join(root, "build"), { recursive: true });
const parent = await mkdtemp(join(root, "build/native-"));
const destination = join(parent, "package");
await mkdir(join(destination, "dist"), { recursive: true });
await mkdir(join(destination, "bin"));
await mkdir(join(destination, "skills/atlas"), { recursive: true });
function run(cmd: string, args: string[]) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  if (result.status !== 0) throw Error(`${cmd} failed: ${result.stderr}`);
  return result.stdout;
}
const archive = await officialNodeArchive(
  runtime,
  platform,
  arch,
  join(root, "build/node-runtime-cache"),
  parent,
);
run("tar", [
  "-xzf",
  archive,
  "-C",
  destination,
  "--strip-components=1",
  `node-v${runtime}-${platform}-${arch}/bin/node`,
  `node-v${runtime}-${platform}-${arch}/LICENSE`,
]);
await build({
  entryPoints: [join(root, "scripts/atlas.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: join(destination, "dist/atlas.mjs"),
  banner: {
    js: 'import { createRequire as atlasCreateRequire } from "node:module"; const require = atlasCreateRequire(import.meta.url);',
  },
  legalComments: "external",
});
await writeFile(
  join(destination, "package.json"),
  JSON.stringify(
    {
      name: "@zrodivision/atlas",
      version: pkg.version,
      native: true,
      platform,
      arch,
      runtime,
    },
    null,
    2,
  ),
);
for (const file of ["install.sh", "update.sh"])
  await copyFile(join(root, file), join(destination, file));
await copyFile(
  join(root, "scripts/install-release.cjs"),
  join(destination, "install-release.cjs"),
);
await copyFile(
  join(root, "skills/atlas/SKILL.md"),
  join(destination, "skills/atlas/SKILL.md"),
);
const dependencies = run("npm", ["ls", "--omit=dev", "--all", "--parseable"])
  .trim()
  .split("\n")
  .filter((path) => path !== root);
let notices = "Atlas includes Node.js; see LICENSE for its notices.\n";
for (const path of dependencies) {
  const dep = JSON.parse(await readFile(join(path, "package.json"), "utf8"));
  notices += `\n## ${dep.name} ${dep.version} (${dep.license ?? "see package"})\n`;
  for (const file of await readdir(path))
    if (/^(license|copying|notice)(\.|$)/i.test(file))
      notices += (await readFile(join(path, file), "utf8")) + "\n";
}
await writeFile(join(destination, "THIRD_PARTY_NOTICES.txt"), notices);
await writeFile(
  join(destination, "atlas"),
  `#!/bin/sh
set -eu
script=$0
while [ -L "$script" ]; do
  dir=$(CDPATH= cd -- "$(dirname -- "$script")" && pwd -P)
  target=$(readlink "$script")
  case "$target" in /*) script=$target ;; *) script=$dir/$target ;; esac
done
here=$(CDPATH= cd -- "$(dirname -- "$script")" && pwd -P)
exec "$here/bin/node" "$here/dist/atlas.mjs" "$@"
`,
);
await chmod(join(destination, "atlas"), 0o755);
const found = run(join(destination, "atlas"), ["--version"]).trim();
if (found !== pkg.version) throw Error("Native bundle version smoke failed");
const asset = `atlas-${platform}-${arch}.tar.gz`;
const tarball = join(parent, asset);
run("tar", ["-czf", tarball, "-C", destination, "."]);
const hash = createHash("sha256")
  .update(await readFile(tarball))
  .digest("hex");
await writeFile(join(parent, "SHASUMS256.txt"), `${hash}  ${asset}\n`);
console.log(
  JSON.stringify({ directory: parent, tarball, asset, version: pkg.version }),
);
