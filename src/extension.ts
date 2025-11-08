/**
 * Kubeseal VSCode Extension
 * Main entry point for the extension
 */

import * as vscode from 'vscode';
import { encryptSecret, decryptSecret } from './commands/secrets';
import { encodeBase64Values, decodeBase64Values } from './commands/base64';
import { selectCertificate, setCertificateFolder } from './commands/certificates';
import { createStatusBarItem, updateStatusBar } from './ui/statusBar';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Kubeseal VSCode extension is now active!');

    // Create and initialize status bar item
    createStatusBarItem(context);

    // Register encrypt command
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.encrypt', (uri: vscode.Uri) => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Encrypting Kubernetes Secret...",
                cancellable: true
            }, async (progress, token) => {
                return await encryptSecret(uri, progress, token);
            });
        })
    );

    // Register decrypt command
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.decrypt', (uri: vscode.Uri) => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Decrypting SealedSecret...",
                cancellable: true
            }, async (progress, token) => {
                return await decryptSecret(uri, progress, token);
            });
        })
    );

    // Register set certificate folder command
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.setCertFolder', () => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Setting Certificate Folder...",
                cancellable: true
            }, async (progress, token) => {
                await setCertificateFolder(progress, token);
                updateStatusBar();
            });
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
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Encoding Secret Data as Base64...",
                cancellable: true
            }, async (progress, token) => {
                return await encodeBase64Values(uri, progress, token);
            });
        })
    );

    // Register decode base64 command
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.decodeBase64', (uri: vscode.Uri) => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Decoding Base64 Secret Data...",
                cancellable: true
            }, async (progress, token) => {
                return await decodeBase64Values(uri, progress, token);
            });
        })
    );

    // Listen for configuration changes to update status bar
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('kubeseal')) {
                updateStatusBar();
            }
        })
    );
}

/**
 * Extension deactivation
 */
export function deactivate() {
    // Cleanup if needed
}
