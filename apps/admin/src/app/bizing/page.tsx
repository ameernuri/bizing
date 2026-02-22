/**
 * @fileoverview Bizing Entity Page - Main chat interface for interacting with Bizing AI
 *
 * @description
 * This is the primary interface for conversing with Bizing, the AI entity that knows
 * everything about the project. Features include:
 * - Real-time chat with markdown support
 * - Conversation history with context
 * - Mind activity sidebar showing recent activity
 * - Auto-scrolling messages
 * - Loading states with animations
 *
 * @architecture
 * Component: apps/admin/src/app/bizing/page.tsx
 * API: apps/api/src/server.ts (/api/v1/bizing/chat, /api/v1/mind/activity)
 * Tests: apps/admin/src/app/bizing/__tests__/page.test.tsx
 * Related: apps/admin/src/components/ui/* (shadcn/ui components)
 *
 * @design-decisions
 * - Uses React hooks for state management (useState, useEffect, useRef)
 * - Auto-scrolls to newest message using ref and scrollIntoView
 * - Markdown rendering for Bizing responses using react-markdown
 * - Fixed input at bottom (Telegram-style layout)
 * - Activity sidebar with color-coded cards for different event types
 * - Responsive flexbox layout with overflow control
 *
 * @dependencies
 * - react-markdown: For rendering markdown in chat responses
 * - lucide-react: For icons (Brain, Activity, Send, etc.)
 * - @/components/ui/*: shadcn/ui component library
 *
 * @known-issues
 * - None currently tracked
 *
 * @todo
 * - [ ] TODO: Add message persistence (localStorage or API)
 * - [ ] TODO: Add typing indicators for Bizing
 * - [ ] IDEA: Add file attachments support
 * - [ ] IDEA: Add voice input option
 *
 * @created 2026-02-08
 * @updated 2026-02-11
 * @version 2.0.0
 */

"use client";

import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import {
  Send,
  Brain,
  Activity,
  FileText,
  GitCommit,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiUrl } from "@/lib/api";
import ReactMarkdown from "react-markdown";

/**
 * Message interface representing a chat message
 *
 * @property id - Unique identifier for the message
 * @property role - Who sent the message ('user' or 'bizing')
 * @property content - The message text content
 * @property timestamp - ISO timestamp of when message was sent
 */
interface Message {
  id: string;
  role: "user" | "bizing";
  content: string;
  timestamp: string;
}

/**
 * MindActivity interface representing a single activity card in the sidebar
 *
 * @property id - Unique identifier (e.g., "learning-2026-02-11-0")
 * @property type - Activity type for styling ('change' | 'session' | 'decision' | 'learning' | 'workflow')
 * @property title - Short title describing the activity
 * @property description - Longer description or context
 * @property timestamp - ISO timestamp of when activity occurred
 */
interface MindActivity {
  id: string;
  type: "change" | "session" | "decision" | "learning" | "workflow";
  title: string;
  description: string;
  timestamp: string;
}

/**
 * Get the appropriate icon component for an activity type
 *
 * @param type - The activity type to get icon for
 * @returns React component for the activity icon
 *
 * @example
 * ```tsx
 * const icon = getActivityIcon('session')
 * // Returns <FileText className="w-4 h-4" />
 * ```
 */
