/** Read-only, discovery-gated observations through this connection's existing authority. */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { parseWorkerRequest } from "./worker-cli.js";

type ObjectValue = Record<string, unknown>;
type InspectionClient = Pick<Client, "listTools" | "callTool">;
type Tool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];
type Selection = { workerId?: string; vaultId?: string };
type Observation = {
  state:
    | "inspected"
    | "not_advertised"
    | "not_selected"
    | "unsupported_contract"
    | "denied"
    | "failed"
    | "blocked";
  tool: string;
  data?: ObjectValue;
  error?: string;
};
const names = [
  "atlas_registration_inspect",
  "atlas_context_vaults",
  "atlas_signal_status",
  "atlas_workers",
] as const;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumBytes = 256 * 1024;

export class InspectionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const inspectionHelp = {
  commands: ["inspect [JSON|@request.json]", "inspect --help"],
  optionalFields: ["workerId", "vaultId"],
  scope:
    "Inspect this connection, scoped memory access and Signal archive observations together. Select a workerId to inspect its advertised settings.",
  authority:
    "Uses existing connection authority only. No new grants, worker operations, memory contents, connector searches, Signal refreshes or provider calls.",
  limits:
    "Independent current reads, not an atomic snapshot. Missing tools and denied reads remain explicit; no fallback to owner credentials or legacy runtimes.",
};
function object(value: unknown): value is ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function parseInspectionSelection(text = "{}"): Selection {
  let value: unknown;
  try {
    if (Buffer.byteLength(text, "utf8") > 4096) throw Error();
    value = JSON.parse(text);
  } catch {
    throw new InspectionError(
      "inspection_request_invalid",
      "Inspection requires a small JSON object with optional workerId and vaultId.",
    );
  }
  if (
    !object(value) ||
    Object.keys(value).some((key) => !["workerId", "vaultId"].includes(key)) ||
    Object.values(value).some((id) => typeof id !== "string" || !uuid.test(id))
  ) {
    throw new InspectionError(
      "inspection_request_invalid",
      "Inspection accepts only optional RFC UUID workerId and vaultId fields.",
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, id]) => [
      key,
      (id as string).toLowerCase(),
    ]),
  ) as Selection;
}
function scalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (typeof value === "string" && value.length <= 4096)
  );
}
function pick(value: unknown, keys: readonly string[]): ObjectValue {
  if (!object(value)) return {};
  return Object.fromEntries(
    keys
      .filter((key) => key in value && scalar(value[key]))
      .map((key) => [key, value[key]]),
  );
}
function identity(value: ObjectValue): ObjectValue {
  if (
    typeof value.connectionId !== "string" ||
    !uuid.test(value.connectionId) ||
    typeof value.subscriberId !== "string" ||
    !uuid.test(value.subscriberId) ||
    !(
      value.line === null ||
      (object(value.line) &&
        typeof value.line.id === "string" &&
        uuid.test(value.line.id))
    )
  )
    throw Error();
  return {
    ...pick(value, [
      "connectionId",
      "subscriberId",
      "installationLabel",
      "subscriberName",
    ]),
    line:
      value.line === null
        ? null
        : pick(value.line, ["id", "name", "address", "lifecycle"]),
    guide: pick(value.guide, ["uri", "version", "sha256"]),
  };
}
function memory(value: ObjectValue, selected?: string): ObjectValue {
  if (
    !Array.isArray(value.vaults) ||
    value.vaults.length > 200 ||
    value.vaultIdentityVersion !== 2
  )
    throw Error();
  const vaults = value.vaults
    .map((row) => {
      if (
        !object(row) ||
        typeof row.vault_id !== "string" ||
        !uuid.test(row.vault_id) ||
        typeof row.can_read !== "boolean" ||
        typeof row.can_write !== "boolean" ||
        !["none", "full", "current_subtrees"].includes(String(row.read_scope))
      )
        throw Error();
      const result = pick(row, [
        "vault_id",
        "name",
        "is_default",
        "can_read",
        "can_write",
        "can_propose",
        "read_scope",
        "migration_required",
      ]);
      if (row.namespaces === null && row.read_scope === "full")
        result.namespaces = null;
      else if (
        Array.isArray(row.namespaces) &&
        row.namespaces.length <= 200 &&
        row.namespaces.every((v) => typeof v === "string" && v.length <= 1024)
      )
        result.namespaces = row.namespaces;
      else throw Error();
      return result;
    })
    .filter((row) => !selected || row.vault_id === selected);
  return {
    ...pick(value, [
      "vaultIdentityVersion",
      "writeProtocolVersion",
      "policyProtocolVersion",
      "defaultRequiresGrant",
    ]),
    vaults,
    selection: selected
      ? { vaultId: selected, visible: vaults.length === 1 }
      : { kind: "currently_discoverable" },
    contentsRead: false,
  };
}
function signal(value: ObjectValue, selected?: string): ObjectValue {
  // Do not let an aggregate response from another server version widen a selection.
  let observation = value.signal;
  let visible = true;
  if (selected) {
    if (!Array.isArray(value.vaults) || value.vaults.length > 200)
      throw Error();
    const matches = value.vaults.filter(
      (row) => object(row) && row.vault_id === selected,
    );
    if (matches.length > 1) throw Error();
    visible = matches.length === 1;
    observation = visible
      ? matches[0].signal
      : {
          schemaVersion: 1,
          viewKind: "archive_input_observation",
          authorization: "not_observed",
          selection: { kind: "discovery", returnedRecords: 0 },
        };
  }
  if (
    !object(observation) ||
    observation.viewKind !== "archive_input_observation" ||
    !(visible ? ["allowed", "none"] : ["not_observed"]).includes(
      String(observation.authorization),
    )
  )
    throw Error();
  return {
    ...pick(observation, [
      "schemaVersion",
      "viewKind",
      "authorization",
      "sourceSynchronization",
      "factualConfidence",
      "coverage",
    ]),
    selection: pick(observation.selection, [
      "kind",
      "returnedRecords",
      "requestedRecords",
      "hasMore",
    ]),
    contentsRead: false,
    scope: selected
      ? { kind: "selected_vault", vaultId: selected, visible }
      : { kind: "currently_discoverable_vaults" },
    refreshed: false,
    representativeMessagingReadiness: "not_assessed",
    representativeCallingReadiness: "not_assessed",
    requiresComputer: false,
    sourceSynchronization: "unknown",
    factualConfidence: "not_assessed",
    coverage: "unknown",
  };
}
/** Only the reviewed handling revision crosses this read-only projection. */
function computerHandling(
  value: unknown,
  selected: string,
): ObjectValue | null {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    value.stateMeaning !==
      "persisted_lifecycle_intent_not_provider_execution" ||
    value.execution !== "blocked" ||
    value.blocker !== "protected_dispatch_unavailable" ||
    !object(value.next) ||
    value.next.action !== "inspect" ||
    value.next.workerId !== selected ||
    !object(value.retry) ||
    value.retry.mode !== "inspect_before_retry" ||
    value.retry.mutationRequestId !== "reuse_only_for_identical_intent" ||
    value.retry.revisionSource !== "fresh_authorized_inspect" ||
    value.retry.uncertainOutcome !== "reconcile_do_not_replace_request_id" ||
    value.completionEvidence !== "provider_and_runtime_verified_result_required"
  )
    return null;
  return {
    ...pick(value, [
      "schemaVersion",
      "stateMeaning",
      "execution",
      "blocker",
      "completionEvidence",
    ]),
    next: pick(value.next, ["action", "workerId"]),
    retry: pick(value.retry, [
      "mode",
      "mutationRequestId",
      "revisionSource",
      "uncertainOutcome",
    ]),
  };
}

