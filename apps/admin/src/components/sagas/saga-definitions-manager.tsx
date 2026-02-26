"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Archive, FileCode2, Plus, RefreshCw, Save, Search } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

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

type SagaSpec = Record<string, unknown>;

type SagaDefinitionRevision = {
  id: string;
  revisionNumber: number;
  specVersion: string;
  specChecksum: string;
  createdAt?: string;
  isCurrent: boolean;
  sourceFilePath?: string | null;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

type SagaDefinitionsManagerProps = {
  definitions: SagaDefinition[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onUnauthorized?: () => Promise<void> | void;
};

function templateSpec(): SagaSpec {
  return {
    schemaVersion: "saga.v0",
    sagaKey: "",
    title: "",
    description: "",
    tags: ["db-native", "lifecycle", "api-first"],
    defaults: {
      runMode: "dry_run",
      continueOnFailure: false,
    },
    source: {},
    objectives: [],
    actors: [
      {
        actorKey: "biz_owner",
        name: "Biz Owner",
        role: "owner",
      },
    ],
    phases: [
      {
        phaseKey: "setup",
        order: 1,
        title: "Setup",
        description: "Initial setup flow",
        steps: [
          {
            stepKey: "owner-sign-up",
            order: 1,
            title: "Owner auth",
            actorKey: "biz_owner",
            intent: "Authenticate owner session.",
            instruction: "Create or login owner account.",
            expectedResult: "Authenticated owner can call protected routes.",
            toolHints: [],
            assertions: [],
            evidenceRequired: [],
            guardrails: [],
            tags: [],
            delay: { mode: "none", jitterMs: 0 },
          },
        ],
      },
    ],
    metadata: {},
  };
}

function statusVariant(status: SagaDefinition["status"]) {
  if (status === "active") return "default" as const;
  if (status === "draft") return "secondary" as const;
  return "outline" as const;
}

function prettyDate(value?: string) {
  if (!value) return "—";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;
  return time.toLocaleString();
}

async function parseJsonResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload?.success) {
    throw new Error("API request failed.");
  }
  return payload;
}

