/** Exercise install/update/skills with real native artifacts and an offline release transport. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  realpath,
  cp,
  rm,
  readlink,
  readdir,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dirname, "..");
const build = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/package-native.ts"],
  { cwd: root, encoding: "utf8" },
);
assert.equal(build.status, 0, build.stderr);
const artifact = JSON.parse(build.stdout.trim().split("\n").at(-1)!);
const scratch = await realpath(
  await mkdtemp(join(tmpdir(), "atlas-native-test-")),
);
const version = artifact.version;
try {
  const home = join(scratch, "home"),
    shim = join(scratch, "shim"),
    fixtures = join(scratch, "releases");
  await mkdir(home);
  await mkdir(shim);
  await mkdir(fixtures);
  async function fixture(v: string, source: string) {
    const dir = join(fixtures, "v" + v);
    await mkdir(dir);
    await cp(source, join(dir, artifact.asset));
    const hash = createHash("sha256")
      .update(await readFile(source))
      .digest("hex");
    await writeFile(
      join(dir, "SHASUMS256.txt"),
      `${hash}  ${artifact.asset}\n`,
    );
  }
  await fixture(version, artifact.tarball);
  await writeFile(
    join(shim, "curl"),
    `#!/bin/sh
set -eu
url=
out=
while [ "$#" -gt 0 ]; do
 case "$1" in https://*) url=$1; shift ;; -o) out=$2; shift 2 ;; *) shift ;; esac
done
path=\${url#https://github.com/zrodivision/atlas-clients/releases/download/}
[ "$path" != "$url" ] || exit 1
cp "$ATLAS_TEST_RELEASES/$path" "$out"
case "$out" in *archive.tar.gz) [ "\${ATLAS_TEST_CORRUPT:-}" != 1 ] || printf bad >> "$out" ;; esac
`,
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    HOME: home,
    ATLAS_HOME: join(home, ".config/atlas"),
    ATLAS_PROFILE: "default",
    PATH: shim + ":/usr/bin:/bin:/usr/sbin:/sbin",
    ATLAS_INSTALL_DIR: join(home, ".local/share/atlas"),
    ATLAS_BIN_DIR: join(home, ".local/bin"),
    ATLAS_TEST_RELEASES: fixtures,
  };
  const run = (cmd: string, args: string[], extra = {}) =>
    spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf8" });
  const install = run("sh", [
    join(root, "install.sh"),
    "--version",
    version,
    "--skills",
    "both",
  ]);
  assert.equal(install.status, 0, install.stderr);
  const executable = join(env.ATLAS_BIN_DIR, "atlas");
  assert.equal(run(executable, ["--version"]).stdout.trim(), version);
  assert.equal(run(executable, ["auth", "status"]).status, 0);
  const skill = join(home, ".agents/skills/atlas/SKILL.md");
  assert.match(await readFile(skill, "utf8"), /name: atlas\n/);
  assert.match(
    await readFile(join(home, ".claude/skills/atlas/SKILL.md"), "utf8"),
    /# Atlas network/,
  );
  await writeFile(skill, "custom skill");
  const unrelated = join(home, ".agents/skills/atlas/user-note.txt");
  await writeFile(unrelated, "keep");
  assert.equal(run(executable, ["skill", "install", "codex"]).status, 0);
  const backups = (await readdir(join(skill, ".."))).filter((p) =>
    p.startsWith("SKILL.md.backup-"),
  );
  assert.equal(backups.length, 1);
  assert.equal(
    await readFile(join(skill, "..", backups[0]), "utf8"),
    "custom skill",
  );
  assert.equal(await readFile(unrelated, "utf8"), "keep");
  const profile = join(home, ".config/atlas/default.json");
  await writeFile(
    profile,
    '{"kind":"oauth","tokens":{"access_token":"private-test-token"}}',
    { mode: 0o600 },
  );
  const profileBefore = await readFile(profile, "utf8");
  const changed = join(scratch, "changed");
  await cp(join(artifact.directory, "package"), changed, { recursive: true });
  const metadata = JSON.parse(
    await readFile(join(changed, "package.json"), "utf8"),
  );
  metadata.version = "99.0.0-rc.1";
  await writeFile(join(changed, "package.json"), JSON.stringify(metadata));
  const updated = join(scratch, "updated.tar.gz");
  assert.equal(
    spawnSync("tar", ["-czf", updated, "-C", changed, "."]).status,
    0,
  );
  await fixture(metadata.version, updated);
  const old = await readlink(join(env.ATLAS_INSTALL_DIR, "current"));
  const update = run(executable, ["update", "--version", metadata.version]);
  assert.equal(update.status, 0, update.stderr);
  assert.equal(run(executable, ["--version"]).stdout.trim(), metadata.version);
  assert.equal(await readlink(join(env.ATLAS_INSTALL_DIR, "previous")), old);
  assert.equal(await readFile(profile, "utf8"), profileBefore);
  assert.notEqual(
    run(executable, ["update", "--version", version], {
      ATLAS_TEST_CORRUPT: "1",
    }).status,
    0,
  );
  assert.equal(run(executable, ["--version"]).stdout.trim(), metadata.version);
  assert.equal(run(executable, ["update", "--version", version]).status, 0);
  assert.equal(run(executable, ["--version"]).stdout.trim(), version);
  const before = await readlink(join(env.ATLAS_INSTALL_DIR, "current"));
  await mkdir(join(env.ATLAS_INSTALL_DIR, ".install-lock"));
  assert.notEqual(
    run("sh", [join(root, "install.sh"), "--version", version]).status,
    0,
  );
  await rm(join(env.ATLAS_INSTALL_DIR, ".install-lock"), { recursive: true });
  assert.equal(await readlink(join(env.ATLAS_INSTALL_DIR, "current")), before);
  await rm(skill);
  await symlink(unrelated, skill);
  assert.notEqual(run(executable, ["skill", "install", "codex"]).status, 0);
  assert.equal(await readFile(unrelated, "utf8"), "keep");
  assert.equal(await readFile(profile, "utf8"), profileBefore);
  console.log(
    "PASS standalone install without Node/npm on PATH; bundled skills, backups, profile preservation, atomic update/rollback, checksum failure and install locking",
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
