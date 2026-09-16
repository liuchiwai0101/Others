// ==UserScript==
// @name         Apple HK — No trade-in / No AppleCare+
// @namespace    iphone-hk-stock
// @match        https://www.apple.com/hk/shop/buy-iphone/*
// @match        https://www.apple.com/hk-zh/shop/buy-iphone/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  function pick(selector) {
    const el = document.querySelector(selector);
    if (!el || el.disabled) return !!(el && el.checked);
    if (!el.checked) el.click();
    return true;
  }

  function done() {
    const trade = document.querySelector('[data-autom="choose-noTradeIn"]');
    const care = document.querySelector('[data-autom="noapplecare"]');
    return !!(trade && trade.checked && care && care.checked);
  }

  function tick() {
    pick('[data-autom="choose-noTradeIn"]');
    const pay = document.querySelector('input[name="purchaseOption"][value="fullPrice"]');
    if (pay && pay.type === "radio" && !pay.checked && !pay.disabled) pay.click();
    pick('[data-autom="noapplecare"]');
    return done();
  }

  if (tick()) return;
  let n = 0;
  const id = setInterval(() => {
    if (tick() || ++n > 80) clearInterval(id);
  }, 250);
  if (window.MutationObserver && document.documentElement) {
    const mo = new MutationObserver(() => tick());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 20000);
  }
})();
