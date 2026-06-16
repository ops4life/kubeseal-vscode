import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { encodeWithBase64, decodeWithBase64 } from '../utils/shell';

interface CertExpiry {
    notAfter: string; // ISO date string
    daysLeft: number; // negative = expired
    isExpired: boolean;
    isExpiringSoon: boolean; // within 30 days
}

interface PanelState {
    command: string;
    certsFolder: string;
    activeCertFile: string;
    certFiles: string[];
    activeEditorIsYaml: boolean;
    certExpiry?: CertExpiry;
}

export class KubesealPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'kubeseal.panel';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this._getHtml();

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            await this._handleMessage(msg, webviewView.webview);
        });

        this._sendState(webviewView.webview);
    }

    public refresh(): void {
        if (this._view) {
            this._sendState(this._view.webview);
        }
    }

    private async _handleMessage(
        message: { command: string; value?: string },
        webview: vscode.Webview
    ): Promise<void> {
        switch (message.command) {
            case 'encode': {
                if (!message.value) {
                    return;
                }
                try {
                    const result = await encodeWithBase64(message.value);
                    webview.postMessage({ command: 'encodeResult', value: result });
                } catch (e) {
                    webview.postMessage({ command: 'error', message: String(e) });
                }
                break;
            }
            case 'decode': {
                if (!message.value) {
                    return;
                }
                try {
                    const result = await decodeWithBase64(message.value);
                    webview.postMessage({ command: 'decodeResult', value: result });
                } catch (e) {
                    webview.postMessage({ command: 'error', message: String(e) });
                }
                break;
            }
            case 'browseCertsFolder': {
                await vscode.commands.executeCommand('kubeseal.setCertFolder');
                this._sendState(webview);
                break;
            }
            case 'setActiveCert': {
                if (!message.value) {
                    return;
                }
                const config = vscode.workspace.getConfiguration('kubeseal');
                await config.update(
                    'activeCertFile',
                    message.value,
                    vscode.ConfigurationTarget.Global
                );
                this._sendState(webview);
                break;
            }
            case 'encryptFile': {
                await vscode.commands.executeCommand('kubeseal.encrypt');
                break;
            }
            case 'decryptFile': {
                await vscode.commands.executeCommand('kubeseal.decrypt');
                break;
            }
            case 'reloadCerts': {
                this._sendState(webview);
                vscode.window.showInformationMessage('Kubeseal certificates reloaded.');
                break;
            }
            case 'getState': {
                this._sendState(webview);
                break;
            }
        }
    }

    private async _sendState(webview: vscode.Webview): Promise<void> {
        const config = vscode.workspace.getConfiguration('kubeseal');
        const certsFolder = config.get<string>('certsFolder', '');
        const activeCertFile = config.get<string>('activeCertFile', '');

        let certFiles: string[] = [];
        if (certsFolder) {
            try {
                const entries = await fs.readdir(certsFolder);
                certFiles = entries.filter((f) => /\.(pem|crt|cert)$/i.test(f)).sort();
            } catch {
                // folder not accessible
            }
        }

        const activeEditor = vscode.window.activeTextEditor;
        const activeEditorIsYaml = activeEditor
            ? /\.(yaml|yml)$/i.test(activeEditor.document.fileName)
            : false;

        let certExpiry: CertExpiry | undefined;
        if (certsFolder && activeCertFile) {
            try {
                const certPath = path.join(certsFolder, activeCertFile);
                const pem = await fs.readFile(certPath, 'utf8');
                const cert = new crypto.X509Certificate(pem);
                const notAfter = new Date(cert.validTo);
                const now = new Date();
                const msLeft = notAfter.getTime() - now.getTime();
                const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
                certExpiry = {
                    notAfter: notAfter.toISOString(),
                    daysLeft,
                    isExpired: daysLeft < 0,
                    isExpiringSoon: daysLeft >= 0 && daysLeft <= 30,
                };
            } catch {
                // cert unreadable or not a valid X.509 file
            }
        }

        const state: PanelState = {
            command: 'stateUpdate',
            certsFolder,
            activeCertFile,
            certFiles,
            activeEditorIsYaml,
            certExpiry,
        };

        webview.postMessage(state);
    }

    private _getHtml(): string {
        const nonce = getNonce();

        // ── Inline SVG Material Symbols (weight 300, grade 0, optical size 20) ──
        const icon = {
            // Tab icons
            swap: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>`,
            settings: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96a7.01 7.01 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.477.477 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
            // Section icons
            swap_lg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/></svg>`,
            bolt: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`,
            tune: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>`,
            // Field label icons
            edit: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
            list: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>`,
            doc: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-2 8H7v-2h4v2zm4-4H7v-2h8v2zm0-4H7V7h8v2z"/></svg>`,
            info: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
            warn: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
            // Settings icons
            folder: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
            folder_open: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>`,
            key: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`,
            browse: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/></svg>`,
            // Lock/Unlock
            lock: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`,
            unlock: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5-2.28 0-4.27 1.54-4.84 3.75l1.94.46C9.43 3.93 10.63 3 12 3c1.65 0 3 1.35 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>`,
            refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`,
        };

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kubeseal</title>
<style nonce="${nonce}">
/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --md-radius-sm: 4px;
  --md-radius-md: 10px;
  --md-radius-pill: 20px;
  --md-transition: 150ms cubic-bezier(0.2, 0, 0, 1);
  --md-elev1: 0 1px 3px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.10);
  --md-elev2: 0 2px 6px rgba(0,0,0,.18), 0 1px 4px rgba(0,0,0,.12);
}

