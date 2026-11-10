/** Optional worker client. Discovery is required; this does not provision a runtime. */
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { workerActions } from "./worker-guidance.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv-provider.js";

const toolName = "atlas_workers";
type Action = keyof typeof workerActions;
const actions = Object.keys(workerActions) as Action[];
type Request = Record<string, unknown> & { action: Action };
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumBytes = 64 * 1024;

/** Only fixed, credential-free diagnostics may cross the CLI error boundary. */
export class WorkerCommandError extends Error {
  constructor(
    message: string,
    readonly code = "worker_request_invalid",
    readonly details?: {
      missingFields: string[];
      unsupportedFieldCount: number;
      allowedFields: string[];
    },
  ) {
    super(message);
  }
}

export const workerHelp = {
  commands: [
    "workers capabilities",
    "workers contract (offline machine-readable request schemas)",
    "workers guide (offline agent workflow and user-facing guidance)",
    "workers validate ACTION JSON|@request.json (offline; sends nothing)",
    "workers create|inspect|run|cancel|checkpoint|restore JSON|@request.json",
  ],
  status:
    "Optional client interface only. Atlas 0.14.1 does not advertise atlas_workers; actual server discovery is authoritative.",
  authority:
    "Uses this CLI profile's independent Atlas connection. Discovery does not grant execution, computer, model or data access.",
  recovery:
    "Save the complete request before mutation. Inspect by workerId after response loss; never invent another requestId to retry an uncertain effect.",
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseWorkerRequest(action: string, text: string): Request {
  if (!actions.includes(action as Action))
    throw new WorkerCommandError(
      "Use atlas workers help for supported commands.",
    );
  if (Buffer.byteLength(text, "utf8") > maximumBytes)
    throw new WorkerCommandError("Worker request exceeds 64 KiB.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new WorkerCommandError("Worker arguments must be a JSON object.");
  }
  if (!object(value))
    throw new WorkerCommandError("Worker arguments must be a JSON object.");
  const required: readonly string[] = workerActions[action as Action];
  const missingFields = required.filter((key) => !(key in value));
  const unsupportedFieldCount = Object.keys(value).filter(
    (key) => !required.includes(key),
  ).length;
  if (unsupportedFieldCount || missingFields.length)
    throw new WorkerCommandError(
      "Worker arguments have missing or unsupported fields. See the worker CLI documentation.",
      "worker_request_fields_invalid",
      { missingFields, unsupportedFieldCount, allowedFields: [...required] },
    );
  for (const key of ["workerId", "requestId", "lineId", "taskId"])
    if (
      key in value &&
      (typeof value[key] !== "string" ||
        value[key].length !== 36 ||
        !uuid.test(value[key]))
    )
      throw new WorkerCommandError(
        "Worker, request, line and task identifiers must be RFC UUIDs (versions 1–8, without whitespace).",
      );
  for (const key of ["expectedRevision", "taskVersion"])
    if (
      key in value &&
      (!Number.isSafeInteger(value[key]) || Number(value[key]) < 1)
    )
      throw new WorkerCommandError(
        "Worker revisions and task versions must be positive safe integers.",
      );
  for (const key of ["label", "prompt"])
    if (
      key in value &&
      (typeof value[key] !== "string" ||
        !value[key].trim() ||
        value[key].includes("\0"))
    )
      throw new WorkerCommandError(
        "Worker labels and prompts must be nonblank strings without NUL characters.",
      );
  if (typeof value.label === "string" && value.label.length > 80)
    throw new WorkerCommandError(
      "Worker labels must fit 80 UTF-16 code units.",
    );
  if (
    typeof value.prompt === "string" &&
    Buffer.byteLength(value.prompt, "utf8") > 32768
  )
    throw new WorkerCommandError("Worker prompts must fit 32 KiB of UTF-8.");
  if (
    "checkpointId" in value &&
    (typeof value.checkpointId !== "string" ||
      value.checkpointId !== value.checkpointId.trim() ||
      !/^v[0-9]{1,20}$/.test(value.checkpointId))
  )
    throw new WorkerCommandError(
      "Checkpoint identifiers must be v followed by 1–20 digits, as returned by this worker.",
    );
  return { action: action as Action, ...value };
}

/** Validate saved intent without a profile, discovery, or execution side effect. */
export function validateWorkerIntent(action: string, text: string) {
  const request = parseWorkerRequest(action, text);
  return {
    valid: true,
    action: request.action,
    contract: "urn:atlas:cloud-workers:candidate:1",
    serverChecked: false,
    operationSent: false,
    message:
      "Local candidate request validation only. Server discovery, current authority and runtime readiness still require verification.",
  };
}

export async function readWorkerArgument(argument: string): Promise<string> {
  if (!argument.startsWith("@")) return argument;
  // Exact user-selected regular file only; no arbitrary device or symlink reads.
  const file = await open(
    argument.slice(1),
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maximumBytes)
      throw new WorkerCommandError(
        "Worker request file must be a regular file of at most 64 KiB.",
      );
    const buffer = Buffer.alloc(maximumBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(
        buffer,
        length,
        buffer.length - length,
      );
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > maximumBytes)
      throw new WorkerCommandError("Worker request exceeds 64 KiB.");
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, length),
      );
    } catch {
      throw new WorkerCommandError(
        "Worker request file must contain valid UTF-8.",
      );
    }
  } finally {
    await file.close();
  }
}

