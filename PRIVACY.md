# Privacy Policy

**Effective date:** August 1, 2026

Chrome Immersive Fullscreen is a local browser extension that displays tabs, navigation controls, an address field, bookmarks, and window controls while Google Chrome is in F11 fullscreen mode.

## Summary

Chrome Immersive Fullscreen does not collect, transmit, sell, share, or retain personal data. It has no developer-operated server, analytics service, advertising integration, telemetry system, or remote code.

## Data the extension accesses

The extension accesses the minimum browser data needed to provide its visible features:

- **Tabs:** titles, URLs, active state, loading state, and window association for tabs in the current window.
- **Bookmarks:** titles, URLs, and folder structure from Chrome's Bookmarks Bar.
- **Favicons:** icons supplied by Chrome's local favicon cache.
- **Window state:** whether the current window is normal, maximized, minimized, or fullscreen.
- **User-entered navigation:** text entered into the extension's address field.

## How data is used

- Tab and bookmark data is processed in memory only to render the local interface.
- User-entered URLs are opened in Chrome.
- User-entered text that is not resolved as a URL is passed to Chrome's configured default search engine as an explicit user action.
- Window state is stored only in `chrome.storage.session` so the extension can restore the window after minimize or restore actions.

## Data collection, storage, and sharing

- The extension does not send tab, bookmark, browsing, or window data to the developer or any third party.
- The extension does not maintain a database or remote service.
- The extension does not use analytics, telemetry, advertising, tracking pixels, cookies, or fingerprinting.
- The extension does not persist tab or bookmark data.
- Session-only window-state records are removed by Chrome when the browser session ends.
- The extension does not read page form fields, passwords, cookies, or page content for collection.

Normal browser navigation still applies. When you open a website, that website receives the ordinary network request from Chrome. When you submit a search, Chrome sends the query to your configured default search engine under that service's own privacy policy. These actions are initiated by you and are not data collection by this extension.

## Permissions

- `bookmarks`: Reads the Bookmarks Bar. The extension does not create, edit, move, or delete bookmarks.
- `favicon`: Requests icons from Chrome's local favicon cache.
- `tabs`: Displays and manages tabs in the sender's Chrome window in response to user actions.
- `search`: Uses Chrome's default search provider for explicit searches.
- `storage`: Stores only session-scoped window restoration state.
- `http://*/*` and `https://*/*`: Allows the fullscreen interface to appear on ordinary web pages. Page content is not collected or exported.

## Security measures

- Tab and bookmark text is inserted using `textContent`, which prevents it from being interpreted as HTML.
- Navigation targets are parsed and restricted to an explicit protocol allowlist.
- `javascript:` and `data:` URLs are rejected.
- Tab operations are checked against the window that sent the request.
- The extension contains no external dependencies or remotely hosted code.

## Children's privacy

Because the extension does not collect personal data from anyone, it does not knowingly collect personal data from children.

## Changes to this policy

Material changes to data handling will be documented in this file and reflected in the extension's permissions and source code.

## Questions

For privacy questions, open an issue in the [GitHub repository](https://github.com/uygarozdemir/Chrome-Immersive-Fullscreen/issues). Do not include sensitive personal information in a public issue.
