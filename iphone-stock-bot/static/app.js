const state = {
  catalog: null,
  watching: false,
  watchTimer: null,
  previousPickupAvailable: new Set(),
  selectedStorage: new Set(),
  selectedColors: new Set(),
};

const els = {
  locationSelect: document.getElementById("locationSelect"),
  storeSelect: document.getElementById("storeSelect"),
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
  pickupAvailable: document.getElementById("pickupAvailable"),
  storesChecked: document.getElementById("storesChecked"),
  deliveryAvailable: document.getElementById("deliveryAvailable"),
  lastChecked: document.getElementById("lastChecked"),
  errorBox: document.getElementById("errorBox"),
  pickupResults: document.getElementById("pickupResults"),
  deliveryResults: document.getElementById("deliveryResults"),
  pickupMeta: document.getElementById("pickupMeta"),
  deliveryMeta: document.getElementById("deliveryMeta"),
};

function setStatus(mode, text) {
  els.statusDot.className = `status-dot status-dot--${mode}`;
  els.statusText.textContent = text;
}

function formatStorageLabel(value) {
  if (value >= 1024) return `${value / 1024}TB`;
  return `${value}GB`;
}

function renderChips(container, values, selectedSet, labelFn = (v) => v) {
  container.innerHTML = "";
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = labelFn(value);
    button.dataset.value = value;
    if (selectedSet.has(String(value)) || selectedSet.has(value)) {
      button.classList.add("chip--active");
    }
    button.addEventListener("click", () => {
      const key = String(value);
      if (selectedSet.has(key)) {
        selectedSet.delete(key);
        button.classList.remove("chip--active");
      } else {
        selectedSet.add(key);
        button.classList.add("chip--active");
      }
    });
    container.appendChild(button);
  });
}

function buildRequestBody() {
  return {
    location: els.locationSelect.value || null,
    store_number: els.storeSelect.value || null,
    check_pickup: els.checkPickup.checked,
    check_online_delivery: els.checkDelivery.checked,
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

function groupPickupResults(pickup, variants) {
  const grouped = new Map();

  pickup.forEach((item) => {
    if (!grouped.has(item.part_number)) {
      grouped.set(item.part_number, {
        part_number: item.part_number,
        label: variants[item.part_number] || item.product_title,
        stores: [],
        hasAvailable: false,
        quote: item.quote,
      });
    }
    const entry = grouped.get(item.part_number);
    entry.stores.push(item);
    if (item.status === "available") entry.hasAvailable = true;
  });

  return [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function renderPickupResults(pickup, variants) {
  if (!pickup.length) {
    els.pickupResults.innerHTML = '<p class="placeholder">No pickup data returned.</p>';
    return;
  }

  const grouped = groupPickupResults(pickup, variants);
  els.pickupResults.innerHTML = grouped
    .map((entry) => {
      const availableStores = entry.stores.filter((store) => store.status === "available");
      const cardClass = entry.hasAvailable ? "variant-card variant-card--available" : "variant-card";
      const storesHtml = entry.hasAvailable
        ? `<ul class="store-list">${availableStores
            .map(
              (store) =>
                `<li><strong>${store.store_name}</strong> · ${store.city || "HK"} · ${store.store_number}</li>`
            )
            .join("")}</ul>`
        : `<p class="placeholder">${entry.quote || "Currently unavailable"} (${entry.stores.length} store(s))</p>`;

      return `
        <article class="${cardClass}">
          <div class="variant-card__head">
            <div>
              <div class="variant-card__title">${entry.label}</div>
              <div class="variant-card__sku">${entry.part_number}</div>
            </div>
            <span class="${badgeClass(entry.hasAvailable ? "available" : "unavailable")}">
              ${entry.hasAvailable ? "Available" : "Unavailable"}
            </span>
          </div>
          ${storesHtml}
        </article>
      `;
    })
    .join("");
}

function renderDeliveryResults(delivery, variants) {
  if (!delivery.length) {
    els.deliveryResults.innerHTML =
      '<tr><td colspan="4" class="placeholder">No delivery data returned.</td></tr>';
    return;
  }

  els.deliveryResults.innerHTML = delivery
    .map((item) => {
      const label = variants[item.part_number] || item.part_number;
      return `
        <tr>
          <td>${label}</td>
          <td>${item.part_number}</td>
          <td><span class="${badgeClass(item.status)}">${badgeLabel(item.status)}</span></td>
          <td>${item.delivery_date}</td>
        </tr>
      `;
    })
    .join("");
}

function maybeNotifyPickup(pickup) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const availableKeys = new Set(
    pickup
      .filter((item) => item.status === "available")
      .map((item) => `${item.part_number}:${item.store_number}`)
  );

  availableKeys.forEach((key) => {
    if (!state.previousPickupAvailable.has(key)) {
      const item = pickup.find(
        (entry) => `${entry.part_number}:${entry.store_number}` === key
      );
      if (item) {
        new Notification("iPhone 18 Pro Max in stock (HK)", {
          body: `${item.product_title} at ${item.store_name}`,
        });
      }
    }
  });

  state.previousPickupAvailable = availableKeys;
}

async function runCheck() {
  setStatus("loading", "Checking Apple HK…");
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

    els.pickupAvailable.textContent = String(data.summary.pickup_available);
    els.storesChecked.textContent = String(data.summary.stores_checked);
    els.deliveryAvailable.textContent = String(data.summary.delivery_available);
    els.lastChecked.textContent = new Date(data.checked_at).toLocaleString();

    els.pickupMeta.textContent = `${data.summary.pickup_checked} variant(s)`;
    els.deliveryMeta.textContent = `${data.summary.delivery_checked} variant(s)`;

    if (data.errors?.length) {
      els.errorBox.classList.remove("hidden");
      els.errorBox.innerHTML = data.errors.map((err) => `<div>${err.part_number}: ${err.reason}</div>`).join("");
    } else {
      els.errorBox.classList.add("hidden");
      els.errorBox.innerHTML = "";
    }

    renderPickupResults(data.pickup || [], state.catalog.variants);
    renderDeliveryResults(data.delivery || [], state.catalog.variants);
    maybeNotifyPickup(data.pickup || []);

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
  els.watchBtn.textContent = "Start watching";
  els.watchBtn.classList.remove("is-active");
  setStatus("idle", "Ready");
}

function startWatching() {
  const intervalMs = Number(els.intervalRange.value) * 1000;
  state.watching = true;
  els.watchBtn.textContent = "Stop watching";
  els.watchBtn.classList.add("is-active");
  setStatus("watching", "Watching");
  runCheck();
  state.watchTimer = setInterval(runCheck, intervalMs);
}

async function loadCatalog() {
  const response = await fetch("/api/catalog");
  state.catalog = await response.json();

  els.locationSelect.innerHTML = state.catalog.locations
    .map((location) => `<option value="${location}">${location}</option>`)
    .join("");

  els.storeSelect.innerHTML =
    '<option value="">All nearby stores</option>' +
    Object.entries(state.catalog.stores)
      .map(([id, name]) => `<option value="${id}">${name}</option>`)
      .join("");

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
    permission === "granted" ? "Notifications enabled" : "Notifications blocked";
});

loadCatalog().then(() => runCheck());
