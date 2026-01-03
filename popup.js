const actionLabels = {
  block: chrome.i18n.getMessage("actionBlock"),
  send: chrome.i18n.getMessage("actionSend"),
  addNewline: chrome.i18n.getMessage("actionNewline"),
  default: chrome.i18n.getMessage("actionDefault"),
};

let currentDomain = "";
let currentConfig = {};
let defaultEnabled = true;
let domainConfigs = {};

document.addEventListener("DOMContentLoaded", async () => {
  applyI18n();
  await loadCurrentDomain();
  await loadConfig();
  setupEventListeners();
});

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const message = chrome.i18n.getMessage(key);
    if (message) {
      el.textContent = message;
    }
  });
}

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

async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get([
      "domainConfigs",
      "defaultEnabled",
    ]);

    domainConfigs = result.domainConfigs || {};
    defaultEnabled =
      result.defaultEnabled !== undefined ? result.defaultEnabled : true;

    // 获取当前域名的配置
    const config = domainConfigs[currentDomain] || domainConfigs.default || {};
    currentConfig = {
      enter: config.enter || "addNewline",
      ctrlEnter: config.ctrlEnter || "send",
      shiftEnter: config.shiftEnter || "default",
    };

    updateUI();
    updateEnableStatus();
  } catch (error) {}
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

function setupEventListeners() {
  // 点击按键项展开/收起
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

  // 选择选项
  document.querySelectorAll(".option").forEach((option) => {
    option.addEventListener("click", async (e) => {
      e.stopPropagation();

      const keyItem = option.closest(".key-item");
      const key = keyItem.dataset.key;
      const action = option.dataset.action;

      currentConfig[key] = action;
      await saveConfig();

      updateUI();

      keyItem.classList.remove("expanded");
      keyItem.querySelector(".key-options").classList.add("hidden");
    });
  });

  // 默认启用/禁用开关
  const defaultToggle = document.getElementById("defaultToggle");
  if (defaultToggle) {
    defaultToggle.addEventListener("change", async (e) => {
      defaultEnabled = e.target.checked;
      await saveDefaultEnabled();
      updateEnableStatus();
    });
  }

  // 域名启用/禁用开关
  const domainToggle = document.getElementById("domainToggle");
  if (domainToggle) {
    domainToggle.addEventListener("change", async (e) => {
      const enabled = e.target.checked;
      await toggleDomainEnabled(enabled);
      updateEnableStatus();
    });
  }

  // 底部按钮
  document.getElementById("settingsBtn")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById("feedbackBtn")?.addEventListener("click", () => {
    chrome.tabs.create({
      url: "https://github.com/jldxhg/EnterKeyMaster",
    });
  });

  // 点击外部关闭展开项
  document.addEventListener("click", () => {
    document.querySelectorAll(".key-item").forEach((item) => {
      item.classList.remove("expanded");
      item.querySelector(".key-options").classList.add("hidden");
    });
  });
}

async function saveConfig() {
  try {
    const result = await chrome.storage.sync.get("domainConfigs");
    const configs = result.domainConfigs || {};

    // 确保当前域名配置存在
    if (!configs[currentDomain]) {
      configs[currentDomain] = configs.default
        ? { ...configs.default }
        : {
            enabled: null,
            selector: "",
            enter: "addNewline",
            ctrlEnter: "send",
            shiftEnter: "default",
          };
    }

    // 更新按键配置
    configs[currentDomain].enter = currentConfig.enter;
    configs[currentDomain].ctrlEnter = currentConfig.ctrlEnter;
    configs[currentDomain].shiftEnter = currentConfig.shiftEnter;

    await chrome.storage.sync.set({ domainConfigs: configs });

    // 同步更新全局变量
    domainConfigs = configs;

    // 通知content script更新
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "CONFIG_UPDATED",
        config: currentConfig,
      });
    }
  } catch (error) {}
}

async function saveDefaultEnabled() {
  try {
    await chrome.storage.sync.set({ defaultEnabled });

    // 通知所有标签页更新状态
    const tabs = await chrome.tabs.query({});
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs
          .sendMessage(tab.id, {
            type: "SET_DEFAULT_ENABLED",
            enabled: defaultEnabled,
          })
          .catch(() => {});
      }
    });
  } catch (error) {}
}

async function toggleDomainEnabled(enabled) {
  try {
    const result = await chrome.storage.sync.get("domainConfigs");
    const configs = result.domainConfigs || {};

    // 确保当前域名配置存在
    if (!configs[currentDomain]) {
      configs[currentDomain] = configs.default
        ? { ...configs.default }
        : {
            enabled: null,
            selector: "",
            enter: "addNewline",
            ctrlEnter: "send",
            shiftEnter: "default",
          };
    }

    // 设置域名启用状态
    configs[currentDomain].enabled = enabled;

    await chrome.storage.sync.set({ domainConfigs: configs });

    // 同步更新全局变量
    domainConfigs = configs;

    // 通知当前标签页更新状态
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      chrome.tabs
        .sendMessage(tab.id, {
          type: "TOGGLE_DOMAIN",
          domain: currentDomain,
          enabled: enabled,
        })
        .catch(() => {});
    }
  } catch (error) {}
}
