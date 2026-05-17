# A1Zap Admin Agent CLI Payloads

This is the JSON contract agents should expect from `a1zap-admin-agent`.

Default command output is JSON unless the command explicitly supports `--table`. The CLI sends `Authorization: Bearer <a1zap_admin_...>`, `X-Request-Id`, and `X-A1Zap-Agent-Command` on every backend request.

## Shared Types

```ts
type Id = string;
type TimestampMs = number;

type ErrorEnvelope = {
  error: string;
  status?: number;
  message: string;
  requestId?: string;
  payload?: unknown;
};

type Last24hComparison = {
  value: number;
  previous24hValue: number;
  lastWeek24hValue: number;
  absoluteChange: number;
  percentChange: number | null;
  lastWeekAbsoluteChange: number;
  lastWeekPercentChange: number | null;
  windows: {
    current: { start: TimestampMs; end: TimestampMs };
    previous: { start: TimestampMs; end: TimestampMs };
    lastWeek: { start: TimestampMs; end: TimestampMs };
  };
};

type SeriesPoint = {
  dateKey: string;
  startTimestamp: TimestampMs;
  endTimestamp: TimestampMs;
  value?: number;
  weekOverWeekChange?: number;
  [key: string]: unknown;
};

type Owner = {
  id?: Id;
  _id?: Id;
  displayName?: string | null;
  email?: string | null;
  handle?: string | null;
  profileImageUrl?: string | null;
};

type MiniApp = {
  id: Id;
  _id: Id;
  name: string;
  handle: string;
  description?: string | null;
  subtitle?: string | null;
  utilityDescription?: string | null;
  utilityTitle?: string | null;
  funTitle?: string | null;
  appType?: string | null;
  iconUrl?: string | null;
  faviconAssets?: unknown;
  coverImageUrl?: string | null;
  publication: {
    status: "draft" | "private" | "unlisted" | "public" | "community_only";
    categories?: string[];
    tags?: string[];
    shortDescription?: string;
    longDescription?: string;
    screenshots?: string[];
    demoVideoUrl?: string;
    publishedAt?: TimestampMs;
    lastUpdatedAt?: TimestampMs;
  };
  publicationStatus: string;
  stats?: Record<string, unknown>;
  keyActionConfig?: unknown;
  keyActions?: unknown[];
  designSystem?: unknown;
  appConfig?: unknown;
  isHandPicked: boolean;
  curatorScore?: number;
  isMarkedAsBroken: boolean;
  hideBuiltBySection: boolean;
  isProfileApp: boolean;
  isArchived: boolean;
  archivedAt?: TimestampMs;
  socialBuilderAdmin?: unknown;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
  owner: Owner | null;
  bundle:
    | {
        entryType: "react" | "html";
        version: number;
        lastBuiltAt: TimestampMs;
        sizeBytes?: number;
        dependencies?: string[];
        hasCss: boolean;
        hasFiles: boolean;
      }
    | {
        entryType: "react" | "html";
        code: string;
        css?: string;
        version: number;
        lastBuiltAt: TimestampMs;
        sizeBytes?: number;
        dependencies?: string[];
        files?: Record<string, string>;
      };
};
```

## `config set`

Stores credentials locally. It does not call the backend.

```bash
a1zap-admin-agent config set <key> [--api-url <url>]
```

Writes:

```ts
// ~/.a1zap/admin-agent/config.json
{
  "apiKey": "a1zap_admin_...",
  "apiUrl": "https://a1zap.com/api/admin-agent-cli"
}
```

Output:

```ts
{
  ok: true;
  configPath: string;
  apiUrl?: string;
  keyPrefix: string;
}
```

## `whoami`

Backend route: `GET /whoami`

Required scope: any valid active admin-agent key.

```bash
a1zap-admin-agent whoami
```

Output:

```ts
{
  ok: true;
  key: {
    id: Id;
    keyPrefix: string;
    label?: string;
    scopes: string[];
    createdByUserId?: Id;
  };
  requestId: string;
}
```

## `growth context`

Backend route: `GET /growth/context?section=<section>&limit=<limit>`

Required scope: `growth:read`

```bash
a1zap-admin-agent growth context [--section all] [--limit 40]
```

Valid sections:

```ts
type GrowthSection =
  | "all"
  | "overview"
  | "users"
  | "sessions"
  | "living-apps"
  | "activated-builders"
  | "campus-penetration"
  | "social-builders"
  | "ai-orchestrator";
```

