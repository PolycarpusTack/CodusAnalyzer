import { randomUUID } from 'crypto';

export interface ReviewJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  code: string;
  language: string;
  fileName: string;
  preset: string;
  enabledCategories: {
    security: boolean;
    performance: boolean;
    maintainability: boolean;
    style: boolean;
  } | undefined;
  customPrompt: string | undefined;
  createdAt: Date;
  completedAt: Date | null;
  result: any;
  error: string | null;
  progress: string;
}

type EnqueueParams = Omit<ReviewJob, 'id' | 'status' | 'createdAt' | 'completedAt' | 'result' | 'error' | 'progress'>;

const JOB_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

class ReviewQueue {
  private jobs: Map<string, ReviewJob> = new Map();
  private maxConcurrent: number = 2;
  private activeCount: number = 0;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Auto-cleanup expired jobs every 5 minutes
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  enqueue(params: EnqueueParams): string {
    const id = randomUUID();
    const job: ReviewJob = {
      ...params,
      id,
      status: 'pending',
      createdAt: new Date(),
      completedAt: null,
      result: null,
      error: null,
      progress: 'Queued for review',
    };
    this.jobs.set(id, job);
    this.tryProcessNext();
    return id;
  }

  getJob(id: string): ReviewJob | undefined {
    return this.jobs.get(id);
  }

  getJobs(): ReviewJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async processNext(): Promise<void> {
    const pending = Array.from(this.jobs.values())
      .filter((j) => j.status === 'pending')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const job = pending[0];
    if (!job) return;

    job.status = 'processing';
    job.progress = 'Running static analysis...';
    this.activeCount++;

    try {
      // Call the review API internally by making a fetch to ourselves
      job.progress = 'Performing AI-powered code review...';

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: job.code,
          language: job.language,
          fileName: job.fileName,
          preset: job.preset,
          enabledCategories: job.enabledCategories,
          customPrompt: job.customPrompt,
          saveHistory: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorBody.error || `Review API returned ${response.status}`);
      }

      const result = await response.json();
      job.result = result;
      job.status = 'completed';
      job.progress = 'Review completed';
      job.completedAt = new Date();
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
      job.progress = 'Review failed';
      job.completedAt = new Date();
    } finally {
      this.activeCount--;
      this.tryProcessNext();
    }
  }

  deleteJob(id: string): void {
    this.jobs.delete(id);
  }

  private tryProcessNext(): void {
    if (this.activeCount >= this.maxConcurrent) return;

    const hasPending = Array.from(this.jobs.values()).some(
      (j) => j.status === 'pending'
    );
    if (hasPending) {
      // Fire-and-forget — processNext handles its own errors
      this.processNext().catch(() => {});
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (now - job.createdAt.getTime() > JOB_EXPIRY_MS) {
        this.jobs.delete(id);
      }
    }
  }
}

// Singleton
export const reviewQueue = new ReviewQueue();