function getActivityIcon(type: MindActivity["type"]) {
  switch (type) {
    case "change":
      return <GitCommit className="w-4 h-4" />;
    case "session":
      return <FileText className="w-4 h-4" />;
    case "decision":
      return <MessageSquare className="w-4 h-4" />;
    case "learning":
      return <Brain className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
}

/**
 * Get color classes for an activity type
 *
 * @param type - The activity type to get colors for
 * @returns Tailwind class string for background, text, and border colors
 *
 * @design-decision
 * Each activity type has distinct colors for visual differentiation:
 * - change: Blue (Git-like commits/changes)
 * - session: Green (New sessions/meetings)
 * - decision: Purple (Important decisions)
 * - learning: Amber/Yellow (New learnings)
 * - workflow: Gray (General workflow items)
 */
function getActivityColor(type: MindActivity["type"]) {
  switch (type) {
    case "change":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "session":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "decision":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    case "learning":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
}

/**
 * BizingEntityPage - Main component for Bizing AI chat interface
 *
 * @description
 * This component provides a complete chat interface with:
 * - Header with Bizing status badge
 * - Scrollable message area with markdown support
 * - Fixed input field at bottom
 * - Activity sidebar showing recent mind events
 *
 * @state
 * - messages: Array of chat messages
 * - input: Current input field value
 * - loading: Whether Bizing is processing
 * - activity: Array of mind activity items
 * - messagesEndRef: Reference for auto-scrolling
 *
 * @effects
 * - Fetches mind activity on mount
 * - Auto-scrolls to newest message when messages change
 *
 * @example
 * ```tsx
 * // Used in app routing:
 * // apps/admin/src/app/bizing/page.tsx
 * <BizingEntityPage />
 * ```
 */
export default function BizingEntityPage() {
  // =========================================================================
  // State
  // =========================================================================

  /** Chat messages including user and Bizing responses */
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bizing",
      content:
        "Hello, I am Bizing. I know everything about this project — the code, the architecture, our decisions, and our goals. What would you like to know or build?",
      timestamp: new Date().toISOString(),
    },
  ]);

  /** Current input field value */
  const [input, setInput] = useState("");

  /** Whether Bizing is processing a request */
  const [loading, setLoading] = useState(false);

  /** Mind activity items from API */
  const [activity, setActivity] = useState<MindActivity[]>([]);

  /** Reference for auto-scrolling to bottom */
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // =========================================================================
  // Effects
  // =========================================================================

  /**
   * Fetch mind activity on component mount
   * @see getActivityIcon - For icon rendering
   * @see getActivityColor - For card styling
   */
  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(apiUrl("/api/v1/mind/activity"));
        const data = await res.json();
        setActivity(data.activity || []);
      } catch (err) {
        console.error("Failed to fetch mind activity:", err);
      }
    }
    fetchActivity();
  }, []);

  /**
   * Auto-scroll to newest message when messages change
   * Uses smooth scrolling for better UX
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // =========================================================================
  // Event Handlers
  // =========================================================================

  /**
   * Send a message to Bizing and handle the response
   *
   * @流程 (Flow)
   * 1. Validate input (non-empty, not loading)
   * 2. Add user message to chat
   * 3. Clear input and set loading
   * 4. Call Bizing chat API
   * 5. Add Bizing response to chat
   * 6. Handle errors gracefully
   * 7. Clear loading state
   *
   * @throws Will log error if API call fails
   */
  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/v1/bizing/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await res.json();

      const bizingMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "bizing",
        content:
          data.response ||
          "I apologize, but I am having trouble processing that request.",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, bizingMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "bizing",
        content:
          "I apologize, but I am unable to connect to my knowledge base right now. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handle keyboard input in the input field
   *
   * @param e - Keyboard event from Input component
   *
   * @design-decision
   * Enter key sends message, Shift+Enter creates new line
   */
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div
      className="grid h-[calc(100vh-4rem)] gap-4 p-4 overflow-hidden grid-cols-[1fr_400px]"
      data-testid="bizing-page"
    >
      {/* =========================================================================
        Main Chat Area
        ========================================================================= */}
      <div
        className="flex overflow-hidden flex-col flex-1 min-w-0"
        data-testid="chat-area"
      >
        <Card className="flex overflow-hidden flex-col flex-1">
          {/* Chat Header */}
          <CardHeader className="border-b shrink-0">
            <div className="flex gap-3 items-center">
              {/* Bizing Avatar */}
              <div
                className="flex justify-center items-center w-10 h-10 bg-gradient-to-br to-purple-600 rounded-full from-primary shrink-0"
                data-testid="bizing-avatar"
              >
                <Brain className="w-5 h-5 text-white" />
              </div>

              {/* Title and Subtitle */}
              <div className="min-w-0">
                <CardTitle className="text-lg truncate">Bizing</CardTitle>
                <p className="text-sm truncate text-muted-foreground">
                  The living entity behind this project
                </p>
              </div>

              {/* Status Badge */}
              <Badge
                variant="secondary"
                className="ml-auto shrink-0"
                data-testid="conscious-badge"
              >
                <Activity className="mr-1 w-3 h-3" />
                Conscious
              </Badge>
            </div>
          </CardHeader>

          {/* Chat Content */}
          <CardContent className="flex overflow-hidden flex-col flex-1 p-0">
            {/* =========================================================================
              Scrollable Messages Area
              ========================================================================= */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4" data-testid="messages-container">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    data-testid={`message-${message.id}`}
                    data-role={message.role}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 overflow-hidden ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {/* Bizing Label */}
                      {message.role === "bizing" && (
                        <div
                          className="flex gap-2 items-center mb-2"
                          data-testid="bizing-label"
                        >
                          <Brain className="w-4 h-4 text-primary" />
                          <span className="text-xs font-medium text-primary">
                            Bizing
                          </span>
                        </div>
                      )}

                      {/* Message Content */}
                      <div className="overflow-hidden max-w-none prose prose-sm dark:prose-invert">
                        {message.role === "bizing" ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          <p className="overflow-hidden whitespace-pre-wrap">
                            {message.content}
                          </p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <p
                        className="overflow-hidden mt-2 text-xs opacity-70 shrink-0"
                        suppressHydrationWarning
                        data-testid={`message-timestamp-${message.id}`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Loading Indicator */}
                {loading && (
                  <div
                    className="flex justify-start"
                    data-testid="loading-indicator"
                  >
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="flex gap-2 items-center">
                        <Brain className="w-4 h-4 text-primary" />
                        <div className="flex gap-1">
                          <span
                            className="w-2 h-2 rounded-full animate-bounce bg-primary"
                            style={{ animationDelay: "0ms" }}
                            data-testid="bounce-1"
                          />
                          <span
                            className="w-2 h-2 rounded-full animate-bounce bg-primary"
                            style={{ animationDelay: "150ms" }}
                            data-testid="bounce-2"
                          />
                          <span
                            className="w-2 h-2 rounded-full animate-bounce bg-primary"
                            style={{ animationDelay: "300ms" }}
                            data-testid="bounce-3"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} data-testid="scroll-anchor" />
              </div>
            </ScrollArea>

            {/* =========================================================================
              Fixed Input at Bottom
              ========================================================================= */}
            <div
              className="overflow-hidden p-4 border-t shrink-0 bg-background"
              data-testid="input-area"
            >
              <div className="flex overflow-hidden gap-2">
                <Input
                  placeholder="Ask Bizing anything about the project..."
                  value={input}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setInput(e.target.value)
                  }
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="overflow-hidden min-w-0 shrink-0"
                  data-testid="chat-input"
                />
                <Button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="overflow-hidden shrink-0"
                  data-testid="send-button"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
        Mind Activity Sidebar
        ========================================================================= */}
      <div className="overflow-hidden shrink-0" data-testid="activity-sidebar">
        <Card className="flex overflow-hidden flex-col h-full">
          {/* Sidebar Header */}
          <CardHeader className="border-b shrink-0">
            <CardTitle
              className="flex overflow-hidden gap-2 items-center text-sm"
              data-testid="activity-header"
            >
              <Activity className="w-4 h-4 shrink-0" />
              Mind Activity
            </CardTitle>
          </CardHeader>

          {/* Activity Cards */}
          <CardContent className="flex-1 p-0">
            <ScrollArea className="overflow-auto h-[calc(100vh-200px)]">
              <div className="grid p-3 space-y-3" data-testid="activity-cards">
                {activity.map((item) => (
                  <Card
                    key={item.id}
                    data-testid={`activity-card-${item.id}`}
                    data-type={item.type}
                    className={`p-3 rounded-lg border overflow-hidden ${getActivityColor(item.type)}`}
                  >
                    <div className="flex overflow-hidden gap-2 items-start">
                      {/* Activity Icon */}
                      <div
                        className={`p-1.5 rounded shrink-0 overflow-hidden ${getActivityColor(item.type)}`}
                        data-testid={`activity-icon-${item.id}`}
                      >
                        {getActivityIcon(item.type)}
                      </div>

                      {/* Activity Content */}
                      <div
                        className="overflow-hidden flex-1 space-y-1 min-w-0"
                        data-testid={`activity-content-${item.id}`}
                      >
                        <p
                          className="overflow-hidden text-sm font-medium leading-tight truncate"
                          data-testid={`activity-title-${item.id}`}
                        >
                          {item.title}
                        </p>
                        <p
                          className="overflow-hidden text-xs leading-relaxed text-muted-foreground line-clamp-3"
                          data-testid={`activity-description-${item.id}`}
                        >
                          {item.description}
                        </p>
                        <p
                          className="overflow-hidden text-xs text-muted-foreground/70 shrink-0"
                          suppressHydrationWarning
                          data-testid={`activity-timestamp-${item.id}`}
                        >
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
