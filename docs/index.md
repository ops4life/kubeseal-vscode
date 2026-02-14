# Kubeseal VSCode Extension

<p align="center">
  <img src="https://raw.githubusercontent.com/ops4life/kubeseal-vscode/main/icon.png" alt="Kubeseal Icon" width="150" />
</p>

[![Version](https://img.shields.io/visual-studio-marketplace/v/ops4life.kubeseal-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=ops4life.kubeseal-vscode)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/ops4life.kubeseal-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=ops4life.kubeseal-vscode)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/ops4life.kubeseal-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=ops4life.kubeseal-vscode)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ops4life/kubeseal-vscode/blob/main/LICENSE)

A VS Code extension that integrates [Bitnami Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) into your editor, allowing you to encrypt/decrypt Kubernetes secrets and encode/decode base64 values directly from VS Code.

## Features

- **Encrypt Secrets** -- Right-click on YAML files containing Kubernetes secrets to encrypt them using kubeseal
- **Decrypt Secrets** -- Retrieve the original content of sealed secrets from your Kubernetes cluster
- **Base64 Encoding/Decoding** -- Encode and decode base64 values in Kubernetes secret data fields
- **Certificate Management** -- Configure a folder containing multiple kubeseal certificates and easily switch between them
- **Status Bar Integration** -- Click on the status bar to select which certificate to use for encryption
- **Context Menu Integration** -- Access kubeseal operations directly from the file explorer and editor context menus

## Quick Links

- [Quick Start Guide](getting-started/quick-start.md) -- Get up and running in minutes
- [Usage Guide](getting-started/usage.md) -- Detailed usage instructions and workflows
- [Configuration Reference](reference/configuration.md) -- All available settings and commands
- [Contributing Guide](guides/contributing.md) -- How to contribute to the project

## Video Demonstration

Watch the extension in action:

[![Kubeseal VSCode Extension Demo](https://img.youtube.com/vi/NAcHxSNFhyc/0.jpg)](https://youtu.be/NAcHxSNFhyc)

## How It Works

```mermaid
graph LR
    A[Secret YAML] -->|Encrypt with Kubeseal| B[kubeseal CLI]
    B -->|Uses certificate| C[SealedSecret YAML]
    C -->|Safe to commit| D[Git Repository]
    D -->|Deploy| E[Kubernetes Cluster]
    E -->|Decrypt via kubectl| F[Original Secret]
```

## Requirements

| Tool | Purpose | Required For |
|------|---------|-------------|
| `kubeseal` | Encrypts secrets using certificates | Encryption |
| `kubectl` | Retrieves secrets from cluster | Decryption |
| VS Code 1.80.0+ | Editor | All operations |
| Node.js 20+ | Development | Building from source |