export function SagaDefinitionsManager({
  definitions,
  loading,
  onRefresh,
  onUnauthorized,
}: SagaDefinitionsManagerProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "archived">(
    "all",
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [activeSagaKey, setActiveSagaKey] = useState<string | null>(null);
  const [editorStatus, setEditorStatus] = useState<"draft" | "active" | "archived">("active");
  const [editorBizId, setEditorBizId] = useState("");
  const [editorSpecText, setEditorSpecText] = useState(
    JSON.stringify(templateSpec(), null, 2),
  );
  const [revisions, setRevisions] = useState<SagaDefinitionRevision[]>([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const filteredDefinitions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return definitions.filter((definition) => {
      if (statusFilter !== "all" && definition.status !== statusFilter) return false;
      if (!normalized) return true;
      return (
        `${definition.sagaKey} ${definition.title} ${definition.status} ${definition.specVersion}`
          .toLowerCase()
          .includes(normalized)
      );
    });
  }, [definitions, query, statusFilter]);

  async function handleUnauthorized(response: Response) {
    if (response.status !== 401) return false;
    await onUnauthorized?.();
    return true;
  }

  async function openCreateDialog() {
    setEditorMode("create");
    setActiveSagaKey(null);
    setEditorStatus("active");
    setEditorBizId("");
    setEditorSpecText(JSON.stringify(templateSpec(), null, 2));
    setEditorError(null);
    setRevisions([]);
    setEditorOpen(true);
  }

  async function openEditDialog(sagaKey: string) {
    setEditorOpen(true);
    setEditorMode("edit");
    setEditorLoading(true);
    setEditorError(null);
    setActiveSagaKey(sagaKey);
    setRevisions([]);

    try {
      const specRes = await fetch(apiUrl(`/api/v1/sagas/specs/${encodeURIComponent(sagaKey)}`), {
        credentials: "include",
      });
      if (await handleUnauthorized(specRes)) return;
      const specPayload = await parseJsonResponse<{
        definition: SagaDefinition;
        spec: SagaSpec;
      }>(specRes);

      setEditorStatus(specPayload.data.definition.status);
      setEditorBizId(specPayload.data.definition.bizId ?? "");
      setEditorSpecText(JSON.stringify(specPayload.data.spec, null, 2));

      const revRes = await fetch(
        apiUrl(`/api/v1/sagas/specs/${encodeURIComponent(sagaKey)}/revisions?limit=50`),
        { credentials: "include" },
      );
      if (await handleUnauthorized(revRes)) return;
      const revPayload = await parseJsonResponse<{
        revisions: SagaDefinitionRevision[];
      }>(revRes);
      setRevisions(revPayload.data.revisions ?? []);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setEditorLoading(false);
    }
  }

  async function saveDefinition(options?: { forceRevision?: boolean }) {
    setEditorSaving(true);
    setEditorError(null);
    try {
      const parsedSpec = JSON.parse(editorSpecText) as SagaSpec;
      const sagaKey =
        editorMode === "edit" ? activeSagaKey : String(parsedSpec?.sagaKey ?? "").trim();
      if (!sagaKey) {
        throw new Error("spec.sagaKey is required.");
      }

      const payloadBody = {
        spec: parsedSpec,
        status: editorStatus,
        bizId: editorBizId.trim() ? editorBizId.trim() : null,
        forceRevision: options?.forceRevision ?? false,
      };

      const url =
        editorMode === "create"
          ? "/api/v1/sagas/specs"
          : options?.forceRevision
            ? `/api/v1/sagas/specs/${encodeURIComponent(sagaKey)}/revisions`
            : `/api/v1/sagas/specs/${encodeURIComponent(sagaKey)}`;

      const method = editorMode === "create" || options?.forceRevision ? "POST" : "PUT";

      const res = await fetch(apiUrl(url), {
        method,
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadBody),
      });
      if (await handleUnauthorized(res)) return;
      await parseJsonResponse(res);

      await onRefresh();
      await openEditDialog(sagaKey);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setEditorSaving(false);
    }
  }

  async function archiveDefinition() {
    if (!activeSagaKey) return;
    const confirmed = window.confirm(`Archive saga definition "${activeSagaKey}"?`);
    if (!confirmed) return;
    setEditorSaving(true);
    setEditorError(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/sagas/specs/${encodeURIComponent(activeSagaKey)}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (await handleUnauthorized(res)) return;
      await parseJsonResponse(res);
      await onRefresh();
      setEditorOpen(false);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error));
    } finally {
      setEditorSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">Saga Definitions</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                DB-native saga specs. Create, edit, revise, and archive canonical lifecycle definitions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void onRefresh()} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Refresh
              </Button>
              <Button size="sm" onClick={() => void openCreateDialog()}>
                <Plus className="h-4 w-4 mr-1.5" />
                New Definition
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search saga key or title..."
                className="pl-8 h-9"
              />
            </div>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | "draft" | "active" | "archived")
              }
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredDefinitions.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No saga definitions match current filters.
            </div>
          ) : (
            <ScrollArea className="h-[320px] pr-3">
              <div className="space-y-2">
                {filteredDefinitions.map((definition) => (
                  <button
                    key={definition.id}
                    type="button"
                    className="w-full rounded-md border p-3 text-left hover:bg-muted/60 transition-colors"
                    onClick={() => void openEditDialog(definition.sagaKey)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{definition.sagaKey}</p>
                        <p className="text-xs text-muted-foreground truncate">{definition.title}</p>
                      </div>
                      <Badge variant={statusVariant(definition.status)}>{definition.status}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{definition.specVersion}</span>
                      <span>Updated {prettyDate(definition.updatedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editorMode === "create" ? "Create Saga Definition" : `Edit Saga Definition • ${activeSagaKey}`}
            </DialogTitle>
            <DialogDescription>
              Canonical DB-backed saga spec editor. Revisions are tracked in saga_definition_revisions.
            </DialogDescription>
          </DialogHeader>

          {editorLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="space-y-3">
                {editorError ? (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5" />
                    <span>{editorError}</span>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={editorStatus}
                      onChange={(event) =>
                        setEditorStatus(
                          event.target.value as "draft" | "active" | "archived",
                        )
                      }
                    >
                      <option value="active">active</option>
                      <option value="draft">draft</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Biz Id (optional)</Label>
                    <Input
                      value={editorBizId}
                      onChange={(event) => setEditorBizId(event.target.value)}
                      placeholder="Leave empty for platform-level definition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Spec JSON</Label>
                  <Textarea
                    value={editorSpecText}
                    onChange={(event) => setEditorSpecText(event.target.value)}
                    className="min-h-[420px] font-mono text-xs"
                    spellCheck={false}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => void saveDefinition()} disabled={editorSaving}>
                    <Save className="h-4 w-4 mr-1.5" />
                    Save
                  </Button>
                  {editorMode === "edit" ? (
                    <Button
                      variant="outline"
                      onClick={() => void saveDefinition({ forceRevision: true })}
                      disabled={editorSaving}
                    >
                      <FileCode2 className="h-4 w-4 mr-1.5" />
                      Save As Revision
                    </Button>
                  ) : null}
                  {editorMode === "edit" ? (
                    <Button
                      variant="outline"
                      onClick={() => void archiveDefinition()}
                      disabled={editorSaving}
                    >
                      <Archive className="h-4 w-4 mr-1.5" />
                      Archive Definition
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Revisions</p>
                {editorMode === "create" ? (
                  <p className="text-xs text-muted-foreground">
                    Revisions appear after the first save.
                  </p>
                ) : revisions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No revisions found.</p>
                ) : (
                  <ScrollArea className="h-[520px] pr-3">
                    <div className="space-y-2">
                      {revisions.map((revision) => (
                        <div key={revision.id} className="rounded-md border p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium">Rev {revision.revisionNumber}</p>
                            <Badge variant={revision.isCurrent ? "default" : "outline"}>
                              {revision.isCurrent ? "current" : "past"}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {prettyDate(revision.createdAt)}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">
                            {revision.specChecksum}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

