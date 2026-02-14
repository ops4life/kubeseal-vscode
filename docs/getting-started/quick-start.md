# Quick Start

Get up and running with the Kubeseal VSCode extension in just a few minutes.

## Prerequisites

Before installing the extension, ensure you have the following tools available:

1. **kubeseal** -- Install from [sealed-secrets releases](https://github.com/bitnami-labs/sealed-secrets/releases)
2. **kubectl** -- Install from [Kubernetes documentation](https://kubernetes.io/docs/tasks/tools/)
3. **VS Code 1.80.0+** -- Download from [code.visualstudio.com](https://code.visualstudio.com/)

Verify your installations:

```bash
kubeseal --version
kubectl version --client
```

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"Kubeseal VSCode"**
4. Click **Install**

### From VSIX File

Download the latest `.vsix` file from the [Releases page](https://github.com/ops4life/kubeseal-vscode/releases) and install it:

```bash
code --install-extension kubeseal-vscode-*.vsix
```

## Initial Setup

### 1. Configure Certificate Folder

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```
Set Kubeseal Certificate Folder
```

Select the folder containing your kubeseal certificate files (`.pem`, `.crt`, or `.cert`).

### 2. Select Active Certificate

Click the certificate indicator in the VS Code status bar (bottom), or run from the Command Palette:

```
Select Certificate
```

Choose the certificate you want to use for encryption operations.

### 3. Encrypt Your First Secret

1. Open a Kubernetes Secret YAML file
2. Right-click in the editor or file explorer
3. Select **"Encrypt with Kubeseal"**
4. A new `*-sealed.yaml` file is created with the encrypted SealedSecret

!!! success "You're all set!"
    The encrypted SealedSecret is safe to commit to Git and deploy to your Kubernetes cluster.

## Next Steps

- Read the full [Usage Guide](usage.md) for detailed workflows
- Learn about [Configuration options](../reference/configuration.md)
- Check out the [video demonstration](../index.md#video-demonstration)
