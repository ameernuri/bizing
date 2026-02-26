import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import dbPackage from "@bizing/db";
import { getSagaRunDetail } from "./sagas.js";

const { db } = dbPackage;
const sagaDefinitionLinks = dbPackage.sagaDefinitionLinks;
const sagaUseCaseVersions = dbPackage.sagaUseCaseVersions;
const sagaPersonaVersions = dbPackage.sagaPersonaVersions;

const exploratoryStatusSchema = z.enum(["passed", "failed", "blocked"]);
const exploratoryVerdictSchema = z.enum(["covered", "partial", "gap", "inconclusive"]);

const llmEvaluationSchema = z.object({
  status: exploratoryStatusSchema,
  verdict: exploratoryVerdictSchema,
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1),
  assessment: z.string().optional(),
  reasonCode: z.string().min(1),
  evidencePointers: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  deterministicFollowUps: z
    .array(
      z.object({
        title: z.string().min(1),
        endpoint: z.string().nullable().optional(),
        assertion: z.string().min(1),
      }),
    )
    .default([]),
});

export type ExploratoryStepFamily =
  | "uc-need-validation"
  | "persona-scenario-validation";

export type ExploratoryStepEvaluation = z.infer<typeof llmEvaluationSchema> & {
  evaluator: "openai" | "none";
  model: string | null;
};

export type ExploratoryEvaluatorHealth = {
  provider: "openai";
  configured: boolean;
  reachable: boolean;
  model: string;
  status: "ok" | "degraded" | "not_configured";
  detail: string;
  checkedAt: string;
};

type RunStepShape = {
  stepKey: string;
  title?: string | null;
  status: string;
  failureMessage?: string | null;
  resultPayload?: unknown;
};