body {
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  background: var(--vscode-sideBar-background);
  overflow-x: hidden;
  padding-bottom: 20px;
}

/* ── SVG icon helpers ── */
.md-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: .85;
  vertical-align: middle;
}
.md-icon svg { display: block; }

/* ── Tab Nav ── */
.tab-nav {
  display: flex;
  padding: 0 8px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--vscode-sideBar-background);
  border-bottom: 1px solid var(--vscode-panel-border);
}
.tab {
  position: relative;
  flex: 1;
  padding: 9px 4px 10px;
  text-align: center;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  color: var(--vscode-tab-inactiveForeground);
  border: none;
  background: none;
  user-select: none;
  transition: color var(--md-transition);
  letter-spacing: 0.04em;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.tab .md-icon { opacity: .6; transition: opacity var(--md-transition); }
.tab.active .md-icon { opacity: 1; }
.tab::after {
  content: '';
  position: absolute;
  bottom: -1px; left: 15%; right: 15%;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--vscode-focusBorder);
  transform: scaleX(0);
  transition: transform var(--md-transition);
}
.tab.active { color: var(--vscode-tab-activeForeground); }
.tab.active::after { transform: scaleX(1); }
.tab:hover { color: var(--vscode-foreground); }
.tab:hover .md-icon { opacity: .9; }

/* ── Tab Content ── */
.tab-content { display: none; padding: 14px 10px 0; animation: mdFadeIn 180ms ease both; }
.tab-content.active { display: block; }
@keyframes mdFadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── MD Section Label ── */
.md-section {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--vscode-descriptionForeground);
  margin: 0 2px 8px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--vscode-panel-border);
}
.md-section .md-icon { opacity: .7; }

/* ── MD Card ── */
.md-card {
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--md-radius-md);
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: var(--md-elev1);
  transition: box-shadow var(--md-transition);
}
.md-card:focus-within { box-shadow: var(--md-elev2); }

/* ── MD Field Label ── */
.md-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 7px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.md-label .md-icon { opacity: .75; }

/* ── MD Underline Text Field (filled variant) ── */
.md-field { position: relative; margin-bottom: 4px; }
.md-field::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: var(--vscode-focusBorder);
  transform: scaleX(0);
  transform-origin: center;
  transition: transform var(--md-transition);
  border-radius: 0 0 2px 2px;
}
.md-field:focus-within::after { transform: scaleX(1); }

textarea.md-input {
  width: 100%;
  background: rgba(128,128,128,.06);
  color: var(--vscode-input-foreground);
  border: none;
  border-bottom: 1px solid var(--vscode-panel-border);
  border-radius: var(--md-radius-sm) var(--md-radius-sm) 0 0;
  padding: 8px 10px;
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
  outline: none;
  resize: vertical;
  min-height: 72px;
  line-height: 1.5;
  transition: border-color var(--md-transition);
}
textarea.md-input.readonly {
  background: rgba(128,128,128,.04);
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--md-radius-sm);
  min-height: 60px;
}

/* ── MD Outlined Input (Settings) ── */
.md-input-outlined {
  width: 100%;
  background: transparent;
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--md-radius-sm);
  padding: 7px 10px;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  outline: none;
  transition: border-color var(--md-transition), box-shadow var(--md-transition);
}
.md-input-outlined:focus {
  border-color: var(--vscode-focusBorder);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder);
}
.md-input-outlined[readonly] {
  background: rgba(128,128,128,.05);
  color: var(--vscode-disabledForeground, var(--vscode-foreground));
  cursor: default;
}

