# dsh-agent-browser

A DSH plugin built directly from the latest tested [agent-browser](https://github.com/vercel-labs/agent-browser) release. It loads agent-browser's Rust browser engine as an in-process Node addon. Browser operations do not start the agent-browser command-line program or an MCP server.

The plugin provides `browser_open`, `browser_snapshot`, `browser_read`, `browser_click`, `browser_fill`, `browser_close`, and `browser_action`. The last tool exposes the upstream native action format for capabilities beyond the common tools. Browser state is isolated by DSH session. The bundled `dsh-agent-browser` skill describes the navigation, snapshot, and interaction workflow.

## Releases and upgrades

The [release workflow](.github/workflows/upstream-release.yml) checks the newest official agent-browser release daily. It checks out that exact tag, adds the Node binding at build time, builds native addons for Windows x64, Linux x64 (glibc), macOS x64, and macOS arm64, tests them, and packages one DSH plugin tarball. A release is created only when every required build and test passes. If an upstream change breaks the binding, the previous release remains available and the workflow reports the failure.

Install the newest plugin tarball from this repository's GitHub Releases through DSH's plugin manager, then restart the affected DSH profile. The native addon version is checked against its manifest when loaded. Updating the installed plugin package is the step that moves a DSH profile to the newly packaged upstream version.

## Local development

Requires Node.js 24 or newer, pnpm, Rust, and a platform linker. The following commands build from an existing agent-browser checkout without modifying it:

```text
pnpm install --ignore-scripts
node scripts/prepare.mjs --source <agent-browser-checkout>
node scripts/build.mjs
node scripts/native-smoke.mjs
node scripts/live-smoke.mjs
pnpm check
```

Omit `--source` to build from the newest official GitHub release. `prepare.mjs` creates a disposable source copy under `.build/`; the binding lives in `bridge/lib.rs`. The release tarball includes platform-specific `.node` files and matching upstream-version manifests.

The DSH bundle is declared in `cordis.patch.yml`. Configuration accepts `headless` (default `true`). The plugin requires DSH's `tools` and `skills` services.

The upstream project and this adapter use the Apache-2.0 license. See [LICENSE](LICENSE).
