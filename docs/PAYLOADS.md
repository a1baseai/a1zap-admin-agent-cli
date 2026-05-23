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

type SessionSource = "global" | "community" | "group" | "agent" | "private";
type CanonicalRole = "global" | "community" | "none";

type MiniAppSession = {
  instanceId: Id;
  _id: Id;
  microAppId: Id;
  name: string;
  status: "active" | "archived";
  source: SessionSource;
  community: {
    id: Id;
    _id: Id;
    name: string;
    displayName: string;
    handle: string;
    logoUrl?: string | null;
  } | null;
  communityId?: Id | null;
  groupId?: Id | null;
  agentId?: Id | null;
  isGlobalInstance: boolean;
  isCanonical: boolean;
  isResolvedCanonical: boolean;
  canonicalRole: CanonicalRole;
  canonicalRoutingScope: "global" | "community";
  canonicalCommunityId?: Id | null;
  sharedDataVersion: number;
  sharedDataPresent: boolean;
  sharedDataSizeBytes: number | null;
  computedAggregatesPresent: boolean;
  computedAggregatesComputedAt?: TimestampMs | null;
  memberCount: number;
  owner: Owner | null;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
};

type SessionDataEnvelope = {
  kind: "a1zap.microAppSessionData.v1";
  downloadedAt: string;
  app: {
    id: Id;
    _id: Id;
    handle: string;
    name: string;
  };
  session: MiniAppSession;
  base: {
    sharedDataVersion: number;
    sharedDataPresent: boolean;
    dataHash: string;
  };
  data: unknown;
};

type SessionBackup = {
  source: "instance_data" | "social_builder_canonical";
  backupId: Id;
  sourceLabel: string;
  status: string;
  restorable: boolean;
  backedUpAt: TimestampMs;
  backedUpAtIso: string;
  backupVersion: number;
  sharedDataVersion: number;
  sharedDataPresent: boolean;
  sharedDataSizeBytes: number | null;
  sourceInstanceId: Id | null;
  sourceInstanceName: string | null;
  sourceInstanceMatchesSelected: boolean;
  note: string | null;
  backedUpBy: null;
};

type AdminSurface =
  | "all"
  | "growth"
  | "communities"
  | "users"
  | "mini-apps"
  | "mini-app-generations"
  | "mini-app-triage"
  | "social-builders"
  | "content"
  | "student-jobs"
  | "codes"
  | "sparks"
  | "agents"
  | "hosting"
  | "projects"
  | "tasks"
  | "company-state";

type AdminSurfaceCatalogEntry = {
  surface: Exclude<AdminSurface, "all">;
  title: string;
  scope: "growth:read" | "miniapps:read" | "admin:read";
  adminPages: string[];
  data: string[];
};

type Community = {
  _id: Id;
  name: string;
  displayName: string;
  handle: string;
  description: string;
  communityType: string;
  subCategory?: string | null;
  region?: string | null;
  athleticConference?: string | null;
  state?: string | null;
  logoUrl?: string | null;
  status: "active" | "paused" | "archived" | "pending";
  visibility: "public" | "unlisted" | "private";
  joinability: "open" | "application" | "invite_only" | "verification_only";
  hasMicroAppsAccess: boolean;
  targeted: boolean;
  enrollment?: {
    total?: number;
    undergraduate?: number;
    graduate?: number;
    asOfYear?: number;
    source?: string;
  } | null;
  stats: Record<string, number>;
  verificationConfig: {
    methods: string[];
    emailDomains: string[];
    autoApprove: boolean;
    requiresManualReview: boolean;
    requiredFields: string[];
  };
  membershipConfig: unknown;
  landingPageConfig?: unknown;
  foundedAt: TimestampMs;
  updatedAt?: TimestampMs | null;
};

