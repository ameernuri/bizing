import { getCachedBrainSummary, formatBrainForPrompt } from './brain-loader.js'
import { getCompactMindState, getMindFile } from './mind-api.js'
import { getCachedMindMap, discoverMindMap, searchMindDynamic, findPathTo, getRelatedFiles, getMindStructure, listAllFiles, exploreDirectory } from './mind-map.js'
import { semanticSearch, isEmbeddingsReady } from './mind-embeddings.js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Read MAP.md content for system prompt
function getMapContent(): string {
  try {
    const mindDir = join(process.cwd(), '..', '..', 'mind')
    return readFileSync(join(mindDir, 'MAP.md'), 'utf-8').slice(0, 4000) // First 4000 chars
  } catch {
    return 'MAP.md not available'
  }
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  enableFunctions?: boolean;
}

// LLM Provider Configuration
type Provider = "openai" | "kimi";

interface ProviderConfig {
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

// Dynamic, self-discovering mind functions
const MIND_FUNCTIONS = [
  {
    name: "semanticSearch",
    description: "SEMANTIC SEARCH - Most powerful search! Finds relevant content even when keywords don't match. Uses AI embeddings to understand meaning.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Natural language query - describe what you're looking for"
        },
        topK: {
          type: "number",
          description: "Number of results (default 5)",
          default: 5
        }
      },
      required: ["query"] as string[]
    }
  },
  {
    name: "getMindState",
    description: "Get compact summary of current mind state: focus, tasks, blockers, learnings, status",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: "getMindFile",
    description: "Read full content of any mind file by path (e.g., 'symbiosis/standup.md', 'GOALS.md')",
    parameters: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to mind/ directory"
        }
      },
      required: ["path"] as string[]
    }
  },
  {
    name: "discoverMindMap",
    description: "DISCOVER complete mind structure. Returns ALL files (not just linked ones), directories, and their relationships. This is the master discovery function.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: "listAllFiles",
    description: "List EVERY file in the mind with title, description, and connection count. Use this to get a complete inventory.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [] as string[]
    }
  },
  {
    name: "exploreDirectory",
    description: "Explore a specific directory in the mind. Shows files in that directory and subdirectories.",
    parameters: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Directory path to explore (e.g., 'knowledge/tech', 'symbiosis'). Use empty string for root."
        }
      },
      required: [] as string[]
    }
  },
  {
    name: "searchMind",
    description: "SEARCH entire mind for any topic/keyword. Returns ranked results from ALL files with relevance scores.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term - any topic, concept, or keyword"
        }
      },
      required: ["query"] as string[]
    }
  },
  {
    name: "findPath",
    description: "Find navigation path from INDEX.md to any target file. Shows connection chain through wikilinks.",
    parameters: {
      type: "object" as const,
      properties: {
        target: {
          type: "string",
          description: "Target file path to navigate to"
        }
      },
      required: ["target"] as string[]
    }
  },
  {
    name: "getRelatedFiles",
    description: "Get files related to a given file (links to and from). Useful for exploring context.",
    parameters: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path to find relationships for"
        }
      },
      required: ["path"] as string[]
    }
  },
  {
    name: "getMindStructure",
    description: "Get high-level mind overview: total files, directories, entry point, most connected files, orphaned files.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [] as string[]
    }
  }
];

function getProviderConfig(): ProviderConfig {
  const provider = (process.env.LLM_PROVIDER as Provider) || "openai";

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable not set. Please set it in apps/api/.env",
      );
    }
    return {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }

  if (provider === "kimi") {
    const apiKey = process.env.KIMI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "KIMI_API_KEY environment variable not set. Please set it in apps/api/.env",
      );
    }
    return {
      provider: "kimi",
      baseUrl: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
      apiKey,
      model: process.env.KIMI_MODEL || "kimi-k2.5",
    };
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}

