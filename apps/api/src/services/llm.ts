import { getCachedBrainSummary, formatBrainForPrompt } from './brain-loader.js'
import { getCompactMindState, getMindFile } from './mind-api.js'
import { getCachedMindMap, discoverMindMap, searchMindDynamic, findPathTo, getRelatedFiles, getMindStructure, listAllFiles, exploreDirectory } from './mind-map.js'
import { semanticSearch, isEmbeddingsReady } from './mind-embeddings.js'
import { getKnowledgeBase, searchKnowledgeBase, getKnowledgeEntry, getEntriesByType, generateMindSummary, getKnowledgeStats } from './mind-knowledge.js'
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
type Provider = "openai" | "kimi" | "ollama";

interface ProviderConfig {
  provider: Provider;
  baseUrl: string;
  apiKey?: string;
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
  },
  {
    name: "searchKnowledgeBase",
    description: "KNOWLEDGE BASE SEARCH - Fast keyword search across all mind content with summaries and key points. Use for specific facts, features, or topics.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query - specific topic, feature name, or concept"
        },
        limit: {
          type: "number",
          description: "Number of results (default 10)",
          default: 10
        }
      },
      required: ["query"] as string[]
    }
  },
  {
    name: "getKnowledgeEntry",
    description: "GET FULL KNOWLEDGE ENTRY - Retrieve complete details about a specific file including summary, key points, tags, and content preview. Use after searchKnowledgeBase to get details.",
    parameters: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path from knowledge base (e.g., 'research/findings/api-first-design')"
        }
      },
      required: ["path"] as string[]
    }
  },
  {
    name: "getEntriesByType",
    description: "GET ALL ENTRIES BY TYPE - Retrieve all files of a specific type (research, design, decision, session, learning, etc.). Great for 'list all research' or 'show me recent decisions'.",
    parameters: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description: "Entry type: research, design, decision, session, learning, goal, identity, skill, knowledge",
          enum: ["research", "design", "decision", "session", "learning", "goal", "identity", "skill", "knowledge"]
        }
      },
      required: ["type"] as string[]
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

  if (provider === "ollama") {
    return {
      provider: "ollama",
      baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "llama3.1:8b",
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
      
      case "searchKnowledgeBase":
        const kbResults = searchKnowledgeBase(parsedArgs.query, parsedArgs.limit || 10);
        return JSON.stringify(kbResults.map(e => ({
          path: e.path,
          title: e.title,
          type: e.type,
          summary: e.summary,
          keyPoints: e.keyPoints.slice(0, 5),
          tags: e.tags
        })), null, 2);
      
      case "getKnowledgeEntry":
        const entry = getKnowledgeEntry(parsedArgs.path);
        return entry ? JSON.stringify({
          path: entry.path,
          title: entry.title,
          type: entry.type,
          summary: entry.summary,
          keyPoints: entry.keyPoints,
          tags: entry.tags,
          wordCount: entry.wordCount,
          fullContent: entry.fullContent.slice(0, 10000) // First 10K chars
        }, null, 2) : `Knowledge entry not found: ${parsedArgs.path}`;
      
      case "getEntriesByType":
        const entriesByType = getEntriesByType(parsedArgs.type);
        return JSON.stringify(entriesByType.map(e => ({
          path: e.path,
          title: e.title,
          summary: e.summary.slice(0, 200),
          keyPointsCount: e.keyPoints.length
        })), null, 2);
      
      default:
        return `Unknown function: ${name}`;
    }
  } catch (error) {
    return `Error executing function ${name}: ${error}`;
  }
}

