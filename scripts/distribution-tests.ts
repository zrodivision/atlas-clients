/** Skill installs are tested only in disposable home directories. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  realpath,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
  link,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const scratch = await realpath(await mkdtemp(join(tmpdir(), "atlas-skills-")));
const run = (home: string, ...args: string[]) =>
  spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/atlas.ts", "skill", "install", ...args],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, HOME: home, USERPROFILE: home },
    },
  );
try {
  const home = join(scratch, "home");
  await mkdir(join(home, ".cursor"), { recursive: true });
  const config = join(home, ".cursor/mcp.json");
  await writeFile(config, '{"unrelated":"keep-me"}');
  const first = run(home, "cursor");
  assert.equal(first.status, 0, first.stderr);
  const directory = join(home, ".cursor/skills/atlas");
  const path = join(directory, "SKILL.md");
  const expected = (
    await readFile(join(root, "skills/atlas/SKILL.md"), "utf8")
  ).replace("name: atlas-local", "name: atlas");
  assert.equal(await readFile(path, "utf8"), expected);
  assert.equal(await readFile(config, "utf8"), '{"unrelated":"keep-me"}');
  assert.equal(run(home, "cursor").status, 0);
  assert.deepEqual(await readdir(directory), ["SKILL.md"]);
  await writeFile(path, "custom skill");
  assert.equal(run(home, "cursor").status, 0);
  const backups = (await readdir(directory)).filter((x) =>
    x.startsWith("SKILL.md.backup-"),
  );
  assert.equal(backups.length, 1);
  assert.equal(
    await readFile(join(directory, backups[0]), "utf8"),
    "custom skill",
  );
  assert.equal(await readFile(path, "utf8"), expected);
  assert.notEqual(run(home, "unknown").status, 0);
  assert.notEqual(run(home, "cursor", "extra").status, 0);
  const both = join(scratch, "both");
  assert.equal(run(both, "both").status, 0);
  assert.equal(
    await readFile(join(both, ".agents/skills/atlas/SKILL.md"), "utf8"),
    expected,
  );
  assert.equal(
    await readFile(join(both, ".claude/skills/atlas/SKILL.md"), "utf8"),
    expected,
  );
  assert.deepEqual((await readdir(both)).sort(), [".agents", ".claude"]);
  const outside = join(scratch, "outside");
  await mkdir(outside);
  const unsafeHome = join(scratch, "unsafe");
  await mkdir(unsafeHome);
  await symlink(outside, join(unsafeHome, ".cursor"));
  assert.notEqual(run(unsafeHome, "cursor").status, 0);
  assert.deepEqual(await readdir(outside), []);
  await rm(path);
  const unrelated = join(outside, "keep");
  await writeFile(unrelated, "untouched");
  await symlink(unrelated, path);
  assert.notEqual(run(home, "cursor").status, 0);
  assert.equal(await readFile(unrelated, "utf8"), "untouched");
  await rm(path);
  await link(unrelated, path);
  assert.notEqual(run(home, "cursor").status, 0);
  assert.equal(await readFile(unrelated, "utf8"), "untouched");
  console.log(
    "PASS isolated Cursor skill install, idempotence, backups, both compatibility, symlink/hardlink rejection and unrelated config preservation",
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
