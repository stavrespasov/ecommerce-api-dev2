import { vi, describe, it, expect } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { AIJobService } from '../services/AIJobService'
import { run as runProductDescription } from '../pipelines/productDescription'
import { run as runReturnClassification } from '../pipelines/returnClassification'
import { LLMClient } from '../llm/client'

// Mock dependencies
vi.mock('../llm/client')
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({})
  })),
  Worker: vi.fn()
}))

const prisma = new PrismaClient()

describe('Integration Tests', () => {
  it('product description pipeline end to end', async () => {
    const mockComplete = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        description: 'Amazing product',
        meta_title: 'Amazing',
        meta_description: 'Buy it'
      }),
      model: 'mock-model',
      tokens_used: 100,
      cost_usd: 0.05
    })
    vi.mocked(LLMClient.prototype.complete).mockImplementation(mockComplete)

    const client = await prisma.client.create({
      data: { name: 'Test Client 1' }
    })
    
    await prisma.promptTemplate.create({
      data: {
        name: 'product-description',
        version: 1,
        content: 'mock prompt',
        variables: ['title', 'category', 'attributes_json']
      }
    })

    const job = await AIJobService.createJob('PRODUCT_DESCRIPTION', {
      title: 'T-Shirt',
      category: 'Apparel',
      attributes: { color: 'red' }
    }, client.id)

    expect(job.status).toBe('PENDING')

    const output = await runProductDescription({
      title: 'T-Shirt',
      category: 'Apparel',
      attributes: { color: 'red' }
    }, client.id, job.id)

    expect(output.description).toBe('Amazing product')

    const updatedJob = await AIJobService.getJob(job.id, client.id)
    expect(updatedJob?.status).toBe('COMPLETED')
    expect(updatedJob?.tokens_used).toBe(100)
    expect(Number(updatedJob?.cost_usd)).toBeGreaterThan(0)
  })

  it('return classification forces REVIEW on low confidence', async () => {
    const mockComplete = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        action: 'REFUND',
        confidence: 0.5,
        reason: 'mock reason'
      }),
      model: 'mock-model',
      tokens_used: 50,
      cost_usd: 0.01
    })
    vi.mocked(LLMClient.prototype.complete).mockImplementation(mockComplete)

    const client = await prisma.client.create({
      data: { name: 'Test Client 2' }
    })
    
    await prisma.promptTemplate.create({
      data: {
        name: 'return-classification',
        version: 1,
        content: 'mock prompt',
        variables: ['reason_text', 'product_id', 'order_id']
      }
    })

    const job = await AIJobService.createJob('RETURN_CLASSIFICATION', {
      reason_text: 'broken',
      order_id: '123',
      product_id: '456'
    }, client.id)
    
    const output = await runReturnClassification({
      reason_text: 'broken',
      order_id: '123',
      product_id: '456'
    }, client.id, job.id)

    expect(output.action).toBe('REVIEW')
  })

  it('multi-tenancy: client A cannot get client B job', async () => {
    const clientA = await prisma.client.create({ data: { name: 'Client A' } })
    const clientB = await prisma.client.create({ data: { name: 'Client B' } })

    const jobA = await AIJobService.createJob('PRODUCT_DESCRIPTION', {
      title: 'A',
      category: 'A',
      attributes: {}
    }, clientA.id)

    const result = await AIJobService.getJob(jobA.id, clientB.id)
    expect(result).toBeNull()
  })
})
