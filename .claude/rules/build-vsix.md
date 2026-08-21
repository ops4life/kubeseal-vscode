# Build VSIX after implementation

Always build a test VSIX with `npm run package:demo` after implementing
changes, to verify the package bundles cleanly and correctly excludes
reference directories (like `vscode-kubernetes-tools`).

`package:demo` outputs `kubeseal-vscode-<version>-demo.vsix` — the `-demo`
suffix keeps it clearly distinct from the real `kubeseal-vscode-<version>.vsix`
that `npm run package`/semantic-release produce for publishing, so a
leftover local test build is never confused with a release artifact.

Required immediately after finishing any implementation, before declaring
the task done — not just before publishing. Point the user to the
`-demo.vsix` file (and the `code --install-extension <path>` command) so
they can install and try it.
