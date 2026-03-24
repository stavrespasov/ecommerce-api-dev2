import { describe, it, expect } from 'vitest';
import { AIJobService } from '../services/AIJobService';

describe('AIJobService multi-tenancy', () => {
  it('should not return jobs for wrong client', async () => {
    const jobA = await AIJobService.createJob('PRODUCT_DESCRIPTION', { title: 'A', category: 'c', attributes: {} }, 'clientA');
    await AIJobService.createJob('RETURN_CLASSIFICATION', { reason_text: 'x', order_id: '1', product_id: 'p1' }, 'clientB');

    const jobsA = await AIJobService.listJobs('clientA', {});
    const jobsB = await AIJobService.listJobs('clientB', {});

    expect(jobsA.map((j) => j.clientId)).toEqual(['clientA']);
    expect(jobsB.map((j) => j.clientId)).toEqual(['clientB']);
    expect(jobsA.find((j) => j.id === jobA.id)).toBeDefined();
    expect(jobsB.find((j) => j.id === jobA.id)).toBeUndefined();
  });
});
