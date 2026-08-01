# Contributing

Thank you for helping improve Chrome Immersive Fullscreen.

## Before you begin

- Search existing issues before opening a new one.
- Keep changes focused and preserve the extension's local-only privacy model.
- Do not add dependencies, permissions, host matches, network requests, telemetry, or remote code without a clear technical need and prior discussion.
- Do not include personal data, browser profiles, credentials, packaged `.crx` files, or generated artifacts.

## Development setup

1. Fork and clone the repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the repository folder.
5. After each source change, reload the extension and refresh all test pages.

## Code style

- Use two-space indentation in JavaScript, CSS, and JSON.
- Preserve strict mode, semicolons, double quotes, and trailing commas in multiline JavaScript structures.
- Use `UPPER_SNAKE_CASE` for constants, `camelCase` for functions and variables, and kebab-case for CSS IDs, classes, and filenames.
- Prefer small functions, early returns, explicit message types, and `textContent` for untrusted text.
- Keep user-facing interface text and public documentation in English.

## Validation

Run the static checks before opening a pull request:

```powershell
python -m json.tool manifest.json
node --check service-worker.js
node --check content.js
git diff --check
```

Then manually verify:

- normal, maximized, and F11 fullscreen windows;
- top-edge activation and hover persistence;
- tab switching, closing, middle-click closing, and new-tab creation;
- Back, Forward, Reload, URL navigation, and search;
- bookmarks, nested folders, overflow, and modifier-click behavior;
- horizontal scrolling for long tab and bookmark rows;
- minimize, restore, close, and prior-window-state restoration;
- `Esc` behavior;
- suppression during website-controlled HTML or video fullscreen.

Chrome internal pages do not accept content scripts, so test on ordinary `http://` or `https://` pages.

## Pull requests

Include:

- a concise explanation of the user-visible change;
- the Chrome version and operating system tested;
- the manual scenarios you verified;
- screenshots or a short recording for visual changes;
- any permission, privacy, or security impact.

## Security reports

Do not disclose exploitable vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md).
