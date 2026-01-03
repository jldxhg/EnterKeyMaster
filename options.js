const actionLabels = {
  block: chrome.i18n.getMessage("actionBlock"),
  send: chrome.i18n.getMessage("actionSend"),
  addNewline: chrome.i18n.getMessage("actionNewline"),
  default: chrome.i18n.getMessage("actionDefault"),
};

let domainConfigs = {};
let defaultEnabled = true;

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

document.addEventListener("DOMContentLoaded", async () => {
  applyI18n();
  await loadConfig();
  renderTable();
  setupEventListeners();
  loadJsonConfig();
});

async function loadConfig() {
  try {
    const result = await chrome.storage.sync.get([
      "domainConfigs",
      "defaultEnabled",
    ]);

    domainConfigs = result.domainConfigs || {};
    defaultEnabled =
      result.defaultEnabled !== undefined ? result.defaultEnabled : true;

    document.getElementById("defaultEnabledToggle").checked = defaultEnabled;
  } catch (error) {}
}

function renderTable() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  // 排序：default排最前
  const domains = Object.keys(domainConfigs).sort((a, b) => {
    if (a === "default") return -1;
    if (b === "default") return 1;
    return a.localeCompare(b);
  });

  domains.forEach((domain) => {
    const config = domainConfigs[domain];
    const isDefault = domain === "default";

    // 计算域名是否启用
    const isDomainEnabled =
      config.enabled !== null && config.enabled !== undefined
        ? config.enabled
        : defaultEnabled;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <span class="domain-name ${isDefault ? "default" : ""}">${domain}</span>
      </td>
      <td>
        <select class="action-select" data-domain="${domain}" data-key="enter">
          ${renderOptions(config.enter || "addNewline")}
        </select>
      </td>
      <td>
        <select class="action-select" data-domain="${domain}" data-key="ctrlEnter">
          ${renderOptions(config.ctrlEnter || "send")}
        </select>
      </td>
      <td>
        <select class="action-select" data-domain="${domain}" data-key="shiftEnter">
          ${renderOptions(config.shiftEnter || "default")}
        </select>
      </td>
      <td>
        <input type="text" class="selector-input" data-domain="${domain}"
          value="${config.selector || ""}"
          placeholder="${chrome.i18n.getMessage("selectorPlaceholder")}"
          ${isDefault ? "disabled" : ""}>
      </td>
      <td>
        <div class="status-toggle">
          <input type="checkbox" class="domain-toggle" data-domain="${domain}"
            ${isDomainEnabled ? "checked" : ""} ${isDefault ? "disabled" : ""}>
          <span class="status-label ${isDomainEnabled ? "" : "disabled"}">
            ${chrome.i18n.getMessage(isDomainEnabled ? "enabled" : "disabled")}
          </span>
        </div>
      </td>
      <td>
        <button class="btn-delete" data-domain="${domain}" ${
      isDefault ? "disabled" : ""
    }>
          ${chrome.i18n.getMessage("btnDelete")}
        </button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

function renderOptions(selectedValue) {
  return Object.keys(actionLabels)
    .map(
      (action) => `
    <option value="${action}" ${action === selectedValue ? "selected" : ""}>
      ${actionLabels[action]}
    </option>
  `
    )
    .join("");
}

function setupEventListeners() {
  // 默认全局模式开关
  document
    .getElementById("defaultEnabledToggle")
    .addEventListener("change", async (e) => {
      defaultEnabled = e.target.checked;
      await chrome.storage.sync.set({ defaultEnabled });
      renderTable();
      showToast(
        defaultEnabled
          ? chrome.i18n.getMessage("defaultEnabledAll")
          : chrome.i18n.getMessage("defaultDisabledAll")
      );

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
    });

  // 项目信息折叠/展开
  const infoHeader = document.getElementById("infoHeader");
  const infoContent = document.getElementById("infoContent");
  const toggleInfoBtn = document.getElementById("toggleInfoBtn");

  infoHeader.addEventListener("click", () => {
    infoContent.classList.toggle("expanded");
    toggleInfoBtn.textContent = infoContent.classList.contains("expanded")
      ? "▲"
      : "▼";
  });

  // 本地编辑折叠/展开
  const localEditHeader = document.getElementById("localEditHeader");
  const localEditContent = document.getElementById("localEditContent");
  const toggleBtn = document.getElementById("toggleEditBtn");

  localEditHeader.addEventListener("click", () => {
    localEditContent.classList.toggle("expanded");
    toggleBtn.textContent = localEditContent.classList.contains("expanded")
      ? "▲"
      : "▼";
  });

  // 保存JSON配置
  document.getElementById("saveJsonBtn").addEventListener("click", async () => {
    await saveJsonConfig();
  });

  // 添加域名按钮
  document.getElementById("addDomainBtn").addEventListener("click", () => {
    document.getElementById("addDomainModal").classList.remove("hidden");
    document.getElementById("newDomainInput").value = "";
    document.getElementById("newDomainInput").focus();
  });

  // 确认添加
  document.getElementById("confirmAddBtn").addEventListener("click", () => {
    addDomain();
  });

  // 取消添加
  document.getElementById("cancelAddBtn").addEventListener("click", () => {
    document.getElementById("addDomainModal").classList.add("hidden");
  });

  // 回车添加
  document
    .getElementById("newDomainInput")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        addDomain();
      }
    });

  // 事件委托：下拉选择器变化
  document.getElementById("tableBody").addEventListener("change", async (e) => {
    if (e.target.classList.contains("action-select")) {
      const domain = e.target.dataset.domain;
      const key = e.target.dataset.key;
      const value = e.target.value;

      domainConfigs[domain][key] = value;
      await saveAll();
      showToast(chrome.i18n.getMessage("saved"));
    }

    if (e.target.classList.contains("domain-toggle")) {
      const domain = e.target.dataset.domain;
      const enabled = e.target.checked;

      domainConfigs[domain].enabled = enabled;
      await saveAll();
      renderTable();
      showToast(
        enabled
          ? chrome.i18n.getMessage("enabledSite", domain)
          : chrome.i18n.getMessage("disabledSite", domain)
      );
    }
  });

  // 事件委托：选择器输入框失去焦点
  document.getElementById("tableBody").addEventListener(
    "blur",
    async (e) => {
      if (e.target.classList.contains("selector-input")) {
        const domain = e.target.dataset.domain;
        const newValue = e.target.value.trim();

        // 只有真正改变时才保存
        if (domainConfigs[domain].selector !== newValue) {
          domainConfigs[domain].selector = newValue;
          await saveAll();
          showToast(chrome.i18n.getMessage("selectorSaved"));
        }
      }
    },
    true
  );

  // 事件委托：删除按钮
  document.getElementById("tableBody").addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-delete")) {
      const domain = e.target.dataset.domain;
      if (domain === "default") return;

      // 删除域名配置
      delete domainConfigs[domain];

      await saveAll();
      renderTable();
      showToast(chrome.i18n.getMessage("configDeleted", domain));
    }
  });
}

