# Usage Guide

This guide covers all the operations available in the Kubeseal VSCode extension.

## Typical Workflow

Here's a recommended workflow for managing secrets:

1. **Prepare your secret** -- Create a Kubernetes Secret YAML file with plain text values
2. **Encode values** (optional) -- Use "Encode Base64 Values" if your values are in plain text
3. **Set up certificate** -- Configure your certificate folder and select an active certificate
4. **Encrypt** -- Use "Encrypt with Kubeseal" to create a SealedSecret
5. **Commit safely** -- The encrypted SealedSecret can be safely committed to Git
6. **Deploy** -- Apply the SealedSecret to your Kubernetes cluster
7. **Decrypt** (if needed) -- Use "Decrypt Secret" to retrieve the original secret from the cluster

## Encrypting Secrets

1. Create a Kubernetes Secret YAML file
2. Right-click on the file in the explorer or editor
3. Select **"Encrypt with Kubeseal"**
4. The encrypted file will be saved with a `-sealed` suffix

### Example

**Input** (`my-secret.yaml`):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: default
data:
  username: YWRtaW4=
  password: cGFzc3dvcmQ=
```

**Output** (`my-secret-sealed.yaml`):

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: my-secret
  namespace: default
spec:
  encryptedData:
    username: AgBy3i4OJSWK+PiTySYZ...
    password: AgAKqjbxK9...
```

!!! info "How encryption works"
    The extension uses the `kubeseal` CLI with the selected certificate to encrypt each value in the Secret's `data` field. Only the corresponding cluster's private key can decrypt the values.

## Decrypting Secrets

1. Right-click on a sealed secret YAML file
2. Select **"Decrypt Secret"**
3. The extension retrieves the actual secret from your Kubernetes cluster using `kubectl`
4. The decrypted secret is saved with an `-unsealed` suffix

!!! warning "Requirements for decryption"
    - The SealedSecret must already be deployed to your cluster
    - Your `kubectl` must be configured to access the correct cluster
    - You need permissions to read secrets in the target namespace

### How It Works

The extension extracts the `name` and `namespace` from the SealedSecret YAML, then runs:

```bash
kubectl get secret <name> -n <namespace> -o yaml
```

## Managing Certificates

### Setting Certificate Folder

Use one of these methods:

- **Command Palette**: `Ctrl+Shift+P` → "Set Kubeseal Certificate Folder"
- **VS Code Settings**: Set `kubeseal.certsFolder` to your certificate directory path

The folder should contain certificate files with `.pem`, `.crt`, or `.cert` extensions.

### Selecting Active Certificate

1. Look at the status bar at the bottom of VS Code
2. Click on the certificate name (or "(not selected)" if none is active)
3. Choose from the list of available certificates
4. The selected certificate will be used for all encryption operations

!!! tip
    If no certificate folder is configured, clicking the status bar item will prompt you to set one up first.

## Base64 Encoding/Decoding

### Encode Base64 Values

1. Right-click on a Kubernetes Secret YAML file
2. Select **"Encode Base64 Values"**
3. All plain text values in the `data` field will be base64 encoded

**Before:**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
data:
  username: admin
  password: password123
```

**After:**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
data:
  username: YWRtaW4=
  password: cGFzc3dvcmQxMjM=
```

### Decode Base64 Values

1. Right-click on a Kubernetes Secret YAML file
2. Select **"Decode Base64 Values"**
3. All base64 encoded values in the `data` field will be decoded to plain text

!!! note
    The extension automatically detects which values are already encoded or decoded and skips them to prevent double encoding/decoding. Binary data is preserved as base64 during decoding.

## Compare with the CLI

Every action the extension runs is a thin wrapper around the same `kubeseal`/`kubectl`
commands you'd type by hand — nothing hidden. Run the equivalent command yourself in a
terminal to see exactly what the extension does and confirm the output matches:

| Extension action | Equivalent CLI command |
| --- | --- |
| **Encrypt with Kubeseal** | `kubeseal --cert <your-cert.pem> --format yaml < my-secret.yaml > my-secret-sealed.yaml` |
| **Decrypt Secret** (from cluster) | `kubectl get secret <name> -n <namespace> -o yaml > my-secret-unsealed.yaml` |
| **View Tab → list namespaces** | `kubectl get ns -o jsonpath='{.items[*].metadata.name}'` |
| **View Tab → list secrets** | `kubectl get secrets -n <namespace> -o jsonpath='{.items[*].metadata.name}'` |
| **Encode/Decode Base64 Values** | Node's `Buffer` — equivalent to `echo -n '<value>' \| base64` / `echo '<value>' \| base64 -d`, but run in-process (no external `base64` binary, so it works on Windows too) |

Since the extension shells out to the exact same `kubeseal`/`kubectl` binaries on your
`PATH` (via `spawn()`, never a shell string), the output of the CLI command and the
extension action should always be identical — useful for verifying trust in the tool or
debugging a mismatch.
