import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  readdir,
  symlink,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPackage,
  installSkill,
  skillStatus,
  root,
  packageFiles,
  packageStatus,
} from "./client-package.ts";

const scratch = await mkdtemp(join(tmpdir(), "atlas-client-test-"));
try {
  const files = await packageFiles();
  const destination = join(scratch, "plugin");
  await buildPackage(destination);
  assert.equal(
    await readFile(join(destination, "skills/atlas-local/SKILL.md"), "utf8"),
    await readFile(join(root, "skills/atlas/SKILL.md"), "utf8"),
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        join(destination, "skills/atlas-local/references/tools.json"),
        "utf8",
      ),
    ),
    JSON.parse(
      await readFile(join(root, "contracts/mcp-catalog.json"), "utf8"),
    ),
  );
  assert.deepEqual(await packageStatus(destination), []);
  await writeFile(
    join(destination, "skills/atlas-local/references/tools.json"),
    "{}",
  );
  assert.deepEqual(
    await packageStatus(destination),
    ["skills/atlas-local/references/tools.json"],
    "catalog-only drift is detected even when the installed skill is current",
  );
  const hosted = await packageFiles(root, "https://atlas.example.com");
  assert.equal(
    JSON.parse(hosted[".codex-plugin/plugin.json"]).requires_local_executor,
    false,
  );
  assert.equal(
    JSON.parse(hosted[".mcp.json"]).mcpServers["atlas"].url,
    "https://atlas.example.com/mcp",
  );
  for (const invalid of [
    "http://atlas.example.com",
    "https://user:password@atlas.example.com",
    "https://atlas.example.com/path",
    "https://atlas.example.com?secret=x",
  ])
    await assert.rejects(packageFiles(root, invalid), /HTTPS origin/);
  const setup = JSON.parse(files[".mcp.json"]);
  assert.deepEqual(setup, {
    mcpServers: {
      "atlas-setup": { type: "http", url: "http://127.0.0.1:8080/mcp/connect" },
    },
  });
  assert.equal(
    Object.keys(files).length,
    7,
    "only explicitly allowed public package files",
  );
  await assert.rejects(
    buildPackage(destination),
    /EEXIST/,
    "never mix a build with prior/private files",
  );
  console.log(
    "PASS canonical package, complete catalog and setup-only authority; existing destination rejected",
  );

  const fixture = join(scratch, "repository");
  for (const path of [
    "package.json",
    "contracts/compatibility.json",
    "skills/atlas/SKILL.md",
    "contracts/mcp-catalog.json",
    "contracts/surfaces.json",
    "packaging/README.md",
  ]) {
    await mkdir(join(fixture, path, ".."), { recursive: true });
    await writeFile(join(fixture, path), await readFile(join(root, path)));
  }
  const fixtureCatalog = JSON.parse(
    await readFile(join(fixture, "contracts/mcp-catalog.json"), "utf8"),
  );
  fixtureCatalog.tools.push({ name: "atlas_new_capability" });
  await writeFile(
    join(fixture, "contracts/mcp-catalog.json"),
    JSON.stringify(fixtureCatalog),
  );
  await assert.rejects(
    packageFiles(fixture),
    /Every MCP tool/,
    "new core capability without a reviewed client decision fails packaging",
  );
  await writeFile(
    join(fixture, "contracts/mcp-catalog.json"),
    await readFile(join(root, "contracts/mcp-catalog.json")),
  );
  await writeFile(
    join(fixture, "contracts/compatibility.json"),
    JSON.stringify({ serverVersion: "0.0.0" }),
  );
  await assert.rejects(
    packageFiles(fixture),
    /versions must agree/,
    "stale server contract version fails packaging",
  );
  console.log(
    "PASS unaccounted core tools and stale server contract versions fail the release gate",
  );

  const target = join(scratch, "skill");
  assert.equal(await skillStatus(target), "missing");
  await installSkill(target);
  await writeFile(
    join(target, "SKILL.md"),
    "old locally installed instructions",
  );
  await writeFile(join(target, "private-note.txt"), "preserve unrelated file");
  assert.equal(await skillStatus(target), "stale");
  await installSkill(target);
  assert.equal(await skillStatus(target), "current");
  const backups = (await readdir(target)).filter((p) =>
    p.startsWith("SKILL.md.backup-"),
  );
  assert.equal(backups.length, 1);
  assert.equal(
    await readFile(join(target, backups[0]), "utf8"),
    "old locally installed instructions",
  );
  assert.equal(
    await readFile(join(target, "private-note.txt"), "utf8"),
    "preserve unrelated file",
  );
  await installSkill(target);
  assert.equal(
    (await readdir(target)).filter((p) => p.startsWith("SKILL.md.backup-"))
      .length,
    1,
  );
  console.log(
    "PASS missing/stale/current skill detection, backup, idempotent refresh and unrelated-file preservation",
  );

  await rm(join(target, "SKILL.md"));
  const victim = join(scratch, "victim");
  await writeFile(victim, "untouched");
  await symlink(victim, join(target, "SKILL.md"));
  await assert.rejects(installSkill(target), /non-regular/);
  assert.equal(await readFile(victim, "utf8"), "untouched");
  console.log("PASS skill installer refuses symlink replacement");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
