import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SagaLibraryOverview = {
  counts: {
    useCases: number;
    personas: number;
  };
};

type CurrentHealthSummary = {
  totalSagas: number;
  healthy: number;
  bad: number;
  active: number;
  currentCoveragePct: number;
  historicalCoveragePct: number;
  historicalPassed: number;
  historicalTotal: number;
};

type PlatformHealthCardsProps = {
  summary: CurrentHealthSummary;
  libraryOverview: SagaLibraryOverview | null;
};

export function PlatformHealthCards({
  summary,
  libraryOverview,
}: PlatformHealthCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Current Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{summary.currentCoveragePct}%</div>
          <p className="text-xs text-muted-foreground">
            {summary.healthy}/{summary.totalSagas} saga groups passing
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Needs Attention</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{summary.bad + summary.active}</div>
          <p className="text-xs text-muted-foreground">
            {summary.bad} failed • {summary.active} active
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Historical Pass Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{summary.historicalCoveragePct}%</div>
          <p className="text-xs text-muted-foreground">
            {summary.historicalPassed}/{summary.historicalTotal} runs passed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Loop Library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">
            {(libraryOverview?.counts.useCases ?? 0) +
              (libraryOverview?.counts.personas ?? 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            {libraryOverview?.counts.useCases ?? 0} UCs • {libraryOverview?.counts.personas ?? 0} personas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
