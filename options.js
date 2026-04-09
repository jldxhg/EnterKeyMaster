const { DEFAULT_CONFIG, actionLabels, applyI18n, loadConfig, saveConfig, notifyAllTabs, showToast, printWelcomeMessage } = SharedUtils;

let domainConfigs = {};
let defaultEnabled = true;

document.addEventListener("DOMContentLoaded", async () => {
  applyI18n();
  printWelcomeMessage();
  await loadConfigData();
  renderTable();
  setupEventListeners();
  loadJsonConfig();
});

async function loadConfigData() {
  const result = await loadConfig();
  domainConfigs = result.domainConfigs;
  defaultEnabled = result.defaultEnabled;
  document.getElementById("defaultEnabledToggle").checked = defaultEnabled;
}

function renderTable() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  const domains = Object.keys(domainConfigs).sort((a, b) => {
    if (a === "default") return -1;
    if (b === "default") return 1;
    return a.localeCompare(b);
  });

  domains.forEach((domain) => {
    const config = domainConfigs[domain];
    const isDefault = domain === "default";

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
        <button class="btn-delete" data-domain="${domain}" ${isDefault ? "disabled" : ""}>
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
  document.getElementById("defaultEnabledToggle").addEventListener("change", async (e) => {
    defaultEnabled = e.target.checked;
    await saveConfig({ defaultEnabled });
    renderTable();
    showToast(defaultEnabled
      ? chrome.i18n.getMessage("defaultEnabledAll")
      : chrome.i18n.getMessage("defaultDisabledAll"));
    await notifyAllTabs({ type: "SET_DEFAULT_ENABLED", enabled: defaultEnabled });
  });

  const infoHeader = document.getElementById("infoHeader");
  const infoContent = document.getElementById("infoContent");
  const toggleInfoBtn = document.getElementById("toggleInfoBtn");
  const localEditHeader = document.getElementById("localEditHeader");
  const localEditContent = document.getElementById("localEditContent");
  const toggleEditBtn = document.getElementById("toggleEditBtn");

  infoHeader.addEventListener("click", () => {
    infoContent.classList.toggle("expanded");
    toggleInfoBtn.textContent = infoContent.classList.contains("expanded") ? "▲" : "▼";
  });

  localEditHeader.addEventListener("click", () => {
    localEditContent.classList.toggle("expanded");
    toggleEditBtn.textContent = localEditContent.classList.contains("expanded") ? "▲" : "▼";
  });

  document.getElementById("saveJsonBtn").addEventListener("click", async () => {
    await saveJsonConfig();
  });

  document.getElementById("addDomainBtn").addEventListener("click", () => {
    document.getElementById("addDomainModal").classList.remove("hidden");
    document.getElementById("newDomainInput").value = "";
    document.getElementById("newDomainInput").focus();
  });

  document.getElementById("confirmAddBtn").addEventListener("click", () => {
    addDomain();
  });

  document.getElementById("cancelAddBtn").addEventListener("click", () => {
    document.getElementById("addDomainModal").classList.add("hidden");
  });

  document.getElementById("newDomainInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addDomain();
    }
  });

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
      showToast(enabled
        ? chrome.i18n.getMessage("enabledSite", [domain])
        : chrome.i18n.getMessage("disabledSite", [domain]));
    }
  });

  document.getElementById("tableBody").addEventListener(
    "blur",
    async (e) => {
      if (e.target.classList.contains("selector-input")) {
        const domain = e.target.dataset.domain;
        const newValue = e.target.value.trim();

        if (domainConfigs[domain].selector !== newValue) {
          domainConfigs[domain].selector = newValue;
          await saveAll();
          showToast(chrome.i18n.getMessage("selectorSaved"));
        }
      }
    },
    true
  );

  document.getElementById("tableBody").addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-delete")) {
      const domain = e.target.dataset.domain;
      if (domain === "default") return;

      delete domainConfigs[domain];
      await saveAll();
      renderTable();
      showToast(chrome.i18n.getMessage("configDeleted", [domain]));
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

  domain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

  if (domainConfigs[domain]) {
    alert(chrome.i18n.getMessage("domainExists"));
    return;
  }

  domainConfigs[domain] = domainConfigs.default
    ? { ...domainConfigs.default }
    : { ...DEFAULT_CONFIG };

  await saveAll();
  document.getElementById("addDomainModal").classList.add("hidden");
  renderTable();
  showToast(chrome.i18n.getMessage("siteAdded", [domain]));
}

async function saveAll() {
  await saveConfig({ domainConfigs });
  loadJsonConfig();
}

async function loadJsonConfig() {
  const jsonEditor = document.getElementById("jsonEditor");
  if (jsonEditor) {
    jsonEditor.value = JSON.stringify({ domainConfigs, defaultEnabled }, null, 2);
  }
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
    defaultEnabled = parsedConfig.defaultEnabled !== undefined ? parsedConfig.defaultEnabled : true;

    await saveConfig({ domainConfigs, defaultEnabled });
    renderTable();
    document.getElementById("defaultEnabledToggle").checked = defaultEnabled;
    showToast(chrome.i18n.getMessage("jsonSaved"));
    await notifyAllTabs({ type: "SET_DEFAULT_ENABLED", enabled: defaultEnabled });
  } catch (error) {
    jsonError.textContent = `${chrome.i18n.getMessage("saveFailed")}: ${error.message}`;
    jsonError.classList.remove("hidden");
  }
}
