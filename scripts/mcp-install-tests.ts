import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { claudeUrl } from "./mcp-install.js";
const origin = "https://atlas.example";
const temp = await mkdtemp(join(tmpdir(), "atlas-installer-"));
try {
  const log = join(temp, "calls.jsonl");
  await writeFile(
    join(temp, "claude"),
    `#!/usr/bin/env node
const fs=require('node:fs');
const a=process.argv.slice(2);
fs.appendFileSync(process.env.ATLAS_TEST_LOG, JSON.stringify(a)+'\\n');
if(a[1]==='get') {
 if(!fs.existsSync(process.env.ATLAS_TEST_LOG+'.added') && !process.env.ATLAS_TEST_EXISTING) process.exit(1);
 console.log('  URL: '+(process.env.ATLAS_TEST_EXISTING || 'https://atlas.example/mcp')+'\\n  Status: ✔ Connected');
}
if(a[1]==='add') fs.writeFileSync(process.env.ATLAS_TEST_LOG+'.added','');
`,
    { mode: 0o755 },
  );
  const run = (existing = "") =>
    spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/atlas.ts",
        "install-mcp",
        "claude",
        "--name",
        "atlas-test",
      ],
      {
        cwd: resolve(import.meta.dirname, ".."),
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: temp + ":" + process.env.PATH,
          ATLAS_URL: origin,
          ATLAS_TEST_LOG: log,
          ATLAS_TEST_EXISTING: existing,
        },
      },
    );
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  let calls = (await readFile(log, "utf8"))
    .trim()
    .split("\n")
    .map((x) => JSON.parse(x));
  assert.deepEqual(calls, [
    ["mcp", "get", "atlas-test"],
    [
      "mcp",
      "add",
      "--transport",
      "http",
      "--scope",
      "user",
      "atlas-test",
      origin + "/mcp",
    ],
    ["mcp", "login", "atlas-test"],
    ["mcp", "get", "atlas-test"],
  ]);
  await writeFile(log, "");
  assert.equal(run().status, 0);
  assert.ok(!(await readFile(log, "utf8")).includes('"add"'));
  await writeFile(log, "");
  assert.notEqual(run("https://other.example/mcp").status, 0);
  calls = (await readFile(log, "utf8"))
    .trim()
    .split("\n")
    .map((x) => JSON.parse(x));
  assert.deepEqual(calls, [["mcp", "get", "atlas-test"]]);
} finally {
  await rm(temp, { recursive: true, force: true });
}
assert.equal(
  claudeUrl("\u001b[32m  URL: https://atlas.example/mcp\u001b[0m"),
  origin + "/mcp",
);
assert.throws(() => claudeUrl("not a URL"));
console.log(
  "PASS native installer stable URL, login, idempotent registration and conflicting-entry preservation",
);