/* ── MD Select ── */
.md-select {
  width: 100%;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: var(--md-radius-sm);
  padding: 7px 10px;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  outline: none;
  cursor: pointer;
  transition: border-color var(--md-transition), box-shadow var(--md-transition);
  appearance: none;
  -webkit-appearance: none;
  /* custom chevron arrow */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='%23808080'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  padding-right: 28px;
}
.md-select:focus {
  border-color: var(--vscode-focusBorder);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder);
}
.md-select option { background: var(--vscode-dropdown-background); }

/* ── MD Settings field group ── */
.md-settings-field {
  margin-bottom: 0;
}
.md-settings-desc {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  margin-top: 5px;
  line-height: 1.4;
  padding-left: 2px;
}

/* ── MD Button Row ── */
.md-btn-row { display: flex; gap: 6px; margin-top: 10px; }

/* ── MD Filled Button ── */
.md-btn {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
  padding: 7px 16px;
  border: none;
  border-radius: var(--md-radius-pill);
  cursor: pointer;
  font-size: 12px;
  font-family: var(--vscode-font-family);
  font-weight: 600;
  letter-spacing: 0.04em;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  transition: background var(--md-transition), transform 80ms ease, box-shadow var(--md-transition);
  box-shadow: 0 1px 2px rgba(0,0,0,.2);
}
.md-btn .md-icon { opacity: .9; }
.md-btn:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
  box-shadow: 0 2px 5px rgba(0,0,0,.25);
}
.md-btn:active:not(:disabled) { transform: scale(.97); box-shadow: none; }
.md-btn:disabled { opacity: .38; cursor: not-allowed; box-shadow: none; }
/* ripple */
.md-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,.15);
  opacity: 0;
  transition: opacity 200ms;
  border-radius: inherit;
}
.md-btn:active:not(:disabled)::after { opacity: 1; }

/* ── MD Tonal Button ── */
.md-btn-tonal {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  box-shadow: none;
}
.md-btn-tonal:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground);
  box-shadow: 0 1px 3px rgba(0,0,0,.15);
}

/* ── MD Icon Button ── */
.md-icon-btn {
  flex: none;
  padding: 7px 11px;
  border-radius: var(--md-radius-sm);
  font-size: 14px;
}

/* ── MD Folder Row ── */
.md-folder-row { display: flex; gap: 6px; align-items: stretch; }
.md-folder-row .md-input-outlined, .md-folder-row .md-select { flex: 1; }