type AdminUser = {
  _id: Id;
  displayName?: string | null;
  email?: string | null;
  emailDomain?: string | null;
  handle?: string | null;
  profileImageUrl?: string | null;
  primaryCommunityId?: Id | null;
  communityBadges: unknown[];
  ageGroup?: string | null;
  timezone?: string | null;
  lastSignInAt?: TimestampMs | null;
  signedUpAt?: TimestampMs | string | null;
  isTestUser: boolean;
  isDeleted: boolean;
  hasMicroAppsAccess: boolean;
  hasCompletedOnboarding: boolean;
  firstMicroAppCreatedAt?: TimestampMs | null;
  referralCount?: number | null;
  subscriberCount?: number | null;
  signupAttribution: {
    sourceMicroAppId?: Id | null;
    sourceMicroAppOwnerId?: Id | null;
    sourcePlatform?: string | null;
    sourceInstanceId?: Id | null;
    hasShareCode: boolean;
    hasAnonymousActorId: boolean;
  };
};

type MiniAppGeneration = {
  _id: Id;
  microAppId?: Id | null;
  owner: AdminUser | null;
  app: { _id: Id; name: string; handle: string; publicationStatus?: string | null; isArchived: boolean } | null;
  status: string;
  buildFlowVariant?: "classic" | "nextbuild" | "pipeline_v3" | null;
  workflowPhase?: string | null;
  workflowStep?: string | null;
  progress?: number | null;
  isEditGeneration: boolean;
  isAdminRegeneration: boolean;
  targetCommunityId?: Id | null;
  targetCommunityContext?: unknown;
  targetPublicationStatus?: string | null;
  templateId?: Id | null;
  promptSummary: unknown;
  reviewResult?: unknown;
  pipelineV3?: unknown;
  error?: string | null;
  failurePhase?: string | null;
  generationStartedAt?: TimestampMs | null;
  completedAt?: TimestampMs | null;
  buildDurationMs?: number | null;
  estimatedBuildTimeMs?: number | null;
  retryCount?: number | null;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
  publishedAt?: TimestampMs | null;
};

