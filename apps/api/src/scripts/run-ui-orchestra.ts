import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

type MoonshotModel = {
  id: string;
};

type MoonshotModelsResponse = {
  data?: MoonshotModel[];
};

type MoonshotChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../../");
const execFileAsync = promisify(execFile);
const transport = (process.env.KIMI_TRANSPORT ?? "claude").toLowerCase();

const storyFile = path.resolve(
  rootDir,
  process.env.STORY_FILE ??
    "testing/ui-orchestra/stories/uc-1-sarah-first-sale.story.md",
);
const systemPromptFile = path.resolve(
  rootDir,
  "testing/ui-orchestra/prompts/kimi-ui-frontmatter.system.md",
);
const outputDir = path.resolve(
  rootDir,
  process.env.KIMI_OUTPUT_DIR ?? "testing/ui-orchestra/generated",
);
const baseUrl = (
  process.env.KIMI_BASE_URL ??
  (transport === "claude"
    ? "https://api.kimi.com/coding/"
    : "https://api.kimi.com/coding/v1")
).replace(/\/+$/, transport === "claude" ? "/" : "");
const apiKey = process.env.KIMI_API_KEY ?? process.env.MOONSHOT_API_KEY ?? "";
const dryRun = ["1", "true", "yes"].includes(
  (process.env.KIMI_DRY_RUN ?? "").toLowerCase(),
);

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function safeName(input: string) {
  return input
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function shellQuote(input: string) {
  return `'${input.replace(/'/g, `'\\''`)}'`;
}

async function requestMoonshot<T>(
  pathname: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Moonshot request failed (${response.status}): ${body || response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

async function resolveModel() {
  if (process.env.KIMI_MODEL?.trim()) return process.env.KIMI_MODEL.trim();

  if (transport === "claude") return "kimi-for-coding";

  const payload = await requestMoonshot<MoonshotModelsResponse>("/models", {
    method: "GET",
  });

  const ids = (payload.data ?? []).map((row) => row.id);
  const preferred = [
    "kimi-for-coding",
    "kimi-k2-thinking",
    "kimi-k2-thinking-turbo",
    "kimi-k2",
    "kimi-k2-5",
    "moonshot-v1-128k",
  ];

  for (const candidate of preferred) {
    const exact = ids.find((id) => id === candidate);
    if (exact) return exact;
    const partial = ids.find((id) => id.toLowerCase().includes(candidate));
    if (partial) return partial;
  }

  if (ids[0]) return ids[0];
  throw new Error("No Moonshot models were returned from /models.");
}

async function runWithClaudeBridge(input: {
  systemPromptFile: string;
  userPromptFile: string;
  model: string;
}) {
  const shell = process.env.SHELL || "zsh";
  const command = [
    `ANTHROPIC_BASE_URL=${shellQuote(baseUrl)}`,
    `ANTHROPIC_API_KEY=${shellQuote(apiKey)}`,
    "claude",
    "--print",
    "--output-format",
    "text",
    "--no-session-persistence",
    "--tools",
    "''",
    "--model",
    shellQuote(input.model),
    "--system-prompt",
    `"$(cat ${shellQuote(input.systemPromptFile)})"`,
    `"$(cat ${shellQuote(input.userPromptFile)})"`,
  ].join(" ");

  const { stdout } = await execFileAsync(shell, ["-lc", command], {
    cwd: rootDir,
    maxBuffer: 20 * 1024 * 1024,
  });

  const content = stdout.trim();
  if (!content) {
    throw new Error("Claude bridge returned no message content.");
  }
  return content;
}

async function run() {
  if (!dryRun && !apiKey) {
    throw new Error(
      "Set KIMI_API_KEY or MOONSHOT_API_KEY before running UI Orchestra.",
    );
  }

  const [story, systemPrompt] = await Promise.all([
    readFile(storyFile, "utf8"),
    readFile(systemPromptFile, "utf8"),
  ]);

  const model = dryRun
    ? process.env.KIMI_MODEL?.trim() || "kimi-for-coding"
    : await resolveModel();
  const storyBaseName = safeName(
    path.basename(storyFile, path.extname(storyFile)),
  );
  const runStamp = stamp();
  const runDir = path.join(outputDir, `${runStamp}-${storyBaseName}`);

  await mkdir(runDir, { recursive: true });

  const userPrompt = [
    "Convert the following Bizing UX story into implementation-ready UI front matter.",
    "The output must stay faithful to the story and current audience separation.",
    "Write for product designers and frontend implementers.",
    "",
    "Story begins below.",
    "",
    story,
  ].join("\n");

  const requestBody = {
    model,
    temperature: 0.7,
    max_tokens: 12000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  await Promise.all([
    writeFile(path.join(runDir, "story.md"), story, "utf8"),
    writeFile(path.join(runDir, "system-prompt.md"), systemPrompt, "utf8"),
    writeFile(path.join(runDir, "user-prompt.md"), userPrompt, "utf8"),
    writeFile(
      path.join(runDir, "request.json"),
      JSON.stringify(
        {
          storyFile: path.relative(rootDir, storyFile),
          model,
          baseUrl,
          dryRun,
          transport,
          generatedAt: new Date().toISOString(),
          requestBody,
        },
        null,
        2,
      ),
      "utf8",
    ),
  ]);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          model,
          storyFile: path.relative(rootDir, storyFile),
          runDir,
          promptFile: path.join(runDir, "user-prompt.md"),
        },
        null,
        2,
      ),
    );
    return;
  }

  let content = "";
  if (transport === "claude") {
    content = await runWithClaudeBridge({
      systemPromptFile: path.join(runDir, "system-prompt.md"),
      userPromptFile: path.join(runDir, "user-prompt.md"),
      model,
    });
  } else if (transport === "raw") {
    const response = await requestMoonshot<MoonshotChatResponse>(
      "/chat/completions",
      {
        method: "POST",
        body: JSON.stringify(requestBody),
      },
    );
    content = response.choices?.[0]?.message?.content?.trim() ?? "";
  } else {
    throw new Error("Unsupported KIMI_TRANSPORT value.");
  }

  if (!content) {
    throw new Error("Kimi returned no message content.");
  }

  await writeFile(path.join(runDir, "frontmatter.md"), content, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        model,
        storyFile: path.relative(rootDir, storyFile),
        runDir,
        outputFile: path.join(runDir, "frontmatter.md"),
      },
      null,
      2,
    ),
  );
}

void run();
