/**
 * Minimal stand-in for the `vscode` module so compiled extension code can be
 * `require()`'d outside the VS Code runtime, for standalone Node tests.
 * Only implements what KubesealPanelProvider touches at construction time.
 */
module.exports = {
    workspace: {
        getConfiguration: () => ({ get: (_key, fallback) => fallback }),
    },
    window: {
        activeTextEditor: undefined,
    },
};
