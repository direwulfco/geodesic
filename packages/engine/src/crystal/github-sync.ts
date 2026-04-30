import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Crystal } from '@geode/types';
import { generateCrystalIndex, buildFitnessLogEntry } from './index-writer.js';
import { CrystalStore } from './store.js';

const execFileAsync = promisify(execFile);

const SYNC_STATE_FILE = '.geode-sync-state.json';
const FITNESS_LOG_FILE = 'fitness_log.jsonl';
const INDEX_FILE = 'CRYSTAL_INDEX.md';
const MAX_CONSECUTIVE_FAILURES = 3;
// Only these files are ever staged — attestation, secrets, and arbitrary files are never committed
const SAFE_STAGE_PATTERNS = [INDEX_FILE, FITNESS_LOG_FILE, SYNC_STATE_FILE];

interface SyncState {
  consecutiveFailures: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
}

export interface SyncResult {
  success: boolean;
  message: string;
  requiresAction: boolean;
}

export interface CrystalSyncConfig {
  crystalStoreRepo?: string;
  crystalStoreToken?: string;
}

function readSyncState(crystalsDir: string): SyncState {
  try {
    const raw = fs.readFileSync(path.join(crystalsDir, SYNC_STATE_FILE), 'utf8');
    return JSON.parse(raw) as SyncState;
  } catch {
    return { consecutiveFailures: 0, lastPushAt: null, lastPullAt: null };
  }
}

function writeSyncState(crystalsDir: string, state: SyncState): void {
  try {
    fs.writeFileSync(
      path.join(crystalsDir, SYNC_STATE_FILE),
      JSON.stringify(state, null, 2),
      'utf8',
    );
  } catch {
    // Non-fatal — sync state is best-effort bookkeeping
  }
}

function authedUrl(repoUrl: string, token: string): string {
  return repoUrl.replace(/^https:\/\//, `https://x-access-token:${token}@`);
}

async function git(cwd: string, args: string[]): Promise<{ success: boolean; stderr: string; stdout: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd, encoding: 'utf8' });
    return { success: true, stderr: (stderr ?? '').trim(), stdout: (stdout ?? '').trim() };
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string };
    return { success: false, stderr: (e.stderr ?? '').trim(), stdout: (e.stdout ?? '').trim() };
  }
}

async function isGitRepo(dir: string): Promise<boolean> {
  if (!fs.existsSync(dir)) return false;
  const result = await git(dir, ['rev-parse', '--git-dir']);
  return result.success;
}

async function cloneRepo(repoUrl: string, targetDir: string, token?: string): Promise<SyncResult> {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  const url = token ? authedUrl(repoUrl, token) : repoUrl;
  const result = await git(path.dirname(targetDir), ['clone', url, path.basename(targetDir)]);
  if (result.success) {
    return { success: true, requiresAction: false, message: 'Crystal Store initialized from your repository' };
  }
  return {
    success: false,
    requiresAction: true,
    message: `Failed to clone Crystal Store: ${result.stderr || 'unknown error'}`,
  };
}

function regenerateIndex(crystalsDir: string): void {
  const store = new CrystalStore(crystalsDir);
  const crystals = store.getAll();
  const now = new Date().toISOString();
  try {
    fs.writeFileSync(path.join(crystalsDir, INDEX_FILE), generateCrystalIndex(crystals, now), 'utf8');
  } catch { /* non-fatal */ }
}

function appendFitnessLog(crystalsDir: string, crystal: Crystal, success: boolean): void {
  try {
    const entry = buildFitnessLogEntry(crystal, success);
    fs.appendFileSync(
      path.join(crystalsDir, FITNESS_LOG_FILE),
      JSON.stringify(entry) + '\n',
      'utf8',
    );
  } catch { /* non-fatal */ }
}

