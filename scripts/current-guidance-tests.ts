/** Current guidance is a public contract, not a cumulative release notebook. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { packageFiles } from "./client-package.js";
import { setupGuide } from "./setup-guidance.js";
const root = resolve(import.meta.dirname, "..");
const skill = await readFile(join(root, "skills/atlas/SKILL.md"), "utf8");
const files = await packageFiles(root, "https://connectatlas.io");
for (const text of [
  skill,
  files["skills/atlas-hosted/SKILL.md"],
  JSON.stringify(setupGuide()),
]) {
  for (const stale of [
    "atlas workers",
    "atlas_workers",
    "deploy_request",
    "local_process",
    "platformLuna",
    "Codex pairing",
    "Sprites",
    "Silver Sky",
    "unreleased 0.7",
    "unreleased 0.8",
    "unreleased 0.10",
    "unreleased 0.11",
    "unreleased 0.12",
    "docs/history",
    "archive fallback",
  ])
    assert.ok(!text.includes(stale), `Stale guidance exposed: ${stale}`);
  for (const current of [
    "atlas_computers",
    "prepare-task",
    "taskVersion",
    "runRequestId",
  ])
    assert.ok(text.includes(current), `Current lifecycle missing: ${current}`);
}
const catalog = JSON.parse(files["skills/atlas-hosted/references/tools.json"]);
for (const name of [
  "atlas_context_vaults",
  "atlas_context_import",
  "atlas_signal_status",
  "atlas_signal_read",
  "atlas_tasks",
  "atlas_resources_read",
])
  assert.ok(
    catalog.tools.some((tool: { name: string }) => tool.name === name),
    name,
  );
assert.ok(
  !catalog.tools.some((tool: { name: string }) =>
    /^atlas_(sms|call_|outbound_call)/.test(tool.name),
  ),
);
// atlas_computers is authenticated dynamic discovery, not a fabricated static catalogue entry.
assert.equal(setupGuide().firstComputer.tool, "atlas_computers");
assert.equal(setupGuide().firstComputer.energy.reservationIsConsumption, false);
assert.match(skill, /Durable owner consent has no arbitrary testing expiry/);
for (const args of [
  ["workers", "guide"],
  ["workers", "contract"],
  ["workers", "help"],
  ["workers", "run", "--help"],
]) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/atlas.ts", ...args],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.tool, "atlas_computers");
  assert.ok(!result.stdout.includes("atlas_workers"));
  assert.ok(!result.stdout.includes("working-with-sprites"));
  assert.ok(!result.stdout.includes("pairing"));
}
console.log(
  "Current-only installed/served guidance and compatibility help checks passed; no live acceptance claimed",
);