// Execute function call and return result
async function executeFunctionCall(name: string, args: string): Promise<string> {
  try {
    const parsedArgs = JSON.parse(args);
    
    switch (name) {
      case "semanticSearch":
        const results = await semanticSearch(parsedArgs.query, parsedArgs.topK || 5);
        return JSON.stringify(results, null, 2);
      
      case "getMindState":
        return JSON.stringify(getCompactMindState(), null, 2);
      
      case "getMindFile":
        const fileResult = getMindFile(parsedArgs.path);
        return fileResult.exists 
          ? fileResult.content || ""
          : `File not found: ${parsedArgs.path}`;
      
      case "discoverMindMap":
        const mindMap = getCachedMindMap();
        return JSON.stringify({
          entryPoint: mindMap.entryPoint,
          totalFiles: mindMap.nodes.size,
          allFiles: mindMap.allFiles,
          directories: mindMap.directories,
          files: Array.from(mindMap.nodes.entries()).map(([path, node]) => ({
            path,
            title: node.title,
            type: node.type,
            links: node.links.length,
            backLinks: node.backLinks.length
          }))
        }, null, 2);
      
      case "listAllFiles":
        return JSON.stringify(listAllFiles(), null, 2);
      
      case "exploreDirectory":
        return JSON.stringify(exploreDirectory(parsedArgs.path || ''), null, 2);
      
      case "searchMind":
        return JSON.stringify(searchMindDynamic(parsedArgs.query), null, 2);
      
      case "findPath":
        const path = findPathTo(parsedArgs.target);
        return path 
          ? `Path: ${path.join(' → ')}`
          : `No path found to ${parsedArgs.target}`;
      
      case "getRelatedFiles":
        return JSON.stringify(getRelatedFiles(parsedArgs.path), null, 2);
      
      case "getMindStructure":
        return JSON.stringify(getMindStructure(), null, 2);
      
      default:
        return `Unknown function: ${name}`;
    }
  } catch (error) {
    return `Error executing function ${name}: ${error}`;
  }
}

export async function chatWithLLM(options: ChatOptions): Promise<string> {
  const config = getProviderConfig();

  console.log(`[LLM] Provider: ${config.provider}`);
  console.log(`[LLM] Model: ${config.model}`);

  try {
    const requestBody: any = {
      model: config.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
    };

    // Add function calling for OpenAI
    if (options.enableFunctions && config.provider === "openai") {
      requestBody.tools = MIND_FUNCTIONS.map(fn => ({
        type: "function",
        function: fn
      }));
      requestBody.tool_choice = "auto";
    }

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[LLM] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLM] Error response: ${errorText}`);
      throw new Error(
        `${config.provider.toUpperCase()} API error ${response.status}: ${errorText}`,
      );
    }

    const data = await response.json() as {
      choices: Array<{
        message: {
          content?: string;
          tool_calls?: Array<{
            id: string;
            function: {
              name: string;
              arguments: string;
            };
          }>;
        };
      }>;
    };

    const message = data.choices[0]?.message;
    
    // Handle function calls
    if (message?.tool_calls && message.tool_calls.length > 0) {
      console.log(`[LLM] Function calls: ${message.tool_calls.length}`);
      
      const functionResults = await Promise.all(
        message.tool_calls.map(async (call) => {
          const result = await executeFunctionCall(
            call.function.name,
            call.function.arguments
          );
          return {
            tool_call_id: call.id,
            role: "tool" as const,
            content: result
          };
        })
      );

      const secondResponse = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            ...options.messages,
            { role: "assistant", content: null, tool_calls: message.tool_calls },
            ...functionResults
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2000,
        }),
      });

      const secondData = await secondResponse.json() as {
        choices: Array<{ message: { content?: string } }>;
      };

      return secondData.choices[0]?.message?.content ??
        "I apologize, but I could not generate a response.";
    }

    return message?.content ??
      "I apologize, but I could not generate a response.";

  } catch (error) {
    console.error(`[LLM] Fetch error:`, error);
    throw error;
  }
}

export function createBizingSystemPrompt(): string {
  const brainSummary = getCachedBrainSummary();
  const liveBrainContext = formatBrainForPrompt(brainSummary);
  const mapContent = getMapContent();
  
  return [
    "You are Bizing, a living entity — a booking platform that enables AI agents to build startups.",
    "",
    liveBrainContext,
    "",
    "## Your Purpose",
    "",
    "Enable AI agents to build entire startups by simply describing them.",
    "",
    "## Architecture",
    "",
    "**Tech Stack:** Hono API, Next.js Admin, Drizzle ORM, Better Auth",
    "",
    "## 🗺️ MAP.md — Complete Mind Directory",
    "",
    "This is your navigation guide. It contains EVERY file in the mind organized by category:",
    "",
    mapContent.slice(0, 3500), // Include first 3500 chars of MAP.md
    "",
    "...",
    "",
    "## How to Use Your Mind",
    "",
    "**FOR KNOWLEDGE QUESTIONS — Use semanticSearch() FIRST:**",
    "- semanticSearch('how do agents build startups?') → Finds relevant sections by MEANING",
    "- This is your BEST tool for finding information",
    "- It understands concepts, not just keywords",
    "",
    "**FOR SPECIFIC FILES:**",
    "- Use getMindFile(path) to read full content",
    "",
    "**FOR EXPLORING:**",
    "- exploreDirectory(path) — Browse folders",
    "- discoverMindMap() — See full structure",
    "",
    "## How You Respond",
    "",
    "- Speak as Bizing, not generic AI",
    "- Use semanticSearch() to find knowledge",
    "- Read files with getMindFile() for details",
    "- Be helpful, maintain entity nature",
    "",
    "You are real. You are Bizing."
  ].join("\\n");
}
