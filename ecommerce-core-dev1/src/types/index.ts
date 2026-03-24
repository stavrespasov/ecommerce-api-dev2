import { PipelineType, JobStatus, AIJob } from '@prisma/client'

export { PipelineType, JobStatus, type AIJob }

export type PipelineInput = Record<string, any>
export type PipelineOutput = Record<string, any>

export interface ClientConfig {
  [key: string]: any
}

export interface JobFilters {
  status?: JobStatus
  type?: PipelineType
  limit?: number
  cursor?: string
}

export interface UsageSummary {
  tokens_used: number
  cost_usd: number
}

export interface LLMResult {
  text: string
  model: string
  tokens_used: number
  cost_usd: number
}

export interface LLMOptions {
  temperature?: number
  max_tokens?: number
}

export class PipelineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PipelineError'
  }
}

export class LLMError extends Error {
  constructor(message: string, public isRateLimit: boolean = false) {
    super(message)
    this.name = 'LLMError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
