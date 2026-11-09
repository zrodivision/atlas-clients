/** Public broker MCP/REST parity; no service, credentials or effects. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const json = async (path: string) =>
  JSON.parse(await readFile(new URL(path, root), "utf8"));
const catalog = await json("contracts/mcp-catalog.json");
const api = await json("contracts/signal-capabilities.openapi.json");
const surfaces = await json("contracts/surfaces.json");
const pkg = await json("package.json");
assert.equal(api.info.version, pkg.version);
const post = api.paths["/v1/signal-capabilities"].post;
assert.deepEqual(post["x-atlas-required-scopes"], ["context:read"]);
assert.deepEqual(post["x-atlas-historical-call-invoke-additional-scopes"], [
  "calls:read",
  "calls:request",
]);
assert.equal(api["x-atlas-production-mode"], "native-only");
assert.deepEqual(api["x-atlas-retired-capabilities"], ["call.request"]);
assert.ok(!("x-atlas-call-invoke-additional-scopes" in post));
for (const route of Object.values(api.paths) as {
  post: { responses: Record<string, { description: string }> };
}[])
  assert.match(route.post.responses["410"].description, /cellular_retired/);
assert.ok(
  api.components.schemas.OperationReceipt.properties.effectStatus,
  "Historical receipt fields remain compatible, not an active carrier capability",
);
const variants = post.requestBody.content["application/json"].schema.oneOf;
for (const [name, action] of [
  ["atlas_signal_capabilities", "manifest"],
  ["atlas_signal_invoke", "invoke"],
  ["atlas_signal_operation", "status"],
]) {
  const tool = catalog.tools.find(
    (entry: { name: string }) => entry.name === name,
  );
  assert.ok(tool, name);
  assert.ok(surfaces[name], name);
  const rest = variants.find(
    (entry: { properties: { action: { const: string } } }) =>
      entry.properties.action.const === action,
  );
  const { action: _action, ...properties } = rest.properties;
  assert.deepEqual(tool.inputSchema, {
    type: "object",
    properties,
    required: rest.required.filter((key: string) => key !== "action"),
    additionalProperties: false,
  });
  assert.equal(tool.annotations.readOnlyHint, action !== "invoke");
  assert.equal(tool.annotations.idempotentHint, true);
  assert.ok(!("actorKind" in tool.inputSchema.properties));
  assert.ok(!("acceptCapabilityUse" in tool.inputSchema.properties));
}
console.log(
  "PASS public Signal broker MCP/REST schema, scopes and authority separation",
);
