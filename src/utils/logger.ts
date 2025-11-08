/**
 * Logging utility for extension debugging and troubleshooting
 */

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

/**
 * Initializes the output channel for logging
 * @param context Extension context for subscriptions
 */
export function initializeLogger(context: vscode.ExtensionContext): void {
    outputChannel = vscode.window.createOutputChannel('Kubeseal');
    context.subscriptions.push(outputChannel);
}

/**
 * Logs an info message to the output channel
 * @param message Message to log
 */
export function logInfo(message: string): void {
    const timestamp = new Date().toISOString();
    outputChannel?.appendLine(`[${timestamp}] INFO: ${message}`);
}

/**
 * Logs an error message to the output channel
 * @param message Error message to log
 * @param error Optional error object
 */
export function logError(message: string, error?: unknown): void {
    const timestamp = new Date().toISOString();
    const errorDetails = error instanceof Error ? `: ${error.message}` : '';
    outputChannel?.appendLine(`[${timestamp}] ERROR: ${message}${errorDetails}`);
}

/**
 * Logs a warning message to the output channel
 * @param message Warning message to log
 */
export function logWarning(message: string): void {
    const timestamp = new Date().toISOString();
    outputChannel?.appendLine(`[${timestamp}] WARNING: ${message}`);
}

/**
 * Shows the output channel to the user
 */
export function showOutput(): void {
    outputChannel?.show();
}
