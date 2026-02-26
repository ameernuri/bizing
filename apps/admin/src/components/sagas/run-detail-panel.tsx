"use client";

import { useState } from "react";
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  CheckCircle2,
  Mail,
  FileText,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type SagaRun = {
  id: string;
  sagaKey: string;
  status: "pending" | "running" | "passed" | "failed" | "cancelled";
  mode: "dry_run" | "live";
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  createdAt?: string;
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
  delayMode?: "none" | "fixed" | "until_condition" | string | null;
  delayMs?: number | null;
  delayConditionKey?: string | null;
  durationMs?: number;
};

type SagaArtifact = {
  id: string;
  sagaRunStepId?: string | null;
  artifactType: string;
  title: string;
  contentType: string;
  storagePath: string;
};

type SagaRunActorProfile = {
  id: string;
  actorKey: string;
  actorName: string;
  virtualEmail: string;
  virtualPhone: string;
};

type SagaRunActorMessage = {
  id: string;
  sagaRunStepId?: string | null;
  channel: "email" | "sms" | "push" | "in_app";
  status: "queued" | "sent" | "delivered" | "read" | "failed" | "cancelled";
  fromActorKey?: string | null;
  toActorKey?: string | null;
  subject?: string | null;
  bodyText: string;
  queuedAt?: string;
  deliveredAt?: string | null;
};

type SagaRunDetail = {
  run: SagaRun;
  steps: SagaStep[];
  artifacts: SagaArtifact[];
  actorProfiles?: SagaRunActorProfile[];
  actorMessages?: SagaRunActorMessage[];
};

type SagaCoverageDetail = {
  report: {
    coveragePct?: number | null;
    summary?: string | null;
  };
  items: Array<{ id: string }>;
  tags: Array<{ id: string; tagKey: string }>;
};

type DefinitionLinksDetail = {
  useCaseVersions: Array<{
    id: string;
    title: string;
    versionNumber: number;
    summary?: string | null;
    bodyMarkdown?: string | null;
  }>;
  personaVersions: Array<{
    id: string;
    name: string;
    versionNumber: number;
    profile?: string | null;
    goals?: string | null;
    bodyMarkdown?: string | null;
  }>;
  links: Array<{ id: string; relationRole: string }>;
};

