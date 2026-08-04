"use strict";

const ALLOWED_PROTOCOLS = new Set([
  "http:",
  "https:",
  "file:",
  "ftp:",
  "chrome:",
  "about:",
]);
const LAST_WINDOW_STATE_PREFIX = "last-window-state:";
const MINIMIZED_FROM_STATE_PREFIX = "minimized-from-state:";
const RESTORABLE_WINDOW_STATES = new Set(["normal", "maximized", "fullscreen"]);

function windowStateKey(prefix, windowId) {
  return `${prefix}${windowId}`;
}

async function storeWindowState(prefix, windowId, state) {
  if (!RESTORABLE_WINDOW_STATES.has(state)) {
    return;
  }

  await chrome.storage.session.set({
    [windowStateKey(prefix, windowId)]: state,
  });
}

async function readWindowState(prefix, windowId) {
  const key = windowStateKey(prefix, windowId);
  const stored = await chrome.storage.session.get(key);
  const state = stored[key];
  return RESTORABLE_WINDOW_STATES.has(state) ? state : null;
}

async function clearWindowStates(windowId) {
  await chrome.storage.session.remove([
    windowStateKey(LAST_WINDOW_STATE_PREFIX, windowId),
    windowStateKey(MINIMIZED_FROM_STATE_PREFIX, windowId),
  ]);
}

function collectBookmarksBars(nodes, matches) {
  for (const node of nodes ?? []) {
    if (node.folderType === "bookmarks-bar") {
      matches.push(node);
    }

    collectBookmarksBars(node.children, matches);
  }
}

function findBookmarksBars(nodes) {
  const matches = [];
  collectBookmarksBars(nodes, matches);
  if (matches.length > 0) {
    return matches;
  }

  // Older Chrome versions did not expose folderType. In those versions, the
  // built-in ID of the bookmarks bar is 1.
  const legacyBookmarksBar = findNodeById(nodes, "1");
  return legacyBookmarksBar ? [legacyBookmarksBar] : [];
}

function findNodeById(nodes, id) {
  for (const node of nodes ?? []) {
    if (node.id === id) {
      return node;
    }

    const match = findNodeById(node.children, id);
    if (match) {
      return match;
    }
  }

  return null;
}

function sanitizeNode(node) {
  const cleanNode = {
    id: String(node.id),
    title: String(node.title ?? ""),
  };

  if (typeof node.url === "string") {
    cleanNode.url = node.url;
  }

  if (Array.isArray(node.children)) {
    cleanNode.children = node.children.map(sanitizeNode);
  }

  return cleanNode;
}

function sanitizeTab(tab) {
  return {
    id: tab.id,
    active: tab.active === true,
    title: String(tab.title ?? "New Tab"),
    url: String(tab.pendingUrl ?? tab.url ?? ""),
  };
}

