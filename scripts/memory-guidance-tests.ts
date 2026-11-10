/** Public wire-contract and offline CLI checks; no data reads, grants or service effects. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv-provider.js";
import { memoryGuide, memoryExamples } from "./memory-guidance.js";
const root = resolve(import.meta.dirname, "..");
const catalog = JSON.parse(
  await readFile(join(root, "contracts/mcp-catalog.json"), "utf8"),
);
const guide = memoryGuide(),
  examples = memoryExamples();
assert.equal(guide.authority, "guidance_only");
assert.equal(guide.networkChecked, false);
assert.equal(guide.sourceRead, false);
assert.equal(guide.operationSent, false);
assert.equal(examples.synthetic, true);
assert.equal(examples.operationSent, false);
const validator = new AjvJsonSchemaValidator();
for (const example of [
  examples.initial,
  examples.update,
  examples.lostReplyRecovery,
  examples.verify,
  examples.explicitExport,
]) {
  const tool = catalog.tools.find(
    (t: { name: string }) => t.name === example.tool,
  );
  assert.ok(tool, example.tool);
  const validate = validator.getValidator(tool.inputSchema);
  const result = validate(example.arguments);
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.equal(
    validate({ ...example.arguments, acceptAllPermissions: true }).valid,
    false,
  );
}
const first = examples.initial.arguments,
  next = examples.update.arguments;
for (const key of [
  "vaultId",
  "id",
  "namespace",
  "sourceId",
  "externalId",
] as const)
  assert.equal(first[key], next[key]);
assert.equal(first.expectedRevision, 0);
assert.equal(next.expectedRevision, examples.initial.expectedReceipt.revision);
assert.notEqual(first.operationId, next.operationId);
assert.notEqual(first.content, next.content);
assert.ok(Date.parse(next.observedAt) > Date.parse(first.observedAt));
assert.deepEqual(
  examples.lostReplyRecovery.arguments,
  next,
  "response-loss recovery cannot allocate new intent or advance CAS",
);
assert.deepEqual(
  examples.lostReplyRecovery.expectedReceipt,
  examples.update.expectedReceipt,
);
assert.notEqual(
  examples.lostReplyRecovery.arguments,
  next,
  "returned examples do not share mutable request identity",
);
for (const request of [first, next]) {
  assert.ok(Buffer.byteLength(request.content, "utf8") <= 16000);
  assert.ok(request.content.trim());
  assert.equal(request.kind, "source");
  assert.ok(
    request.operationId.startsWith(`v1:${request.vaultId}:${request.id}:`),
  );
  assert.ok(Buffer.byteLength(request.sourceId) <= 200);
  assert.ok(Buffer.byteLength(request.externalId) <= 500);
  assert.match(request.observedAt, /Z$/);
  assert.ok(
    !request.sourceRef.includes("/Users/") &&
      !request.sourceRef.includes("token="),
  );
}
assert.equal(
  examples.unchanged.tool,
  null,
  "unchanged source must not churn revisions",
);
assert.deepEqual(examples.explicitExport.arguments.ids, [first.id]);
assert.equal(examples.explicitExport.arguments.maxBytes, 32000);
for (const field of [
  "vaultId",
  "connectionId",
  "originalNamespace",
  "sourceId",
  "externalId",
  "memoryId",
  "lastConfirmedRevision",
  "lastConfirmedMappedDigest",
  "pendingExactRequest",
  "lastReceipt",
])
  assert.ok(guide.ledger.required.includes(field));
for (const error of [
  "response_lost",
  "vault_busy",
  "vault_write_uncertain",
  "revision_conflict",
  "source_conflict",
  "source_stale",
  "manual_edit_protected",
  "memory_deleted",
  "source_missing",
  "authority_changed",
  "migration_required",
  "capacity_reached",
])
  assert.ok(error in guide.recovery);
assert.equal(guide.wireErrors.idempotency_conflict, "saved_request_mismatch");
assert.equal(guide.wireErrors.vault_limit, "capacity_reached");
assert.equal(guide.wireErrors.vault_migration_required, "migration_required");
assert.match(
  guide.ledger.normalization,
  /Preserve content, sourceId, externalId and tag bytes exactly/,
);
assert.match(
  guide.ledger.normalization,
  /Never normalize or edit an already saved pending request/,
);
assert.match(
  guide.recovery.saved_request_mismatch,
  /recover the original retained intent/,
);
assert.match(guide.mapping.key, /nonunique/);
assert.match(guide.mapping.sourceId, /exact case and bytes/);
assert.match(guide.mapping.externalId, /across renames/);
assert.match(guide.mapping.namespace, /part of import identity/);
assert.match(guide.ledger.digest, /complete mapped semantic payload/);
assert.match(guide.signal, /independently of any computer/);
assert.match(guide.signal, /historical revision/);
assert.match(guide.retrieval.export, /not one snapshot/);
assert.match(
  guide.recovery.manual_edit_protected,
  /no automatic protection reset/,
);
assert.match(guide.recovery.capacity_reached, /5000.*1000/);
assert.match(guide.start.join(" "), /permission to send/);
const scratch = await mkdtemp(join(tmpdir(), "atlas-memory-guide-"));
try {
  const profileHome = join(scratch, "must-not-be-created");
  const trap = join(scratch, "no-network.mjs");
  await writeFile(
    trap,
    'globalThis.fetch = async () => { throw Error("OFFLINE_GUIDANCE_ATTEMPTED_NETWORK"); };',
  );
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      ["--import", trap, "--import", "tsx", "scripts/atlas.ts", ...args],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          ATLAS_HOME: profileHome,
          ATLAS_PROFILE: "fixture",
          ATLAS_URL: "https://must-not-contact.example.test",
          ATLAS_TOKEN: "synthetic-do-not-read-or-print",
        },
      },
    );
  for (const suffix of [[], ["guide"], ["help"], ["--help"], ["-h"]]) {
    const result = run("memory", ...suffix);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), guide);
    assert.ok(
      !(result.stdout + result.stderr).includes(
        "synthetic-do-not-read-or-print",
      ),
    );
  }
  const result = run("memory", "examples");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), examples);
  for (const args of [
    ["memory", "sync"],
    ["memory", "guide", "extra"],
    ["memory", "examples", "{}"],
  ]) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).error, "memory_guidance_invalid");
  }
  await assert.rejects(access(profileHome), { code: "ENOENT" });
  const skill = await readFile(join(root, "skills/atlas/SKILL.md"), "utf8");
  for (const text of [
    "atlas memory guide",
    "atlas memory examples",
    "original namespace",
    "sourceId",
    "externalId",
    "atlas_context_import",
    "atlas_context_write",
    "1,000",
    "5,000",
    "Signal's owner-selected historical records",
  ])
    assert.ok(skill.includes(text), text);
  console.log(
    "PASS offline memory mapping guide, public-schema import/update/exact-retry/read/export examples, ledger/recovery invariants, independent Signal guidance and no-profile/no-network CLI",
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