`section=all` output:

```ts
{
  section: "all";
  generatedAt: TimestampMs;
  timezone: "America/Los_Angeles";
  growthMetrics: {
    generatedAt: TimestampMs;
    timezone: "America/Los_Angeles";
    northStar: {
      users: GrowthUsersMetric;
      livingApps: GrowthLivingAppsMetric;
      campusPenetration: GrowthCampusPenetrationMetric;
      socialBuilders: GrowthSocialBuildersMetric;
      activatedBuilders: GrowthActivatedBuildersMetric;
      userRetention: GrowthUserRetentionMetric;
      sessions: GrowthSessionsMetric;
    };
    totals: GrowthTotals;
    signups: GrowthSignups;
    series: { last14Days: Array<{ dateKey: string; newUsers: number; startTimestamp: TimestampMs; endTimestamp: TimestampMs }> };
  };
  aiOrchestrator: AiOrchestratorContext;
}
```

Common Growth metric shape:

```ts
type GrowthMetricBase = {
  value: number | null;
  weekOverWeekChange: number;
  last24h: Last24hComparison;
  series: SeriesPoint[];
};
```

Important section-specific fields:

```ts
type GrowthUsersMetric = GrowthMetricBase & {
  currentWeekNewUsers: number;
  previousWeekNewUsers: number;
};

type GrowthSessionsMetric = GrowthMetricBase & {
  currentWeekNewSessions: number;
  previousWeekNewSessions: number;
  totalApps: number;
  computedAt: TimestampMs | null;
};

type GrowthLivingAppsMetric = GrowthMetricBase & {
  launchedValue: number;
  launchedThreshold: number;
  livingRetentionThreshold: number;
  livingActiveUserGrowthThreshold: number;
  currentRetentionRate: number;
  currentActiveUserGrowth: number;
  apps: Array<MiniApp & {
    firstTrackedAt: TimestampMs;
    source: Record<string, boolean>;
    phase?: {
      isLaunched: boolean;
      isLiving: boolean;
      launchedAt: TimestampMs | null;
      currentWeekKey: string | null;
    };
    growth?: {
      cumulativeKeyActions: number;
      keyActionEventsCurrentWeek: number;
      appOpenEventsCurrentWeek: number;
      currentActiveUsers: number;
      previousActiveUsers: number;
      retainedUsers: number;
      retentionRate: number;
      activeUserGrowth: number;
    };
  }>;
};

type GrowthActivatedBuildersMetric = GrowthMetricBase & {
  activationThreshold: number;
  eligibleBuilderCount: number;
  builderWithAppCount: number;
  activatedAppCount: number;
  totalExternalApps: number;
  builders: Array<Record<string, unknown>>;
  apps: Array<Record<string, unknown>>;
};

type GrowthCampusPenetrationMetric = GrowthMetricBase & {
  value: number | null;
  currentUsers: number;
  totalEnrollment: number;
  campusCount: number;
  targetedCampusCount: number;
  enrolledCampusCount: number;
  campuses: Array<Record<string, unknown>>;
};

type GrowthSocialBuildersMetric = GrowthMetricBase & {
  builderCount: number;
  buildersWithLiveApps: number;
  liveAppConversionRate: number | null;
  livingApps: number;
  signupsTotal: number;
  signupsCurrentWeek: number;
  impressionsCurrentWeek: number;
  appUsageCurrentWeek: number;
  builders: Array<Record<string, unknown>>;
};

type GrowthUserRetentionMetric = GrowthMetricBase & {
  currentWeekActiveUsers: number;
  previousWeekActiveUsers: number;
  currentWeekRetainedUsers: number;
  previousWeekRetainedUsers: number;
};
```

Filtered section outputs:

