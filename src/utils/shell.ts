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
