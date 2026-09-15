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
  lastData: null,
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
    ["unknown", "未知"],
  ];
  let out = String(text);
  replacements.forEach(([en, zh]) => {
    out = out.replaceAll(en, zh);
  });
  return out;
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
  if (state.catalog) paintCatalogFilters();
  if (state.lastData) applyCheckData(state.lastData);
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

function matchesCurrentFilters(model, variant) {
  if (state.selectedModels.size > 0 && !state.selectedModels.has(model.id)) {
    return false;
  }
  if (state.selectedStorage.size > 0) {
    const storageGb = String(parseVariantStorageGb(variant.label));
    if (!state.selectedStorage.has(storageGb)) return false;
  }
  if (state.selectedColors.size > 0) {
    const color = parseVariantColor(variant.label);
    if (!state.selectedColors.has(color)) return false;
  }
  return true;
}

function onFiltersChanged() {
  // Drop stale baseline so notices never come from a previous wider filter set.
  state.previousPickupAvailable = new Set();
  state.seedNotificationBaseline = true;
}

function renderChips(container, values, selectedSet, labelFn = (v) => v, keyFn = (v) => String(v)) {
  container.innerHTML = "";
  values.forEach((value) => {
    const key = keyFn(value);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = labelFn(value);
    if (selectedSet.has(key)) {
      button.classList.add("chip--active");
    }
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

function selectedModelsList() {
  if (!state.catalog || state.selectedModels.size === 0) {
    return [];
  }
  if (state.selectedModels.size === state.catalog.models.length) {
    return "all";
  }
  return [...state.selectedModels];
}

function buildRequestBody() {
  return {
    // Always search all nearby HK stores (Central covers the full HK store set).
    location: "Central",
    store_number: null,
    models: selectedModelsList(),
    check_pickup: true,
    check_online_delivery: true,
    filters: {
      storage_gb: [...state.selectedStorage].map(Number),
      colors: [...state.selectedColors],
    },
  };
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

function renderStoreTags(stores) {
  if (!stores.length) {
    return '<span class="placeholder">—</span>';
  }
  return `<div class="store-tags">${stores
    .map((store) => {
      const when = store.available_when
        ? `<span class="store-tag__when">${localizeAppleText(store.available_when)}</span>`
        : "";
      const orderHref = store.order_url;
      const storeHref = store.store_url;
      const label = `<span class="store-tag__name"><strong>${storeDisplayName(store.store_name)}</strong>${when}</span>`;
      if (orderHref) {
        return `<a class="store-tag store-tag--link" href="${orderHref}" target="_blank" rel="noopener noreferrer" title="${t("orderTitle")}">
          ${label}
          <span class="store-tag__action">${t("order")}</span>
        </a>`;
      }
      if (storeHref) {
        return `<a class="store-tag store-tag--link" href="${storeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
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
          return `
            <tr class="${rowClass}">
              <td class="col-variant">${variantLabel}</td>
              <td class="col-pickup"><span class="${badgeClass(variant.pickup_status)}">${badgeLabel(variant.pickup_status)}</span></td>
              <td class="col-when">${variant.pickup_status === "available" ? localizeAppleText(variant.pickup_when || variant.pickup_quote || "—") : "—"}</td>
              <td class="col-stores">${renderStoreTags(variant.pickup_stores)}</td>
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
      variant.pickup_stores.forEach((store) => {
        available.push({
          key: `${model.id}|${variant.part_number}|${store.store_number}`,
          modelName: model.name,
          label: variant.label,
          storeName: store.store_name,
          availableWhen: store.available_when || variant.pickup_when || "",
          orderUrl: store.order_url || variant.order_url || "",
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

  // After filter changes (or first load), capture current stock without notifying.
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

function applyCheckData(data) {
  state.lastData = data;
  els.modelsInStock.textContent = String(data.summary.models_with_pickup ?? 0);
  els.pickupAvailable.textContent = String(data.summary.pickup_available ?? 0);
  els.variantCount.textContent = String(data.summary.variant_count ?? 0);
  els.lastChecked.textContent = data.checked_at ? new Date(data.checked_at).toLocaleString(localeTag()) : "—";
  els.modelsMeta.textContent = t("storesMeta", {
    count: data.summary.stores_checked ?? 0,
    source: t("live"),
  });

  if (data.errors?.length) {
    els.errorBox.classList.remove("hidden");
    els.errorBox.innerHTML = data.errors.map((err) => `<div>${err.part_number}: ${err.reason}</div>`).join("");
  } else {
    els.errorBox.classList.add("hidden");
    els.errorBox.innerHTML = "";
  }

  renderModels(data.models || []);
}

async function runCheck() {
  setStatusMode("loading", "checking");
  els.checkBtn.disabled = true;

  try {
    const response = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody()),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || t("checkFailed"));
    }

    applyCheckData(data);
    maybeNotifyPickup(data.models || []);
    setStatusMode(state.watching ? "watching" : "idle", state.watching ? "watching" : "ready");
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

function startWatching() {
  const intervalMs = Number(els.intervalRange.value) * 1000;
  state.watching = true;
  state.seedNotificationBaseline = true;
  els.watchBtn.classList.add("is-active");
  updateActionButtons();
  setStatusMode("watching", "watching");
  runCheck();
  state.watchTimer = setInterval(runCheck, intervalMs);
}

function paintCatalogFilters() {
  if (!state.catalog) return;
  renderChips(
    els.modelChips,
    state.catalog.models,
    state.selectedModels,
    (model) => model.name,
    (model) => model.id
  );
  renderChips(els.storageChips, state.catalog.storages, state.selectedStorage, formatStorageLabel);
  renderChips(els.colorChips, state.catalog.colors, state.selectedColors, colorLabel);
}

async function loadCatalog() {
  const response = await fetch("/api/catalog");
  state.catalog = await response.json();
  state.catalog.models.forEach((model) => state.selectedModels.add(model.id));
  paintCatalogFilters();
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

state.lang = readSavedLang();
applyStaticCopy();
loadCatalog().then(() => runCheck());