function computer(value: ObjectValue, selected: string): ObjectValue {
  if (!object(value.worker) || value.worker.workerId !== selected)
    throw Error();
  return {
    ...pick(value.worker, [
      "workerId",
      "lineId",
      "label",
      "revision",
      "generation",
      "state",
      "runtime",
      "compute",
      "executionAvailable",
      "financialAuthorization",
      "executionStatus",
      "checkpointId",
    ]),
    handling: computerHandling(value.worker.handling, selected),
    handlingCoverage: "reviewed_candidate_v1_only_unknown_when_null",
    settingsCoverage: "advertised_worker_projection_only",
    runtimeReadiness: "not_verified_by_inspection",
  };
}
function inspectContract(tool: Tool): boolean {
  const schema = tool.inputSchema;
  if (
    schema.$id !== "urn:atlas:cloud-workers:candidate:1" ||
    !Array.isArray(schema.oneOf)
  )
    return false;
  return schema.oneOf.some(
    (branch) =>
      object(branch) &&
      object(branch.properties) &&
      object(branch.properties.action) &&
      branch.properties.action.const === "inspect" &&
      object(branch.properties.workerId) &&
      branch.properties.workerId.$ref === "#/$defs/uuid" &&
      branch.additionalProperties === false &&
      Array.isArray(branch.required) &&
      branch.required.length === 2 &&
      branch.required.includes("action") &&
      branch.required.includes("workerId") &&
      Object.keys(branch.properties).sort().join(",") === "action,workerId",
  );
}
function payload(result: Awaited<ReturnType<Client["callTool"]>>): ObjectValue {
  let value: unknown = result.structuredContent;
  if (
    value === undefined &&
    Array.isArray(result.content) &&
    result.content.length === 1
  ) {
    const block = result.content[0];
    if (
      object(block) &&
      block.type === "text" &&
      typeof block.text === "string" &&
      Buffer.byteLength(block.text) <= maximumBytes
    ) {
      value = JSON.parse(block.text);
    }
  }
  if (!object(value) || Buffer.byteLength(JSON.stringify(value)) > maximumBytes)
    throw Error();
  return value;
}
async function discover(client: InspectionClient): Promise<Map<string, Tool>> {
  const tools = new Map<string, Tool>(),
    seen = new Set<string>();
  let cursor: string | undefined;
  try {
    for (let page = 0; page < 20; page++) {
      const result = await client.listTools(cursor ? { cursor } : {});
      for (const tool of result.tools) {
        if (!names.includes(tool.name as (typeof names)[number])) continue;
        if (tools.has(tool.name)) throw Error();
        tools.set(tool.name, tool);
      }
      if (!result.nextCursor) return tools;
      if (seen.has(result.nextCursor)) throw Error();
      seen.add(result.nextCursor);
      cursor = result.nextCursor;
    }
  } catch {
    /* Never disclose SDK errors, headers or server-provided messages. */
  }
  throw new InspectionError(
    "inspection_discovery_failed",
    "Tool discovery failed, is ambiguous or is incomplete. No inspection calls were sent.",
  );
}
export async function inspectWorkspace(client: InspectionClient, text = "{}") {
  const selected = parseInspectionSelection(text);
  const tools = await discover(client);
  async function read(
    name: (typeof names)[number],
    args: ObjectValue,
    project: (value: ObjectValue) => ObjectValue,
  ): Promise<Observation> {
    const tool = tools.get(name);
    if (!tool) return { tool: name, state: "not_advertised" };
    if (
      name === "atlas_workers"
        ? !inspectContract(tool)
        : tool.annotations?.readOnlyHint !== true
    )
      return { tool: name, state: "unsupported_contract" };
    try {
      // Exactly one selected read, without retry or any fall-through to other identities.
      const result = await client.callTool({ name, arguments: args });
      const value = payload(result);
      if (result.isError || value.error !== undefined) {
        const denied = [
          "forbidden",
          "unauthenticated",
          "unauthorized",
          "scope_denied",
          "insufficient_scope",
        ].includes(String(value.error));
        return {
          tool: name,
          state: denied ? "denied" : "failed",
          error: denied ? "current_access_denied" : "read_failed",
        };
      }
      return { tool: name, state: "inspected", data: project(value) };
    } catch {
      return { tool: name, state: "failed", error: "read_or_response_failed" };
    }
  }
  const startedAt = new Date().toISOString();
  const connection = await read("atlas_registration_inspect", {}, identity);
  const blocked = (tool: string): Observation => ({
    tool,
    state: "blocked",
    error: "connection_not_verified",
  });
  const verified = connection.state === "inspected";
  const memoryAccess = verified
    ? await read("atlas_context_vaults", {}, (value) =>
        memory(value, selected.vaultId),
      )
    : blocked("atlas_context_vaults");
  const signalStatus = verified
    ? await read(
        "atlas_signal_status",
        selected.vaultId ? { vaultId: selected.vaultId } : {},
        (value) => signal(value, selected.vaultId),
      )
    : blocked("atlas_signal_status");
  const computerSettings = !verified
    ? blocked("atlas_workers")
    : !tools.has("atlas_workers")
      ? { tool: "atlas_workers", state: "not_advertised" as const }
      : !selected.workerId
        ? { tool: "atlas_workers", state: "not_selected" as const }
        : await read(
            "atlas_workers",
            parseWorkerRequest(
              "inspect",
              JSON.stringify({ workerId: selected.workerId }),
            ),
            (value) => computer(value, selected.workerId!),
          );
  const sections = {
    connection,
    computers: computerSettings,
    memory: memoryAccess,
    signal: signalStatus,
  };
  return {
    schemaVersion: 1,
    mode: "read_only_inspection",
    startedAt,
    completedAt: new Date().toISOString(),
    consistency: "independent_current_reads_not_atomic",
    sections,
    partial: Object.values(sections).some(
      (section) =>
        section.state !== "inspected" ||
        (object(section.data?.selection) &&
          section.data.selection.visible === false) ||
        (object(section.data?.scope) && section.data.scope.visible === false),
    ),
    limits: [
      "Tool availability is not permission, runtime readiness or proof of execution.",
      "No memory contents, Signal refresh, connector search or computer mutation was requested.",
      "Missing or denied settings are not evidence that a computer or vault does not exist.",
      "Inspect again after changing account, connection or grants; this report does not preserve authority.",
    ],
  };
}
