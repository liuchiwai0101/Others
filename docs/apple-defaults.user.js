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

  function tick() {
    pick('[data-autom="choose-noTradeIn"]');
    const pay = document.querySelector('input[name="purchaseOption"][value="fullPrice"]');
    if (pay && pay.type === "radio" && !pay.checked && !pay.disabled) pay.click();
    pick('[data-autom="noapplecare"]');
  }

  tick();
  let n = 0;
  const id = setInterval(() => {
    tick();
    if (++n > 80) clearInterval(id);
  }, 250);
})();
