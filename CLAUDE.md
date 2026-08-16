# Repository Guidelines

`AGENTS.md` and `CLAUDE.md` are identical twins. Apply every change to both files.

## Language

Communicate with the project owner in Turkish. Keep public documentation, user-facing interface text, issue templates, and repository descriptions in English.

Be explicit about uncertainty. Distinguish verified facts from inference, and do not invent information.

## Authorization

- Never create a Git commit without explicit user approval.
- Pushes, tags, branch deletion, merges, rebases, and other history-changing operations also require explicit user approval.
- Do not run subagents unless the user explicitly approves or requests them.
- Ask before deleting files or folders, performing bulk renames, cleaning databases, or taking other difficult-to-reverse actions.
- Do not override the model selected by the user unless explicitly requested.
- If a requirement is materially ambiguous, ask before implementing it.

## Project structure

This repository is a dependency-free Chrome Manifest V3 extension. Keep the flat structure unless the project grows enough to justify modules:

- `manifest.json` defines permissions, the service worker, content scripts, and exposed resources.
- `service-worker.js` validates fullscreen state; reads tabs and bookmark bars; handles navigation, search, and window actions; and notifies active tabs about live data changes.
- `content.js` builds the three-row Shadow DOM interface and handles tabs, navigation, window controls, pointer and keyboard input, menus, focus preservation, live refreshes, and scrolling.
- `content.css` contains the isolated Chrome-like surface, tab strip, navigation, bookmark, window-control, and menu styles.
- `page.css` hides the page scrollbar only while the F11 interface is active so the overlay reaches the physical right edge.
- `README.md` explains behavior and limitations; `INSTALLATION.md` contains detailed installation instructions.

There is no generated output, package manager, or automated test directory.

## Validation

No build step is required. Load the repository directly from `chrome://extensions` with **Developer mode > Load unpacked**.

- `git diff --check` detects whitespace errors.
- `git status --short` confirms the exact files changed.
- `python -m json.tool manifest.json` validates the manifest.
- `node --check service-worker.js` and `node --check content.js` validate JavaScript syntax.

After editing, reload the extension on `chrome://extensions`, then refresh every test page so the content script is reinjected.

## Coding style

Use two-space indentation in JavaScript, CSS, and JSON. Preserve strict mode, semicolons, double quotes, and trailing commas in multiline JavaScript structures. Use `UPPER_SNAKE_CASE` for constants, `camelCase` for functions and variables, and kebab-case for CSS IDs, classes, and filenames. Keep user-facing text in English. Prefer small functions, early returns, and explicit message types such as `GET_FULLSCREEN_STATE`.

## Testing

Testing is manual. Verify normal and F11 windows, top-edge activation and hover/focus persistence, tab actions, tab reordering by drag, dotted and local address resolution, search navigation, live tab and bookmark refreshes, window-state restoration, nested folders, overflow-menu keyboard navigation, horizontal scrolling, middle/modifier-click behavior, `Esc`, and HTML/video fullscreen suppression. Test on ordinary `http://` or `https://` pages; Chrome internal pages do not accept content scripts. Document the Chrome version and scenarios checked in pull requests.

## Commits and pull requests

Use Conventional Commits with concise English descriptions, for example `fix: correct fullscreen detection`. Keep each commit focused. Pull requests should explain the user-visible effect, list manual test results, link relevant issues, and include screenshots or a short recording for visual changes.

## Security and permissions

Do not add permissions, host matches, network requests, telemetry, or remote code without explicit justification. Preserve URL validation, `textContent`-based rendering, read-only bookmark behavior, sender-window validation, and session-only window-state storage. Treat changes to `manifest.json`, message handling, tab access, and window actions as security-sensitive.
