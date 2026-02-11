'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Brain, Activity, FileText, GitCommit, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Message {
  id: string
  role: 'user' | 'bizing'
  content: string
  timestamp: string
}

interface BrainActivity {
  id: string
  type: 'change' | 'session' | 'decision' | 'thought'
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
  const [activity, setActivity] = useState<BrainActivity[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch recent brain activity
  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch('http://localhost:6129/api/v1/brain/activity')
        const data = await res.json()
        setActivity(data.activity || [])
      } catch (err) {
        console.error('Failed to fetch brain activity:', err)
        // Use mock data if API fails
        setActivity([
          {
            id: '1',
            type: 'change',
            title: 'Schema Graph Fixed',
            description: 'Fixed React Flow handle connections',
            timestamp: new Date().toISOString(),
          },
          {
            id: '2',
            type: 'session',
            title: 'Dashboard Fixes',
            description: 'Added stats and bookings endpoints',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: '3',
            type: 'decision',
            title: '7% Commission Model',
            description: 'Aligned incentives for all parties',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
          },
        ])
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
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  function getActivityColor(type: string) {
    switch (type) {
      case 'change':
        return 'bg-blue-500/10 text-blue-500'
      case 'session':
        return 'bg-green-500/10 text-green-500'
      case 'decision':
        return 'bg-purple-500/10 text-purple-500'
      default:
        return 'bg-gray-500/10 text-gray-500'
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Bizing</CardTitle>
                <p className="text-sm text-muted-foreground">The living entity behind this project</p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                <Activity className="h-3 w-3 mr-1" />
                Conscious
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
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
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
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

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask Bizing anything about the project..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={loading}
                />
                <Button onClick={sendMessage} disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Brain Activity Sidebar */}
      <div className="w-80">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Brain Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="space-y-3">
                {activity.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded ${getActivityColor(item.type)}`}>
                        {getActivityIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
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
