/**
 * Base64 encoding/decoding commands for Kubernetes secrets.
 *
 * Uses a strict RFC 4648 roundtrip check (decode → re-encode → compare) built
 * on Node's Buffer, not a "does this look like base64" guess — guessing was
 * unreliable for short values like "admin", "true", or single-word passwords.
 * Pure Node (no external `base64` binary) so behavior is identical on
 * Windows, macOS, and Linux.
 *
 * Encode strategy:
 *   - For `.data` keys: use a roundtrip check (decode → re-encode) to detect
 *     values that are already base64. Encode only the ones that are not.
 *   - For `.stringData` keys: always encode and promote to `.data`.
 *
 * Decode strategy:
 *   - Decode ALL values in `.data` unconditionally.
 *     The K8s Secret spec guarantees that every value in `.data` is base64.
 *     No heuristic detection is needed or correct here.
 *   - Skip binary output (null bytes / control characters) to avoid
 *     corrupting files with cert/key data.
 */

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { parseSecret, toYaml, isKubernetesSecret } from '../utils/yaml';
import { logInfo, logError, logWarning, showOutput } from '../utils/logger';
import { encodeWithBase64, decodeWithBase64 } from '../utils/shell';
import { KubernetesSecret } from '../types/kubernetes';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when `value` is already a valid base64-encoded string.
 *
 * Strategy: decode with Node's Buffer, then re-encode the result and compare
 * byte-for-byte to the normalised original.
 *
 * We strip all whitespace (spaces, newlines, \r) before comparing because:
 *  - some tools (openssl, gpg) emit base64 wrapped at 76 chars per line
 *  - kubectl / js-yaml store it as a single long line
 * Both representations decode to identical bytes, so we normalise first.
 *
 * This correctly handles:
 *  - Short plaintext values like "admin", "true" (decode fails → false)
 *  - Single-line base64 like "dGVzdA=="
 *  - Multi-line / wrapped base64 (TLS certs, SSH keys stored in secrets)
 *  - Unicode passwords / UTF-8 special chars (encoded as raw UTF-8 bytes)
 */
async function isAlreadyBase64Encoded(value: string): Promise<boolean> {
    try {
        // Strip all whitespace so line-wrapped base64 compares cleanly
        const normalized = value.replace(/\s/g, '');
        if (!normalized) {
            return false;
        }

        const decoded = await decodeWithBase64(normalized);
        const reEncoded = await encodeWithBase64(decoded);
        // encodeWithBase64 already strips newlines; compare against normalized input
        return reEncoded === normalized;
    } catch {
        // decode failed → value is plaintext, not base64
        return false;
    }
}

/**
 * Returns true when the decoded bytes look like binary (not safe to store as
 * plain text in YAML).  We keep binary values as-is in base64 form.
 */
function isBinaryContent(decoded: string): boolean {
    return (
        decoded.includes('\0') ||
        // eslint-disable-next-line no-control-regex
        /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(decoded)
    );
}

/**
 * Decodes all `.data` values of a Kubernetes Secret in place using the system
 * `base64` terminal command. The K8s Secret spec guarantees every `.data`
 * value is base64, so no heuristic detection is needed. Binary values (certs,
 * keys) are detected post-decode and left as base64.
 *
 * Shared by both the file-based decode command and the cluster-based
 * view-decoded-secret command so binary detection stays in one place.
 */
export async function decodeSecretData(secret: KubernetesSecret): Promise<{
    decodedCount: number;
    skippedBinaryCount: number;
    whitespaceKeys: string[];
}> {
    let decodedCount = 0;
    let skippedBinaryCount = 0;
    const whitespaceKeys: string[] = [];

    if (secret.data) {
        for (const [key, value] of Object.entries(secret.data)) {
            if (value) {
                try {
                    const trimmed = value.trim();
                    if (trimmed !== value) {
                        whitespaceKeys.push(key);
                        secret.data[key] = trimmed;
                    }
                    const decoded = await decodeWithBase64(trimmed);

                    if (isBinaryContent(decoded)) {
                        skippedBinaryCount++;
                    } else {
                        secret.data[key] = decoded;
                        decodedCount++;
                    }
                } catch (error) {
                    vscode.window.showWarningMessage(
                        `Failed to decode value for key '${key}': ${error}`
                    );
                }
            }
        }
    }

    return { decodedCount, skippedBinaryCount, whitespaceKeys };
}

