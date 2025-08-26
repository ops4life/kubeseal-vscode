# Kubeseal VSCode Extension

<p align="center">
  <img src="icon.png" alt="Kubeseal Icon" width="150" style="border-radius: 15px;">
</p>

[![Version](https://img.shields.io/visual-studio-marketplace/v/devops4life.kubeseal-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=devops4life.kubeseal-vscode)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/devops4life.kubeseal-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=devops4life.kubeseal-vscode)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/devops4life.kubeseal-vscode.svg)](https://marketplace.visualstudio.com/items?itemName=devops4life.kubeseal-vscode)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 📚 Table of Contents
- [Installation](#-installation)
- [Features](#-features)
- [Requirements](#-requirements)
- [Setup](#-setup)
- [Usage](#-usage)
- [Configuration](#-configuration)
- [Commands](#-commands)
- [Contributing](#-contributing)
- [License](#-license)
- [Links](#-links)

## 🚀 Installation

**Install from VS Code Marketplace:**

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Kubeseal VSCode"
4. Click Install

**Or install directly:**

- [Download from Releases page](https://github.com/duyluann/kubeseal-vscode/releases)

## ✨ Features

- **🔐 Encrypt Secrets**: Right-click on YAML files containing Kubernetes secrets to encrypt them using kubeseal
- **🔓 Decrypt Secrets**: Retrieve the original content of sealed secrets from your Kubernetes cluster
- **📝 Base64 Encoding/Decoding**: Encode and decode base64 values in Kubernetes secret data fields
- **📂 Certificate Folder Management**: Configure a folder containing multiple kubeseal certificates and easily switch between them
- **🔄 Active Certificate Selection**: Click on the status bar to select which certificate to use for encryption
- **🎯 Context Menu Integration**: Access kubeseal operations directly from the file explorer and editor context menus

## 📋 Requirements

> **Important:** You must have access to your Kubernetes cluster before using this extension, especially for decryption.

**Development Requirements:**

- Node.js 20+ (for development and building)

**Runtime Requirements:**

- `kubeseal` binary must be installed and accessible in your PATH
- `kubectl` binary must be installed and configured for cluster access
- For encryption: A kubeseal certificate folder containing certificate files (`.pem`, `.crt`, or `.cert`)
- For decryption: Access to the Kubernetes cluster where the secret is deployed

## 🛠️ Setup

1. Install the `kubeseal` binary from [sealed-secrets releases](https://github.com/bitnami-labs/sealed-secrets/releases)
2. Install this extension from the VS Code marketplace
3. Configure your certificate folder using the command palette: "Set Kubeseal Certificate Folder"
4. Select an active certificate by clicking on the status bar item

## 📖 Usage

> **Note:** You must have access to your Kubernetes cluster before using the extension. Decryption will not work unless your `kubectl` is configured and you have the necessary permissions.

### 🔐 Encrypting Secrets

1. Create a Kubernetes secret YAML file
2. Right-click on the file in the explorer or editor
3. Select "Encrypt with Kubeseal"
4. The encrypted file will be saved with `-sealed` suffix

### 🔓 Decrypting Secrets

1. Right-click on a sealed secret YAML file
2. Select "Decrypt Secret"
3. The extension will retrieve the actual secret from your Kubernetes cluster using `kubectl`
4. The decrypted secret will be saved with `-unsealed` suffix

**Note**: This requires that:

- The sealed secret has been deployed to your cluster
- Your `kubectl` is configured to access the correct cluster
- You have permissions to read secrets in the target namespace

### 🔧 Managing Certificates

#### Setting Certificate Folder

- Use Command Palette: `Ctrl+Shift+P` → "Set Kubeseal Certificate Folder"
- Or configure in VS Code settings: `kubeseal.certsFolder`

#### Selecting Active Certificate

1. Look at the status bar at the bottom of VS Code
2. Click on the certificate name (or "(not selected)" if none is active)
3. Choose from the list of available certificates in your configured folder
4. The selected certificate will be used for all encryption operations

**Note**: If no certificate folder is configured, clicking the status bar will prompt you to set one up.

### 📝 Base64 Encoding/Decoding

The extension provides utilities for working with base64 encoded values in Kubernetes secrets:

#### Encode Base64 Values

1. Right-click on a Kubernetes secret YAML file
2. Select **"Encode Base64 Values"**
3. All plain text values in the `data` field will be base64 encoded

#### Decode Base64 Values

1. Right-click on a Kubernetes secret YAML file
2. Select **"Decode Base64 Values"**
3. All base64 encoded values in the `data` field will be decoded to plain text

## ⚙️ Configuration

The extension provides the following settings:

- `kubeseal.certsFolder`: Path to the folder containing kubeseal certificate files (\*.pem, \*.crt, \*.cert)
- `kubeseal.activeCertFile`: Filename of the currently active certificate in the certs folder
- `kubeseal.kubesealPath`: Path to the kubeseal binary (default: "kubeseal")

## 🎮 Commands

- `kubeseal.encrypt`: Encrypt with Kubeseal
- `kubeseal.decrypt`: Decrypt Secret
- `kubeseal.setCertFolder`: Set Kubeseal Certificate Folder
- `kubeseal.selectCertificate`: Select Certificate
- `kubeseal.encodeBase64`: Encode Base64 Values
- `kubeseal.decodeBase64`: Decode Base64 Values

## 🛠️ Getting Help

If you encounter any issues or have questions, feel free to:
- Open an issue on [GitHub](https://github.com/duyluann/kubeseal-vscode/issues)
- Start a discussion in the [Discussions tab](https://github.com/duyluann/kubeseal-vscode/discussions)
- Email us at support@example.com

## ⚠️ Known Issues

- Decryption may fail if the `kubectl` context is not properly configured.
- Ensure the `kubeseal` binary is compatible with your Kubernetes cluster version.

For a complete list of changes, see the [Changelog](CHANGELOG.md).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=devops4life.kubeseal-vscode)
- [GitHub Repository](https://github.com/duyluann/kubeseal-vscode)
- [Sealed Secrets Documentation](https://github.com/bitnami-labs/sealed-secrets)
