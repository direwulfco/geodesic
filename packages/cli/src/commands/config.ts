import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Command } from 'commander';
import type { GeodeConfig, ProviderName } from '@geode/types';
import { loadConfig, loadProvider } from '@geode/engine';

/* eslint-disable no-console */

const CONFIG_PATH = path.join(os.homedir(), '.geode', 'config.json');

const VALID_PROVIDERS: ProviderName[] = ['anthropic', 'openai', 'gemini', 'azure', 'ollama'];

function readExisting(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeConfig(updates: Record<string, unknown>): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const merged: Record<string, unknown> = { ...readExisting(), ...updates };
  if (!merged['analystId']) {
    merged['analystId'] = `${os.userInfo().username}@${os.hostname()}`;
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
}

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage Geode configuration');

  // config show
  configCmd
    .command('show')
    .description('Print current configuration (API key redacted)')
    .action(() => {
      try {
        const cfg = loadConfig() as unknown as Record<string, unknown>;
        const safe = { ...cfg };
        if (safe['apiKey']) safe['apiKey'] = '****';
        if (safe['crystalStoreToken']) safe['crystalStoreToken'] = '****';
        console.log(JSON.stringify(safe, null, 2));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[geode] ${msg}`);
        process.exit(2);
      }
    });

  // config check
  configCmd
    .command('check')
    .description('Verify connectivity to the configured AI provider')
    .option('--config <path>', 'Path to config file')
    .action(async (opts: { config?: string }) => {
      let cfg: GeodeConfig;
      try {
        cfg = loadConfig(opts.config);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[geode] config error: ${msg}`);
        process.exit(2);
        return;
      }

      console.log(`[geode] checking provider: ${cfg.provider}…`);
      try {
        const provider = await loadProvider(cfg);
        const health = await provider.healthCheck();
        if (health.healthy) {
          console.log(`[geode] ✓ provider healthy (${String(health.latencyMs)}ms)`);
        } else {
          console.error(`[geode] ✗ unhealthy: ${health.error ?? 'unknown error'}`);
          process.exit(1);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[geode] ✗ connection failed: ${msg}`);
        process.exit(1);
      }
    });

  // config set (subcommand group)
  const setCmd = configCmd
    .command('set')
    .description('Set a configuration value');

  setCmd
    .command('provider <name>')
    .description(`Set the AI provider (${VALID_PROVIDERS.join('|')})`)
    .action((name: string) => {
      if (!VALID_PROVIDERS.includes(name as ProviderName)) {
        console.error(`[geode] error: unknown provider "${name}"`);
        console.error(`[geode] valid providers: ${VALID_PROVIDERS.join(', ')}`);
        process.exit(2);
        return;
      }
      writeConfig({ provider: name });
      console.log(`[geode] provider → ${name}`);
      console.log(`[geode] config:    ${CONFIG_PATH}`);
    });

  setCmd
    .command('api-key <key>')
    .description('Set the API key for the configured provider')
    .action((key: string) => {
      if (!key.trim()) {
        console.error('[geode] error: api-key cannot be empty');
        process.exit(2);
        return;
      }
      writeConfig({ apiKey: key.trim() });
      console.log('[geode] API key saved');
      console.log(`[geode] config: ${CONFIG_PATH}`);
    });

  setCmd
    .command('output-dir <dir>')
    .description('Set the default output directory for analysis artifacts')
    .action((dir: string) => {
      const resolved = path.resolve(dir);
      writeConfig({ outputDir: resolved });
      console.log(`[geode] output directory → ${resolved}`);
    });

  setCmd
    .command('analyst-id <id>')
    .description('Set the analyst ID written to attestation chain entries')
    .action((id: string) => {
      writeConfig({ analystId: id });
      console.log(`[geode] analyst ID → ${id}`);
    });

  setCmd
    .command('crystal-store-repo <url>')
    .description('Set your Crystal Store repository URL (your own GitHub repo — Geode never touches it)')
    .action((url: string) => {
      if (!url.startsWith('https://') && !url.startsWith('git@')) {
        console.error('[geode] error: URL must start with https:// or git@');
        process.exit(2);
        return;
      }
      writeConfig({ crystalStoreRepo: url });
      console.log(`[geode] Crystal Store repo → ${url}`);
      console.log('[geode] Run: geode crystals sync  to initialize your local cache');
    });

  setCmd
    .command('crystal-store-token <token>')
    .description('Set the personal access token for your Crystal Store repository')
    .action((token: string) => {
      if (!token.trim()) {
        console.error('[geode] error: token cannot be empty');
        process.exit(2);
        return;
      }
      writeConfig({ crystalStoreToken: token.trim() });
      console.log('[geode] Crystal Store token saved');
    });
}

/* eslint-enable no-console */
