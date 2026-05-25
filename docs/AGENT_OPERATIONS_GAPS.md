# Agent Operations Capability Gaps

This document captures the agent-operations surface for running the A1Zap Student Jobs Board, UGC, Summer In outreach, and cross-project task loops from the CLI.

## Current State

- `whoami`, `admin catalog`, `admin context`, Growth, mini-app, session, backup, and generic action commands exist.
- Production reads work when the configured key has `admin:read`.
- The local repo default API URL is already `https://www.a1zap.com/api/admin-agent-cli`.
- The local installed copy was refreshed from this repo on 2026-05-25; publish a fresh build so other installs get the same canonical production default.
- The CLI exposes typed client commands for jobs, UGC, outreach, Summer In, and projects.
- Maker now exposes matching `/api/admin-agent-cli/*` routes and Convex handlers for these command groups.
- The existing CLI still does not expose typed commands for maker's agent-fleet/workspace backend routes.
- The existing audited action surface is mostly mini-app, community, and Social Builder oriented until maker adds the action types below.

## Needed Scopes

For cautious execution, an agent key should include:

- `admin:read`
- `growth:read`
- `miniapps:read`
- `sessions:read`
- `sessions:data:read`
- `actions:propose`
- `actions:apply`, only for approved apply flows
- `sessions:data:write`, only for explicit session edits
- `sessions:backups:write`, before session edits
- `agent-fleet:read`
- `agent-fleet:write`
- `agent-workspace:read`
- `agent-workspace:write`
- `agent-workspace:exec`, only where command execution is intended
- `jobs:read`
- `jobs:write`
- `jobs:publish`
- `ugc:read`
- `ugc:write`
- `outreach:read`
- `outreach:write`
- `outreach:send`, only for approved send flows
- `summer-in:read`
- `summer-in:write`
- `projects:read`
- `projects:write`

## Config And Health Commands

Implemented client command:

```bash
a1zap-admin-agent config get --redacted
a1zap-admin-agent doctor
a1zap-admin-agent doctor --needs admin:read,actions:propose,agent-workspace:write
```

`doctor` should verify:

- Config file path and permissions.
- API URL and canonical production host.
- Key presence without printing the raw key.
- Current scopes and missing scopes for the requested operation.
- Request ID on success and failure.
- Backend route availability for the command groups the agent expects.

## Student Jobs Commands

Implemented client commands:

```bash
a1zap-admin-agent jobs list --lane all --status all --country all --limit 100
a1zap-admin-agent jobs get <jobId>
a1zap-admin-agent jobs import --file roles.csv --dry-run
a1zap-admin-agent jobs qa set <jobId> --score 4 --recommendation accept --note "..."
a1zap-admin-agent jobs lane set <jobId> --lane scraped_student_job
a1zap-admin-agent jobs status set <jobId> --status draft
a1zap-admin-agent jobs publish propose <jobId>
a1zap-admin-agent jobs publish apply <proposalId> --yes
a1zap-admin-agent jobs stale mark <jobId> --reason "closed listing"
```

Maker now has typed routes and audited action entries for:

- `upsert_student_job`
- `patch_student_job`
- `set_student_job_qa`
- `set_student_job_lane`
- `set_student_job_publication_status`
- `mark_student_job_stale`
- `bulk_import_student_jobs`

The job read model should include counts by status, country, category, review status, lane, source type, QA recommendation, stale verification, and import batch.

## Student Jobs Operations Fields

Maker stores the operational fields agents need on `studentJobs`:

- `job_lane`
- `source_type`
- `source_external_id`
- `import_batch_id`
- `last_verified_at`
- `qa_score`
- `qa_recommendation`
- `qa_notes`
- `missing_fields`
- `human_review_status`
- `next_action`
- `next_action_date`
- `application_flow`
- `company_visibility`
- `pay_type`
- `pay_range`
- `usage_rights`
- `outreach_stage`

Agent updates should be patch-style, so updating QA, lane, status, review, verification, or next action does not require resubmitting the full admin job form payload.

## UGC Commands

Implemented client commands:

```bash
a1zap-admin-agent ugc leads list --status all
a1zap-admin-agent ugc leads upsert --file ugc-leads.csv --dry-run
a1zap-admin-agent ugc briefs propose --lead <leadId> --file brief.json
a1zap-admin-agent ugc briefs approve <briefId> --yes
```

Maker stores brand, hidden-company mode, pay/reward, usage rights, deliverables, creator requirements, review status, and publication status in the admin-agent UGC queue.

## Outreach Commands

Implemented client commands:

```bash
a1zap-admin-agent outreach targets list --project summer-in --status all
a1zap-admin-agent outreach targets upsert --file employer-targets.csv --dry-run
a1zap-admin-agent outreach drafts create --target <targetId> --template summer-in-intern-experience
a1zap-admin-agent outreach drafts approve <draftId> --yes
a1zap-admin-agent outreach send <draftId> --yes
```

Sending requires `outreach:send`; draft creation/approval use `outreach:write`. The current backend marks approved drafts as sent and audits the transition.

## Summer In Commands

Implemented client commands:

```bash
a1zap-admin-agent summer-in employers list --status all
a1zap-admin-agent summer-in links create --employer <targetId> --campaign summer_in_2026 --channel email
a1zap-admin-agent summer-in links list --campaign summer_in_2026
a1zap-admin-agent summer-in metrics --campaign summer_in_2026 --by employer
```

Reports should default to aggregate employer-level metrics. Student-level reporting should require explicit privacy/product approval.

## Projects And Tasks Commands

Implemented client commands:

```bash
a1zap-admin-agent projects list --status active
a1zap-admin-agent projects tasks list --project <projectId> --status all
a1zap-admin-agent projects tasks upsert --project <projectId> --file tasks.json --dry-run
a1zap-admin-agent projects tasks status <taskId> --status blocked --note "..."
a1zap-admin-agent projects super-list --status active --format json
```

Backend action types:

- `upsert_project`
- `upsert_project_task`
- `set_project_task_status`
- `append_project_task_note`
- `create_cross_project_action_report`

## Agent Fleet And Workspace Commands

Expose CLI groups for the backend routes already present in maker:

```bash
a1zap-admin-agent workspace manifest
a1zap-admin-agent workspace read <path>
a1zap-admin-agent workspace search <query>
a1zap-admin-agent workspace write <path> --file local.json --dry-run
a1zap-admin-agent workspace append <path> --text "..."
a1zap-admin-agent workspace exec -- <command>
a1zap-admin-agent agent-fleet runtime-key create
a1zap-admin-agent agent-fleet runs start --agent <agentId>
a1zap-admin-agent agent-fleet runs finish <runId>
```

Workspace write and exec commands should require explicit scopes, idempotency, audit IDs, and redacted output.

## Acceptance Tests

The CLI is ready for this operating work when a fresh terminal can:

1. Run `whoami` and see scopes without exposing the full key.
2. Run `doctor --needs ...` and get actionable missing-scope output.
3. Read active projects and tasks.
4. Read student job inventory plus QA/import/lane state.
5. Upsert a draft student job with `--dry-run`, then propose/apply the write.
6. Mark a job as QA-reviewed and blocked or publishable.
7. Upsert 40 Summer In employer targets from CSV with no sends.
8. Generate one employer-specific Summer In link in draft or disabled state.
9. Create but not send an outreach draft for one target.
10. Update project task status to done or blocked with an audit trail.
11. Export a cross-project action list as JSON.