.md-icon-btn.btn-small {
  padding: 4px;
  border-radius: 4px;
  height: 24px;
  width: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.spinning {
  display: inline-block;
  animation: spin 0.8s linear infinite;
}

/* ── MD Output wrap + copy chip ── */
.md-output-wrap { position: relative; }
.md-copy-chip {
  position: absolute;
  top: 6px; right: 6px;
  padding: 3px 10px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 12px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  cursor: pointer;
  letter-spacing: .04em;
  flex: none;
  box-shadow: none;
  transition: background var(--md-transition), color var(--md-transition);
}
.md-copy-chip:hover { background: var(--vscode-button-secondaryHoverBackground); }
.md-copy-chip.copied { background: #1b5e20; color: #81c784; }

/* ── MD Error banner ── */
.md-error {
  display: none;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
  padding: 7px 10px;
  border-radius: var(--md-radius-sm);
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  color: var(--vscode-inputValidation-errorForeground, var(--vscode-errorForeground));
  font-size: 11px;
  line-height: 1.4;
}
.md-error.visible { display: flex; }

/* ── MD Divider ── */
.md-divider { height: 1px; background: var(--vscode-panel-border); margin: 16px 0; opacity: .55; }

/* ── MD Status Chip ── */
.md-status-chip {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 12px;
  border-radius: var(--md-radius-md);
  border: 1px solid var(--vscode-panel-border);
  margin-bottom: 6px;
  background: var(--vscode-input-background);
  box-shadow: var(--md-elev1);
  transition: border-color var(--md-transition), background var(--md-transition);
}
.md-status-chip.ok   { border-color: rgba(78,201,78,.45);  background: rgba(78,201,78,.06); }
.md-status-chip.err  { border-color: rgba(241,76,76,.38);  background: rgba(241,76,76,.06); }
.md-status-chip.warn { border-color: rgba(229,152,0,.45);  background: rgba(229,152,0,.07); }

.md-dot-wrap { position: relative; width: 9px; height: 9px; flex-shrink: 0; }
.md-dot { width: 9px; height: 9px; border-radius: 50%; }
.md-dot.green  { background: #4ec94e; }
.md-dot.red    { background: #f14c4c; }
.md-dot.amber  { background: #e59800; }

.md-pulse {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2px solid #4ec94e;
  opacity: 0;
  animation: none;
}
.md-status-chip.ok .md-pulse { animation: mdPulse 2.4s ease-out infinite; }
.md-status-chip.warn .md-pulse { border-color: #e59800; animation: mdPulse 2.4s ease-out infinite; }
@keyframes mdPulse {
  0%   { transform: scale(.7); opacity: .7; }
  70%  { transform: scale(1.6); opacity: 0; }
  100% { opacity: 0; }
}

.md-status-info { flex: 1; min-width: 0; }
.md-status-super {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 2px;
}
.md-status-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--vscode-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.md-status-sub {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.md-status-chip.err  .md-status-sub { color: #f14c4c; }
.md-status-chip.warn .md-status-sub { color: #e59800; }
.md-status-chip.ok   .md-status-sub { color: #4ec94e; }

/* ── MD Hint ── */
.md-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 9px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.45;
  padding: 6px 9px;
  border-radius: 6px;
  background: rgba(128,128,128,.07);
}
.md-hint .md-icon { margin-top: 1px; opacity: .65; }
</style>
</head>
<body>

<!-- Tab Navigation -->
<nav class="tab-nav">
  <div class="tab active" data-tab="tools" role="tab" aria-selected="true">
    <span class="md-icon">${icon.swap}</span>
    Tools
  </div>
  <div class="tab" data-tab="settings" role="tab" aria-selected="false">
    <span class="md-icon">${icon.settings}</span>
    Settings
  </div>
</nav>

<!-- ── Tools Tab: Base64 + Actions combined ── -->
<div id="tab-tools" class="tab-content active" role="tabpanel">

  <!-- BASE64 SECTION -->
  <div class="md-section">
    <span class="md-icon">${icon.swap_lg}</span> Base64
  </div>

  <div class="md-card">
    <div class="md-label">
      <span class="md-icon">${icon.edit}</span> Input
    </div>
    <div class="md-field">
      <textarea class="md-input" id="b64-input" rows="4" placeholder="Paste a value to encode or decode…"></textarea>
    </div>
    <div class="md-btn-row">
      <button class="md-btn" id="btn-encode">
        <span class="md-icon">${icon.swap_lg}</span> Encode
      </button>
      <button class="md-btn md-btn-tonal" id="btn-decode">
        <span class="md-icon">${icon.swap_lg}</span> Decode
      </button>
    </div>
  </div>

  <div id="b64-error" class="md-error">
    <span class="md-icon">${icon.warn}</span>
    <span id="b64-error-text"></span>
  </div>

  <div id="b64-output-section" style="display:none">
    <div class="md-card">
      <div class="md-label">
        <span class="md-icon">${icon.list}</span> Output
      </div>
      <div class="md-output-wrap">
        <textarea class="md-input readonly" id="b64-output" rows="4" readonly></textarea>
        <button id="btn-copy" class="md-copy-chip">Copy</button>
      </div>
    </div>
  </div>

  <div class="md-divider"></div>

  <!-- ACTIONS SECTION -->
  <div class="md-section">
    <span class="md-icon">${icon.bolt}</span> Actions
  </div>

  <div class="md-status-chip err" id="status-badge">
    <div class="md-dot-wrap">
      <div class="md-dot red" id="cert-dot"></div>
      <div class="md-pulse"></div>
    </div>
    <div class="md-status-info">
      <div class="md-status-super">Certificate</div>
      <div class="md-status-label" id="cert-label">No certificate configured</div>
      <div class="md-status-sub" id="cert-expiry-label" style="display:none"></div>
    </div>
  </div>

  <div class="md-card">
    <div class="md-label">
      <span class="md-icon">${icon.doc}</span> Active Editor
    </div>
    <div class="md-btn-row">
      <button class="md-btn" id="btn-encrypt" disabled>
        <span class="md-icon">${icon.lock}</span> Encrypt
      </button>
      <button class="md-btn md-btn-tonal" id="btn-decrypt" disabled>
        <span class="md-icon">${icon.unlock}</span> Decrypt
      </button>
    </div>
    <div id="yaml-hint" class="md-hint">
      <span class="md-icon">${icon.info}</span>
      Open a YAML file in the editor to enable.
    </div>
  </div>

</div>

<!-- ── Settings Tab ── -->
<div id="tab-settings" class="tab-content" role="tabpanel">

  <div class="md-section">
    <span class="md-icon">${icon.folder_open}</span> Certificate Store
  </div>

  <div class="md-card">
    <div class="md-label">
      <span class="md-icon">${icon.folder}</span> Certs Folder
    </div>
    <div class="md-settings-field">
      <div class="md-folder-row">
        <input class="md-input-outlined" type="text" id="certs-folder" readonly placeholder="Not configured">
        <button class="md-btn md-btn-tonal md-icon-btn" id="btn-browse" title="Browse for folder">
          <span class="md-icon">${icon.browse}</span>
        </button>
        <button class="md-btn md-btn-tonal md-icon-btn" id="btn-reload-folder" title="Reload certificates">
          <span class="md-icon">${icon.refresh}</span>
        </button>
      </div>
      <div class="md-settings-desc">Directory containing .pem / .crt certificate files.</div>
    </div>
  </div>

  <div class="md-card">
    <div class="md-label">
      <span class="md-icon">${icon.key}</span> Active Certificate
    </div>
    <div class="md-settings-field">
      <div class="md-folder-row">
        <select class="md-select" id="active-cert">
          <option value="">Set a certs folder first</option>
        </select>
        <button class="md-btn md-btn-tonal md-icon-btn" id="btn-reload-settings" title="Reload certificates">
          <span class="md-icon">${icon.refresh}</span>
        </button>
      </div>
      <div class="md-settings-desc">Certificate used to seal secrets.</div>
    </div>
  </div>

</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();

  // ── Tab switching ─────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const panel = document.getElementById('tab-' + tab.dataset.tab);
      panel.classList.remove('active');
      void panel.offsetWidth; // reflow to restart animation
      panel.classList.add('active');
    });
  });

  // ── Base64 ────────────────────────────────────────────────────
  document.getElementById('btn-encode').addEventListener('click', () => {
    const value = document.getElementById('b64-input').value;
    if (!value) return;
    clearError();
    vscode.postMessage({ command: 'encode', value });
  });

  document.getElementById('btn-decode').addEventListener('click', () => {
    const value = document.getElementById('b64-input').value;
    if (!value) return;
    clearError();
    vscode.postMessage({ command: 'decode', value });
  });

  document.getElementById('btn-copy').addEventListener('click', () => {
    const val = document.getElementById('b64-output').value;
    const btn = document.getElementById('btn-copy');
    navigator.clipboard.writeText(val).catch(() => {
      document.getElementById('b64-output').select();
    });
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1800);
  });

  // ── Settings ──────────────────────────────────────────────────
  document.getElementById('btn-browse').addEventListener('click', () => {
    vscode.postMessage({ command: 'browseCertsFolder' });
  });

  document.getElementById('active-cert').addEventListener('change', (e) => {
    const value = e.target.value;
    if (value) vscode.postMessage({ command: 'setActiveCert', value });
  });

  function triggerReload(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn || btn.disabled) return;

    // Disable all reload buttons and spin their icons
    const reloadButtons = ['btn-reload-folder', 'btn-reload-settings'];
    reloadButtons.forEach(id => {
      const b = document.getElementById(id);
      if (b) {
        b.disabled = true;
        const iconSpan = b.querySelector('.md-icon');
        if (iconSpan) iconSpan.classList.add('spinning');
      }
    });

    vscode.postMessage({ command: 'reloadCerts' });

    // Fallback safety timeout
    setTimeout(() => {
      reloadButtons.forEach(id => {
        const b = document.getElementById(id);
        if (b) {
          b.disabled = false;
          const iconSpan = b.querySelector('.md-icon');
          if (iconSpan) iconSpan.classList.remove('spinning');
        }
      });
    }, 1500);
  }

  document.getElementById('btn-reload-folder').addEventListener('click', () => {
    triggerReload('btn-reload-folder');
  });

  document.getElementById('btn-reload-settings').addEventListener('click', () => {
    triggerReload('btn-reload-settings');
  });

  // ── Actions ───────────────────────────────────────────────────
  document.getElementById('btn-encrypt').addEventListener('click', () => {
    vscode.postMessage({ command: 'encryptFile' });
  });

  document.getElementById('btn-decrypt').addEventListener('click', () => {
    vscode.postMessage({ command: 'decryptFile' });
  });

  // ── Helpers ───────────────────────────────────────────────────
  function clearError() {
    document.getElementById('b64-error').classList.remove('visible');
    document.getElementById('b64-error-text').textContent = '';
  }

  function showError(msg) {
    document.getElementById('b64-error-text').textContent = msg.replace(/^Error: /, '');
    document.getElementById('b64-error').classList.add('visible');
  }

  function showOutput(value) {
    document.getElementById('b64-output-section').style.display = '';
    document.getElementById('b64-output').value = value;
    const btn = document.getElementById('btn-copy');
    btn.textContent = 'Copy';
    btn.classList.remove('copied');
  }

  function updateState(state) {
    // Settings tab
    document.getElementById('certs-folder').value = state.certsFolder || '';
    const sel = document.getElementById('active-cert');
    sel.innerHTML = '';
    if (!state.certsFolder || !state.certFiles || state.certFiles.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = state.certsFolder ? 'No cert files found' : 'Set a certs folder first';
      opt.disabled = true;
      sel.appendChild(opt);
    } else {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— select —';
      sel.appendChild(placeholder);
      state.certFiles.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = f;
        if (f === state.activeCertFile) opt.selected = true;
        sel.appendChild(opt);
      });
      if (!state.activeCertFile) sel.value = '';
    }

    // Actions status chip
    const badge      = document.getElementById('status-badge');
    const dot        = document.getElementById('cert-dot');
    const label      = document.getElementById('cert-label');
    const expiryEl   = document.getElementById('cert-expiry-label');

    if (state.activeCertFile) {
      label.textContent = state.activeCertFile;

      const expiry = state.certExpiry;
      if (expiry) {
        expiryEl.style.display = '';
        const expDate = new Date(expiry.notAfter);
        const dateStr = expDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

        if (expiry.isExpired) {
          badge.className = 'md-status-chip err';
          dot.className   = 'md-dot red';
          expiryEl.textContent = '⚠ Expired on ' + dateStr;
        } else if (expiry.isExpiringSoon) {
          badge.className = 'md-status-chip warn';
          dot.className   = 'md-dot amber';
          expiryEl.textContent = '⚠ Expires in ' + expiry.daysLeft + ' day' + (expiry.daysLeft === 1 ? '' : 's') + ' (' + dateStr + ')';
        } else {
          badge.className = 'md-status-chip ok';
          dot.className   = 'md-dot green';
          expiryEl.textContent = '✓ Valid until ' + dateStr + ' (' + expiry.daysLeft + 'd)';
        }
      } else {
        // cert file exists but couldn't be parsed
        badge.className = 'md-status-chip ok';
        dot.className   = 'md-dot green';
        expiryEl.style.display = 'none';
      }
    } else {
      badge.className = 'md-status-chip err';
      dot.className   = 'md-dot red';
      label.textContent = 'No certificate configured';
      expiryEl.style.display = 'none';
    }

    const encBtn = document.getElementById('btn-encrypt');
    const decBtn = document.getElementById('btn-decrypt');
    const hint   = document.getElementById('yaml-hint');
    encBtn.disabled = !state.activeEditorIsYaml;
    decBtn.disabled = !state.activeEditorIsYaml;
    hint.style.display = state.activeEditorIsYaml ? 'none' : '';

    // Stop spin animation & re-enable buttons
    document.querySelectorAll('.md-icon.spinning').forEach(el => {
      el.classList.remove('spinning');
    });
    const reloadFolderBtn = document.getElementById('btn-reload-folder');
    const reloadSettingsBtn = document.getElementById('btn-reload-settings');
    if (reloadFolderBtn) reloadFolderBtn.disabled = false;
    if (reloadSettingsBtn) reloadSettingsBtn.disabled = false;
  }

  window.addEventListener('message', event => {
    const msg = event.data;
    switch (msg.command) {
      case 'encodeResult': showOutput(msg.value); break;
      case 'decodeResult': showOutput(msg.value); break;
      case 'error':        showError(msg.message); break;
      case 'stateUpdate':  updateState(msg); break;
    }
  });

  vscode.postMessage({ command: 'getState' });
</script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
