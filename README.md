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
export A1ZAP_ADMIN_AGENT_API_URL=https://a1zap.com/api/admin-agent-cli
```

## Commands

```bash
a1zap-admin-agent whoami
a1zap-admin-agent growth context --section all --limit 40
a1zap-admin-agent growth summary
a1zap-admin-agent growth summary --table
a1zap-admin-agent miniapps list --limit 50 --status all
a1zap-admin-agent miniapps search "campus"
a1zap-admin-agent miniapps get <id-or-handle>
a1zap-admin-agent miniapps get <id-or-handle> --include-code
a1zap-admin-agent miniapps audit <id-or-handle>
a1zap-admin-agent actions propose "update this app metadata..."
a1zap-admin-agent actions apply <auditEntryId> --yes
a1zap-admin-agent actions cancel <auditEntryId>
```

Default output is full JSON for agents. `growth summary` and `--table` are convenience views only.

## Required Backend

This package expects `a1zap-maker` to expose:

- `GET /api/admin-agent-cli/whoami`
- `GET /api/admin-agent-cli/growth/context`
- `GET /api/admin-agent-cli/mini-apps`
- `GET /api/admin-agent-cli/mini-apps/search`
- `GET /api/admin-agent-cli/mini-apps/:appId`
- `GET /api/admin-agent-cli/mini-apps/:appId/audit`
- `POST /api/admin-agent-cli/actions/propose`
- `POST /api/admin-agent-cli/actions/:auditEntryId/apply`
- `POST /api/admin-agent-cli/actions/:auditEntryId/cancel`

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