```ts
// --section overview
{
  section: "overview";
  generatedAt: TimestampMs;
  timezone: string;
  northStar: {
    users: GrowthUsersMetric;
    livingApps: GrowthLivingAppsMetric;
    campusPenetration: GrowthCampusPenetrationMetric;
    socialBuilders: GrowthSocialBuildersMetric;
    activatedBuilders: GrowthActivatedBuildersMetric;
    userRetention: GrowthUserRetentionMetric;
    sessions: GrowthSessionsMetric;
  };
  totals: GrowthTotals;
  signups: GrowthSignups;
  series: { last14Days: unknown[] };
}

// --section users
{ section: "users"; generatedAt: TimestampMs; timezone: string; users: GrowthUsersMetric; retention: GrowthUserRetentionMetric; totals: GrowthTotals; signups: GrowthSignups; series: unknown; }

// --section sessions
{ section: "sessions"; generatedAt: TimestampMs; timezone: string; sessions: GrowthSessionsMetric; }

// --section living-apps
{ section: "living-apps"; generatedAt: TimestampMs; timezone: string; livingApps: GrowthLivingAppsMetric; }

// --section activated-builders
{ section: "activated-builders"; generatedAt: TimestampMs; timezone: string; activatedBuilders: GrowthActivatedBuildersMetric; }

// --section campus-penetration
{ section: "campus-penetration"; generatedAt: TimestampMs; timezone: string; campusPenetration: GrowthCampusPenetrationMetric; }

// --section social-builders
{ section: "social-builders"; generatedAt: TimestampMs; timezone: string; socialBuilders: GrowthSocialBuildersMetric; aiOrchestrator: { generatedAt: TimestampMs; socialBuildersCommunity: unknown; openSocialBuilderTasks: unknown[]; latestRun: unknown; latestRunBundle: unknown; } | null; }

// --section ai-orchestrator
{ section: "ai-orchestrator"; generatedAt: TimestampMs; aiOrchestrator: AiOrchestratorContext; }
```

AI orchestrator context:

```ts
type AiOrchestratorContext = {
  latestRun: unknown | null;
  recentRuns: unknown[];
  latestRunBundle: {
    steps: unknown[];
    hermesSteps: unknown[];
    latestHermesStep: unknown | null;
    snapshots: unknown[];
    notes: unknown[];
    proposals: unknown[];
    experiments: unknown[];
    exports: unknown[];
    campusSummaries: unknown[];
  };
  recentNotes: unknown[];
  waitingApproval: unknown[];
  recentProposals: unknown[];
  recentMemories: unknown[];
  strategyMemories: unknown[];
  recentExports: unknown[];
  openSocialBuilderTasks: unknown[];
  sfmActionItems: unknown[];
  convexInsights: {
    campusReports: unknown[];
    attentionAudits: unknown[];
    miniAppAudits: unknown[];
    agentDocuments: unknown[];
  };
  socialBuildersCommunity: unknown | null;
  generatedAt: TimestampMs;
};
```

## `growth summary`

Backend route: `GET /growth/context?section=overview&limit=40`

Required scope: `growth:read`

```bash
a1zap-admin-agent growth summary
a1zap-admin-agent growth summary --table
```

JSON output:

```ts
{
  generatedAt: TimestampMs;
  timezone: string;
  metrics: {
    users: GrowthUsersMetric;
    sessions: GrowthSessionsMetric;
    livingApps: GrowthLivingAppsMetric;
    activatedBuilders: GrowthActivatedBuildersMetric;
    campusPenetration: GrowthCampusPenetrationMetric;
    socialBuilders: GrowthSocialBuildersMetric;
    userRetention: GrowthUserRetentionMetric;
  };
  totals: GrowthTotals;
  signups: GrowthSignups;
}
```

`--table` output is human-readable text, not JSON.

## `miniapps list`

Backend route: `GET /mini-apps?limit=<limit>&status=<status>&archive=<archive>`

Required scope: `miniapps:read`

```bash
a1zap-admin-agent miniapps list [--limit 50] [--status all] [--archive all] [--table]
```

Valid filters:

```ts
type MiniAppStatus = "all" | "draft" | "private" | "unlisted" | "public" | "community_only";
type ArchiveFilter = "all" | "active" | "archived";
```

JSON output:

```ts
{
  page: MiniApp[];
  isDone: boolean;
  continueCursor: string | null;
  count: number;
  filters: {
    status: MiniAppStatus;
    archive: ArchiveFilter;
  };
}
```

`--table` output is human-readable text, not JSON.

## `miniapps search`

Backend route: `GET /mini-apps/search?query=<query>&limit=<limit>&status=<status>&archive=<archive>`

Required scope: `miniapps:read`

```bash
a1zap-admin-agent miniapps search <query> [--limit 50] [--status all] [--archive all] [--table]
```

JSON output:

```ts
{
  apps: MiniApp[];
  count: number;
  filters: {
    status: MiniAppStatus;
    archive: ArchiveFilter;
  };
  query: string;
}
```

