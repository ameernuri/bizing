"use client";

import { Archive, Filter, LayoutGrid, List, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

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
};

type SagaRunGroup = {
  sagaKey: string;
  latest: SagaRun;
  runs: SagaRun[];
  summary: { total: number; passed: number; failed: number; active: number };
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
    { key: "passed", label: "Passed", count: run.passedSteps, className: "bg-emerald-500" },
    { key: "failed", label: "Failed", count: run.failedSteps, className: "bg-red-500" },
    { key: "pending", label: "Pending", count: pending, className: "bg-amber-500" },
    { key: "skipped", label: "Skipped", count: run.skippedSteps, className: "bg-slate-400" },
  ];
}

type RunGroupsGridProps = {
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
  isRunSelected: (runId: string) => boolean;
  onToggleRunSelected: (runId: string, checked: boolean) => void;
  onSelectRun: (runId: string) => void;
  onRerunRun: (run: SagaRun) => void;
  runStatusMeta: (status: SagaRun["status"]) => {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    badgeVariant: BadgeVariant;
  };
  runStatusAccentClass: (status: SagaRun["status"]) => string;
  runStatusTextClass: (status: SagaRun["status"]) => string;
  pct: (numerator: number, denominator: number) => number;
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

export function RunGroupsGrid({
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
  isRunSelected,
  onToggleRunSelected,
  onSelectRun,
  onRerunRun,
  runStatusMeta,
  runStatusAccentClass,
  runStatusTextClass,
  pct,
}: RunGroupsGridProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-[260px] max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchText}
              onChange={(event) => onSearchTextChange(event.target.value)}
              placeholder="Search saga groups, runs, steps..."
              className="pl-8 h-9"
            />
          </div>
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
                      onFilterStatusChange(
                        value as "all" | "passing" | "failing" | "running",
                      )
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
            <option value="saga">Group: Saga</option>
            <option value="status">Group: Status</option>
            <option value="biz">Group: Biz</option>
            <option value="runner">Group: Runner</option>
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
                    onClick={() =>
                      onSortByChange(value as "recent" | "name" | "status")
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {isPlatformAdmin ? (
            <Button variant={showAllRuns ? "secondary" : "outline"} size="sm" onClick={onToggleShowAllRuns}>
              {showAllRuns ? "All runs" : "My runs"}
            </Button>
          ) : null}

          <Button variant={includeArchivedRuns ? "secondary" : "outline"} size="sm" onClick={onToggleIncludeArchivedRuns}>
            Archived
          </Button>

          {selectedRunCount > 0 ? (
            <>
              <Button variant="outline" size="sm" onClick={onToggleSelectAllVisible}>
                {allVisibleSelected ? "Clear visible" : "Select all"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkRerun}
                disabled={bulkRerunning}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                Rerun ({selectedRunCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkArchive}
                disabled={bulkArchiving || bulkRerunning}
                className="gap-1.5"
              >
                <Archive className="h-4 w-4" />
                Archive ({selectedRunCount})
              </Button>
            </>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          {filteredRunsBySaga.length} of {totalRunsBySaga} groups
        </p>
      </div>

      {loading ? (
        <RunsListSkeleton />
      ) : filteredRunsBySaga.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <div className="flex flex-col items-center gap-2">
            <LayoutGrid className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No groups found</p>
            <p className="text-xs text-muted-foreground">
              {sagaDefinitionCount > 0
                ? `No visible runs for current filters/permissions. ${sagaDefinitionCount} saga definitions are loaded.`
                : "Try adjusting your filters"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRunsBySaga.map((group) => {
            const latest = group.latest;
            const status = runStatusMeta(latest.status);
            const StatusIcon = status.icon;
            const runPassRate = pct(latest.passedSteps, latest.totalSteps);
            const marked = isRunSelected(latest.id);
            const runStepSegments = buildRunStepSegments(latest);

            return (
              <Card
                key={group.sagaKey}
                className={`relative overflow-hidden border-l-4 cursor-pointer transition-all hover:shadow-md hover:border-l-[6px] ${runStatusAccentClass(latest.status)} ${marked ? "bg-muted/50" : ""}`}
                onClick={() => onSelectRun(latest.id)}
              >
                <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
                  <div className="flex h-full w-full">
                    {runStepSegments
                      .filter((segment) => segment.count > 0)
                      .map((segment) => (
                        <div
                          key={segment.key}
                          className={segment.className}
                          style={{
                            width: `${(segment.count / Math.max(latest.totalSteps, 1)) * 100}%`,
                          }}
                          title={`${segment.label}: ${segment.count}`}
                        />
                      ))}
                  </div>
                </div>
                <CardHeader className="pb-2 relative z-10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{group.sagaKey}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Latest: {latest.createdAt ? new Date(latest.createdAt).toLocaleString() : "Unknown"}
                      </p>
                    </div>
                    <Badge variant={status.badgeVariant} className="shrink-0">
                      <StatusIcon className={`h-3.5 w-3.5 mr-1 ${runStatusTextClass(latest.status)}`} />
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 relative z-10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Run pass rate</span>
                    <span className="font-medium">{runPassRate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Run steps</span>
                    <span className="font-medium">
                      {latest.passedSteps}/{latest.totalSteps}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Checkbox
                      checked={marked}
                      onCheckedChange={(checked) => onToggleRunSelected(latest.id, checked === true)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${group.sagaKey}`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRun(latest.id);
                      }}
                    >
                      View →
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRerunRun(latest);
                      }}
                    >
                      Run
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
