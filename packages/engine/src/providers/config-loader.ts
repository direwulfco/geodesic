import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { GeodeConfig } from '@geode/types';

const CONFIG_RELATIVE = path.join('.geode', 'config.json');

function readConfig(filePath: string): GeodeConfig | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as GeodeConfig;
  } catch {
    return null;
  }
}

/**
 * Loads Geode config from (in order):
 *   1. explicitPath (from --config CLI flag)
 *   2. .geode/config.json in CWD
 *   3. ~/.geode/config.json
 *
 * Throws a descriptive error if none found.
 */
export function loadConfig(explicitPath?: string, homeDir?: string): GeodeConfig {
  if (explicitPath) {
    const cfg = readConfig(explicitPath);
    if (!cfg) {
      throw new Error(`Config file not found or invalid JSON: ${explicitPath}`);
    }
    return cfg;
  }

  const cwdConfig = readConfig(path.join(process.cwd(), CONFIG_RELATIVE));
  if (cwdConfig) return cwdConfig;

  const homeConfig = readConfig(path.join(homeDir ?? os.homedir(), CONFIG_RELATIVE));
  if (homeConfig) return homeConfig;

  throw new Error(
    'No Geode config found. Run: geode config set provider <anthropic|openai|gemini|azure|ollama>\n' +
    'Config is looked up in .geode/config.json (project) then ~/.geode/config.json (home).',
  );
}
