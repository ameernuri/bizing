"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Link2, RefreshCw, Search, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LibraryItemKind = "use_case" | "persona";

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

type SagaLibraryOverview = {
  counts: {
    useCases: number;
    personas: number;
    sagaDefinitions?: number;
    sagaRuns?: number;
  };
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

type LibraryManagerProps = {
  libraryOverview: SagaLibraryOverview | null;
  useCases: SagaUseCase[];
  personas: SagaPersona[];
  useCaseCoverageByKey?: Record<string, UseCaseCoverage>;
  schemaCoverageSummary?: SchemaCoverageSummary | null;
  librarySyncing: boolean;
  onRefresh: () => Promise<void> | void;
  onSyncDocs: () => Promise<void> | void;
  onOpenRelations: (input: {
    kind: LibraryItemKind;
    key: string;
    title: string;
  }) => Promise<void> | void;
  onOpenEditor: (input: {
    kind: LibraryItemKind;
    key: string;
  }) => Promise<void> | void;
  onCreate: (kind: LibraryItemKind) => Promise<void> | void;
};

function clampPage(page: number, totalPages: number) {
  if (totalPages <= 0) return 1;
  if (page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

function statusBadgeVariant(status: "draft" | "active" | "archived") {
  if (status === "active") return "default" as const;
  if (status === "draft") return "secondary" as const;
  return "outline" as const;
}

function coverageVerdictBadgeVariant(tag?: string | null) {
  if (!tag) return "outline" as const;
  const normalized = tag.toLowerCase();
  if (normalized === "#full") return "default" as const;
  if (normalized === "#strong") return "secondary" as const;
  if (normalized === "#partial") return "outline" as const;
  if (normalized === "#gap") return "destructive" as const;
  return "outline" as const;
}

export function LibraryManager({
  libraryOverview,
  useCases,
  personas,
  useCaseCoverageByKey = {},
  schemaCoverageSummary,
  librarySyncing,
  onRefresh,
  onSyncDocs,
  onOpenRelations,
  onOpenEditor,
  onCreate,
}: LibraryManagerProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<LibraryItemKind>("use_case");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "archived">("all");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredUseCases = useMemo(() => {
    return useCases.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      const coverage = useCaseCoverageByKey[item.ucKey.toUpperCase()];
      const coverageText = [
        coverage?.verdictTag,
        coverage?.nativeToHackyTag,
        coverage?.coreToExtensionTag,
        ...(coverage?.tags ?? []),
        coverage?.explanation,
      ]
        .filter(Boolean)
        .join(" ");
      if (!normalizedQuery) return true;
      return `${item.ucKey} ${item.title} ${item.status} ${coverageText}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [useCases, normalizedQuery, statusFilter, useCaseCoverageByKey]);

  const filteredPersonas = useMemo(() => {
    return personas.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return `${item.personaKey} ${item.name} ${item.status}`.toLowerCase().includes(normalizedQuery);
    });
  }, [personas, normalizedQuery, statusFilter]);

  const activeListLength =
    tab === "use_case"
      ? filteredUseCases.length
      : filteredPersonas.length;

  const totalPages = Math.max(1, Math.ceil(activeListLength / pageSize));
  const safePage = clampPage(page, totalPages);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  useEffect(() => {
    setPage(1);
  }, [tab, query, statusFilter, pageSize]);

  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;

  const pagedUseCases = filteredUseCases.slice(pageStart, pageEnd);
  const pagedPersonas = filteredPersonas.slice(pageStart, pageEnd);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Loop Library Manager</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Browse all UCs/personas with search, filters, paging, version-edit links, and saga-link lookup.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Loaded: {useCases.length}/{libraryOverview?.counts.useCases ?? 0} UCs • {personas.length}/{libraryOverview?.counts.personas ?? 0} personas
              {typeof libraryOverview?.counts.sagaDefinitions === "number"
                ? ` • ${libraryOverview.counts.sagaDefinitions} saga definitions`
                : ""}
              {typeof libraryOverview?.counts.sagaRuns === "number"
                ? ` • ${libraryOverview.counts.sagaRuns} runs`
                : ""}
            </p>
            {schemaCoverageSummary ? (
              <p className="text-xs text-muted-foreground mt-1">
                Coverage: {schemaCoverageSummary.totalUseCases} UCs • #full {schemaCoverageSummary.full} • #strong {schemaCoverageSummary.strong} • #partial {schemaCoverageSummary.partial} • #gap {schemaCoverageSummary.gap}
                {typeof schemaCoverageSummary.avgN2h === "number"
                  ? ` • N2H ${schemaCoverageSummary.avgN2h.toFixed(2)}`
                  : ""}
                {typeof schemaCoverageSummary.avgC2e === "number"
                  ? ` • C2E ${schemaCoverageSummary.avgC2e.toFixed(2)}`
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onCreate("use_case")}
              disabled={librarySyncing}
            >
              New UC
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onCreate("persona")}
              disabled={librarySyncing}
            >
              New Persona
            </Button>
            <Button variant="outline" size="sm" onClick={() => void onRefresh()} disabled={librarySyncing}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => void onSyncDocs()} disabled={librarySyncing}>
              {librarySyncing ? (
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1.5" />
              )}
              Sync Docs
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search UC key or persona name..."
              className="pl-8 h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | "draft" | "active" | "archived",
                )
              }
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={String(pageSize)}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as LibraryItemKind)} className="space-y-3">
          <TabsList>
            <TabsTrigger value="use_case">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              Use Cases ({filteredUseCases.length})
            </TabsTrigger>
            <TabsTrigger value="persona">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Personas ({filteredPersonas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="use_case" className="mt-0">
            <div className="rounded-md border">
              <div className="grid grid-cols-[1.2fr_2.7fr_1.4fr_auto_auto] gap-2 border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span>Key</span>
                <span>Title</span>
                <span>Coverage</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              <ScrollArea className="max-h-[52vh]">
                {pagedUseCases.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No UC records match your filters.</p>
                ) : (
                  <div className="divide-y">
                    {pagedUseCases.map((uc) => (
                      <div
                        key={uc.id}
                        role="button"
                        tabIndex={0}
                        className="grid grid-cols-[1.2fr_2.7fr_1.4fr_auto_auto] items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => void onOpenEditor({ kind: "use_case", key: uc.ucKey })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void onOpenEditor({ kind: "use_case", key: uc.ucKey });
                          }
                        }}
                      >
                        <p className="truncate font-medium">{uc.ucKey}</p>
                        <p className="truncate text-muted-foreground">{uc.title}</p>
                        {(() => {
                          const coverage = useCaseCoverageByKey[uc.ucKey.toUpperCase()];
                          if (!coverage) {
                            return (
                              <Badge variant="outline" className="w-fit">
                                Unrated
                              </Badge>
                            );
                          }
                          return (
                            <div className="flex flex-wrap items-center gap-1">
                              {coverage.verdictTag ? (
                                <Badge
                                  variant={coverageVerdictBadgeVariant(coverage.verdictTag)}
                                  className="w-fit"
                                >
                                  {coverage.verdictTag}
                                </Badge>
                              ) : null}
                              {coverage.nativeToHackyTag ? (
                                <Badge variant="outline" className="w-fit">
                                  {coverage.nativeToHackyTag}
                                </Badge>
                              ) : null}
                              {coverage.coreToExtensionTag ? (
                                <Badge variant="outline" className="w-fit">
                                  {coverage.coreToExtensionTag}
                                </Badge>
                              ) : null}
                            </div>
                          );
                        })()}
                        <Badge variant={statusBadgeVariant(uc.status)} className="w-fit">
                          {uc.status}
                        </Badge>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void onOpenRelations({
                                kind: "use_case",
                                key: uc.ucKey,
                                title: uc.title,
                              });
                            }}
                          >
                            <Link2 className="h-3.5 w-3.5 mr-1" />
                            Links
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void onOpenEditor({ kind: "use_case", key: uc.ucKey });
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="persona" className="mt-0">
            <div className="rounded-md border">
              <div className="grid grid-cols-[1.5fr_3fr_auto_auto] gap-2 border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span>Key</span>
                <span>Name</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              <ScrollArea className="max-h-[52vh]">
                {pagedPersonas.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No persona records match your filters.</p>
                ) : (
                  <div className="divide-y">
                    {pagedPersonas.map((persona) => (
                      <div
                        key={persona.id}
                        role="button"
                        tabIndex={0}
                        className="grid grid-cols-[1.5fr_3fr_auto_auto] items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() =>
                          void onOpenEditor({ kind: "persona", key: persona.personaKey })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void onOpenEditor({ kind: "persona", key: persona.personaKey });
                          }
                        }}
                      >
                        <p className="truncate font-medium">{persona.personaKey}</p>
                        <p className="truncate text-muted-foreground">{persona.name}</p>
                        <Badge variant={statusBadgeVariant(persona.status)} className="w-fit">
                          {persona.status}
                        </Badge>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void onOpenRelations({
                                kind: "persona",
                                key: persona.personaKey,
                                title: persona.name,
                              });
                            }}
                          >
                            <Link2 className="h-3.5 w-3.5 mr-1" />
                            Links
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void onOpenEditor({ kind: "persona", key: persona.personaKey });
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

        </Tabs>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Showing {activeListLength === 0 ? 0 : pageStart + 1}-{Math.min(pageEnd, activeListLength)} of {activeListLength}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              Prev
            </Button>
            <Badge variant="outline">
              {safePage}/{totalPages}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
