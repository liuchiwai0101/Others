const state = {
  catalog: null,
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
  if (status === "available") return "Available";
  if (status === "unavailable") return "Unavailable";
  if (status === "ineligible") return "Ineligible";
  return "Unknown";
}

function renderStoreTags(stores) {
  if (!stores.length) {
    return '<span class="placeholder">—</span>';
  }
  return `<div class="store-tags">${stores
    .map((store) => {
      const when = store.available_when ? ` · ${store.available_when}` : "";
      const orderHref = store.order_url;
      const storeHref = store.store_url;
      const label = `<strong>${store.store_name}</strong>${when}`;
      if (orderHref) {
        return `<a class="store-tag store-tag--link" href="${orderHref}" target="_blank" rel="noopener noreferrer" title="Order this model on Apple HK">
          ${label}
          <span class="store-tag__action">Order</span>
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
    els.modelsList.innerHTML = '<p class="placeholder">No availability data.</p>';
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
              <td>${variant.pickup_status === "available" ? (variant.pickup_when || variant.pickup_quote || "—") : "—"}</td>
              <td>${renderStoreTags(variant.pickup_stores)}</td>
              <td><span class="${badgeClass(variant.delivery_status)}">${badgeLabel(variant.delivery_status)}</span></td>
              <td>${variant.delivery_date}</td>
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
  if (!els.checkPickup.checked) return;

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
    const whenText = item.availableWhen ? ` — pick up ${item.availableWhen}` : "";
    new Notification(`${item.modelName} in stock (HK)`, {
      body: `${item.label} at ${item.storeName}${whenText}`,
    });
  });

  state.previousPickupAvailable = availableKeys;
}

async function runCheck() {
  setStatus("loading", "Checking 18 Pro & Pro Max…");
  els.checkBtn.disabled = true;

  try {
    const response = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody()),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Stock check failed");
    }

    els.modelsInStock.textContent = String(data.summary.models_with_pickup ?? 0);
    els.pickupAvailable.textContent = String(data.summary.pickup_available ?? 0);
    els.variantCount.textContent = String(data.summary.variant_count ?? 0);
    els.lastChecked.textContent = new Date(data.checked_at).toLocaleString();

    els.modelsMeta.textContent = `${data.summary.stores_checked} stores checked`;

    if (data.errors?.length) {
      els.errorBox.classList.remove("hidden");
      els.errorBox.innerHTML = data.errors.map((err) => `<div>${err.part_number}: ${err.reason}</div>`).join("");
    } else {
      els.errorBox.classList.add("hidden");
      els.errorBox.innerHTML = "";
    }

    renderModels(data.models || []);
    maybeNotifyPickup(data.models || []);

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
  const response = await fetch("/api/catalog");
  state.catalog = await response.json();

  state.catalog.models.forEach((model) => state.selectedModels.add(model.id));

  renderChips(
    els.modelChips,
    state.catalog.models,
    state.selectedModels,
    (model) => model.name,
    (model) => model.id
  );

  renderChips(els.storageChips, state.catalog.storages, state.selectedStorage, formatStorageLabel);
  renderChips(els.colorChips, state.catalog.colors, state.selectedColors);
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
  els.notifyBtn.textContent =
    permission === "granted" ? "On" : "Off";
});

loadCatalog().then(() => runCheck());
