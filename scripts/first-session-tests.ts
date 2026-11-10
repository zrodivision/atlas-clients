/** Structural offline guidance checks, not evidence of actual host acceptance. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv-provider.js";
import { packageFiles } from "./client-package.js";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFile(join(root, path), "utf8");
const skill = await read("skills/atlas/SKILL.md");
const title = "## First session: install, verify, explain";
const start = skill.indexOf(title);
const end = skill.indexOf("## Reference workflows", start);
assert.ok(
  start > 0 && start < 2500,
  "cold-start guidance must be at the front",
);
assert.ok(end > start);
const first = skill.slice(start, end);
assert.ok(
  Buffer.byteLength(first, "utf8") < 6500,
  "first-session path stays bounded",
);
for (const required of [
  "without an installed skill",
  "No personal context is needed",
  "https://connectatlas.io/mcp",
  "https://github.com/zrodivision/atlas-clients",
  "Streamable HTTP",
  "owner review",
  "atlas auth diagnose",
  "atlas_registration_inspect",
  "atlas://me",
  "atlas://network/charter",
  "atlas://guides/atlas",
  "unverified support",
  "Repeating",
  "not create another Line",
  "No personal context has been imported",
  "Cellular calls and SMS are outside",
  "source-candidate commands",
]) {
  // Semantic fragments deliberately protect the first-session contract from accidental removal.
  assert.ok(first.includes(required), required);
}
for (const prohibitedAction of [
  "read/import memory",
  "enumerate contacts",
  "invite peers",
  "send a test message",
  "provision a computer",
  "enable monitoring",
])
  assert.ok(first.includes(prohibitedAction), prohibitedAction);
assert.ok(first.includes("Do not read/import memory"));
assert.ok(first.includes("Never report a configured URL"));
const readme = await read("README.md");
assert.ok(readme.includes("(docs/first-session.md)"));
const runbook = await read("docs/first-session.md");
for (const term of [
  "> Install Atlas.",
  "safe blocked result",
  "assisted pass",
  "Interrupted consent",
  "Repeated install",
  "Revoked connection",
  "PASS/FAIL/BLOCKED/NOT_RUN",
  "not an Instinct simulation",
  "not this public repository",
])
  assert.ok(runbook.includes(term), term);
const catalog = JSON.parse(await read("contracts/mcp-catalog.json"));
const validator = new AjvJsonSchemaValidator();
const verification = [
  { tool: "atlas_registration_inspect", arguments: {} },
  ...["atlas://me", "atlas://network/charter", "atlas://guides/atlas"].map(
    (uri) => ({
      tool: "atlas_resources_read",
      arguments: { uri },
    }),
  ),
];
for (const example of verification) {
  const tool = catalog.tools.find(
    (entry: { name: string }) => entry.name === example.tool,
  );
  assert.ok(tool, example.tool);
  assert.equal(tool.annotations.readOnlyHint, true);
  const result = validator.getValidator(tool.inputSchema)(example.arguments);
  assert.equal(result.valid, true, JSON.stringify(result));
}
const generated = await packageFiles(root, "https://connectatlas.io");
const hosted = generated["skills/atlas-hosted/SKILL.md"];
assert.equal(hosted, skill.replace("name: atlas-local", "name: atlas-hosted"));
assert.equal(
  await read("plugins/atlas-hosted/skills/atlas-hosted/SKILL.md"),
  hosted,
);
assert.equal(
  JSON.parse(generated[".mcp.json"]).mcpServers.atlas.url,
  "https://connectatlas.io/mcp",
);
console.log(
  "First-session guidance, read-only verification schema and generated delivery checks passed (offline only)",
);
