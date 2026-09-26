---
name: dsh-agent-browser
description: Use direct in-process browser tools to navigate, inspect, and interact with web pages in DSH.
---

# DSH agent-browser

Use `browser_open` to navigate to a URL. The returned snapshot contains element references such as `@e1`. Use those references with `browser_click` and `browser_fill`. After navigation or a major page change, take a new snapshot before reusing element references.

Use `browser_action` for upstream native actions beyond the common tools. Pass the action name and its native JSON fields as `command`, for example `{ "action": "tab_list" }` or `{ "action": "screenshot", "fullPage": true }`. The action runs in the current DSH browser session. `browser_close` closes that session's browser.

These are DSH tools backed by the built-in browser engine. They do not require a shell command or an MCP server.
