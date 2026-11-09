/** Optional worker client. Discovery is required; this does not provision a runtime. */
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

const toolName = "atlas_workers";
const actions = [
  "create",
  "inspect",
  "run",
  "cancel",
  "checkpoint",
  "restore",
] as const;
type Action = (typeof actions)[number];
type Request = Record<string, unknown> & { action: Action };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maximumBytes = 64 * 1024;

/** Only fixed, credential-free diagnostics may cross the CLI error boundary. */
export class WorkerCommandError extends Error {}

export const workerHelp = {
  commands: [
    "workers capabilities",
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
  const required = ["workerId"];
  if (action !== "inspect") required.push("requestId");
  if (action !== "inspect" && action !== "create")
    required.push("expectedRevision");
  if (action === "create") required.push("lineId", "label");
  if (action === "run") required.push("taskId", "taskVersion", "prompt");
  if (action === "restore") required.push("checkpointId");
  if (
    Object.keys(value).some((key) => !required.includes(key)) ||
    required.some((key) => !(key in value))
  )
    throw new WorkerCommandError(
      "Worker arguments have missing or unsupported fields. See the worker CLI documentation.",
    );
  for (const key of ["workerId", "requestId", "lineId", "taskId"])
    if (
      key in value &&
      (typeof value[key] !== "string" || !uuid.test(value[key]))
    )
      throw new WorkerCommandError(
        "Worker, request, line and task identifiers must be UUIDs.",
      );
  for (const key of ["expectedRevision", "taskVersion"])
    if (
      key in value &&
      (!Number.isSafeInteger(value[key]) || Number(value[key]) < 1)
    )
      throw new WorkerCommandError(
        "Worker revisions and task versions must be positive safe integers.",
      );
  for (const key of ["label", "prompt", "checkpointId"])
    if (key in value && (typeof value[key] !== "string" || !value[key].trim()))
      throw new WorkerCommandError(
        "Worker label, prompt and checkpoint identifiers must be nonempty strings.",
      );
  return { action: action as Action, ...value };
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
          );
        tool = candidate;
      }
    if (!result.nextCursor) break;
    if (page === 19 || seen.has(result.nextCursor))
      throw new WorkerCommandError(
        "Worker tool discovery is incomplete; no worker operation was sent.",
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
    );
  // Exactly one call. Transport failures and uncertain results are never retried here.
  const result = await client.callTool({ name: toolName, arguments: request });
  if (result.isError) process.exitCode = 1;
  return result;
}
