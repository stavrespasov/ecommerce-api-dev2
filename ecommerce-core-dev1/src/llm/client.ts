import { LLMResult, LLMOptions, LLMError } from '../types'

const COSTS = {
  'gpt-4o-mini': { input: 0.15 / 1000000, output: 0.60 / 1000000 },
  'claude-haiku-4-5-20251001': { input: 0.25 / 1000000, output: 1.25 / 1000000 }
}

export class LLMClient {
  private provider: 'openai' | 'anthropic'
  private apiKey: string

  constructor() {
    this.provider = (process.env.LLM_PROVIDER as 'openai' | 'anthropic') || 'openai'
    this.apiKey = this.provider === 'openai' 
      ? process.env.OPENAI_API_KEY || '' 
      : process.env.ANTHROPIC_API_KEY || ''
  }

  async complete(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    let attempts = 0
    let lastError: any = null

    while (attempts < 3) {
      try {
        if (this.provider === 'openai') {
          return await this.callOpenAI(prompt, options)
        } else {
          return await this.callAnthropic(prompt, options)
        }
      } catch (error: any) {
        lastError = error
        if (error instanceof LLMError && error.isRateLimit && attempts < 2) {
          attempts++
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }
        throw error
      }
    }
    throw lastError
  }

  private async callOpenAI(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    const model = 'gpt-4o-mini'
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens,
      })
    })

    if (res.status === 429) {
      throw new LLMError('Rate limit exceeded', true)
    }
    if (!res.ok) {
      throw new LLMError(`OpenAI Error: ${res.statusText}`, false)
    }

    const data = await res.json()
    const text = data.choices[0].message.content
    const inputTokens = data.usage?.prompt_tokens || 0
    const outputTokens = data.usage?.completion_tokens || 0
    const tokensUsed = inputTokens + outputTokens
    const costUsd = (inputTokens * COSTS[model].input) + (outputTokens * COSTS[model].output)

    return { text, model, tokens_used: tokensUsed, cost_usd: costUsd }
  }

  private async callAnthropic(prompt: string, options?: LLMOptions): Promise<LLMResult> {
    const model = 'claude-haiku-4-5-20251001'
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.max_tokens ?? 1024,
        temperature: options?.temperature ?? 0.7,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (res.status === 429) {
      throw new LLMError('Rate limit exceeded', true)
    }
    if (!res.ok) {
      throw new LLMError(`Anthropic Error: ${res.statusText}`, false)
    }

    const data = await res.json()
    const text = data.content[0].text
    const inputTokens = data.usage?.input_tokens || 0
    const outputTokens = data.usage?.output_tokens || 0
    const tokensUsed = inputTokens + outputTokens
    const costUsd = (inputTokens * COSTS[model].input) + (outputTokens * COSTS[model].output)

    return { text, model, tokens_used: tokensUsed, cost_usd: costUsd }
  }
}
