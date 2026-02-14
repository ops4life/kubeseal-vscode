# Security

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainers or use [GitHub Security Advisories](https://github.com/ops4life/kubeseal-vscode/security/advisories/new)
3. Provide details about the vulnerability and steps to reproduce

## Security Practices

### Shell Command Execution

The extension uses `spawn()` instead of `exec()` for all shell command execution. This prevents command injection vulnerabilities by ensuring arguments are passed as separate parameters rather than being interpolated into a shell string.

```typescript
// Safe: arguments are parameterized
spawn('kubeseal', ['--cert', certPath, '--format', 'yaml']);

// Unsafe (NOT used): vulnerable to injection
exec(`kubeseal --cert ${certPath} --format yaml`);
```

### Input Validation

All user inputs are validated before being passed to shell commands:

- Kubernetes resource names are validated against [RFC 1123 DNS label standard](https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-label-names)
- Namespace names are validated before use in `kubectl` commands
- File paths are validated before file operations

### Dependency Security

- Dependencies are regularly audited via `npm audit`
- Dependabot is configured for automatic security updates
- CodeQL analysis runs on all pull requests
- Gitleaks scans for accidental secret commits

### Supported Versions

| Version | Supported |
|---------|-----------|
| 3.x.x | Yes |
| 2.x.x | Security fixes only |
| < 2.0.0 | No |

## Security-Related Configuration

The extension stores certificate paths in VS Code workspace settings. These paths are local to your machine and are not transmitted anywhere. The extension only communicates with:

- **kubeseal CLI** -- Local binary for encryption (certificate path passed as argument)
- **kubectl CLI** -- Local binary for decryption (connects to your configured cluster)

No data is sent to external services by the extension itself.
