import { PipelineInput, ClientConfig, JobStatus } from '@packages/core';

// STUB: pending Dev 1 implementation
export interface Job {
  id: string;
  clientId: string;
  type: string;
  status: JobStatus;
  input: PipelineInput;
  output?: unknown;
  createdAt: string;
  updatedAt: string;
  estimatedSeconds?: number;
}

const jobs = new Map<string, Job>();

export class AIJobService {
  static async createJob(type: string, input: PipelineInput, clientId: string): Promise<Job> {
    const id = `job_${Date.now()}_${Math.random().toString(16).substring(2)}`;
    const now = new Date().toISOString();
    const job: Job = {
      id,
      clientId,
      type,
      status: 'pending' as JobStatus,
      input,
      createdAt: now,
      updatedAt: now,
      estimatedSeconds: 10,
    };
    jobs.set(id, job);
    return job;
  }

  static async getJob(id: string): Promise<Job | null> {
    return jobs.get(id) ?? null;
  }

  static async listJobs(clientId: string, params?: { status?: string; type?: string; limit?: number; cursor?: string }): Promise<Job[]> {
    const items = Array.from(jobs.values()).filter((job) => job.clientId === clientId);
    let filtered = items;

    if (params?.status) filtered = filtered.filter((job) => job.status === params.status);
    if (params?.type) filtered = filtered.filter((job) => job.type === params.type);

    const sorted = filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const start = params?.cursor ? sorted.findIndex((job) => job.id === params.cursor) + 1 : 0;
    const limit = params?.limit ? Math.min(params.limit, 100) : 20;

    return sorted.slice(start, start + limit);
  }
}

