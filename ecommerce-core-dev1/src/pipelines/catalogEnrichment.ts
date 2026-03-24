import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { PipelineError } from '../types'
import { loadTemplate, interpolate } from '../llm/prompts'
import { LLMClient } from '../llm/client'

const prisma = new PrismaClient()
const llmClient = new LLMClient()

const inputSchema = z.object({
  raw_row: z.record(z.string())
})

const outputSchema = z.object({
  title: z.string(),
  category: z.string(),
  attributes: z.record(z.string()),
  suggested_tags: z.array(z.string()),
  quality_score: z.number()
})

export function validate(input: any) {
  const result = inputSchema.safeParse(input)
  if (!result.success) {
    throw new PipelineError(`Validation failed: ${result.error.message}`)
  }
  return result.data
}

export async function run(input: any, clientId: string, existingJobId?: string) {
  const validatedInput = validate(input)
  
  let jobId = existingJobId
  if (!jobId) {
    const job = await prisma.aIJob.create({
      data: {
        client_id: clientId,
        type: 'CATALOG_ENRICHMENT',
        input: validatedInput as any,
        status: 'PROCESSING'
      }
    })
    jobId = job.id
  }

  const template = await loadTemplate('catalog-enrichment')
  const prompt = interpolate(template, {
    raw_row: JSON.stringify(validatedInput.raw_row)
  })

  const result = await llmClient.complete(prompt)
  
  let output
  try {
    output = JSON.parse(result.text)
    output = outputSchema.parse(output)
  } catch (e: any) {
    throw new PipelineError(`Failed to parse LLM output: ${e.message}`)
  }

  const isLowQuality = output.quality_score < 0.6
  const status = isLowQuality ? 'FAILED' : 'COMPLETED'
  const error = isLowQuality ? 'Quality score below 0.6' : null

  await prisma.aIJob.update({
    where: { id: jobId },
    data: {
      output,
      model_used: result.model,
      tokens_used: result.tokens_used,
      cost_usd: result.cost_usd,
      status,
      ...(error && { error })
    }
  })

  if (isLowQuality) {
    throw new PipelineError(error!)
  }

  return output
}
