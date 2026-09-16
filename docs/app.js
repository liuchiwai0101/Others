const BATCH_SIZE = 16;
const LOCATION = "Central";
const BUY_BASE = "https://www.apple.com/hk/shop/buy-iphone/iphone-18-pro";
const APPLE_BASE = "https://www.apple.com/hk/shop";
const REPO_RAW =
  "https://raw.githubusercontent.com/liuchiwai0101/Others/cursor/iphone-18-stock-bot-1629/docs";
const SCREEN_SIZE = {
  duo: "7.6-inch-display",
  "18-pro": "6.3-inch-display",
  "18-pro-max": "6.9-inch-display",
};

const LANG_KEY = "iphone-stock-lang";
const I18N = {
  zh: {
    title: "iPhone 香港庫存",
    subtitle: "Duo、18 Pro 及 18 Pro Max · Apple Store 香港 · 取貨及送貨",
    filters: "篩選",
    models: "型號",
    storage: "容量",
    colour: "顏色",
    refresh: "更新",
    check: "查詢",
    watch: "監察",
    stop: "停止",
    notify: "通知",
    notifyOn: "已開",
    notifyOff: "已關",
    modelsInStock: "有貨型號",
    pickupSlots: "取貨名額",
    variantsChecked: "已查款式",
    lastChecked: "上次查詢",
    availability: "供應情況",
    loadingAvailability: "正在載入 iPhone Duo、18 Pro 及 18 Pro Max 供應情況…",
    noMatch: "沒有款式符合目前篩選。",
    variant: "款式",
    pickup: "取貨",
    canPickUp: "可取時間",
    stores: "零售店",
    delivery: "送貨",
    shipDate: "送貨日期",
    inStock: "有貨",
    noPickup: "暫無取貨",
    yes: "有",
    no: "沒有",
    na: "不適用",
    unknown: "未知",
    order: "訂購",
    orderTitle: "前往 Apple 香港訂購此型號",
    meta: "{variants} 款 · {pickup} 取貨 · {delivery} 送貨",
    storesMeta: "{count} 間零售店 · {source}",
    live: "即時",
    snapshot: "快照",
    ready: "就緒",
    readyTap: "就緒 — 請按查詢",
    loading: "載入中…",
    loadingSnapshot: "正在載入快照…",
    checking: "正在查詢 Apple 香港…",
    watching: "監察中",
    watchingLive: "監察中（即時）",
    refreshingSnapshot: "正在更新快照…",
    checkFailed: "查詢失敗",
    rateLimited: "即時查詢受到限制，已保留上次已知庫存。",
    liveBlocked: "即時查詢未能完成（{error}）。改為顯示最新 GitHub 快照。",
    liveBlockedPreview: "此預覽頁無法即時更新。下拉重新載入以取得較新快照。（{error}）",
    snapshotFailed: "快照更新失敗（{error}）。",
    snapshotMissing: "未能載入庫存快照",
    notifyUnsupported: "此瀏覽器不支援通知。",
    notifyTitle: "{model} 香港有貨",
    notifyBody: "{label}，{store}{when}",
    notifyWhen: " — 可取 {when}",
    sourceLive: "live",
    sourceSnapshot: "snapshot",
  },
  en: {
    title: "iPhone HK Stock",
    subtitle: "Duo, 18 Pro & 18 Pro Max · Apple Store Hong Kong · pickup & delivery",
    filters: "Filters",
    models: "Models",
    storage: "Storage",
    colour: "Colour",
    refresh: "Refresh",
    check: "Check",
    watch: "Watch",
    stop: "Stop",
    notify: "Notify",
    notifyOn: "On",
    notifyOff: "Off",
    modelsInStock: "Models in stock",
    pickupSlots: "Pickup slots",
    variantsChecked: "Variants checked",
    lastChecked: "Last checked",
    availability: "Availability",
    loadingAvailability: "Loading iPhone Duo, 18 Pro and 18 Pro Max availability…",
    noMatch: "No variants match the current filters.",
    variant: "Variant",
    pickup: "Pickup",
    canPickUp: "Can pick up",
    stores: "Stores",
    delivery: "Delivery",
    shipDate: "Ship date",
    inStock: "In stock",
    noPickup: "No pickup",
    yes: "Yes",
    no: "No",
    na: "N/A",
    unknown: "unknown",
    order: "Order",
    orderTitle: "Order this model on Apple HK",
    meta: "{variants} variants · {pickup} pickup · {delivery} delivery",
    storesMeta: "{count} stores · {source}",
    live: "live",
    snapshot: "snapshot",
    ready: "Ready",
    readyTap: "Ready — tap Check",
    loading: "Loading…",
    loadingSnapshot: "Loading snapshot…",
    checking: "Checking Apple HK…",
    watching: "Watching",
    watchingLive: "Watching (live)",
    refreshingSnapshot: "Refreshing snapshot…",
    checkFailed: "Check failed",
    rateLimited: "Live Apple check was rate-limited. Kept last known stock for failed requests.",
    liveBlocked: "Live Apple check blocked here ({error}). Showing latest GitHub snapshot.",
    liveBlockedPreview: "Live refresh is blocked on this preview page. Pull to reload for a newer snapshot. ({error})",
    snapshotFailed: "Snapshot refresh failed ({error}).",
    snapshotMissing: "Could not load stock snapshot",
    notifyUnsupported: "Notifications are not supported in this browser.",
    notifyTitle: "{model} in stock (HK)",
    notifyBody: "{label} at {store}{when}",
    notifyWhen: " — pick up {when}",
    sourceLive: "live",
    sourceSnapshot: "snapshot",
  },
};
const COLOR_ZH = {
  Black: "黑色",
  Silver: "銀色",
  Burgundy: "勃艮第色",
  Glacier: "冰川色",
  "Star White": "星光白色",
  "Night Sky": "夜空色",
};
const STORE_ZH = {
  "ifc mall": "ifc 中環",
  "Canton Road": "廣東道",
  "Causeway Bay": "銅鑼灣",
  "Festival Walk": "又一城",
  "apm Hong Kong": "apm 觀塘",
  "New Town Plaza": "新城市廣場",
};

