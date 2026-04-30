import { randomUUID } from 'crypto';
import type { SynthesisResult, UncertainDetection } from '@geode/types';
import type { ArtifactPaths } from '../artifacts/index.js';

export type JobStatus =
  | 'queued'
  | 'harvesting'
  | 'scrubbing'
  | 'querying-crystal'
  | 'synthesizing'
  | 'writing'
  | 'complete'
  | 'failed';

export interface JobProgress {
  status: JobStatus;
  stage: string;
  phiZoneCount: number;
  crystalMatch: 'hit' | 'miss' | 'cold-start' | null;
  crystalMatchScore: number | null;
}

export interface JobResult {
  synthesis: SynthesisResult;
  artifactPaths: ArtifactPaths;
  interceptStats: { phiCount: number; piiCount: number; secretCount: number };
  uncertainDetections: UncertainDetection[];
  fingerprint: string;
}

export interface AnalysisJob {
  id: string;
  repoPath: string;
  startedAt: string;
  progress: JobProgress;
  result: JobResult | null;
  error: string | null;
}

const jobs = new Map<string, AnalysisJob>();

const MAX_JOBS = 500;
const JOB_TTL_MS = 24 * 60 * 60 * 1000;

function pruneJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - new Date(job.startedAt).getTime() > JOB_TTL_MS) jobs.delete(id);
  }
  if (jobs.size > MAX_JOBS) {
    const sorted = [...jobs.entries()].sort(
      (a, b) => new Date(a[1].startedAt).getTime() - new Date(b[1].startedAt).getTime(),
    );
    for (const [id] of sorted.slice(0, jobs.size - MAX_JOBS)) jobs.delete(id);
  }
}

export function createJob(repoPath: string): AnalysisJob {
  pruneJobs();
  const id = randomUUID();
  const job: AnalysisJob = {
    id,
    repoPath,
    startedAt: new Date().toISOString(),
    progress: { status: 'queued', stage: 'Queued', phiZoneCount: 0, crystalMatch: null, crystalMatchScore: null },
    result: null,
    error: null,
  };
  jobs.set(id, job);
  return job;
}

export function updateJobProgress(id: string, progress: Partial<JobProgress>): void {
  const job = jobs.get(id);
  if (!job) return;
  job.progress = { ...job.progress, ...progress };
}

export function completeJob(id: string, result: JobResult): void {
  const job = jobs.get(id);
  if (!job) return;
  job.result = result;
  job.progress.status = 'complete';
  job.progress.stage = 'Complete';
}

export function failJob(id: string, error: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.error = error;
  job.progress.status = 'failed';
  job.progress.stage = `Failed: ${error}`;
}

export function getJob(id: string): AnalysisJob | null {
  return jobs.get(id) ?? null;
}
