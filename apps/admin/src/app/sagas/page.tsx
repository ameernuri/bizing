"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Archive,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  FileJson2,
  FileText,
  Filter,
  List,
  LogOut,
  Link2,
  Play,
  RefreshCw,
  Search,
  XCircle,
  LayoutGrid,
  Wifi,
  WifiOff,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { RequireRole } from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SnapshotRenderer,
  type SnapshotDocument,
} from "@/components/sagas/snapshot-renderer";
import { PlatformHealthCards } from "@/components/sagas/platform-health-cards";
import { LibraryManager } from "@/components/sagas/library-manager";
import { SagaDefinitionsManager } from "@/components/sagas/saga-definitions-manager";
import { RunGroupsGrid } from "@/components/sagas/run-groups-grid";
import { RunsSidebar } from "@/components/sagas/runs-sidebar";
import { RunDetailPanel } from "@/components/sagas/run-detail-panel";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import dynamic from "next/dynamic";

const ReactJsonView = dynamic(() => import("react-json-view"), { ssr: false });

type JsonThemePalette = {
  base00: string;
  base01: string;
  base02: string;
  base03: string;
  base04: string;
  base05: string;
  base06: string;
  base07: string;
  base08: string;
  base09: string;
  base0A: string;
  base0B: string;
  base0C: string;
  base0D: string;
  base0E: string;
  base0F: string;
};

type SagaRun = {
  id: string;
  sagaKey: string;
  status: "pending" | "running" | "passed" | "failed" | "cancelled";
  mode: "dry_run" | "live";
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  bizId?: string | null;
  runnerLabel?: string | null;
  createdAt?: string;
  runSummary?: Record<string, unknown> | null;
};

type SagaStep = {
  id: string;
  phaseTitle: string;
  stepKey: string;
  title?: string;
  actorKey: string;
  status: string;
  instruction: string;
  expectedResult: string | null;
  failureMessage: string | null;
  resultPayload?: Record<string, unknown> | null;
  assertionSummary?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  durationMs?: number;
  delayMode?: "none" | "fixed" | "until_condition" | string | null;
  delayMs?: number | null;
  delayConditionKey?: string | null;
  delayTimeoutMs?: number | null;
  delayPollMs?: number | null;
  delayJitterMs?: number | null;
};

type SagaArtifact = {
  id: string;
  sagaRunStepId?: string | null;
  artifactType: string;
  title: string;
  contentType: string;
  storagePath: string;
  createdAt?: string;
};

type SagaRunDetail = {
  run: SagaRun;
  steps: SagaStep[];
  artifacts: SagaArtifact[];
  actorProfiles?: SagaRunActorProfile[];
  actorMessages?: SagaRunActorMessage[];
  definition: { title: string } | null;
};

type SagaRunActorProfile = {
  id: string;
  actorKey: string;
  actorName: string;
  actorRole: string;
  personaRef?: string | null;
  linkedUserId?: string | null;
  virtualEmail: string;
  virtualPhone: string;
};

type SagaRunActorMessage = {
  id: string;
  sagaRunStepId?: string | null;
  channel: "email" | "sms" | "push" | "in_app";
  status: "queued" | "sent" | "delivered" | "read" | "failed" | "cancelled";
  fromActorProfileId?: string | null;
  toActorProfileId: string;
  fromActorKey?: string | null;
  toActorKey?: string | null;
  subject?: string | null;
  bodyText: string;
  queuedAt?: string;
  deliveredAt?: string | null;
};

type ApiEnvelope<T> = { success: boolean; data: T };
type ArtifactContentPayload = { artifact: SagaArtifact; content: string };

type SagaRunGroup = {
  sagaKey: string;
  latest: SagaRun;
  runs: SagaRun[];
  summary: { total: number; passed: number; failed: number; active: number };
};

type SagaUseCase = {
  id: string;
  ucKey: string;
  title: string;
  status: "draft" | "active" | "archived";
};

type SagaPersona = {
  id: string;
  personaKey: string;
  name: string;
  status: "draft" | "active" | "archived";
};

type SagaDefinition = {
  id: string;
  sagaKey: string;
  title: string;
  description?: string | null;
  status: "draft" | "active" | "archived";
  bizId?: string | null;
  specVersion: string;
  updatedAt?: string;
};

type SagaLibraryOverview = {
  counts: {
    useCases: number;
    personas: number;
    sagaDefinitions: number;
    sagaRuns: number;
    coverageReports: number;
  };
};

type SagaCoverageReport = {
  id: string;
  sagaRunId?: string | null;
  sagaDefinitionId?: string | null;
  coveragePct?: number | null;
  summary?: string | null;
  title?: string | null;
};

type SagaCoverageDetail = {
  report: SagaCoverageReport & {
    reportData?: Record<string, unknown> | null;
  };
  items: Array<{
    id: string;
    itemType: string;
    itemRefKey: string;
    verdict: string;
    nativeToHacky?: string | null;
    coreToExtension?: string | null;
    tags?: string[];
  }>;
  tags: Array<{ id: string; tagKey: string }>;
};

type UseCaseCoverage = {
  verdictTag?: string | null;
  nativeToHackyTag?: string | null;
  coreToExtensionTag?: string | null;
  tags: string[];
  explanation?: string | null;
};

type SchemaCoverageSummary = {
  reportTitle: string;
  totalUseCases: number;
  full: number;
  strong: number;
  partial: number;
  gap: number;
  avgN2h?: number | null;
  avgC2e?: number | null;
};

type LibraryItemKind = "use_case" | "persona";

type SagaLibraryRelationPayload = {
  kind: LibraryItemKind;
  node: Record<string, unknown>;
  versions: Array<Record<string, unknown>>;
  links: Array<{
    id: string;
    sagaDefinitionId: string;
    relationRole: string;
    weight: number | null;
    metadata?: Record<string, unknown> | null;
  }>;
  definitions: Array<{
    id: string;
    sagaKey: string;
    title: string;
    status: "draft" | "active" | "archived";
    description?: string | null;
  }>;
};

/**
 * Render unknown values in a compact, human-readable form for library detail rows.
 */
function formatLibraryFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.trim() ? value : "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "[]" : `${value.length} item(s)`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length === 0 ? "{}" : `{ ${keys.length} key(s) }`;
  }
  return String(value);
}

function libraryDetailFieldEntries(definition: Record<string, unknown>) {
  return Object.entries(definition).sort(([a], [b]) => a.localeCompare(b));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function runStatusMeta(status: SagaRun["status"]) {
  if (status === "passed") {
    return {
      icon: CheckCircle2,
      label: "Passed",
      badgeVariant: "default" as const,
    };
  }
  if (status === "failed") {
    return {
      icon: XCircle,
      label: "Failed",
      badgeVariant: "destructive" as const,
    };
  }
  if (status === "running") {
    return {
      icon: Clock,
      label: "Running",
      badgeVariant: "secondary" as const,
    };
  }
  if (status === "pending") {
    return {
      icon: Clock,
      label: "Pending",
      badgeVariant: "secondary" as const,
    };
  }
  return {
    icon: AlertCircle,
    label: "Cancelled",
    badgeVariant: "outline" as const,
  };
}

function runStatusAccentClass(status: SagaRun["status"]) {
  if (status === "passed") return "border-l-emerald-500";
  if (status === "failed") return "border-l-red-500";
  if (status === "running") return "border-l-blue-500";
  if (status === "pending") return "border-l-amber-500";
  return "border-l-muted-foreground";
}

function runStatusTextClass(status: SagaRun["status"]) {
  if (status === "passed") return "text-emerald-600";
  if (status === "failed") return "text-red-600";
  if (status === "running") return "text-blue-600";
  if (status === "pending") return "text-amber-600";
  return "text-muted-foreground";
}

function stepStatusMeta(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "passed") {
    return {
      icon: CheckCircle2,
      label: "Passed",
      badgeVariant: "default" as const,
    };
  }
  if (normalized === "failed") {
    return {
      icon: XCircle,
      label: "Failed",
      badgeVariant: "destructive" as const,
    };
  }
  if (normalized === "in_progress") {
    return {
      icon: Play,
      label: "In Progress",
      badgeVariant: "secondary" as const,
    };
  }
  if (normalized === "blocked") {
    return {
      icon: AlertCircle,
      label: "Blocked",
      badgeVariant: "secondary" as const,
    };
  }
  if (normalized === "skipped") {
    return {
      icon: ChevronRight,
      label: "Skipped",
      badgeVariant: "outline" as const,
    };
  }
  if (normalized === "cancelled") {
    return {
      icon: XCircle,
      label: "Cancelled",
      badgeVariant: "outline" as const,
    };
  }
  return { icon: Clock, label: "Pending", badgeVariant: "outline" as const };
}

function stepStatusAccentClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "passed") return "border-l-emerald-500";
  if (normalized === "failed") return "border-l-red-500";
  if (normalized === "in_progress") return "border-l-blue-500";
  if (normalized === "blocked") return "border-l-amber-500";
  return "border-l-muted-foreground";
}

function stepStatusTextClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "passed") return "text-emerald-600";
  if (normalized === "failed") return "text-red-600";
  if (normalized === "in_progress") return "text-blue-600";
  if (normalized === "blocked") return "text-amber-600";
  return "text-muted-foreground";
}

function safeArtifactTitle(artifact: SagaArtifact): string {
  const raw = artifact.title?.trim();
  if (raw && !/^undefined\b/i.test(raw)) return raw;
  const fileName = artifact.storagePath
    .split("/")
    .pop()
    ?.replace(/\.[a-z0-9]+$/i, "");
  if (fileName) return `${artifact.artifactType} • ${fileName}`;
  return `${artifact.artifactType} artifact`;
}

function formatDuration(ms?: number): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function runCreatedAtMs(run: SagaRun): number {
  return new Date(run.createdAt || 0).getTime();
}

function runStatusRank(status: SagaRun["status"]): number {
  if (status === "failed") return 0;
  if (status === "running") return 1;
  if (status === "pending") return 2;
  if (status === "cancelled") return 3;
  return 4;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

const FALLBACK_JSON_THEME: JsonThemePalette = {
  base00: "#0b0f16",
  base01: "#111827",
  base02: "#1f2937",
  base03: "#6b7280",
  base04: "#9ca3af",
  base05: "#e5e7eb",
  base06: "#f3f4f6",
  base07: "#ffffff",
  base08: "#ef4444",
  base09: "#f59e0b",
  base0A: "#f59e0b",
  base0B: "#22c55e",
  base0C: "#14b8a6",
  base0D: "#3b82f6",
  base0E: "#8b5cf6",
  base0F: "#fb7185",
};

function buildJsonThemeFromCssVars(): JsonThemePalette {
  if (typeof window === "undefined") return FALLBACK_JSON_THEME;
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  // Map shadcn tokens to base16 slots consumed by react-json-view.
  return {
    base00: read("--background", FALLBACK_JSON_THEME.base00),
    base01: read("--card", read("--muted", FALLBACK_JSON_THEME.base01)),
    base02: read("--muted", FALLBACK_JSON_THEME.base02),
    base03: read("--muted-foreground", FALLBACK_JSON_THEME.base03),
    base04: read("--muted-foreground", FALLBACK_JSON_THEME.base04),
    base05: read("--foreground", FALLBACK_JSON_THEME.base05),
    base06: read("--foreground", FALLBACK_JSON_THEME.base06),
    base07: read("--foreground", FALLBACK_JSON_THEME.base07),
    base08: read("--destructive", FALLBACK_JSON_THEME.base08),
    base09: read("--chart-4", FALLBACK_JSON_THEME.base09),
    base0A: read("--chart-5", FALLBACK_JSON_THEME.base0A),
    base0B: read("--chart-2", FALLBACK_JSON_THEME.base0B),
    base0C: read("--chart-3", FALLBACK_JSON_THEME.base0C),
    base0D: read("--primary", FALLBACK_JSON_THEME.base0D),
    base0E: read("--secondary", FALLBACK_JSON_THEME.base0E),
    base0F: read("--accent", FALLBACK_JSON_THEME.base0F),
  };
}

function ThemedJsonView({
  src,
  maxHeightClassName = "max-h-[420px]",
  theme,
}: {
  src: unknown;
  maxHeightClassName?: string;
  theme?: JsonThemePalette;
}) {
  const normalized =
    typeof src === "object" && src !== null ? src : { value: src ?? null };
  return (
    <div
      className={`rounded-md border bg-muted/50 p-4 overflow-auto ${maxHeightClassName}`}
    >
      <ReactJsonView
        src={normalized as Record<string, unknown>}
        theme={theme ?? FALLBACK_JSON_THEME}
        collapsed={false}
        enableClipboard
        displayDataTypes={false}
        displayObjectSize
        iconStyle="triangle"
        style={{
          backgroundColor: "transparent",
          fontSize: "12px",
          lineHeight: "1.25rem",
          padding: 0,
        }}
        indentWidth={2}
      />
    </div>
  );
}

function RunsListSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-md border p-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function SagasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <RunsListSkeleton />
          </div>
        </div>
      }
    >
      <SagasPageContent />
    </Suspense>
  );
}

function SagasPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    isAuthenticated,
    isLoading: authLoading,
    signOut,
    refreshSession,
    user,
  } = useAuth();
  const isPlatformAdmin = user?.role === "admin" || user?.role === "owner";

  const [runs, setRuns] = useState<SagaRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SagaRunDetail | null>(null);
  const [selectedStep, setSelectedStep] = useState<SagaStep | null>(null);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [artifactDialogOpen, setArtifactDialogOpen] = useState(false);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [artifactContent, setArtifactContent] = useState("");
  const [artifactTitle, setArtifactTitle] = useState("");
  const [artifactItem, setArtifactItem] = useState<SagaArtifact | null>(null);
  const [artifactSnapshot, setArtifactSnapshot] =
    useState<SnapshotDocument | null>(null);
  const [viewMode, setViewMode] = useState<"visual" | "data">("visual");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historySagaKey, setHistorySagaKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());
  const [archivingRunIds, setArchivingRunIds] = useState<Set<string>>(
    new Set(),
  );
  const [executingRunIds, setExecutingRunIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [bulkRerunning, setBulkRerunning] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "passing" | "failing" | "running"
  >("all");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "status">("recent");
  const [groupBy, setGroupBy] = useState<"saga" | "status" | "biz" | "runner">(
    "saga",
  );
  const [searchText, setSearchText] = useState("");
  const [includeArchivedRuns, setIncludeArchivedRuns] = useState(false);
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [libraryOverview, setLibraryOverview] =
    useState<SagaLibraryOverview | null>(null);
  const [useCases, setUseCases] = useState<SagaUseCase[]>([]);
  const [personas, setPersonas] = useState<SagaPersona[]>([]);
  const [sagaDefinitions, setSagaDefinitions] = useState<SagaDefinition[]>([]);
  const [libraryDataLoading, setLibraryDataLoading] = useState(false);
  const [coverageDetail, setCoverageDetail] = useState<SagaCoverageDetail | null>(null);
  const [schemaCoverageDetail, setSchemaCoverageDetail] =
    useState<SagaCoverageDetail | null>(null);
  const [librarySyncing, setLibrarySyncing] = useState(false);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [libraryDialogLoading, setLibraryDialogLoading] = useState(false);
  const [libraryDialogError, setLibraryDialogError] = useState<string | null>(null);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<{
    kind: LibraryItemKind;
    key: string;
    title: string;
  } | null>(null);
  const [libraryRelations, setLibraryRelations] = useState<SagaLibraryRelationPayload | null>(null);
  const [libraryEditorOpen, setLibraryEditorOpen] = useState(false);
  const [libraryEditorLoading, setLibraryEditorLoading] = useState(false);
  const [libraryEditorSaving, setLibraryEditorSaving] = useState(false);
  const [libraryEditorError, setLibraryEditorError] = useState<string | null>(null);
  const [libraryEditorKind, setLibraryEditorKind] = useState<LibraryItemKind>("use_case");
  const [libraryEditorKey, setLibraryEditorKey] = useState("");
  const [libraryEditorIsCreate, setLibraryEditorIsCreate] = useState(false);
  const [libraryEditorDefinition, setLibraryEditorDefinition] = useState<Record<string, unknown> | null>(null);
  const [libraryEditorVersions, setLibraryEditorVersions] = useState<Array<Record<string, unknown>>>([]);
  const [libraryVersionDraft, setLibraryVersionDraft] = useState("");
  const [definitionLinksDetail, setDefinitionLinksDetail] = useState<{
    definition: { id: string; sagaKey: string; title: string };
    links: Array<{ id: string; relationRole: string; weight: number | null }>;
    useCaseVersions: Array<{
      id: string;
      title: string;
      versionNumber: number;
      summary?: string | null;
      bodyMarkdown?: string | null;
    }>;
    personaVersions: Array<{ id: string; name: string; versionNumber: number }>;
  } | null>(null);
  const [messageComposeToActorKey, setMessageComposeToActorKey] = useState("");
  const [messageComposeChannel, setMessageComposeChannel] = useState<"email" | "sms" | "push" | "in_app">("email");
  const [messageComposeSubject, setMessageComposeSubject] = useState("");
  const [messageComposeBody, setMessageComposeBody] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [jsonTheme, setJsonTheme] =
    useState<JsonThemePalette>(FALLBACK_JSON_THEME);

  const wsRef = useRef<WebSocket | null>(null);
  const selectedRunIdRef = useRef<string | null>(null);
  const liveRefreshTimerRef = useRef<number | null>(null);
  const pendingDetailRunIdRef = useRef<string | null>(null);
  const pendingListRefreshRef = useRef(false);
  const lastListRefreshAtRef = useRef(0);
  const lastDetailRefreshAtRef = useRef(0);
  const artifactCacheRef = useRef<Map<string, ArtifactContentPayload>>(
    new Map(),
  );
  const artifactFetchRef = useRef<
    Map<string, Promise<ArtifactContentPayload | null>>
  >(new Map());
  const urlHydratedRef = useRef(false);
  const urlSyncIgnoreNextRef = useRef(false);
  const pendingUrlRunIdRef = useRef<string | null>(null);
  const initialStepIdRef = useRef<string | null>(null);
  const initialArtifactIdRef = useRef<string | null>(null);
  const adminDefaultAllRunsAppliedRef = useRef(false);
  const autoAllRunsFallbackAttemptedRef = useRef(false);

  async function redirectToLogin() {
    router.replace("/login?next=/sagas");
  }

  function writeUrlState(nextState: {
    runId?: string | null;
    sagaKey?: string | null;
    stepId?: string | null;
    artifactId?: string | null;
    historySagaKey?: string | null;
    q?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const apply = (key: string, value: string | null | undefined) => {
      if (value && value.trim().length > 0) params.set(key, value);
      else params.delete(key);
    };
    apply("runId", nextState.runId);
    apply("sagaKey", nextState.sagaKey);
    apply("stepId", nextState.stepId);
    apply("artifactId", nextState.artifactId);
    apply("historySagaKey", nextState.historySagaKey);
    apply("q", nextState.q);

    const current = searchParams.toString();
    const next = params.toString();
    if (next === current) return;
    urlSyncIgnoreNextRef.current = true;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  function getArtifactsForStep(stepId: string): SagaArtifact[] {
    if (!detail) return [];
    return detail.artifacts.filter(
      (artifact) => artifact.sagaRunStepId === stepId,
    );
  }

  function artifactCacheKey(runId: string, artifactId: string) {
    return `${runId}:${artifactId}`;
  }

  function parseSnapshot(
    artifact: SagaArtifact,
    payload: ArtifactContentPayload,
  ): SnapshotDocument | null {
    if (
      artifact.artifactType !== "snapshot" &&
      artifact.artifactType !== "pseudoshot"
    ) {
      return null;
    }
    if (!artifact.contentType.includes("json")) return null;
    try {
      const parsed = JSON.parse(payload.content || "") as SnapshotDocument;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  async function fetchArtifactContent(
    runId: string,
    artifact: SagaArtifact,
  ): Promise<ArtifactContentPayload | null> {
    const key = artifactCacheKey(runId, artifact.id);
    const cached = artifactCacheRef.current.get(key);
    if (cached) return cached;

    const inflight = artifactFetchRef.current.get(key);
    if (inflight) return inflight;

    const request = (async () => {
      const res = await fetch(
        apiUrl(`/api/v1/sagas/runs/${runId}/artifacts/${artifact.id}/content`),
        { credentials: "include" },
      );
      if (res.status === 401) {
        await redirectToLogin();
        return null;
      }

      const payload =
        (await res.json()) as ApiEnvelope<ArtifactContentPayload | null>;
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error("Unable to load artifact.");
      }
      artifactCacheRef.current.set(key, payload.data);
      return payload.data;
    })();

    artifactFetchRef.current.set(key, request);
    try {
      return await request;
    } finally {
      artifactFetchRef.current.delete(key);
    }
  }

  function isRunSelected(runId: string) {
    return selectedRunIds.has(runId);
  }

  function toggleRunSelected(runId: string, checked: boolean) {
    setSelectedRunIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(runId);
      else next.delete(runId);
      return next;
    });
  }

  /**
   * Sidebar selection is the canonical "checked" state in detail mode.
   * Clicking a run both opens it and makes it the active selected run for bulk actions.
   */
  function selectRunForDetail(runId: string) {
    setSelectedRunId(runId);
    setSelectedRunIds(new Set([runId]));
  }

  async function archiveRuns(runIds: string[]) {
    const uniqueRunIds = Array.from(new Set(runIds.filter(Boolean)));
    if (uniqueRunIds.length === 0) return;

    setError(null);
    setBulkArchiving(uniqueRunIds.length > 1);
    setArchivingRunIds((prev) => {
      const next = new Set(prev);
      uniqueRunIds.forEach((id) => next.add(id));
      return next;
    });

    try {
      const res = await fetch(apiUrl("/api/v1/sagas/runs/archive"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runIds: uniqueRunIds }),
      });

      if (res.status === 401) {
        await redirectToLogin();
        return;
      }

      const payload = (await res.json()) as ApiEnvelope<{
        archivedRunIds: string[];
      }>;
      if (!res.ok || !payload.success)
        throw new Error("Failed to archive saga runs.");

      const archivedIds = new Set(payload.data?.archivedRunIds ?? []);

      setSelectedRunIds((prev) => {
        const next = new Set(prev);
        archivedIds.forEach((id) => next.delete(id));
        return next;
      });

      if (selectedRunId && archivedIds.has(selectedRunId)) {
        setSelectedRunId(null);
        setDetail(null);
      }

      await loadRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkArchiving(false);
      setArchivingRunIds((prev) => {
        const next = new Set(prev);
        uniqueRunIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  async function archiveSelectedRuns() {
    const selected = Array.from(selectedRunIds);
    if (selected.length === 0) return;
    const confirmed = window.confirm(
      `Archive ${selected.length} selected run${selected.length === 1 ? "" : "s"}?`,
    );
    if (!confirmed) return;
    await archiveRuns(selected);
  }

  async function rerunRuns(inputRuns: SagaRun[]) {
    const uniqueRuns = Array.from(
      new Map(inputRuns.map((run) => [run.id, run])).values(),
    );
    if (uniqueRuns.length === 0) return;

    setError(null);
    setArchivingRunIds((prev) => {
      const next = new Set(prev);
      uniqueRuns.forEach((run) => next.add(run.id));
      return next;
    });
    setBulkRerunning(uniqueRuns.length > 1);

    try {
      const createdRunIds: string[] = [];
      for (const run of uniqueRuns) {
        const res = await fetch(apiUrl("/api/v1/sagas/runs"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sagaKey: run.sagaKey,
            mode: run.mode,
            bizId: run.bizId ?? undefined,
            runnerLabel: run.runnerLabel
              ? `${run.runnerLabel} (rerun)`
              : `rerun:${run.id}`,
            runContext: {
              rerunOfRunId: run.id,
              triggeredFrom: "admin.sagas.page",
            },
          }),
        });

        if (res.status === 401) {
          await redirectToLogin();
          return;
        }

        const payload = (await res.json()) as ApiEnvelope<SagaRunDetail>;
        if (!res.ok || !payload.success || !payload.data?.run?.id) {
          throw new Error(`Failed to rerun ${run.sagaKey}.`);
        }
        const createdRunId = payload.data.run.id;

        const executeRes = await fetch(
          apiUrl(`/api/v1/sagas/runs/${createdRunId}/execute`),
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          },
        );

        if (executeRes.status === 401) {
          await redirectToLogin();
          return;
        }

        const executePayload = (await executeRes.json()) as ApiEnvelope<{
          success: boolean;
          failures?: string[];
        }>;

        if (!executeRes.ok || !executePayload.success) {
          const serverMessage = (executePayload as { error?: { message?: string } })
            .error?.message;
          throw new Error(
            serverMessage
              ? `Failed to execute rerun ${run.sagaKey}: ${serverMessage}`
              : `Failed to execute rerun ${run.sagaKey}.`,
          );
        }

        createdRunIds.push(createdRunId);
      }

      await loadRuns();
      setSelectedRunIds(new Set());
      const latestCreatedRunId = createdRunIds.at(-1);
      if (latestCreatedRunId) setSelectedRunId(latestCreatedRunId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setArchivingRunIds((prev) => {
        const next = new Set(prev);
        uniqueRuns.forEach((run) => next.delete(run.id));
        return next;
      });
      setBulkRerunning(false);
    }
  }

  async function rerunFromRun(run: SagaRun) {
    await rerunRuns([run]);
  }

  async function executeRunNow(runId: string) {
    setError(null);
    setExecutingRunIds((prev) => {
      const next = new Set(prev);
      next.add(runId);
      return next;
    });
    try {
      const res = await fetch(apiUrl(`/api/v1/sagas/runs/${runId}/execute`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401) {
        await redirectToLogin();
        return;
      }

      const payload = (await res.json()) as ApiEnvelope<{
        runId: string;
        success: boolean;
      }>;
      if (!res.ok || !payload.success) {
        const message = (payload as { error?: { message?: string } }).error?.message;
        throw new Error(message || `Failed to execute run ${runId}.`);
      }

      await loadRuns({ quiet: true });
      if (selectedRunId === runId) {
        await loadRunDetail(runId, { quiet: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecutingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
    }
  }

  async function rerunSelectedRuns() {
    const selected = runs.filter((run) => selectedRunIds.has(run.id));
    if (selected.length === 0) return;
    const confirmed = window.confirm(
      `Rerun ${selected.length} selected run${selected.length === 1 ? "" : "s"}?`,
    );
    if (!confirmed) return;
    await rerunRuns(selected);
  }

  function openHistoryDialog(sagaKey: string) {
    setHistorySagaKey(sagaKey);
    setHistoryDialogOpen(true);
  }

  async function loadRuns(options?: { quiet?: boolean }) {
    const quiet = options?.quiet === true;
    if (!quiet) setLoading(true);
    setError(null);

    const buildRunsQuery = (mineOnlyForAdmin: boolean) => {
      const query = new URLSearchParams();
      query.set("limit", "200");
      if (isPlatformAdmin) query.set("mineOnly", mineOnlyForAdmin ? "true" : "false");
      if (includeArchivedRuns) query.set("includeArchived", "true");
      return `/api/v1/sagas/runs?${query.toString()}`;
    };

    let mineOnlyForAdmin = isPlatformAdmin ? !showAllRuns : true;
    let runsQuery = buildRunsQuery(mineOnlyForAdmin);

    try {
      let res = await fetch(apiUrl(runsQuery), { credentials: "include" });

      if (res.status === 401) {
        const refreshed = await refreshSession().catch(() => null);
        if (!refreshed) {
          setRuns([]);
          setSelectedRunId(null);
          setDetail(null);
          await redirectToLogin();
          return;
        }
        res = await fetch(apiUrl(runsQuery), { credentials: "include" });
      }

      if (res.status === 403 && isPlatformAdmin && !mineOnlyForAdmin) {
        // If role changed and "all runs" is no longer allowed, gracefully fall
        // back to mine-only instead of leaving dashboard empty.
        mineOnlyForAdmin = true;
        setShowAllRuns(false);
        runsQuery = buildRunsQuery(mineOnlyForAdmin);
        res = await fetch(apiUrl(runsQuery), { credentials: "include" });
      }

      const payload = (await res.json()) as ApiEnvelope<SagaRun[]>;
      if (!res.ok || !payload.success)
        throw new Error("Failed to load saga runs.");

      let visibleRuns = payload.data;

      if (
        isPlatformAdmin &&
        mineOnlyForAdmin &&
        visibleRuns.length === 0 &&
        !includeArchivedRuns &&
        !autoAllRunsFallbackAttemptedRef.current
      ) {
        autoAllRunsFallbackAttemptedRef.current = true;
        const allRunsRes = await fetch(apiUrl(buildRunsQuery(false)), { credentials: "include" });
        const allRunsPayload = (await allRunsRes.json()) as ApiEnvelope<SagaRun[]>;
        if (allRunsRes.ok && allRunsPayload.success) {
          visibleRuns = allRunsPayload.data;
          if (visibleRuns.length > 0) setShowAllRuns(true);
        }
      }

      const sortedRuns = [...visibleRuns].sort(
        (a, b) => runCreatedAtMs(b) - runCreatedAtMs(a),
      );
      setRuns(sortedRuns);

      const visibleIds = new Set(visibleRuns.map((run) => run.id));
      setSelectedRunIds(
        (prev) => new Set(Array.from(prev).filter((id) => visibleIds.has(id))),
      );

      const runIdPinnedInUrl = searchParams.get("runId");
      if (!selectedRunId && runIdPinnedInUrl) {
        setSelectedRunId(runIdPinnedInUrl);
      }
      if (
        selectedRunId &&
        !visibleIds.has(selectedRunId) &&
        !runIdPinnedInUrl
      ) {
        setSelectedRunId(null);
        setDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadLibraryLoopData() {
    setLibraryDataLoading(true);
    try {
      const [
        overviewRes,
        ucRes,
        personaRes,
        specsRes,
        schemaCoverageListRes,
      ] =
        await Promise.all([
        fetch(apiUrl("/api/v1/sagas/library/overview"), {
          credentials: "include",
        }),
        fetch(apiUrl("/api/v1/sagas/use-cases?limit=5000"), {
          credentials: "include",
        }),
        fetch(apiUrl("/api/v1/sagas/personas?limit=5000"), {
          credentials: "include",
        }),
        fetch(apiUrl("/api/v1/sagas/specs?limit=5000"), {
          credentials: "include",
        }),
        fetch(apiUrl("/api/v1/sagas/schema-coverage/reports?limit=1"), {
          credentials: "include",
        }),
      ]);

      if (overviewRes.status === 401) {
        await redirectToLogin();
        return;
      }

      const [
        overviewPayload,
        ucPayload,
        personaPayload,
        specsPayload,
        schemaCoverageListPayload,
      ] =
        (await Promise.all([
          overviewRes.json(),
          ucRes.json(),
          personaRes.json(),
          specsRes.json(),
          schemaCoverageListRes.json(),
        ])) as [
          ApiEnvelope<SagaLibraryOverview>,
          ApiEnvelope<SagaUseCase[]>,
          ApiEnvelope<SagaPersona[]>,
          ApiEnvelope<SagaDefinition[]>,
          ApiEnvelope<SagaCoverageReport[]>,
        ];

      if (overviewRes.ok && overviewPayload.success) {
        setLibraryOverview(overviewPayload.data);
      }
      if (ucRes.ok && ucPayload.success) {
        setUseCases(ucPayload.data);
      }
      if (personaRes.ok && personaPayload.success) {
        setPersonas(personaPayload.data);
      }
      if (specsRes.ok && specsPayload.success) {
        setSagaDefinitions(specsPayload.data);
      }

      if (schemaCoverageListRes.ok && schemaCoverageListPayload.success) {
        const latestSchemaCoverage = schemaCoverageListPayload.data?.[0];
        if (latestSchemaCoverage?.id) {
          const schemaCoverageDetailRes = await fetch(
            apiUrl(`/api/v1/sagas/schema-coverage/reports/${latestSchemaCoverage.id}`),
            { credentials: "include" },
          );
          if (schemaCoverageDetailRes.ok) {
            const schemaCoverageDetailPayload =
              (await schemaCoverageDetailRes.json()) as ApiEnvelope<SagaCoverageDetail>;
            if (schemaCoverageDetailPayload.success) {
              setSchemaCoverageDetail(schemaCoverageDetailPayload.data);
            }
          }
        } else {
          setSchemaCoverageDetail(null);
        }
      }
    } catch {
      // Keep dashboard resilient if loop APIs are temporarily unavailable.
    } finally {
      setLibraryDataLoading(false);
    }
  }

  async function syncLibraryLoopFromDocs() {
    setLibrarySyncing(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/v1/sagas/library/sync-docs"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkSagaDefinitions: true }),
      });
      if (res.status === 401) {
        await redirectToLogin();
        return;
      }
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error("Failed to sync loop docs.");
      }
      await loadLibraryLoopData();
      await loadRuns({ quiet: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLibrarySyncing(false);
    }
  }

  async function openLibraryItemRelations(input: {
    kind: LibraryItemKind;
    key: string;
    title: string;
  }) {
    setSelectedLibraryItem(input);
    setLibraryDialogOpen(true);
    setLibraryDialogLoading(true);
    setLibraryDialogError(null);
    setLibraryRelations(null);

    try {
      const url = `/api/v1/sagas/library/related?kind=${encodeURIComponent(input.kind)}&key=${encodeURIComponent(input.key)}`;
      const res = await fetch(apiUrl(url), { credentials: "include" });
      if (res.status === 401) {
        await redirectToLogin();
        return;
      }
      const payload = (await res.json()) as ApiEnvelope<SagaLibraryRelationPayload>;
      if (!res.ok || !payload.success) {
        throw new Error("Failed to load library relations.");
      }
      setLibraryRelations(payload.data);
    } catch (err) {
      setLibraryDialogError(err instanceof Error ? err.message : String(err));
    } finally {
      setLibraryDialogLoading(false);
    }
  }

  async function loadDefinitionLinksForSagaKey(sagaKey: string) {
    try {
      const res = await fetch(
        apiUrl(`/api/v1/sagas/definitions/${encodeURIComponent(sagaKey)}/links`),
        { credentials: "include" },
      );
      if (res.status === 401) {
        await redirectToLogin();
        return;
      }
      const payload = (await res.json()) as ApiEnvelope<{
        definition: { id: string; sagaKey: string; title: string };
        links: Array<{ id: string; relationRole: string; weight: number | null }>;
        useCaseVersions: Array<{
          id: string;
          title: string;
          versionNumber: number;
          summary?: string | null;
          bodyMarkdown?: string | null;
        }>;
        personaVersions: Array<{ id: string; name: string; versionNumber: number }>;
      }>;
      if (!res.ok || !payload.success) {
        setDefinitionLinksDetail(null);
        return;
      }
      setDefinitionLinksDetail(payload.data);
    } catch {
      setDefinitionLinksDetail(null);
    }
  }

  function libraryRouteBase(kind: LibraryItemKind) {
    if (kind === "use_case") return "/api/v1/sagas/use-cases";
    return "/api/v1/sagas/personas";
  }

  async function openLibraryEditor(input: {
    kind: LibraryItemKind;
    key: string;
  }) {
    setLibraryEditorIsCreate(false);
    setLibraryEditorKind(input.kind);
    setLibraryEditorKey(input.key);
    setLibraryEditorOpen(true);
    setLibraryEditorLoading(true);
    setLibraryEditorError(null);
    setLibraryEditorDefinition(null);
    setLibraryEditorVersions([]);
    setLibraryVersionDraft("");

    try {
      const res = await fetch(
        apiUrl(`${libraryRouteBase(input.kind)}/${encodeURIComponent(input.key)}`),
        { credentials: "include" },
      );
      if (res.status === 401) {
        await redirectToLogin();
        return;
      }
      const payload = (await res.json()) as ApiEnvelope<{
        definition: Record<string, unknown>;
        versions: Array<Record<string, unknown>>;
      }>;
      if (!res.ok || !payload.success) throw new Error("Failed to load library item.");
      setLibraryEditorDefinition(payload.data.definition);
      setLibraryEditorVersions(payload.data.versions ?? []);
      const firstBody = String(payload.data.versions?.[0]?.bodyMarkdown ?? "");
      setLibraryVersionDraft(firstBody);
    } catch (err) {
      setLibraryEditorError(err instanceof Error ? err.message : String(err));
    } finally {
      setLibraryEditorLoading(false);
    }
  }

  function openLibraryCreator(kind: LibraryItemKind) {
    setLibraryEditorIsCreate(true);
    setLibraryEditorKind(kind);
    setLibraryEditorKey("");
    setLibraryEditorOpen(true);
    setLibraryEditorLoading(false);
    setLibraryEditorError(null);
    setLibraryEditorVersions([]);
    setLibraryVersionDraft("");
    if (kind === "use_case") {
      setLibraryEditorDefinition({
        ucKey: "",
        title: "",
        status: "draft",
        summary: "",
      });
      return;
    }
    setLibraryEditorDefinition({
      personaKey: "",
      name: "",
      status: "draft",
      profileSummary: "",
    });
  }

  async function saveLibraryDefinitionEdits() {
    if (!libraryEditorDefinition) return;
    setLibraryEditorSaving(true);
    setLibraryEditorError(null);
    try {
      let res: Response;
      if (libraryEditorIsCreate) {
        const createPayload: Record<string, unknown> = {};
        if (libraryEditorKind === "use_case") {
          createPayload.ucKey = String(libraryEditorDefinition.ucKey ?? "").trim();
          createPayload.title = String(libraryEditorDefinition.title ?? "").trim();
          createPayload.status = libraryEditorDefinition.status;
          createPayload.summary = libraryEditorDefinition.summary ?? null;
          if (!String(createPayload.ucKey).trim() || !String(createPayload.title).trim()) {
            throw new Error("Use case key and title are required.");
          }
        } else {
          createPayload.personaKey = String(libraryEditorDefinition.personaKey ?? "").trim();
          createPayload.name = String(libraryEditorDefinition.name ?? "").trim();
          createPayload.status = libraryEditorDefinition.status;
          createPayload.profileSummary = libraryEditorDefinition.profileSummary ?? null;
          if (!String(createPayload.personaKey).trim() || !String(createPayload.name).trim()) {
            throw new Error("Persona key and name are required.");
          }
        }
        res = await fetch(apiUrl(`${libraryRouteBase(libraryEditorKind)}`), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
      } else {
        if (!libraryEditorKey) return;
        const payload: Record<string, unknown> = {};
        if (libraryEditorKind === "use_case") {
          payload.title = libraryEditorDefinition.title;
          payload.status = libraryEditorDefinition.status;
          payload.summary = libraryEditorDefinition.summary ?? null;
        } else {
          payload.name = libraryEditorDefinition.name;
          payload.status = libraryEditorDefinition.status;
          payload.profileSummary = libraryEditorDefinition.profileSummary ?? null;
        }
        res = await fetch(
          apiUrl(`${libraryRouteBase(libraryEditorKind)}/${encodeURIComponent(libraryEditorKey)}`),
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
      }
      if (res.status === 401) {
        await redirectToLogin();
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const message =
          typeof json?.error?.message === "string"
            ? json.error.message
            : "Failed to save definition edits.";
        throw new Error(message);
      }
      const key =
        libraryEditorKind === "use_case"
          ? String((json.data?.ucKey ?? libraryEditorKey) || "")
          : String((json.data?.personaKey ?? libraryEditorKey) || "");
      if (!key) throw new Error("Missing key in API response.");
      await openLibraryEditor({ kind: libraryEditorKind, key });
      await loadLibraryLoopData();
    } catch (err) {
      setLibraryEditorError(err instanceof Error ? err.message : String(err));
    } finally {
      setLibraryEditorSaving(false);
    }
  }

  async function createLibraryVersion() {
    if (libraryEditorIsCreate) return;
    if (!libraryEditorKey || !libraryVersionDraft.trim()) return;
    setLibraryEditorSaving(true);
    setLibraryEditorError(null);
    try {
      let body: Record<string, unknown> | null = null;
      if (libraryEditorKind === "use_case") {
        body = {
          title: String(libraryEditorDefinition?.title ?? ""),
          summary: (libraryEditorDefinition?.summary as string | null | undefined) ?? null,
          bodyMarkdown: libraryVersionDraft,
          isCurrent: true,
        };
      } else if (libraryEditorKind === "persona") {
        body = {
          name: String(libraryEditorDefinition?.name ?? ""),
          profile: (libraryEditorDefinition?.profileSummary as string | null | undefined) ?? null,
          bodyMarkdown: libraryVersionDraft,
          isCurrent: true,
        };
      }
      if (!body) throw new Error("Unsupported library item type for version creation.");

      const res = await fetch(
        apiUrl(`${libraryRouteBase(libraryEditorKind)}/${encodeURIComponent(libraryEditorKey)}/versions`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.status === 401) {
        await redirectToLogin();
        return;
      }
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error("Failed to create new version.");
      await openLibraryEditor({ kind: libraryEditorKind, key: libraryEditorKey });
      await loadLibraryLoopData();
    } catch (err) {
      setLibraryEditorError(err instanceof Error ? err.message : String(err));
    } finally {
      setLibraryEditorSaving(false);
    }
  }

  async function deleteLibraryDefinition() {
    if (libraryEditorIsCreate || !libraryEditorKey) return;
    const okDelete = window.confirm(
      `Delete ${libraryEditorKind.replace("_", " ")} ${libraryEditorKey}? This cannot be undone.`,
    );
    if (!okDelete) return;
    setLibraryEditorSaving(true);
    setLibraryEditorError(null);
    try {
      const res = await fetch(
        apiUrl(`${libraryRouteBase(libraryEditorKind)}/${encodeURIComponent(libraryEditorKey)}`),
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (res.status === 401) {
        await redirectToLogin();
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        const message =
          typeof json?.error?.message === "string"
            ? json.error.message
            : "Failed to delete library item.";
        throw new Error(message);
      }
      setLibraryEditorOpen(false);
      setLibraryEditorDefinition(null);
      setLibraryEditorVersions([]);
      setLibraryVersionDraft("");
      setLibraryEditorKey("");
      await loadLibraryLoopData();
    } catch (err) {
      setLibraryEditorError(err instanceof Error ? err.message : String(err));
    } finally {
      setLibraryEditorSaving(false);
    }
  }

  async function sendVirtualMessage() {
    if (!detail?.run?.id || !messageComposeToActorKey || !messageComposeBody.trim()) return;
    setMessageSending(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/v1/sagas/runs/${detail.run.id}/messages`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toActorKey: messageComposeToActorKey,
            channel: messageComposeChannel,
            subject: messageComposeSubject || null,
            bodyText: messageComposeBody,
            status: "delivered",
          }),
        },
      );
      if (res.status === 401) {
        await redirectToLogin();
        return;
      }
      const payload = await res.json();
      if (!res.ok || !payload?.success) throw new Error("Failed to send virtual message.");
      setMessageComposeBody("");
      setMessageComposeSubject("");
      await loadRunDetail(detail.run.id, { quiet: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMessageSending(false);
    }
  }

  async function loadRunDetail(runId: string, options?: { quiet?: boolean }) {
    const quiet = options?.quiet === true;
    if (!quiet) {
      setLoadingDetail(true);
      setSelectedStep(null);
      setStepDialogOpen(false);
      setArtifactDialogOpen(false);
    }

    try {
      const res = await fetch(apiUrl(`/api/v1/sagas/runs/${runId}`), {
        credentials: "include",
      });
      if (res.status === 401) {
        await redirectToLogin();
        return;
      }

      const payload = (await res.json()) as ApiEnvelope<SagaRunDetail>;
      if (!res.ok || !payload.success)
        throw new Error("Failed to load run detail.");

      setDetail(payload.data);
      void loadDefinitionLinksForSagaKey(payload.data.run.sagaKey);
      setCoverageDetail(null);
      setExpandedPhases(new Set());

      const coverageListRes = await fetch(
        apiUrl(`/api/v1/sagas/run-assessments/reports?sagaRunId=${runId}&limit=1`),
        { credentials: "include" },
      );
      if (coverageListRes.ok) {
        const coverageListPayload =
          (await coverageListRes.json()) as ApiEnvelope<SagaCoverageReport[]>;
        const firstReport = coverageListPayload?.data?.[0];
        if (coverageListPayload.success && firstReport?.id) {
          const coverageDetailRes = await fetch(
            apiUrl(`/api/v1/sagas/run-assessments/reports/${firstReport.id}`),
            { credentials: "include" },
          );
          if (coverageDetailRes.ok) {
            const coverageDetailPayload =
              (await coverageDetailRes.json()) as ApiEnvelope<SagaCoverageDetail>;
            if (coverageDetailPayload.success) {
              setCoverageDetail(coverageDetailPayload.data);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDetail(null);
      setDefinitionLinksDetail(null);
      setCoverageDetail(null);
    } finally {
      if (!quiet) setLoadingDetail(false);
    }
  }

  function togglePhase(phase: string) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  }

  async function openStepDialog(step: SagaStep) {
    setSelectedStep(step);
    setStepDialogOpen(true);
    setViewMode("visual");

    const stepArtifacts = getArtifactsForStep(step.id);
    const snapshotArtifact = stepArtifacts.find(
      (artifact) =>
        artifact.artifactType === "snapshot" ||
        artifact.artifactType === "pseudoshot",
    );

    if (!snapshotArtifact || !detail) {
      setArtifactSnapshot(null);
      setArtifactError(null);
      setArtifactLoading(false);
      return;
    }

    setArtifactLoading(true);
    setArtifactError(null);
    setArtifactSnapshot(null);

    try {
      const payload = await fetchArtifactContent(
        detail.run.id,
        snapshotArtifact,
      );
      if (!payload) return;
      setArtifactSnapshot(parseSnapshot(snapshotArtifact, payload));
    } catch (err) {
      setArtifactError(err instanceof Error ? err.message : String(err));
    } finally {
      setArtifactLoading(false);
    }
  }

  async function openArtifactDialog(runId: string, artifact: SagaArtifact) {
    setArtifactDialogOpen(true);
    setArtifactLoading(true);
    setArtifactError(null);
    setArtifactContent("");
    setArtifactTitle(safeArtifactTitle(artifact));
    setArtifactItem(artifact);
    setArtifactSnapshot(null);

    try {
      const payload = await fetchArtifactContent(runId, artifact);
      if (!payload) return;
      setArtifactContent(payload.content || "");
      setArtifactSnapshot(parseSnapshot(artifact, payload));
    } catch (err) {
      setArtifactError(err instanceof Error ? err.message : String(err));
    } finally {
      setArtifactLoading(false);
    }
  }

  async function onSignOut() {
    try {
      await signOut();
    } finally {
      await redirectToLogin();
    }
  }

  function scheduleLiveRefresh(input?: {
    runId?: string;
    refreshList?: boolean;
  }) {
    if (input?.runId) pendingDetailRunIdRef.current = input.runId;
    if (input?.refreshList) pendingListRefreshRef.current = true;
    if (liveRefreshTimerRef.current !== null) return;

    liveRefreshTimerRef.current = window.setTimeout(async () => {
      liveRefreshTimerRef.current = null;
      const now = Date.now();

      const shouldRefreshList =
        pendingListRefreshRef.current &&
        now - lastListRefreshAtRef.current >= 2000;
      pendingListRefreshRef.current = false;
      if (shouldRefreshList) {
        lastListRefreshAtRef.current = now;
        await loadRuns({ quiet: true });
      }

      const focusedRunId = selectedRunIdRef.current;
      const pendingRunId = pendingDetailRunIdRef.current;
      pendingDetailRunIdRef.current = null;

      const shouldRefreshDetail =
        now - lastDetailRefreshAtRef.current >= 800 &&
        focusedRunId &&
        (!pendingRunId || pendingRunId === focusedRunId);

      if (shouldRefreshDetail && focusedRunId) {
        lastDetailRefreshAtRef.current = now;
        await loadRunDetail(focusedRunId, { quiet: true });
      }
    }, 350);
  }

  useEffect(() => {
    if (urlSyncIgnoreNextRef.current) {
      urlSyncIgnoreNextRef.current = false;
      return;
    }

    const runIdFromUrl = searchParams.get("runId") || null;
    const stepIdFromUrl = searchParams.get("stepId");
    const artifactIdFromUrl = searchParams.get("artifactId");
    const historySagaKeyFromUrl = searchParams.get("historySagaKey");
    const searchFromUrl = searchParams.get("q") || "";

    if (searchFromUrl !== searchText) setSearchText(searchFromUrl);
    if (runIdFromUrl && runIdFromUrl !== selectedRunId) {
      pendingUrlRunIdRef.current = runIdFromUrl;
      setSelectedRunId(runIdFromUrl);
    } else if (!runIdFromUrl && runIdFromUrl !== selectedRunId) {
      setSelectedRunId(null);
    }

    if (historySagaKeyFromUrl && historySagaKeyFromUrl !== historySagaKey) {
      setHistorySagaKey(historySagaKeyFromUrl);
      setHistoryDialogOpen(true);
    }

    if (urlHydratedRef.current) return;
    if (runIdFromUrl) pendingUrlRunIdRef.current = runIdFromUrl;
    if (stepIdFromUrl) initialStepIdRef.current = stepIdFromUrl;
    if (artifactIdFromUrl) initialArtifactIdRef.current = artifactIdFromUrl;
    urlHydratedRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!urlHydratedRef.current) return;
    if (pendingUrlRunIdRef.current && selectedRunId === null) return;
    if (pendingUrlRunIdRef.current && selectedRunId === pendingUrlRunIdRef.current) {
      pendingUrlRunIdRef.current = null;
    }
    const sagaKey =
      detail?.run?.sagaKey ??
      runs.find((run) => run.id === selectedRunId)?.sagaKey ??
      null;
    writeUrlState({
      runId: selectedRunId,
      sagaKey,
      stepId: stepDialogOpen ? selectedStep?.id ?? null : null,
      artifactId: artifactDialogOpen ? artifactItem?.id ?? null : null,
      historySagaKey: historyDialogOpen ? historySagaKey : null,
      q: searchText || null,
    });
  }, [
    selectedRunId,
    detail?.run?.sagaKey,
    stepDialogOpen,
    selectedStep?.id,
    artifactDialogOpen,
    artifactItem?.id,
    historyDialogOpen,
    historySagaKey,
    searchText,
    runs,
  ]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      void redirectToLogin();
      return;
    }
    void loadRuns();
    void loadLibraryLoopData();
  }, [
    authLoading,
    isAuthenticated,
    isPlatformAdmin,
    showAllRuns,
    includeArchivedRuns,
  ]);

  useEffect(() => {
    if (isPlatformAdmin) return;
    if (showAllRuns) setShowAllRuns(false);
  }, [isPlatformAdmin, showAllRuns]);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    if (adminDefaultAllRunsAppliedRef.current) return;
    adminDefaultAllRunsAppliedRef.current = true;
    setShowAllRuns(true);
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !selectedRunId) return;
    void loadRunDetail(selectedRunId);
  }, [selectedRunId, authLoading, isAuthenticated]);

  useEffect(() => {
    if (!detail) return;
    if (initialStepIdRef.current) {
      const step = detail.steps.find((item) => item.id === initialStepIdRef.current);
      initialStepIdRef.current = null;
      if (step) {
        void openStepDialog(step);
        return;
      }
    }
    if (initialArtifactIdRef.current) {
      const artifact = detail.artifacts.find(
        (item) => item.id === initialArtifactIdRef.current,
      );
      initialArtifactIdRef.current = null;
      if (artifact) {
        void openArtifactDialog(detail.run.id, artifact);
      }
    }
  }, [detail]);

  useEffect(() => {
    if (!detail?.actorProfiles || detail.actorProfiles.length === 0) return;
    if (messageComposeToActorKey) return;
    setMessageComposeToActorKey(detail.actorProfiles[0].actorKey);
  }, [detail?.actorProfiles, messageComposeToActorKey]);

  useEffect(() => {
    selectedRunIdRef.current = selectedRunId;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && selectedRunId) {
      ws.send(JSON.stringify({ type: "subscribe_run", runId: selectedRunId }));
    }
  }, [selectedRunId]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    const base = apiUrl("/api/v1/ws/sagas");
    const wsUrl = base.replace(/^http/i, "ws");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(JSON.stringify({ type: "subscribe_list" }));
      if (selectedRunIdRef.current) {
        ws.send(
          JSON.stringify({
            type: "subscribe_run",
            runId: selectedRunIdRef.current,
          }),
        );
      }
    };

    ws.onmessage = (event) => {
      let payload: any;
      try {
        payload = JSON.parse(String(event.data || "{}"));
      } catch {
        return;
      }
      if (payload?.type !== "saga_event") return;

      const eventObj = payload.event;
      const eventType =
        typeof eventObj?.eventType === "string" ? eventObj.eventType : "";
      const eventRunId =
        typeof eventObj?.runId === "string" ? eventObj.runId : undefined;

      if (
        eventType === "run.created" ||
        eventType === "run.updated" ||
        eventType === "run.completed" ||
        eventType === "run.archived"
      ) {
        scheduleLiveRefresh({ runId: eventRunId, refreshList: true });
        return;
      }

      if (eventType === "step.updated" || eventType === "artifact.created") {
        scheduleLiveRefresh({ runId: eventRunId, refreshList: false });
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (wsRef.current === ws) wsRef.current = null;
    };

    ws.onerror = () => {
      setWsConnected(false);
      if (wsRef.current === ws) wsRef.current = null;
    };

    return () => {
      if (liveRefreshTimerRef.current !== null) {
        window.clearTimeout(liveRefreshTimerRef.current);
        liveRefreshTimerRef.current = null;
      }
      if (wsRef.current === ws) wsRef.current = null;
      try {
        ws.close();
      } catch {}
      setWsConnected(false);
    };
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    const applyTheme = () => setJsonTheme(buildJsonThemeFromCssVars());
    applyTheme();

    const observer = new MutationObserver(() => applyTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme"],
      });
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => applyTheme();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onMediaChange);
    } else {
      media.addListener(onMediaChange);
    }

    return () => {
      observer.disconnect();
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", onMediaChange);
      } else {
        media.removeListener(onMediaChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!stepDialogOpen || !selectedStep || !detail) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const allSteps = detail.steps;
      const currentIndex = allSteps.findIndex(
        (step) => step.id === selectedStep.id,
      );

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const nextStep = allSteps[currentIndex + 1];
        if (nextStep) void openStepDialog(nextStep);
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const prevStep = allSteps[currentIndex - 1];
        if (prevStep) void openStepDialog(prevStep);
      }

      if (event.key === "Escape") {
        setStepDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stepDialogOpen, selectedStep, detail]);

  const runsBySaga = useMemo<SagaRunGroup[]>(() => {
    const groups = new Map<string, SagaRun[]>();
    runs.forEach((run) => {
      const list = groups.get(run.sagaKey) ?? [];
      list.push(run);
      groups.set(run.sagaKey, list);
    });

    return Array.from(groups.entries())
      .map(([sagaKey, groupRuns]) => {
        const sorted = [...groupRuns].sort(
          (a, b) => runCreatedAtMs(b) - runCreatedAtMs(a),
        );
        const latest = sorted[0];
        const total = sorted.length;
        const passed = sorted.filter((run) => run.status === "passed").length;
        const failed = sorted.filter((run) => run.status === "failed").length;
        const active = sorted.filter(
          (run) => run.status === "running" || run.status === "pending",
        ).length;
        return {
          sagaKey,
          latest,
          runs: sorted,
          summary: { total, passed, failed, active },
        };
      })
      .sort((a, b) => {
        const rankDelta =
          runStatusRank(a.latest.status) - runStatusRank(b.latest.status);
        if (rankDelta !== 0) return rankDelta;
        return runCreatedAtMs(b.latest) - runCreatedAtMs(a.latest);
      });
  }, [runs]);

  const runsBySelectedGroup = useMemo<SagaRunGroup[]>(() => {
    if (groupBy === "saga") return runsBySaga;

    const groups = new Map<string, SagaRun[]>();
    runs.forEach((run) => {
      const groupKey =
        groupBy === "status"
          ? `Status: ${run.status}`
          : groupBy === "biz"
            ? run.bizId
              ? `Biz: ${run.bizId}`
              : "Biz: Unscoped"
            : run.runnerLabel?.trim()
              ? `Runner: ${run.runnerLabel}`
              : "Runner: Unlabeled";
      const list = groups.get(groupKey) ?? [];
      list.push(run);
      groups.set(groupKey, list);
    });

    return Array.from(groups.entries())
      .map(([groupKey, groupRuns]) => {
        const sorted = [...groupRuns].sort(
          (a, b) => runCreatedAtMs(b) - runCreatedAtMs(a),
        );
        const latest = sorted[0];
        const total = sorted.length;
        const passed = sorted.filter((run) => run.status === "passed").length;
        const failed = sorted.filter((run) => run.status === "failed").length;
        const active = sorted.filter(
          (run) => run.status === "running" || run.status === "pending",
        ).length;
        return {
          sagaKey: groupKey,
          latest,
          runs: sorted,
          summary: { total, passed, failed, active },
        };
      })
      .sort((a, b) => {
        const rankDelta =
          runStatusRank(a.latest.status) - runStatusRank(b.latest.status);
        if (rankDelta !== 0) return rankDelta;
        return runCreatedAtMs(b.latest) - runCreatedAtMs(a.latest);
      });
  }, [groupBy, runs, runsBySaga]);

  const filteredRunGroups = useMemo(() => {
    let filtered = runsBySelectedGroup;
    const query = searchText.trim().toLowerCase();

    if (filterStatus === "passing") {
      filtered = filtered.filter((group) => group.latest.status === "passed");
    } else if (filterStatus === "failing") {
      filtered = filtered.filter(
        (group) =>
          group.latest.status === "failed" ||
          group.latest.status === "cancelled",
      );
    } else if (filterStatus === "running") {
      filtered = filtered.filter(
        (group) =>
          group.latest.status === "running" ||
          group.latest.status === "pending",
      );
    }

    if (query) {
      filtered = filtered.filter((group) => {
        const latest = group.latest;
        if (group.sagaKey.toLowerCase().includes(query)) return true;
        if (latest.id.toLowerCase().includes(query)) return true;
        if ((latest.runnerLabel || "").toLowerCase().includes(query)) return true;
        if ((latest.status || "").toLowerCase().includes(query)) return true;
        if ((latest.bizId || "").toLowerCase().includes(query)) return true;
        return group.runs.some((run) => run.id.toLowerCase().includes(query));
      });
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === "name") return a.sagaKey.localeCompare(b.sagaKey);
      if (sortBy === "status") {
        return runStatusRank(a.latest.status) - runStatusRank(b.latest.status);
      }
      return runCreatedAtMs(b.latest) - runCreatedAtMs(a.latest);
    });
  }, [runsBySelectedGroup, filterStatus, sortBy, searchText]);

  const visibleRunIds = useMemo(
    () => filteredRunGroups.map((group) => group.latest.id),
    [filteredRunGroups],
  );

  const selectedVisibleCount = useMemo(
    () => visibleRunIds.filter((id) => selectedRunIds.has(id)).length,
    [visibleRunIds, selectedRunIds],
  );

  const allVisibleSelected =
    visibleRunIds.length > 0 && selectedVisibleCount === visibleRunIds.length;

  function toggleSelectAllVisible() {
    setSelectedRunIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleRunIds.forEach((id) => next.delete(id));
      } else {
        visibleRunIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  const currentHealthSummary = useMemo(() => {
    const latestRuns = runsBySaga.map((group) => group.latest);
    const healthy = latestRuns.filter((run) => run.status === "passed").length;
    const bad = latestRuns.filter((run) => run.status === "failed").length;
    const active = latestRuns.filter(
      (run) => run.status === "running" || run.status === "pending",
    ).length;
    const historicalPassed = runs.filter(
      (run) => run.status === "passed",
    ).length;

    return {
      totalSagas: latestRuns.length,
      healthy,
      bad,
      active,
      currentCoveragePct: pct(healthy, latestRuns.length),
      historicalCoveragePct: pct(historicalPassed, runs.length),
      historicalPassed,
      historicalTotal: runs.length,
    };
  }, [runs, runsBySaga]);

  const latestRunBySagaKey = useMemo(() => {
    const map = new Map<string, SagaRun>();
    for (const group of runsBySaga) {
      map.set(group.sagaKey, group.latest);
    }
    return map;
  }, [runsBySaga]);

  const selectedSagaGroup = useMemo(() => {
    if (!detail?.run?.sagaKey) return null;
    return (
      runsBySaga.find((group) => group.sagaKey === detail.run.sagaKey) ?? null
    );
  }, [detail?.run?.sagaKey, runsBySaga]);

  const historyRunsForDialog = useMemo(() => {
    if (!historySagaKey) return [];
    const group = runsBySaga.find((item) => item.sagaKey === historySagaKey);
    const rows = group?.runs ?? [];
    const query = searchText.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((run) => {
      if (run.id.toLowerCase().includes(query)) return true;
      if ((run.runnerLabel || "").toLowerCase().includes(query)) return true;
      if ((run.status || "").toLowerCase().includes(query)) return true;
      return false;
    });
  }, [historySagaKey, runsBySaga, searchText]);

  const groupedSteps = useMemo(() => {
    if (!detail) return {} as Record<string, SagaStep[]>;
    const query = searchText.trim().toLowerCase();
    const groups: Record<string, SagaStep[]> = {};
    detail.steps.forEach((step) => {
      if (query) {
        const searchable = [
          step.phaseTitle,
          step.stepKey,
          step.title,
          step.actorKey,
          step.status,
          step.failureMessage,
          step.instruction,
          step.expectedResult,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(query)) return;
      }
      if (!groups[step.phaseTitle]) groups[step.phaseTitle] = [];
      groups[step.phaseTitle].push(step);
    });
    return groups;
  }, [detail, searchText]);

  const successRate = useMemo(() => {
    if (!detail?.run || detail.run.totalSteps === 0) return 0;
    return Math.round((detail.run.passedSteps / detail.run.totalSteps) * 100);
  }, [detail]);

  const triageSteps = useMemo(() => {
    if (!detail) return [];
    return detail.steps.filter((step) => {
      const normalized = step.status.toLowerCase();
      return normalized === "failed" || normalized === "blocked";
    });
  }, [detail]);

  const useCaseCoverageByKey = useMemo<Record<string, UseCaseCoverage>>(() => {
    const map: Record<string, UseCaseCoverage> = {};
    if (!schemaCoverageDetail) return map;
    for (const item of schemaCoverageDetail.items) {
      if (item.itemType !== "use_case") continue;
      const key = String(item.itemRefKey || "").trim().toUpperCase();
      if (!key) continue;
      const normalizedTags = Array.from(
        new Set((item.tags ?? []).map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)),
      );
      const verdictTag =
        normalizedTags.find((tag) => ["#full", "#strong", "#partial", "#gap"].includes(tag)) ||
        (item.verdict ? `#${String(item.verdict).toLowerCase()}` : null);
      const nativeToHackyTag =
        normalizedTags.find((tag) =>
          ["#native", "#mostly-native", "#mixed-model", "#workaround-heavy", "#hacky"].includes(tag),
        ) ?? null;
      const coreToExtensionTag =
        normalizedTags.find((tag) =>
          [
            "#core-centric",
            "#core-first",
            "#balanced-core-extension",
            "#extension-heavy",
            "#extension-driven",
          ].includes(tag),
        ) ?? null;

      map[key] = {
        verdictTag,
        nativeToHackyTag,
        coreToExtensionTag,
        tags: normalizedTags,
        explanation: (item as { explanation?: string | null }).explanation ?? null,
      };
    }
    return map;
  }, [schemaCoverageDetail]);

  const schemaCoverageSummary = useMemo<SchemaCoverageSummary | null>(() => {
    if (!schemaCoverageDetail) return null;
    const reportData = asRecord(schemaCoverageDetail.report.reportData);
    const totals = asRecord(reportData?.totals);
    const fromReport = {
      full: asNumber(totals?.full),
      strong: asNumber(totals?.strong),
      partial: asNumber(totals?.partial),
      gap: asNumber(totals?.gap),
      totalUseCases: asNumber(totals?.totalUseCases),
      avgN2h: asNumber((asRecord(reportData?.scaleSummary) ?? {}).avgN2h),
      avgC2e: asNumber((asRecord(reportData?.scaleSummary) ?? {}).avgC2e),
    };

    if (
      fromReport.totalUseCases !== null &&
      fromReport.full !== null &&
      fromReport.strong !== null &&
      fromReport.partial !== null &&
      fromReport.gap !== null
    ) {
      return {
        reportTitle: schemaCoverageDetail.report.title || "Schema Coverage",
        totalUseCases: fromReport.totalUseCases,
        full: fromReport.full,
        strong: fromReport.strong,
        partial: fromReport.partial,
        gap: fromReport.gap,
        avgN2h: fromReport.avgN2h,
        avgC2e: fromReport.avgC2e,
      };
    }

    let full = 0;
    let strong = 0;
    let partial = 0;
    let gap = 0;
    for (const row of Object.values(useCaseCoverageByKey)) {
      const verdict = (row.verdictTag || "").toLowerCase();
      if (verdict === "#full") full += 1;
      else if (verdict === "#strong") strong += 1;
      else if (verdict === "#partial") partial += 1;
      else if (verdict === "#gap") gap += 1;
    }
    const totalUseCases = full + strong + partial + gap;
    return {
      reportTitle: schemaCoverageDetail.report.title || "Schema Coverage",
      totalUseCases,
      full,
      strong,
      partial,
      gap,
      avgN2h: null,
      avgC2e: null,
    };
  }, [schemaCoverageDetail, useCaseCoverageByKey]);

  const selectedUseCaseCoverage: UseCaseCoverage | null = useMemo(() => {
    if (libraryEditorKind !== "use_case") return null;
    if (!libraryEditorKey) return null;
    return useCaseCoverageByKey[libraryEditorKey.toUpperCase()] ?? null;
  }, [libraryEditorKind, libraryEditorKey, useCaseCoverageByKey]);

  const isDetailMode = Boolean(detail) || Boolean(selectedRunId);
  const latestLibraryVersion = libraryEditorVersions[0] ?? null;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Checking session...
        </div>
      </div>
    );
  }

  return (
    <RequireRole permissions={["sagas.read"]}>
      {!isDetailMode ? (
        <div className="min-h-screen bg-background">
          <header className="border-b">
            <div className="w-full px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Saga Dashboard</h1>
                  <p className="text-sm text-muted-foreground">
                    API/schema lifecycle health by saga group
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void loadRuns()}
                  disabled={loading || bulkArchiving || bulkRerunning}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
                <Badge variant={wsConnected ? "default" : "outline"}>
                  {wsConnected ? (
                    <Wifi className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 mr-1" />
                  )}
                  {wsConnected ? "Live" : "Offline"}
                </Badge>
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {user?.email}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void onSignOut()}
                  className="gap-1.5"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </div>
          </header>

          <main className="w-full px-6 py-6 space-y-6">
            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <PlatformHealthCards
              summary={currentHealthSummary}
              libraryOverview={libraryOverview}
            />

            <LibraryManager
              libraryOverview={libraryOverview}
              useCases={useCases}
              personas={personas}
              useCaseCoverageByKey={useCaseCoverageByKey}
              schemaCoverageSummary={schemaCoverageSummary}
              librarySyncing={librarySyncing}
              onRefresh={() => loadLibraryLoopData()}
              onSyncDocs={() => syncLibraryLoopFromDocs()}
              onOpenRelations={openLibraryItemRelations}
              onOpenEditor={openLibraryEditor}
              onCreate={openLibraryCreator}
            />

            <SagaDefinitionsManager
              definitions={sagaDefinitions}
              loading={libraryDataLoading}
              onRefresh={() => loadLibraryLoopData()}
              onUnauthorized={() => redirectToLogin()}
            />

            <RunGroupsGrid
              loading={loading}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              searchText={searchText}
              onSearchTextChange={setSearchText}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              isPlatformAdmin={isPlatformAdmin}
              showAllRuns={showAllRuns}
              onToggleShowAllRuns={() => setShowAllRuns((prev) => !prev)}
              includeArchivedRuns={includeArchivedRuns}
              onToggleIncludeArchivedRuns={() =>
                setIncludeArchivedRuns((prev) => !prev)
              }
              selectedRunCount={selectedRunIds.size}
              allVisibleSelected={allVisibleSelected}
              onToggleSelectAllVisible={toggleSelectAllVisible}
              onBulkRerun={() => void rerunSelectedRuns()}
              onBulkArchive={() => void archiveSelectedRuns()}
              bulkRerunning={bulkRerunning}
              bulkArchiving={bulkArchiving}
              filteredRunsBySaga={filteredRunGroups}
              totalRunsBySaga={runsBySelectedGroup.length}
              sagaDefinitionCount={libraryOverview?.counts.sagaDefinitions ?? 0}
              isRunSelected={isRunSelected}
              onToggleRunSelected={toggleRunSelected}
              onSelectRun={setSelectedRunId}
              onRerunRun={(run) => void rerunFromRun(run)}
              runStatusMeta={runStatusMeta}
              runStatusAccentClass={runStatusAccentClass}
              runStatusTextClass={runStatusTextClass}
              pct={pct}
            />
          </main>
        </div>
      ) : !detail ? (
        <div className="flex h-screen overflow-hidden bg-background">
          <main className="flex-1 min-w-0 flex flex-col">
            <header className="border-b px-6 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedRunId(null);
                    setDetail(null);
                  }}
                  className="gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Button>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold truncate">
                    Loading saga run
                  </h1>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedRunId ? `Run ${selectedRunId.slice(-8)}` : "Preparing detail view"}
                  </p>
                </div>
              </div>
            </header>
            <div className="flex-1 flex items-center justify-center">
              {error ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground flex items-center">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Loading run detail...
                </div>
              )}
            </div>
          </main>
        </div>
      ) : (
        <div className="flex h-screen overflow-hidden bg-background">
          <RunsSidebar
            loading={loading}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            searchText={searchText}
            onSearchTextChange={setSearchText}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            isPlatformAdmin={isPlatformAdmin}
            showAllRuns={showAllRuns}
            onToggleShowAllRuns={() => setShowAllRuns((prev) => !prev)}
            includeArchivedRuns={includeArchivedRuns}
            onToggleIncludeArchivedRuns={() =>
              setIncludeArchivedRuns((prev) => !prev)
            }
            selectedRunCount={selectedRunIds.size}
            allVisibleSelected={allVisibleSelected}
            onToggleSelectAllVisible={toggleSelectAllVisible}
            onBulkRerun={() => void rerunSelectedRuns()}
            onBulkArchive={() => void archiveSelectedRuns()}
            bulkRerunning={bulkRerunning}
            bulkArchiving={bulkArchiving}
            filteredRunsBySaga={filteredRunGroups}
            totalRunsBySaga={runsBySelectedGroup.length}
            sagaDefinitionCount={libraryOverview?.counts.sagaDefinitions ?? 0}
            selectedRunId={selectedRunId}
            isRunSelected={isRunSelected}
            onSelectRun={selectRunForDetail}
            onRefresh={() => void loadRuns()}
            runStatusMeta={runStatusMeta}
            runStatusTextClass={runStatusTextClass}
          />

          <main className="flex-1 min-w-0 flex flex-col">
            <header className="border-b px-6 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedRunId(null);
                    setDetail(null);
                  }}
                  className="gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Button>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold truncate">
                    {detail.definition?.title || detail.run.sagaKey}
                  </h1>
                  <p className="text-xs text-muted-foreground truncate">
                    Run {detail.run.id.slice(-8)} • {detail.steps.length} steps
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={runStatusMeta(detail.run.status).badgeVariant}>
                  {(() => {
                    const status = runStatusMeta(detail.run.status);
                    const StatusIcon = status.icon;
                    return (
                      <>
                        <StatusIcon
                          className={`h-3.5 w-3.5 mr-1 ${runStatusTextClass(detail.run.status)}`}
                        />
                        {status.label} •{" "}
                        {detail.run.mode === "dry_run" ? "Dry run" : "Live"}
                      </>
                    );
                  })()}
                </Badge>
                {loadingDetail ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openHistoryDialog(detail.run.sagaKey)}
                >
                  History
                </Button>
                {detail.run.status === "pending" || detail.run.status === "running" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void executeRunNow(detail.run.id)}
                    disabled={executingRunIds.has(detail.run.id)}
                    className="gap-1.5"
                  >
                    {executingRunIds.has(detail.run.id) ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Execute
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void rerunFromRun(detail.run)}
                  disabled={archivingRunIds.has(detail.run.id)}
                >
                  Rerun
                </Button>
                <CopyButton value={detail.run.id} />
              </div>
            </header>

            <RunDetailPanel
              detail={detail}
              error={error}
              selectedSagaGroup={selectedSagaGroup}
              successRate={successRate}
              triageSteps={triageSteps}
              coverageDetail={coverageDetail}
              definitionLinksDetail={definitionLinksDetail}
              groupedSteps={groupedSteps}
              expandedPhases={expandedPhases}
              onTogglePhase={togglePhase}
              searchText={searchText}
              getArtifactsForStep={getArtifactsForStep}
              onOpenStepDialog={openStepDialog}
              onOpenArtifactDialog={openArtifactDialog}
              safeArtifactTitle={safeArtifactTitle}
              formatDuration={formatDuration}
              pct={pct}
              stepStatusMeta={stepStatusMeta}
              stepStatusAccentClass={stepStatusAccentClass}
              stepStatusTextClass={stepStatusTextClass}
              messageComposeToActorKey={messageComposeToActorKey}
              onMessageComposeToActorKeyChange={setMessageComposeToActorKey}
              messageComposeChannel={messageComposeChannel}
              onMessageComposeChannelChange={setMessageComposeChannel}
              messageComposeSubject={messageComposeSubject}
              onMessageComposeSubjectChange={setMessageComposeSubject}
              messageComposeBody={messageComposeBody}
              onMessageComposeBodyChange={setMessageComposeBody}
              messageSending={messageSending}
              onSendVirtualMessage={sendVirtualMessage}
            />
          </main>
        </div>
      )}

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Run History</DialogTitle>
            <DialogDescription>
              {historySagaKey
                ? `Past runs for ${historySagaKey}. Select one to inspect full details.`
                : "Select a saga to inspect historical runs."}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-3">
            {historyRunsForDialog.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No run history found.
              </div>
            ) : (
              <div className="space-y-2">
                {historyRunsForDialog.map((run) => {
                  const status = runStatusMeta(run.status);
                  const StatusIcon = status.icon;
                  const isCurrentSelection = selectedRunId === run.id;

                  return (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => {
                        setSelectedRunId(run.id);
                        setHistoryDialogOpen(false);
                      }}
                      className={`w-full rounded-md border p-3 text-left ${isCurrentSelection ? "bg-muted" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {run.id}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {run.createdAt
                              ? new Date(run.createdAt).toLocaleString()
                              : "Unknown time"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {run.passedSteps}/{run.totalSteps} passed
                            {run.failedSteps > 0
                              ? ` • ${run.failedSteps} failed`
                              : ""}
                            {run.skippedSteps > 0
                              ? ` • ${run.skippedSteps} skipped`
                              : ""}
                          </p>
                        </div>
                        <Badge variant={status.badgeVariant}>
                          <StatusIcon className="h-3.5 w-3.5 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={libraryDialogOpen} onOpenChange={setLibraryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedLibraryItem ? `${selectedLibraryItem.title}` : "Library Item"}
            </DialogTitle>
            <DialogDescription>
              {selectedLibraryItem
                ? `${selectedLibraryItem.kind.replace("_", " ")} • ${selectedLibraryItem.key}`
                : "Linked saga definitions"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(85vh-110px)] pr-2">
            {libraryDialogLoading ? (
              <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading relations...
              </div>
            ) : libraryDialogError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {libraryDialogError}
              </div>
            ) : !libraryRelations ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center">
                No relations found.
              </div>
            ) : (
              <div className="space-y-4 pb-1">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Versions</p>
                    <p className="text-xl font-semibold">{libraryRelations.versions.length}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Links</p>
                    <p className="text-xl font-semibold">{libraryRelations.links.length}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Linked Sagas</p>
                    <p className="text-xl font-semibold">{libraryRelations.definitions.length}</p>
                  </div>
                </div>

                <div className="rounded-md border">
                  <div className="border-b p-3 text-sm font-medium">Linked Saga Definitions</div>
                  <ScrollArea className="max-h-[46vh]">
                    {libraryRelations.definitions.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No saga definitions linked yet.</p>
                    ) : (
                      <div className="divide-y">
                        {libraryRelations.definitions.map((definition) => {
                          const latestRun = latestRunBySagaKey.get(definition.sagaKey);
                          return (
                            <div
                              key={definition.id}
                              className="p-3 flex items-start justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{definition.title}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {definition.sagaKey}
                                </p>
                                {definition.description ? (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {definition.description}
                                  </p>
                                ) : null}
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                {latestRun ? (
                                  <Badge variant={runStatusMeta(latestRun.status).badgeVariant}>
                                    {runStatusMeta(latestRun.status).label}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">No run</Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (!latestRun) return;
                                    setLibraryDialogOpen(false);
                                    setSelectedRunId(latestRun.id);
                                  }}
                                  disabled={!latestRun}
                                >
                                  Open Run
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={libraryEditorOpen} onOpenChange={setLibraryEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {libraryEditorIsCreate ? "Create" : "Edit"} {libraryEditorKind.replace("_", " ")}
              {!libraryEditorIsCreate && libraryEditorKey ? ` • ${libraryEditorKey}` : ""}
            </DialogTitle>
            <DialogDescription>
              {libraryEditorIsCreate
                ? "Create a new library item. After creation, you can add immutable version snapshots."
                : "Update definition metadata and create immutable version snapshots."}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-110px)] pr-2">
            {libraryEditorLoading ? (
              <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading editor...
              </div>
            ) : libraryEditorError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {libraryEditorError}
              </div>
            ) : !libraryEditorDefinition ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center">
                No definition loaded.
              </div>
            ) : (
              <Tabs defaultValue="overview" className="space-y-4 pb-1">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="definition">Definition</TabsTrigger>
                {!libraryEditorIsCreate ? <TabsTrigger value="version">New Version</TabsTrigger> : null}
                {!libraryEditorIsCreate ? <TabsTrigger value="history">Version History</TabsTrigger> : null}
                <TabsTrigger value="raw">Raw JSON</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-0">
                <div className="rounded-md border">
                  <div className="border-b px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Definition ({libraryEditorKind.replace("_", " ")})
                    </p>
                  </div>
                  <ScrollArea className="max-h-[260px]">
                    <div className="divide-y">
                      {libraryDetailFieldEntries(libraryEditorDefinition).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-[180px_1fr] gap-3 px-3 py-2 text-xs">
                          <p className="font-medium text-muted-foreground">{key}</p>
                          <p className="break-words">{formatLibraryFieldValue(value)}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="rounded-md border">
                  <div className="border-b px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Current Version
                    </p>
                  </div>
                  {!latestLibraryVersion ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      No version snapshots found.
                    </p>
                  ) : (
                    <div className="space-y-3 p-3">
                      <div className="grid gap-2 text-xs sm:grid-cols-2">
                        <p>
                          <span className="text-muted-foreground">Version:</span>{" "}
                          <span className="font-medium">
                            {String(latestLibraryVersion.versionNumber ?? "—")}
                          </span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Checksum:</span>{" "}
                          <span className="font-mono break-all">
                            {String(latestLibraryVersion.contentChecksum ?? "—")}
                          </span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Current:</span>{" "}
                          <span className="font-medium">
                            {String(latestLibraryVersion.isCurrent ?? false)}
                          </span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Published:</span>{" "}
                          <span className="font-medium">
                            {String(latestLibraryVersion.publishedAt ?? "—")}
                          </span>
                        </p>
                      </div>
                      {"bodyMarkdown" in latestLibraryVersion &&
                      typeof latestLibraryVersion.bodyMarkdown === "string" &&
                      latestLibraryVersion.bodyMarkdown.trim() ? (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Body Markdown
                          </p>
                          <ScrollArea className="max-h-[220px] rounded border bg-muted/20">
                            <pre className="p-3 text-xs whitespace-pre-wrap break-words font-mono">
                              {latestLibraryVersion.bodyMarkdown}
                            </pre>
                          </ScrollArea>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {libraryEditorKind === "use_case" ? (
                  <div className="rounded-md border">
                    <div className="border-b px-3 py-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Schema Coverage
                      </p>
                    </div>
                    {!selectedUseCaseCoverage ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        No schema coverage tags found for this use case.
                      </p>
                    ) : (
                      <div className="p-3 space-y-3">
                        <div className="flex flex-wrap gap-1">
                          {selectedUseCaseCoverage.verdictTag ? (
                            <Badge>{selectedUseCaseCoverage.verdictTag}</Badge>
                          ) : null}
                          {selectedUseCaseCoverage.nativeToHackyTag ? (
                            <Badge variant="outline">
                              {selectedUseCaseCoverage.nativeToHackyTag}
                            </Badge>
                          ) : null}
                          {selectedUseCaseCoverage.coreToExtensionTag ? (
                            <Badge variant="outline">
                              {selectedUseCaseCoverage.coreToExtensionTag}
                            </Badge>
                          ) : null}
                        </div>
                        {selectedUseCaseCoverage.explanation ? (
                          <p className="text-sm text-muted-foreground">
                            {selectedUseCaseCoverage.explanation}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-1">
                          {selectedUseCaseCoverage.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="definition" className="space-y-3 mt-0">
                {libraryEditorKind === "use_case" ? (
                  <Input
                    value={String(libraryEditorDefinition.ucKey ?? "")}
                    onChange={(event) =>
                      setLibraryEditorDefinition((prev) =>
                        prev ? { ...prev, ucKey: event.target.value } : prev,
                      )
                    }
                    placeholder="UC Key (e.g. UC-258)"
                    disabled={!libraryEditorIsCreate}
                  />
                ) : (
                  <Input
                    value={String(libraryEditorDefinition.personaKey ?? "")}
                    onChange={(event) =>
                      setLibraryEditorDefinition((prev) =>
                        prev ? { ...prev, personaKey: event.target.value } : prev,
                      )
                    }
                    placeholder="Persona Key (e.g. P-42)"
                    disabled={!libraryEditorIsCreate}
                  />
                )}
                {libraryEditorKind === "persona" ? (
                  <Input
                    value={String(libraryEditorDefinition.name ?? "")}
                    onChange={(event) =>
                      setLibraryEditorDefinition((prev) =>
                        prev ? { ...prev, name: event.target.value } : prev,
                      )
                    }
                    placeholder="Name"
                  />
                ) : (
                  <Input
                    value={String(libraryEditorDefinition.title ?? "")}
                    onChange={(event) =>
                      setLibraryEditorDefinition((prev) =>
                        prev ? { ...prev, title: event.target.value } : prev,
                      )
                    }
                    placeholder="Title"
                  />
                )}
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={String(libraryEditorDefinition.status ?? "active")}
                  onChange={(event) =>
                    setLibraryEditorDefinition((prev) =>
                      prev ? { ...prev, status: event.target.value } : prev,
                    )
                  }
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
                {libraryEditorKind === "persona" ? (
                  <textarea
                    className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={String(libraryEditorDefinition.profileSummary ?? "")}
                    onChange={(event) =>
                      setLibraryEditorDefinition((prev) =>
                        prev
                          ? { ...prev, profileSummary: event.target.value }
                          : prev,
                      )
                    }
                    placeholder="Profile summary"
                  />
                ) : (
                  <textarea
                    className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={String(libraryEditorDefinition.summary ?? "")}
                    onChange={(event) =>
                      setLibraryEditorDefinition((prev) =>
                        prev ? { ...prev, summary: event.target.value } : prev,
                      )
                    }
                    placeholder="Summary"
                  />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => void saveLibraryDefinitionEdits()}
                    disabled={libraryEditorSaving}
                  >
                    {libraryEditorSaving ? (
                      <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : null}
                    {libraryEditorIsCreate ? "Create Definition" : "Save Definition"}
                  </Button>
                  {!libraryEditorIsCreate ? (
                    <Button
                      variant="destructive"
                      onClick={() => void deleteLibraryDefinition()}
                      disabled={libraryEditorSaving}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent value="version" className="space-y-3 mt-0">
                <textarea
                  className="min-h-[260px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                  value={libraryVersionDraft}
                  onChange={(event) => setLibraryVersionDraft(event.target.value)}
                  placeholder="Version markdown"
                />
                <Button
                  onClick={() => void createLibraryVersion()}
                  disabled={libraryEditorSaving || libraryEditorIsCreate || !libraryVersionDraft.trim()}
                >
                  {libraryEditorSaving ? (
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : null}
                  Create Version
                </Button>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <div className="rounded-md border">
                  <ScrollArea className="max-h-[320px]">
                    {libraryEditorVersions.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No versions found.</p>
                    ) : (
                      <div className="divide-y">
                        {libraryEditorVersions.map((version, index) => (
                          <div key={String(version.id ?? index)} className="p-3 text-sm">
                            <p className="font-medium">
                              v{String(version.versionNumber ?? "?")}{" "}
                              {String(
                                version.title ??
                                  version.name ??
                                  libraryEditorDefinition.title ??
                                  libraryEditorDefinition.name ??
                                  "",
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              checksum: {String(version.contentChecksum ?? "n/a")}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="raw" className="space-y-3 mt-0">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Definition JSON</p>
                  <ThemedJsonView
                    src={libraryEditorDefinition}
                    maxHeightClassName="max-h-[260px]"
                    theme={jsonTheme}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Version History JSON
                  </p>
                  <ThemedJsonView
                    src={libraryEditorVersions}
                    maxHeightClassName="max-h-[320px]"
                    theme={jsonTheme}
                  />
                </div>
              </TabsContent>
              </Tabs>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {selectedStep
                ? `Step Details: ${selectedStep.title || selectedStep.stepKey}`
                : "Step Details"}
            </DialogTitle>
          </DialogHeader>
          {selectedStep ? (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {selectedStep.title || selectedStep.stepKey}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedStep.phaseTitle} / {selectedStep.stepKey}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={stepStatusMeta(selectedStep.status).badgeVariant}
                  >
                    {stepStatusMeta(selectedStep.status).label}
                  </Badge>
                  <CopyButton value={selectedStep.id} />
                </div>
              </div>

              <ScrollArea className="flex-1 max-h-[calc(95vh-58px)]">
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">What to do</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedStep.instruction}
                    </p>
                  </div>

                  {selectedStep.expectedResult ? (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Expected Result</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedStep.expectedResult}
                      </p>
                    </div>
                  ) : null}

                  {selectedStep.delayMode && selectedStep.delayMode !== "none" ? (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Delay / Wait</h4>
                      <div className="rounded-md border p-3 text-sm text-muted-foreground">
                        <p>mode: {selectedStep.delayMode}</p>
                        {selectedStep.delayMode === "fixed" ? (
                          <p>delayMs: {selectedStep.delayMs ?? 0}</p>
                        ) : (
                          <>
                            <p>condition: {selectedStep.delayConditionKey ?? "n/a"}</p>
                            <p>timeoutMs: {selectedStep.delayTimeoutMs ?? 30000}</p>
                            <p>pollMs: {selectedStep.delayPollMs ?? 1000}</p>
                          </>
                        )}
                        <p>jitterMs: {selectedStep.delayJitterMs ?? 0}</p>
                      </div>
                    </div>
                  ) : null}

                  <Separator />

                  <Tabs
                    value={viewMode}
                    onValueChange={(v) => setViewMode(v as "visual" | "data")}
                    className="space-y-4"
                  >
                    <TabsList>
                      <TabsTrigger value="visual">
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Visual
                      </TabsTrigger>
                      <TabsTrigger value="data">
                        <FileJson2 className="h-3.5 w-3.5 mr-1.5" />
                        Data
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="visual" className="mt-0">
                      {artifactLoading ? (
                        <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />{" "}
                          Loading snapshot...
                        </div>
                      ) : artifactError ? (
                        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                          {artifactError}
                        </div>
                      ) : artifactSnapshot ? (
                        <SnapshotRenderer doc={artifactSnapshot} />
                      ) : (
                        <div className="rounded-md border p-6 text-sm text-muted-foreground text-center">
                          No snapshot captured for this step.
                        </div>
                      )}
                    </TabsContent>

                  <TabsContent value="data" className="mt-0 space-y-3">
                      <ThemedJsonView
                        src={(() => {
                          const snapshotData =
                            artifactSnapshot?.rawData ??
                            artifactSnapshot?.data ??
                            null;
                          const fallbackData = {
                            resultPayload: selectedStep.resultPayload ?? null,
                            assertionSummary:
                              selectedStep.assertionSummary ?? null,
                            failureMessage:
                              selectedStep.failureMessage ?? null,
                          };
                          return snapshotData ?? fallbackData;
                        })()}
                        theme={jsonTheme}
                      />
                    </TabsContent>
                  </Tabs>

                  {selectedStep.assertionSummary ? (
                    <div className="space-y-2">
                      <Separator />
                      <h4 className="font-medium text-sm">Assertions</h4>
                      <ThemedJsonView
                        src={selectedStep.assertionSummary}
                        maxHeightClassName="max-h-[240px]"
                        theme={jsonTheme}
                      />
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={artifactDialogOpen} onOpenChange={setArtifactDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{artifactTitle || "Artifact"}</DialogTitle>
            <DialogDescription>
              {artifactItem
                ? `${artifactItem.artifactType} • ${artifactItem.contentType}`
                : "Artifact content"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-110px)] pr-2">
            {artifactLoading ? (
              <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading
                artifact...
              </div>
            ) : artifactError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {artifactError}
              </div>
            ) : artifactSnapshot &&
              (artifactItem?.artifactType === "snapshot" ||
                artifactItem?.artifactType === "pseudoshot") ? (
              <Tabs defaultValue="visual" className="space-y-4 pb-1">
              <TabsList>
                <TabsTrigger value="visual">
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Visual
                </TabsTrigger>
                <TabsTrigger value="data">
                  <FileJson2 className="h-3.5 w-3.5 mr-1.5" />
                  Data
                </TabsTrigger>
              </TabsList>

              <TabsContent value="visual" className="mt-0">
                <SnapshotRenderer doc={artifactSnapshot} />
              </TabsContent>

              <TabsContent value="data" className="mt-0">
                <ThemedJsonView
                  src={artifactSnapshot.rawData ??
                    artifactSnapshot.data ?? {
                      snapshotDocument: artifactSnapshot,
                    }}
                  maxHeightClassName="max-h-[520px]"
                  theme={jsonTheme}
                />
              </TabsContent>
            </Tabs>
          ) : (
              <ThemedJsonView
                src={(() => {
                  try {
                    return JSON.parse(artifactContent);
                  } catch {
                    return { content: artifactContent };
                  }
                })()}
                maxHeightClassName="max-h-[520px]"
                theme={jsonTheme}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </RequireRole>
  );
}