const state = {
  lang: "zh",
  statusKey: "loading",
  sourceLabel: "snapshot",
  catalog: null,
  snapshot: null,
  watching: false,
  watchTimer: null,
  previousPickupAvailable: new Set(),
  seedNotificationBaseline: true,
  selectedModels: new Set(),
  selectedStorage: new Set(),
  selectedColors: new Set(),
};

const els = {
  modelChips: document.getElementById("modelChips"),
  storageChips: document.getElementById("storageChips"),
  colorChips: document.getElementById("colorChips"),
  intervalRange: document.getElementById("intervalRange"),
  intervalLabel: document.getElementById("intervalLabel"),
  checkBtn: document.getElementById("checkBtn"),
  watchBtn: document.getElementById("watchBtn"),
  notifyBtn: document.getElementById("notifyBtn"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  modelsInStock: document.getElementById("modelsInStock"),
  pickupAvailable: document.getElementById("pickupAvailable"),
  variantCount: document.getElementById("variantCount"),
  lastChecked: document.getElementById("lastChecked"),
  errorBox: document.getElementById("errorBox"),
  modelsList: document.getElementById("modelsList"),
  modelsMeta: document.getElementById("modelsMeta"),
  langZh: document.getElementById("langZh"),
  langEn: document.getElementById("langEn"),
};

function readSavedLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch (_error) {
    /* ignore */
  }
  return "zh";
}

function t(key, vars = {}) {
  const table = I18N[state.lang] || I18N.zh;
  let text = table[key] || I18N.en[key] || key;
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
}

function localeTag() {
  return state.lang === "zh" ? "zh-HK" : "en-HK";
}

function colorLabel(color) {
  if (state.lang === "zh" && COLOR_ZH[color]) return COLOR_ZH[color];
  return color;
}

function variantDisplayLabel(label) {
  const storage = label.split(" ", 1)[0];
  const color = parseVariantColor(label);
  return color ? `${storage} ${colorLabel(color)}` : label;
}

function storeDisplayName(name) {
  if (state.lang !== "zh" || !name) return name;
  const match = Object.entries(STORE_ZH).find(([english]) => name.startsWith(english) || name.includes(english));
  return match ? match[1] : name;
}

const WEEKDAY_ZH = { Mon: "一", Tue: "二", Wed: "三", Thu: "四", Fri: "五", Sat: "六", Sun: "日" };
const MONTH_NUM = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Sept: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function localizeEnglishDate(text) {
  return String(text).replace(
    /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b/gi,
    (matched, weekday, day, month) => {
      const weekKey = weekday[0].toUpperCase() + weekday.slice(1, 3).toLowerCase();
      const monthKey = /^sept/i.test(month)
        ? "Sept"
        : month[0].toUpperCase() + month.slice(1, 3).toLowerCase();
      const weekZh = WEEKDAY_ZH[weekKey];
      const monthNum = MONTH_NUM[monthKey];
      if (!weekZh || !monthNum) return matched;
      return `${Number(day)}/${monthNum}（${weekZh}）`;
    }
  );
}

function localizeAppleText(text) {
  if (text == null || text === "") return text;
  if (state.lang !== "zh") {
    return text === "unknown" ? t("unknown") : text;
  }
  const replacements = [
    ["Currently Unavailable", "暫時未能提供"],
    ["Currently unavailable", "暫時未能提供"],
    ["currently unavailable", "暫時未能提供"],
    ["Unavailable", "未能提供"],
    ["Today", "今日"],
    ["Closed", "休息"],
    ["unknown", "未知"],
  ];
  let out = String(text);
  replacements.forEach(([en, zh]) => {
    out = out.replaceAll(en, zh);
  });
  return localizeEnglishDate(out);
}

function applyStaticCopy() {
  document.documentElement.lang = localeTag();
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.getAttribute("data-i18n"));
  });
  if (els.langZh) els.langZh.classList.toggle("is-active", state.lang === "zh");
  if (els.langEn) els.langEn.classList.toggle("is-active", state.lang === "en");
  updateActionButtons();
}

function updateActionButtons() {
  els.watchBtn.textContent = state.watching ? t("stop") : t("watch");
  if (!("Notification" in window)) {
    els.notifyBtn.textContent = t("notify");
    return;
  }
  els.notifyBtn.textContent = Notification.permission === "granted" ? t("notifyOn") : t("notify");
}

