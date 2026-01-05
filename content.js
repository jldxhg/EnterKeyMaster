// 网站特定适配器

(function () {
  "use strict";

  let suppressHandler = false;

  const FUNCTIONS = {
    simShiftEnter: function (target) {
      // 模拟 Shift+Enter（换行）
      if (suppressHandler) return;
      suppressHandler = true;
      try {
        const init = {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          shiftKey: true, // Shift 键按下
          bubbles: true,
          cancelable: true,
          composed: true,
        };
        target.dispatchEvent(new KeyboardEvent("keydown", init));
        target.dispatchEvent(new KeyboardEvent("keypress", init));
        target.dispatchEvent(new KeyboardEvent("keyup", init));
      } finally {
        suppressHandler = false;
      }
    },

    simEnter: function (target) {
      //  模拟 Enter（发送）
      if (suppressHandler) return;
      suppressHandler = true;
      try {
        const init = {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
          composed: true,
        };
        target.dispatchEvent(new KeyboardEvent("keydown", init));
        target.dispatchEvent(new KeyboardEvent("keypress", init));
        target.dispatchEvent(new KeyboardEvent("keyup", init));
      } finally {
        suppressHandler = false;
      }
    },
  };

  const ADAPTERS = {
    "chatgpt.com": { insertNewline: FUNCTIONS.simShiftEnter },
    "www.qianwen.com": { selector: ".operateBtn-JsB9e2" },
    "chat.deepseek.com": { selector: "._7436101" },
    "github.com": { send: FUNCTIONS.simEnter },
    "chatglm.cn": { send: FUNCTIONS.simEnter },
    "filehelper.weixin.qq.com": { insertNewline: FUNCTIONS.simShiftEnter },
  };

  window.SITE_ADAPTERS = {
    getAdapter: (domain) => ADAPTERS[domain] || null,
    hasAdapter: (domain) => !!ADAPTERS[domain],
    isSuppressed: () => suppressHandler,
  };
})();
const DEFAULT_CONFIG = {
  enabled: null,
  selector: "",
  enter: "addNewline",
  ctrlEnter: "send",
  shiftEnter: "default",
};

let configs = { default: DEFAULT_CONFIG };
let defaultEnabled = true;
let initialized = false;

// 多语言关键词
const keywords = (function () {
  const BASE = ["send", "submit"];
  const MAP = {
    zh: ["发送", "提交"],
    "zh-CN": ["发送", "提交"],
    "zh-TW": ["發送", "提交"],
    ja: ["送信", "送る", "投稿"],
    ko: ["보내기", "전송"],
    es: ["enviar"],
    fr: ["envoyer"],
    de: ["senden"],
    pt: ["enviar"],
    ru: ["отправить"],
    ar: ["إرسال"],
  };
  const lang = chrome.i18n?.getUILanguage() || navigator.language;
  const code = lang.split("-")[0];
  return [...BASE, ...(MAP[lang] || MAP[code] || [])];
})();

// 立即注册监听器
window.addEventListener("keydown", handleEnterKey, {
  capture: true,
  passive: false,
});

// 异步初始化
(async function () {
  try {
    const result = await chrome.storage.sync.get({
      domainConfigs: { default: DEFAULT_CONFIG },
      defaultEnabled: true,
    });
    configs = result.domainConfigs;
    defaultEnabled = result.defaultEnabled;
  } catch (e) {
    configs = { default: DEFAULT_CONFIG };
    defaultEnabled = true;
  } finally {
    initialized = true;
  }
})();

// 核心事件处理

function handleEnterKey(e) {
  if (window.SITE_ADAPTERS?.isSuppressed() || e.key !== "Enter" || !initialized)
    return;

  const target = e.target;
  if (target.tagName !== "TEXTAREA" && !target.isContentEditable) return;

  const domain = window.location.hostname;
  const config = configs[domain] || configs.default;
  const enabled = config.enabled !== null ? config.enabled : defaultEnabled;

  if (!enabled) return;

  let actionType = "enter";
  if (e.ctrlKey || e.metaKey) actionType = "ctrlEnter";
  else if (e.shiftKey) actionType = "shiftEnter";

  const behavior = config[actionType];
  if (behavior === "default") return;

  e.stopImmediatePropagation();
  e.preventDefault();

  if (behavior === "send") {
    const adapter = window.SITE_ADAPTERS?.getAdapter(domain);

    // 优先使用 adapter 的 send 函数（模拟按键发送）
    if (adapter?.send) {
      adapter.send(target);
    } else {
      // 使用 selector 查找按钮点击
      const selector = config.selector || adapter?.selector;
      const button = findSendButton(selector);
      if (button) button.click();
    }
  } else if (behavior === "addNewline") {
    insertNewline(target);
  }
}

// 消息监听

chrome.runtime.onMessage.addListener((msg, _, respond) => {
  const domain = window.location.hostname;

  if (msg.type === "GET_DOMAIN") {
    respond({ domain });
  } else if (msg.type === "CONFIG_UPDATED") {
    if (!configs[domain]) configs[domain] = { ...configs.default };
    Object.assign(configs[domain], msg.config);
    respond({ success: true });
  } else if (msg.type === "SET_DEFAULT_ENABLED") {
    defaultEnabled = msg.enabled;
    respond({ success: true });
  } else if (msg.type === "TOGGLE_DOMAIN") {
    const d = msg.domain || domain;
    if (!configs[d]) configs[d] = { ...configs.default };
    configs[d].enabled = msg.enabled;
    respond({ success: true });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.domainConfigs) configs = changes.domainConfigs.newValue;
  if (changes.defaultEnabled) defaultEnabled = changes.defaultEnabled.newValue;
});