function advertisedActions(schema: unknown): string[] {
  if (!object(schema)) return [];
  const property = object(schema.properties)
    ? schema.properties.action
    : undefined;
  const direct = object(property)
    ? [
        ...(Array.isArray(property.enum) ? property.enum : []),
        property.const,
      ].filter((value): value is string => typeof value === "string")
    : [];
  return [
    ...new Set([
      ...direct,
      ...["oneOf", "anyOf"].flatMap((key) =>
        Array.isArray(schema[key])
          ? schema[key].flatMap(advertisedActions)
          : [],
      ),
    ]),
  ];
}

export async function workerCommand(
  client: Pick<Client, "listTools" | "callTool">,
  action: string,
  argument = "{}",
): Promise<unknown> {
  // Reject invalid intent before any network interaction, including discovery.
  const request =
    action === "capabilities"
      ? undefined
      : parseWorkerRequest(action, argument);
  if (action === "capabilities" && argument !== "{}")
    throw new WorkerCommandError("Worker capabilities takes no arguments.");
  let cursor: string | undefined;
  const seen = new Set<string>();
  let tool:
    Awaited<ReturnType<Client["listTools"]>>["tools"][number] | undefined;
  for (let page = 0; page < 20; page++) {
    const result = await client.listTools(cursor ? { cursor } : {});
    for (const candidate of result.tools)
      if (candidate.name === toolName) {
        if (tool)
          throw new WorkerCommandError(
            "Worker tool discovery is ambiguous; no worker operation was sent.",
            "worker_discovery_ambiguous",
          );
        tool = candidate;
      }
    if (!result.nextCursor) break;
    if (page === 19 || seen.has(result.nextCursor))
      throw new WorkerCommandError(
        "Worker tool discovery is incomplete; no worker operation was sent.",
        "worker_discovery_incomplete",
      );
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  const supportedActions = advertisedActions(tool?.inputSchema);
  if (!request)
    return {
      available: Boolean(tool),
      tool: toolName,
      advertisedActions: supportedActions,
      runtimeReadiness: "unknown",
      message: tool
        ? "Tool discovery only; inspect server capabilities and current authority before execution."
        : "This server does not advertise atlas_workers. No worker operation was sent.",
    };
  if (!tool || !supportedActions.includes(action))
    throw new WorkerCommandError(
      "This server does not advertise the requested atlas_workers action. No worker operation was sent.",
      "worker_capability_unavailable",
    );
  // Check the exact discovered schema, not just an action name. Never echo schema
  // validation errors: property names and const values can contain private data.
  let matches = false;
  try {
    matches = new AjvJsonSchemaValidator().getValidator(tool.inputSchema)(
      request,
    ).valid;
  } catch {
    // Unresolvable references and unsupported schema syntax fail closed.
  }
  if (!matches)
    throw new WorkerCommandError(
      "The saved request does not match a usable advertised worker schema. No worker operation was sent; inspect the current server guide before changing intent.",
      "worker_contract_mismatch",
    );
  // Exactly one call. Transport failures and uncertain results are never retried here.
  const result = await client.callTool({ name: toolName, arguments: request });
  if (result.isError) process.exitCode = 1;
  return result;
}