type MiniAppTriageResult = {
  _id: Id;
  runId: string;
  appId: Id;
  appName: string;
  appHandle: string;
  ok: boolean;
  severity?: number | null;
  gapCategory?: "seed_data" | "community_context" | "liveness" | "code_quality" | "none" | "other" | null;
  nextAction?: string | null;
  reasoning?: string | null;
  errorMessage?: string | null;
  sharedDataBytes?: number | null;
  sharedDataIsEmpty?: boolean | null;
  hasCommunity?: boolean | null;
  statsAtRun?: { installs: number; activeUsers: number; totalSessions: number } | null;
  actionStatus: "pending" | "done" | "dismissed";
  feedbackNote?: string | null;
  feedbackAt?: TimestampMs | null;
  createdAt: TimestampMs;
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

## `admin catalog`

Backend route: `GET /admin/catalog?surface=<surface>`

Required scope: `admin:read`

```bash
a1zap-admin-agent admin catalog [--surface all]
```

Output:

```ts
{
  generatedAt: TimestampMs;
  surface: AdminSurface;
  surfaces: AdminSurfaceCatalogEntry[];
  redactions: string[];
}
```

Use this first when an agent needs to discover which admin data exists. It lists the backing admin pages and the data classes exposed for Growth, communities/campuses, users/signups, mini apps, Social Builders, content/email, student jobs, codes, Sparks, agents, and hosting.

## `admin context`

Backend route: `GET /admin/context?surface=<surface>&limit=<limit>`

Required scope: `admin:read`

```bash
a1zap-admin-agent admin context [--surface all] [--limit 40]
```

`research context` is an alias:

```bash
a1zap-admin-agent research context [--surface social-builders] [--limit 40]
```

Output:

```ts
{
  generatedAt: TimestampMs;
  surface: AdminSurface;
  limit: number;
  catalog: AdminSurfaceCatalogEntry[];
  contexts: Partial<Record<Exclude<AdminSurface, "all">, unknown>>;
  redactions: string[];
}
```

Context keys by surface:

```ts
type AdminContexts = {
  growth?: unknown; // same payload as `growth context --section all`
  communities?: {
    communities: Community[];
    pendingVerifications: Array<{
      _id: Id;
      communityId: Id;
      community: Community | null;
      user: AdminUser | null;
      role: string;
      verificationMethod: string;
      joinedAt: TimestampMs;
      lastActiveAt: TimestampMs;
      hiddenFromList: boolean;
    }>;
  };
  users?: {
    recentUsers: Array<AdminUser & {
      primaryCommunity: Community | null;
      signupSourceMiniApp: MiniApp | null;
    }>;
  };
  "mini-apps"?: { recentMiniApps: MiniApp[] };
  "mini-app-generations"?: { recentGenerations: MiniAppGeneration[] };
  "mini-app-triage"?: {
    latestRun: unknown | null;
    results: MiniAppTriageResult[];
    recentFeedbackEvents: unknown[];
  };
  "social-builders"?: {
    community: Community | null;
    hubContent: unknown;
    builders: unknown[];
    officialApps: Array<{ link: unknown; app: MiniApp | null }>;
    trackedCampuses: {
      trackedCommunityIds: Id[];
      campuses: unknown[];
      communities: Array<Community | null>;
    };
    pipelineCandidates: unknown[];
    socialAccounts: unknown[];
    trackerEntries: unknown[];
    recentPosts: unknown[];
    openTasks: unknown[];
    recentHours: unknown[];
    recentContracts: unknown[];
    recentActivity: unknown[];
  };
  content?: {
    blog: { articles: unknown[]; authors: unknown[] };
    communityContent: unknown[];
    transactionalEmails: { adminPages: string[]; note: string };
  };
  "student-jobs"?: { jobs: unknown[]; companies: unknown[] };
  codes?: {
    inviteCodes: unknown[];
    redeemCodes: unknown[];
    recentRedemptions: unknown[];
  };
  sparks?: {
    walletSample: {
      sampleSize: number;
      sampleLimited: boolean;
      totals: Record<string, number>;
    };
    recentLedgerEntries: unknown[];
  };
  agents?: { agents: unknown[] };
  hosting?: { projects: unknown[]; services: unknown[] };
  projects?: { projects: unknown[] };
  tasks?: {
    tasks: unknown[];
    overdueTasks: unknown[];
    openHighPriorityTasks: unknown[];
  };
  "company-state"?: {
    generatedAt: TimestampMs;
    growth: unknown;
    projects: unknown;
    tasks: unknown;
    miniAppTriage: unknown;
    socialBuilders: unknown;
    hosting: unknown;
  };
};
```

Safety notes:

- Mini-app source code is not included here; use `miniapps get --include-code`, which requires `miniapps:code:read`.
- Invite/redeem code values are masked as `codeMasked`.
- Social account login details and credential envelopes are replaced by credential-state booleans.
- Hosting secrets, tokens, and environment variables are intentionally excluded.

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
  campuses: CampusGrowthRow[];
};

type CampusGrowthRow = {
  // Convex vettedCommunities id. Use this as the stable target id.
  communityId: Id;
  name: string;
  handle: string;
  logoUrl?: string;
  state?: string;
  targeted: boolean;
  enrollment: {
    total: number;
    asOfYear?: number;
    source?: string;
    sourceUrl?: string;
    updatedAt?: TimestampMs;
    updatedBy?: Id;
    notes?: string;
  };
  currentUsers: number;
  penetration: number;
  weekOverWeekChange: number;
  currentWeekNewUsers: number;
  previousWeekNewUsers: number;
  current24hNewUsers: number;
  previous24hNewUsers: number;
  lastWeek24hNewUsers: number;
  // This powers the row sparkline/trend shown in Growth Admin.
  series: CampusGrowthSeriesPoint[];
};

