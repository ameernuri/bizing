/**
 * Shared embedding + chunking helpers for the canonical knowledge plane.
 *
 * ELI5:
 * - chunking turns long documents into smaller pieces we can search.
 * - embeddings convert text chunks into numeric vectors.
 * - cosine similarity compares vectors to find semantically related chunks.
 */

const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const DEFAULT_OPENAI_MODEL = process.env.KNOWLEDGE_OPENAI_EMBED_MODEL || "text-embedding-3-small";
const DEFAULT_OLLAMA_MODEL = process.env.KNOWLEDGE_OLLAMA_EMBED_MODEL || "nomic-embed-text";

export type EmbeddingProvider = "openai" | "ollama";

export type EmbeddingResult = {
  provider: EmbeddingProvider;
  model: string;
  vector: number[];
};

export type ChunkResult = {
  chunkText: string;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
  tokenEstimate: number;
};

function approximateTokenCount(input: string) {
  /**
   * ELI5:
   * Most English text is roughly 4 characters per token.
   * We use an estimate so chunking is fast and deterministic.
   */
  return Math.max(1, Math.ceil(input.length / 4));
}

function toNumberArray(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const next: number[] = [];
  for (const value of input) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) next.push(parsed);
  }
  return next;
}

function selectProvider(): EmbeddingProvider {
  const explicit = String(process.env.KNOWLEDGE_EMBED_PROVIDER || "").trim().toLowerCase();
  if (explicit === "openai") return "openai";
  if (explicit === "ollama") return "ollama";
  /**
   * Default selection:
   * - use OpenAI when API key exists
   * - otherwise use local Ollama
   */
  return process.env.OPENAI_API_KEY ? "openai" : "ollama";
}

async function embedWithOpenAI(text: string): Promise<EmbeddingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for OpenAI embeddings.");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_OPENAI_MODEL,
      input: text.slice(0, 8000),
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI embedding request failed (${response.status}).`);
  }
  const payload = (await response.json().catch(() => null)) as
    | { data?: Array<{ embedding?: number[] }> }
    | null;
  const vector = toNumberArray(payload?.data?.[0]?.embedding);
  if (vector.length === 0) {
    throw new Error("OpenAI embedding response did not include a valid vector.");
  }
  return { provider: "openai", model: DEFAULT_OPENAI_MODEL, vector };
}

async function embedWithOllama(text: string): Promise<EmbeddingResult> {
  const response = await fetch(`${DEFAULT_OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_OLLAMA_MODEL,
      prompt: text.slice(0, 4000),
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama embedding request failed (${response.status}).`);
  }
  const payload = (await response.json().catch(() => null)) as
    | { embedding?: number[] }
    | null;
  const vector = toNumberArray(payload?.embedding);
  if (vector.length === 0) {
    throw new Error("Ollama embedding response did not include a valid vector.");
  }
  return { provider: "ollama", model: DEFAULT_OLLAMA_MODEL, vector };
}

/**
 * Generate one embedding vector using configured provider selection.
 */
export async function generateKnowledgeEmbedding(text: string): Promise<EmbeddingResult> {
  const provider = selectProvider();
  if (provider === "openai") return embedWithOpenAI(text);
  return embedWithOllama(text);
}

/**
 * Generate embeddings for a batch of text chunks.
 *
 * ELI5:
 * We keep this simple and deterministic by embedding one chunk at a time.
 * That keeps provider behavior predictable across OpenAI/Ollama.
 */
export async function generateKnowledgeEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  for (const text of texts) {
    results.push(await generateKnowledgeEmbedding(text));
  }
  return results;
}

/**
 * Split one document into retrieval-friendly chunks.
 *
 * Defaults:
 * - max chunk size: 1200 chars
 * - overlap: 160 chars
 *
 * Why overlap:
 * - avoids losing context at chunk boundaries.
 */
export function chunkKnowledgeDocument(
  contentText: string,
  options?: { maxChars?: number; overlapChars?: number },
): ChunkResult[] {
  const maxChars = Math.max(300, options?.maxChars ?? 1200);
  const overlapChars = Math.max(0, Math.min(maxChars - 50, options?.overlapChars ?? 160));
  const cleaned = contentText.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const chunks: ChunkResult[] = [];
  let cursor = 0;
  let index = 0;

  while (cursor < cleaned.length) {
    const hardEnd = Math.min(cleaned.length, cursor + maxChars);
    let end = hardEnd;

    /**
     * Prefer natural breakpoints (double newline, then newline, then sentence).
     */
    if (hardEnd < cleaned.length) {
      const byParagraph = cleaned.lastIndexOf("\n\n", hardEnd);
      if (byParagraph > cursor + 200) {
        end = byParagraph;
      } else {
        const byLine = cleaned.lastIndexOf("\n", hardEnd);
        if (byLine > cursor + 200) {
          end = byLine;
        } else {
          const bySentence = cleaned.lastIndexOf(". ", hardEnd);
          if (bySentence > cursor + 180) {
            end = bySentence + 1;
          }
        }
      }
    }

    const chunkText = cleaned.slice(cursor, end).trim();
    if (chunkText.length > 0) {
      chunks.push({
        chunkText,
        chunkIndex: index,
        charStart: cursor,
        charEnd: end,
        tokenEstimate: approximateTokenCount(chunkText),
      });
      index += 1;
    }

    if (end >= cleaned.length) break;
    cursor = Math.max(end - overlapChars, cursor + 1);
  }

  return chunks;
}

/**
 * Cosine similarity between two vectors.
 *
 * Returns a value in [-1, 1], where higher means more similar.
 */
export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalize a similarity score to basis points [0..10000] for reporting.
 */
export function similarityToBps(score: number) {
  const normalized = Math.max(0, Math.min(1, (score + 1) / 2));
  return Math.round(normalized * 10000);
}