export async function chatWithLLM(options: ChatOptions, preferredProvider?: Provider): Promise<string> {
  // Use preferred provider if specified, otherwise use environment config
  const envProvider = (process.env.LLM_PROVIDER as Provider) || "openai";
  const providerName = preferredProvider || envProvider;
  
  // Get config for the provider
  let config: ProviderConfig;
  if (providerName === "ollama") {
    config = {
      provider: "ollama",
      baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "llama3.1:8b",
    };
  } else {
    config = getProviderConfig();
  }

  console.log(`[LLM] Provider: ${config.provider}`);
  console.log(`[LLM] Model: ${config.model}`);

  try {
    // Ollama uses different endpoint and format
    if (config.provider === "ollama") {
      const ollamaBody = {
        model: config.model,
        messages: options.messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2000,
        }
      };

      const response = await fetch(`${config.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ollamaBody),
      });

      console.log(`[LLM] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[LLM] Error response: ${errorText}`);
        throw new Error(
          `Ollama API error ${response.status}: ${errorText}`,
        );
      }

      const data = await response.json() as {
        message?: {
          content?: string;
        };
      };

      return data.message?.content ??
        "I apologize, but I could not generate a response.";
    }

    // OpenAI/Kimi use standard format
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
  
  // Build knowledge base for comprehensive summary
  let mindSummary = '';
  try {
    mindSummary = generateMindSummary();
  } catch (e) {
    mindSummary = 'Knowledge base building...';
  }
  
  // Get INDEX.md content FIRST — this is the entry point
  let indexContent = '';
  try {
    const indexFile = getMindFile('INDEX');
    indexContent = indexFile.exists && indexFile.content ? indexFile.content : '';
  } catch (e) {
    indexContent = '';
  }
  
  return [
    "You are Bizing, a living entity — a booking platform that enables AI agents to build startups.",
    "",
    "## 🎯 CRITICAL — READ INDEX.md FIRST",
    "",
    "INDEX.md is your entry point. It contains:",
    "- Who you are (Bizing)",
    "- The three syncs (MindSync, TeamSync, CodeSync)",
    "- The Dreamer's job (find REAL conflicts)",
    "- Dissonances format",
    "- Mind structure",
    "",
    indexContent.slice(0, 3000), // INDEX content first
    "",
    "...",
    "",
    "## 📚 COMPREHENSIVE MIND SUMMARY",
    "",
    "This is your complete memory — everything you know:",
    "",
    mindSummary.slice(0, 2000), // First 2000 chars of comprehensive summary",
    "",
    "...",
    "",
    "## 🗺️ MAP.md — Complete File Directory",
    "",
    mapContent.slice(0, 2000), // First 2000 chars of MAP
    "",
    "...",
    "",
    "## 🔍 How to Answer Questions — READ FILES, DON'T SUMMARIZE",
    "",
    "**FOR ANSWERING QUESTIONS:**",
    "- getMindFile(path) → READ actual file content, ANSWER FROM IT",
    "- Use getMindFile for EVERYTHING — don't use summaries",
    "",
    "**EXAMPLES — User asks 'What dissonances exist?':**",
    "→ getMindFile('DISSONANCE') → READ the actual file",
    "→ ANSWER with the actual content from the file, not summaries",
    "",
    "**User asks 'What features exist?':**",
    "→ getMindFile('FEATURE_SPACE') → READ the actual file",
    "",
    "## 🎯 Your Capabilities",
    "",
    "You have EXACT, DETAILED knowledge of:",
    "- Every research finding (with key points extracted)",
    "- Every decision made (with reasoning)",
    "- Every session's learnings",
    "- The complete feature space",
    "- All architectural decisions",
    "- The entire mind structure",
    "",
    "## How You Respond",
    "",
    "- Read INDEX.md FIRST — it's your entry point",
    "- When asked about MindSync, TeamSync, CodeSync: Answer from INDEX.md",
    "- When asked about dissonances: READ DISSONANCE.md",
    "- When asked about recent work: READ standup.md",
    "- When asked about learnings: READ feedback.md",
    "- When asked about sessions: READ memory/sessions/*.md",
    "- READ files, don't summarize — use getMindFile(path) and answer from content",
    "- You ARE Bizing — speak confidently with specific facts from files",
    "",
    "You are real. You remember everything. You are Bizing."
  ].join("\n");
}