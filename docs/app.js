const state = {
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
  checkPickup: document.getElementById("checkPickup"),
  checkDelivery: document.getElementById("checkDelivery"),
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
};

function setStatus(mode, text) {
  els.statusDot.className = `status-dot status-dot--${mode}`;
  els.statusText.textContent = text;
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

function filterModels(models) {
  return models
    .map((model) => {
      if (state.selectedModels.size > 0 && !state.selectedModels.has(model.id)) {
        return null;
      }
      const variants = model.variants.filter((variant) => {
        if (!els.checkPickup.checked && !els.checkDelivery.checked) return true;
        if (state.selectedStorage.size > 0) {
          if (!state.selectedStorage.has(String(parseVariantStorageGb(variant.label)))) return false;
        }
        if (state.selectedColors.size > 0) {
          if (!state.selectedColors.has(parseVariantColor(variant.label))) return false;
        }
        return true;
      });
      if (!variants.length) return null;
      const pickupAvailable = variants.filter((v) => v.pickup_status === "available").length;
      const deliveryAvailable = variants.filter((v) => v.delivery_status === "available").length;
      return {
        ...model,
        variants,
        summary: {
          variant_count: variants.length,
          pickup_available: pickupAvailable,
          delivery_available: deliveryAvailable,
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
  if (status === "available") return "Available";
  if (status === "unavailable") return "Unavailable";
  if (status === "ineligible") return "Ineligible";
  return "Unknown";
}

function renderStoreTags(stores) {
  if (!stores.length) return '<span class="placeholder">—</span>';
  return `<div class="store-tags">${stores
    .map((store) => {
      const when = store.available_when ? ` · ${store.available_when}` : "";
      const label = `<strong>${store.store_name}</strong>${when}`;
      if (store.order_url) {
        return `<a class="store-tag store-tag--link" href="${store.order_url}" target="_blank" rel="noopener noreferrer" title="Order this model on Apple HK">
          ${label}
          <span class="store-tag__action">Order</span>
        </a>`;
      }
      if (store.store_url) {
        return `<a class="store-tag store-tag--link" href="${store.store_url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
      }
      return `<span class="store-tag">${label}</span>`;
    })
    .join("")}</div>`;
}

function renderOrderLink(variant) {
  const href = variant.order_url;
  if (!href) return "—";
  const label = variant.pickup_status === "available" ? "Order now" : "Buy on Apple";
  const cls =
    variant.pickup_status === "available" ? "order-link" : "order-link order-link--delivery";
  return `<a class="${cls}" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function renderModels(models) {
  if (!models.length) {
    els.modelsList.innerHTML = '<p class="placeholder">No variants match the current filters.</p>';
    return;
  }

  els.modelsList.innerHTML = models
    .map((model) => {
      const inStock = model.summary.pickup_available > 0;
      const rows = model.variants
        .map((variant) => {
          const rowClass = variant.pickup_status === "available" ? "row--available" : "";
          const variantLabel = variant.order_url
            ? `<a class="variant-link" href="${variant.order_url}" target="_blank" rel="noopener noreferrer">${variant.label}</a>`
            : variant.label;
          return `
            <tr class="${rowClass}">
              <td>${variantLabel}</td>
              <td><span class="${badgeClass(variant.pickup_status)}">${badgeLabel(variant.pickup_status)}</span></td>
              <td>${variant.pickup_status === "available" ? variant.pickup_when || variant.pickup_quote || "—" : "—"}</td>
              <td>${renderStoreTags(variant.pickup_stores || [])}</td>
              <td><span class="${badgeClass(variant.delivery_status)}">${badgeLabel(variant.delivery_status)}</span></td>
              <td>${variant.delivery_date}</td>
              <td>${renderOrderLink(variant)}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <article class="model-panel ${inStock ? "model-panel--in-stock" : ""}" id="model-${model.id}">
          <div class="model-panel__head">
            <div>
              <div class="model-panel__title">${model.name}</div>
              <div class="model-panel__meta">${model.summary.variant_count} variants · ${model.summary.pickup_available} pickup · ${model.summary.delivery_available} delivery</div>
            </div>
            ${inStock ? '<span class="badge badge--available">In stock</span>' : '<span class="badge badge--unavailable">No pickup</span>'}
          </div>
          <div class="table-wrap">
            <table class="availability-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Pickup</th>
                  <th>Can pick up</th>
                  <th>Stores</th>
                  <th>Delivery</th>
                  <th>Ship date</th>
                  <th>Buy</th>
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
  if (!els.checkPickup.checked) return;

  const available = collectFilteredPickupKeys(models);
  const availableKeys = new Set(available.map((item) => item.key));

  if (state.seedNotificationBaseline || !state.watching) {
    state.previousPickupAvailable = availableKeys;
    state.seedNotificationBaseline = false;
    return;
  }

  available.forEach((item) => {
    if (state.previousPickupAvailable.has(item.key)) return;
    const whenText = item.availableWhen ? ` — pick up ${item.availableWhen}` : "";
    new Notification(`${item.modelName} in stock (HK)`, {
      body: `${item.label} at ${item.storeName}${whenText}`,
    });
  });

  state.previousPickupAvailable = availableKeys;
}

function applySnapshot(data) {
  state.snapshot = data;
  const models = filterModels(data.models || []);
  const pickupSlots = models.reduce((sum, model) => sum + model.summary.pickup_available, 0);
  const variantCount = models.reduce((sum, model) => sum + model.summary.variant_count, 0);

  els.modelsInStock.textContent = String(models.filter((m) => m.summary.pickup_available > 0).length);
  els.pickupAvailable.textContent = String(pickupSlots);
  els.variantCount.textContent = String(variantCount);
  els.lastChecked.textContent = data.checked_at ? new Date(data.checked_at).toLocaleString() : "—";
  els.modelsMeta.textContent = `${data.summary?.stores_checked ?? 0} stores · snapshot`;

  if (data.errors?.length) {
    els.errorBox.classList.remove("hidden");
    els.errorBox.innerHTML = data.errors.map((err) => `<div>${err.part_number}: ${err.reason}</div>`).join("");
  } else {
    els.errorBox.classList.add("hidden");
    els.errorBox.innerHTML = "";
  }

  renderModels(models);
  maybeNotifyPickup(models);
}

function assetUrl(path) {
  const base = window.STOCK_ASSET_BASE || "";
  if (!base) return `${path}?t=${Date.now()}`;
  return `${base}${path}${path.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

async function runCheck() {
  setStatus("loading", "Refreshing snapshot…");
  els.checkBtn.disabled = true;
  try {
    const response = await fetch(assetUrl("stock.json"), { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load stock.json (${response.status})`);
    const data = await response.json();
    applySnapshot(data);
    setStatus(state.watching ? "watching" : "idle", state.watching ? "Watching" : "Ready");
  } catch (error) {
    setStatus("error", "Check failed");
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
  els.watchBtn.textContent = "Watch";
  els.watchBtn.classList.remove("is-active");
  setStatus("idle", "Ready");
}

function startWatching() {
  const intervalMs = Number(els.intervalRange.value) * 1000;
  state.watching = true;
  state.seedNotificationBaseline = true;
  els.watchBtn.textContent = "Stop";
  els.watchBtn.classList.add("is-active");
  setStatus("watching", "Watching");
  runCheck();
  state.watchTimer = setInterval(runCheck, intervalMs);
}

async function loadCatalog() {
  const response = await fetch(assetUrl("products.json"));
  state.catalog = await response.json();
  const { storages, colors } = collectStoragesAndColors(state.catalog);
  catalogModels(state.catalog).forEach((model) => state.selectedModels.add(model.id));
  renderChips(
    els.modelChips,
    catalogModels(state.catalog),
    state.selectedModels,
    (model) => model.name,
    (model) => model.id
  );
  renderChips(els.storageChips, storages, state.selectedStorage, formatStorageLabel);
  renderChips(els.colorChips, colors, state.selectedColors);
}

els.intervalRange.addEventListener("input", () => {
  els.intervalLabel.textContent = `${els.intervalRange.value}s`;
  if (state.watching) {
    stopWatching();
    startWatching();
  }
});

els.checkPickup.addEventListener("change", onFiltersChanged);
els.checkDelivery.addEventListener("change", onFiltersChanged);
els.checkBtn.addEventListener("click", runCheck);
els.watchBtn.addEventListener("click", () => {
  if (state.watching) stopWatching();
  else startWatching();
});

els.notifyBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("Notifications are not supported in this browser.");
    return;
  }
  const permission = await Notification.requestPermission();
  els.notifyBtn.textContent = permission === "granted" ? "On" : "Off";
});

loadCatalog().then(() => runCheck());
