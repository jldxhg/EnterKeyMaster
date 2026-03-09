const SharedUtils = (function () {
  const DEFAULT_CONFIG = {
    enabled: null,
    selector: "",
    enter: "addNewline",
    ctrlEnter: "send",
    shiftEnter: "default",
  };

  const actionLabels = {
    block: chrome.i18n.getMessage("actionBlock"),
    send: chrome.i18n.getMessage("actionSend"),
    addNewline: chrome.i18n.getMessage("actionNewline"),
    default: chrome.i18n.getMessage("actionDefault"),
  };

  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const message = chrome.i18n.getMessage(key);
      if (message) {
        el.textContent = message;
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const message = chrome.i18n.getMessage(key);
      if (message) {
        el.placeholder = message;
      }
    });
  }

  async function loadConfig() {
    const result = await chrome.storage.sync.get([
      "domainConfigs",
      "defaultEnabled",
    ]);
    return {
      domainConfigs: result.domainConfigs || {},
      defaultEnabled: result.defaultEnabled !== undefined ? result.defaultEnabled : true,
    };
  }

  async function saveConfig(configs) {
    await chrome.storage.sync.set(configs);
  }

  async function notifyAllTabs(message) {
    const tabs = await chrome.tabs.query({});
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  }

  function showToast(message, duration = 3000) {
    const toast = document.getElementById("toast");
    const toastText = document.getElementById("toastText");
    if (!toast || !toastText) return;
    toastText.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, duration);
  }

  function printWelcomeMessage() {
    const msg = chrome.i18n.getMessage("thanksMessage");
    console.log("EnterKeyMaster: " + msg);
  }

  return {
    DEFAULT_CONFIG,
    actionLabels,
    applyI18n,
    loadConfig,
    saveConfig,
    notifyAllTabs,
    showToast,
    printWelcomeMessage,
  };
})();