function setLang(lang) {
  state.lang = lang === "en" ? "en" : "zh";
  try {
    localStorage.setItem(LANG_KEY, state.lang);
  } catch (_error) {
    /* ignore */
  }
  applyStaticCopy();
  if (state.catalog) renderCatalogFilters();
  if (state.snapshot) applySnapshot(state.snapshot, state.sourceLabel);
  setStatusMode(state.statusMode || "idle", state.statusKey || "ready");
}

function setStatusMode(mode, key) {
  state.statusMode = mode;
  state.statusKey = key;
  els.statusDot.className = `status-dot status-dot--${mode}`;
  els.statusText.textContent = t(key);
}

function formatStorageLabel(value) {
  if (value >= 1024) return `${value / 1024}TB`;
  return `${value}GB`;
}

function parseVariantStorageGb(label) {
  const storage = label.split(" ", 1)[0].toUpperCase();
  if (storage.endsWith("TB")) return Math.round(parseFloat(storage) * 1024);
  if (storage.endsWith("GB")) return parseInt(storage, 10);
  return Number(storage);
}

function parseVariantColor(label) {
  return label.split(" ").slice(1).join(" ");
}

function catalogModels(catalog) {
  const order = catalog.model_order || Object.keys(catalog.models || {});
  return order
    .filter((id) => catalog.models[id])
    .map((id) => ({
      id,
      name: catalog.models[id].name,
      variants: catalog.models[id].variants,
    }));
}

function collectStoragesAndColors(catalog) {
  const storages = new Set();
  const colors = new Set();
  catalogModels(catalog).forEach((model) => {
    Object.values(model.variants).forEach((label) => {
      storages.add(parseVariantStorageGb(label));
      colors.add(parseVariantColor(label));
    });
  });
  return {
    storages: [...storages].sort((a, b) => a - b),
    colors: [...colors].sort(),
  };
}

function matchesCurrentFilters(model, variant) {
  if (state.selectedModels.size > 0 && !state.selectedModels.has(model.id)) return false;
  if (state.selectedStorage.size > 0) {
    if (!state.selectedStorage.has(String(parseVariantStorageGb(variant.label)))) return false;
  }
  if (state.selectedColors.size > 0) {
    if (!state.selectedColors.has(parseVariantColor(variant.label))) return false;
  }
  return true;
}

function onFiltersChanged() {
  state.previousPickupAvailable = new Set();
  state.seedNotificationBaseline = true;
  if (state.snapshot) applySnapshot(state.snapshot);
}

function renderChips(container, values, selectedSet, labelFn = (v) => v, keyFn = (v) => String(v)) {
  container.innerHTML = "";
  values.forEach((value) => {
    const key = keyFn(value);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = labelFn(value);
    if (selectedSet.has(key)) button.classList.add("chip--active");
    button.addEventListener("click", () => {
      if (selectedSet.has(key)) {
        selectedSet.delete(key);
        button.classList.remove("chip--active");
      } else {
        selectedSet.add(key);
        button.classList.add("chip--active");
      }
      onFiltersChanged();
    });
    container.appendChild(button);
  });
}

function orderUrlFor(partNumber, modelId, label) {
  const params = new URLSearchParams([
    ["product", partNumber],
    ["purchaseOption", "fullPrice"],
    ["tradeInSelection", "noTradeIn"],
    ["tradeInType", "noTradeIn"],
    ["igt", "1"],
    ["appleCareType", "noapplecare"],
    ["acpart", "none"],
  ]);
  const model = state.catalog?.models?.[modelId] || {};
  const buyBase = model.buy_url || BUY_BASE;
  const screen = model.screen || SCREEN_SIZE[modelId];
  if (screen && label && label.includes(" ")) {
    const [storage, ...colorParts] = label.split(" ");
    const colorSlug = colorParts.join(" ").toLowerCase().replace(/\s+/g, "-");
    const slug = `${screen}-${storage.toLowerCase()}-${colorSlug}`;
    return `${buyBase}/${slug}?${params}`;
  }
  return `https://www.apple.com/hk/shop/product/${encodeURIComponent(partNumber)}?${params}`;
}

function selectedParts() {
  const parts = [];
  catalogModels(state.catalog).forEach((model) => {
    if (state.selectedModels.size > 0 && !state.selectedModels.has(model.id)) return;
    Object.entries(model.variants).forEach(([part, label]) => {
      if (state.selectedStorage.size > 0) {
        if (!state.selectedStorage.has(String(parseVariantStorageGb(label)))) return;
      }
      if (state.selectedColors.size > 0) {
        if (!state.selectedColors.has(parseVariantColor(label))) return;
      }
      parts.push({ part, label, modelId: model.id, modelName: model.name });
    });
  });
  return parts;
}

function chunked(items, size = BATCH_SIZE) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function readEmbeddedJson(id) {
  const node = document.getElementById(id);
  if (!node) return null;
  try {
    return JSON.parse(node.textContent);
  } catch (_error) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return await response.json();
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (_error) {
      return { contents: text, data: { content: text } };
    }
  } catch (error) {
    if (error && error.name === "AbortError") throw new Error("request timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithRetry(url, retries = 1, timeoutMs = 12000) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJson(url, timeoutMs);
    } catch (error) {
      lastError = error;
      if (!/HTTP 429/i.test(String(error?.message || error)) || attempt === retries) break;
      await sleep(2000 * (attempt + 1));
    }
  }
  throw lastError || new Error("request failed");
}

