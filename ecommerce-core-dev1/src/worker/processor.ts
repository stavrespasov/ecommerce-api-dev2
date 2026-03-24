import { Worker, Job } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { AIJobService } from '../services/AIJobService'
import { run as runProductDescription } from '../pipelines/productDescription'
import { run as runCatalogEnrichment } from '../pipelines/catalogEnrichment'
import { run as runReturnClassification } from '../pipelines/returnClassification'

const prisma = new PrismaClient()

const connection = {
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
}

export const worker = new Worker('ai-jobs', async (job: Job) => {
  const { jobId, type, input, clientId } = job.data

  await prisma.aIJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' }
  })

  let output
  try {
    if (type === 'PRODUCT_DESCRIPTION') {
      output = await runProductDescription(input, clientId, jobId)
    } else if (type === 'CATALOG_ENRICHMENT') {
      output = await runCatalogEnrichment(input, clientId, jobId)
    } else if (type === 'RETURN_CLASSIFICATION') {
      output = await runReturnClassification(input, clientId, jobId)
    } else {
      throw new Error(`Unknown pipeline type: ${type}`)
    }

    const updatedJob = await prisma.aIJob.findUnique({ where: { id: jobId }})

    AIJobService.emit('job.completed', {
      jobId, 
      clientId, 
      type, 
      output, 
      tokens_used: updatedJob?.tokens_used, 
      cost_usd: updatedJob?.cost_usd
    })
    
    return output
  } catch (error: any) {
    if (job.attemptsMade === (job.opts.attempts || 3) - 1) {
      await prisma.aIJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', error: error.message }
      })
      AIJobService.emit('job.failed', {
        jobId, clientId, type, error: error.message
      })
    }
    throw error
  }
}, {
  connection,
  concurrency: 3,
  settings: {
    backoffStrategies: {
      customExp: (attemptsMade: number) => {
        return Math.pow(4, attemptsMade - 1) * 1000
      }
    }
  }
})

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with ${err.message}`)
})
