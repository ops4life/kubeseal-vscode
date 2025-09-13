import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let statusBarItem: vscode.StatusBarItem;

// Helper to get current certificate path from folder
async function getCurrentCertificatePath(progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<string | undefined> {
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

// Select active certificate from certs folder
async function selectCertificate() {
    const config = vscode.workspace.getConfiguration('kubeseal');
    const certsFolder = config.get<string>('certsFolder', '');

    if (!certsFolder) {
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
        vscode.window.showInformationMessage(`Active certificate set to '${selected}'.`);
        updateStatusBar();
    }
}

// Update status bar item to show active cert file
function updateStatusBar() {
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

export function activate(context: vscode.ExtensionContext) {
    console.log('Kubeseal VSCode extension is now active!');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'kubeseal.selectCertificate';
    statusBarItem.name = 'Kubeseal Certificate';
    context.subscriptions.push(statusBarItem);

    // Update status bar on activation and show it immediately
    updateStatusBar();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.encrypt', (uri: vscode.Uri) => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Encrypting Kubernetes Secret...",
                cancellable: false
            }, async (progress) => {
                await encryptSecret(uri, progress);
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.decrypt', (uri: vscode.Uri) => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Decrypting SealedSecret...",
                cancellable: false
            }, async (progress) => {
                await decryptSecret(uri, progress);
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.setCertFolder', () => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Setting Certificate Folder...",
                cancellable: false
            }, async (progress) => {
                await setCertificateFolder(progress);
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.selectCertificate', () => {
            selectCertificate();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.encodeBase64', (uri: vscode.Uri) => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Encoding Secret Data as Base64...",
                cancellable: false
            }, async (progress) => {
                await encodeBase64Values(uri, progress);
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kubeseal.decodeBase64', (uri: vscode.Uri) => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Decoding Base64 Secret Data...",
                cancellable: false
            }, async (progress) => {
                await decodeBase64Values(uri, progress);
            });
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('kubeseal')) {
                updateStatusBar();
            }
        })
    );
}

async function encryptSecret(uri: vscode.Uri, progress?: vscode.Progress<{ message?: string; increment?: number }>) {
    try {
        progress?.report({ message: "Loading configuration..." });
        const filePath = uri.fsPath;
        const config = vscode.workspace.getConfiguration('kubeseal');
        const kubesealPath = config.get<string>('kubesealPath', 'kubeseal');

        // Get certificate path using new system
        const certPath = await getCurrentCertificatePath(progress);
        if (!certPath) {
            return;
        }

        // Check if certificate file exists
        progress?.report({ message: "Validating certificate file..." });
        if (!fs.existsSync(certPath)) {
            vscode.window.showErrorMessage(`Certificate file not found: ${certPath}`);
            return;
        }

        // Read the input file
        progress?.report({ message: "Reading secret file..." });
        const inputContent = fs.readFileSync(filePath, 'utf8');

        // Check if the file contains a Secret resource
        if (!inputContent.includes('kind: Secret')) {
            vscode.window.showWarningMessage('This file does not appear to contain a Kubernetes Secret');
            return;
        }

        // Generate output file path
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const basename = path.basename(filePath, ext);
        const outputPath = path.join(dir, `${basename}-sealed${ext}`);

        // Run kubeseal command
        progress?.report({ message: "Running kubeseal to encrypt secret..." });
        const command = `${kubesealPath} --cert "${certPath}" --format yaml < "${filePath}" > "${outputPath}"`;

        await execAsync(command);

        vscode.window.showInformationMessage(`Secret encrypted successfully: ${outputPath}`);

        // Ask if user wants to open the encrypted file
        const openResult = await vscode.window.showInformationMessage(
            'Would you like to open the encrypted file?',
            'Yes', 'No'
        );

        if (openResult === 'Yes') {
            progress?.report({ message: "Opening encrypted file..." });
            const document = await vscode.workspace.openTextDocument(outputPath);
            await vscode.window.showTextDocument(document);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to encrypt secret: ${errorMessage}`);
    }
}

async function decryptSecret(uri: vscode.Uri, progress?: vscode.Progress<{ message?: string; increment?: number }>) {
    try {
        progress?.report({ message: "Reading secret file..." });
        const filePath = uri.fsPath;
        const config = vscode.workspace.getConfiguration('kubeseal');
        const kubesealPath = config.get<string>('kubesealPath', 'kubeseal');

        // Read the input file
        const inputContent = fs.readFileSync(filePath, 'utf8');

        // Check if the file contains a SealedSecret resource
        if (!inputContent.includes('kind: SealedSecret')) {
            vscode.window.showWarningMessage('This file does not appear to contain a SealedSecret');
            return;
        }

        // Generate output file path
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const basename = path.basename(filePath, ext);
        const outputPath = path.join(dir, `${basename}-unsealed${ext}`);

        // Extract secret name from the SealedSecret
        const secretNameMatch = inputContent.match(/name:\s*([^\s\n]+)/);
        const secretName = secretNameMatch ? secretNameMatch[1] : path.basename(filePath, ext);
        const namespaceMatch = inputContent.match(/namespace:\s*([^\s\n]+)/);
        const namespace = namespaceMatch ? namespaceMatch[1] : 'default';

        // Get secret from cluster
        const clusterCommand = `kubectl get secret ${secretName} -n ${namespace} -o yaml > "${outputPath}"`;

        progress?.report({ message: "Getting secret from cluster..." });

        await execAsync(clusterCommand);

        vscode.window.showInformationMessage(`Secret retrieved successfully from cluster: ${outputPath}`);

        const openResult = await vscode.window.showInformationMessage(
            'Would you like to open the decrypted file?',
            'Yes', 'No'
        );

        if (openResult === 'Yes') {
            progress?.report({ message: "Opening decrypted file..." });
            const document = await vscode.workspace.openTextDocument(outputPath);
            await vscode.window.showTextDocument(document);
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to decrypt secret: ${errorMessage}`);
    }
}

