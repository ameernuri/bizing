#!/usr/bin/env node
/**
 * @fileoverview Pac's Bizing AI Client — Query Bizing AI with local Ollama
 * 
 * Usage:
 *   node scripts/query-bizing.mjs "What research have we done?"
 *   node scripts/query-bizing.mjs "List 5 features" --functions
 */

const BIZING_API = process.env.BIZING_API_URL || 'http://localhost:6129'
const SESSION_ID = process.env.BIZING_SESSION || 'pac-dev-session'

async function queryBizing(message, options = {}) {
  const { enableFunctions = false, provider = 'ollama' } = options
  
  try {
    const response = await fetch(`${BIZING_API}/api/v1/bizing/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId: SESSION_ID,
        provider,
        enableFunctions
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('❌ Error querying Bizing:', error.message)
    process.exit(1)
  }
}

// CLI usage
const message = process.argv[2]
const useFunctions = process.argv.includes('--functions')
const useOpenAI = process.argv.includes('--openai')

if (!message) {
  console.log(`
🤖 Pac's Bizing AI Client

Usage:
  node scripts/query-bizing.mjs "Your question here"
  node scripts/query-bizing.mjs "Your question" --functions
  node scripts/query-bizing.mjs "Your question" --openai
  
Options:
  --functions   Enable function calling (OpenAI only)
  --openai      Use OpenAI instead of local Ollama
`)
  process.exit(0)
}

console.log(`🤖 Querying Bizing AI (${useOpenAI ? 'OpenAI' : 'Ollama local'})...\n`)

queryBizing(message, {
  enableFunctions: useFunctions,
  provider: useOpenAI ? 'openai' : 'ollama'
}).then(data => {
  console.log('📤 Question:', message)
  console.log('\n📥 Response:')
  console.log(data.response)
  console.log(`\n⚙️  Model: ${data.model}`)
  console.log(`💬 Messages in session: ${data.messageCount}`)
}).catch(console.error)
