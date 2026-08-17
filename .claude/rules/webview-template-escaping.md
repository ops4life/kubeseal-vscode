# Webview template-literal escaping (`ui/panelProvider.ts`)

`KubesealPanelProvider._getHtml()` builds the whole panel — HTML, CSS, and
the client-side JS in `<script>` — as one TypeScript template literal.
Backslash-escapes meant for the *browser's* JS/regex (`\n`, `\s`, `\d`, ...)
are consumed by TypeScript itself while building that outer string unless
doubled.

- Writing `'a\nb'` or `/\s/` inside the webview script section produces a
  real newline / drops the backslash in the emitted JS — this breaks the
  `<script>` block with a syntax error, and VS Code surfaces nothing: every
  button and tab in the panel goes silently dead.
- Any escape sequence intended to reach the browser must be written
  double-escaped in the TS source: `\\n`, `\\s`, `\\d`, etc.

Required after editing anything inside `_getHtml()`:

```bash
npm run test:panel
```

This renders the real generated HTML via the compiled extension code and
parses the inline `<script>` with Node's `vm` module — it fails loudly on
this exact class of bug instead of shipping a dead panel.
