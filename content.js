"use strict";

(() => {
  const HOST_ID = "chrome-immersive-bookmarks-root";
  const SHOW_DELAY_MS = 150;
  const HIDE_DELAY_MS = 80;
  const MENU_HIDE_DELAY_MS = 180;
  const TAB_DRAG_THRESHOLD_PX = 5;
  const TAB_DRAG_EDGE_PX = 34;
  const TAB_DRAG_SCROLL_STEP_PX = 14;
  // The dragged tab is clamped to the strip, so its center can only just reach
  // the center of the outermost slot. This tolerance keeps those slots
  // reachable despite subpixel layout.
  const TAB_DRAG_SWAP_TOLERANCE_PX = 0.5;
  const OVERFLOW_NODE_ID = "__overflow-bookmarks__";
  const PAGE_ACTIVE_ATTRIBUTE = "data-chrome-immersive-fullscreen-active";

  if (document.getElementById(HOST_ID)) {
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.dataset.active = "false";
  host.dataset.open = "false";

  const shadow = host.attachShadow({ mode: "closed" });
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = chrome.runtime.getURL("content.css");

  const trigger = document.createElement("div");
  trigger.id = "trigger";
  trigger.setAttribute("aria-hidden", "true");

  const surface = document.createElement("div");
  surface.id = "surface";
  surface.setAttribute("role", "toolbar");
  surface.setAttribute("aria-label", "Fullscreen browser controls");

  const tabStrip = document.createElement("div");
  tabStrip.id = "tab-strip";

  const tabsScroller = document.createElement("div");
  tabsScroller.id = "tabs-scroller";

  const tabItems = document.createElement("div");
  tabItems.id = "tab-items";
  tabsScroller.append(tabItems);

  const newTabButton = document.createElement("button");
  newTabButton.type = "button";
  newTabButton.id = "new-tab-button";
  newTabButton.className = "chrome-button";
  newTabButton.title = "New tab";
  newTabButton.setAttribute("aria-label", "New tab");
  newTabButton.textContent = "+";

  const windowControls = document.createElement("div");
  windowControls.id = "window-controls";

  function createWindowButton(id, title, symbol) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = id;
    button.className = "window-button";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.textContent = symbol;
    return button;
  }

  const minimizeButton = createWindowButton(
    "minimize-button",
    "Minimize",
    "—",
  );
  const restoreButton = createWindowButton(
    "restore-button",
    "Restore previous window size",
    "▢",
  );
  const closeWindowButton = createWindowButton(
    "close-window-button",
    "Close window",
    "×",
  );
  windowControls.append(minimizeButton, restoreButton, closeWindowButton);
  tabStrip.append(tabsScroller, newTabButton, windowControls);

  const navigation = document.createElement("div");
  navigation.id = "navigation";

  function createNavigationButton(id, title, symbol) {
    const button = document.createElement("button");
    button.type = "button";
    button.id = id;
    button.className = "chrome-button navigation-button";
    button.title = title;
    button.setAttribute("aria-label", title);
    button.textContent = symbol;
    return button;
  }

  const backButton = createNavigationButton("back-button", "Back", "←");
  const forwardButton = createNavigationButton("forward-button", "Forward", "→");
  const reloadButton = createNavigationButton("reload-button", "Reload", "↻");

  const addressForm = document.createElement("form");
  addressForm.id = "address-form";
  const addressInput = document.createElement("input");
  addressInput.id = "address-input";
  addressInput.type = "text";
  addressInput.autocomplete = "off";
  addressInput.autocapitalize = "off";
  addressInput.spellcheck = false;
  addressInput.setAttribute("aria-label", "Address or search");
  addressInput.placeholder = "Search the web or enter a URL";
  addressForm.append(addressInput);
  navigation.append(backButton, forwardButton, reloadButton, addressForm);

  const toolbar = document.createElement("div");
  toolbar.id = "toolbar";
  toolbar.setAttribute("aria-label", "Bookmarks bar");

  const scroller = document.createElement("div");
  scroller.id = "scroller";

  const items = document.createElement("div");
  items.id = "items";
  scroller.append(items);

  const status = document.createElement("div");
  status.id = "status";
  status.hidden = true;

  const overflowButton = document.createElement("button");
  overflowButton.type = "button";
  overflowButton.id = "overflow-button";
  overflowButton.className = "bar-item";
  overflowButton.hidden = true;
  overflowButton.title = "More bookmarks";
  overflowButton.setAttribute("aria-label", "More bookmarks");
  overflowButton.setAttribute("aria-haspopup", "menu");
  overflowButton.setAttribute("aria-expanded", "false");
  overflowButton.textContent = "»";

  toolbar.append(scroller, overflowButton, status);
  surface.append(tabStrip, navigation, toolbar);

  const menuLayer = document.createElement("div");
  menuLayer.id = "menu-layer";

  const liveRegion = document.createElement("div");
  liveRegion.id = "live-region";
  liveRegion.setAttribute("role", "status");
  liveRegion.setAttribute("aria-live", "polite");

  shadow.append(stylesheet, trigger, surface, menuLayer, liveRegion);
  document.documentElement.append(host);

  let showTimer = 0;
  let hideTimer = 0;
  let menuHideTimer = 0;
  let fullscreenCheckTimer = 0;
  let dataRefreshTimer = 0;
  let dataRefreshPending = false;
  let requestNumber = 0;
  let pointerInUi = false;
  let lastPointerY = Number.POSITIVE_INFINITY;
  let lastTopEdgeStateCheck = 0;
  let menuPanels = [];
  let barEntries = [];
  let overflowBookmarks = [];
  let overflowUpdateFrame = 0;
  let tabDrag = null;
  let suppressTabClick = false;

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(response);
      });
    });
  }

  function clearTimer(timerId) {
    if (timerId) {
      window.clearTimeout(timerId);
    }
  }

  function setActive(active) {
    host.dataset.active = active ? "true" : "false";
    document.documentElement.toggleAttribute(PAGE_ACTIVE_ATTRIBUTE, active);
    if (!active) {
      closeBar();
    }
  }

  async function syncFullscreenState() {
    try {
      const result = await sendMessage({ type: "GET_FULLSCREEN_STATE" });
      const active = result?.enabled === true && document.fullscreenElement === null;
      setActive(active);
      if (active && lastPointerY <= 3) {
        pointerInUi = true;
        scheduleOpen();
      }
    } catch {
      setActive(false);
    }
  }

  function scheduleFullscreenCheck() {
    clearTimer(fullscreenCheckTimer);
    fullscreenCheckTimer = window.setTimeout(syncFullscreenState, 100);
  }

  function scheduleOpen() {
    clearTimer(hideTimer);
    clearTimer(showTimer);
    showTimer = window.setTimeout(openBar, SHOW_DELAY_MS);
  }

  function scheduleDataRefresh() {
    if (
      host.dataset.active !== "true" ||
      host.dataset.open !== "true"
    ) {
      dataRefreshPending = false;
      return;
    }

    dataRefreshPending = true;
    if (shadow.activeElement !== null || menuPanels.length > 0 || tabDrag !== null) {
      return;
    }

    clearTimer(dataRefreshTimer);
    dataRefreshTimer = window.setTimeout(() => {
      dataRefreshTimer = 0;
      if (
        shadow.activeElement !== null ||
        menuPanels.length > 0 ||
        tabDrag !== null
      ) {
        return;
      }

      dataRefreshPending = false;
      if (host.dataset.active !== "true" || host.dataset.open !== "true") {
        return;
      }

      if (!isUiEngaged()) {
        closeBar();
        return;
      }

      pointerInUi = true;
      openBar();
    }, 80);
  }

  function isUiEngaged() {
    return shadow.activeElement !== null ||
      surface.matches(":hover") ||
      trigger.matches(":hover") ||
      menuPanels.some(({ panel }) => panel.matches(":hover"));
  }

  function scheduleClose() {
    clearTimer(showTimer);
    clearTimer(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (isUiEngaged()) {
        pointerInUi = true;
        return;
      }

      pointerInUi = false;
      closeBar();
    }, HIDE_DELAY_MS);
  }

  async function openBar() {
    if (
      (!pointerInUi && shadow.activeElement === null) ||
      host.dataset.active !== "true"
    ) {
      return;
    }

    const currentRequest = ++requestNumber;
    try {
      const result = await sendMessage({ type: "GET_IMMERSIVE_DATA" });
      if (
        currentRequest !== requestNumber ||
        (!pointerInUi && shadow.activeElement === null)
      ) {
        return;
      }

      if (result?.ok === false) {
        showDataError(result.error ?? "Browser data could not be loaded.");
        return;
      }

      if (!result?.enabled) {
        setActive(false);
        return;
      }

      renderTabs(result.tabs ?? []);
      renderBookmarks(result.bookmarks ?? []);
      host.dataset.open = "true";
    } catch (error) {
      showDataError(
        error instanceof Error ? error.message : "Browser data could not be loaded.",
      );
    }
  }

  function closeBar() {
    cancelTabDrag();
    requestNumber += 1;
    clearTimer(showTimer);
    clearTimer(hideTimer);
    clearTimer(menuHideTimer);
    clearTimer(dataRefreshTimer);
    dataRefreshPending = false;
    closeMenusFrom(0);
    shadow.activeElement?.blur();
    host.dataset.open = "false";
  }

  function showStatus(message) {
    status.textContent = message;
    status.hidden = false;
    liveRegion.textContent = message;
  }

  function clearStatus() {
    status.textContent = "";
    status.hidden = true;
  }

  function clearRenderedData() {
    tabItems.replaceChildren();
    addressInput.value = "";
    items.replaceChildren();
    closeMenusFrom(0);
    barEntries = [];
    overflowBookmarks = [];
    overflowButton.hidden = true;
    overflowButton.setAttribute("aria-expanded", "false");
  }

  function showDataError(message) {
    clearRenderedData();
    showStatus(message);
    host.dataset.open = "true";
  }

  function displayTitle(node) {
    if (node.title?.trim()) {
      return node.title.trim();
    }

    if (node.url) {
      try {
        return new URL(node.url).hostname || node.url;
      } catch {
        return node.url;
      }
    }

    return "Untitled folder";
  }

  function faviconUrl(pageUrl) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", pageUrl);
    url.searchParams.set("size", "32");
    return url.href;
  }

  function createFavicon(node) {
    const image = document.createElement("img");
    image.className = "favicon";
    image.alt = "";
    image.draggable = false;
    image.referrerPolicy = "no-referrer";
    image.src = faviconUrl(node.url);
    image.addEventListener("error", () => {
      image.hidden = true;
    });
    return image;
  }

  function createAudioIcon(muted) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "tab-audio-icon");
    svg.setAttribute("aria-hidden", "true");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    if (muted) {
      path.setAttribute(
        "d",
        "M4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4zM16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71z",
      );
    } else {
      path.setAttribute(
        "d",
        "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
      );
    }

    svg.append(path);
    return svg;
  }

  function renderTabs(tabs) {
    if (tabDrag !== null) {
      // Rebuilding the strip mid-drag would drop the dragged tab. Let the
      // pending refresh run once the drag ends.
      dataRefreshPending = true;
      return;
    }

    tabItems.replaceChildren();
    const fragment = document.createDocumentFragment();
    const activeTab = tabs.find((tab) => tab.active);
    addressInput.value = activeTab?.url ?? "";

    for (const tab of tabs) {
      const item = document.createElement("div");
      item.className = "tab-item";
      item.dataset.active = tab.active ? "true" : "false";
      item.title = tab.title || tab.url || "Tab";
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-label", tab.title || "Tab");

      const icon = document.createElement("img");
      icon.className = "tab-favicon";
      icon.alt = "";
      icon.draggable = false;
      if (tab.url) {
        icon.src = faviconUrl(tab.url);
      } else {
        icon.hidden = true;
      }
      icon.addEventListener("error", () => {
        icon.hidden = true;
      });

      const label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = tab.title || "New Tab";

      const close = document.createElement("button");
      close.type = "button";
      close.className = "tab-close";
      close.title = "Close tab";
      close.setAttribute("aria-label", `Close ${label.textContent}`);
      close.textContent = "×";
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        performAction({ type: "CLOSE_TAB", tabId: tab.id }, true);
      });

      const activate = () => {
        if (!tab.active) {
          performAction({ type: "ACTIVATE_TAB", tabId: tab.id });
        }
      };
      item.addEventListener("click", activate);
      item.addEventListener("auxclick", (event) => {
        if (event.button === 1) {
          event.preventDefault();
          performAction({ type: "CLOSE_TAB", tabId: tab.id }, true);
        }
      });
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
      item.addEventListener("pointerdown", (event) => beginTabDrag(event, item, tab.id));
      item.addEventListener("pointermove", updateTabDrag);
      item.addEventListener("pointerup", finishTabDrag);
      item.addEventListener("pointercancel", cancelTabDrag);
      item.addEventListener("lostpointercapture", cancelTabDrag);

      const tabElements = [icon, label];
      if (tab.audible || tab.muted) {
        const audio = document.createElement("button");
        audio.type = "button";
        audio.className = "tab-audio";
        audio.dataset.muted = tab.muted ? "true" : "false";
        const actionTitle = tab.muted ? "Unmute tab" : "Mute tab";
        audio.title = actionTitle;
        audio.setAttribute("aria-label", `${actionTitle} (${label.textContent})`);
        audio.append(createAudioIcon(tab.muted));
        audio.addEventListener("click", (event) => {
          event.stopPropagation();
          performAction({ type: "TOGGLE_TAB_MUTE", tabId: tab.id }, true);
        });
        tabElements.push(audio);
      }

      tabElements.push(close);
      item.append(...tabElements);
      fragment.append(item);
    }

    tabItems.append(fragment);
    window.requestAnimationFrame(() => {
      tabItems.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function tabItemIndex(item) {
    return Array.prototype.indexOf.call(tabItems.children, item);
  }

  function moveTabItem(item, index) {
    const others = Array.prototype.filter.call(
      tabItems.children,
      (element) => element !== item,
    );
    tabItems.insertBefore(item, others[index] ?? null);
  }

  function slotCenter(slot) {
    return slot.left + slot.width / 2;
  }

  function beginTabDrag(event, item, tabId) {
    suppressTabClick = false;
    if (
      event.button !== 0 ||
      tabDrag !== null ||
      !Number.isInteger(tabId) ||
      (event.target instanceof Element && event.target.closest(".tab-close, .tab-audio") !== null)
    ) {
      return;
    }

    tabDrag = {
      pointerId: event.pointerId,
      item,
      tabId,
      startX: event.clientX,
      startScroll: tabsScroller.scrollLeft,
      pointerX: event.clientX,
      startIndex: -1,
      targetIndex: -1,
      offsetX: 0,
      slots: [],
      rowLeft: 0,
      rowRight: 0,
      active: false,
      scrollFrame: 0,
    };
    // Capture the pointer so the drag survives the cursor leaving the strip.
    item.setPointerCapture(event.pointerId);
  }

  function activateTabDrag() {
    const drag = tabDrag;
    const startIndex = tabItemIndex(drag.item);
    if (startIndex < 0) {
      cancelTabDrag();
      return false;
    }

    // Measure every tab once, in scroller content coordinates, so the layout
    // stays valid while the strip scrolls. The strip is never reordered during
    // the drag: moving the captured tab in the DOM would release its pointer
    // capture and drop the drag.
    const scrollLeft = tabsScroller.scrollLeft;
    const slots = Array.prototype.map.call(tabItems.children, (element) => {
      const rect = element.getBoundingClientRect();
      return { element, left: rect.left + scrollLeft, width: rect.width };
    });
    const own = slots[startIndex];

    drag.startIndex = startIndex;
    drag.targetIndex = startIndex;
    drag.slots = slots;
    drag.offsetX = drag.startX + drag.startScroll - own.left;
    drag.rowLeft = slots[0].left;
    drag.rowRight = slots.at(-1).left + slots.at(-1).width;
    drag.active = true;
    drag.item.classList.add("dragging");
    tabItems.dataset.dragging = "true";
    drag.scrollFrame = window.requestAnimationFrame(stepTabDragScroll);
    return true;
  }

  function updateTabDrag(event) {
    if (tabDrag === null || event.pointerId !== tabDrag.pointerId) {
      return;
    }

    tabDrag.pointerX = event.clientX;
    if (!tabDrag.active) {
      if (Math.abs(event.clientX - tabDrag.startX) < TAB_DRAG_THRESHOLD_PX) {
        return;
      }

      if (!activateTabDrag()) {
        return;
      }
    }

    layoutTabDrag();
  }

  function targetIndexFor(drag, center) {
    const own = slotCenter(drag.slots[drag.startIndex]);
    let index = 0;
    for (let position = 0; position < drag.slots.length; position += 1) {
      if (position === drag.startIndex) {
        continue;
      }

      // Count the tabs the dragged one has passed. The comparison leans towards
      // the direction of travel so the outermost slots stay reachable even
      // though the dragged tab is clamped to the strip.
      const other = slotCenter(drag.slots[position]);
      const passed = center >= own
        ? other <= center + TAB_DRAG_SWAP_TOLERANCE_PX
        : other < center - TAB_DRAG_SWAP_TOLERANCE_PX;
      if (passed) {
        index += 1;
      }
    }

    return index;
  }

  function layoutTabDrag() {
    const drag = tabDrag;
    const own = drag.slots[drag.startIndex];
    const contentX = drag.pointerX + tabsScroller.scrollLeft;
    const left = Math.max(
      drag.rowLeft,
      Math.min(contentX - drag.offsetX, drag.rowRight - own.width),
    );
    drag.targetIndex = targetIndexFor(drag, left + own.width / 2);

    for (let position = 0; position < drag.slots.length; position += 1) {
      const slot = drag.slots[position];
      if (position === drag.startIndex) {
        slot.element.style.transform = `translateX(${Math.round(left - slot.left)}px)`;
        continue;
      }

      let shift = 0;
      if (position > drag.startIndex && position <= drag.targetIndex) {
        shift = -own.width;
      } else if (position < drag.startIndex && position >= drag.targetIndex) {
        shift = own.width;
      }

      slot.element.style.transform = shift === 0 ? "" : `translateX(${shift}px)`;
    }
  }

  function stepTabDragScroll() {
    if (tabDrag === null || !tabDrag.active) {
      return;
    }

    tabDrag.scrollFrame = window.requestAnimationFrame(stepTabDragScroll);
    const rect = tabsScroller.getBoundingClientRect();
    let delta = 0;
    if (tabDrag.pointerX < rect.left + TAB_DRAG_EDGE_PX) {
      delta = -TAB_DRAG_SCROLL_STEP_PX;
    } else if (tabDrag.pointerX > rect.right - TAB_DRAG_EDGE_PX) {
      delta = TAB_DRAG_SCROLL_STEP_PX;
    }

    if (delta === 0) {
      return;
    }

    const previousScroll = tabsScroller.scrollLeft;
    tabsScroller.scrollLeft += delta;
    if (tabsScroller.scrollLeft !== previousScroll) {
      layoutTabDrag();
    }
  }

  function releaseTabDrag() {
    const drag = tabDrag;
    tabDrag = null;
    if (drag.scrollFrame) {
      window.cancelAnimationFrame(drag.scrollFrame);
    }

    for (const slot of drag.slots) {
      slot.element.style.transform = "";
    }

    drag.item.style.transform = "";
    drag.item.classList.remove("dragging");
    delete tabItems.dataset.dragging;
    if (drag.item.hasPointerCapture(drag.pointerId)) {
      drag.item.releasePointerCapture(drag.pointerId);
    }

    if (dataRefreshPending) {
      scheduleDataRefresh();
    }

    return drag;
  }

  function finishTabDrag(event) {
    if (tabDrag === null || event.pointerId !== tabDrag.pointerId) {
      return;
    }

    const wasActive = tabDrag.active;
    const drag = releaseTabDrag();
    if (!wasActive) {
      return;
    }

    // The pointer moved, so the click that follows must not activate the tab.
    suppressTabClick = true;
    if (drag.targetIndex === drag.startIndex) {
      return;
    }

    // Reorder the strip now that the pointer capture is gone, then refresh
    // because Chrome may clamp the index, for example when pinned tabs occupy
    // the leading positions.
    moveTabItem(drag.item, drag.targetIndex);
    performAction(
      { type: "MOVE_TAB", tabId: drag.tabId, toIndex: drag.targetIndex },
      true,
    );
  }

  function cancelTabDrag(event) {
    if (tabDrag === null || (event && event.pointerId !== tabDrag.pointerId)) {
      return;
    }

    // The strip order is never touched while dragging, so dropping the
    // transforms restores the original layout.
    if (tabDrag.active) {
      suppressTabClick = true;
    }

    releaseTabDrag();
  }

  async function performAction(message, refreshAfter = false) {
    try {
      const result = await sendMessage(message);
      if (result?.ok === false) {
        showStatus(result.error ?? "The action could not be completed.");
        return;
      }
      if (refreshAfter && pointerInUi) {
        await openBar();
      }
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "The action could not be completed.");
    }
  }

  function createFolderIcon() {
    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function createLabel(node) {
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = displayTitle(node);
    return label;
  }

  function createBookmarkButton(node, menuItem = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = menuItem ? "menu-item bookmark" : "bar-item bookmark";
    button.title = `${displayTitle(node)}\n${node.url}`;
    if (menuItem) {
      button.setAttribute("role", "menuitem");
    }
    button.append(createFavicon(node), createLabel(node));

    button.addEventListener("click", (event) => openBookmark(node.url, event));
    button.addEventListener("pointerdown", (event) => {
      if (event.button === 1) {
        // Process the middle button immediately because the menu may close
        // before auxclick fires.
        openBookmark(node.url, event);
      }
    });
    button.addEventListener("auxclick", (event) => {
      if (event.button === 1) {
        // Prevent the browser from handling the pointerdown-opened link a
        // second time and suppress automatic scrolling.
        event.preventDefault();
        event.stopPropagation();
      }
    });

    return button;
  }

  function createTopFolderButton(node) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bar-item folder";
    button.title = displayTitle(node);
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.append(createFolderIcon(), createLabel(node));

    const reveal = (focusPosition = null) => {
      openFolderMenu(node, button, 0, focusPosition);
    };
    button.addEventListener("pointerenter", () => reveal());
    button.addEventListener("click", (event) => {
      reveal(event.detail === 0 ? "first" : null);
    });
    button.addEventListener("keydown", (event) => {
      if (
        event.key === "ArrowDown" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        reveal("first");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        reveal("last");
      }
    });

    return button;
  }

  function renderBookmarks(bookmarks) {
    clearStatus();
    items.replaceChildren();
    closeMenusFrom(0);
    barEntries = [];
    overflowBookmarks = [];
    overflowButton.hidden = true;
    overflowButton.setAttribute("aria-expanded", "false");

    if (bookmarks.length === 0) {
      const empty = document.createElement("span");
      empty.className = "empty";
      empty.textContent = "The bookmarks bar is empty";
      items.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const node of bookmarks) {
      let element;
      if (node.url) {
        element = createBookmarkButton(node);
        element.addEventListener("pointerenter", () => closeMenusFrom(0));
      } else {
        element = createTopFolderButton(node);
      }
      barEntries.push({ node, element });
      fragment.append(element);
    }
    items.append(fragment);
    scheduleOverflowUpdate();
  }

  function scheduleOverflowUpdate() {
    if (overflowUpdateFrame) {
      window.cancelAnimationFrame(overflowUpdateFrame);
    }
    overflowUpdateFrame = window.requestAnimationFrame(updateOverflow);
  }

  function updateOverflow() {
    overflowUpdateFrame = 0;
    closeMenusFrom(0);
    overflowButton.hidden = true;
    overflowButton.setAttribute("aria-expanded", "false");
    overflowBookmarks = [];
    scroller.scrollLeft = 0;

    if (barEntries.length === 0 || items.scrollWidth <= scroller.clientWidth) {
      return;
    }

    overflowButton.hidden = false;
    const scrollerRight = scroller.getBoundingClientRect().right;
    overflowBookmarks = barEntries
      .filter(({ element }) => element.getBoundingClientRect().right > scrollerRight + 0.5)
      .map(({ node }) => node);

    if (overflowBookmarks.length === 0) {
      overflowButton.hidden = true;
      return;
    }

    overflowButton.setAttribute(
      "aria-label",
      `More bookmarks (${overflowBookmarks.length})`,
    );
  }

  function toggleOverflowMenu(focusPosition = null) {
    const currentMenu = menuPanels[0];
    if (currentMenu?.nodeId === OVERFLOW_NODE_ID && currentMenu.anchor === overflowButton) {
      if (focusPosition) {
        focusMenuItem(currentMenu.panel, focusPosition);
      } else {
        closeMenusFrom(0);
      }
      return;
    }

    openFolderMenu(
      {
        id: OVERFLOW_NODE_ID,
        title: "More bookmarks",
        children: overflowBookmarks,
      },
      overflowButton,
      0,
      focusPosition,
    );
  }

  function scheduleMenuClose(depth = 0) {
    clearTimer(menuHideTimer);
    menuHideTimer = window.setTimeout(() => closeMenusFrom(depth), MENU_HIDE_DELAY_MS);
  }

  function cancelMenuClose() {
    clearTimer(menuHideTimer);
  }

  function closeMenusFrom(depth) {
    for (let index = menuPanels.length - 1; index >= depth; index -= 1) {
      const entry = menuPanels[index];
      entry.anchor?.setAttribute("aria-expanded", "false");
      entry.panel.remove();
      menuPanels.pop();
    }

    if (
      menuPanels.length === 0 &&
      dataRefreshPending &&
      shadow.activeElement === null
    ) {
      scheduleDataRefresh();
    }
  }

  function positionMenu(panel, anchor, depth) {
    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gap = 4;
    const margin = 4;

    let left = depth === 0 ? anchorRect.left : anchorRect.right + gap;
    let top = depth === 0 ? anchorRect.bottom + gap : anchorRect.top;

    if (left + panelRect.width > window.innerWidth - margin) {
      left = depth === 0
        ? anchorRect.right - panelRect.width
        : anchorRect.left - panelRect.width - gap;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - panelRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - panelRect.height - margin));

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  function getMenuItems(panel) {
    return Array.from(panel.children).filter((element) => (
      element.classList.contains("menu-item")
    ));
  }

  function focusMenuItem(panel, position) {
    const menuItems = getMenuItems(panel);
    const item = position === "last"
      ? menuItems.at(-1)
      : menuItems[0];
    if (item) {
      item.focus();
      return;
    }

    panel.tabIndex = -1;
    panel.focus();
  }

  function handleMenuKeydown(event, panel, anchor, depth) {
    if (event.key === "Escape" || event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      closeMenusFrom(depth);
      anchor.focus();
      return;
    }

    const menuItems = getMenuItems(panel);
    const currentIndex = menuItems.indexOf(event.target);
    if (currentIndex < 0) {
      return;
    }

    let nextIndex = null;
    switch (event.key) {
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % menuItems.length;
        break;
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = menuItems.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    menuItems[nextIndex].focus();
  }

  function openFolderMenu(node, anchor, depth, focusPosition = null) {
    cancelMenuClose();

    const existing = menuPanels[depth];
    if (existing?.nodeId === node.id && existing.anchor === anchor) {
      if (focusPosition) {
        focusMenuItem(existing.panel, focusPosition);
      }
      return;
    }

    closeMenusFrom(depth);
    anchor.setAttribute("aria-expanded", "true");

    const panel = document.createElement("div");
    panel.className = "menu";
    panel.setAttribute("role", "menu");
    panel.setAttribute("aria-label", displayTitle(node));

    const children = node.children ?? [];
    if (children.length === 0) {
      const empty = document.createElement("span");
      empty.className = "menu-empty";
      empty.textContent = "This folder is empty";
      panel.append(empty);
    } else {
      for (const child of children) {
        if (child.url) {
          const bookmark = createBookmarkButton(child, true);
          bookmark.addEventListener("pointerenter", () => closeMenusFrom(depth + 1));
          panel.append(bookmark);
          continue;
        }

        const folder = document.createElement("button");
        folder.type = "button";
        folder.className = "menu-item folder";
        folder.setAttribute("role", "menuitem");
        folder.setAttribute("aria-haspopup", "menu");
        folder.setAttribute("aria-expanded", "false");
        folder.append(createFolderIcon(), createLabel(child));

        const arrow = document.createElement("span");
        arrow.className = "submenu-arrow";
        arrow.textContent = "›";
        arrow.setAttribute("aria-hidden", "true");
        folder.append(arrow);

        const reveal = (focusPosition = null) => {
          openFolderMenu(child, folder, depth + 1, focusPosition);
        };
        folder.addEventListener("pointerenter", () => reveal());
        folder.addEventListener("click", (event) => {
          reveal(event.detail === 0 ? "first" : null);
        });
        folder.addEventListener("keydown", (event) => {
          if (
            event.key === "ArrowRight" ||
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            event.stopPropagation();
            reveal("first");
          }
        });
        panel.append(folder);
      }
    }

    panel.addEventListener("keydown", (event) => {
      handleMenuKeydown(event, panel, anchor, depth);
    });
    panel.addEventListener("pointerenter", () => {
      pointerInUi = true;
      clearTimer(hideTimer);
      cancelMenuClose();
    });
    panel.addEventListener("pointerleave", () => {
      pointerInUi = false;
      scheduleMenuClose(depth);
      scheduleClose();
    });

    menuLayer.append(panel);
    menuPanels[depth] = { panel, anchor, nodeId: node.id };
    positionMenu(panel, anchor, depth);
    if (focusPosition) {
      focusMenuItem(panel, focusPosition);
    }
  }

  async function openBookmark(url, event) {
    event.preventDefault();
    event.stopPropagation();

    let disposition = "current-tab";
    if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
      disposition = "new-foreground-tab";
    } else if (event.shiftKey) {
      disposition = "new-window";
    } else if (event.ctrlKey || event.metaKey || event.button === 1) {
      disposition = "new-background-tab";
    }

    try {
      const result = await sendMessage({ type: "OPEN_BOOKMARK", url, disposition });
      if (result?.ok === false) {
        showStatus(result.error ?? "The bookmark could not be opened.");
        return;
      }
      if (disposition === "new-background-tab" && Array.isArray(result?.tabs)) {
        renderTabs(result.tabs);
      }
      if (!isUiEngaged()) {
        closeBar();
      }
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "The bookmark could not be opened.");
    }
  }

  trigger.addEventListener("pointerenter", () => {
    pointerInUi = true;
    scheduleOpen();
  });
  trigger.addEventListener("pointerleave", () => {
    pointerInUi = false;
    scheduleClose();
  });

  surface.addEventListener("pointerenter", () => {
    pointerInUi = true;
    clearTimer(hideTimer);
  });
  surface.addEventListener("pointerleave", () => {
    pointerInUi = false;
    scheduleMenuClose(0);
    scheduleClose();
  });

  newTabButton.addEventListener("click", () => performAction({ type: "CREATE_TAB" }));
  minimizeButton.addEventListener("click", () => performAction({ type: "MINIMIZE_WINDOW" }));
  restoreButton.addEventListener("click", () => performAction({ type: "RESTORE_WINDOW" }));
  closeWindowButton.addEventListener("click", () => performAction({ type: "CLOSE_WINDOW" }));
  backButton.addEventListener("click", () => performAction({ type: "GO_BACK" }));
  forwardButton.addEventListener("click", () => performAction({ type: "GO_FORWARD" }));
  reloadButton.addEventListener("click", () => performAction({ type: "RELOAD_TAB" }));
  addressForm.addEventListener("submit", (event) => {
    event.preventDefault();
    performAction({ type: "NAVIGATE", input: addressInput.value });
  });
  addressInput.addEventListener("focus", () => addressInput.select());

  tabItems.addEventListener(
    "click",
    (event) => {
      if (!suppressTabClick) {
        return;
      }

      suppressTabClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true },
  );

  tabsScroller.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && tabsScroller.scrollWidth > tabsScroller.clientWidth) {
        event.preventDefault();
        tabsScroller.scrollLeft += event.deltaY;
      }
    },
    { passive: false },
  );

  scroller.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && scroller.scrollWidth > scroller.clientWidth) {
        event.preventDefault();
        scroller.scrollLeft += event.deltaY;
      }
    },
    { passive: false },
  );

  overflowButton.addEventListener("click", (event) => {
    toggleOverflowMenu(event.detail === 0 ? "first" : null);
  });
  overflowButton.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      toggleOverflowMenu("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      toggleOverflowMenu("last");
    }
  });

  shadow.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    if (tabDrag !== null) {
      cancelTabDrag();
      return;
    }

    closeBar();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "REFRESH_IMMERSIVE_DATA") {
      scheduleDataRefresh();
    }
  });

  shadow.addEventListener("focusin", () => {
    pointerInUi = true;
    clearTimer(hideTimer);
  });
  shadow.addEventListener("focusout", () => {
    window.requestAnimationFrame(() => {
      if (dataRefreshPending) {
        scheduleDataRefresh();
      }
      if (host.dataset.open === "true" && !isUiEngaged()) {
        pointerInUi = false;
        scheduleClose();
      }
    });
  });

  window.addEventListener("resize", scheduleFullscreenCheck, { passive: true });
  window.addEventListener("resize", scheduleOverflowUpdate, { passive: true });
  window.addEventListener("focus", scheduleFullscreenCheck, { passive: true });
  function handleVisibilityChange() {
    if (document.hidden) {
      pointerInUi = false;
      lastPointerY = Number.POSITIVE_INFINITY;
      closeBar();
      return;
    }

    scheduleFullscreenCheck();
  }
  document.addEventListener("visibilitychange", handleVisibilityChange, { passive: true });
  document.addEventListener("fullscreenchange", scheduleFullscreenCheck, { passive: true });
  document.addEventListener(
    "pointermove",
    (event) => {
      lastPointerY = event.clientY;
      if (event.clientY > 3 || host.dataset.active === "true") {
        return;
      }

      const now = performance.now();
      if (now - lastTopEdgeStateCheck >= 300) {
        lastTopEdgeStateCheck = now;
        syncFullscreenState();
      }
    },
    { capture: true, passive: true },
  );

  syncFullscreenState();
})();
