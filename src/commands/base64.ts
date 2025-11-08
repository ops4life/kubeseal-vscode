/**
 * Base64 encoding/decoding commands for Kubernetes secrets
 */

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { parseSecret, toYaml, isKubernetesSecret } from '../utils/yaml';
import { isProbablyBase64Value } from '../utils/validation';

/**
 * Command to encode base64 values in a Kubernetes Secret
 */
export async function encodeBase64Values(
    uri: vscode.Uri,
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken
): Promise<void> {
    try {
        if (token?.isCancellationRequested) {
            return;
        }

        progress?.report({ message: "Reading file..." });
        const filePath = uri.fsPath;
        const inputContent = await fs.readFile(filePath, 'utf8');

        if (!isKubernetesSecret(inputContent)) {
            vscode.window.showWarningMessage('This file does not appear to contain a Kubernetes Secret');
            return;
        }

        if (token?.isCancellationRequested) {
            return;
        }

        progress?.report({ message: "Parsing and encoding values..." });

        const secret = parseSecret(inputContent);
        let encodedCount = 0;

        // Encode values in data field
        if (secret.data) {
            for (const [key, value] of Object.entries(secret.data)) {
                if (token?.isCancellationRequested) {
                    return;
                }

                if (value && !isProbablyBase64Value(value)) {
                    try {
                        secret.data[key] = Buffer.from(value, 'utf8').toString('base64');
                        encodedCount++;
                    } catch (error) {
                        vscode.window.showWarningMessage(`Failed to encode value for key '${key}': ${error}`);
                    }
                }
            }
        }

        if (encodedCount > 0) {
            if (token?.isCancellationRequested) {
                return;
            }
            progress?.report({ message: "Saving encoded file..." });
            const outputYaml = toYaml(secret);
            await fs.writeFile(filePath, outputYaml, 'utf8');
            vscode.window.showInformationMessage(`Encoded ${encodedCount} value(s) to base64`);
        } else {
            vscode.window.showInformationMessage('All values in "data" are already base64 encoded');
        }

    } catch (error) {
        if (token?.isCancellationRequested || error instanceof Error && error.message.includes('cancelled')) {
            vscode.window.showInformationMessage('Base64 encoding operation was cancelled');
            return;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to encode base64 values: ${errorMessage}`);
    }
}

/**
 * Command to decode base64 values in a Kubernetes Secret
 */
export async function decodeBase64Values(
    uri: vscode.Uri,
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken
): Promise<void> {
    try {
        if (token?.isCancellationRequested) {
            return;
        }

        progress?.report({ message: "Reading file..." });
        const filePath = uri.fsPath;
        const inputContent = await fs.readFile(filePath, 'utf8');

        if (!isKubernetesSecret(inputContent)) {
            vscode.window.showWarningMessage('This file does not appear to contain a Kubernetes Secret');
            return;
        }

        if (token?.isCancellationRequested) {
            return;
        }

        progress?.report({ message: "Parsing and decoding base64 values..." });

        const secret = parseSecret(inputContent);
        let decodedCount = 0;

        // Decode values in data field
        if (secret.data) {
            for (const [key, value] of Object.entries(secret.data)) {
                if (token?.isCancellationRequested) {
                    return;
                }

                if (value && isProbablyBase64Value(value)) {
                    try {
                        const decoded = Buffer.from(value, 'base64').toString('utf8');

                        // Check if decoded content is readable/printable text
                        const printableRegex = /^[\t\n\r\x20-\x7E]*$/u;
                        const isPrintable = printableRegex.test(decoded);

                        if (isPrintable) {
                            // Content is readable text, decode it
                            secret.data[key] = decoded;
                            decodedCount++;
                        }
                        // If not printable (binary), keep as base64
                    } catch (error) {
                        // If decoding fails, keep original value
                        vscode.window.showWarningMessage(`Failed to decode value for key '${key}': ${error}`);
                    }
                }
            }
        }

        if (decodedCount > 0) {
            if (token?.isCancellationRequested) {
                return;
            }
            progress?.report({ message: "Saving decoded file..." });
            const outputYaml = toYaml(secret);
            await fs.writeFile(filePath, outputYaml, 'utf8');
            vscode.window.showInformationMessage(`Decoded ${decodedCount} base64 value(s)`);
        } else {
            vscode.window.showInformationMessage('No base64 encoded values found in "data" field');
        }

    } catch (error) {
        if (token?.isCancellationRequested || error instanceof Error && error.message.includes('cancelled')) {
            vscode.window.showInformationMessage('Base64 decoding operation was cancelled');
            return;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to decode base64 values: ${errorMessage}`);
    }
}
