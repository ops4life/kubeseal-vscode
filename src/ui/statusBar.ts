/**
 * Status bar management for displaying active certificate
 */

import * as vscode from 'vscode';
import * as path from 'path';

let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Creates and initializes the status bar item
 * @param context Extension context for subscriptions
 */
export function createStatusBarItem(context: vscode.ExtensionContext): void {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'kubeseal.selectCertificate';
    statusBarItem.name = 'Kubeseal Certificate';
    context.subscriptions.push(statusBarItem);

    updateStatusBar();
}

/**
 * Updates the status bar item to show active certificate file
 */
export function updateStatusBar(): void {
    if (!statusBarItem) {
        return;
    }

    const config = vscode.workspace.getConfiguration('kubeseal');
    const certsFolder = config.get<string>('certsFolder', '');
    const activeCertFile = config.get<string>('activeCertFile', '');

    if (!certsFolder) {
        statusBarItem.text = '$(key) (no folder set)';
        statusBarItem.tooltip = 'Current active Kubeseal cert - Click to configure certificate folder';
    } else if (activeCertFile) {
        statusBarItem.text = `$(key) ${activeCertFile}`;
        statusBarItem.tooltip = `Current active Kubeseal cert: ${path.join(certsFolder, activeCertFile)}`;
    } else {
        statusBarItem.text = '$(key) (not selected)';
        statusBarItem.tooltip = 'Current active Kubeseal cert - Click to select a certificate file';
    }
    statusBarItem.show();
}