function parseApplePayload(payload) {
  if (typeof payload === "string") {
    const start = payload.indexOf("{");
    return JSON.parse(start >= 0 ? payload.slice(start) : payload);
  }
  const content = payload?.data?.content;
  if (typeof content === "string" && content.trim()) {
    const trimmed = content.trim();
    const start = trimmed.indexOf("{");
    return JSON.parse(start >= 0 ? trimmed.slice(start) : trimmed);
  }
  if (typeof payload?.contents === "string" && payload.contents.trim()) {
    const trimmed = payload.contents.trim();
    const start = trimmed.indexOf("{");
    return JSON.parse(start >= 0 ? trimmed.slice(start) : trimmed);
  }
  if (payload?.body) return payload;
  throw new Error("Unexpected proxy response");
}

async function fetchAppleJson(appleUrl) {
  const payload = await fetchJsonWithRetry(`https://r.jina.ai/${appleUrl}`, 1, 12000);
  return parseApplePayload(payload);
}

function pickupStatus(raw) {
  if (raw === "available") return "available";
  if (raw === "unavailable") return "unavailable";
  if (raw === "ineligible") return "ineligible";
  return "unknown";
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pickupDate(availability, regular) {
  const quote = (availability.pickupSearchQuote || "").trim();
  const storeQuote = (regular.storePickupQuote || "").trim();
  if (quote.toLowerCase().startsWith("available ")) return quote.slice("Available ".length).trim();
  if (quote && !["currently unavailable", "unavailable"].includes(quote.toLowerCase())) return quote;
  if (storeQuote.includes(" at Apple ")) return storeQuote.split(" at Apple ", 1)[0].trim();
  if (storeQuote.toLowerCase().startsWith("today")) return "Today";
  return quote || storeQuote || "";
}

function expandStoreDays(text) {
  const cleaned = String(text || "").replaceAll(":", "").trim();
  const days = new Set();
  if (!cleaned) return days;
  cleaned.split(",").forEach((chunk) => {
    const part = chunk.trim();
    if (!part) return;
    if (part.includes("-")) {
      const [startText, endText] = part.split("-", 2).map((item) => item.trim().slice(0, 3));
      const start = WEEKDAYS.indexOf(startText);
      const end = WEEKDAYS.indexOf(endText);
      if (start < 0 || end < 0) return;
      if (start <= end) WEEKDAYS.slice(start, end + 1).forEach((day) => days.add(day));
      else [...WEEKDAYS.slice(start), ...WEEKDAYS.slice(0, end + 1)].forEach((day) => days.add(day));
      return;
    }
    const day = part.slice(0, 3);
    if (WEEKDAYS.includes(day)) days.add(day);
  });
  return days;
}

function to24hRange(text) {
  const converted = String(text || "").replace(/(\d{1,2}):(\d{2})\s*([AP]M)/gi, (_m, hourText, minute, meridian) => {
    let hour = Number(hourText);
    const ap = meridian.toUpperCase();
    if (ap === "PM" && hour !== 12) hour += 12;
    if (ap === "AM" && hour === 12) hour = 0;
    return `${hour}:${minute}`;
  });
  return converted.replaceAll(" - ", "–").replaceAll("-", "–").trim();
}

function encodedPickupDate(store) {
  const raw = String(store.pickupEncodedUpperDateString || "").trim();
  if (!/^\d{8}$/.test(raw)) return null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function specialHours(store, when) {
  const label = `${MONTHS[when.getMonth()]} ${when.getDate()}`;
  for (const item of store.specialHours?.specialHoursData || []) {
    const days = String(item.specialDays || "").replaceAll(":", "").trim();
    if (days === label) return String(item.specialTimings || "").trim();
  }
  for (const holiday of store.retailStore?.storeHolidays || []) {
    if (String(holiday.date || "").trim() !== label) continue;
    if (holiday.closed) return "Closed";
    return String(holiday.hours || "").trim();
  }
  return "";
}

function regularHours(store, weekday) {
  const entries = store.storeHours?.hours || store.retailStore?.storeHours || [];
  if (!entries.length) return "";
  if (weekday) {
    for (const entry of entries) {
      const days = expandStoreDays(entry.storeDays);
      if (!days.size || days.has(weekday)) return String(entry.storeTimings || "").trim();
    }
  }
  return String(entries[0].storeTimings || "").trim();
}

function storeHoursForPickup(store) {
  const when = encodedPickupDate(store);
  let raw = "";
  if (when) {
    raw = specialHours(store, when) || regularHours(store, WEEKDAYS[when.getDay() === 0 ? 6 : when.getDay() - 1]);
  }
  if (!raw) raw = regularHours(store, null);
  return raw ? to24hRange(raw) : "";
}

function availableWhen(availability, regular, store) {
  const date = pickupDate(availability, regular);
  if (!date || ["currently unavailable", "unavailable"].includes(date.toLowerCase())) return date;
  const hours = storeHoursForPickup(store || {});
  if (date && hours) return `${date} · ${hours}`;
  return date || hours || "";
}

function formatPickupWhen(text) {
  if (!text) return "—";
  return localizeAppleText(text).replaceAll(" · ", "<br>");
}

function buildPickupUrl(parts) {
  const params = new URLSearchParams({ pl: "true", location: LOCATION });
  parts.forEach((part, index) => params.append(`parts.${index}`, part));
  return `${APPLE_BASE}/retail/pickup-message?${params}`;
}

function buildDeliveryUrl(parts) {
  const params = new URLSearchParams({ mt: "regular" });
  parts.forEach((part, index) => params.append(`parts.${index}`, part));
  return `${APPLE_BASE}/delivery-message?${params}`;
}

async function checkPickup(parts) {
  if (!parts.length) return { results: [], errors: [] };
  const payload = await fetchAppleJson(buildPickupUrl(parts));
  const body = payload.body || {};
  if (body.errorMessage) return { results: [], errors: [{ part_number: "*", reason: body.errorMessage }] };
  const stores = body.stores || [];
  if (!stores.length) {
    return {
      results: [],
      errors: [{ part_number: "*", reason: body.notAvailableNearby || "no stores returned" }],
    };
  }
  const results = [];
  stores.forEach((store) => {
    const storeUrl = (store.reservationUrl || store.makeReservationUrl || "").replace("http://", "https://");
    Object.entries(store.partsAvailability || {}).forEach(([partNumber, availability]) => {
      const regular = (availability.messageTypes || {}).regular || {};
      results.push({
        part_number: partNumber,
        status: pickupStatus(availability.pickupDisplay),
        quote: availability.pickupSearchQuote || regular.storePickupQuote || "",
        available_when: availableWhen(availability, regular, store),
        store_name: store.storeName || "Unknown Store",
        store_number: store.storeNumber || "",
        city: store.city || "",
        store_url: storeUrl,
      });
    });
  });
  return { results, errors: [] };
}

async function checkDelivery(parts) {
  if (!parts.length) return { results: [], errors: [] };
  const payload = await fetchAppleJson(buildDeliveryUrl(parts));
  const deliveryMessage = (((payload.body || {}).content || {}).deliveryMessage) || {};

  function partDataFor(partNumber) {
    if (deliveryMessage[partNumber]) return deliveryMessage[partNumber];
    const compact = partNumber.replace(/\//g, "");
    for (const [key, value] of Object.entries(deliveryMessage)) {
      if (typeof value !== "object" || !value) continue;
      if (key === partNumber || key.replace(/\//g, "") === compact) return value;
    }
    return null;
  }

  function dateFrom(regular) {
    const message = regular.deliveryOptionMessages?.[0]?.displayName || "";
    const optionDate = regular.deliveryOptions?.[0]?.date;
    const isBuyable = regular.buyability?.isBuyable ?? regular.isBuyable;
    if (isBuyable === false && message) return message.split("—")[0].trim();
    if (optionDate && !String(optionDate).toLowerCase().startsWith("order today")) return optionDate;
    if (message) return message.split("—")[0].trim();
    const sticky = String(regular.stickyMessageSTH || "").replace(/<[^>]+>/g, " ");
    const match = sticky.match(/\d{1,2}\/\d{1,2}\/\d{4}\s*[–-]\s*\d{1,2}\/\d{1,2}\/\d{4}/);
    if (match) return match[0];
    const quote = (regular.orderByDeliveryBy || "").trim();
    if (quote && !quote.toLowerCase().startsWith("order today")) return quote;
    return "unknown";
  }

  const results = parts.map((partNumber) => {
    const partData = partDataFor(partNumber);
    if (!partData) {
      return { part_number: partNumber, status: "unknown", delivery_date: "unknown" };
    }
    const regular = partData.regular || {};
    const dateText = dateFrom(regular);
    const buyability = regular.buyability || {};
    const isBuyable = buyability.isBuyable ?? regular.isBuyable;
    const inventory = buyability.inventory;
    let status = "unknown";
    if (isBuyable === true && (inventory == null || inventory > 0)) status = "available";
    else if (isBuyable === false || inventory === 0) status = "unavailable";
    else status = String(dateText).toLowerCase().includes("unavailable") ? "unavailable" : "available";
    return { part_number: partNumber, status, delivery_date: dateText };
  });
  return { results, errors: [] };
}

function previousVariant(partNumber) {
  for (const model of state.snapshot?.models || []) {
    const variant = model.variants.find((item) => item.part_number === partNumber);
    if (variant) return variant;
  }
  return null;
}

function groupByModel(selected, pickupResults, deliveryResults) {
  const pickupByPart = {};
  pickupResults.forEach((item) => {
    (pickupByPart[item.part_number] ||= []).push(item);
  });
  const deliveryByPart = Object.fromEntries(deliveryResults.map((item) => [item.part_number, item]));

  const grouped = {};
  catalogModels(state.catalog).forEach((model) => {
    grouped[model.id] = {
      id: model.id,
      name: model.name,
      summary: { variant_count: 0, pickup_available: 0, delivery_available: 0 },
      variants: [],
    };
  });

  selected.forEach(({ part, label, modelId }) => {
    const pickupEntries = pickupByPart[part] || [];
    const availableStores = pickupEntries
      .filter((entry) => entry.status === "available")
      .map((entry) => ({
        store_name: entry.store_name,
        store_number: entry.store_number,
        city: entry.city,
        quote: entry.quote,
        available_when: entry.available_when,
        store_url: entry.store_url,
        order_url: orderUrlFor(part, modelId, label),
      }));
    const previous = previousVariant(part);
    const pickupStatusValue = availableStores.length
      ? "available"
      : pickupEntries[0]?.status || previous?.pickup_status || "unknown";
    const usedPreviousPickup = !pickupEntries.length && previous;
    const delivery = deliveryByPart[part];
    const deliveryLooksLive =
      delivery &&
      ["available", "unavailable", "ineligible"].includes(delivery.status) &&
      delivery.delivery_date &&
      delivery.delivery_date !== "unknown";
    const deliveryStatus = deliveryLooksLive
      ? delivery.status
      : previous?.delivery_status || delivery?.status || "unknown";
    const deliveryDate = deliveryLooksLive
      ? delivery.delivery_date
      : previous?.delivery_date || delivery?.delivery_date || "unknown";
    const variant = {
      part_number: part,
      label,
      order_url: orderUrlFor(part, modelId, label),
      pickup_status: pickupStatusValue,
      pickup_quote: usedPreviousPickup ? previous.pickup_quote || "" : pickupEntries[0]?.quote || "",
      pickup_when: usedPreviousPickup
        ? previous.pickup_when || ""
        : pickupEntries.find((e) => e.status === "available" && e.available_when)?.available_when ||
          pickupEntries[0]?.available_when ||
          "",
      pickup_stores: usedPreviousPickup ? previous.pickup_stores || [] : availableStores,
      delivery_status: deliveryStatus,
      delivery_date: deliveryDate,
    };
    const modelEntry = grouped[modelId];
    modelEntry.variants.push(variant);
    modelEntry.summary.variant_count += 1;
    if (pickupStatusValue === "available") modelEntry.summary.pickup_available += 1;
    if (variant.delivery_status === "available") modelEntry.summary.delivery_available += 1;
  });

  const order = state.catalog.model_order || Object.keys(grouped);
  return order.filter((id) => grouped[id]?.variants.length).map((id) => grouped[id]);
}

function filterModels(models) {
  return models
    .map((model) => {
      if (state.selectedModels.size > 0 && !state.selectedModels.has(model.id)) return null;
      const variants = model.variants.filter((variant) => {
        if (state.selectedStorage.size > 0) {
          if (!state.selectedStorage.has(String(parseVariantStorageGb(variant.label)))) return false;
        }
        if (state.selectedColors.size > 0) {
          if (!state.selectedColors.has(parseVariantColor(variant.label))) return false;
        }
        return true;
      });
      if (!variants.length) return null;
      return {
        ...model,
        variants,
        summary: {
          variant_count: variants.length,
          pickup_available: variants.filter((v) => v.pickup_status === "available").length,
          delivery_available: variants.filter((v) => v.delivery_status === "available").length,
        },
      };
    })
    .filter(Boolean);
}

function badgeClass(status) {
  if (status === "available") return "badge badge--available";
  if (status === "unavailable") return "badge badge--unavailable";
  return "badge badge--unknown";
}

function badgeLabel(status) {
  if (status === "available") return t("yes");
  if (status === "unavailable") return t("no");
  if (status === "ineligible") return t("na");
  return "?";
}

function renderStoreTags(stores, fallbackWhen = "") {
  if (!stores.length) return '<span class="placeholder">—</span>';
  return `<div class="store-tags">${stores
    .map((store) => {
      const whenText = store.available_when || fallbackWhen;
      const when = whenText
        ? `<span class="store-tag__when">${formatPickupWhen(whenText)}</span>`
        : "";
      const label = `<span class="store-tag__name"><strong>${storeDisplayName(store.store_name)}</strong>${when}</span>`;
      if (store.order_url) {
        return `<a class="store-tag store-tag--link" href="${store.order_url}" target="_blank" rel="noopener noreferrer" title="${t("orderTitle")}">
          ${label}
          <span class="store-tag__action">${t("order")}</span>
        </a>`;
      }
      if (store.store_url) {
        return `<a class="store-tag store-tag--link" href="${store.store_url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      }
      return `<span class="store-tag">${label}</span>`;
    })
    .join("")}</div>`;
}

function renderModels(models) {
  if (!models.length) {
    els.modelsList.innerHTML = `<p class="placeholder">${t("noMatch")}</p>`;
    return;
  }

  els.modelsList.innerHTML = models
    .map((model) => {
      const inStock = model.summary.pickup_available > 0;
      const rows = model.variants
        .map((variant) => {
          const rowClass = variant.pickup_status === "available" ? "row--available" : "";
          const displayLabel = variantDisplayLabel(variant.label);
          const variantLabel = variant.order_url
            ? `<a class="variant-link" href="${variant.order_url}" target="_blank" rel="noopener noreferrer">${displayLabel}</a>`
            : displayLabel;
          const pickupWhen =
            variant.pickup_status === "available"
              ? formatPickupWhen(variant.pickup_when || variant.pickup_quote || "—")
              : "—";
          return `
            <tr class="${rowClass}">
              <td class="col-variant">${variantLabel}</td>
              <td class="col-pickup"><span class="${badgeClass(variant.pickup_status)}">${badgeLabel(variant.pickup_status)}</span></td>
              <td class="col-when">${pickupWhen}</td>
              <td class="col-stores">${renderStoreTags(variant.pickup_stores || [], variant.pickup_when || variant.pickup_quote || "")}</td>
              <td class="col-delivery"><span class="${badgeClass(variant.delivery_status)}">${badgeLabel(variant.delivery_status)}</span></td>
              <td class="col-date">${localizeAppleText(variant.delivery_date)}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <article class="model-panel ${inStock ? "model-panel--in-stock" : ""}" id="model-${model.id}">
          <div class="model-panel__head">
            <div>
              <div class="model-panel__title">${model.name}</div>
              <div class="model-panel__meta">${t("meta", {
                variants: model.summary.variant_count,
                pickup: model.summary.pickup_available,
                delivery: model.summary.delivery_available,
              })}</div>
            </div>
            ${inStock ? `<span class="badge badge--available">${t("inStock")}</span>` : `<span class="badge badge--unavailable">${t("noPickup")}</span>`}
          </div>
          <div class="table-wrap">
            <table class="availability-table">
              <thead>
                <tr>
                  <th class="col-variant">${t("variant")}</th>
                  <th class="col-pickup">${t("pickup")}</th>
                  <th class="col-when">${t("canPickUp")}</th>
                  <th class="col-stores">${t("stores")}</th>
                  <th class="col-delivery">${t("delivery")}</th>
                  <th class="col-date">${t("shipDate")}</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </article>
      `;
    })
    .join("");
}

function collectFilteredPickupKeys(models) {
  const available = [];
  models.forEach((model) => {
    model.variants.forEach((variant) => {
      if (!matchesCurrentFilters(model, variant)) return;
      (variant.pickup_stores || []).forEach((store) => {
        available.push({
          key: `${model.id}|${variant.part_number}|${store.store_number}`,
          modelName: model.name,
          label: variant.label,
          storeName: store.store_name,
          availableWhen: store.available_when || variant.pickup_when || "",
        });
      });
    });
  });
  return available;
}

function maybeNotifyPickup(models) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const available = collectFilteredPickupKeys(models);
  const availableKeys = new Set(available.map((item) => item.key));

  if (state.seedNotificationBaseline || !state.watching) {
    state.previousPickupAvailable = availableKeys;
    state.seedNotificationBaseline = false;
    return;
  }

  available.forEach((item) => {
    if (state.previousPickupAvailable.has(item.key)) return;
    const whenText = item.availableWhen ? t("notifyWhen", { when: localizeAppleText(item.availableWhen) }) : "";
    new Notification(t("notifyTitle", { model: item.modelName }), {
      body: t("notifyBody", {
        label: variantDisplayLabel(item.label),
        store: storeDisplayName(item.storeName),
        when: whenText,
      }),
    });
  });

  state.previousPickupAvailable = availableKeys;
}

function applySnapshot(data, sourceLabel = "snapshot") {
  state.snapshot = data;
  state.sourceLabel = sourceLabel;
  const models = filterModels(data.models || []);
  const pickupSlots = models.reduce((sum, model) => sum + model.summary.pickup_available, 0);
  const variantCount = models.reduce((sum, model) => sum + model.summary.variant_count, 0);
  const sourceText = sourceLabel === "live" ? t("live") : t("snapshot");

  els.modelsInStock.textContent = String(models.filter((m) => m.summary.pickup_available > 0).length);
  els.pickupAvailable.textContent = String(pickupSlots);
  els.variantCount.textContent = String(variantCount);
  els.lastChecked.textContent = data.checked_at
    ? new Date(data.checked_at).toLocaleString(localeTag())
    : "—";
  els.modelsMeta.textContent = t("storesMeta", {
    count: data.summary?.stores_checked ?? 0,
    source: sourceText,
  });

  if (data.errors?.length) {
    els.errorBox.classList.remove("hidden");
    const reasons = [...new Set(data.errors.map((err) => err.reason))];
    const rateLimited = reasons.some((reason) => /429/.test(reason));
    els.errorBox.innerHTML = rateLimited
      ? `<div>${t("rateLimited")}</div>`
      : reasons.map((reason) => `<div>${reason}</div>`).join("");
  } else {
    els.errorBox.classList.add("hidden");
    els.errorBox.innerHTML = "";
  }

  renderModels(models);
  maybeNotifyPickup(models);
}

async function loadSnapshotFallback() {
  const stamp = Date.now();
  const urls = [
    `${REPO_RAW}/stock.json?t=${stamp}`,
    `https://cdn.jsdelivr.net/gh/liuchiwai0101/Others@cursor/iphone-18-stock-bot-1629/docs/stock.json?t=${stamp}`,
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      applySnapshot(data, "snapshot");
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(t("snapshotMissing"));
}

async function runLiveCheck() {
  const selected = selectedParts();
  const partNumbers = selected.map((item) => item.part);
  const pickupResults = [];
  const deliveryResults = [];
  const errors = [];

  if (!partNumbers.length) {
    errors.push({ part_number: "*", reason: "no variants selected" });
  } else {
    const pickupBatches = chunked(partNumbers);
    const deliveryBatches = chunked(partNumbers);
    for (let index = 0; index < pickupBatches.length; index += 1) {
      try {
        const { results, errors: batchErrors } = await checkPickup(pickupBatches[index]);
        pickupResults.push(...results);
        errors.push(...batchErrors);
      } catch (error) {
        errors.push({ part_number: "*", reason: `pickup: ${error.message}` });
      }
      if (index < pickupBatches.length - 1) await sleep(400);
    }
    if (pickupBatches.length) await sleep(400);
    for (let index = 0; index < deliveryBatches.length; index += 1) {
      try {
        const { results, errors: batchErrors } = await checkDelivery(deliveryBatches[index]);
        deliveryResults.push(...results);
        errors.push(...batchErrors);
      } catch (error) {
        errors.push({ part_number: "*", reason: `delivery: ${error.message}` });
      }
      if (index < deliveryBatches.length - 1) await sleep(400);
    }
  }

  const models = groupByModel(selected, pickupResults, deliveryResults);
  if (!pickupResults.length && !deliveryResults.length && errors.length) {
    throw new Error(errors[0].reason);
  }
  const pickupSlots = models.reduce((sum, model) => sum + model.summary.pickup_available, 0);
  return {
    checked_at: new Date().toISOString(),
    models,
    errors,
    summary: {
      variant_count: partNumbers.length,
      pickup_available: pickupSlots,
      stores_checked: new Set(
        models.flatMap((model) =>
          model.variants.flatMap((variant) => (variant.pickup_stores || []).map((store) => store.store_number))
        ).filter(Boolean)
      ).size,
      models_with_pickup: models.filter((model) => model.summary.pickup_available > 0).length,
    },
  };
}

async function runCheck() {
  setStatusMode("loading", "checking");
  els.checkBtn.disabled = true;
  try {
    try {
      const live = await runLiveCheck();
      applySnapshot(live, "live");
      setStatusMode(state.watching ? "watching" : "idle", state.watching ? "watchingLive" : "ready");
      return;
    } catch (liveError) {
      try {
        await loadSnapshotFallback();
        els.errorBox.classList.remove("hidden");
        els.errorBox.textContent = /429/.test(String(liveError.message))
          ? t("rateLimited")
          : t("liveBlocked", { error: liveError.message });
        setStatusMode(state.watching ? "watching" : "idle", state.watching ? "watching" : "ready");
        return;
      } catch (_snapshotError) {
        const embedded = readEmbeddedJson("embedded-stock");
        if (embedded) {
          applySnapshot(embedded, "snapshot");
          els.errorBox.classList.remove("hidden");
          els.errorBox.textContent = t("liveBlockedPreview", { error: liveError.message });
          setStatusMode("idle", "ready");
          return;
        }
        throw liveError;
      }
    }
  } catch (error) {
    setStatusMode("error", "checkFailed");
    els.errorBox.classList.remove("hidden");
    els.errorBox.textContent = error.message;
  } finally {
    els.checkBtn.disabled = false;
  }
}

function stopWatching() {
  state.watching = false;
  if (state.watchTimer) {
    clearInterval(state.watchTimer);
    state.watchTimer = null;
  }
  els.watchBtn.classList.remove("is-active");
  updateActionButtons();
  setStatusMode("idle", "ready");
}

async function runWatchTick() {
  if (!state.watching) return;
  setStatusMode("loading", "refreshingSnapshot");
  try {
    await loadSnapshotFallback();
    setStatusMode("watching", "watching");
  } catch (error) {
    setStatusMode("watching", "watching");
    els.errorBox.classList.remove("hidden");
    els.errorBox.textContent = t("snapshotFailed", { error: error.message });
  }
}

function startWatching() {
  const intervalMs = Math.max(Number(els.intervalRange.value), 30) * 1000;
  state.watching = true;
  state.seedNotificationBaseline = true;
  els.watchBtn.classList.add("is-active");
  updateActionButtons();
  setStatusMode("watching", "watching");
  runCheck();
  state.watchTimer = setInterval(runWatchTick, intervalMs);
}

function renderCatalogFilters(selectAllModels = false) {
  const { storages, colors } = collectStoragesAndColors(state.catalog);
  if (selectAllModels) {
    catalogModels(state.catalog).forEach((model) => state.selectedModels.add(model.id));
  }
  renderChips(
    els.modelChips,
    catalogModels(state.catalog),
    state.selectedModels,
    (model) => model.name,
    (model) => model.id
  );
  renderChips(els.storageChips, storages, state.selectedStorage, formatStorageLabel);
  renderChips(els.colorChips, colors, state.selectedColors, colorLabel);
}

function loadCatalog() {
  state.catalog = readEmbeddedJson("embedded-catalog");
  if (!state.catalog) throw new Error("Embedded catalog missing");
  renderCatalogFilters(true);
}

els.intervalRange.addEventListener("input", () => {
  els.intervalLabel.textContent = `${els.intervalRange.value}s`;
  if (state.watching) {
    stopWatching();
    startWatching();
  }
});

els.checkBtn.addEventListener("click", runCheck);
els.watchBtn.addEventListener("click", () => {
  if (state.watching) stopWatching();
  else startWatching();
});

els.notifyBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert(t("notifyUnsupported"));
    return;
  }
  const permission = await Notification.requestPermission();
  els.notifyBtn.textContent = permission === "granted" ? t("notifyOn") : t("notifyOff");
});

if (els.langZh) els.langZh.addEventListener("click", () => setLang("zh"));
if (els.langEn) els.langEn.addEventListener("click", () => setLang("en"));

try {
  state.lang = readSavedLang();
  applyStaticCopy();
  setStatusMode("loading", "loadingSnapshot");
  loadCatalog();
  const embedded = readEmbeddedJson("embedded-stock");
  if (embedded) {
    applySnapshot(embedded, "snapshot");
    setStatusMode("idle", "ready");
  } else {
    setStatusMode("idle", "readyTap");
  }
} catch (error) {
  setStatusMode("error", "checkFailed");
  els.errorBox.classList.remove("hidden");
  els.errorBox.textContent = error.message;
}
