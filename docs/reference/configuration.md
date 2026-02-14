# Configuration Reference

## Extension Settings

The extension provides the following VS Code settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `kubeseal.certsFolder` | `string` | `""` | Path to the folder containing kubeseal certificate files (`.pem`, `.crt`, `.cert`) |
| `kubeseal.activeCertFile` | `string` | `""` | Filename of the currently active certificate in the certs folder |

### Setting the Certificate Folder

=== "Via Command Palette"

    1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
    2. Run "Set Kubeseal Certificate Folder"
    3. Select the folder in the file picker

=== "Via Settings JSON"

    ```json
    {
      "kubeseal.certsFolder": "/path/to/certificates",
      "kubeseal.activeCertFile": "my-cluster.pem"
    }
    ```

=== "Via Settings UI"

    1. Open Settings (`Ctrl+,` / `Cmd+,`)
    2. Search for "kubeseal"
    3. Set the certificate folder path and active certificate filename

## Commands

All commands are available via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and context menus on YAML files.

| Command ID | Title | Description |
|-----------|-------|-------------|
| `kubeseal.encrypt` | Encrypt with Kubeseal | Encrypts a Kubernetes Secret using kubeseal with the active certificate |
| `kubeseal.decrypt` | Decrypt Secret | Retrieves the original secret from the cluster using kubectl |
| `kubeseal.setCertFolder` | Set Kubeseal Certificate Folder | Opens folder picker to configure the certificate directory |
| `kubeseal.selectCertificate` | Select Certificate | Shows quick pick menu to select the active certificate |
| `kubeseal.encodeBase64` | Encode Base64 Values | Encodes plain text values in Secret's `data` field to base64 |
| `kubeseal.decodeBase64` | Decode Base64 Values | Decodes base64 values in Secret's `data` field to plain text |

## Context Menus

The following commands appear in right-click context menus when a `.yaml` or `.yml` file is selected:

**File Explorer context menu:**

- Encrypt with Kubeseal
- Decrypt Secret
- Encode Base64 Values
- Decode Base64 Values

**Editor context menu:**

- Encrypt with Kubeseal
- Decrypt Secret
- Encode Base64 Values
- Decode Base64 Values

## File Naming Conventions

| Operation | Input | Output |
|-----------|-------|--------|
| Encrypt | `my-secret.yaml` | `my-secret-sealed.yaml` |
| Decrypt | `my-secret-sealed.yaml` | `my-secret-sealed-unsealed.yaml` |
| Encode Base64 | Modifies file in-place | Same file |
| Decode Base64 | Modifies file in-place | Same file |

## Supported Certificate Formats

The extension recognizes the following certificate file extensions:

- `.pem` -- PEM-encoded certificate
- `.crt` -- Certificate file
- `.cert` -- Certificate file
