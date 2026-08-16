# Chrome Immersive Fullscreen

Chrome Immersive Fullscreen brings essential browser controls back while Google Chrome is in F11 fullscreen mode. Move the pointer to the top edge of the screen to reveal tabs, navigation controls, the address bar, bookmarks, and window controls without leaving fullscreen.

The extension is dependency-free, runs entirely inside Chrome, and does not collect, transmit, sell, or retain personal data.

## Highlights

- Activates only when the current Chrome window is in F11 fullscreen.
- Reveals a three-row Chrome-like interface from a 3-pixel top-edge trigger.
- Shows tabs with titles and favicons; supports switching, reordering by dragging, closing, middle-click closing, and opening a new tab.
- Provides Back, Forward, Reload, direct URL navigation, and searches through Chrome's configured default search engine.
- Displays the Chrome Bookmarks Bar, including nested folders and an overflow menu.
- Refreshes the open interface when tabs or bookmarks change without interrupting focused controls or menus.
- Supports standard bookmark modifiers: Ctrl/Cmd-click, Ctrl/Cmd+Shift-click, Shift-click, and middle-click.
- Includes minimize, restore, and close controls for the current Chrome window.
- Suppresses the overlay during website-controlled HTML or video fullscreen.
- Uses no package manager, build step, external library, remote code, analytics, or telemetry.

## Privacy by design

Chrome Immersive Fullscreen has no backend and makes no extension-initiated network requests.

- No personal data is collected, sold, shared, or sent to the developer.
- No analytics, telemetry, advertising, tracking pixels, or cookies are used.
- Tab and bookmark data is read only when needed to render the local interface.
- Tab and bookmark data remains in Chrome and is not persisted by the extension.
- Only window state is stored, and only in `chrome.storage.session`; Chrome clears it when the browser session ends.
- Text originating from tabs and bookmarks is rendered with `textContent`, not HTML.
- `javascript:` and `data:` bookmark URLs are blocked.

Entering a URL or search query is an explicit browser action: URLs are opened in Chrome, while search text is passed to the default search engine selected in Chrome. See the full [Privacy Policy](PRIVACY.md).

## Permissions

| Permission | Why it is required |
| --- | --- |
| `bookmarks` | Reads the Bookmarks Bar and nested folders. The extension does not create, edit, move, or delete bookmarks. |
| `favicon` | Displays site icons from Chrome's local favicon cache. |
| `tabs` | Displays tabs in the current window and performs user-requested tab and navigation actions. The extension does not read or retain Chrome's history list. |
| `search` | Sends non-URL address-bar input to Chrome's configured default search engine. |
| `storage` | Keeps window restoration state in session-only storage. |
| `http://*/*`, `https://*/*` | Injects the fullscreen interface into ordinary web pages. Page content is not collected or exported. |

## Installation

No build step is required.

1. Download or clone this repository.
2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the repository folder.
6. Refresh any already-open web pages so the content script can be injected.
7. Press `F11`, then move the pointer to the top edge of the screen.

For troubleshooting and update instructions, see [INSTALLATION.md](INSTALLATION.md).

## Usage

- Move the pointer to the top edge and pause briefly to open the interface.
- Move away from the interface to hide it.
- Press `Esc` to close the interface and any open bookmark menus.
- Scroll vertically over an overflowing tab or bookmark row to move it horizontally.
- Drag a tab left or right to reorder it; the strip scrolls when the pointer reaches its edge, and `Esc` cancels the drag.
- Enter a full URL, dotted hostname, local hostname with a port or path, IP address, or search query in the address field.
- Open bookmark folders with `Enter`, `Space`, or an arrow key; navigate menu items with the arrow keys, `Home`, and `End`.

Bookmark click behavior:

| Input | Result |
| --- | --- |
| Click | Open in the current tab |
| Ctrl/Cmd-click or middle-click | Open in a background tab |
| Ctrl/Cmd+Shift-click | Open in a foreground tab |
| Shift-click | Open in a new window |

## How it works

```text
manifest.json
├── service-worker.js   Fullscreen validation, tabs, bookmarks, navigation, and window actions
├── content.js          Shadow DOM interface, interaction logic, menus, and accessibility
├── content.css         Isolated interface styling
├── page.css            Page-level scrollbar adjustment while the overlay is active
└── icons/              Extension icons
```

The content script creates a closed Shadow DOM so the interface is isolated from page styles. The service worker validates that messages come from a browser tab, scopes tab actions to the sender's window, sanitizes data before returning it, and validates URLs before navigation.

## Limitations

- Designed for desktop Google Chrome, primarily on Windows.
- Does not run on `chrome://` pages, the Chrome Web Store, Chrome's built-in New Tab page, or other protected browser surfaces.
- Does not inject into `file://` pages.
- The overlay is a web-page interface, not Chrome's native browser chrome.
- Navigating to a protected page removes the overlay until you return to a supported `http://` or `https://` page.
- Enterprise policies may prevent unpacked extensions from loading.

## Validation

Local static checks:

```powershell
python -m json.tool manifest.json
node --check service-worker.js
node --check content.js
git diff --check
```

GitHub Actions runs the same manifest and JavaScript syntax checks for pushes and pull requests.

Manual verification should cover normal and F11 windows, top-edge activation, hover and focus persistence, tab actions, tab reordering by drag, dotted and local address navigation, search, live tab and bookmark refreshes, nested folders, overflow-menu keyboard navigation, window-state restoration, modifier clicks, `Esc`, and website-controlled fullscreen.

## Contributing

Bug reports and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before making a change. Please report security issues according to [SECURITY.md](SECURITY.md).

## License

This project is licensed under the [MIT License](LICENSE).