`--table` output is human-readable text, not JSON.

## `miniapps get`

Backend route: `GET /mini-apps/:appId?includeCode=<boolean>`

Required scope:

- `miniapps:read` without `--include-code`
- `miniapps:code:read` with `--include-code`

```bash
a1zap-admin-agent miniapps get <id-or-handle>
a1zap-admin-agent miniapps get <id-or-handle> --include-code
```

JSON output:

```ts
{
  app: MiniApp;
}
```

Without `--include-code`, `app.bundle` is metadata only:

```ts
{
  entryType: "react" | "html";
  version: number;
  lastBuiltAt: TimestampMs;
  sizeBytes?: number;
  dependencies?: string[];
  hasCss: boolean;
  hasFiles: boolean;
}
```

With `--include-code`, `app.bundle` includes source:

```ts
{
  entryType: "react" | "html";
  code: string;
  css?: string;
  version: number;
  lastBuiltAt: TimestampMs;
  sizeBytes?: number;
  dependencies?: string[];
  files?: Record<string, string>;
}
```

## `miniapps audit`

Backend route: `GET /mini-apps/:appId/audit?limit=<limit>`

Required scope: `miniapps:read`

```bash
a1zap-admin-agent miniapps audit <id-or-handle> [--limit 10]
```

JSON output:

```ts
{
  app: MiniApp;
  sfmAudits: Array<{
    _id: Id;
    communityId: Id;
    communityHandle: string;
    microAppId: Id;
    title: string;
    auditType: "mini_app_success";
    provider: string;
    model: string;
    inputSummary: string;
    status: "success" | "error";
    error?: string;
    appName: string;
    appHandle?: string;
    successScore: number;
    demandFitScore: number;
    retentionScore: number;
    distributionScore: number;
    attentionScore: number;
    stateOfPlay: string;
    successDefinition: string;
    whatIsWorking: string[];
    failureModes: string[];
    recommendedFixes: Array<Record<string, unknown>>;
    builderBrief: string;
    contentPlan: string[];
    instrumentationNeeds: string[];
    nextExperiments: string[];
    metricsSnapshot: unknown;
    createdAt: TimestampMs;
    updatedAt?: TimestampMs;
  }>;
  refineryRuns: Array<{
    _id: Id;
    miniAppId: Id;
    status: string;
    mode: string;
    controlState: string;
    miniAppUrl: string;
    liveViewUrl?: string;
    recordingUrl?: string;
    persona: string;
    task: string;
    prompt: string;
    viewport: unknown;
    artifacts?: unknown[];
    report?: unknown;
    score?: number;
    verdict?: string;
    lastError?: string;
    startedAt?: TimestampMs;
    completedAt?: TimestampMs;
    createdAt: TimestampMs;
    updatedAt: TimestampMs;
  }>;
}
```

## `actions propose`

Backend route: `POST /actions/propose`

Required scope: `actions:propose`

```bash
a1zap-admin-agent actions propose "<prompt>"
```

Request body sent by CLI:

```ts
{
  message: string;
}
```

JSON output when no action is proposed:

```ts
{
  message: string;
  candidates?: Array<Record<string, unknown>>;
}
```

JSON output with a proposal:

```ts
{
  message: string;
  proposal: {
    id: string;
    auditEntryId: Id;
    prompt: string;
    summary: string;
    plan: string[];
    action: AdminChatAction;
    targets: Array<{
      id: Id;
      kind: "mini_app" | "community" | "social_builder" | "community_mini_app";
      label: string;
      handle?: string | null;
      href?: string;
      description?: string | null;
    }>;
    requiresConfirmation: true;
  };
  candidates?: Array<Record<string, unknown>>;
}
```

Supported action payloads:

