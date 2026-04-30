import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import { execSync } from 'child_process';

const PORT_PATTERN = /GEODE_ENGINE_PORT=(\d+)/;
const STARTUP_TIMEOUT_MS = 15_000;

export class EngineManager implements vscode.Disposable {
  private process: ChildProcess | null = null;
  private _port: number | null = null;
  private _startPromise: Promise<void> | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly _onStatusChange = new vscode.EventEmitter<string>();
  readonly onStatusChange = this._onStatusChange.event;

  get port(): number | null { return this._port; }

  private findEngineScript(context: vscode.ExtensionContext): string | null {
    // 1. Bundled engine (VSIX distribution — esbuild output alongside extension bundle)
    const bundledPath = path.join(context.extensionPath, 'dist', 'engine-start.js');
    if (fs.existsSync(bundledPath)) return bundledPath;

    // 2. Workspace symlink (monorepo dev)
    const wsPath = path.join(context.extensionPath, '..', '..', 'node_modules', '@geode', 'engine', 'dist', 'server', 'start.js');
    if (fs.existsSync(wsPath)) return wsPath;

    // 3. Extension node_modules
    const extPath = path.join(context.extensionPath, 'node_modules', '@geode', 'engine', 'dist', 'server', 'start.js');
    if (fs.existsSync(extPath)) return extPath;

    return null;
  }

  private findNodeBinary(): string {
    try {
      const result = execSync('node --version', { encoding: 'utf8', timeout: 5000 });
      if (result.startsWith('v')) return 'node';
    } catch { /* fall through */ }
    // Common locations
    for (const bin of ['/usr/local/bin/node', '/usr/bin/node', 'C:\\Program Files\\nodejs\\node.exe']) {
      if (fs.existsSync(bin)) return bin;
    }
    return 'node';
  }

  async start(context: vscode.ExtensionContext): Promise<void> {
    if (this.process) return;
    if (this._startPromise) return this._startPromise;
    this._startPromise = this._doStart(context).finally(() => { this._startPromise = null; });
    return this._startPromise;
  }

  private async _doStart(context: vscode.ExtensionContext): Promise<void> {
    this._onStatusChange.fire('Starting engine…');

    const scriptPath = this.findEngineScript(context);
    if (!scriptPath) {
      const choice = await vscode.window.showErrorMessage(
        'Geode engine not found. Install it via npm?',
        'Install Now',
        'Cancel',
      );
      if (choice === 'Install Now') {
        await this.installEngine();
        await this.start(context);
      }
      return;
    }

    return new Promise((resolve, reject) => {
      const node = this.findNodeBinary();
      const proc = spawn(node, [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      this.process = proc;

      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Engine failed to start within timeout'));
      }, STARTUP_TIMEOUT_MS);

      proc.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const match = PORT_PATTERN.exec(text);
        if (match?.[1]) {
          this._port = parseInt(match[1], 10);
          clearTimeout(timeout);
          this._onStatusChange.fire(`Engine running on port ${String(this._port)}`);
          this._startHeartbeat(context);
          resolve();
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) this._onStatusChange.fire(`Engine: ${msg}`);
      });

      proc.on('exit', (code) => {
        this.process = null;
        this._port = null;
        clearTimeout(timeout);
        this._stopHeartbeat();
        this._onStatusChange.fire('Engine stopped');
        if (code !== 0 && code !== null) {
          void vscode.window.showErrorMessage(
            `Geode engine exited with code ${String(code)}. Click to restart.`,
            'Restart',
          ).then(async choice => {
            if (choice === 'Restart') await this.start(context);
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private _startHeartbeat(context: vscode.ExtensionContext): void {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      const port = this._port;
      if (!port) return;
      void fetch(`http://127.0.0.1:${String(port)}/health`, { signal: AbortSignal.timeout(3000) })
        .catch(() => {
          this._onStatusChange.fire('Engine not responding — restarting…');
          this.stop();
          void this.start(context);
        });
    }, 30_000);
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private async installEngine(): Promise<void> {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Installing Geode engine…', cancellable: false },
      () => new Promise<void>((resolve, reject) => {
        const proc = spawn('npm', ['install', '-g', '@geode/cli'], { shell: true, stdio: 'inherit' });
        proc.on('exit', code => {
          if (code === 0) resolve();
          else reject(new Error(`npm install failed with code ${String(code)}`));
        });
        proc.on('error', reject);
      }),
    );
  }

  async restart(context: vscode.ExtensionContext): Promise<void> {
    this.stop();
    await this.start(context);
  }

  stop(): void {
    this._stopHeartbeat();
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      this._port = null;
    }
  }

  dispose(): void {
    this.stop();
    this._onStatusChange.dispose();
  }
}