async function setCertificateFolder(progress?: vscode.Progress<{ message?: string; increment?: number }>) {
    progress?.report?.({ message: "Prompting for certificate folder..." });
    const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: 'Select Certificate Folder'
    };

    const folderUri = await vscode.window.showOpenDialog(options);
    if (folderUri && folderUri.length > 0) {
        progress?.report?.({ message: "Saving certificate folder to config..." });
        const certsFolder = folderUri[0].fsPath;
        const config = vscode.workspace.getConfiguration('kubeseal');
        await config.update('certsFolder', certsFolder, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Certificate folder set to: ${certsFolder}`);
        // Clear any active cert file since we're changing folders
        await config.update('activeCertFile', '', vscode.ConfigurationTarget.Global);
        updateStatusBar();
    }
}

async function encodeBase64Values(uri: vscode.Uri, progress?: vscode.Progress<{ message?: string; increment?: number }>) {
    try {
        progress?.report({ message: "Reading file..." });
        const filePath = uri.fsPath;
        const inputContent = fs.readFileSync(filePath, 'utf8');

        if (!inputContent.includes('kind: Secret')) {
            vscode.window.showWarningMessage('This file does not appear to contain a Kubernetes Secret');
            return;
        }

        let modifiedContent = inputContent;
        let encodedCount = 0;

        progress?.report({ message: "Encoding values..." });

        // Enhanced regex to capture entire data section until next top-level key
        const dataRegex = /^(\s*data\s*:\s*\n)((?:(?:\s+.*|\s*)\n)*)/m;
        const dataMatch = modifiedContent.match(dataRegex);

        if (dataMatch) {
            const dataPrefix = dataMatch[1];
            const dataContent = dataMatch[2];
            const lines = dataContent.split('\n');
            let newDataContent = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Preserve empty lines and comments
                if (line.trim() === '' || line.trim().startsWith('#')) {
                    newDataContent += line + '\n';
                    continue;
                }

                // Enhanced key-value matching to handle various formats
                const keyValueMatch = line.match(/^(\s*)([^:\s]+)\s*:\s*(.*)$/);
                if (keyValueMatch) {
                    const indent = keyValueMatch[1];
                    const key = keyValueMatch[2];
                    const fullValue = keyValueMatch[3].trim();

                    // Check if this is a multiline YAML indicator
                    const multilineIndicators = ['|', '>', '|-', '>-', '|+', '>+'];
                    const isMultiline = multilineIndicators.includes(fullValue);

                    if (isMultiline) {
                        // Handle multiline YAML value
                        let multilineContent = '';
                        let j = i + 1;

                        // Collect all indented lines following the multiline indicator
                        while (j < lines.length) {
                            const nextLine = lines[j];

                            // Stop if we hit a line that's not properly indented for this multiline block
                            if (nextLine.trim() === '') {
                                // Empty line - include it and continue
                                multilineContent += '\n';
                            } else if (nextLine.startsWith(indent + '    ')) {
                                // This line is part of the multiline content (4+ spaces more than the key)
                                multilineContent += nextLine.substring(indent.length + 4) + '\n';
                            } else {
                                // Line doesn't match expected indentation, we've reached the end
                                break;
                            }
                            j++;
                        }

                        // Remove trailing newline if present
                        multilineContent = multilineContent.replace(/\n$/, '');

                        if (multilineContent.trim()) {
                            // Encode the multiline content as base64
                            try {
                                const encoded = Buffer.from(multilineContent, 'utf8').toString('base64');
                                newDataContent += `${indent}${key}: ${encoded}\n`;
                                encodedCount++;
                            } catch (encodeError) {
                                // If encoding fails, keep original format
                                newDataContent += line + '\n';
                                for (let k = i + 1; k < j; k++) {
                                    newDataContent += lines[k] + '\n';
                                }
                                vscode.window.showWarningMessage(`Failed to encode multiline value for key '${key}': ${encodeError}`);
                            }
                        } else {
                            // Empty multiline, keep as is
                            newDataContent += line + '\n';
                        }

                        // Skip the lines we've already processed
                        i = j - 1;
                        continue;
                    }

                    // Handle regular single-line values
                    let value = fullValue;
                    let comment = '';

                    // Extract comment if present
                    const commentMatch = fullValue.match(/^(.*?)(\s*#.*)$/);
                    if (commentMatch) {
                        value = commentMatch[1].trim();
                        comment = commentMatch[2];
                    }

                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }

                    if (value) {
                        // Enhanced base64 detection
                        const base64Regex = /^[A-Za-z0-9+/\-_]*={0,2}$/;
                        const isValidBase64Length = value.length % 4 === 0 || value.includes('=');

                        const isProbablyBase64 = (value: string): boolean => {
                            if (value.length < 4) {
                                return false;
                            }
                            if (!base64Regex.test(value)) {
                                return false;
                            }
                            if (!isValidBase64Length) {
                                return false;
                            }
                            try {
                                Buffer.from(value, 'base64');
                                return true;
                            } catch {
                                return false;
                            }
                        };

                        if (!isProbablyBase64(value)) {
                            // Encode the value as base64
                            try {
                                const encoded = Buffer.from(value, 'utf8').toString('base64');
                                newDataContent += `${indent}${key}: ${encoded}${comment}\n`;
                                encodedCount++;
                            } catch (encodeError) {
                                // If encoding fails, keep original value
                                newDataContent += line + '\n';
                                vscode.window.showWarningMessage(`Failed to encode value for key '${key}': ${encodeError}`);
                            }
                        } else {
                            // Already base64, keep as is
                            newDataContent += line + '\n';
                        }
                    } else {
                        // Handle empty values
                        newDataContent += line + '\n';
                    }
                } else {
                    // Preserve lines that don't match key-value pattern
                    newDataContent += line + '\n';
                }
            }

            if (encodedCount > 0) {
                modifiedContent = modifiedContent.replace(dataRegex, dataPrefix + newDataContent);
                fs.writeFileSync(filePath, modifiedContent, 'utf8');
                vscode.window.showInformationMessage(`Encoded ${encodedCount} value(s) to base64`);
            } else {
                vscode.window.showInformationMessage('All values in "data" are already base64 encoded');
            }
        } else {
            vscode.window.showWarningMessage('No "data" field found in the Secret');
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to encode base64 values: ${errorMessage}`);
    }
}

