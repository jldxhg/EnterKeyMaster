const { DEFAULT_CONFIG, actionLabels, applyI18n, loadConfig, saveConfig, notifyAllTabs, showToast, printWelcomeMessage } = SharedUtils;

let currentDomain = "";
let currentConfig = {};
let defaultEnabled = true;
let domainConfigs = {};

document.addEventListener("DOMContentLoaded", async () => {
  applyI18n();
  printWelcomeMessage();
  await loadCurrentDomain();
  await loadConfigData();
  setupEventListeners();
});

async function loadCurrentDomain() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab?.id) {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "GET_DOMAIN",
      });
      if (response?.domain) {
        currentDomain = response.domain;
        document.getElementById("currentDomain").textContent = currentDomain;
      } else {
        document.getElementById("currentDomain").textContent =
          chrome.i18n.getMessage("cannotGetDomain");
      }
    } else {
      document.getElementById("currentDomain").textContent =
        chrome.i18n.getMessage("noTab");
    }
  } catch (error) {
    document.getElementById("currentDomain").textContent =
      chrome.i18n.getMessage("unknownDomain");
  }
}

async function loadConfigData() {
  const result = await loadConfig();
  domainConfigs = result.domainConfigs;
  defaultEnabled = result.defaultEnabled;

  const config = domainConfigs[currentDomain] || domainConfigs.default || {};
  currentConfig = {
    enter: config.enter || "addNewline",
    ctrlEnter: config.ctrlEnter || "send",
    shiftEnter: config.shiftEnter || "default",
  };

  updateUI();
  updateEnableStatus();
}

function updateUI() {
  Object.keys(currentConfig).forEach((key) => {
    const action = currentConfig[key];
    const label = actionLabels[action] || action;
    const element = document.getElementById(`current-${key}`);
    if (element) {
      element.textContent = label;
    }

    const keyItem = document.querySelector(`.key-item[data-key="${key}"]`);
    if (keyItem) {
      keyItem.querySelectorAll(".option").forEach((option) => {
        option.classList.toggle("selected", option.dataset.action === action);
      });
    }
  });
}

function updateEnableStatus() {
  const defaultToggle = document.getElementById("defaultToggle");
  const domainToggle = document.getElementById("domainToggle");
  const configSection = document.querySelector(".config-section");

  if (defaultToggle) {
    defaultToggle.checked = defaultEnabled;
  }

  const config = domainConfigs[currentDomain] || domainConfigs.default || {};
  const isDomainEnabled =
    config.enabled !== null && config.enabled !== undefined
      ? config.enabled
      : defaultEnabled;

  if (domainToggle) {
    domainToggle.checked = isDomainEnabled;
  }

  if (configSection) {
    configSection.style.opacity = isDomainEnabled ? "1" : "0.5";
    configSection.style.pointerEvents = isDomainEnabled ? "auto" : "none";
  }

  updateStatusIndicator(isDomainEnabled);
}

function updateStatusIndicator(isActive) {
  const indicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");

  if (indicator && statusText) {
    if (isActive) {
      indicator.className = "status-indicator active";
      statusText.textContent = chrome.i18n.getMessage("enabled");
    } else {
      indicator.className = "status-indicator inactive";
      statusText.textContent = chrome.i18n.getMessage("disabled");
    }
  }
}

async function saveConfigData() {
  const config = domainConfigs[currentDomain] || { ...DEFAULT_CONFIG };
  domainConfigs[currentDomain] = { ...config, ...currentConfig };
  await saveConfig({ domainConfigs, defaultEnabled });
}

async function saveDefaultEnabled() {
  await saveConfig({ defaultEnabled });
  await notifyAllTabs({ type: "SET_DEFAULT_ENABLED", enabled: defaultEnabled });
}

async function toggleDomainEnabled(enabled) {
  if (!domainConfigs[currentDomain]) {
    domainConfigs[currentDomain] = { ...DEFAULT_CONFIG };
  }
  domainConfigs[currentDomain].enabled = enabled;
  await saveConfig({ domainConfigs });
  await notifyAllTabs({ type: "TOGGLE_DOMAIN", domain: currentDomain, enabled });
}

function setupEventListeners() {
  document.querySelectorAll(".key-item").forEach((item) => {
    const label = item.querySelector(".key-label");
    const options = item.querySelector(".key-options");

    label.addEventListener("click", (e) => {
      e.stopPropagation();

      document.querySelectorAll(".key-item").forEach((other) => {
        if (other !== item) {
          other.classList.remove("expanded");
          other.querySelector(".key-options").classList.add("hidden");
        }
      });

      item.classList.toggle("expanded");
      options.classList.toggle("hidden");
    });
  });

  document.querySelectorAll(".option").forEach((option) => {
    option.addEventListener("click", async (e) => {
      e.stopPropagation();

      const keyItem = option.closest(".key-item");
      const key = keyItem.dataset.key;
      const action = option.dataset.action;

      currentConfig[key] = action;
      await saveConfigData();

      updateUI();

      keyItem.classList.remove("expanded");
      keyItem.querySelector(".key-options").classList.add("hidden");
    });
  });

  const defaultToggle = document.getElementById("defaultToggle");
  if (defaultToggle) {
    defaultToggle.addEventListener("change", async (e) => {
      defaultEnabled = e.target.checked;
      await saveDefaultEnabled();
      updateEnableStatus();
    });
  }

  const domainToggle = document.getElementById("domainToggle");
  if (domainToggle) {
    domainToggle.addEventListener("change", async (e) => {
      const enabled = e.target.checked;
      await toggleDomainEnabled(enabled);
      updateEnableStatus();
    });
  }

  document.getElementById("settingsBtn")?.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  });

  document.getElementById("feedbackBtn")?.addEventListener("click", () => {
    window.open("https://github.com/jldxhg/EnterKeyMaster/issues", "_blank");
  });
}
