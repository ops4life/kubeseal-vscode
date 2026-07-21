# Cross-platform (Windows/macOS/Linux)

Extension must work identically on Windows, macOS, Linux. Node.js 20+, VS Code 1.80.0+ run on all three — code must not assume a Unix shell or Unix-only binaries.

- No dependency on Unix-only CLI tools (e.g. `base64`, `grep`, `sed`) being in PATH. Windows lacks these natively. Use Node built-ins (`Buffer`, `fs`, `path`) instead of shelling out for logic that Node can do itself.
- Only shell out to `kubeseal` / `kubectl` — the extension's actual required external binaries — via `spawn()`, never `exec()` with a shell string.
- Use `path.join`/`path.sep` — never hardcode `/` or `\` in file paths.
- No POSIX-only assumptions in spawned command args (quoting, `&&`, `~` expansion) — `spawn()` args are passed as an array, not a shell string, so this mostly avoids itself, but double-check when building argv.
- When fixing a platform-specific bug, add/extend a fixture in `tests/run-tests.mjs` covering the platform difference (see the base64 encode/decode rewrite for encode/decode as the reference pattern — commit `bfcd5d9`).
- Before declaring cross-platform work done, reason explicitly about Windows path separators, line endings (CRLF vs LF), and PATH lookup — don't just test on the dev machine's OS.
