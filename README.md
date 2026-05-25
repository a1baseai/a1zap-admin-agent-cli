# A1Zap Admin Agent CLI

Agent-focused CLI for A1Zap admin Growth and mini-app workflows.

The CLI is only a client. It talks to the secured `/api/admin-agent-cli/*` routes owned by `a1zap-maker`, and every request requires an `a1zap_admin_...` key with the right scopes.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/a1baseai/a1zap-admin-agent-cli/main/install.sh | bash
```

Then configure a key:

```bash
a1zap-admin-agent config set a1zap_admin_your_key_here
```

For non-production or local maker deployments:

```bash
a1zap-admin-agent config set a1zap_admin_your_key_here --api-url http://localhost:3000/api/admin-agent-cli
```

Environment variables override local config:

```bash
export A1ZAP_ADMIN_AGENT_KEY=a1zap_admin_your_key_here
export A1ZAP_ADMIN_AGENT_API_URL=https://www.a1zap.com/api/admin-agent-cli
```

## Commands

```bash
a1zap-admin-agent whoami
a1zap-admin-agent admin catalog
a1zap-admin-agent admin context --surface all --limit 40
a1zap-admin-agent research context --surface social-builders
a1zap-admin-agent growth context --section all --limit 40
a1zap-admin-agent growth summary
a1zap-admin-agent growth summary --table
a1zap-admin-agent miniapps list --limit 50 --status all
a1zap-admin-agent miniapps search "campus"
a1zap-admin-agent miniapps get <id-or-handle>
a1zap-admin-agent miniapps get <id-or-handle> --include-code
a1zap-admin-agent miniapps audit <id-or-handle>
a1zap-admin-agent sessions list <app-id-or-handle> --canonical
a1zap-admin-agent sessions context <app-id-or-handle>
a1zap-admin-agent sessions canonical <app-id-or-handle>
a1zap-admin-agent sessions get <instanceId>
a1zap-admin-agent sessions data download <instanceId> --out session.json
a1zap-admin-agent sessions data validate --file session.json
a1zap-admin-agent sessions data upload <instanceId> --file session.json --yes
a1zap-admin-agent sessions data upload <instanceId> --file session.json --yes --allow-canonical
a1zap-admin-agent sessions backups list <instanceId>
a1zap-admin-agent sessions backups create <instanceId> --note "before edit"
a1zap-admin-agent sessions backups restore <instanceId> <backupId> --yes
a1zap-admin-agent actions propose "update this app metadata..."
a1zap-admin-agent actions apply <auditEntryId> --yes
a1zap-admin-agent actions cancel <auditEntryId>
a1zap-admin-agent doctor --needs admin:read,actions:propose
a1zap-admin-agent jobs list --country AU --status active --limit 100
a1zap-admin-agent jobs import --file roles.csv --dry-run
a1zap-admin-agent jobs qa set <jobId> --score 4 --recommendation accept --yes
a1zap-admin-agent jobs lane set <jobId> --lane scraped_student_job --yes
a1zap-admin-agent ugc leads upsert --file ugc-leads.csv --dry-run
a1zap-admin-agent outreach targets upsert --file employer-targets.csv --dry-run
a1zap-admin-agent summer-in links create --employer <targetId> --campaign summer_in_2026 --channel email --dry-run
a1zap-admin-agent projects super-list --status active
```

Default output is full JSON for agents. `growth summary` and `--table` are convenience views only.

## JSON Payloads

Every command's expected request and response shape is documented in [docs/PAYLOADS.md](docs/PAYLOADS.md).

Agent operations gaps for Student Jobs, UGC, Summer In outreach, project tasks, and agent workspace commands are tracked in [docs/AGENT_OPERATIONS_GAPS.md](docs/AGENT_OPERATIONS_GAPS.md).

Short version:

- `whoami` returns the authenticated key, scopes, and request id.
- `admin catalog` returns the agent-readable list of admin data surfaces, source admin pages, scopes, fields, and redaction rules.
- `admin context` returns bounded JSON snapshots across Growth, communities, users, mini apps, Social Builders, content, jobs, codes, Sparks, agents, hosting metadata, projects, tasks, and compact company state.
- `research context` is an alias for `admin context`, intended for research agents and workflows that combine this CLI with tools like postdoc CLI.
- `growth context` returns full canonical Growth Admin JSON by default.
- `growth context --section campus-penetration` includes the per-university/community table rows from Growth Admin: targeted status, enrollment, users, penetration, WoW, new users, and trend series.
- `growth summary` returns a smaller JSON summary derived from `growth context --section overview`.
- `miniapps list/search/get/audit` return mini-app admin read models.
- `miniapps get --include-code` includes source bundle fields and requires the backend `miniapps:code:read` scope.
- `sessions list/context/canonical/get` expose mini-app session rows, canonical routing, approved community assignments, shared-data versions, member counts, and safe owner/community context.
- `sessions data download` returns an editable `a1zap.microAppSessionData.v1` envelope. Only the `data` property should be edited.
- `sessions data upload` requires `--yes`, writes only through the stored envelope, creates a backup first, checks the downloaded `sharedDataVersion`, and requires `--allow-canonical` for canonical sessions.
- `sessions backups` lists, creates, and restores session shared-data backups. Restores require `sessions:restore` and `--yes`.
- `actions propose` returns a proposal with an `auditEntryId`.
- `actions apply` only accepts `auditEntryId` plus `--yes`; action payloads are loaded from the stored audit entry.
- `actions cancel` marks a stored proposal cancelled.
- `doctor` checks auth, scopes, API URL, and request ID without printing the raw key.
- `jobs`, `ugc`, `outreach`, `summer-in`, and `projects` commands are agent operations surfaces for the newer backend contract. Mutating commands require `--dry-run` or `--yes`.

## Required Backend

This package expects `a1zap-maker` to expose:

- `GET /api/admin-agent-cli/whoami`
- `GET /api/admin-agent-cli/admin/catalog`
- `GET /api/admin-agent-cli/admin/context`
- `GET /api/admin-agent-cli/growth/context`
- `GET /api/admin-agent-cli/mini-apps`
- `GET /api/admin-agent-cli/mini-apps/search`
- `GET /api/admin-agent-cli/mini-apps/:appId`
- `GET /api/admin-agent-cli/mini-apps/:appId/audit`
- `GET /api/admin-agent-cli/mini-apps/:appId/sessions`
- `GET /api/admin-agent-cli/mini-apps/:appId/session-management`
- `GET /api/admin-agent-cli/mini-apps/:appId/canonical-sessions`
- `GET /api/admin-agent-cli/sessions/:instanceId`
- `GET /api/admin-agent-cli/sessions/:instanceId/data`
- `POST /api/admin-agent-cli/sessions/:instanceId/data/validate`
- `POST /api/admin-agent-cli/sessions/:instanceId/data/upload`
- `GET /api/admin-agent-cli/sessions/:instanceId/backups`
- `POST /api/admin-agent-cli/sessions/:instanceId/backups`
- `POST /api/admin-agent-cli/sessions/:instanceId/backups/:backupId/restore`
- `POST /api/admin-agent-cli/actions/propose`
- `POST /api/admin-agent-cli/actions/:auditEntryId/apply`
- `POST /api/admin-agent-cli/actions/:auditEntryId/cancel`

Agent-operations backend routes are documented in [docs/AGENT_OPERATIONS_GAPS.md](docs/AGENT_OPERATIONS_GAPS.md). These include `/jobs`, `/ugc`, `/outreach`, `/summer-in`, and `/projects` route groups.

Admin-agent keys are created/revoked from signed-in system-admin routes in maker. Raw keys are shown once; only hashes are stored in Convex.

## Local Development

```bash
npm install
npm run build
npm test
```

Install from a local checkout:

```bash
A1ZAP_ADMIN_AGENT_INSTALL_SOURCE_DIR=$PWD ./install.sh
```
