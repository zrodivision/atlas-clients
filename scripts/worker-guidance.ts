/** Public, offline workflow guidance. Never evidence of server authority. */
import { personalComputerGuide } from "./setup-guidance.js";
export const workerActions = {
  create: ["workerId", "requestId", "lineId", "label"],
  inspect: ["workerId"],
  run: [
    "workerId",
    "requestId",
    "expectedRevision",
    "taskId",
    "taskVersion",
    "prompt",
  ],
  cancel: ["workerId", "requestId", "expectedRevision"],
  checkpoint: ["workerId", "requestId", "expectedRevision"],
  restore: ["workerId", "requestId", "expectedRevision", "checkpointId"],
} as const;

/** Intent routing, not aliases or a claim that the server exposes these actions. */
function workerHandlingGuide() {
  return {
    schemaVersion: 1,
    authority: "guidance_only",
    dispatch: "exact_live_discovered_schema_only",
    intents: [
      {
        intent: "create_computer",
        action: "create",
        completion:
          "provider deployment and runtime readiness verified separately",
      },
      {
        intent: "check_status",
        action: "inspect",
        completion:
          "current projection read; execution and billing remain separately evidenced",
      },
      {
        intent: "execute_task",
        action: "run",
        completion: "canonical task outcome and accessible artifact verified",
      },
      {
        intent: "stop_work",
        action: "cancel",
        completion:
          "whole-job termination and inference settlement verified separately",
      },
      {
        intent: "save_idle_disk",
        action: "checkpoint",
        completion: "checkpoint reference returned for this worker",
      },
      {
        intent: "restore_disk",
        action: "restore",
        completion:
          "authorized restore confirmed; no automatic task resumption",
      },
    ],
    unsupportedIntents: [
      "pause",
      "resume",
      "restart",
      "delete",
      "resize",
      "list_workers",
    ],
    unsupportedIntentPolicy:
      "Do not invent commands, alias these to cancel/restore, or call a provider directly. Inspect live discovery and report the exact missing operation.",
    observation: {
      command: "atlas workers inspect @inspect-request.json",
      mcpAction: "inspect",
      readOnly: true,
      automaticPolling: false,
      policy:
        "Use bounded caller scheduling, obey server retry hints and stop on denial, missing capability or terminal evidence. No busy loops or mutation retries to refresh status.",
      stateMeaning:
        "A persisted lifecycle state is not proof of provider execution, readiness, shutdown, or billing settlement.",
      serverHandling:
        "If supplied, read worker.handling as server guidance under current authority. Missing handling means unknown, not ready. Neither next-action advice nor executionAvailable grants permission.",
    },
    uncertainOutcome: {
      nextAction: "inspect",
      identity: "same saved workerId and current authorized principal",
      replayMutation: false,
      allocateFreshRequestId: false,
      revisePendingIntent: false,
      exitCondition:
        "canonical reconciliation of the known attempt, not a timeout or local process exit",
    },
  };
}

function workerLifecycleGuidance() {
  return {
    schemaVersion: 1,
    kind: "atlas-computer-recovery-guidance",
    authority:
      "current canonical Atlas task, generation, fence, lease and grants",
    sessionEnded:
      "Session exit is not whole-job termination; detached work can continue.",
    idleWarm: "Processes may resume from frozen memory on warm wake.",
    idleCold:
      "Memory can be lost while configured Services start fresh on wake.",
    serviceRestart:
      "An old on-disk Service definition or cached binding grants no execution, connector or model authority.",
    checkpointRestore:
      "Separately authorized destructive disk restore must not reinstate canceled authority, resume inference or settle unresolved effects.",
    dispatchAuthorityFromDisk: false,
    releaseHoldsOnRestart: false,
    providerLifecycleLiveAccepted: false,
    recovery:
      "Inspect the canonical known attempt. Preserve unresolved execution and inference holds; never replay with a fresh request ID.",
    neverUseAsImplicitCancellation: [
      "restart",
      "restore",
      "destroy",
      "security-policy changes",
    ],
    documentation: {
      checkedOn: "2026-11-10",
      status: "conflicting-official-documentation",
      conflict:
        "Generic guidance says sleep stops processes and checkpoints include process/memory state. Dedicated pages describe warm resumption and disk-only snapshots with restored Services restarting. These are documentation claims, not live acceptance.",
      sources: [
        "https://docs.fly.io/sprites/working-with-sprites",
        "https://docs.fly.io/sprites/concepts/lifecycle",
        "https://docs.fly.io/sprites/concepts/checkpoints",
        "https://docs.fly.io/sprites/concepts/services",
        "https://docs.fly.io/sprites/api/exec/kill-exec-session",
      ],
    },
  };
}

