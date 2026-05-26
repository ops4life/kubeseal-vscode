/**
 * Kubeseal VSCode Extension
 * Main entry point for the extension
 */

import * as vscode from 'vscode';
import { encryptSecret, decryptSecret } from './commands/secrets';
import { encodeBase64Values, decodeBase64Values } from './commands/base64';
import { selectCertificate, setCertificateFolder } from './commands/certificates';
import { createStatusBarItem, updateStatusBar } from './ui/statusBar';
import { KubesealPanelProvider } from './ui/panelProvider';
import { initializeLogger, logInfo } from './utils/logger';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
    // Initialize logging
    initializeLogger(context);
    logInfo('Kubeseal VSCode extension activated');

    // Create and initialize status bar item
    createStatusBarItem(context);

    // Register activity bar panel
    const panelProvider = new KubesealPanelProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(KubesealPanelProvider.viewType, panelProvider)
    );

    // Register encrypt command
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.encrypt', (uri?: vscode.Uri) => {
            const target = uri ?? vscode.window.activeTextEditor?.document.uri;
            if (!target) {
                vscode.window.showErrorMessage('No file selected. Open a Kubernetes Secret YAML file first.');
                return;
            }
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Encrypting Kubernetes Secret...',
                    cancellable: true,
                },
                async (progress, token) => {
                    return await encryptSecret(target, progress, token);
                }
            );
        })
    );

    // Register decrypt command
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.decrypt', (uri?: vscode.Uri) => {
            const target = uri ?? vscode.window.activeTextEditor?.document.uri;
            if (!target) {
                vscode.window.showErrorMessage('No file selected. Open a SealedSecret YAML file first.');
                return;
            }
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Decrypting SealedSecret...',
                    cancellable: true,
                },
                async (progress, token) => {
                    return await decryptSecret(target, progress, token);
                }
            );
        })
    );

    // Register set certificate folder command
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.setCertFolder', () => {
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Setting Certificate Folder...',
                    cancellable: true,
                },
                async (progress, token) => {
                    await setCertificateFolder(progress, token);
                    updateStatusBar();
                }
            );
        })
    );

    // Register select certificate command
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.selectCertificate', async () => {
            await selectCertificate();
            updateStatusBar();
        })
    );

    // Register encode base64 command
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.encodeBase64', (uri: vscode.Uri) => {
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Encoding Secret Data as Base64...',
                    cancellable: true,
                },
                async (progress, token) => {
                    return await encodeBase64Values(uri, progress, token);
                }
            );
        })
    );

    // Register decode base64 command
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.decodeBase64', (uri: vscode.Uri) => {
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Decoding Base64 Secret Data...',
                    cancellable: true,
                },
                async (progress, token) => {
                    return await decodeBase64Values(uri, progress, token);
                }
            );
        })
    );

    // Listen for configuration changes to update status bar and panel
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('kubeseal')) {
                updateStatusBar();
                panelProvider.refresh();
            }
        })
    );

    // Refresh panel when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            panelProvider.refresh();
        })
    );
}

/**
 * Extension deactivation
 */
export function deactivate() {
    // Cleanup if needed
}