export async function pullCrystals(crystalsDir: string, config?: CrystalSyncConfig): Promise<SyncResult> {
  if (!(await isGitRepo(crystalsDir))) {
    if (!config?.crystalStoreRepo) {
      return {
        success: false,
        requiresAction: false,
        message: 'No Crystal Store configured — running local-only. Set one with: geode config set crystal-store-repo <url>',
      };
    }
    return cloneRepo(config.crystalStoreRepo, crystalsDir, config.crystalStoreToken);
  }

  const now = new Date().toISOString();
  const state = readSyncState(crystalsDir);
  const result = await git(crystalsDir, ['pull', '--ff-only']);

  if (result.success) {
    writeSyncState(crystalsDir, { ...state, lastPullAt: now, consecutiveFailures: 0 });
    return { success: true, requiresAction: false, message: 'Crystal Store updated' };
  }

  return {
    success: false,
    requiresAction: false,
    message: `Sync failed: ${result.stderr}. Continuing with local cache.`,
  };
}

export async function pushCrystals(
  crystalsDir: string,
  crystal: Crystal,
  config?: CrystalSyncConfig,
): Promise<SyncResult> {
  if (!(await isGitRepo(crystalsDir))) {
    return {
      success: false,
      requiresAction: false,
      message: 'Crystal Store is not a git repository — skipping sync',
    };
  }

  const now = new Date().toISOString();
  const state = readSyncState(crystalsDir);

  regenerateIndex(crystalsDir);
  appendFitnessLog(crystalsDir, crystal, true);

  // Stage only known-safe crystal files — never git add -A which could capture arbitrary files
  if (!/^[a-zA-Z0-9_+\-.]{1,256}$/.test(crystal.stackFingerprint)) {
    return { success: false, requiresAction: false, message: `Invalid fingerprint — cannot stage crystal files` };
  }
  const crystalFile = path.join(crystal.stackFingerprint, 'crystal.json');
  const filesToStage = [crystalFile, INDEX_FILE, FITNESS_LOG_FILE, SYNC_STATE_FILE];
  const existingFiles = filesToStage.filter(f => fs.existsSync(path.join(crystalsDir, f)));

  if (existingFiles.length === 0) {
    return { success: false, requiresAction: false, message: 'No crystal files to stage' };
  }

  const addResult = await git(crystalsDir, ['add', '--', ...existingFiles]);
  if (!addResult.success) {
    return { success: false, requiresAction: false, message: `git add failed: ${addResult.stderr}` };
  }

  const commitMsg = `crystal: update ${crystal.stackFingerprint} (use_count: ${String(crystal.fitness.useCount)}, fitness: ${crystal.fitness.fitnessScore.toFixed(2)})`;
  const commitResult = await git(crystalsDir, ['commit', '-m', commitMsg]);
  if (!commitResult.success) {
    if (commitResult.stderr.includes('nothing to commit') || commitResult.stdout.includes('nothing to commit')) {
      return { success: true, requiresAction: false, message: 'Nothing to sync — crystal unchanged' };
    }
    return { success: false, requiresAction: false, message: `git commit failed: ${commitResult.stderr}` };
  }

  const pushArgs = config?.crystalStoreToken
    ? ['-c', `url.${authedUrl('https://github.com/', config.crystalStoreToken)}.insteadOf=https://github.com/`, 'push']
    : ['push'];

  const pushResult = await git(crystalsDir, pushArgs);
  if (!pushResult.success) {
    const newFailures = state.consecutiveFailures + 1;
    writeSyncState(crystalsDir, { ...state, consecutiveFailures: newFailures });

    if (newFailures >= MAX_CONSECUTIVE_FAILURES) {
      return {
        success: false,
        requiresAction: true,
        message: `Crystal sync has failed ${String(newFailures)} times. Run: geode crystals sync\nError: ${pushResult.stderr}`,
      };
    }
    return {
      success: false,
      requiresAction: false,
      message: `Sync failed (will retry): ${pushResult.stderr}`,
    };
  }

  writeSyncState(crystalsDir, { ...state, consecutiveFailures: 0, lastPushAt: now });
  return {
    success: true,
    requiresAction: false,
    message: `Crystal synced to your repository: ${crystal.stackFingerprint}`,
  };
}