type SelectedSagaGroup = {
  summary: { total: number; passed: number; failed: number; active: number };
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type PhaseStatusCounts = {
  passed: number;
  failed: number;
  blocked: number;
  inProgress: number;
  pending: number;
  skipped: number;
};

function normalizeStepStatus(status: string): string {
  return String(status || "").toLowerCase();
}

function getPhaseStatusCounts(steps: SagaStep[]): PhaseStatusCounts {
  return steps.reduce<PhaseStatusCounts>(
    (acc, step) => {
      const normalized = normalizeStepStatus(step.status);
      if (normalized === "passed") {
        acc.passed += 1;
      } else if (normalized === "failed") {
        acc.failed += 1;
      } else if (normalized === "blocked") {
        acc.blocked += 1;
      } else if (normalized === "in_progress") {
        acc.inProgress += 1;
      } else if (normalized === "skipped") {
        acc.skipped += 1;
      } else {
        acc.pending += 1;
      }
      return acc;
    },
    {
      passed: 0,
      failed: 0,
      blocked: 0,
      inProgress: 0,
      pending: 0,
      skipped: 0,
    },
  );
}

function stepStatusToneClasses(status: string): string {
  const normalized = normalizeStepStatus(status);
  if (normalized === "passed") return "border-l-4 border-l-emerald-500/80";
  if (normalized === "failed" || normalized === "blocked")
    return "border-l-4 border-l-destructive";
  if (normalized === "skipped") return "border-l-4 border-l-slate-400";
  if (normalized === "in_progress") return "border-l-4 border-l-blue-500";
  return "border-l-4 border-l-amber-500";
}

function statusNarration(status: string): string {
  const normalized = normalizeStepStatus(status);
  if (normalized === "passed") return "completed successfully";
  if (normalized === "failed") return "failed";
  if (normalized === "blocked") return "was blocked";
  if (normalized === "skipped") return "was skipped";
  if (normalized === "in_progress") return "is in progress";
  return "is pending";
}

function channelIcon(channel: SagaRunActorMessage["channel"]) {
  if (channel === "sms") return Smartphone;
  if (channel === "email") return Mail;
  if (channel === "push") return Bot;
  return MessageSquareText;
}

function stepReasonCode(step: SagaStep): string | null {
  const evidence = ((step.resultPayload ?? {}) as Record<string, unknown>).evidence;
  if (evidence && typeof evidence === "object" && evidence !== null) {
    const code = (evidence as Record<string, unknown>).reasonCode;
    if (typeof code === "string" && code.trim().length > 0) return code;
  }
  return null;
}

function stepExploratoryGap(step: SagaStep): string | null {
  const evidence = ((step.resultPayload ?? {}) as Record<string, unknown>).evidence;
  if (!evidence || typeof evidence !== "object") return null;
  const gaps = (evidence as Record<string, unknown>).gaps;
  if (!Array.isArray(gaps)) return null;
  const firstGap = gaps.find((item) => typeof item === "string");
  return typeof firstGap === "string" ? firstGap : null;
}

function stepExploratoryAssessment(step: SagaStep): string | null {
  const evidence = ((step.resultPayload ?? {}) as Record<string, unknown>).evidence;
  if (!evidence || typeof evidence !== "object") return null;
  const assessment = (evidence as Record<string, unknown>).assessment;
  if (typeof assessment !== "string") return null;
  const text = assessment.trim();
  return text.length > 0 ? text : null;
}

function isExploratoryStep(step: SagaStep): boolean {
  return (
    step.stepKey.startsWith("uc-need-validate-") ||
    step.stepKey.startsWith("persona-scenario-validate-")
  );
}

function shortText(value: string | null | undefined, max = 420): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}...`;
}

type RunDetailPanelProps = {
  detail: SagaRunDetail;
  error: string | null;
  selectedSagaGroup: SelectedSagaGroup | null;
  successRate: number;
  triageSteps: SagaStep[];
  coverageDetail: SagaCoverageDetail | null;
  definitionLinksDetail: DefinitionLinksDetail | null;
  groupedSteps: Record<string, SagaStep[]>;
  expandedPhases: Set<string>;
  onTogglePhase: (phase: string) => void;
  searchText: string;
  getArtifactsForStep: (stepId: string) => SagaArtifact[];
  onOpenStepDialog: (step: SagaStep) => Promise<void> | void;
  onOpenArtifactDialog: (runId: string, artifact: SagaArtifact) => Promise<void> | void;
  safeArtifactTitle: (artifact: SagaArtifact) => string;
  formatDuration: (ms?: number) => string;
  pct: (numerator: number, denominator: number) => number;
  stepStatusMeta: (status: string) => {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    badgeVariant: BadgeVariant;
  };
  stepStatusAccentClass: (status: string) => string;
  stepStatusTextClass: (status: string) => string;
  messageComposeToActorKey: string;
  onMessageComposeToActorKeyChange: (value: string) => void;
  messageComposeChannel: "email" | "sms" | "push" | "in_app";
  onMessageComposeChannelChange: (value: "email" | "sms" | "push" | "in_app") => void;
  messageComposeSubject: string;
  onMessageComposeSubjectChange: (value: string) => void;
  messageComposeBody: string;
  onMessageComposeBodyChange: (value: string) => void;
  messageSending: boolean;
  onSendVirtualMessage: () => Promise<void> | void;
};

export function RunDetailPanel({
  detail,
  error,
  selectedSagaGroup,
  successRate,
  triageSteps,
  coverageDetail,
  definitionLinksDetail,
  groupedSteps,
  expandedPhases,
  onTogglePhase,
  searchText,
  getArtifactsForStep,
  onOpenStepDialog,
  onOpenArtifactDialog,
  safeArtifactTitle,
  formatDuration,
  pct,
  stepStatusMeta,
  stepStatusAccentClass,
  stepStatusTextClass,
  messageComposeToActorKey,
  onMessageComposeToActorKeyChange,
  messageComposeChannel,
  onMessageComposeChannelChange,
  messageComposeSubject,
  onMessageComposeSubjectChange,
  messageComposeBody,
  onMessageComposeBodyChange,
  messageSending,
  onSendVirtualMessage,
}: RunDetailPanelProps) {
  const [linkedDocOpen, setLinkedDocOpen] = useState(false);
  const [linkedDocTitle, setLinkedDocTitle] = useState("");
  const [linkedDocSections, setLinkedDocSections] = useState<
    Array<{ label: string; value: string }>
  >([]);

  function openLinkedDoc(input: {
    title: string;
    sections: Array<{ label: string; value: string | null | undefined }>;
  }) {
    const normalizedSections = input.sections
      .map((section) => ({
        label: section.label,
        value: String(section.value ?? "").trim(),
      }))
      .filter((section) => section.value.length > 0);
    setLinkedDocTitle(input.title);
    setLinkedDocSections(normalizedSections);
    setLinkedDocOpen(true);
  }

  const stepOrder = new Map<string, number>();
  detail.steps.forEach((step, index) => {
    stepOrder.set(step.id, index);
  });

  const messagesByStep = new Map<string, SagaRunActorMessage[]>();
  const unlinkedMessages: SagaRunActorMessage[] = [];
  for (const message of detail.actorMessages ?? []) {
    const stepId = message.sagaRunStepId || null;
    if (stepId && stepOrder.has(stepId)) {
      const group = messagesByStep.get(stepId) ?? [];
      group.push(message);
      messagesByStep.set(stepId, group);
    } else {
      unlinkedMessages.push(message);
    }
  }

  const firstBreak = detail.steps.find(
    (step) =>
      normalizeStepStatus(step.status) === "failed" ||
      normalizeStepStatus(step.status) === "blocked",
  );
  const exploratorySteps = detail.steps.filter((step) => isExploratoryStep(step));
  const exploratoryBlocked = exploratorySteps.filter(
    (step) => normalizeStepStatus(step.status) === "blocked",
  );
  const exploratoryPassed = exploratorySteps.filter(
    (step) => normalizeStepStatus(step.status) === "passed",
  );

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {selectedSagaGroup ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Saga Group Health</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Coverage</p>
                <p className="font-semibold">
                  {pct(selectedSagaGroup.summary.passed, selectedSagaGroup.summary.total)}%
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Runs</p>
                <p className="font-semibold">{selectedSagaGroup.summary.total}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Failed</p>
                <p className="font-semibold">{selectedSagaGroup.summary.failed}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Active</p>
                <p className="font-semibold">{selectedSagaGroup.summary.active}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {definitionLinksDetail?.useCaseVersions?.length ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Use Case Under Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Use Cases
                </p>
                <div className="space-y-3">
                  {definitionLinksDetail.useCaseVersions.slice(0, 3).map((uc, index) => {
                    const text = shortText(uc.summary || uc.bodyMarkdown || "", 520);
                    return (
                      <div key={uc.id} className={index > 0 ? "border-t pt-3" : ""}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            v{uc.versionNumber} {uc.title}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7"
                            onClick={() =>
                              openLinkedDoc({
                                title: `Use Case v${uc.versionNumber} • ${uc.title}`,
                                sections: [
                                  { label: "Summary", value: uc.summary },
                                  { label: "Body", value: uc.bodyMarkdown },
                                ],
                              })
                            }
                          >
                            Open
                          </Button>
                        </div>
                        {text ? (
                          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                            {text}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            No use-case body text found for this linked version.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {definitionLinksDetail.personaVersions.length > 0 ? (
                <div className="border-t pt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Personas
                  </p>
                  <div className="space-y-2">
                    {definitionLinksDetail.personaVersions.slice(0, 4).map((persona) => (
                      <div
                        key={persona.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <p className="text-sm">
                          <span className="font-medium">v{persona.versionNumber}</span>{" "}
                          {persona.name}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() =>
                            openLinkedDoc({
                              title: `Persona v${persona.versionNumber} • ${persona.name}`,
                              sections: [
                                { label: "Profile", value: persona.profile },
                                { label: "Goals", value: persona.goals },
                                { label: "Body", value: persona.bodyMarkdown },
                              ],
                            })
                          }
                        >
                          Open
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : definitionLinksDetail?.personaVersions?.length ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Persona Under Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {definitionLinksDetail.personaVersions.slice(0, 4).map((persona, index) => (
                <p
                  key={persona.id}
                  className={`text-sm ${index > 0 ? "border-t pt-2" : ""}`}
                >
                  <span className="font-medium">v{persona.versionNumber}</span> {persona.name}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Story Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-card p-3 text-sm">
              <p>
                This run has {detail.steps.length} steps. It currently{" "}
                <span className="font-medium capitalize">{detail.run.status}</span> with{" "}
                <span className="font-medium">{detail.run.passedSteps}</span> passed and{" "}
                <span className="font-medium">{detail.run.failedSteps}</span> failed.
              </p>
              {exploratorySteps.length > 0 ? (
                <p className="mt-2 text-muted-foreground">
                  Exploratory checks: {exploratoryPassed.length} passed,{" "}
                  {exploratoryBlocked.length} blocked. Look for each step&apos;s{" "}
                  <span className="font-medium">reason code</span> to see if it was
                  LLM-evaluated or missing evaluator support.
                </p>
              ) : null}
              {firstBreak ? (
                <p className="mt-2 text-muted-foreground">
                  First break: <span className="font-medium">{firstBreak.title || firstBreak.stepKey}</span>{" "}
                  ({firstBreak.actorKey}) {statusNarration(firstBreak.status)}
                  {firstBreak.failureMessage ? ` — ${firstBreak.failureMessage}` : "."}
                </p>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  No failures or blocks detected in this run.
                </p>
              )}
            </div>

            <div className="space-y-3">
              {detail.steps.map((step, index) => {
                const status = stepStatusMeta(step.status);
                const StatusIcon = status.icon;
                const reasonCode = stepReasonCode(step);
                const exploratoryGap = stepExploratoryGap(step);
                const exploratoryAssessment = stepExploratoryAssessment(step);
                const exploratory = isExploratoryStep(step);
                const llmEvaluated = reasonCode !== "MISSING_DETERMINISTIC_EXECUTOR_CONTRACT" &&
                  reasonCode !== "DETERMINISTIC_RUNNER_SKIPS_EXPLORATORY_STEP" &&
                  reasonCode !== null;
                const stepArtifacts = getArtifactsForStep(step.id);
                const snapshotArtifacts = stepArtifacts.filter(
                  (artifact) =>
                    artifact.artifactType === "snapshot" ||
                    artifact.artifactType === "pseudoshot",
                );
                const messages = messagesByStep.get(step.id) ?? [];
                const orderLabel = String(index + 1).padStart(2, "0");

                return (
                  <div
                    key={step.id}
                    className={`rounded-lg border bg-card p-3 space-y-3 ${stepStatusToneClasses(step.status)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            Step {orderLabel}
                          </Badge>
                          <p className="text-sm font-medium truncate">
                            {step.title || step.stepKey}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {step.phaseTitle} • {step.actorKey}
                        </p>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {exploratory ? "Exploratory" : "Deterministic"}
                          </Badge>
                          {exploratory ? (
                            <Badge variant="outline" className="text-[10px]">
                              {llmEvaluated ? "LLM Evaluated" : "No LLM Contract"}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <Badge variant={status.badgeVariant} className="shrink-0">
                        <StatusIcon className={`h-3.5 w-3.5 mr-1 ${stepStatusTextClass(step.status)}`} />
                        {status.label}
                      </Badge>
                    </div>

                    <div className="grid gap-2 text-sm md:grid-cols-2">
                      <div className="rounded-md border bg-background/70 p-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          What happened
                        </p>
                        <p>{step.instruction}</p>
                      </div>
                      <div className="rounded-md border bg-background/70 p-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                          Expected
                        </p>
                        <p>{step.expectedResult || "No explicit expected result in saga definition."}</p>
                      </div>
                    </div>

                    <div className="rounded-md border bg-background/70 p-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                        Outcome
                      </p>
                      <div className="flex items-start gap-2">
                        {normalizeStepStatus(step.status) === "passed" ? (
                          <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                        ) : normalizeStepStatus(step.status) === "failed" ||
                          normalizeStepStatus(step.status) === "blocked" ? (
                          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
                        ) : normalizeStepStatus(step.status) === "in_progress" ? (
                          <Clock3 className="h-4 w-4 mt-0.5 text-blue-600" />
                        ) : (
                          <CircleDot className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        )}
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm">
                            {step.actorKey} {statusNarration(step.status)}.
                          </p>
                          {step.failureMessage ? (
                            <p className="text-xs text-destructive">{step.failureMessage}</p>
                          ) : null}
                          {reasonCode ? (
                            <p className="text-[11px] text-muted-foreground">
                              reason: {reasonCode}
                            </p>
                          ) : null}
                          {exploratoryGap ? (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              detail: {exploratoryGap}
                            </p>
                          ) : null}
                          {exploratoryAssessment ? (
                            <p className="text-[11px] text-muted-foreground line-clamp-4">
                              assessment: {exploratoryAssessment}
                            </p>
                          ) : null}
                          {step.durationMs ? (
                            <p className="text-xs text-muted-foreground">
                              Completed in {formatDuration(step.durationMs)}.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {messages.length > 0 ? (
                      <div className="rounded-md border bg-background/70 p-2 space-y-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Messages received
                        </p>
                        <div className="space-y-1.5">
                          {messages.map((message) => {
                            const Icon = channelIcon(message.channel);
                            return (
                              <div
                                key={message.id}
                                className="rounded border bg-muted/30 px-2 py-1.5 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium flex items-center gap-1">
                                    <Icon className="h-3.5 w-3.5" />
                                    {message.channel} • {message.status}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {message.queuedAt
                                      ? new Date(message.queuedAt).toLocaleString()
                                      : ""}
                                  </p>
                                </div>
                                <p className="text-muted-foreground">
                                  {message.fromActorKey || "system"} → {message.toActorKey || "unknown"}
                                </p>
                                {message.subject ? <p className="mt-1">{message.subject}</p> : null}
                                <p className="mt-1 line-clamp-3">{message.bodyText}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onOpenStepDialog(step)}
                      >
                        Open Step Detail
                      </Button>
                      {snapshotArtifacts.slice(0, 2).map((artifact) => (
                        <Button
                          key={artifact.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onOpenArtifactDialog(detail.run.id, artifact)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          View Screen
                        </Button>
                      ))}
                      {stepArtifacts.length > snapshotArtifacts.length ? (
                        <Badge variant="outline">
                          {stepArtifacts.length - snapshotArtifacts.length} more artifact
                          {stepArtifacts.length - snapshotArtifacts.length === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {unlinkedMessages.length > 0 ? (
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Run-level messages (not tied to a specific step)
                </p>
                <div className="space-y-1.5">
                  {unlinkedMessages.slice(0, 10).map((message) => {
                    const Icon = channelIcon(message.channel);
                    return (
                      <div key={message.id} className="rounded border bg-background px-2 py-1.5 text-xs">
                        <p className="font-medium flex items-center gap-1">
                          <Icon className="h-3.5 w-3.5" />
                          {message.channel} • {message.status}
                        </p>
                        <p className="text-muted-foreground">
                          {message.fromActorKey || "system"} → {message.toActorKey || "unknown"}
                        </p>
                        <p className="mt-1 line-clamp-2">{message.bodyText}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Run Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{detail.run.status}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Success Rate</span>
              <span className="font-medium">{successRate}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Steps</span>
              <span className="font-medium">
                {detail.run.passedSteps}/{detail.run.totalSteps} passed
                {detail.run.failedSteps > 0 ? ` • ${detail.run.failedSteps} failed` : ""}
                {detail.run.skippedSteps > 0 ? ` • ${detail.run.skippedSteps} skipped` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Started</span>
              <span className="font-medium">
                {detail.run.createdAt ? new Date(detail.run.createdAt).toLocaleString() : "Unknown"}
              </span>
            </div>
          </CardContent>
        </Card>

        {triageSteps.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Failure Triage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Failed or blocked steps in this run: {triageSteps.length}
              </div>
              <div className="space-y-2">
                {triageSteps.slice(0, 8).map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    className="w-full rounded-md border p-2 text-left hover:bg-muted/50"
                    onClick={() => void onOpenStepDialog(step)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{step.title || step.stepKey}</p>
                      <Badge variant="outline" className="shrink-0">
                        <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                        {step.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {step.failureMessage || "No failure message recorded."}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Coverage Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {coverageDetail ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Coverage</span>
                  <span className="font-medium">{coverageDetail.report.coveragePct ?? 0}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Summary</span>
                  <span className="font-medium truncate max-w-[70%] text-right">
                    {coverageDetail.report.summary || "No summary"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {coverageDetail.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline">
                      {tag.tagKey}
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">{coverageDetail.items.length} coverage items</div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Coverage report will appear here once the run is scored.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Linked Design Artifacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {definitionLinksDetail ? (
              <>
                <div className="text-xs text-muted-foreground">
                  This saga definition is linked to normalized UC/persona versions.
                </div>
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Use Cases</p>
                    <p className="font-semibold">{definitionLinksDetail.useCaseVersions.length}</p>
                    <div className="mt-2 space-y-1">
                      {definitionLinksDetail.useCaseVersions.slice(0, 4).map((row) => (
                        <p key={row.id} className="text-xs truncate">
                          v{row.versionNumber} {row.title}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Personas</p>
                    <p className="font-semibold">{definitionLinksDetail.personaVersions.length}</p>
                    <div className="mt-2 space-y-1">
                      {definitionLinksDetail.personaVersions.slice(0, 4).map((row) => (
                        <p key={row.id} className="text-xs truncate">
                          v{row.versionNumber} {row.name}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {definitionLinksDetail.links.slice(0, 12).map((link) => (
                    <Badge key={link.id} variant="outline">
                      {link.relationRole}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Link metadata is not available for this run yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Virtual Actors & Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground mb-2">Actor Identities</p>
                {detail.actorProfiles && detail.actorProfiles.length > 0 ? (
                  <div className="space-y-2">
                    {detail.actorProfiles.map((actor) => (
                      <div key={actor.id} className="rounded border p-2">
                        <p className="text-sm font-medium">
                          {actor.actorKey} • {actor.actorName}
                        </p>
                        <p className="text-xs text-muted-foreground">{actor.virtualEmail}</p>
                        <p className="text-xs text-muted-foreground">{actor.virtualPhone}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No actor identities found.</p>
                )}
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs text-muted-foreground mb-1">Send Simulated Message</p>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={messageComposeToActorKey}
                  onChange={(event) => onMessageComposeToActorKeyChange(event.target.value)}
                >
                  <option value="">Select recipient actor</option>
                  {(detail.actorProfiles ?? []).map((actor) => (
                    <option key={actor.id} value={actor.actorKey}>
                      {actor.actorKey} ({actor.actorName})
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={messageComposeChannel}
                  onChange={(event) =>
                    onMessageComposeChannelChange(
                      event.target.value as "email" | "sms" | "push" | "in_app",
                    )
                  }
                >
                  <option value="email">email</option>
                  <option value="sms">sms</option>
                  <option value="push">push</option>
                  <option value="in_app">in_app</option>
                </select>
                <input
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={messageComposeSubject}
                  onChange={(event) => onMessageComposeSubjectChange(event.target.value)}
                  placeholder="Subject (optional)"
                />
                <textarea
                  className="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={messageComposeBody}
                  onChange={(event) => onMessageComposeBodyChange(event.target.value)}
                  placeholder="Message body"
                />
                <Button
                  size="sm"
                  onClick={() => void onSendVirtualMessage()}
                  disabled={messageSending || !messageComposeToActorKey || !messageComposeBody.trim()}
                >
                  {messageSending ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                  Send Message
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <div className="border-b px-3 py-2 text-xs text-muted-foreground">Message Timeline</div>
              <ScrollArea className="max-h-52">
                {detail.actorMessages && detail.actorMessages.length > 0 ? (
                  <div className="divide-y">
                    {detail.actorMessages.map((message) => (
                      <div key={message.id} className="p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">
                            {message.channel} • {message.status}
                          </p>
                          <p className="text-muted-foreground">
                            {message.queuedAt ? new Date(message.queuedAt).toLocaleString() : ""}
                          </p>
                        </div>
                        <p className="text-muted-foreground">
                          {message.fromActorKey || "system"} → {message.toActorKey || "unknown"}
                        </p>
                        {message.subject ? <p className="mt-1">{message.subject}</p> : null}
                        <p className="text-muted-foreground mt-1 line-clamp-2">{message.bodyText}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-3 text-sm text-muted-foreground">No simulated messages in this run yet.</p>
                )}
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step Matrix (Debug)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(groupedSteps).length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center">
                No steps match the current search.
              </div>
            ) : null}

            {Object.entries(groupedSteps).map(([phase, steps]) => {
              const isExpanded = expandedPhases.has(phase);
              const phasePassed = steps.filter((step) => step.status === "passed").length;
              const phaseStatusCounts = getPhaseStatusCounts(steps);
              const phaseTotal = Math.max(steps.length, 1);
              return (
                <Collapsible key={phase} open={isExpanded} onOpenChange={() => onTogglePhase(phase)}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="relative overflow-hidden w-full rounded-md border px-3 py-2 text-left">
                      <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
                        <div className="flex h-full w-full">
                          {phaseStatusCounts.passed > 0 ? (
                            <div
                              className="bg-emerald-500"
                              style={{ width: `${(phaseStatusCounts.passed / phaseTotal) * 100}%` }}
                              title={`Passed: ${phaseStatusCounts.passed}`}
                            />
                          ) : null}
                          {phaseStatusCounts.failed > 0 ? (
                            <div
                              className="bg-red-500"
                              style={{ width: `${(phaseStatusCounts.failed / phaseTotal) * 100}%` }}
                              title={`Failed: ${phaseStatusCounts.failed}`}
                            />
                          ) : null}
                          {phaseStatusCounts.blocked > 0 ? (
                            <div
                              className="bg-orange-500"
                              style={{ width: `${(phaseStatusCounts.blocked / phaseTotal) * 100}%` }}
                              title={`Blocked: ${phaseStatusCounts.blocked}`}
                            />
                          ) : null}
                          {phaseStatusCounts.inProgress > 0 ? (
                            <div
                              className="bg-blue-500"
                              style={{ width: `${(phaseStatusCounts.inProgress / phaseTotal) * 100}%` }}
                              title={`In progress: ${phaseStatusCounts.inProgress}`}
                            />
                          ) : null}
                          {phaseStatusCounts.pending > 0 ? (
                            <div
                              className="bg-amber-500"
                              style={{ width: `${(phaseStatusCounts.pending / phaseTotal) * 100}%` }}
                              title={`Pending: ${phaseStatusCounts.pending}`}
                            />
                          ) : null}
                          {phaseStatusCounts.skipped > 0 ? (
                            <div
                              className="bg-slate-400"
                              style={{ width: `${(phaseStatusCounts.skipped / phaseTotal) * 100}%` }}
                              title={`Skipped: ${phaseStatusCounts.skipped}`}
                            />
                          ) : null}
                        </div>
                      </div>
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium truncate">{phase}</span>
                        </div>
                        <Badge variant="outline">
                          {phasePassed}/{steps.length}
                        </Badge>
                      </div>
                      <div className="relative z-10 mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>P {phaseStatusCounts.passed}</span>
                        <span>F {phaseStatusCounts.failed}</span>
                        <span>B {phaseStatusCounts.blocked}</span>
                        <span>R {phaseStatusCounts.inProgress}</span>
                        <span>Q {phaseStatusCounts.pending}</span>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pt-2 pl-3 space-y-1">
                      {steps.map((step) => {
                        const status = stepStatusMeta(step.status);
                        const StatusIcon = status.icon;
                        const artifacts = getArtifactsForStep(step.id);
                        const artifactQuery = searchText.trim().toLowerCase();
                        const visibleArtifacts = artifactQuery
                          ? artifacts.filter((artifact) => {
                              const title = safeArtifactTitle(artifact).toLowerCase();
                              const type = (artifact.artifactType || "").toLowerCase();
                              const id = artifact.id.toLowerCase();
                              return (
                                title.includes(artifactQuery) ||
                                type.includes(artifactQuery) ||
                                id.includes(artifactQuery)
                              );
                            })
                          : artifacts;

                        return (
                          <div key={step.id} className={`rounded-md border border-l-4 p-2 space-y-2 ${stepStatusAccentClass(step.status)}`}>
                            <button
                              type="button"
                              className="w-full flex items-center justify-between gap-2 text-left"
                              onClick={() => void onOpenStepDialog(step)}
                            >
                              <div className="min-w-0 flex items-center gap-2">
                                <StatusIcon className={`h-4 w-4 shrink-0 ${stepStatusTextClass(step.status)}`} />
                                <span className="text-sm truncate">{step.title || step.stepKey}</span>
                                <Badge variant="outline" className="text-[10px]">
                                  {step.actorKey}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {step.delayMode && step.delayMode !== "none" ? (
                                  <Badge variant="outline">
                                    {step.delayMode === "fixed"
                                      ? `wait ${step.delayMs ?? 0}ms`
                                      : `wait ${step.delayConditionKey ?? "condition"}`}
                                  </Badge>
                                ) : null}
                                {step.durationMs ? (
                                  <span className="text-xs text-muted-foreground">
                                    {formatDuration(step.durationMs)}
                                  </span>
                                ) : null}
                                <Badge variant={status.badgeVariant}>{status.label}</Badge>
                              </div>
                            </button>

                            {visibleArtifacts.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {visibleArtifacts.map((artifact) => (
                                  <Button
                                    key={artifact.id}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7"
                                    onClick={() => void onOpenArtifactDialog(detail.run.id, artifact)}
                                  >
                                    <FileText className="h-3.5 w-3.5 mr-1" />
                                    {artifact.artifactType === "snapshot" || artifact.artifactType === "pseudoshot"
                                      ? "Screenshot"
                                      : artifact.artifactType}
                                  </Button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>

        <Dialog open={linkedDocOpen} onOpenChange={setLinkedDocOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>{linkedDocTitle}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-2">
              {linkedDocSections.length > 0 ? (
                <div className="space-y-4">
                  {linkedDocSections.map((section, index) => (
                    <div key={`${section.label}-${index}`} className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {section.label}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{section.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No detailed content is available for this linked version yet.
                </p>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
