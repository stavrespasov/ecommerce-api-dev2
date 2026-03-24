import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { PipelineError } from '../types'
import { loadTemplate, interpolate } from '../llm/prompts'
import { LLMClient } from '../llm/client'

const prisma = new PrismaClient()
const llmClient = new LLMClient()

const inputSchema = z.object({
  reason_text: z.string(),
  order_id: z.string(),
  product_id: z.string()
})

const outputSchema = z.object({
  action: z.enum(['REFUND', 'EXCHANGE', 'REJECT', 'REVIEW']),
  confidence: z.number(),
  reason: z.string()
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
        type: 'RETURN_CLASSIFICATION',
        input: validatedInput as any,
        status: 'PROCESSING'
      }
    })
    jobId = job.id
  }

  const template = await loadTemplate('return-classification')
  const prompt = interpolate(template, {
    reason_text: validatedInput.reason_text,
    product_id: validatedInput.product_id,
    order_id: validatedInput.order_id
  })

  const result = await llmClient.complete(prompt)
  
  let output
  try {
    output = JSON.parse(result.text)
    output = outputSchema.parse(output)
  } catch (e: any) {
    throw new PipelineError(`Failed to parse LLM output: ${e.message}`)
  }

  if (output.confidence < 0.7) {
    output.action = 'REVIEW'
  }

  await prisma.aIJob.update({
    where: { id: jobId },
    data: {
      output,
      model_used: result.model,
      tokens_used: result.tokens_used,
      cost_usd: result.cost_usd,
      status: 'COMPLETED'
    }
  })

  return output
}
