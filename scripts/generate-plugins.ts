/** Regenerate only known public distribution paths. */
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { packageFiles, root } from "./client-package.js";
const origin = "https://atlas-production-9abf.up.railway.app";
const generated = await packageFiles(root, origin);
const files: Record<string, string> = Object.fromEntries(
  Object.entries(generated).map(([p, v]) => ["plugins/atlas-hosted/" + p, v]),
);
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
files[".claude-plugin/marketplace.json"] = json({
  name: "atlas",
  owner: { name: "Zero Division" },
  plugins: [
    {
      name: "atlas-hosted",
      source: "./plugins/atlas-hosted",
      description: "Atlas shared context and permissioned agent network",
    },
  ],
});
files[".agents/plugins/marketplace.json"] = json({
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
});
const checking = process.argv.includes("--check");
for (const [p, contents] of Object.entries(files)) {
  const path = join(root, p);
  if (checking) {
    if ((await readFile(path, "utf8").catch(() => "")) !== contents)
      throw Error("Generated file differs: " + p);
  } else {
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, contents);
  }
}
// Unexpected files inside the generated plugin must be deliberately reviewed, not silently shipped.
for (const entry of await readdir(join(root, "plugins/atlas-hosted"), {
  recursive: true,
  withFileTypes: true,
})) {
  if (entry.isFile()) {
    const path = join(entry.parentPath, entry.name).slice(root.length + 1);
    if (!(path in files)) throw Error("Unexpected plugin file: " + path);
  }
}
console.log(
  checking
    ? "Generated plugins match source"
    : "Generated hosted plugin and marketplace manifests",
);