type CampusGrowthSeriesPoint = {
  dateKey: string;
  startTimestamp: TimestampMs;
  endTimestamp: TimestampMs;
  value: number;
  newUsers: number;
  penetration: number;
  weekOverWeekChange: number;
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

Campus penetration usage:

```bash
a1zap-admin-agent growth context --section campus-penetration
```

Read `campusPenetration.campuses` for the data shown in the Growth Admin table:

```ts
{
  campusPenetration: {
    currentUsers: 1194;
    totalEnrollment: 388985;
    value: 0.00307;
    targetedCampusCount: 7;
    enrolledCampusCount: 10;
    campuses: [
      {
        communityId: "k...";
        name: "UNSW";
        handle: "unsw";
        logoUrl: "https://...";
        targeted: true;
        enrollment: { total: 64053, asOfYear: 2024 };
        currentUsers: 543;
        penetration: 0.00848;
        weekOverWeekChange: 0.017;
        currentWeekNewUsers: 9;
        series: [
          {
            dateKey: "2026-05-17";
            value: 543;
            newUsers: 9;
            penetration: 0.00848;
            weekOverWeekChange: 0.017;
            startTimestamp: 1778400000000;
            endTimestamp: 1779004799999;
          }
        ];
      }
    ];
  }
}
```

In the current backend contract, this section is university/campus-focused: active academic communities with `subCategory = "university"` and official enrollment. City or non-university community penetration can be added as a new section once the maker Growth Admin read model exposes those rows.

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

## `sessions list`

Backend route: `GET /mini-apps/:appId/sessions`

Required scope: `sessions:read`

```bash
a1zap-admin-agent sessions list <app-id-or-handle> [--limit 50] [--canonical] [--table]
```

JSON output:

```ts
{
  app: MiniApp;
  generatedAt: TimestampMs;
  sessions: MiniAppSession[];
  count: number;
  filters: {
    canonicalOnly: boolean;
    limit: number;
  };
  canonicalRouting: {
    canonicalInstanceId: Id | null;
    canonicalReady: boolean;
    canonicalCommunityId: Id | null;
    scope: "global" | "community";
  };
}
```

## `sessions context`

Backend route: `GET /mini-apps/:appId/session-management`

Required scope: `sessions:read`

```bash
a1zap-admin-agent sessions context <app-id-or-handle> [--limit 100]
```

JSON output includes session policy, canonical routing, approved community assignments, and session rows:

```ts
{
  app: MiniApp;
  generatedAt: TimestampMs;
  sessionManagement: {
    appId: Id;
    globalCanonicalInstanceId: Id | null;
    sessionPolicy: Record<string, unknown>;
    canonicalRouting: Record<string, unknown>;
    approvedCommunityAssignments: Array<{
      communityId: Id;
      communityName: string;
      communityHandle?: string | null;
      communityLogoUrl?: string | null;
      communityInstanceId?: Id | null;
      isFeatured: boolean;
      usageStats?: Record<string, unknown> | null;
    }>;
    sessions: MiniAppSession[];
  };
}
```

## `sessions canonical`

Backend route: `GET /mini-apps/:appId/canonical-sessions`

Required scope: `sessions:read`

```bash
a1zap-admin-agent sessions canonical <app-id-or-handle> [--limit 50] [--table]
```

JSON output:

```ts
{
  app: MiniApp;
  generatedAt: TimestampMs;
  sessions: MiniAppSession[];
  canonicalSessions: MiniAppSession[];
  count: number;
  filters: { canonicalOnly: true; limit: number };
  canonicalRouting: Record<string, unknown>;
}
```

## `sessions get`

Backend route: `GET /sessions/:instanceId`

Required scope: `sessions:read`

```bash
a1zap-admin-agent sessions get <instanceId>
```

JSON output:

```ts
{
  app: MiniApp;
  session: MiniAppSession;
  canonicalRouting: Record<string, unknown>;
  generatedAt: TimestampMs;
}
```

## `sessions data download`

Backend route: `GET /sessions/:instanceId/data`

Required scope: `sessions:data:read`

```bash
a1zap-admin-agent sessions data download <instanceId> --out session.json
```

Without `--out`, stdout is the full editable envelope:

```ts
SessionDataEnvelope
```

With `--out`, the envelope is written to disk and stdout is:

```ts
{
  ok: true;
  path: string;
  instanceId: Id;
  base: SessionDataEnvelope["base"];
}
```

Only `data` should be edited. `base.sharedDataVersion` and `base.dataHash` are used for upload conflict checks.

## `sessions data validate`

Backend route: `POST /sessions/:instanceId/data/validate`

Required scope: `sessions:data:read`

```bash
a1zap-admin-agent sessions data validate --file session.json
```

Request body sent by CLI:

```ts
{
  envelope: SessionDataEnvelope;
}
```

JSON output:

```ts
{
  ok: true;
  generatedAt: TimestampMs;
  session: MiniAppSession;
  validation: {
    dataSizeBytes: number;
    maxDepth: number;
    baseVersion: number;
    currentVersion: number;
    versionMatches: boolean;
    baseDataHash: string | null;
    currentDataHash: string;
    dataHashMatches: boolean;
  };
}
```

## `sessions data upload`

Backend route: `POST /sessions/:instanceId/data/upload`

Required scope: `sessions:data:write`

```bash
a1zap-admin-agent sessions data upload <instanceId> --file session.json --yes [--allow-canonical] [--confirm-shrink]
```

Request body sent by CLI:

```ts
{
  yes: true;
  envelope: SessionDataEnvelope;
  allowCanonical: boolean;
  confirmShrink: boolean;
}
```

Upload creates a backup first, rejects stale `sharedDataVersion` or `dataHash`, requires `--allow-canonical` for canonical sessions, and requires `--confirm-shrink` when top-level keys are removed.

JSON output:

```ts
{
  success: true;
  instanceId: Id;
  appId: Id;
  backupId: Id;
  previousVersion: number;
  version: number;
  sharedDataSizeBytes: number;
  dataHashBefore: string;
  dataHashAfter: string;
  isCanonical: boolean;
  canonicalRole: CanonicalRole;
}
```

Version conflicts return HTTP `409` and CLI exit code `1`.

## `sessions data edit`

Backend routes: `GET /sessions/:instanceId/data`, then `POST /sessions/:instanceId/data/upload`

Required scopes: `sessions:data:read`, `sessions:data:write`

```bash
a1zap-admin-agent sessions data edit <instanceId> --editor "$EDITOR" [--allow-canonical] [--confirm-shrink]
```

The CLI downloads a session envelope to a temp file, opens the configured editor, then uploads the edited envelope with the same safety checks as `sessions data upload`.

## `sessions backups list`

Backend route: `GET /sessions/:instanceId/backups`

Required scope: `sessions:backups:read`

```bash
a1zap-admin-agent sessions backups list <instanceId> [--limit 25] [--table]
```

JSON output:

```ts
{
  app: { id: Id; _id: Id; handle: string; name: string };
  session: MiniAppSession;
  currentSharedDataVersion: number;
  backups: SessionBackup[];
  count: number;
}
```

## `sessions backups create`

Backend route: `POST /sessions/:instanceId/backups`

Required scope: `sessions:backups:write`

```bash
a1zap-admin-agent sessions backups create <instanceId> [--note "..."]
```

Request body sent by CLI:

```ts
{
  note?: string;
}
```

JSON output:

```ts
{
  success: true;
  backupId: Id;
  appId: Id;
  instanceId: Id;
  backedUpAt: TimestampMs;
  sharedDataVersion: number;
  sharedDataPresent: boolean;
  dataHash: string;
}
```

## `sessions backups restore`

Backend route: `POST /sessions/:instanceId/backups/:backupId/restore`

Required scope: `sessions:restore`

```bash
a1zap-admin-agent sessions backups restore <instanceId> <backupId> --yes [--source instance_data|social_builder_canonical] [--allow-canonical]
```

Request body sent by CLI:

```ts
{
  yes: true;
  source: "instance_data" | "social_builder_canonical";
  allowCanonical: boolean;
}
```

The backend creates a safety backup of the current target session before applying the restore. Canonical sessions require `--allow-canonical`.

JSON output:

```ts
{
  success: true;
  instanceId: Id;
  appId: Id;
  previousVersion: number;
  version: number;
  restoredFrom: {
    source: "instance_data" | "social_builder_canonical";
    backupId: Id;
    sourceInstanceId: Id | null;
  };
  safetyBackupId: Id;
  sharedDataSizeBytes: number;
  dataHashBefore: string;
  dataHashAfter: string;
  isCanonical: boolean;
  canonicalRole: CanonicalRole;
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
