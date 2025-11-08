/**
 * Certificate management commands
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logInfo, logError } from '../utils/logger';

/**
 * Gets the current certificate path from configuration
 * @param progress Optional progress reporter
 * @param token Optional cancellation token
 * @returns Certificate path or undefined if not configured
 */
export async function getCurrentCertificatePath(
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken
): Promise<string | undefined> {
    // Check for cancellation
    if (token?.isCancellationRequested) {
        throw new Error('Operation was cancelled by user');
    }

    const config = vscode.workspace.getConfiguration('kubeseal');
    const certsFolder = config.get<string>('certsFolder', '');
    const activeCertFile = config.get<string>('activeCertFile', '');

    if (!certsFolder) {
        progress?.report?.({ message: "No certs folder configured." });
        const result = await vscode.window.showErrorMessage(
            'No certificate folder configured. Please configure it first.',
            'Open Settings',
            'Set Certificate Folder'
        );
        if (result === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:ops4life.kubeseal-vscode certsFolder');
        } else if (result === 'Set Certificate Folder') {
            vscode.commands.executeCommand('kubeseal.setCertFolder');
        }
        return undefined;
    }

    if (!activeCertFile) {
        progress?.report?.({ message: "No certificate selected." });
        vscode.window.showErrorMessage('No certificate selected. Please select one from the status bar.');
        return undefined;
    }

    const certPath = path.join(certsFolder, activeCertFile);
    return certPath;
}

/**
 * Command to select active certificate from certs folder
 */
export async function selectCertificate(): Promise<void> {
    logInfo('Selecting certificate');
    const config = vscode.workspace.getConfiguration('kubeseal');
    const certsFolder = config.get<string>('certsFolder', '');

    if (!certsFolder) {
        logError('No certificate folder configured');
        const result = await vscode.window.showErrorMessage(
            'No certificate folder configured. Please configure it first.',
            'Open Settings',
            'Set Certificate Folder'
        );
        if (result === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', '@ext:ops4life.kubeseal-vscode certsFolder');
        } else if (result === 'Set Certificate Folder') {
            vscode.commands.executeCommand('kubeseal.setCertFolder');
        }
        return;
    }

    let files: string[] = [];
    try {
        files = fs.readdirSync(certsFolder)
            .filter(f => f.match(/\.(pem|crt|cert)$/i));
    } catch (e) {
        vscode.window.showErrorMessage('Failed to read certs folder.');
        return;
    }

    if (files.length === 0) {
        vscode.window.showWarningMessage('No certificate files found in folder.');
        return;
    }

    const selected = await vscode.window.showQuickPick(files, {
        placeHolder: 'Select certificate file to use'
    });

    if (selected) {
        await config.update('activeCertFile', selected, vscode.ConfigurationTarget.Global);
        logInfo(`Active certificate set to: ${selected}`);
        vscode.window.showInformationMessage(`Active certificate set to '${selected}'.`);
    }
}

/**
 * Command to set certificate folder
 */
export async function setCertificateFolder(
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken
): Promise<void> {
    try {
        if (token?.isCancellationRequested) {
            return;
        }

        progress?.report?.({ message: "Prompting for certificate folder..." });
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: 'Select Certificate Folder'
        };

        const folderUri = await vscode.window.showOpenDialog(options);

        if (token?.isCancellationRequested) {
            return;
        }

        if (folderUri && folderUri.length > 0) {
            progress?.report?.({ message: "Saving certificate folder to config..." });
            const certsFolder = folderUri[0].fsPath;
            const config = vscode.workspace.getConfiguration('kubeseal');
            await config.update('certsFolder', certsFolder, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Certificate folder set to: ${certsFolder}`);
            // Clear any active cert file since we're changing folders
            await config.update('activeCertFile', '', vscode.ConfigurationTarget.Global);
        }
    } catch (error) {
        if (token?.isCancellationRequested || error instanceof Error && error.message.includes('cancelled')) {
            vscode.window.showInformationMessage('Certificate folder selection was cancelled');
            return;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to set certificate folder: ${errorMessage}`);
    }
}