// 工具函数

function insertNewline(target) {
  const domain = window.location.hostname;
  const adapter = window.SITE_ADAPTERS?.getAdapter(domain);

  if (adapter?.insertNewline) {
    adapter.insertNewline(target);
    return;
  }

  if (target.tagName === "TEXTAREA") {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    target.value =
      target.value.substring(0, start) + "\n" + target.value.substring(end);
    target.selectionStart = target.selectionEnd = start + 1;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (target.isContentEditable) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const sent = document.execCommand("insertText", false, "\n");

    if (!sent) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const br = document.createElement("br");
      range.insertNode(br);
      range.setStartAfter(br);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    const opts = { bubbles: true, cancelable: true, composed: true };
    target.dispatchEvent(
      new InputEvent("beforeinput", { ...opts, inputType: "insertLineBreak" })
    );
    target.dispatchEvent(
      new InputEvent("input", { ...opts, inputType: "insertLineBreak" })
    );
  }
}

// 按钮查找

function findSendButton(userSelector) {
  if (userSelector) {
    for (const sel of userSelector.split(",").map((s) => s.trim())) {
      try {
        const el = document.querySelector(sel);
        if (el && isClickable(el)) return el;
      } catch (e) {}
    }
    // return null;
  }

  for (const kw of keywords) {
    const el =
      document.querySelector(`[aria-label*="${kw}" i]`) ||
      document.querySelector(`[data-testid*="${kw}" i]`);
    if (el && isClickable(el)) return el;
  }

  const submit = document.querySelector('button[type="submit"]');
  if (submit && isClickable(submit)) return submit;

  const candidates = collectCandidates();
  if (candidates.length === 0) return null;

  const scored = candidates
    .map((el) => ({ el, score: scoreButton(el) }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].el : null;
}

function collectCandidates() {
  const selectors = [
    'button, input[type="button"], input[type="submit"], [role="button"]',
    'a[class*="send"], a[id*="send"]',
    'div[class*="send"], div[class*="submit"], div[class*="enter"]',
    'div:has(> img[src*="send"]), div:has(> svg)',
  ].join(", ");

  const candidates = [];
  for (const el of document.querySelectorAll(selectors)) {
    if (
      !el.disabled &&
      el.getAttribute("aria-disabled") !== "true" &&
      el.isConnected
    ) {
      const s = getComputedStyle(el);
      if (
        s.display !== "none" &&
        s.visibility !== "hidden" &&
        s.opacity !== "0" &&
        s.pointerEvents !== "none"
      ) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) candidates.push(el);
      }
    }
  }
  return candidates;
}

function isClickable(el) {
  if (!el?.isConnected) return false;
  if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;

  const s = getComputedStyle(el);
  if (
    s.display === "none" ||
    s.visibility === "hidden" ||
    s.opacity === "0" ||
    s.pointerEvents === "none"
  )
    return false;

  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.width <= 200 && r.height <= 200;
}

function scoreButton(el) {
  let score = 0;

  const get = (attr) => (el.getAttribute(attr) || "").toLowerCase();
  const a = {
    ariaLabel: get("aria-label"),
    testId: get("data-testid"),
    test: get("data-test"),
    type: get("type"),
    class: get("class"),
    id: el.id.toLowerCase(),
    text: (el.textContent || "").toLowerCase().trim(),
    html: el.innerHTML.toLowerCase(),
  };

  // 关键词匹配辅助函数
  const matchKeyword = (str, exact, partial) => {
    for (const kw of keywords) {
      if (str === kw) return exact;
      if (str.includes(kw)) return partial;
    }
    return 0;
  };

  // 高分项
  score += matchKeyword(a.ariaLabel, 100, 80);
  score += matchKeyword(a.testId, 90, 70);
  score += matchKeyword(a.test, 90, 70);

  if (a.type === "submit") score += 85;
  else if (a.type === "button") score += 20;

  // 中分项
  for (const kw of keywords) {
    if (a.class.includes(kw) || a.id.includes(kw)) {
      score += 60;
      break;
    }
  }

  if (el.getAttribute("role") === "button") score += 10;

  // 低分项
  score += matchKeyword(a.text, 30, 30);
  score += matchKeyword(a.html, 20, 20);

  // 子元素检查
  for (const child of el.querySelectorAll("*")) {
    const cc = (child.getAttribute("class") || "").toLowerCase();
    if (keywords.some((kw) => cc.includes(kw))) {
      score += 40;
      break;
    }
  }

  // 图片检查
  const img = el.querySelector("img");
  if (img) {
    score += matchKeyword((img.src || "").toLowerCase(), 45, 45);
    score += matchKeyword((img.alt || "").toLowerCase(), 50, 50);
  }

  // SVG 检查
  if (a.html.includes("<svg")) {
    const svg = el.querySelector("svg");
    if (svg) {
      const svgStr = [
        svg.getAttribute("aria-label"),
        svg.getAttribute("title"),
        svg.getAttribute("name"),
        svg.getAttribute("data-icon"),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (keywords.some((kw) => svgStr.includes(kw))) score += 25;
    }

    const use = el.querySelector("use");
    if (use) {
      const href = (
        use.getAttribute("xlink:href") ||
        use.getAttribute("href") ||
        ""
      ).toLowerCase();
      if (keywords.some((kw) => href.includes(kw))) score += 45;
    }
  }

  // 位置加成
  if (el.closest("fieldset, form")) score += 10;
  if (el.parentElement?.querySelector("textarea, input")) score += 15;

  // 标签基础分
  const tag = el.tagName;
  if (tag === "BUTTON") score += 5;
  else if (tag === "INPUT") score += 3;

  return score;
}