function clip(text: string, max = 1200): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...(truncated)`;
}

function compactJson(value: unknown, max = 2500): string {
  try {
    const text = JSON.stringify(value ?? {});
    return clip(text, max);
  } catch {
    return clip(String(value), max);
  }
}

function summarizedStep(step: RunStepShape) {
  const resultPayload =
    step.resultPayload && typeof step.resultPayload === "object"
      ? (step.resultPayload as Record<string, unknown>)
      : {};
  return {
    stepKey: step.stepKey,
    title: step.title ?? step.stepKey,
    status: step.status,
    failureMessage: step.failureMessage ?? null,
    evidence: resultPayload.evidence ?? null,
  };
}

function fallbackBlockedEvaluation(reason: string, reasonCode: string): ExploratoryStepEvaluation {
  return {
    evaluator: "none",
    model: null,
    status: "blocked",
    verdict: "inconclusive",
    confidence: 0,
    summary: reason,
    assessment: `${reason}\n\nNo LLM assessment is available because evaluator execution was not possible.`,
    reasonCode,
    evidencePointers: [],
    gaps: [
      "No LLM evaluation was executed, so this exploratory step cannot be deterministically classified.",
    ],
    deterministicFollowUps: [
      {
        title: "Add deterministic check",
        endpoint: null,
        assertion:
          "Implement explicit endpoint + assertion contract for this exploratory requirement.",
      },
    ],
  };
}

async function callOpenAiForExploratoryEvaluation(input: {
  model: string;
  apiKey: string;
  promptContext: Record<string, unknown>;
}): Promise<ExploratoryStepEvaluation> {
  const systemPrompt = [
    "You are a strict API/schema validation judge for saga lifecycle tests.",
    "You must classify ONE exploratory step based only on the evidence provided.",
    "Do not invent endpoints, entities, or behavior not present in evidence.",
    "If evidence is insufficient, return status=blocked and verdict=inconclusive.",
    "If evidence clearly fails requirement, return status=failed and verdict=gap or partial.",
    "Return status=passed only when evidence directly supports requirement satisfaction.",
    "Provide a detailed assessment (at least 3 concise sentences) explaining how you reached the verdict.",
    "Include concrete evidencePointers when claiming pass or fail.",
    "Output valid JSON with keys exactly as requested.",
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            "Evaluate this exploratory saga step and return strict JSON.",
            "",
            compactJson(input.promptContext, 10000),
            "",
            "Required JSON shape:",
            JSON.stringify(
              {
                status: "passed|failed|blocked",
                verdict: "covered|partial|gap|inconclusive",
                confidence: 0.0,
                summary: "short explanation",
                assessment: "longer explanation with evidence reasoning",
                reasonCode: "UPPER_SNAKE_CASE_REASON",
                evidencePointers: ["string"],
                gaps: ["string"],
                deterministicFollowUps: [
                  {
                    title: "string",
                    endpoint: "/api/v1/...",
                    assertion: "string",
                  },
                ],
              },
              null,
              2,
            ),
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${clip(body, 500)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response did not include completion content.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `OpenAI returned non-JSON content: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const parsed = llmEvaluationSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `OpenAI JSON shape invalid: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }

  return {
    ...parsed.data,
    evaluator: "openai",
    model: input.model,
  };
}

function ensureLongAssessment(input: {
  summary: string;
  assessment?: string;
  verdict: "covered" | "partial" | "gap" | "inconclusive";
  confidence: number;
  evidencePointers: string[];
  gaps: string[];
  reasonCode: string;
}): string {
  const raw = String(input.assessment ?? "").trim();
  if (raw.length >= 120) return raw;

  const evidencePart =
    input.evidencePointers.length > 0
      ? `Evidence pointers: ${input.evidencePointers.join("; ")}.`
      : "No direct evidence pointers were supplied.";
  const gapsPart =
    input.gaps.length > 0
      ? `Observed gaps: ${input.gaps.join(" ")}`
      : "No explicit gaps were enumerated by the evaluator.";

  return [
    `Summary: ${input.summary}`,
    `Verdict: ${input.verdict}. Confidence: ${input.confidence}. Reason code: ${input.reasonCode}.`,
    evidencePart,
    gapsPart,
    "Interpretation: this exploratory verdict should be treated as advisory unless deterministic API assertions also support it.",
  ].join(" ");
}

function normalizeExploratoryEvaluation(
  input: ExploratoryStepEvaluation,
): ExploratoryStepEvaluation {
  let normalized: ExploratoryStepEvaluation = {
    ...input,
    assessment: ensureLongAssessment({
      summary: input.summary,
      assessment: input.assessment,
      verdict: input.verdict,
      confidence: input.confidence,
      evidencePointers: input.evidencePointers,
      gaps: input.gaps,
      reasonCode: input.reasonCode,
    }),
  };

  const hasEvidence = normalized.evidencePointers.length > 0;
  const lowConfidence = normalized.confidence < 0.55;
  const insufficientEvidenceSignal =
    normalized.verdict === "inconclusive" ||
    normalized.reasonCode.toUpperCase().includes("INSUFFICIENT") ||
    !hasEvidence;

  /**
   * Reliability guard:
   * exploratory checks cannot hard-fail with low confidence or no evidence pointers.
   * In those cases we downgrade to blocked (insufficient evidence).
   */
  if (normalized.status === "failed" && (lowConfidence || insufficientEvidenceSignal)) {
    normalized = {
      ...normalized,
      status: "blocked",
      verdict: "inconclusive",
      reasonCode: "INSUFFICIENT_EVIDENCE",
      summary:
        "Exploratory evidence is insufficient to assert a hard requirement failure.",
      assessment: ensureLongAssessment({
        summary:
          "Exploratory evidence is insufficient to assert a hard requirement failure.",
        assessment: normalized.assessment,
        verdict: "inconclusive",
        confidence: normalized.confidence,
        evidencePointers: normalized.evidencePointers,
        gaps: normalized.gaps,
        reasonCode: "INSUFFICIENT_EVIDENCE",
      }),
      deterministicFollowUps:
        normalized.deterministicFollowUps.length > 0
          ? normalized.deterministicFollowUps
          : [
              {
                title: "Add deterministic evidence contract",
                endpoint: null,
                assertion:
                  "Define concrete endpoint calls and assertions that directly verify this requirement.",
              },
            ],
    };
  }

  if (normalized.status === "passed" && (lowConfidence || !hasEvidence)) {
    normalized = {
      ...normalized,
      status: "blocked",
      verdict: "inconclusive",
      reasonCode: "INSUFFICIENT_EVIDENCE_FOR_PASS",
      summary:
        "Exploratory result cannot be accepted as pass due to low-confidence or missing direct evidence pointers.",
      assessment: ensureLongAssessment({
        summary:
          "Exploratory result cannot be accepted as pass due to low-confidence or missing direct evidence pointers.",
        assessment: normalized.assessment,
        verdict: "inconclusive",
        confidence: normalized.confidence,
        evidencePointers: normalized.evidencePointers,
        gaps: normalized.gaps,
        reasonCode: "INSUFFICIENT_EVIDENCE_FOR_PASS",
      }),
      deterministicFollowUps:
        normalized.deterministicFollowUps.length > 0
          ? normalized.deterministicFollowUps
          : [
              {
                title: "Add deterministic pass criteria",
                endpoint: null,
                assertion:
                  "Define concrete assertions that must hold before this requirement can be marked passed.",
              },
            ],
    };
  }

  return normalized;
}

/**
 * Lightweight health probe for the exploratory LLM evaluator.
 *
 * ELI5:
 * This answers "can saga exploratory validation talk to OpenAI right now?"
 * without executing a full saga step.
 */
export async function getExploratoryEvaluatorHealth(): Promise<ExploratoryEvaluatorHealth> {
  const openAiKey = process.env.OPENAI_API_KEY;
  const model =
    process.env.SAGA_EXPLORATORY_OPENAI_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini";
  const checkedAt = new Date().toISOString();

  if (!openAiKey) {
    return {
      provider: "openai",
      configured: false,
      reachable: false,
      model,
      status: "not_configured",
      detail: "OPENAI_API_KEY is not set.",
      checkedAt,
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        provider: "openai",
        configured: true,
        reachable: false,
        model,
        status: "degraded",
        detail: `OpenAI health probe failed (${response.status}): ${clip(body, 320)}`,
        checkedAt,
      };
    }

    return {
      provider: "openai",
      configured: true,
      reachable: true,
      model,
      status: "ok",
      detail: "OpenAI API reachable. Exploratory evaluator can run.",
      checkedAt,
    };
  } catch (error) {
    return {
      provider: "openai",
      configured: true,
      reachable: false,
      model,
      status: "degraded",
      detail: `OpenAI health probe error: ${
        error instanceof Error ? clip(error.message, 240) : "unknown error"
      }`,
      checkedAt,
    };
  }
}

/**
 * Evaluate one exploratory step with LLM assistance.
 *
 * ELI5:
 * Deterministic checks are ideal, but exploratory steps are natural-language
 * requirements. This evaluator turns run evidence into a strict pass/fail/
 * blocked judgment until deterministic contracts are written.
 */
export async function evaluateExploratorySagaStep(input: {
  runId: string;
  stepKey: string;
  stepFamily: ExploratoryStepFamily;
}): Promise<ExploratoryStepEvaluation> {
  const detail = await getSagaRunDetail(input.runId);
  if (!detail) {
    return fallbackBlockedEvaluation("Saga run not found for exploratory evaluation.", "RUN_NOT_FOUND");
  }

  const targetStep = detail.steps.find((step) => step.stepKey === input.stepKey);
  if (!targetStep) {
    return fallbackBlockedEvaluation("Target step not found in saga run.", "STEP_NOT_FOUND");
  }

  const targetIndex = detail.steps.findIndex((step) => step.stepKey === input.stepKey);
  const priorSteps = detail.steps
    .slice(0, Math.max(targetIndex, 0))
    .map((step) => summarizedStep(step))
    .slice(-14);

  const links = await db.query.sagaDefinitionLinks.findMany({
    where: eq(sagaDefinitionLinks.sagaDefinitionId, detail.run.sagaDefinitionId),
  });
  const useCaseVersionIds = links
    .map((row) => row.sagaUseCaseVersionId)
    .filter((id): id is string => Boolean(id));
  const personaVersionIds = links
    .map((row) => row.sagaPersonaVersionId)
    .filter((id): id is string => Boolean(id));

  const [useCaseVersions, personaVersions] = await Promise.all([
    useCaseVersionIds.length
      ? db.query.sagaUseCaseVersions.findMany({
          where: inArray(sagaUseCaseVersions.id, useCaseVersionIds),
        })
      : [],
    personaVersionIds.length
      ? db.query.sagaPersonaVersions.findMany({
          where: inArray(sagaPersonaVersions.id, personaVersionIds),
        })
      : [],
  ]);

  const openAiKey = process.env.OPENAI_API_KEY;
  const model =
    process.env.SAGA_EXPLORATORY_OPENAI_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini";

  if (!openAiKey) {
    return fallbackBlockedEvaluation(
      "OPENAI_API_KEY is missing; exploratory LLM validation cannot run.",
      "MISSING_LLM_API_KEY",
    );
  }

  const promptContext = {
    run: {
      runId: detail.run.id,
      sagaKey: detail.run.sagaKey,
      runStatus: detail.run.status,
      mode: detail.run.mode,
    },
    exploratoryStep: {
      stepKey: targetStep.stepKey,
      title: targetStep.title ?? targetStep.stepKey,
      phaseTitle: targetStep.phaseTitle,
      actorKey: targetStep.actorKey,
      instruction: targetStep.instruction,
      expectedResult: targetStep.expectedResult,
      family: input.stepFamily,
    },
    linkedUseCases: useCaseVersions.slice(0, 4).map((uc) => ({
      id: uc.id,
      versionNumber: uc.versionNumber,
      title: uc.title,
      summary: uc.summary,
      bodyMarkdownPreview: clip(uc.bodyMarkdown, 2200),
    })),
    linkedPersonas: personaVersions.slice(0, 4).map((persona) => ({
      id: persona.id,
      versionNumber: persona.versionNumber,
      name: persona.name,
      profilePreview: persona.profile ? clip(persona.profile, 900) : null,
      goalsPreview: persona.goals ? clip(persona.goals, 900) : null,
    })),
    priorStepEvidence: priorSteps,
  };

  try {
    const evaluation = await callOpenAiForExploratoryEvaluation({
      model,
      apiKey: openAiKey,
      promptContext,
    });
    return normalizeExploratoryEvaluation(evaluation);
  } catch (error) {
    return {
      ...fallbackBlockedEvaluation(
        "LLM evaluation call failed; exploratory validation cannot be conclusively scored.",
        "LLM_EVALUATION_ERROR",
      ),
      gaps: [
        `Evaluator error: ${error instanceof Error ? clip(error.message, 300) : "unknown error"}`,
      ],
    };
  }
}
