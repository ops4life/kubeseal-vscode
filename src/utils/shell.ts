/**
 * Shell command execution utilities with security and cancellation support
 */

import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import * as vscode from 'vscode';
import { promises as fs } from 'fs';

export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Executes a command using spawn (safer than exec) with cancellation and timeout support
 * @param command Command to execute
 * @param args Command arguments
 * @param options Spawn options
 * @param token Cancellation token
 * @param timeoutMs Timeout in milliseconds (default: 30000)
 * @returns Promise with execution result
 */
export async function execWithCancellation(
    command: string,
    args: string[],
    options: SpawnOptionsWithoutStdio,
    token: vscode.CancellationToken,
    timeoutMs: number = 30000
): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, options);

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('error', (error) => {
            reject(new Error(`Failed to execute command: ${error.message}`));
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr, exitCode: code });
            } else {
                reject(new Error(`Command failed with exit code ${code}: ${stderr || stdout}`));
            }
        });

        // Handle cancellation
        const cancellationListener = token.onCancellationRequested(() => {
            child.kill('SIGTERM');
            reject(new Error('Operation was cancelled by user'));
        });

        // Handle timeout
        const timeoutId = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        // Cleanup when process completes
        child.on('exit', () => {
            cancellationListener.dispose();
            clearTimeout(timeoutId);
        });
    });
}

/**
 * Executes kubeseal command to encrypt a secret
 * @param certPath Path to certificate file
 * @param inputPath Path to input YAML file
 * @param outputPath Path to output YAML file
 * @param token Cancellation token
 */
export async function execKubeseal(
    certPath: string,
    inputPath: string,
    outputPath: string,
    token: vscode.CancellationToken
): Promise<void> {
    // Read input file
    const inputContent = await fs.readFile(inputPath, 'utf8');

    // Execute kubeseal with stdin/stdout
    const child = spawn('kubeseal', ['--cert', certPath, '--format', 'yaml'], {
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('error', (error) => {
            reject(new Error(`Failed to execute kubeseal: ${error.message}`));
        });

        child.on('close', async (code) => {
            if (code === 0) {
                try {
                    await fs.writeFile(outputPath, stdout, 'utf8');
                    resolve();
                } catch (error) {
                    reject(new Error(`Failed to write output file: ${error}`));
                }
            } else {
                reject(new Error(`Kubeseal failed with exit code ${code}: ${stderr || stdout}`));
            }
        });

        // Handle cancellation
        const cancellationListener = token.onCancellationRequested(() => {
            child.kill('SIGTERM');
            reject(new Error('Operation was cancelled by user'));
        });

        // Handle timeout
        const timeoutId = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error('Kubeseal operation timed out after 30 seconds'));
        }, 30000);

        // Cleanup when process completes
        child.on('exit', () => {
            cancellationListener.dispose();
            clearTimeout(timeoutId);
        });

        // Write input to stdin
        child.stdin?.write(inputContent);
        child.stdin?.end();
    });
}

/**
 * Executes kubectl command to get a secret from the cluster
 * @param secretName Secret name
 * @param namespace Namespace
 * @param outputPath Path to output YAML file
 * @param token Cancellation token
 */
export async function execKubectl(
    secretName: string,
    namespace: string,
    outputPath: string,
    token: vscode.CancellationToken
): Promise<void> {
    const result = await execWithCancellation(
        'kubectl',
        ['get', 'secret', secretName, '-n', namespace, '-o', 'yaml'],
        {},
        token
    );

    await fs.writeFile(outputPath, result.stdout, 'utf8');
}

/**
 * Lists all namespace names in the cluster
 * @param token Cancellation token
 * @returns Array of namespace names (empty array if none found)
 */
export async function listNamespaces(token: vscode.CancellationToken): Promise<string[]> {
    const result = await execWithCancellation(
        'kubectl',
        ['get', 'ns', '-o', "jsonpath={.items[*].metadata.name}"],
        {},
        token
    );
    return result.stdout.trim().length > 0 ? result.stdout.trim().split(/\s+/) : [];
}

/**
 * Lists all secret names in a namespace
 * @param namespace Namespace to list secrets from
 * @param token Cancellation token
 * @returns Array of secret names (empty array if none found)
 */