const workerDescriptions = {
  create:
    "Request creation of one worker bound to the selected authorized Line. An admission receipt is not deployment, readiness, Codex pairing or live inference.",
  inspect:
    "Read current state of this exact worker. Does not create a worker, change authority or prove an unreported external effect completed.",
  run: "Request one bounded run of an existing canonical task at its observed admission version and the worker's current revision. Does not create a task or grant tools/model access.",
  cancel:
    "Request cancellation at the observed worker revision. Acceptance or session exit is not whole-job termination, inference settlement or confirmation that billing stopped.",
  checkpoint:
    "Request an idle disk checkpoint at the observed worker revision. It is not a memory/process-resume promise and cannot reverse external effects.",
  restore:
    "Request separately authorized destructive restoration of a checkpoint returned by this exact worker. Restored Service definitions do not renew task authority, credentials or grants, settle holds or undo external effects.",
} as const;

/** Synthetic examples are local parser inputs, never authorized resources. */
export function workerExamples() {
  const workerId = "11111111-1111-4111-8111-111111111111";
  const lineId = "33333333-3333-4333-8333-333333333333";
  const taskId = "44444444-4444-4444-8444-444444444444";
  return Object.keys(workerActions).map((action, index) => {
    const request: Record<string, unknown> = { workerId };
    if (action !== "inspect")
      request.requestId = `22222222-2222-4222-8222-22222222222${index}`;
    if (action !== "create" && action !== "inspect")
      request.expectedRevision = 1;
    if (action === "create")
      Object.assign(request, { lineId, label: "Synthetic Personal Computer" });
    if (action === "run")
      Object.assign(request, {
        taskId,
        taskVersion: 1,
        prompt:
          "Using only the selected synthetic fixture, write a short report and return its artifact reference. Do not contact external services.",
      });
    if (action === "restore") request.checkpointId = "v1";
    return {
      action,
      synthetic: true,
      serverChecked: false,
      operationSent: false,
      sequence: false,
      cliArguments: request,
      mcpArguments: { action, ...request },
    };
  });
}