async function addDomain() {
  const input = document.getElementById("newDomainInput");
  let domain = input.value.trim();

  if (!domain) {
    alert(chrome.i18n.getMessage("enterDomain"));
    return;
  }

  domain = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];

  if (domainConfigs[domain]) {
    alert(chrome.i18n.getMessage("domainExists"));
    return;
  }

  // 复制 default 配置
  domainConfigs[domain] = domainConfigs.default
    ? { ...domainConfigs.default }
    : {
        enabled: null,
        selector: "",
        enter: "addNewline",
        ctrlEnter: "send",
        shiftEnter: "default",
      };

  await saveAll();
  document.getElementById("addDomainModal").classList.add("hidden");
  renderTable();
  showToast(chrome.i18n.getMessage("siteAdded", domain));
}

async function saveAll() {
  try {
    await chrome.storage.sync.set({ domainConfigs });
    loadJsonConfig();
  } catch (error) {}
}

function showToast(message) {
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  toastText.textContent = message;

  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

async function loadJsonConfig() {
  try {
    const jsonEditor = document.getElementById("jsonEditor");
    const config = {
      domainConfigs,
      defaultEnabled,
    };
    jsonEditor.value = JSON.stringify(config, null, 2);
  } catch (error) {}
}

function validateJson(jsonString) {
  try {
    JSON.parse(jsonString);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function saveJsonConfig() {
  const jsonEditor = document.getElementById("jsonEditor");
  const jsonError = document.getElementById("jsonError");
  const jsonString = jsonEditor.value.trim();

  jsonError.classList.add("hidden");

  const validation = validateJson(jsonString);
  if (!validation.valid) {
    jsonError.textContent = `${chrome.i18n.getMessage("jsonError")}: ${validation.error}`;
    jsonError.classList.remove("hidden");
    return;
  }

  try {
    const parsedConfig = JSON.parse(jsonString);

    domainConfigs = parsedConfig.domainConfigs || {};
    defaultEnabled =
      parsedConfig.defaultEnabled !== undefined
        ? parsedConfig.defaultEnabled
        : true;

    await chrome.storage.sync.set({
      domainConfigs,
      defaultEnabled,
    });

    renderTable();
    document.getElementById("defaultEnabledToggle").checked = defaultEnabled;

    showToast(chrome.i18n.getMessage("jsonSaved"));

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
  } catch (error) {
    jsonError.textContent = `${chrome.i18n.getMessage("saveFailed")}: ${error.message}`;
    jsonError.classList.remove("hidden");
  }
}