export async function listSecrets(
    namespace: string,
    token: vscode.CancellationToken
): Promise<string[]> {
    const result = await execWithCancellation(
        'kubectl',
        ['get', 'secrets', '-n', namespace, '-o', "jsonpath={.items[*].metadata.name}"],
        {},
        token
    );
    return result.stdout.trim().length > 0 ? result.stdout.trim().split(/\s+/) : [];
}

/**
 * Fetches a secret from the cluster as YAML text (without writing to a file)
 * @param namespace Namespace of the secret
 * @param name Secret name
 * @param token Cancellation token
 * @returns Raw YAML content of the secret
 */
export async function getSecretYaml(
    namespace: string,
    name: string,
    token: vscode.CancellationToken
): Promise<string> {
    const result = await execWithCancellation(
        'kubectl',
        ['get', 'secret', name, '-n', namespace, '-o', 'yaml'],
        {},
        token
    );
    return result.stdout;
}

/**
 * Validates that a binary is installed and accessible
 * @param binaryPath Path to binary
 * @returns true if binary is accessible
 */
export async function validateBinaryInstalled(binaryPath: string): Promise<boolean> {
    try {
        const result = await new Promise<ExecResult>((resolve, reject) => {
            const child = spawn(binaryPath, ['--version'], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                reject(error);
            });

            child.on('close', (code) => {
                resolve({ stdout, stderr, exitCode: code ?? -1 });
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error('Validation timeout'));
            }, 5000);
        });

        return result.exitCode === 0;
    } catch {
        return false;
    }
}

/**
 * Encodes a raw string value using the system `base64` terminal command.
 * Produces output identical to: printf '%s' "value" | base64
 * Compatible with macOS and Linux.
 * @param value Plain text value to encode
 * @returns Base64 encoded string (no newlines)
 */
export async function encodeWithBase64(value: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn('base64', [], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('error', (error) => {
            reject(new Error(`base64 encode failed: ${error.message}`));
        });

        child.on('close', (code) => {
            if (code === 0) {
                // Strip all newlines — some platforms wrap at 76 chars
                resolve(stdout.replace(/\n/g, ''));
            } else {
                reject(new Error(`base64 encode failed (exit ${code}): ${stderr || stdout}`));
            }
        });

        child.stdin?.write(value, 'utf8');
        child.stdin?.end();
    });
}

/**
 * Decodes a base64-encoded string using the system `base64` terminal command.
 * Equivalent to: echo "encoded" | base64 -d
 * Compatible with macOS (10.13+) and Linux.
 *
 * stdout is collected as raw Buffer chunks and joined once at the end to avoid
 * corrupting multi-byte UTF-8 sequences (emoji, accented chars, CJK, etc.) that
 * can span chunk boundaries when decoded incrementally via toString().
 *
 * @param encoded Base64 encoded string (single-line or line-wrapped)
 * @returns Decoded string
 * @throws Error if the input is not valid base64
 */
export async function decodeWithBase64(encoded: string): Promise<string> {
    // macOS uses -D (legacy) but also supports -d (10.13+); Linux uses -d
    // Use -d universally — works on all supported platforms
    const args = process.platform === 'darwin' ? ['-D'] : ['-d'];

    return new Promise((resolve, reject) => {
        const child = spawn('base64', args, {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Collect as raw Buffers — joining once preserves all byte sequences
        const stdoutChunks: Buffer[] = [];
        let stderr = '';

        child.stdout?.on('data', (data: Buffer) => {
            stdoutChunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('error', (error) => {
            reject(new Error(`base64 decode failed: ${error.message}`));
        });

        child.on('close', (code) => {
            if (code === 0) {
                // Decode the full buffer at once — safe for all Unicode + binary
                resolve(Buffer.concat(stdoutChunks).toString('utf8'));
            } else {
                reject(
                    new Error(
                        `base64 decode failed (exit ${code}): ${stderr || 'invalid base64 input'}`
                    )
                );
            }
        });

        child.stdin?.write(encoded, 'utf8');
        child.stdin?.end();
    });
}
