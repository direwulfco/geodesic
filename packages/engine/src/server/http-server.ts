import * as http from 'http';
import type { GeodeConfig } from '@geode/types';
import { loadConfig } from '../providers/index.js';
import { loadProvider } from '../providers/index.js';
import { CrystalStore, getCrystalsDir, pullCrystals } from '../crystal/index.js';
import { startPipeline } from './pipeline.js';
import { getJob } from './jobs.js';

const MAX_BODY_BYTES = 64 * 1024;
const ANALYZE_RATE_LIMIT = 10;
const ANALYZE_RATE_WINDOW_MS = 60_000;
const analyzeCallTimes: number[] = [];
const inFlightRepos = new Set<string>();

function json(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'vscode-webview://*' });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy(new Error('Request body too large'));
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => { resolve(body); });
    req.on('error', reject);
  });
}

function checkAnalyzeRateLimit(): boolean {
  const now = Date.now();
  while (analyzeCallTimes.length > 0 && analyzeCallTimes[0]! < now - ANALYZE_RATE_WINDOW_MS) {
    analyzeCallTimes.shift();
  }
  if (analyzeCallTimes.length >= ANALYZE_RATE_LIMIT) return false;
  analyzeCallTimes.push(now);
  return true;
}

function parseJsonBody(raw: string): Record<string, unknown> | null {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse, serverVersion: string): Promise<void> {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    try {
      // GET /health
      if (method === 'GET' && url === '/health') {
        json(res, 200, { ok: true, version: serverVersion });
        return;
      }

      // GET /config
      if (method === 'GET' && url === '/config') {
        try {
          const config = loadConfig();
          json(res, 200, config);
        } catch {
          json(res, 404, { error: 'No configuration found. Run: geode config set provider <name>' });
        }
        return;
      }

      // POST /config/test
      if (method === 'POST' && url === '/config/test') {
        try {
          const config = loadConfig();
          const provider = await loadProvider(config);
          const health = await provider.healthCheck();
          json(res, 200, health);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          json(res, 400, { healthy: false, error: message, latencyMs: 0 });
        }
        return;
      }

      // GET /crystals
      if (method === 'GET' && url === '/crystals') {
        const store = new CrystalStore(getCrystalsDir(undefined));
        json(res, 200, store.getAll());
        return;
      }

      // POST /crystals/sync
      if (method === 'POST' && url === '/crystals/sync') {
        const crystalsDir = getCrystalsDir(undefined);
        let syncConfig: import('../crystal/github-sync.js').CrystalSyncConfig = {};
        try { syncConfig = loadConfig(); } catch { /* no config yet */ }
        const result = await pullCrystals(crystalsDir, syncConfig);
        json(res, result.success ? 200 : 500, result);
        return;
      }

      // POST /analyze
      if (method === 'POST' && url === '/analyze') {
        if (!checkAnalyzeRateLimit()) {
          json(res, 429, { error: 'Too many analysis requests — wait 60 seconds and try again' });
          return;
        }

        let body: string;
        try {
          body = await readBody(req);
        } catch {
          json(res, 413, { error: 'Request body too large (max 64 KB)' });
          return;
        }

        const parsed = parseJsonBody(body);
        const repoPath = typeof parsed?.['repoPath'] === 'string' ? parsed['repoPath'] : null;
        const outputDir = typeof parsed?.['outputDir'] === 'string' ? parsed['outputDir'] : undefined;

        if (!repoPath) {
          json(res, 400, { error: 'repoPath is required and must be a string' });
          return;
        }

        if (inFlightRepos.has(repoPath)) {
          json(res, 409, { error: `Analysis already running for: ${repoPath}` });
          return;
        }

        let config: GeodeConfig;
        try {
          config = loadConfig();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          json(res, 400, { error: `No configuration: ${message}` });
          return;
        }

        inFlightRepos.add(repoPath);
        const job = startPipeline({ repoPath, config, outputDir });

        // Release the in-flight lock when the pipeline finishes (poll the job state)
        const pollInterval = setInterval(() => {
          const j = getJob(job.id);
          // Release lock when complete, failed, OR when job has been pruned from store
          if (!j || j.progress.status === 'complete' || j.progress.status === 'failed') {
            inFlightRepos.delete(repoPath);
            clearInterval(pollInterval);
          }
        }, 2000);

        json(res, 202, { jobId: job.id, status: job.progress.status });
        return;
      }

      // GET /jobs/:id
      if (method === 'GET' && url.startsWith('/jobs/')) {
        const id = url.slice('/jobs/'.length);
        const job = getJob(id);
        if (!job) {
          json(res, 404, { error: `Job not found: ${id}` });
          return;
        }
        json(res, 200, job);
        return;
      }

      json(res, 404, { error: `Unknown endpoint: ${method} ${url}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      json(res, 500, { error: message });
    }
}

export function createServer(serverVersion: string): http.Server {
  return http.createServer((req, res) => {
    void handleRequest(req, res, serverVersion);
  });
}
