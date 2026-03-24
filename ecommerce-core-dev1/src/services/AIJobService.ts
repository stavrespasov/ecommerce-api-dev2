import { EventEmitter } from 'events'
import { PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'
import { PipelineType, JobStatus, AIJob, PipelineInput, JobFilters, UsageSummary, ValidationError } from '../types'
import { validate as validateProductDesc } from '../pipelines/productDescription'
import { validate as validateCatalogEnrich } from '../pipelines/catalogEnrichment'
import { validate as validateReturnClass } from '../pipelines/returnClassification'

const prisma = new PrismaClient()

const queue = new Queue('ai-jobs', {
  connection: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  }
})

class AIJobServiceImpl extends EventEmitter {
  async createJob(type: PipelineType, input: PipelineInput, clientId: string): Promise<AIJob> {
    try {
      if (type === 'PRODUCT_DESCRIPTION') validateProductDesc(input)
      else if (type === 'CATALOG_ENRICHMENT') validateCatalogEnrich(input)
      else if (type === 'RETURN_CLASSIFICATION') validateReturnClass(input)
      else throw new ValidationError(`Unknown PipelineType: ${type}`)
    } catch (e: any) {
      throw new ValidationError(e.message)
    }

    const job = await prisma.aIJob.create({
      data: {
        client_id: clientId,
        type,
        input: input as any,
        status: 'PENDING'
      }
    })

    await queue.add(type, { jobId: job.id, type, input, clientId }, {
      jobId: job.id,
      attempts: 3,
      backoff: { type: 'customExp' }
    })

    return job as unknown as AIJob
  }

  async getJob(id: string, clientId: string): Promise<AIJob | null> {
    const job = await prisma.aIJob.findFirst({
      where: { id, client_id: clientId }
    })
    return job as unknown as AIJob | null
  }

  async listJobs(clientId: string, filters?: JobFilters): Promise<{ jobs: AIJob[], total: number }> {
    const where: any = { client_id: clientId }
    if (filters?.status) where.status = filters.status
    if (filters?.type) where.type = filters.type

    let cursorQuery = {}
    if (filters?.cursor) {
      cursorQuery = {
        cursor: { id: filters.cursor },
        skip: 1
      }
    }

    const limit = filters?.limit || 50

    const [jobs, total] = await Promise.all([
      prisma.aIJob.findMany({
        where,
        take: limit,
        ...cursorQuery,
        orderBy: { created_at: 'desc' }
      }),
      prisma.aIJob.count({ where })
    ])

    return { jobs: jobs as unknown as AIJob[], total }
  }

  async getUsage(clientId: string, since: Date): Promise<UsageSummary> {
    const aggregations = await prisma.aIJob.aggregate({
      where: {
        client_id: clientId,
        created_at: { gte: since },
        status: 'COMPLETED'
      },
      _sum: {
        tokens_used: true,
        cost_usd: true
      }
    })

    return {
      tokens_used: aggregations._sum.tokens_used || 0,
      cost_usd: Number(aggregations._sum.cost_usd) || 0
    }
  }
}

export const AIJobService = new AIJobServiceImpl()
