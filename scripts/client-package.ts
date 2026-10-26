/** Reproducible, credential-free client package and explicit local skill refresh. */
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  rename,
  lstat,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFile(join(root, path), "utf8");
export const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export async function packageFiles(repository = root, hostedOrigin?: string) {
  if (hostedOrigin) {
    const url = new URL(hostedOrigin);
    if (
      url.protocol !== "https:" ||
      url.origin !== hostedOrigin ||
      url.username ||
      url.password
    )
      throw new Error("Hosted package requires an exact HTTPS origin");
  }
  const name = hostedOrigin ? "atlas-hosted" : "atlas-local";
  const read = (path: string) => readFile(join(repository, path), "utf8");
  const pkg = JSON.parse(await read("package.json"));
  const skill = await read("skills/atlas/SKILL.md");
  const catalog = JSON.parse(await read("contracts/mcp-catalog.json"));
  const coverage = JSON.parse(await read("contracts/surfaces.json"));
  const names = catalog.tools.map((t: { name: string }) => t.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(coverage).sort()))
    throw new Error(
      "Every MCP tool needs an explicit client surface decision in contracts/surfaces.json",
    );
  for (const [name, surface] of Object.entries(coverage))
    if (typeof surface !== "string" || !surface.trim())
      throw new Error(`Missing surface decision: ${name}`);
  const compatibility = JSON.parse(await read("contracts/compatibility.json"));
  if (pkg.version.split("-")[0] !== compatibility.serverVersion)
    throw new Error("Client and declared server contract versions must agree");
  const manifest = {
    name,
    version: pkg.version,
    description:
      "Atlas identities, permissioned messaging, memory and owner-approved runtimes.",
    author: { name: "Zero Division" },
    repository: "https://github.com/zrodivision/atlas-clients",
    skills: "./skills/",
    mcpServers: "./.mcp.json",
  };
  const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
  return {
    ".codex-plugin/plugin.json": json({
      ...manifest,
      requires_local_executor: !hostedOrigin,
    }),
    ".claude-plugin/plugin.json": json(manifest),
    ".mcp.json": json({
      mcpServers: {
        [hostedOrigin ? "atlas" : "atlas-setup"]: {
          type: "http",
          url: hostedOrigin
            ? `${hostedOrigin}/mcp`
            : "http://127.0.0.1:8080/mcp/connect",
        },
      },
    }),
    [`skills/${name}/SKILL.md`]: hostedOrigin
      ? skill.replace("name: atlas-local", "name: atlas-hosted")
      : skill,
    [`skills/${name}/references/tools.json`]: json(catalog),
    "README.md": hostedOrigin
      ? `# Atlas hosted connector\n\nInstall this plugin through your harness plugin manager and complete its native browser OAuth. The connector URL is ${hostedOrigin}/mcp. No Atlas source checkout or CLI is required.\n\nSign in or sign up, name your Atlas account, and approve an existing line or create an independent one. Surfaces of the same harness can share a line and its grants; each connection has its own credentials. Vault access and contact exposure remain explicit owner decisions.\n\nIn a fresh chat, read atlas://me to verify account and line, then use atlas_console where MCP Apps are supported. Installing configuration alone does not establish authentication. Disconnect individual connections in Atlas Console.\n\nThis package includes workflow guidance and generated tool references. The Atlas service owns data and authorization. Never put tokens in plugin files. Release candidate ${pkg.version}: package generation does not establish deployment or native-host acceptance.\n`
      : await read("packaging/README.md"),
    "release.json": json({
      version: pkg.version,
      skillSha256: digest(skill),
      catalogSha256: digest(json(catalog)),
      surfaces: coverage,
    }),
  };
}
export async function buildPackage(destination: string, hostedOrigin?: string) {
  // Exclusive directory creation avoids mixing stale or private files into a package.
  const files = await packageFiles(root, hostedOrigin);
  await mkdir(destination, { recursive: false });
  for (const [path, text] of Object.entries(files)) {
    const target = join(destination, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text, { flag: "wx" });
  }
  return destination;
}
export async function packageStatus(directory: string, hostedOrigin?: string) {
  const mismatches: string[] = [];
  for (const [path, expected] of Object.entries(
    await packageFiles(root, hostedOrigin),
  )) {
    const actual = await readFile(join(directory, path), "utf8").catch(
      (error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      },
    );
    if (actual !== expected) mismatches.push(path);
  }
  return mismatches;
}
export async function skillStatus(directory: string) {
  const expected = await read("skills/atlas/SKILL.md");
  const actual = await readFile(join(directory, "SKILL.md"), "utf8").catch(
    (error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    },
  );
  return actual === null
    ? "missing"
    : actual === expected
      ? "current"
      : "stale";
}
export async function installSkill(directory: string) {
  await mkdir(directory, { recursive: true });
  if ((await lstat(directory)).isSymbolicLink())
    throw new Error("Refusing a symlink skill directory");
  const target = join(directory, "SKILL.md");
  const stat = await lstat(target).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (stat && !stat.isFile())
    throw new Error("Refusing a non-regular skill file");
  if ((await skillStatus(directory)) === "current") return;
  if (stat)
    await writeFile(
      join(directory, `SKILL.md.backup-${randomUUID()}`),
      await readFile(target),
      { flag: "wx", mode: 0o600 },
    );
  const staged = join(directory, `.SKILL-${randomUUID()}.tmp`);
  await writeFile(staged, await read("skills/atlas/SKILL.md"), {
    flag: "wx",
    mode: 0o600,
  });
  await rename(staged, target);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command = "build", directory, hostedOrigin] = process.argv.slice(2);
  if (command === "build" || command === "build-hosted") {
    if (command === "build-hosted" && !directory)
      throw new Error("build-hosted requires an HTTPS origin");
    await mkdir(join(root, "build"), { recursive: true });
    const staging = await mkdtemp(join(root, "build/atlas-client-"));
    console.log(
      await buildPackage(
        join(
          staging,
          command === "build-hosted" ? "atlas-hosted" : "atlas-local",
        ),
        command === "build-hosted" ? directory : undefined,
      ),
    );
  } else if (command === "package-status") {
    if (!directory)
      throw new Error("package-status requires the installed plugin directory");
    const mismatches = await packageStatus(resolve(directory), hostedOrigin);
    console.log(
      mismatches.length
        ? `Stale/missing package files: ${mismatches.join(", ")}`
        : "Atlas package matches this checkout. Host discovery/rendering still need verification.",
    );
    if (mismatches.length) process.exitCode = 1;
  } else if (command === "status" || command === "install-skill") {
    const target = resolve(
      directory || join(homedir(), ".codex/skills/atlas-local"),
    );
    if (command === "install-skill") await installSkill(target);
    const status = await skillStatus(target);
    console.log(
      `Atlas skill: ${status} (${target}). MCP configuration and host tool discovery are separate; reconnect the host after refresh.`,
    );
    if (status !== "current") process.exitCode = 1;
  } else
    throw new Error(
      "Use build, package-status plugin-directory, status [skill-directory], or install-skill [skill-directory]",
    );
}
