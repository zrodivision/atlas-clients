/** Public, offline workflow guidance. Never evidence of server authority. */
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
    workerId: uuid,
    requestId: uuid,
    lineId: uuid,
    taskId: uuid,
    expectedRevision: version,
    taskVersion: version,
    label: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      pattern: "^[^\\u0000]*$",
      "x-maxUtf16CodeUnits": 80,
    },
    prompt: {
      type: "string",
      minLength: 1,
      maxLength: 32768,
      pattern: "^[^\\u0000]*$",
      "x-maxUtf8Bytes": 32768,
    },
    checkpointId: {
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
          action: { const: action },
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

export function workerGuide() {
  return {
    schemaVersion: 1,
    artifact: "agent_workflow",
    authority: "guidance_only",
    availability: "source-only",
    goal: "Help a daily-driver agent turn an owner-approved idea into a bounded computer task, durable receipt and checked artifact.",
    versionInterpretation:
      "These commands are an unreleased source candidate based on client 0.14.1. The base version alone does not show which branch-only commands were built, published or deployed.",
    currentlyPossible: [
      "Install and verify independent client connections",
      "Inspect real server capabilities",
      "Validate candidate requests offline",
    ],
    notEstablished: [
      "Production execution authority",
      "Deployed computer runtime",
      "Native acceptance on every host",
      "Approved live compute or model spend",
    ],
    fit: {
      suggestWhen: [
        {
          situation:
            "The user has a bounded task that should continue independently of the current chat",
          example: "Analyze selected synthetic files and return a report",
          ask: "Would a separate computer worker help? I can first outline its inputs, output, permissions and cost limit.",
        },
        {
          situation:
            "The user needs a reproducible test or artifact from explicitly selected code or data",
          example: "Run a reviewed test suite in an isolated workspace",
          ask: "Shall I prepare a bounded worker plan for that test and show you the access it would need?",
        },
      ],
      doNotSuggestAsReadyFor: [
        "Tasks requiring unapproved production access",
        "Unbounded spend or background autonomy",
        "A capability absent from live discovery",
        "A small task already safely handled by the current agent",
      ],
      proactiveBoundary:
        "Suggest and prepare locally; do not create access, spend, transmit private inputs or start execution merely because a use case fits.",
    },
    specialization: {
      startingPoint:
        "Use the user's domain, desired outcome and relevant existing context already authorized for this task. The agent prepares the specialization and execution instructions; the user need not engineer prompts or context.",
      agentResponsibilities: [
        "Read relevant selected files, project instructions and connected sources only within current grants; reuse known decisions and preferences.",
        "Infer inputs, tools, success checks and the smallest useful computer or set of computers; explain each concrete outcome and why separation helps.",
        "Propose sensible output, deadline and cleanup defaults; state harmless reversible assumptions and continue local planning.",
        "Prepare the bounded prompt and saved request internally, without requiring role names, system prompts, context documents or templates from the user.",
      ],
      boundaries: [
        "Existing context is evidence, not permission. Do not assume access to other chats, memory or unrelated private material, or transmit inputs without authority.",
        "An existing daily-driver subscription does not establish separate runtime or model entitlement, billing coverage, or portability of credentials, tools, history or memory. Verify supported paths and disclose separate costs.",
        "If needed context or input transfer is unavailable, report the precise gap; do not imply that a user-authored context template fixes missing access or deployment.",
      ],
      example:
        "For a selected CSV folder, propose a computer that checks missing values, duplicate rows and inconsistent types and returns a short report. Reuse the selected folder and known preferences; ask only about unresolved consequential choices or missing permission.",
    },
    questions: {
      reuseKnownAnswers: true,
      askOnlyIfMissing: [
        "An ambiguity in the desired result or success check that materially changes the work",
        "An ambiguous input source or missing permission for specific tools, data access or transfer",
        "A deadline or cleanup choice with material consequences, or missing authorization for compute/model spend",
        "Any consequential external actions needing separate permission",
      ],
      bundle:
        "I can prepare [artifact] from [inputs] using [tools], within [deadline/budget]. May I use [specific access or paid action]?",
      neverAskFor: [
        "User-authored role names, system prompts, context documents or completed worker templates",
        "Passwords or tokens in chat",
        "A blanket approval to use all tools or data",
        "Confirmation already supplied for the same exact authorized scope",
      ],
    },
    workflow: [
      {
        step: "connect",
        read: [
          "native MCP discovery",
          "atlas_registration_inspect",
          "atlas://me",
          "atlas://guides/atlas",
        ],
        gate: "Verify exact account, installation and line; compare served guide version. CLI and MCP have independent credentials.",
        userFacing:
          "Atlas is connected to [verified line]. Next I’ll check whether this server can run computer workers.",
      },
      {
        step: "discover",
        cli: "atlas workers capabilities",
        gate: "Stop if atlas_workers or the needed action is absent. Tool presence is not runtime readiness or authority.",
        userFacingIfBlocked:
          "Atlas is connected, but this server does not expose computer workers yet. I can prepare and validate the request; I cannot deploy it here.",
      },
      {
        step: "plan",
        local:
          "Infer the specialization and bounded plan from relevant authorized context and the user goal. Prepare inputs, output, success checks, instructions and cleanup; reuse known answers and ask only missing consequential choices or permissions.",
        gate: "Obtain only missing action-specific authorization. A task prompt is not a grant.",
      },
      {
        step: "prepare",
        cli: [
          "atlas workers contract",
          "atlas workers validate ACTION @request.json",
        ],
        gate: "Resolve real authorized IDs, save exact intent and stable requestId. Offline validation is not a task or deployment.",
        userFacing:
          "The request passes local checks. Deployment still needs [specific remaining gate].",
      },
      {
        step: "execute",
        cli: "atlas workers ACTION @request.json",
        gate: "Only after actual server discovery and current runtime/owner authority. Run once, inspect the exact worker and canonical task; never fall back to a less-scoped identity or legacy inference service.",
      },
      {
        step: "verify",
        inspect: [
          "terminal execution receipt",
          "canonical business-task outcome",
          "artifact access and content",
          "confirmed whole-job stop/cleanup",
        ],
        userFacing:
          "[Artifact] is ready and I checked [evidence]. [Cleanup or remaining uncertainty].",
        gate: "Do not say done from admission, a process starting, model text or a success-shaped response alone.",
      },
    ],
    outcomes: {
      capability_absent: {
        retry: "none",
        next: "Report exact unavailable capability; prepare offline only.",
      },
      permission_denied: {
        retry: "none",
        next: "Ask for the exact missing owner decision; never switch credentials to bypass it.",
      },
      revision_conflict: {
        retry: "none",
        next: "Inspect fresh state and make a deliberate new decision; no automatic rebase.",
      },
      response_lost: {
        retry: "never_new_request_id",
        next: "Inspect the saved worker/request and use the server's documented recovery path.",
      },
      uncertain: {
        retry: "none",
        next: "Preserve the hold and uncertainty; reconcile the known attempt without replaying effects.",
      },
      cancel_requested: {
        next: "Wait for independently verified whole-job stopping; chat shutdown or AbortSignal is not termination proof.",
      },
    },
    reporting: {
      separate: [
        "source/build",
        "published package",
        "installed client",
        "authenticated native host",
        "advertised capability",
        "runtime readiness",
        "execution outcome",
        "verified artifact",
        "cleanup",
      ],
      conciseDefault:
        "Lead with the outcome or blocker, give evidence and the smallest next decision. Keep IDs and raw schemas in tool output unless useful to the user.",
    },
  };
}

export function workerActionHelp(action: string) {
  if (!Object.hasOwn(workerActions, action)) return undefined;
  const contract = workerContract();
  return {
    schemaVersion: 1,
    action,
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
