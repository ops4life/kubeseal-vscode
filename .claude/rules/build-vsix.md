# Build VSIX after implementation

Always build a new VSIX package with `npm run package` after implementing
changes, to verify the package bundles cleanly and correctly excludes
reference directories (like `vscode-kubernetes-tools`).

Required immediately after finishing any implementation, before declaring
the task done — not just before publishing.
