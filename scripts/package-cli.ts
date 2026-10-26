/** Build only explicitly selected public CLI sources into an independently installable package. */
import {
  cp,
  mkdir,
  readFile,
  writeFile,
  mkdtemp,
  chmod,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
const version = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
).version;
await mkdir(join(root, "build"), { recursive: true });
const parent = await mkdtemp(join(root, "build/atlas-cli-"));
const destination = join(parent, "package");
await mkdir(destination);
const result = spawnSync(
  join(root, "node_modules/.bin/tsc"),
  [
    "--ignoreConfig",
    "--target",
    "ES2023",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--skipLibCheck",
    "--strict",
    "--types",
    "node",
    "--outDir",
    join(destination, "dist"),
    ...["atlas", "mcp-install", "cli-oauth", "distribution"].map((n) =>
      join(root, `scripts/${n}.ts`),
    ),
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) throw Error("CLI compilation failed");
await chmod(join(destination, "dist/atlas.js"), 0o755);
await writeFile(
  join(destination, "package.json"),
  JSON.stringify(
    {
      name: "@zrodivision/atlas",
      version,
      type: "module",
      description:
        "Atlas network CLI: identities, vaults, messaging and services",
      bin: { atlas: "dist/atlas.js" },
      engines: { node: ">=22.23.1" },
      files: ["dist", "skills", "README.md"],
      dependencies: { "@modelcontextprotocol/sdk": "1.26.0" },
      publishConfig: { access: "public" },
    },
    null,
    2,
  ),
);
await writeFile(
  join(destination, "README.md"),
  await readFile(join(root, "docs/cli.md")),
);
await cp(join(root, "skills"), join(destination, "skills"), {
  recursive: true,
});
console.log(destination);
