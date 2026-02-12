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

'use client'

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent, type MouseEvent } from 'react'
import { Send, Brain, Activity, FileText, GitCommit, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import ReactMarkdown from 'react-markdown'

/**
 * Message interface representing a chat message
 *
 * @property id - Unique identifier for the message
 * @property role - Who sent the message ('user' or 'bizing')
 * @property content - The message text content
 * @property timestamp - ISO timestamp of when message was sent
 */
interface Message {
  id: string
  role: 'user' | 'bizing'
  content: string
  timestamp: string
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
  id: string
  type: 'change' | 'session' | 'decision' | 'learning' | 'workflow'
  title: string
  description: string
  timestamp: string
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
 * // Returns <FileText className="h-4 w-4" />
 * ```
 */
function getActivityIcon(type: MindActivity['type']) {
  switch (type) {
    case 'change':
      return <GitCommit className="h-4 w-4" />
    case 'session':
      return <FileText className="h-4 w-4" />
    case 'decision':
      return <MessageSquare className="h-4 w-4" />
    case 'learning':
      return <Brain className="h-4 w-4" />
    default:
      return <Activity className="h-4 w-4" />
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
function getActivityColor(type: MindActivity['type']) {
  switch (type) {
    case 'change':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    case 'session':
      return 'bg-green-500/10 text-green-500 border-green-500/20'
    case 'decision':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    case 'learning':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
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
      id: 'welcome',
      role: 'bizing',
      content: 'Hello, I am Bizing. I know everything about this project — the code, the architecture, our decisions, and our goals. What would you like to know or build?',
      timestamp: new Date().toISOString(),
    },
  ])
  
  /** Current input field value */
  const [input, setInput] = useState('')
  
  /** Whether Bizing is processing a request */
  const [loading, setLoading] = useState(false)
  
  /** Mind activity items from API */
  const [activity, setActivity] = useState<MindActivity[]>([])
  
  /** Reference for auto-scrolling to bottom */
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
        const res = await fetch('http://localhost:6129/api/v1/mind/activity')
        const data = await res.json()
        setActivity(data.activity || [])
      } catch (err) {
        console.error('Failed to fetch mind activity:', err)
      }
    }
    fetchActivity()
  }, [])

  /**
   * Auto-scroll to newest message when messages change
   * Uses smooth scrolling for better UX
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('http://localhost:6129/api/v1/bizing/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
      })

      const data = await res.json()

      const bizingMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bizing',
        content: data.response || 'I apologize, but I am having trouble processing that request.',
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, bizingMessage])
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bizing',
        content: 'I apologize, but I am unable to connect to my knowledge base right now. Please try again.',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div 
      className="flex h-[calc(100vh-4rem)] gap-4 p-4 overflow-hidden"
      data-testid="bizing-page"
    >
      {/* =========================================================================
        Main Chat Area
        ========================================================================= */}
      <div 
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        data-testid="chat-area"
      >
        <Card className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <CardHeader className="border-b shrink-0">
            <div className="flex items-center gap-3">
              {/* Bizing Avatar */}
              <div 
                className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shrink-0"
                data-testid="bizing-avatar"
              >
                <Brain className="h-5 w-5 text-white" />
              </div>
              
              {/* Title and Subtitle */}
              <div className="min-w-0">
                <CardTitle className="text-lg truncate">Bizing</CardTitle>
                <p className="text-sm text-muted-foreground truncate">
                  The living entity behind this project
                </p>
              </div>
              
              {/* Status Badge */}
              <Badge 
                variant="secondary" 
                className="ml-auto shrink-0"
                data-testid="conscious-badge"
              >
                <Activity className="h-3 w-3 mr-1" />
                Conscious
              </Badge>
            </div>
          </CardHeader>

          {/* Chat Content */}
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
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
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 overflow-hidden ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {/* Bizing Label */}
                      {message.role === 'bizing' && (
                        <div 
                          className="flex items-center gap-2 mb-2"
                          data-testid="bizing-label"
                        >
                          <Brain className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium text-primary">Bizing</span>
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden">
                        {message.role === 'bizing' ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          <p className="whitespace-pre-wrap overflow-hidden">{message.content}</p>
                        )}
                      </div>
                      
                      {/* Timestamp */}
                      <p 
                        className="text-xs opacity-70 mt-2 shrink-0 overflow-hidden"
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
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <div className="flex gap-1">
                          <span 
                            className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                            style={{ animationDelay: '0ms' }}
                            data-testid="bounce-1"
                          />
                          <span 
                            className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                            style={{ animationDelay: '150ms' }}
                            data-testid="bounce-2"
                          />
                          <span 
                            className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                            style={{ animationDelay: '300ms' }}
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
              className="p-4 border-t shrink-0 bg-background overflow-hidden"
              data-testid="input-area"
            >
              <div className="flex gap-2 overflow-hidden">
                <Input
                  placeholder="Ask Bizing anything about the project..."
                  value={input}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="shrink-0 min-w-0 overflow-hidden"
                  data-testid="chat-input"
                />
                <Button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="shrink-0 overflow-hidden"
                  data-testid="send-button"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
        Mind Activity Sidebar
        ========================================================================= */}
      <div 
        className="w-80 shrink-0 overflow-hidden"
        data-testid="activity-sidebar"
      >
        <Card className="h-full overflow-hidden flex flex-col">
          {/* Sidebar Header */}
          <CardHeader className="border-b shrink-0">
            <CardTitle 
              className="text-sm flex items-center gap-2 overflow-hidden"
              data-testid="activity-header"
            >
              <Activity className="h-4 w-4 shrink-0" />
              Mind Activity
            </CardTitle>
          </CardHeader>
          
          {/* Activity Cards */}
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full overflow-hidden">
              <div 
                className="p-3 space-y-3 overflow-hidden"
                data-testid="activity-cards"
              >
                {activity.map((item) => (
                  <div
                    key={item.id}
                    data-testid={`activity-card-${item.id}`}
                    data-type={item.type}
                    className={`p-3 rounded-lg border overflow-hidden ${getActivityColor(item.type)}`}
                  >
                    <div className="flex items-start gap-2 overflow-hidden">
                      {/* Activity Icon */}
                      <div 
                        className={`p-1.5 rounded shrink-0 overflow-hidden ${getActivityColor(item.type)}`}
                        data-testid={`activity-icon-${item.id}`}
                      >
                        {getActivityIcon(item.type)}
                      </div>
                      
                      {/* Activity Content */}
                      <div 
                        className="flex-1 min-w-0 space-y-1 overflow-hidden"
                        data-testid={`activity-content-${item.id}`}
                      >
                        <p 
                          className="text-sm font-medium truncate leading-tight overflow-hidden"
                          data-testid={`activity-title-${item.id}`}
                        >
                          {item.title}
                        </p>
                        <p 
                          className="text-xs text-muted-foreground line-clamp-3 leading-relaxed overflow-hidden"
                          data-testid={`activity-description-${item.id}`}
                        >
                          {item.description}
                        </p>
                        <p 
                          className="text-xs text-muted-foreground/70 shrink-0 overflow-hidden"
                          suppressHydrationWarning
                          data-testid={`activity-timestamp-${item.id}`}
                        >
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