async function decodeBase64Values(uri: vscode.Uri, progress?: vscode.Progress<{ message?: string; increment?: number }>) {
    try {
        progress?.report({ message: "Reading file..." });
        const filePath = uri.fsPath;
        const inputContent = fs.readFileSync(filePath, 'utf8');

        if (!inputContent.includes('kind: Secret')) {
            vscode.window.showWarningMessage('This file does not appear to contain a Kubernetes Secret');
            return;
        }

        let modifiedContent = inputContent;
        let decodedCount = 0;

        progress?.report({ message: "Decoding base64 values..." });

        // Enhanced regex to capture entire data section until next top-level key
        const dataRegex = /^(\s*data\s*:\s*\n)((?:(?:\s+.*|\s*)\n)*)/m;
        const dataMatch = modifiedContent.match(dataRegex);

        if (dataMatch) {
            const dataPrefix = dataMatch[1];
            const dataContent = dataMatch[2];
            const lines = dataContent.split('\n');
            let newDataContent = '';

            for (const line of lines) {
                // Preserve empty lines and comments
                if (line.trim() === '' || line.trim().startsWith('#')) {
                    newDataContent += line + '\n';
                    continue;
                }

                // Enhanced key-value matching to handle various formats
                const keyValueMatch = line.match(/^(\s*)([^:\s]+)\s*:\s*(.*)$/);
                if (keyValueMatch) {
                    const indent = keyValueMatch[1];
                    const key = keyValueMatch[2];
                    const fullValue = keyValueMatch[3].trim();

                    // Handle regular single-line values (decode doesn't need multiline handling)
                    let value = fullValue;
                    let comment = '';

                    // Extract comment if present
                    const commentMatch = fullValue.match(/^(.*?)(\s*#.*)$/);
                    if (commentMatch) {
                        value = commentMatch[1].trim();
                        comment = commentMatch[2];
                    }

                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }

                    if (value) {
                        // Enhanced base64 detection
                        const base64Regex = /^[A-Za-z0-9+/\-_]*={0,2}$/;
                        const isValidBase64Length = value.length % 4 === 0 || value.includes('=');

                        const isProbablyBase64 = (value: string): boolean => {
                            if (value.length < 4) {
                                return false;
                            }
                            if (!base64Regex.test(value)) {
                                return false;
                            }
                            if (!isValidBase64Length) {
                                return false;
                            }
                            try {
                                Buffer.from(value, 'base64');
                                return true;
                            } catch {
                                return false;
                            }
                        };

                        if (isProbablyBase64(value)) {
                            try {
                                const decoded = Buffer.from(value, 'base64').toString('utf8');

                                // Check if decoded content is readable/printable text
                                const printableRegex = /^[\t\n\r\x20-\x7E]*$/u;
                                const hasNonPrintable = !printableRegex.test(decoded);

                                if (!hasNonPrintable) {
                                    // Content is readable text, decode it
                                    // Handle special characters that need quoting in YAML
                                    let quotedValue = decoded;
                                    const needsQuoting = /^[\s]*$|^[0-9]|^(true|false|null|yes|no|on|off)$/i.test(decoded) ||
                                                       /[:[\]{}|>]/.test(decoded) ||
                                                       decoded.includes('\n') ||
                                                       decoded.includes('"') ||
                                                       decoded.includes("'");

                                    if (needsQuoting) {
                                        // Use double quotes and escape internal quotes
                                        quotedValue = '"' + decoded.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
                                    }

                                    newDataContent += `${indent}${key}: ${quotedValue}${comment}\n`;
                                    decodedCount++;
                                } else {
                                    // Binary content detected, keep as base64
                                    newDataContent += line + '\n';
                                }
                            } catch (decodeError) {
                                // If decoding fails, keep original value
                                newDataContent += line + '\n';
                            }
                        } else {
                            newDataContent += line + '\n';
                        }
                    } else {
                        newDataContent += line + '\n';
                    }
                } else {
                    newDataContent += line + '\n';
                }
            }

            if (decodedCount > 0) {
                modifiedContent = modifiedContent.replace(dataRegex, dataPrefix + newDataContent);
                fs.writeFileSync(filePath, modifiedContent, 'utf8');
                vscode.window.showInformationMessage(`Decoded ${decodedCount} base64 value(s)`);
            } else {
                vscode.window.showInformationMessage('No base64 encoded values found in "data" field');
            }
        } else {
            vscode.window.showWarningMessage('No "data" field found in the Secret');
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to decode base64 values: ${errorMessage}`);
    }
}

export function deactivate() {}
