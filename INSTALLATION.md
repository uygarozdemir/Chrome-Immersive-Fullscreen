# Installation and Usage

Chrome Immersive Fullscreen is a dependency-free Manifest V3 extension. It is loaded directly from this repository; no build command or package installation is required.

## Install from source

1. Download this repository as a ZIP file and extract it, or clone it with Git:

   ```powershell
   git clone https://github.com/uygarozdemir/Chrome-Immersive-Fullscreen.git
   ```

2. Open Google Chrome and navigate to:

   ```text
   chrome://extensions
   ```

3. Enable **Developer mode** in the upper-right corner.
4. Select **Load unpacked**.
5. Choose the `Chrome-Immersive-Fullscreen` repository folder.
6. Confirm that **Chrome Immersive Fullscreen** appears in the extensions list.

## First use

1. Open an ordinary `http://` or `https://` website.
2. Refresh the page if it was open before the extension was installed.
3. Press `F11` to put Chrome into browser fullscreen.
4. Move the pointer to the physical top edge of the screen and pause briefly.
5. Use the revealed tabs, navigation bar, bookmarks, or window controls.
6. Move away from the interface or press `Esc` to close it.

## Bookmark controls

- Click: open in the current tab.
- Ctrl/Cmd-click or middle-click: open in a background tab.
- Ctrl/Cmd+Shift-click: open in a foreground tab.
- Shift-click: open in a new window.
- Hover over a folder to reveal nested bookmarks.
- With keyboard focus on a folder, press `Enter`, `Space`, `ArrowDown`, or `ArrowUp` to open it; use arrow keys, `Home`, and `End` inside menus.
- Use the `»` button when bookmarks do not fit on the bar.

## Address field

- Enter full URLs and dotted hostnames directly.
- Local hostnames with a port or path, IPv4 addresses, and bracketed IPv6 addresses open over HTTP when no scheme is provided.
- Other input is sent to Chrome's configured default search engine.

## Reload after source changes

1. Open `chrome://extensions`.
2. Select the reload button on the extension card.
3. Refresh every page where you want the content script to run.

## Troubleshooting

If the interface does not appear:

1. Confirm that the extension is enabled on `chrome://extensions`.
2. Reload the extension.
3. Refresh the web page.
4. Confirm that Chrome itself is in F11 fullscreen.
5. Move the pointer to the very top edge, not merely near it.
6. Test on a normal `http://` or `https://` page.

The extension cannot run on:

- `chrome://` pages;
- the Chrome Web Store;
- Chrome's built-in New Tab page;
- some internal PDF or file viewers;
- pages where Chrome blocks content-script injection.

The overlay is intentionally hidden while a website's own HTML or video fullscreen mode is active.

## Uninstall

Open `chrome://extensions`, find **Chrome Immersive Fullscreen**, and select **Remove**. Session-only window-state data is cleared when the Chrome session ends.