export function workerContract() {
  const uuid = {
    type: "string",
    minLength: 36,
    maxLength: 36,
    pattern:
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
  };
  const version = {
    type: "integer",
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  };
  const properties: Record<string, unknown> = {
    workerId: {
      ...uuid,
      description:
        "Stable worker identity. Generate once for a new create intent; otherwise use the exact authorized worker ID already returned or saved.",
    },
    requestId: {
      ...uuid,
      description:
        "Unique identity for one logical mutation. Save with the complete request before dispatch; never change it to recover an uncertain effect.",
    },
    lineId: {
      ...uuid,
      description:
        "Exact current authorized Line selected from verified registration/discovery. A synthetic example ID or display name is not authority.",
    },
    taskId: {
      ...uuid,
      description:
        "Existing authorized canonical task identity. This operation does not create a task from an arbitrary UUID.",
    },
    expectedRevision: {
      ...version,
      description:
        "Observed worker revision for this deliberate mutation. A conflict requires inspection, not automatic rebasing.",
    },
    taskVersion: {
      ...version,
      description:
        "Observed canonical task admission version saved with this run intent. It becomes immutable initialTaskVersion for the run, separate from later authority snapshots.",
    },
    label: {
      description:
        "Human-readable worker label, not identity or authority. Nonblank under ECMAScript trim; no NUL; at most 80 UTF-16 code units.",
      type: "string",
      minLength: 1,
      maxLength: 80,
      pattern: "^[^\\u0000]*$",
      "x-maxUtf16CodeUnits": 80,
    },
    prompt: {
      description:
        "Bounded instructions using only authorized inputs. Not a grant, credential carrier or task-creation mechanism. Nonblank, no NUL, at most 32768 UTF-8 bytes.",
      type: "string",
      minLength: 1,
      maxLength: 32768,
      pattern: "^[^\\u0000]*$",
      "x-maxUtf8Bytes": 32768,
    },
    checkpointId: {
      description:
        "Checkpoint reference actually returned for this worker. Matching its syntax alone does not establish provenance or restore external effects.",
      type: "string",
      minLength: 2,
      maxLength: 21,
      pattern: "^v[0-9]{1,20}$",
      not: { pattern: "\\s" },
    },
  };
  return {
    schemaVersion: 1,
    contract: "urn:atlas:cloud-workers:candidate:1",
    availability: "source-only",
    authority: "guidance_only",
    serverChecked: false,
    operationSent: false,
    tool: "atlas_workers",
    descriptions: workerDescriptions,
    lifecycle: workerLifecycleGuidance(),
    handling: workerHandlingGuide(),
    examples: workerExamples(),
    authorization: {
      principal:
        "This CLI profile or native MCP installation, never a human session or another harness credential.",
      verify: [
        "live tool discovery and exact advertised request schema",
        "current account, installation and Line",
        "selected worker and canonical task authority",
        "runtime, driver, input/tool access and approved spend",
      ],
      discoveryGrantsAuthority: false,
      promptGrantsAuthority: false,
    },
    recovery: {
      inspect: "atlas workers inspect @inspect-request.json",
      inspectRequest:
        "Use only workerId from the saved mutation; inspect takes no requestId and creates no operation.",
      mutation:
        "Persist the complete request, principal, origin, workerId and requestId before dispatch. One logical mutation has one immutable request; requestId is not an auto-retry switch.",
      responseLoss:
        "Inspect that worker under the same current authority and use the server's documented recovery. Never blindly replay or allocate a new requestId while the outcome is uncertain.",
      revisionConflict:
        "Inspect current state and reconcile deliberately. Do not silently replace expectedRevision or taskVersion on a pending request.",
      authorityChanged:
        "Stop. A replacement connection must not impersonate the original principal or replay its receipts.",
      adapterAutomaticRetries: 0,
      transportAuthentication:
        "The MCP SDK may resubmit the same wire request after successful authentication refresh. This is not lost-response recovery or new authority; the server must authorize before effects.",
    },
    clientErrors: {
      worker_request_invalid:
        "Invalid local action, JSON, value or bound. Nothing was sent.",
      worker_request_fields_invalid:
        "Missing/unsupported local fields. Only expected field names and unsupported count are returned; input is not echoed.",
      worker_discovery_ambiguous: "Duplicate worker tools. Nothing was sent.",
      worker_discovery_incomplete:
        "Discovery cursor repeated or exceeded 20 pages. Nothing was sent.",
      worker_capability_unavailable:
        "Tool or action absent from complete live discovery. Nothing was sent.",
      worker_contract_mismatch:
        "Saved request failed the usable advertised schema. Nothing was sent; review the server contract before changing intent.",
    },
    serverErrors:
      "Returned unchanged by the server; this client does not invent server error codes. A transport failure is an unknown effect, not a no-op guarantee.",
    cli: {
      validate: "atlas workers validate ACTION @request.json",
      execute: "atlas workers ACTION @request.json",
      actionProperty:
        "CLI supplies action; native MCP requests include action.",
      maxRequestBytes: 65536,
      requestPersistence:
        "Save the complete request and requestId before mutation; files are read-only inputs, not credential stores.",
    },
    semanticRefinements: [
      "label and prompt must contain non-whitespace text under ECMAScript trim and cannot contain NUL.",
      "label is limited to 80 UTF-16 code units; JSON Schema maxLength alone counts Unicode code points.",
      "prompt is limited to 32768 UTF-8 bytes; JSON Schema maxLength alone is insufficient.",
      "checkpointId must be returned by the selected worker; structural validity does not establish provenance.",
      "worker, line, task, version and revision must be resolved from current authorized state before execution.",
    ],
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        action: { type: "string", enum: Object.keys(workerActions) },
      },
      required: ["action"],
      oneOf: Object.entries(workerActions).map(([action, fields]) => ({
        type: "object",
        properties: {
          action: {
            const: action,
            description:
              workerDescriptions[action as keyof typeof workerDescriptions],
          },
          ...Object.fromEntries(
            fields.map((field) => [field, properties[field]]),
          ),
        },
        required: ["action", ...fields],
        additionalProperties: false,
      })),
    },
  };
}

/** Compatibility entry point: expose only the current computer workflow. */
export function workerGuide() {
  return {
    ...personalComputerGuide(),
    notice:
      "This command does not describe the current computer API. Use atlas setup guide, live discovery and atlas://guides/atlas for this server.",
  };
}

export function workerActionHelp(action: string) {
  if (!Object.hasOwn(workerActions, action)) return undefined;
  const contract = workerContract();
  return {
    schemaVersion: 1,
    action,
    description: workerDescriptions[action as keyof typeof workerDescriptions],
    readOnly: action === "inspect",
    example: workerExamples().find((example) => example.action === action),
    authorization: contract.authorization,
    recovery: contract.recovery,
    lifecycle: contract.lifecycle,
    handling: contract.handling,
    clientErrors: contract.clientErrors,
    authority: "guidance_only",
    availability: "source-only",
    validate: `atlas workers validate ${action} @request.json`,
    execute: `atlas workers ${action} @request.json`,
    cliFields: [...workerActions[action as keyof typeof workerActions]],
    actionProperty: contract.cli.actionProperty,
    inputSchema: contract.inputSchema.oneOf.find(
      (schema) => schema.properties.action.const === action,
    ),
    semanticRefinements: contract.semanticRefinements,
    next: "Save exact intent, validate offline, then check live capabilities and current authority before execution. Use workers guide for the complete workflow.",
  };
}
