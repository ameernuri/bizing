import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { chatWithLLM, createBizingSystemPrompt } from '../services/llm.js'

const conversations = new Map<string, { role: 'system' | 'user' | 'assistant'; content: string }[]>()
const MAX_HISTORY = 10

function log(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

export const bizingChatRoutes = new Hono()

bizingChatRoutes.post('/bizing/chat', requireAuth, async (c) => {
  const body = await c.req.json()
  const { message, sessionId = 'default', enableFunctions = true, provider } = body

  try {
    log(`Bizing chat request [${sessionId}]: ${String(message).slice(0, 50)}...`)

    const effectiveProvider = provider || 'openai'

    let history = conversations.get(sessionId) || []
    if (history.length === 0) {
      history = [
        {
          role: 'system',
          content: createBizingSystemPrompt(),
        },
      ]
    }

    history.push({
      role: 'user',
      content: message,
    })

    if (history.length > MAX_HISTORY + 1) {
      const systemMsg = history[0]
      history = [systemMsg, ...history.slice(-MAX_HISTORY)]
    }

    const response = await chatWithLLM(
      {
        messages: history,
        temperature: 0.7,
        maxTokens: 2000,
        enableFunctions,
      },
      effectiveProvider,
    )

    history.push({
      role: 'assistant',
      content: response,
    })
    conversations.set(sessionId, history)

    log('Bizing chat response generated successfully')

    return c.json({
      response,
      sessionId,
      messageCount: history.length,
      timestamp: new Date().toISOString(),
      model: effectiveProvider || 'openai',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log(`Bizing chat error: ${errorMessage}`)
    return c.json(
      {
        response:
          'I apologize, but I am having trouble connecting to my knowledge base right now. Please check that my API key is configured correctly.',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        model: 'error',
      },
      500,
    )
  }
})

