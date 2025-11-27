/**
 * Secret encryption and decryption commands
 */

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import { execKubeseal, execKubectl } from '../utils/shell';
import { isKubernetesSecret, isSealedSecret, extractSecretMetadata } from '../utils/yaml';
import { validateSecretMetadata } from '../utils/validation';
import { getCurrentCertificatePath } from './certificates';
import { logInfo, logError } from '../utils/logger';

/**
 * Command to encrypt a Kubernetes Secret using kubeseal
 */
export async function encryptSecret(
    uri: vscode.Uri,
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken
): Promise<void> {
    const filePath = uri.fsPath;
    logInfo(`Starting encryption for file: ${filePath}`);

    try {
        progress?.report({ message: 'Loading configuration...' });

        // Check for cancellation at key points
        if (token?.isCancellationRequested) {
            return;
        }

        // Get certificate path using certificate management system
        const certPath = await getCurrentCertificatePath(progress, token);
        if (!certPath) {
            return;
        }

        // Check for cancellation
        if (token?.isCancellationRequested) {
            return;
        }

        // Check if certificate file exists
        progress?.report({ message: 'Validating certificate file...' });
        try {
            await fs.access(certPath);
        } catch {
            vscode.window.showErrorMessage(`Certificate file not found: ${certPath}`);
            return;
        }

        // Read the input file
        progress?.report({ message: 'Reading secret file...' });
        if (token?.isCancellationRequested) {
            return;
        }

        const inputContent = await fs.readFile(filePath, 'utf8');

        // Check if the file contains a Secret resource
        if (!isKubernetesSecret(inputContent)) {
            vscode.window.showWarningMessage(
                'This file does not appear to contain a Kubernetes Secret'
            );
            return;
        }

        // Generate output file path
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const basename = path.basename(filePath, ext);
        const outputPath = path.join(dir, `${basename}-sealed${ext}`);

        // Run kubeseal command with cancellation support
        progress?.report({ message: 'Running kubeseal to encrypt secret...' });

        if (!token) {
            throw new Error('Cancellation token is required');
        }

        await execKubeseal(certPath, filePath, outputPath, token);

        // Check for cancellation before showing success message
        if (token?.isCancellationRequested) {
            return;
        }

        logInfo(`Successfully encrypted secret to: ${outputPath}`);
        vscode.window.showInformationMessage(`Secret encrypted successfully: ${outputPath}`);

        // Ask if user wants to open the encrypted file
        const openResult = await vscode.window.showInformationMessage(
            'Would you like to open the encrypted file?',
            'Yes',
            'No'
        );

        if (openResult === 'Yes' && !token?.isCancellationRequested) {
            progress?.report({ message: 'Opening encrypted file...' });
            const document = await vscode.workspace.openTextDocument(outputPath);
            await vscode.window.showTextDocument(document);
        }
    } catch (error) {
        if (
            token?.isCancellationRequested ||
            (error instanceof Error && error.message.includes('cancelled'))
        ) {
            logInfo('Encryption operation was cancelled by user');
            vscode.window.showInformationMessage('Encryption operation was cancelled');
            return;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`Failed to encrypt secret: ${filePath}`, error);

        // Provide actionable error messages
        const result = await vscode.window.showErrorMessage(
            `Failed to encrypt secret: ${errorMessage}`,
            'Check kubeseal Installation',
            'View Documentation'
        );

        if (result === 'Check kubeseal Installation') {
            vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/bitnami-labs/sealed-secrets#installation')
            );
        } else if (result === 'View Documentation') {
            vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/bitnami-labs/sealed-secrets')
            );
        }
    }
}

/**
 * Command to decrypt a SealedSecret by fetching from the cluster
 */
export async function decryptSecret(
    uri: vscode.Uri,
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken
): Promise<void> {
    try {
        progress?.report({ message: 'Reading secret file...' });

        if (token?.isCancellationRequested) {
            return;
        }

        const filePath = uri.fsPath;

        // Read the input file
        const inputContent = await fs.readFile(filePath, 'utf8');

        // Check if the file contains a SealedSecret resource
        if (!isSealedSecret(inputContent)) {
            vscode.window.showWarningMessage('This file does not appear to contain a SealedSecret');
            return;
        }

        if (token?.isCancellationRequested) {
            return;
        }

        // Extract secret metadata
        const metadata = extractSecretMetadata(inputContent);

        // Validate metadata (protects against command injection)
        try {
            validateSecretMetadata(metadata);
        } catch (validationError) {
            const errorMessage =
                validationError instanceof Error
                    ? validationError.message
                    : String(validationError);
            vscode.window.showErrorMessage(`Invalid secret metadata: ${errorMessage}`);
            return;
        }

        // Generate output file path
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const basename = path.basename(filePath, ext);
        const outputPath = path.join(dir, `${basename}-unsealed${ext}`);

        // Get secret from cluster with cancellation support
        progress?.report({ message: 'Getting secret from cluster...' });

        if (!token) {
            throw new Error('Cancellation token is required');
        }

        await execKubectl(metadata.name, metadata.namespace, outputPath, token);

        if (token?.isCancellationRequested) {
            return;
        }

        vscode.window.showInformationMessage(
            `Secret retrieved successfully from cluster: ${outputPath}`
        );

        const openResult = await vscode.window.showInformationMessage(
            'Would you like to open the decrypted file?',
            'Yes',
            'No'
        );

        if (openResult === 'Yes' && !token?.isCancellationRequested) {
            progress?.report({ message: 'Opening decrypted file...' });
            const document = await vscode.workspace.openTextDocument(outputPath);
            await vscode.window.showTextDocument(document);
        }
    } catch (error) {
        if (
            token?.isCancellationRequested ||
            (error instanceof Error && error.message.includes('cancelled'))
        ) {
            vscode.window.showInformationMessage('Decryption operation was cancelled');
            return;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Provide actionable error messages
        const result = await vscode.window.showErrorMessage(
            `Failed to decrypt secret: ${errorMessage}`,
            'Check kubectl Access',
            'View Documentation'
        );

        if (result === 'Check kubectl Access') {
            vscode.env.openExternal(
                vscode.Uri.parse('https://kubernetes.io/docs/tasks/tools/#kubectl')
            );
        } else if (result === 'View Documentation') {
            vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/bitnami-labs/sealed-secrets')
            );
        }
    }
}