// ---------------------------------------------------------------------------
// Public commands
// ---------------------------------------------------------------------------

/**
 * Encodes plaintext values in a Kubernetes Secret to base64 using the system
 * `base64` terminal command.
 *
 * - `.data` values that are already base64 are left untouched (roundtrip check).
 * - `.stringData` values are always encoded and promoted into `.data`.
 */
export async function encodeBase64Values(
    uri: vscode.Uri,
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken
): Promise<void> {
    const filePath = uri.fsPath;
    logInfo(`Starting base64 encoding for file: ${filePath}`);

    try {
        if (token?.isCancellationRequested) {
            return;
        }

        progress?.report({ message: 'Reading file...' });
        const inputContent = await fs.readFile(filePath, 'utf8');

        if (!isKubernetesSecret(inputContent)) {
            vscode.window.showWarningMessage(
                'This file does not appear to contain a Kubernetes Secret'
            );
            return;
        }

        if (token?.isCancellationRequested) {
            return;
        }

        progress?.report({ message: 'Parsing and encoding values...' });

        const secret = parseSecret(inputContent);
        let encodedCount = 0;

        // --- Handle .data field ---
        // Encode any value that fails the roundtrip check (i.e., not yet base64).
        if (secret.data) {
            for (const [key, value] of Object.entries(secret.data)) {
                if (token?.isCancellationRequested) {
                    return;
                }

                if (value) {
                    const alreadyEncoded = await isAlreadyBase64Encoded(value);
                    if (!alreadyEncoded) {
                        try {
                            // Encodes raw UTF-8 bytes — handles all Unicode,
                            // newlines, tabs, emoji, non-ASCII passwords, etc.
                            secret.data[key] = await encodeWithBase64(value);
                            encodedCount++;
                        } catch (error) {
                            vscode.window.showWarningMessage(
                                `Failed to encode value for key '${key}': ${error}`
                            );
                        }
                    } else {
                        // Normalise stored form to single-line (strips wrapping newlines)
                        const singleLine = value.replace(/\s/g, '');
                        if (singleLine !== value) {
                            secret.data[key] = singleLine;
                            encodedCount++;
                        }
                    }
                }
            }
        }

        // --- Handle .stringData field ---
        // K8s accepts plaintext in stringData; we encode it and move it to data.
        if (secret.stringData) {
            if (!secret.data) {
                secret.data = {};
            }
            for (const [key, value] of Object.entries(secret.stringData)) {
                if (token?.isCancellationRequested) {
                    return;
                }

                if (value !== undefined && value !== null) {
                    try {
                        secret.data[key] = await encodeWithBase64(String(value));
                        encodedCount++;
                    } catch (error) {
                        vscode.window.showWarningMessage(
                            `Failed to encode stringData value for key '${key}': ${error}`
                        );
                    }
                }
            }
            // Remove stringData so the result is a clean .data-only Secret
            delete secret.stringData;
        }

        if (encodedCount > 0) {
            if (token?.isCancellationRequested) {
                return;
            }
            progress?.report({ message: 'Saving encoded file...' });
            const outputYaml = toYaml(secret);
            await fs.writeFile(filePath, outputYaml, 'utf8');
            logInfo(`Successfully encoded ${encodedCount} value(s) to base64 in ${filePath}`);
            vscode.window.showInformationMessage(`Encoded ${encodedCount} value(s) to base64`);
        } else {
            logInfo(`All values in ${filePath} are already base64 encoded`);
            vscode.window.showInformationMessage('All values in "data" are already base64 encoded');
        }
    } catch (error) {
        if (
            token?.isCancellationRequested ||
            (error instanceof Error && error.message.includes('cancelled'))
        ) {
            logInfo(`Base64 encoding cancelled for ${filePath}`);
            vscode.window.showInformationMessage('Base64 encoding operation was cancelled');
            return;
        }
        logError(`Failed to encode base64 values in ${filePath}`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to encode base64 values: ${errorMessage}`);
    }
}

/**
 * Decodes base64 values in a Kubernetes Secret using the system `base64`
 * terminal command.
 *
 * All values in the `.data` field of a K8s Secret are guaranteed by the spec
 * to be base64-encoded — no heuristic detection is required.  Binary values
 * (certs, keys, etc.) are detected post-decode and left as-is.
 */
export async function decodeBase64Values(
    uri: vscode.Uri,
    progress?: vscode.Progress<{ message?: string; increment?: number }>,
    token?: vscode.CancellationToken
): Promise<void> {
    const filePath = uri.fsPath;
    logInfo(`Starting base64 decoding for file: ${filePath}`);

    try {
        if (token?.isCancellationRequested) {
            return;
        }

        progress?.report({ message: 'Reading file...' });
        const inputContent = await fs.readFile(filePath, 'utf8');

        if (!isKubernetesSecret(inputContent)) {
            vscode.window.showWarningMessage(
                'This file does not appear to contain a Kubernetes Secret'
            );
            return;
        }

        if (token?.isCancellationRequested) {
            return;
        }

        progress?.report({ message: 'Parsing and decoding base64 values...' });

        const secret = parseSecret(inputContent);

        if (token?.isCancellationRequested) {
            return;
        }

        // Decode ALL values in .data — no heuristic check needed.
        // The K8s Secret spec mandates that every .data value is base64.
        const { decodedCount, skippedBinaryCount, whitespaceKeys } =
            await decodeSecretData(secret);
        if (skippedBinaryCount > 0) {
            logInfo(`Skipped ${skippedBinaryCount} binary value(s) (kept as base64)`);
        }

        if (whitespaceKeys.length > 0) {
            const msg = `Whitespace trimmed from ${whitespaceKeys.length} value(s) before decoding: ${whitespaceKeys.join(', ')}`;
            logWarning(msg);
            showOutput();
            vscode.window.showWarningMessage(msg);
        }

        if (decodedCount > 0) {
            if (token?.isCancellationRequested) {
                return;
            }
            progress?.report({ message: 'Saving decoded file...' });
            const outputYaml = toYaml(secret);
            await fs.writeFile(filePath, outputYaml, 'utf8');

            const skippedMsg =
                skippedBinaryCount > 0
                    ? ` (${skippedBinaryCount} binary value(s) kept as base64)`
                    : '';
            logInfo(`Successfully decoded ${decodedCount} base64 value(s) in ${filePath}`);
            vscode.window.showInformationMessage(
                `Decoded ${decodedCount} base64 value(s)${skippedMsg}`
            );
        } else {
            logInfo(`No decodable base64 values found in ${filePath}`);
            vscode.window.showInformationMessage(
                skippedBinaryCount > 0
                    ? `All ${skippedBinaryCount} value(s) contain binary data and were kept as base64`
                    : 'No base64 encoded values found in "data" field'
            );
        }
    } catch (error) {
        if (
            token?.isCancellationRequested ||
            (error instanceof Error && error.message.includes('cancelled'))
        ) {
            logInfo(`Base64 decoding cancelled for ${filePath}`);
            vscode.window.showInformationMessage('Base64 decoding operation was cancelled');
            return;
        }
        logError(`Failed to decode base64 values in ${filePath}`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to decode base64 values: ${errorMessage}`);
    }
}
