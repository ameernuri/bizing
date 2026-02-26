"use client";

import { Archive, Filter, List, RefreshCw, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

type SagaRun = {
  id: string;
  sagaKey: string;
  status: "pending" | "running" | "passed" | "failed" | "cancelled";
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
};

type SagaRunGroup = {
  sagaKey: string;
  latest: SagaRun;
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type ProgressSegment = {
  key: string;
  label: string;
  count: number;
  className: string;
};

function buildRunStepSegments(run: SagaRun): ProgressSegment[] {
  const pending = Math.max(
    run.totalSteps - run.passedSteps - run.failedSteps - run.skippedSteps,
    0,
  );
  return [
    { key: "failed", label: "Failed", count: run.failedSteps, className: "bg-red-500" },
    { key: "passed", label: "Passed", count: run.passedSteps, className: "bg-emerald-500" },
    { key: "pending", label: "Pending", count: pending, className: "bg-amber-500" },
    { key: "skipped", label: "Skipped", count: run.skippedSteps, className: "bg-slate-400" },
  ];
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

type RunsSidebarProps = {
  loading: boolean;
  groupBy: "saga" | "status" | "biz" | "runner";
  onGroupByChange: (value: "saga" | "status" | "biz" | "runner") => void;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  filterStatus: "all" | "passing" | "failing" | "running";
  onFilterStatusChange: (value: "all" | "passing" | "failing" | "running") => void;
  sortBy: "recent" | "name" | "status";
  onSortByChange: (value: "recent" | "name" | "status") => void;
  isPlatformAdmin: boolean;
  showAllRuns: boolean;
  onToggleShowAllRuns: () => void;
  includeArchivedRuns: boolean;
  onToggleIncludeArchivedRuns: () => void;
  selectedRunCount: number;
  allVisibleSelected: boolean;
  onToggleSelectAllVisible: () => void;
  onBulkRerun: () => void;
  onBulkArchive: () => void;
  bulkRerunning: boolean;
  bulkArchiving: boolean;
  filteredRunsBySaga: SagaRunGroup[];
  totalRunsBySaga: number;
  sagaDefinitionCount: number;
  selectedRunId: string | null;
  isRunSelected: (runId: string) => boolean;
  onSelectRun: (runId: string) => void;
  onRefresh: () => void;
  runStatusMeta: (status: SagaRun["status"]) => {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    badgeVariant: BadgeVariant;
  };
  runStatusTextClass: (status: SagaRun["status"]) => string;
};

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

export function RunsSidebar({
  loading,
  groupBy,
  onGroupByChange,
  searchText,
  onSearchTextChange,
  filterStatus,
  onFilterStatusChange,
  sortBy,
  onSortByChange,
  isPlatformAdmin,
  showAllRuns,
  onToggleShowAllRuns,
  includeArchivedRuns,
  onToggleIncludeArchivedRuns,
  selectedRunCount,
  allVisibleSelected,
  onToggleSelectAllVisible,
  onBulkRerun,
  onBulkArchive,
  bulkRerunning,
  bulkArchiving,
  filteredRunsBySaga,
  totalRunsBySaga,
  sagaDefinitionCount,
  selectedRunId,
  isRunSelected,
  onSelectRun,
  onRefresh,
  runStatusMeta,
  runStatusTextClass,
}: RunsSidebarProps) {
  return (
    <aside className="w-80 min-w-0 max-w-80 overflow-x-hidden border-r shrink-0 flex flex-col">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Saga Runs</h2>
          <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading || bulkArchiving || bulkRerunning}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Search groups, runs, steps..."
            className="pl-8 h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 max-w-full overflow-hidden">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Filter">
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <p className="px-2 pb-2 text-xs text-muted-foreground">Filter status</p>
              <div className="space-y-1">
                {[
                  ["all", "All statuses"],
                  ["passing", "Passing"],
                  ["failing", "Failing"],
                  ["running", "Running"],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={filterStatus === value ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() =>
                      onFilterStatusChange(value as "all" | "passing" | "failing" | "running")
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={groupBy}
            onChange={(event) =>
              onGroupByChange(
                event.target.value as "saga" | "status" | "biz" | "runner",
              )
            }
            aria-label="Group runs by"
          >
            <option value="saga">Saga</option>
            <option value="status">Status</option>
            <option value="biz">Biz</option>
            <option value="runner">Runner</option>
          </select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Sort">
                <List className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <p className="px-2 pb-2 text-xs text-muted-foreground">Sort by</p>
              <div className="space-y-1">
                {[
                  ["recent", "Recent first"],
                  ["name", "Name A-Z"],
                  ["status", "Status"],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={sortBy === value ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => onSortByChange(value as "recent" | "name" | "status")}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {isPlatformAdmin ? (
            <Button variant={showAllRuns ? "secondary" : "outline"} size="sm" onClick={onToggleShowAllRuns}>
              {showAllRuns ? "All" : "Mine"}
            </Button>
          ) : null}

          <Button variant={includeArchivedRuns ? "secondary" : "outline"} size="sm" onClick={onToggleIncludeArchivedRuns}>
            Arch
          </Button>

          {selectedRunCount > 0 ? (
            <>
              <Button variant="outline" size="sm" onClick={onToggleSelectAllVisible}>
                {allVisibleSelected ? "Clear" : "Select all"}
              </Button>
              <Button variant="outline" size="sm" onClick={onBulkRerun} disabled={bulkRerunning} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                {selectedRunCount}
              </Button>
              <Button variant="outline" size="sm" onClick={onBulkArchive} disabled={bulkArchiving || bulkRerunning} className="gap-1.5">
                <Archive className="h-4 w-4" />
                {selectedRunCount}
              </Button>
            </>
          ) : null}

          <p className="text-xs text-muted-foreground truncate">
            {filteredRunsBySaga.length} / {totalRunsBySaga}
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-x-hidden">
        {loading ? (
          <RunsListSkeleton />
        ) : filteredRunsBySaga.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">
            {sagaDefinitionCount > 0
              ? `No visible runs. ${sagaDefinitionCount} saga definitions are available.`
              : "No saga runs yet."}
          </div>
        ) : (
          <div className="p-2 space-y-1 max-w-full overflow-x-hidden">
            {filteredRunsBySaga.map((group) => {
              const latestRun = group.latest;
              const status = runStatusMeta(latestRun.status);
              const StatusIcon = status.icon;
              const isSelected = selectedRunId === latestRun.id;
              const isMarked = isRunSelected(latestRun.id);
              const runStepSegments = buildRunStepSegments(latestRun);
              const passRate = pct(latestRun.passedSteps, latestRun.totalSteps);
              const totalSteps = Math.max(latestRun.totalSteps, 1);

              return (
                <button
                  key={group.sagaKey}
                  type="button"
                  onClick={() => onSelectRun(latestRun.id)}
                  className={`relative w-full max-w-full overflow-hidden rounded-none border px-2 py-2 text-left transition-colors hover:bg-muted/70 ${
                    isSelected
                      ? "bg-muted border-primary/60"
                      : isMarked
                        ? "bg-muted/40 border-primary/40"
                        : "bg-card"
                  }`}
                >
                  {isMarked ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1 bottom-1 z-20 w-1 bg-primary/70"
                    />
                  ) : null}
                  <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
                    <div className="flex h-full w-full">
                      {runStepSegments
                        .filter((segment) => segment.count > 0)
                        .map((segment) => (
                          <div
                            key={segment.key}
                            className={segment.className}
                            style={{
                              width: `${(segment.count / totalSteps) * 100}%`,
                            }}
                            title={`${segment.label}: ${segment.count}`}
                          />
                        ))}
                    </div>
                  </div>
                  <div className="relative z-10 grid w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden">
                    <div className="flex w-full min-w-0 items-center gap-2 overflow-hidden">
                      <StatusIcon className={`h-4 w-4 shrink-0 ${runStatusTextClass(latestRun.status)}`} />
                      <span className="block min-w-0 flex-1 truncate text-sm" title={group.sagaKey}>
                        {group.sagaKey}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{passRate}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
