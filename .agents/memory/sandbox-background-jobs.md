---
name: Long-running jobs in this sandbox
description: nohup/setsid background processes die at tool-call boundaries; use a managed workflow instead.
---

Detached background processes (`setsid nohup … &`, plain `… &`) DO NOT survive
in this environment. They start, may print their first log line, then get killed
the moment the spawning bash tool call returns — leaving no error trace (looks
like a silent crash).

**Rule:** for any long-running one-shot job (e.g. a paid backfill/regen that takes
minutes), run it as a managed workflow, not a backgrounded shell command:
- `configureWorkflow({ name, command, outputType: "console", autoStart: true })`
- poll `getWorkflowStatus({ name })` until `state === "finished"`
- `removeWorkflow({ name })` when done.

**Why:** the workflow supervisor owns the process group and keeps it alive across
tool-call boundaries; a bash-detached process is in the bash call's cgroup and is
reaped when that call ends. The repo already uses one-shot commands as workflows
(the `test-*` workflows), so this is the sanctioned pattern.

**How to apply:** if a job needs to outlive a single bash invocation, never reach
for nohup/setsid — register a console workflow and poll it. If it MUST stay in
bash, it has to finish inside one call's timeout (≤120s).

**Workflow limit bug:** configureWorkflow enforces a hard 10-workflow limit with a stale count (says 32/10 even after removals) — removing a workflow is possible but re-adding is NOT. Never remove existing test workflows to make room; run long builds/tests via shell in ≤115s chunks instead (mobile build: METRO_KEEP_CACHE=1 + free METRO_PORT makes a second warm run finish in time).
