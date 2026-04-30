import * as vscode from 'vscode';
import type { ExtensionState } from './state.js';
import type { EngineManager } from './engine-manager.js';
import type { EngineClient } from './engine-client.js';

export type SidebarMessage =
  | { type: 'addRepo' }
  | { type: 'removeRepo'; path: string }
  | { type: 'runAnalysis'; paths: string[] }
  | { type: 'configureProvider'; provider: string; apiKey: string }
  | { type: 'testConnection' }
  | { type: 'syncCrystals' }
  | { type: 'useWorkspace'; path: string; name: string }
  | { type: 'scanWorkspace'; path: string; name: string }
  | { type: 'openExternal'; url: string }
  | { type: 'ready' };

export interface SidebarCallbacks {
  onRunAnalysis: (paths: string[]) => void;
  onConfigureProvider: (provider: string, apiKey: string) => Promise<void>;
  getClient: () => EngineClient | null;
  getConfigInfo: () => { provider: string; hasApiKey: boolean } | null;
}

function getSidebarHtml(webview: vscode.Webview, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Geode</title>
<style nonce="${nonce}">
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); padding: 0 8px 16px; }

  /* Typography */
  h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--vscode-sideBarSectionHeader-foreground); margin: 14px 0 6px; padding-top: 6px; border-top: 1px solid var(--vscode-sideBar-border, rgba(128,128,128,0.15)); }
  h3:first-child { border-top: none; margin-top: 8px; }

  /* Buttons */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 5px 10px; font-size: 12px; cursor: pointer; border-radius: 2px; font-family: inherit; border: none; outline: none; transition: opacity 0.1s; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .btn-primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
  .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .btn-secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
  .btn-ghost { background: none; border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.35)); color: var(--vscode-foreground); }
  .btn-ghost:hover:not(:disabled) { background: var(--vscode-list-hoverBackground); }
  .btn-link { background: none; border: none; color: var(--vscode-textLink-foreground); font-size: 11px; cursor: pointer; padding: 0; text-decoration: underline; }
  .btn-link:hover { color: var(--vscode-textLink-activeForeground); }
  .btn-icon { background: none; border: none; color: var(--vscode-foreground); opacity: 0.55; padding: 2px 4px; cursor: pointer; font-size: 13px; line-height: 1; }
  .btn-icon:hover { opacity: 1; }
  .full-width { width: 100%; }

  /* Start Scan — prominent primary CTA */
  .scan-btn {
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.03em;
    margin-top: 6px;
    border-radius: 3px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  }
  .scan-btn:hover:not(:disabled) { filter: brightness(1.08); }

  /* Forms */
  select, input[type=text], input[type=password] {
    width: 100%; padding: 4px 7px; font-size: 12px; font-family: inherit;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.35)); border-radius: 2px;
  }
  select:focus, input:focus { outline: 1px solid var(--vscode-focusBorder); border-color: var(--vscode-focusBorder); }
  label { display: block; font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 3px; }
  .label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
  .form-row { margin-bottom: 8px; }
  .input-row { display: flex; gap: 4px; align-items: center; }
  .input-row input { flex: 1; }

  /* Cards / Step cards */
  .step-card { background: var(--vscode-textBlockQuote-background); border-radius: 3px; padding: 10px 10px 12px; margin-bottom: 8px; }
  .step-card.locked { opacity: 0.45; pointer-events: none; }
  .step-header { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
  .step-num { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; font-size: 10px; font-weight: 700; background: var(--vscode-button-background); color: var(--vscode-button-foreground); flex-shrink: 0; }
  .step-num.done { background: var(--vscode-charts-green, #4caf50); }
  .step-title { font-size: 12px; font-weight: 600; }

  /* Status / Feedback */
  .status-bar { font-size: 10px; color: var(--vscode-descriptionForeground); padding: 4px 6px; background: var(--vscode-textBlockQuote-background); border-radius: 2px; margin-bottom: 8px; word-break: break-word; }
  .feedback { font-size: 11px; margin-top: 6px; padding: 4px 7px; border-radius: 2px; }
  .feedback.success { color: var(--vscode-charts-green, #4caf50); background: rgba(76,175,80,0.1); }
  .feedback.error { color: var(--vscode-charts-red, #f44336); background: rgba(244,67,54,0.1); }
  .feedback.info { color: var(--vscode-descriptionForeground); background: var(--vscode-textBlockQuote-background); }
  .hidden { display: none; }

  /* Config summary bar */
  .config-summary { display: flex; align-items: center; gap: 6px; font-size: 11px; padding: 5px 0; }
  .check { color: var(--vscode-charts-green, #4caf50); font-size: 13px; }
  .dot { color: var(--vscode-descriptionForeground); }
  .muted { color: var(--vscode-descriptionForeground); }

  /* Workspace buttons */
  .workspace-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 7px 10px; margin-bottom: 5px; text-align: left; }
  .workspace-btn .ws-name { font-size: 12px; font-weight: 600; }
  .workspace-btn .ws-path { font-size: 10px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }

  /* Repo list */
  .repo-item { display: flex; align-items: center; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--vscode-sideBar-border, rgba(128,128,128,0.15)); }
  .repo-label { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 155px; }
  .repo-path { font-size: 10px; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 155px; }
  .empty-state { font-size: 11px; color: var(--vscode-descriptionForeground); font-style: italic; padding: 6px 0; }

  /* Progress */
  .progress-bar { height: 3px; background: var(--vscode-progressBar-background); width: 0%; border-radius: 2px; margin-top: 6px; transition: width 0.4s; }
  .progress-stage { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 5px; }

  /* Crystal chip */
  .crystal-row { display: flex; align-items: center; justify-content: space-between; }
  .crystal-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; }

  /* Divider */
  .divider { border: none; border-top: 1px solid var(--vscode-sideBar-border, rgba(128,128,128,0.15)); margin: 10px 0; }

  /* Provider hint */
  .provider-hint { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 4px; }

  /* Repo select actions — scan + change repo stack */
  .repo-select-actions { display: flex; flex-direction: column; gap: 20px; width: 100%; }

  /* Config form save row */
  .config-save-row { display: flex; gap: 6px; margin-top: 10px; }
  .config-save-row .save-btn { flex: 1; padding: 6px; }
  .config-save-row .test-btn { padding: 6px 10px; }

  /* Config step small buttons */
  .cancel-btn { margin-top: 8px; font-size: 11px; }
  .key-link { font-size: 10px; }

  /* Workspace detected label */
  .ws-label { margin-bottom: 8px; font-size: 11px; color: var(--vscode-descriptionForeground); }

  /* Change Repo / browse button sizing */
  .change-repo-btn { font-size: 11px; padding: 6px; }
  .browse-repo-btn { padding: 7px; }

  /* Config summary edit link */
  .edit-link { margin-left: auto; }

  /* Warning inline text */
  .warn-inline { color: var(--vscode-charts-yellow, #ffc107); }

  /* Repo list add row */
  .add-repo-row { margin-top: 6px; }
  .add-repo-btn { font-size: 11px; padding: 4px 12px; }

  /* Progress detail lines */
  .phi-warning { font-size: 10px; color: var(--vscode-charts-yellow, #ffc107); margin-top: 3px; }
  .crystal-info { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 2px; }

  /* Sync button */
  .sync-btn { font-size: 11px; padding: 3px 8px; }
</style>
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}">
(function() {
  const vscode = acquireVsCodeApi();
  let state = {
    repos: [],
    workspaceFolders: [],
    engineStatus: 'Starting engine…',
    crystalCount: 0,
    running: false,
    progress: null,
    hasConfig: false,
    provider: 'anthropic',
    hasApiKey: false,
    configOpen: false,
  };

  const API_KEY_URLS = {
    anthropic: 'https://console.anthropic.com/settings/keys',
    openai: 'https://platform.openai.com/api-keys',
    gemini: 'https://aistudio.google.com/app/apikey',
    azure: 'https://portal.azure.com/',
    ollama: '',
  };

  function post(msg) { vscode.postMessage(msg); }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── Rendering ─────────────────────────────────────────── */

  function render() {
    const app = document.getElementById('app');
    const { hasConfig, repos, running, configOpen } = state;
    const hasRepos = repos.length > 0;
    let html = '';

    // Status bar (always visible)
    html += '<div class="status-bar">⚙ ' + esc(state.engineStatus) + '</div>';

    if (!hasConfig) {
      html += renderStep1(false);
      html += renderStep2(false);
    } else if (configOpen) {
      html += renderStep1(true);
      html += '<button class="btn btn-secondary cancel-btn" data-action="closeConfig">✕ Cancel</button>';
      html += renderRepos(hasRepos);
      if (hasRepos && !running) html += renderScanButton(repos);
    } else if (!hasRepos) {
      html += renderConfigSummary();
      html += renderStep2(true);
    } else if (running) {
      html += renderConfigSummary();
      html += renderRepos(true);
      html += renderProgress();
    } else {
      html += renderConfigSummary();
      html += renderRepos(true);
      html += renderScanButton(repos);
    }

    if (hasConfig && !configOpen) {
      html += renderCrystals();
    }

    app.innerHTML = html;
  }

  function renderStep1(editing) {
    const cfg = state;
    const keyUrl = API_KEY_URLS[cfg.provider] || '';
    const isOllama = cfg.provider === 'ollama';
    let html = '<div class="step-card">';
    html += '<div class="step-header">';
    html += '<span class="step-num">' + (cfg.hasConfig && !editing ? '✓' : '1') + '</span>';
    html += '<span class="step-title">Configure AI Provider</span>';
    html += '</div>';

    html += '<div class="form-row"><label>Provider</label>';
    html += '<select id="provider-select">';
    for (const p of ['anthropic', 'openai', 'gemini', 'azure', 'ollama']) {
      html += '<option value="' + p + '"' + (cfg.provider === p ? ' selected' : '') + '>' + p.charAt(0).toUpperCase() + p.slice(1) + '</option>';
    }
    html += '</select></div>';

    if (!isOllama) {
      html += '<div class="form-row">';
      html += '<div class="label-row">';
      html += '<label>API Key</label>';
      if (keyUrl) html += '<a class="btn-link key-link" data-ext="' + esc(keyUrl) + '">Get a free key ↗</a>';
      html += '</div>';
      html += '<div class="input-row">';
      html += '<input type="password" id="api-key-input" placeholder="Paste your API key here…" autocomplete="off">';
      html += '<button class="btn-icon" id="toggle-key" title="Show/hide key">👁</button>';
      html += '</div>';
      html += '</div>';
    } else {
      html += '<div class="provider-hint">Ollama runs locally — no API key needed.</div>';
    }

    html += '<div id="save-feedback" class="feedback hidden"></div>';
    html += '<div class="config-save-row">';
    html += '<button class="btn btn-primary save-btn" data-action="saveConfig">Save' + (editing ? '' : ' &amp; Continue →') + '</button>';
    if (!editing) {
      html += '<button class="btn btn-ghost test-btn" data-action="testConn">Test</button>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderStep2(isActive) {
    let html = '<div class="step-card' + (!isActive ? ' locked' : '') + '">';
    html += '<div class="step-header"><span class="step-num">2</span><span class="step-title">Select Repository</span></div>';

    if (!isActive) {
      html += '<div class="empty-state">Complete step 1 first.</div>';
    } else {
      const wsFolders = state.workspaceFolders || [];
      if (wsFolders.length > 0) {
        html += '<div class="ws-label">Workspace detected:</div>';
        html += '<div class="repo-select-actions">';
        for (const ws of wsFolders) {
          // One-click: adds repo + starts scan
          html += '<button class="btn btn-primary scan-btn full-width" data-scan-path="' + esc(ws.path) + '" data-scan-name="' + esc(ws.name) + '">';
          html += '⚡ Scan &quot;' + esc(ws.name) + '&quot;';
          html += '</button>';
        }
        html += '<button class="btn btn-ghost full-width change-repo-btn" data-action="addRepo">Change Repo</button>';
        html += '</div>';
      } else {
        html += '<button class="btn btn-ghost full-width browse-repo-btn" data-action="addRepo">+ Browse for a repository…</button>';
      }
    }

    html += '</div>';
    return html;
  }

  function renderConfigSummary() {
    const { provider, hasApiKey } = state;
    const isOllama = provider === 'ollama';
    const keyStatus = isOllama ? '' : (hasApiKey ? '· API key set' : '· <span class="warn-inline">⚠ no key</span>');
    return '<div class="config-summary">' +
      '<span class="check">✓</span>' +
      '<span>' + esc(provider.charAt(0).toUpperCase() + provider.slice(1)) + '</span>' +
      '<span class="dot">·</span>' +
      '<span class="muted">' + keyStatus + '</span>' +
      '<button class="btn-link edit-link" data-action="openConfig">Edit</button>' +
      '</div>';
  }

  function renderRepos(hasRepos) {
    const repos = state.repos || [];
    let html = '<h3>Repositories</h3>';
    if (!hasRepos || repos.length === 0) {
      html += '<div class="empty-state">No repositories. Add one above.</div>';
    } else {
      for (const r of repos) {
        html += '<div class="repo-item">';
        html += '<div><div class="repo-label" title="' + esc(r.path) + '">' + esc(r.label) + '</div>';
        html += '<div class="repo-path">' + esc(r.path) + '</div></div>';
        html += '<button class="btn-icon" data-remove="' + esc(r.path) + '" title="Remove">✕</button>';
        html += '</div>';
      }
    }
    html += '<div class="add-repo-row"><button class="btn btn-ghost add-repo-btn" data-action="addRepo">Change Repo</button></div>';
    return html;
  }

  function renderScanButton(repos) {
    const count = repos.length;
    const label = '⚡ Start Scan' + (count > 0 ? ' (' + String(count) + ' repo' + (count !== 1 ? 's' : '') + ')' : '');
    return '<hr class="divider"><button class="btn btn-primary scan-btn full-width" data-action="runAnalysis">' + label + '</button>';
  }

  function renderProgress() {
    const prog = state.progress || {};
    let html = '<hr class="divider">';
    html += '<div class="progress-stage">▶ ' + esc(prog.stage || 'Running…') + '</div>';
    if (prog.phiZoneCount > 0) {
      html += '<div class="phi-warning">⚠ ' + String(prog.phiZoneCount) + ' PHI zone' + (prog.phiZoneCount !== 1 ? 's' : '') + ' detected</div>';
    }
    if (prog.crystalMatch) {
      const icon = prog.crystalMatch === 'cold-start' ? '❄' : '💎';
      const score = prog.crystalMatchScore ? ' (' + String(Math.round(prog.crystalMatchScore * 100)) + '%)' : '';
      html += '<div class="crystal-info">' + icon + ' ' + esc(prog.crystalMatch) + score + '</div>';
    }
    html += '<div class="progress-bar" style="width:' + String(progressWidth(prog.status)) + '%"></div>';
    return html;
  }

  function renderCrystals() {
    const count = state.crystalCount;
    return '<h3>Crystal Store</h3>' +
      '<div class="crystal-row">' +
      '<span class="crystal-chip">💎 ' + String(count) + ' crystal' + (count !== 1 ? 's' : '') + '</span>' +
      '<button class="btn btn-secondary sync-btn" data-action="syncCrystals">↺ Sync</button>' +
      '</div>';
  }

  function progressWidth(status) {
    const map = { queued: 5, harvesting: 20, scrubbing: 40, 'querying-crystal': 55, synthesizing: 75, writing: 90, complete: 100, failed: 100 };
    return map[status] || 10;
  }

  /* ── Actions ───────────────────────────────────────────── */

  function showFeedback(msg, type) {
    const el = document.getElementById('save-feedback');
    if (!el) return;
    el.className = 'feedback ' + type;
    el.textContent = msg;
  }

  function saveConfig() {
    const select = document.getElementById('provider-select');
    const keyInput = document.getElementById('api-key-input');
    const provider = select ? select.value : state.provider;
    const apiKey = keyInput ? keyInput.value.trim() : '';
    if (provider !== 'ollama' && !apiKey) {
      showFeedback('API key is required for ' + provider, 'error');
      return;
    }
    showFeedback('Saving…', 'info');
    state.provider = provider;
    post({ type: 'configureProvider', provider, apiKey });
  }

  function testConn() {
    showFeedback('Testing connection…', 'info');
    post({ type: 'testConnection' });
  }

  function addRepo() { post({ type: 'addRepo' }); }
  function runAnalysis() {
    const paths = (state.repos || []).map(function(r) { return r.path; });
    if (paths.length > 0) post({ type: 'runAnalysis', paths });
  }
  function syncCrystals() { post({ type: 'syncCrystals' }); }
  function openConfig() { state.configOpen = true; render(); }
  function closeConfig() { state.configOpen = false; render(); }

  /* ── Event delegation — NO inline onclick anywhere ──────── */

  document.addEventListener('click', function(e) {
    var el = e.target;
    if (!el) return;

    // Remove repo (data-remove)
    if (el.dataset && el.dataset.remove !== undefined) {
      post({ type: 'removeRepo', path: el.dataset.remove });
      return;
    }

    // Use workspace (data-ws-path) — check element and parent
    if (el.dataset && el.dataset.wsPath !== undefined) {
      post({ type: 'useWorkspace', path: el.dataset.wsPath, name: el.dataset.wsName || el.dataset.wsPath });
      return;
    }
    var wsParent = el.closest('[data-ws-path]');
    if (wsParent && wsParent.dataset.wsPath) {
      post({ type: 'useWorkspace', path: wsParent.dataset.wsPath, name: wsParent.dataset.wsName || wsParent.dataset.wsPath });
      return;
    }

    // Scan workspace in one click (data-scan-path) — adds repo + starts scan
    if (el.dataset && el.dataset.scanPath !== undefined) {
      post({ type: 'scanWorkspace', path: el.dataset.scanPath, name: el.dataset.scanName || el.dataset.scanPath });
      return;
    }
    var scanParent = el.closest('[data-scan-path]');
    if (scanParent && scanParent.dataset.scanPath) {
      post({ type: 'scanWorkspace', path: scanParent.dataset.scanPath, name: scanParent.dataset.scanName || scanParent.dataset.scanPath });
      return;
    }

    // Open external link (data-ext)
    if (el.dataset && el.dataset.ext) {
      post({ type: 'openExternal', url: el.dataset.ext });
      return;
    }

    // Toggle API key visibility
    if (el.id === 'toggle-key') {
      var inp = document.getElementById('api-key-input');
      if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
      return;
    }

    // Generic action (data-action) — check element and nearest parent
    var actionEl = el.dataset && el.dataset.action ? el : el.closest('[data-action]');
    if (actionEl && actionEl.dataset.action) {
      switch (actionEl.dataset.action) {
        case 'addRepo':      addRepo();     break;
        case 'runAnalysis':  runAnalysis(); break;
        case 'saveConfig':   saveConfig();  break;
        case 'testConn':     testConn();    break;
        case 'openConfig':   openConfig();  break;
        case 'closeConfig':  closeConfig(); break;
        case 'syncCrystals': syncCrystals(); break;
      }
    }
  });

  // Provider select change — no inline onchange
  document.addEventListener('change', function(e) {
    var el = e.target;
    if (el && el.id === 'provider-select') {
      state.provider = el.value;
      render();
    }
  });

  /* ── Message handler ───────────────────────────────────── */

  window.addEventListener('message', function(ev) {
    var msg = ev.data;
    if (msg.type === 'stateUpdate') {
      state = Object.assign({}, state, msg.state);
      render();
    }
    if (msg.type === 'configFeedback') {
      showFeedback(msg.text, msg.kind || 'success');
    }
  });

  post({ type: 'ready' });
  render();
})();
</script>
</body>
</html>`;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view: vscode.WebviewView | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly state: ExtensionState,
    private readonly engineManager: EngineManager,
    private readonly callbacks: SidebarCallbacks,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.webview.options = { enableScripts: true };

    const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    view.webview.html = getSidebarHtml(view.webview, nonce);

    view.webview.onDidReceiveMessage(async (msg: SidebarMessage) => {
      switch (msg.type) {
        case 'ready':
          await this.pushState();
          break;

        case 'addRepo': {
          const uris = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Select Repository',
            title: 'Select Repository to Analyze',
          });
          if (uris?.[0]) {
            await this.state.addRepo(uris[0].fsPath);
            await this.pushState();
          }
          break;
        }

        case 'useWorkspace':
          await this.state.addRepo(msg.path);
          await this.pushState();
          break;

        case 'scanWorkspace':
          await this.state.addRepo(msg.path);
          await this.pushState();
          this.callbacks.onRunAnalysis([msg.path]);
          break;

        case 'removeRepo':
          await this.state.removeRepo(msg.path);
          await this.pushState();
          break;

        case 'runAnalysis':
          this.callbacks.onRunAnalysis(msg.paths);
          break;

        case 'configureProvider':
          await this.callbacks.onConfigureProvider(msg.provider, msg.apiKey);
          await this.pushState();
          await this._view?.webview.postMessage({
            type: 'configFeedback',
            text: `Provider saved: ${msg.provider}`,
            kind: 'success',
          });
          break;

        case 'testConnection': {
          const client = this.callbacks.getClient();
          if (!client) {
            await this._view?.webview.postMessage({
              type: 'configFeedback',
              text: 'Engine not running yet — please wait',
              kind: 'error',
            });
            break;
          }
          try {
            const health = await client.testConnection();
            await this._view?.webview.postMessage({
              type: 'configFeedback',
              text: health.healthy
                ? `✓ Connected (${String(health.latencyMs)}ms)`
                : `✗ ${health.error ?? 'Connection failed'}`,
              kind: health.healthy ? 'success' : 'error',
            });
          } catch (err) {
            const msg2 = err instanceof Error ? err.message : String(err);
            await this._view?.webview.postMessage({
              type: 'configFeedback',
              text: `✗ ${msg2}`,
              kind: 'error',
            });
          }
          break;
        }

        case 'syncCrystals': {
          const client2 = this.callbacks.getClient();
          if (!client2) break;
          try {
            const result = await client2.syncCrystals();
            void vscode.window.showInformationMessage(result.message);
            await this.pushState();
          } catch (err) {
            const msg3 = err instanceof Error ? err.message : String(err);
            void vscode.window.showErrorMessage(`Sync failed: ${msg3}`);
          }
          break;
        }

        case 'openExternal':
          if (msg.url) {
            void vscode.env.openExternal(vscode.Uri.parse(msg.url));
          }
          break;
      }
    });

    this.engineManager.onStatusChange(async (status) => {
      await this.pushState(status);
    });

    this.state.onDidChange(async () => {
      await this.pushState();
    });
  }

  async pushState(engineStatusOverride?: string): Promise<void> {
    if (!this._view) return;

    const client = this.callbacks.getClient();
    let crystalCount = 0;

    if (client) {
      try {
        const crystals = await client.listCrystals();
        crystalCount = crystals.length;
      } catch { /* engine not ready */ }
    }

    const configInfo = this.callbacks.getConfigInfo();
    const workspaceFolders = (vscode.workspace.workspaceFolders ?? [])
      .map(f => ({ name: f.name, path: f.uri.fsPath }));

    await this._view.webview.postMessage({
      type: 'stateUpdate',
      state: {
        repos: this.state.getRepos(),
        workspaceFolders,
        engineStatus: engineStatusOverride ?? (
          this.engineManager.port
            ? `Engine running on port ${String(this.engineManager.port)}`
            : 'Engine starting…'
        ),
        crystalCount,
        hasConfig: configInfo !== null && (configInfo.hasApiKey || configInfo.provider === 'ollama'),
        provider: configInfo?.provider ?? 'anthropic',
        hasApiKey: configInfo?.hasApiKey ?? false,
      },
    });
  }

  async updateProgress(progress: unknown): Promise<void> {
    if (!this._view) return;
    await this._view.webview.postMessage({
      type: 'stateUpdate',
      state: { running: true, progress },
    });
  }

  async clearProgress(): Promise<void> {
    if (!this._view) return;
    await this._view.webview.postMessage({
      type: 'stateUpdate',
      state: { running: false, progress: null },
    });
  }
}
