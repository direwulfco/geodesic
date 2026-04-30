import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { HarvestResult, GeodesicConfig, PhaseProgressEvent } from '@geodesic/types';
import { harvest } from '../harvester/index.js';
import { intercept } from '../intercept/index.js';
import { loadProvider, loadEchoProvider } from '../providers/index.js';
import { writeArtifacts } from '../artifacts/index.js';
import {
  computeFingerprint,
  queryCrystal,
  CrystalStore,
  getCrystalsDir,
  extractCrystal,
  pullCrystals,
  pushCrystals,
} from '../crystal/index.js';
import { synthesize, OVERALL_ANALYSIS_TIMEOUT_MS } from '../synthesis/index.js';
import { GEODESIC_VERSION } from '../version.js';
import {
  createJob,
  updateJobProgress,
  completeJob,
  failJob,
  type AnalysisJob,
  type JobResult,
} from './jobs.js';

function writeErrorLog(outputDir: string, stage: string, err: unknown): void {
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    const entry = [
      `timestamp: ${new Date().toISOString()}`,
      `geodesic: ${GEODESIC_VERSION}`,
      `node: ${process.version}`,
      `platform: ${process.platform}`,
      `stage: ${stage}`,
      `error: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error && err.stack ? `stack:\n${err.stack}` : '',
      '---',
    ].filter(Boolean).join('\n');
    fs.appendFileSync(path.join(outputDir, 'geodesic-error.log'), entry + '\n\n', 'utf8');
  } catch { /* non-fatal */ }
}

function writeAttestationChain(attestationPath: string, entries: unknown[]): void {
  if (entries.length === 0) return;
  try {
    fs.mkdirSync(path.dirname(attestationPath), { recursive: true });
    const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(attestationPath, lines, 'utf8');
  } catch (err) {
    process.stderr.write(`[geodesic] warn: could not write attestation chain: ${err instanceof Error ? err.message : String(err)}\n`);
  }
}

export interface PipelineOptions {
  repoPath: string;
  config: GeodesicConfig;
  outputDir?: string;
}

export function startPipeline(opts: PipelineOptions): AnalysisJob {
  const job = createJob(opts.repoPath);
  const hardCapTimer = setTimeout(() => {
    failJob(job.id, `Analysis exceeded ${String(Math.round(OVERALL_ANALYSIS_TIMEOUT_MS / 60_000))} min hard cap — job aborted. See geodesic-error.log.`);
  }, OVERALL_ANALYSIS_TIMEOUT_MS);
  void runPipeline(job.id, opts).finally(() => { clearTimeout(hardCapTimer); });
  return job;
}

async function runPipeline(jobId: string, opts: PipelineOptions): Promise<void> {
  const { repoPath, config } = opts;
  const repoName = path.basename(repoPath);
  const outputDir = opts.outputDir
    ?? config.outputDir
    ?? path.join(repoPath, 'geodesic-findings');

  // Protect geodesic-findings from being accidentally committed
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    const gitignorePath = path.join(outputDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(
        gitignorePath,
        '# Geodesic analysis artifacts — machine-generated, do not commit\n*\n!.gitignore\n',
        'utf8',
      );
    }
  } catch { /* non-fatal — downstream writes will retry mkdirSync */ }

  try {
    // 1. Harvest — with live progress events
    updateJobProgress(jobId, { status: 'harvesting', stage: 'Phase 1/4 — Building file catalog…' });

    const onHarvestProgress = (event: PhaseProgressEvent): void => {
      if (event.type === 'phase_start' || event.type === 'phase_complete') {
        updateJobProgress(jobId, { stage: event.message });
      } else if (event.type === 'discovery_finding') {
        updateJobProgress(jobId, { stage: event.message });
        process.stderr.write(`[geodesic] ${event.message}\n`);
      } else if (event.type === 'file_error') {
        writeErrorLog(outputDir, 'harvest-file-error', new Error(event.message));
      } else if (event.type === 'warning') {
        updateJobProgress(jobId, { stage: `⚠ ${event.message}` });
        writeErrorLog(outputDir, 'harvest-warning', new Error(event.message));
      }
    };

    const harvestResult: HarvestResult = harvest(repoPath, onHarvestProgress);

    // 2. PII/HIPAA Intercept
    updateJobProgress(jobId, { status: 'scrubbing', stage: 'Scrubbing PII/PHI…' });
    const interceptResult = intercept(harvestResult, {
      analystId: config.analystId,
      repo: repoName,
      repoCommit: harvestResult.meta.repoCommit ?? 'unknown',
    });

    // Write compliance artifact immediately — stored outside the analyzed repo, never committed
    const attestationTs = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const attestationDir = path.join(os.homedir(), '.geodesic', 'attestations');
    const attestationPath = path.join(attestationDir, `${repoName}-${attestationTs}.jsonl`);
    writeAttestationChain(attestationPath, interceptResult.attestationEntries);

    const scrubbedHarvest = JSON.parse(interceptResult.scrubbedPayload) as HarvestResult;

    updateJobProgress(jobId, {
      phiZoneCount: interceptResult.phiCount,
      stage: `Scrubbing complete — ${String(interceptResult.phiCount)} PHI, ${String(interceptResult.piiCount)} PII, ${String(interceptResult.secretCount)} secrets found`,
    });

    // 3. Crystal query
    updateJobProgress(jobId, { status: 'querying-crystal', stage: 'Querying Crystal Store…' });
    const fingerprint = computeFingerprint(harvestResult);
    const crystalsDir = getCrystalsDir(undefined);
    const store = new CrystalStore(crystalsDir);

    if (!(config.advanced?.noCrystalSync)) {
      const syncResult = await pullCrystals(crystalsDir, config);
      if (!syncResult.success) {
        process.stderr.write(`[geodesic] crystal sync: ${syncResult.message}\n`);
      }
    }

    const queryResult = queryCrystal(fingerprint, store.getAll());
    const crystalMatch = queryResult.matchType === 'exact' ? 'hit'
      : queryResult.matchType === 'fuzzy' ? 'hit'
      : 'cold-start';

    updateJobProgress(jobId, {
      crystalMatch,
      crystalMatchScore: queryResult.matchScore > 0 ? queryResult.matchScore : null,
      stage: queryResult.crystal
        ? `Crystal hit: ${fingerprint} (${String(Math.round(queryResult.matchScore * 100))}% match)`
        : 'No matching Crystal — cold-start analysis',
    });

    // 4. AI Synthesis
    updateJobProgress(jobId, { status: 'synthesizing', stage: 'Synthesizing with AI…' });
    const provider = await loadProvider(config);
    const echoProvider = await loadEchoProvider(config);

    const synthesis = await synthesize({
      harvest: scrubbedHarvest,
      crystal: queryResult.crystal,
      crystalMatchScore: queryResult.matchScore > 0 ? queryResult.matchScore : null,
      provider,
      echoProvider,
      analystId: config.analystId,
      repo: repoName,
      repoCommit: harvestResult.meta.repoCommit ?? 'unknown',
      onWarning: (msg) => {
        updateJobProgress(jobId, { stage: `⚠ ${msg}` });
        writeErrorLog(outputDir, 'synthesis-warning', new Error(msg));
      },
    });

    // 5. Write artifacts
    updateJobProgress(jobId, { status: 'writing', stage: 'Writing analysis artifacts…' });
    const artifactPaths = writeArtifacts(synthesis, outputDir);

    // 6. Crystal extraction & push
    const extraction = extractCrystal({
      fingerprint,
      existing: queryResult.crystal,
      synthesis,
    });

    if (extraction.purityPassed) {
      store.write(extraction.crystal);
      if (!(config.advanced?.noCrystalSync)) {
        const pushResult = await pushCrystals(crystalsDir, extraction.crystal, config);
        if (!pushResult.success) {
          process.stderr.write(`[geodesic] crystal push: ${pushResult.message}\n`);
        }
      }
    }

    const result: JobResult = {
      synthesis,
      artifactPaths,
      interceptStats: {
        phiCount: interceptResult.phiCount,
        piiCount: interceptResult.piiCount,
        secretCount: interceptResult.secretCount,
      },
      uncertainDetections: interceptResult.uncertainDetections,
      fingerprint,
    };

    completeJob(jobId, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeErrorLog(outputDir, 'pipeline', err);
    failJob(jobId, `${message} — see geodesic-error.log in output directory`);
  }
}