```ts
type AdminChatAction =
  | { type: "feature_community_mini_app"; microAppId: Id; communityId: Id; communityMicroAppId?: Id; communityDescription?: string }
  | { type: "update_mini_app_metadata"; microAppId: Id; name?: string; handle?: string; description?: string | null; subtitle?: string | null; utilityTitle?: string | null; funTitle?: string | null; appType?: string | null; isHandPicked?: boolean; curatorScore?: number; isMarkedAsBroken?: boolean; hideBuiltBySection?: boolean }
  | { type: "update_mini_app_web_lead_capture"; microAppId: Id; enabled?: boolean; trigger?: "on_load" | "on_action"; delayMs?: number; copy?: Record<string, unknown>; emailLabel?: string | null; emailPlaceholder?: string | null; allowedDomains?: string[]; domainMessage?: string | null; submitOnSuccess?: "start_signup" | "stay" }
  | { type: "update_mini_app_publication"; microAppId: Id; status: "draft" | "private" | "unlisted" | "public" | "community_only" }
  | { type: "create_mini_app_ai_draft"; microAppId: Id; prompt: string }
  | { type: "update_community_status"; communityId: Id; status: "active" | "paused" | "archived" }
  | { type: "update_community_settings"; communityId: Id; bypassSMS?: boolean; hasMicroAppsAccess?: boolean }
  | { type: "update_community_mini_app"; communityId: Id; communityMicroAppId: Id; microAppId?: Id; isFeatured?: boolean; communityDescription?: string | null; firstFeedSortOrder?: number | null; status?: "pending" | "approved" | "rejected"; rejectionReason?: string | null }
  | { type: "reorder_community_first_feed"; communityId: Id; orderedCommunityMicroAppIds: Id[] }
  | { type: "update_social_builder_admin_profile"; userId: Id; displayName?: string | null; socialBuilderBio?: string | null; socialBuilderAppPitch?: string | null; nextActions?: string | null; adminNotes?: string | null; markTouched?: boolean; manualAudienceSummary?: string | null; socialBuilderHoursReminderEnabled?: boolean; trafficLightStatus?: "red" | "yellow" | "green" | null; keyManagementDocUrl?: string | null; countries?: Array<"AU" | "US" | "OTHER"> }
  | { type: "update_social_builder_mini_app_admin"; microAppId: Id; rolloutStage?: string | null; qualityStatus?: string | null; stabilityStatus?: string | null; userCount?: number | null; nextActions?: string | null; adminNotes?: string | null; markTouched?: boolean }
  | { type: "set_social_builder_official_app"; microAppId: Id; isOfficial: boolean }
  | { type: "upsert_social_builder_task"; taskId?: Id; title: string; note?: string | null; ownerUserId?: Id | null; taskSource?: "manual" | "tech" | "notes_generated" | "activation_checklist" | null; generatedQuestionKey?: string | null; scopeType: "program" | "builder" | "community"; builderUserId?: Id | null; targetCommunityId?: Id | null; dueDate?: string | null; dueTime?: string | null; dueAt?: TimestampMs | null }
  | { type: "set_social_builder_task_status"; taskId: Id; status: "open" | "done" | "archived" }
  | { type: "upsert_community_social_account"; accountId?: Id; ownerUserId: Id; targetType: "member" | "microApp" | "custom"; microAppId?: Id; customEntityName?: string; label: string; platform: "instagram" | "instagram-chat" | "tiktok" | "youtube" | "twitter" | "linkedin" | "whatsapp" | "imessage" | "website" | "facebook" | "discord" | "other"; url: string; handle?: string | null; sortOrder?: number };
```

## `actions apply`

Backend route: `POST /actions/:auditEntryId/apply`

Required scope: `actions:apply`

```bash
a1zap-admin-agent actions apply <auditEntryId> --yes
```

Request body sent by CLI:

```ts
{
  yes: true;
}
```

The backend ignores client-supplied action payloads. It loads the stored audited action by `auditEntryId`.

JSON output:

```ts
{
  success: boolean;
  message?: string;
  errorMessage?: string;
  auditEntryId: Id;
  targetIds: Id[];
  details?: Record<string, unknown>;
}
```

Without `--yes`, the CLI exits with code `2` before making a request.

## `actions cancel`

Backend route: `POST /actions/:auditEntryId/cancel`

Required scope: `actions:cancel`

```bash
a1zap-admin-agent actions cancel <auditEntryId>
```

Request body sent by CLI:

```ts
{}
```

JSON output:

```ts
{
  success: true;
  message: "Proposal cancelled.";
  auditEntryId: Id;
  targetIds: Id[];
}
```

## Error Output

Backend errors are printed as JSON and exit with code `1`:

```ts
{
  error: string;
  status: number;
  message: string;
  payload?: {
    error: string;
    message: string;
    requestId?: string;
    [key: string]: unknown;
  };
}
```

Argument or validation errors are printed to stderr and exit with code `2`.
