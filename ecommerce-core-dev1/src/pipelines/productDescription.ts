import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { PipelineError } from '../types'
import { loadTemplate, interpolate } from '../llm/prompts'
import { LLMClient } from '../llm/client'

const prisma = new PrismaClient()
const llmClient = new LLMClient()

const inputSchema = z.object({
  title: z.string(),
  category: z.string(),
  attributes: z.record(z.string())
})

const outputSchema = z.object({
  description: z.string(),
  meta_title: z.string(),
  meta_description: z.string()
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
        type: 'PRODUCT_DESCRIPTION',
        input: validatedInput as any,
        status: 'PROCESSING'
      }
    })
    jobId = job.id
  }

  const template = await loadTemplate('product-description')
  const prompt = interpolate(template, {
    title: validatedInput.title,
    category: validatedInput.category,
    attributes_json: JSON.stringify(validatedInput.attributes)
  })

  const result = await llmClient.complete(prompt)
  
  let output
  try {
    output = JSON.parse(result.text)
    output = outputSchema.parse(output)
  } catch (e: any) {
    throw new PipelineError(`Failed to parse LLM output: ${e.message}`)
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
