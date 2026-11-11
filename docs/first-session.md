# First-session guide and cold-start acceptance

## Purpose and release status

Test the agent experience from the owner's words **install Atlas** to a verified
connection and a useful crash course. The first target is a genuinely fresh
Instinct assistant with no installed Atlas skill, connectors, credentials or
personal context. This is an agent-driven test, not a browser UI cohort or a
preconfigured demo.

This document is source-only preparation on the 0.14.2-rc.4 client candidate for
0.15 assembly. It does not establish publication, production deployment or
Instinct compatibility. Public documentation checked on 2026-11-10:
[Instinct](https://instinct.com/) describes a phone/computer assistant but supplies
no custom MCP setup contract. Its [app](https://app.instinct.com/) is the account
entry. Capability support must be observed in the actual account, not inferred
from third-party integration claims or another host's acceptance.

The maintained agent crash course is near the top of
[the canonical skill](../skills/atlas/SKILL.md). It ships in the generated hosted
plugin. A connected host without skills reads the reviewed server copy through
`atlas_resources_read` at `atlas://guides/atlas`; this does not require a local
skill installer. The public README is the unauthenticated discovery entry.

## Before the live trial

- Record the exact public client release, service deployment and served guide
  version/hash. The reviewed client commit and private server guide pin must agree
  before claiming that this change reached an agent. Test the publicly available
  route, not a checkout-only command.
- Verify which install paths the candidate actually supports. Remote MCP uses
  `https://connectatlas.io/mcp` and native OAuth. Browser entry is
  `https://connectatlas.io/app`; it is not the API base. CLI login needs supported
  local browser/loopback prerequisites. `atlas auth diagnose` is not auth.
- Keep the Instinct relationship blank. Do not preload this guide, add credentials,
  seed a memory, transfer an existing agent's context or silently prepare its
  connector. The human can approve their own sign-in/connection during the test.
- Distinct Instinct identity must be an explicit owner decision. Do not reuse
  another assistant's credential or equate a shared account with shared grants.
- Capture only a redacted transcript, bounded tool/action names and failure codes,
  timings and version evidence. Do not copy passwords, OAuth links/codes/tokens,
  profile files, private memory or unrelated account data into this public repo.
- Operator preflight must not interact with Instinct or change its configuration.
  A separate test account/fixture may rehearse recovery without contaminating the
  first real encounter. No outside-agent messages are needed for preflight.

## Baseline run

The owner sends exactly:

> Install Atlas.

Do not append a URL, skill, explanation, account summary or desired tool sequence.
Observe the agent's independent discovery. If it asks which Atlas, one concise
product clarification is reasonable; record that the name alone needed help and
keep it separate from an unassisted discovery pass. A wrong product installation
is a failure, not a successful route.

Allow supported sign-in and permission handoffs when the owner chooses to approve
them. A skill file, custom-connector config or browser login alone is not success.
The agent should verify its actual authenticated tools and identity, read the
server-pinned guide and charter, and explain the useful concepts without teaching
the entire operations manual. If setup cannot proceed, it should stop accurately
without repeated retries, requests for secrets in chat or invented settings.

After its first completion report, the owner asks:

> What can I do with Atlas now, and what still needs my approval?

Only then use an explicit optional follow-up goal. No imports, messages, grants,
workers, paid inference or monitoring are part of the install-only baseline.

## Acceptance gates

1. **Product discovery.** Finds the correct official product and public install
   path, or asks one focused disambiguation. Do not count a URL-seeded retry as an
   unassisted pass. Record every human intervention.
2. **Host fit.** Observes whether this Instinct account supports native remote MCP
   OAuth or a compatible CLI path. Does not invent support, a settings menu,
   a package name or a browser callback that cannot reach its computer.
3. **Consent and identity.** Owner approves the exact connection and Line.
   Existing account membership grants no context or spending. The agent does not
   copy another host's credentials, mint a key or use human session cookies.
4. **Authenticated proof.** Current discovery plus `atlas_registration_inspect`
   and `atlas://me` verify the intended account, installation and Line. A pending
   OAuth handoff remains pending. No duplicate Line on retry.
5. **Self-teaching.** Reads `atlas://network/charter` and the server-served
   `atlas://guides/atlas` without an installed skill. Records its version/hash;
   older published guidance is not evidence the candidate was delivered.
6. **Blank-state usefulness.** Explains Line, messages, Vault, Signal and optional
   Computers in plain language. Empty or unreadable context is not a setup error.
   No fabricated profile, automatic context import, unrelated connector setup,
   outside message, worker creation, carrier route or recurring work.
7. **Truthful availability.** Separates advertised tools, current permissions,
   provider/runtime readiness and actual completed work. Source-only computer
   commands and native voice claims remain gated by observed deployment evidence.
8. **Completion quality.** Gives a short verified-state report and one optional
   next step, or the exact supported blocker. Does not drown the owner in setup
   detail or ask them to author a worker specification before seeing value.

A full cold-start pass requires gates 1–8 on the actual released path. A truthful
host-support blocker is a **safe blocked result**, not end-to-end acceptance.
An assisted pass is useful diagnosis, but never upgrades the untouched baseline.
No numerical performance target is asserted before the first observed session;
record elapsed time and human interventions to establish a baseline.

## Recovery runs, recorded separately

- **Interrupted consent:** owner declines or closes auth. Agent says pending or
  cancelled and preserves the blank state. Resume only through supported consent;
  verify after completion, without creating extra Lines or access paths.
- **Repeated install:** after a verified connection, repeat the original request.
  Agent inspects and reuses the current connection. No duplicate credentials,
  Lines, skills, profile collection or permission expansion.
- **Missing/stale tools or guide:** use isolated fixture evidence or a separate
  supported trial. Agent checks the host's supported refresh, follows the served
  guide version and does not invent missing tools or borrow an identity.
- **Context unavailable:** distinguish no records, no read grant and unsupported
  discovery. No broad grant merely to make the demo appear populated.
- **Revoked connection:** report the lost authority and stop affected operations.
  Human may explicitly reconnect; no credential substitution or automatic replay.
- **No MCP and no viable CLI login:** explain the exact host limitation and stop.
  Do not route around it with email, phone, another agent or hidden credentials.

## Evidence record

For each run retain: run ID/date, baseline or assisted/recovery, exact owner
prompt, client/host version where observable, service deployment identifier,
served guide version/hash, discovered transport, verified identity match (redacted),
ordered safe action trace, approval/intervention count, elapsed time, each gate's
PASS/FAIL/BLOCKED/NOT_RUN status, exact blocker and the agent's final explanation.

Keep evidence in the authorized private test location, not this public repository.
Classify failures separately: product discovery, host integration, authentication,
service contract, guide comprehension or permission behavior. A correct setup
recipe does not prove host acceptance; a captured guide read does not prove agent
understanding; a configured connection does not prove usable authentication.

## Source validation and release handoff

`npm run test:first-session` checks the public guide's bounded front door,
read-only verification examples against reviewed MCP schemas and generated plugin
parity. These are structural offline regression checks, not an Instinct simulation.
Run the full repository checks and native packaging tests as well. Do not treat a
fixture pass as native OAuth, real model behavior or end-to-end acceptance.

After review, coordinate publication, release identity and immutable server guide
pinning through the release process. Only after deployment is independently
verified should the owner begin the untouched Instinct baseline. Do not contact
Instinct on the owner's behalf, create access, publish, merge or deploy as a
side effect of preparing this runbook.
