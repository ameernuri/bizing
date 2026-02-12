'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Brain, Activity, FileText, GitCommit, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'bizing'
  content: string
  timestamp: string
}

interface MindActivity {
  id: string
  type: 'change' | 'session' | 'decision' | 'learning' | 'workflow'
  title: string
  description: string
  timestamp: string
}

export default function BizingEntityPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bizing',
      content: 'Hello, I am Bizing. I know everything about this project — the code, the architecture, our decisions, and our goals. What would you like to know or build?',
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activity, setActivity] = useState<MindActivity[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch mind activity
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  function getActivityIcon(type: string) {
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

  function getActivityColor(type: string) {
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

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg truncate">Bizing</CardTitle>
                <p className="text-sm text-muted-foreground truncate">The living entity behind this project</p>
              </div>
              <Badge variant="secondary" className="ml-auto shrink-0">
                <Activity className="h-3 w-3 mr-1" />
                Conscious
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {/* Scrollable Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 overflow-hidden ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {message.role === 'bizing' && (
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="h-4 w-4 text-primary" />
                          <span className="text-xs font-medium text-primary">Bizing</span>
                        </div>
                      )}
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {message.role === 'bizing' ? (
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                      <p className="text-xs opacity-70 mt-2 shrink-0" suppressHydrationWarning>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Fixed Input at Bottom */}
            <div className="p-4 border-t shrink-0 bg-background">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask Bizing anything about the project..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={loading}
                  className="shrink-0"
                />
                <Button onClick={sendMessage} disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mind Activity Sidebar */}
      <div className="w-80 shrink-0">
        <Card className="h-full overflow-hidden flex flex-col">
          <CardHeader className="border-b shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Mind Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-3">
                {activity.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border ${getActivityColor(item.type)} overflow-hidden`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded shrink-0 ${getActivityColor(item.type)}`}>
                        {getActivityIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium truncate leading-tight">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                          {item.description}
                        </p>
                        <p className="text-xs text-muted-foreground/70 shrink-0" suppressHydrationWarning>
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