function validateBookmarkUrl(rawUrl) {
  if (typeof rawUrl !== "string") {
    throw new Error("The bookmark URL is invalid.");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("The bookmark URL is invalid.");
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${parsed.protocol} links are blocked for security reasons.`);
  }

  return parsed.href;
}

async function getImmersiveData(sender) {
  const windowId = sender.tab?.windowId;
  if (!Number.isInteger(windowId)) {
    return { enabled: false, bookmarks: [], tabs: [] };
  }

  const browserWindow = await chrome.windows.get(windowId);
  if (browserWindow.state !== "fullscreen") {
    return { enabled: false, bookmarks: [], tabs: [] };
  }

  const [tree, tabs] = await Promise.all([
    chrome.bookmarks.getTree(),
    chrome.tabs.query({ windowId }),
  ]);
  const bookmarksBars = findBookmarksBars(tree);

  return {
    enabled: true,
    bookmarks: bookmarksBars.flatMap((bookmarksBar) => (
      bookmarksBar.children ?? []
    )).map(sanitizeNode),
    tabs: tabs.sort((first, second) => first.index - second.index).map(sanitizeTab),
  };
}

async function getFullscreenState(sender) {
  const windowId = sender.tab?.windowId;
  if (!Number.isInteger(windowId)) {
    return { enabled: false };
  }

  const browserWindow = await chrome.windows.get(windowId);
  const minimizedFromState = await readWindowState(
    MINIMIZED_FROM_STATE_PREFIX,
    windowId,
  );
  if (
    !minimizedFromState &&
    (browserWindow.state === "normal" || browserWindow.state === "maximized")
  ) {
    await storeWindowState(LAST_WINDOW_STATE_PREFIX, windowId, browserWindow.state);
  }
  return {
    enabled: browserWindow.state === "fullscreen" || minimizedFromState === "fullscreen",
  };
}

async function openBookmark(message, sender) {
  const url = validateBookmarkUrl(message.url);
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  let refreshTabs = false;

  switch (message.disposition) {
    case "new-background-tab":
      await chrome.tabs.create({ windowId, url, active: false });
      refreshTabs = true;
      break;
    case "new-foreground-tab":
      await chrome.tabs.create({ windowId, url, active: true });
      break;
    case "new-window":
      await chrome.windows.create({ url });
      break;
    case "current-tab":
      if (!Number.isInteger(tabId)) {
        throw new Error("The active tab could not be found.");
      }
      await chrome.tabs.update(tabId, { url });
      break;
    default:
      throw new Error("The requested link-opening method is invalid.");
  }

  if (!refreshTabs || !Number.isInteger(windowId)) {
    return { ok: true };
  }

  const tabs = await chrome.tabs.query({ windowId });
  return {
    ok: true,
    tabs: tabs.sort((first, second) => first.index - second.index).map(sanitizeTab),
  };
}

async function getSenderTab(sender) {
  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)) {
    throw new Error("The active tab could not be found.");
  }

  return chrome.tabs.get(tabId);
}

async function getTabInSenderWindow(tabId, sender) {
  if (!Number.isInteger(tabId) || !Number.isInteger(sender.tab?.windowId)) {
    throw new Error("The tab could not be found.");
  }

  const tab = await chrome.tabs.get(tabId);
  if (tab.windowId !== sender.tab.windowId) {
    throw new Error("The tab does not belong to this window.");
  }

  return tab;
}

function resolveAddressInput(rawInput) {
  const input = String(rawInput ?? "").trim();
  if (!input) {
    throw new Error("Enter an address or search query.");
  }

  try {
    return { url: validateBookmarkUrl(input) };
  } catch {
    const isLocalAddress = resemblesLocalAddress(input);
    const hasUnsupportedScheme = /^[a-z][a-z0-9+.-]*:/i.test(input) &&
      !isLocalAddress;
    const resemblesHost = !hasUnsupportedScheme &&
      !/\s/.test(input) &&
      !input.includes("@") &&
      (isLocalAddress || input.includes("."));
    if (resemblesHost) {
      try {
        const protocol = isLocalAddress ? "http" : "https";
        return { url: validateBookmarkUrl(protocol + "://" + input) };
      } catch {
        // If this is not a valid address, send it to the default search engine.
      }
    }
  }

  return { search: input };
}

function resemblesLocalAddress(input) {
  const authority = input.split(/[/?#]/, 1)[0];
  if (/^\[[0-9a-f:.]+\](?::\d+)?$/i.test(authority)) {
    return true;
  }

  const hostMatch = authority.match(/^([^:]+)(?::(\d+))?$/);
  if (!hostMatch) {
    return false;
  }

  const hostname = hostMatch[1].toLowerCase();
  const hasPort = hostMatch[2] !== undefined;
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    return true;
  }

  const ipv4Parts = hostname.split(".");
  if (
    ipv4Parts.length === 4 &&
    ipv4Parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  ) {
    return true;
  }

  const hasPath = input.length > authority.length && input[authority.length] === "/";
  return !hostname.includes(".") &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(hostname) &&
    (hasPort || hasPath);
}

async function navigate(message, sender) {
  const tab = await getSenderTab(sender);
  const target = resolveAddressInput(message.input);
  if (target.url) {
    await chrome.tabs.update(tab.id, { url: target.url });
  } else {
    await chrome.search.query({ text: target.search, tabId: tab.id });
  }
  return { ok: true };
}

async function activateTab(message, sender) {
  const tab = await getTabInSenderWindow(message.tabId, sender);
  await chrome.tabs.update(tab.id, { active: true });
  return { ok: true };
}

async function closeTab(message, sender) {
  const tab = await getTabInSenderWindow(message.tabId, sender);
  await chrome.tabs.remove(tab.id);
  return { ok: true };
}

async function createTab(sender) {
  const windowId = sender.tab?.windowId;
  if (!Number.isInteger(windowId)) {
    throw new Error("The browser window could not be found.");
  }
  await chrome.tabs.create({ windowId, active: true });
  return { ok: true };
}

async function runCurrentTabAction(action, sender) {
  const tab = await getSenderTab(sender);
  await action(tab.id);
  return { ok: true };
}

function getSenderWindowId(sender) {
  const windowId = sender.tab?.windowId;
  if (!Number.isInteger(windowId)) {
    throw new Error("The browser window could not be found.");
  }
  return windowId;
}

async function minimizeCurrentWindow(sender) {
  const windowId = getSenderWindowId(sender);
  const browserWindow = await chrome.windows.get(windowId);
  await storeWindowState(MINIMIZED_FROM_STATE_PREFIX, windowId, browserWindow.state);
  await chrome.windows.update(windowId, { state: "minimized" });
  return { ok: true };
}

async function restoreCurrentWindow(sender) {
  const windowId = getSenderWindowId(sender);
  const previousState = await readWindowState(LAST_WINDOW_STATE_PREFIX, windowId);
  if (!previousState) {
    throw new Error("The previous window state is unavailable.");
  }

  await chrome.windows.update(windowId, { state: previousState });
  return { ok: true };
}

async function closeCurrentWindow(sender) {
  const windowId = getSenderWindowId(sender);
  await clearWindowStates(windowId);
  await chrome.windows.remove(windowId);
  return { ok: true };
}

chrome.windows.onBoundsChanged.addListener((browserWindow) => {
  if (browserWindow.state !== "normal" && browserWindow.state !== "maximized") {
    return;
  }

  (async () => {
    const minimizedFromState = await readWindowState(
      MINIMIZED_FROM_STATE_PREFIX,
      browserWindow.id,
    );
    if (!minimizedFromState) {
      await storeWindowState(
        LAST_WINDOW_STATE_PREFIX,
        browserWindow.id,
        browserWindow.state,
      );
    }
  })().catch(() => {});
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }

  (async () => {
    const minimizedFromState = await readWindowState(
      MINIMIZED_FROM_STATE_PREFIX,
      windowId,
    );
    if (!minimizedFromState) {
      return;
    }

    const browserWindow = await chrome.windows.get(windowId);
    if (browserWindow.state !== minimizedFromState) {
      await chrome.windows.update(windowId, { state: minimizedFromState });
    }
    await chrome.storage.session.remove(
      windowStateKey(MINIMIZED_FROM_STATE_PREFIX, windowId),
    );
  })().catch(() => {});
});

chrome.windows.onRemoved.addListener((windowId) => {
  clearWindowStates(windowId).catch(() => {});
});

async function sendImmersiveRefresh(query) {
  const tabs = await chrome.tabs.query(query);
  await Promise.allSettled(
    tabs
      .filter((tab) => Number.isInteger(tab.id))
      .map((tab) => chrome.tabs.sendMessage(tab.id, {
        type: "REFRESH_IMMERSIVE_DATA",
      })),
  );
}

function notifyActiveTabInWindow(windowId) {
  if (!Number.isInteger(windowId)) {
    return;
  }

  sendImmersiveRefresh({ active: true, windowId }).catch(() => {});
}

function notifyActiveTabs() {
  sendImmersiveRefresh({ active: true }).catch(() => {});
}

chrome.tabs.onActivated.addListener(({ windowId }) => {
  notifyActiveTabInWindow(windowId);
});

chrome.tabs.onCreated.addListener((tab) => {
  notifyActiveTabInWindow(tab.windowId);
});

chrome.tabs.onMoved.addListener((_tabId, moveInfo) => {
  notifyActiveTabInWindow(moveInfo.windowId);
});

chrome.tabs.onRemoved.addListener((_tabId, removeInfo) => {
  notifyActiveTabInWindow(removeInfo.windowId);
});

chrome.tabs.onAttached.addListener((_tabId, attachInfo) => {
  notifyActiveTabInWindow(attachInfo.newWindowId);
});

chrome.tabs.onDetached.addListener((_tabId, detachInfo) => {
  notifyActiveTabInWindow(detachInfo.oldWindowId);
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (
    changeInfo.title === undefined &&
    changeInfo.url === undefined &&
    changeInfo.favIconUrl === undefined
  ) {
    return;
  }

  notifyActiveTabInWindow(tab.windowId);
});

for (const event of [
  chrome.bookmarks.onCreated,
  chrome.bookmarks.onRemoved,
  chrome.bookmarks.onChanged,
  chrome.bookmarks.onMoved,
  chrome.bookmarks.onChildrenReordered,
  chrome.bookmarks.onImportEnded,
]) {
  event.addListener(notifyActiveTabs);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let operation;

  switch (message?.type) {
    case "GET_FULLSCREEN_STATE":
      operation = getFullscreenState(sender);
      break;
    case "GET_IMMERSIVE_DATA":
      operation = getImmersiveData(sender);
      break;
    case "OPEN_BOOKMARK":
      operation = openBookmark(message, sender);
      break;
    case "NAVIGATE":
      operation = navigate(message, sender);
      break;
    case "ACTIVATE_TAB":
      operation = activateTab(message, sender);
      break;
    case "CLOSE_TAB":
      operation = closeTab(message, sender);
      break;
    case "CREATE_TAB":
      operation = createTab(sender);
      break;
    case "GO_BACK":
      operation = runCurrentTabAction((tabId) => chrome.tabs.goBack(tabId), sender);
      break;
    case "GO_FORWARD":
      operation = runCurrentTabAction((tabId) => chrome.tabs.goForward(tabId), sender);
      break;
    case "RELOAD_TAB":
      operation = runCurrentTabAction((tabId) => chrome.tabs.reload(tabId), sender);
      break;
    case "MINIMIZE_WINDOW":
      operation = minimizeCurrentWindow(sender);
      break;
    case "RESTORE_WINDOW":
      operation = restoreCurrentWindow(sender);
      break;
    case "CLOSE_WINDOW":
      operation = closeCurrentWindow(sender);
      break;
    default:
      return false;
  }

  operation
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        enabled: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    });

  return true;
});
