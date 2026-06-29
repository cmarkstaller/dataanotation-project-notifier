// ==UserScript==
// @name         DataAnnotation Project Notifier
// @namespace    local.dataannotation.notifier
// @version      1.2.0
// @description  Watches the DataAnnotation Projects dashboard and notifies you via browser + Telegram when a new project appears.
// @match        https://app.dataannotation.tech/workers/projects*
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      api.telegram.org
// @connect      https://api.telegram.org
// ==/UserScript==

(function () {
  "use strict";

  /***********************
   * CONFIG
   ***********************/

  const CONFIG = {
    // Random refresh range.
    minRefreshMs: 5 * 60 * 1000, // 5 minutes
    maxRefreshMs: 10 * 60 * 1000, // 10 minutes

    // Check shortly after page load.
    initialCheckDelayMs: 3_000,

    // Extra delay before deciding whether to schedule refresh.
    dashboardDetectionDelayMs: 5_000,

    // Telegram bot token.
    telegramBotToken: "PASTE_YOUR_BOT_TOKEN_HERE",

    // Telegram chat ID.
    telegramChatId: "PASTE_YOUR_CHAT_ID_HERE",

    // Browser notification fires when a new project appears.
    useBrowserNotification: true,

    // Telegram notification fires when a new project appears.
    useTelegramNotification: true,

    // Ignore obvious non-work items.
    ignoredTitlePatterns: [
      "[Quick Survey]",
      "[CHAT ONLY",
      "[QUALIFICATION]"
    ],

    // First time the script runs, it learns whatever is currently visible.
    autoCreateBaseline: true
  };

  const STORAGE_KEYS = {
    baselineProjects: "da_notifier_baseline_projects_v1",
    lastSeenProjects: "da_notifier_last_seen_projects_v1"
  };

  /***********************
   * MAIN
   ***********************/

  console.log("[DA Notifier] Script loaded.");

  // Check shortly after page load.
  setTimeout(checkDashboard, CONFIG.initialCheckDelayMs);

  // Only schedule random refreshes if this really looks like the projects dashboard.
  setTimeout(() => {
    if (isProjectsDashboardPage()) {
      scheduleRandomRefresh();
    } else {
      console.log("[DA Notifier] Not on dashboard. Auto-refresh disabled on this page.");
    }
  }, CONFIG.dashboardDetectionDelayMs);

  function scheduleRandomRefresh() {
    const delay = randomBetween(CONFIG.minRefreshMs, CONFIG.maxRefreshMs);

    console.log(
      `[DA Notifier] Next refresh in ${(delay / 1000 / 60).toFixed(2)} minutes.`
    );

    setTimeout(() => {
      if (!isProjectsDashboardPage()) {
        console.log("[DA Notifier] Left dashboard or dashboard not detected. Not refreshing.");
        return;
      }

      console.log("[DA Notifier] Checking before refresh...");
      checkDashboard();

      console.log("[DA Notifier] Refreshing dashboard...");
      window.location.reload();
    }, delay);
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /***********************
   * DASHBOARD CHECKING
   ***********************/

  function checkDashboard() {
    if (!isProjectsDashboardPage()) {
      console.log("[DA Notifier] Dashboard not detected. Skipping check.");
      return;
    }

    const currentProjects = getTopProjectsTableProjects();

    if (!currentProjects.length) {
      console.log("[DA Notifier] No project rows found yet.");
      return;
    }

    GM_setValue(STORAGE_KEYS.lastSeenProjects, currentProjects);

    let baseline = GM_getValue(STORAGE_KEYS.baselineProjects, null);

    if (!baseline && CONFIG.autoCreateBaseline) {
      GM_setValue(STORAGE_KEYS.baselineProjects, currentProjects);
      console.log("[DA Notifier] Baseline created:", currentProjects);
      return;
    }

    if (!baseline) {
      console.log("[DA Notifier] No baseline exists yet.");
      return;
    }

    const interestingCurrentProjects = currentProjects.filter(isInterestingProject);

    const baselineNames = baseline.map(project => project.name);

    const newProjects = interestingCurrentProjects.filter(project => {
        return !baselineNames.includes(project.name);
    });

    if (!newProjects.length) {
      console.log("[DA Notifier] No new projects found.");
      return;
    }

    notifyAboutProjects(newProjects);
  }

  function isProjectsDashboardPage() {
    const correctUrl = window.location.href.startsWith(
      "https://app.dataannotation.tech/workers/projects"
    );

    if (!correctUrl) return false;

    const heading = findHeadingByText("Projects");
    if (!heading) return false;

    const table = findNextTableAfterElement(heading);
    if (!table) return false;

    return true;
  }

  /***********************
   * PROJECT EXTRACTION
   ***********************/

  function getTopProjectsTableProjects() {
    const projectsHeading = findHeadingByText("Projects");

    if (!projectsHeading) {
      console.log("[DA Notifier] Could not find Projects heading.");
      return [];
    }

    const table = findNextTableAfterElement(projectsHeading);

    if (!table) {
      console.log("[DA Notifier] Could not find Projects table.");
      return [];
    }

    const rows = Array.from(table.querySelectorAll("tbody tr"));

    const projects = rows
       .map(row => getProjectInfoFromRow(row))
       .filter(Boolean);

    return projects;
  }

  function findHeadingByText(targetText) {
    const possibleHeadings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4")
    );

    return possibleHeadings.find(el => {
      return cleanText(el.textContent) === targetText;
    });
  }

  function findNextTableAfterElement(startElement) {
    let current = startElement;

    while (current) {
      if (current.querySelector) {
        const tableInside = current.querySelector("table");
        if (tableInside) return tableInside;
      }

      current = current.nextElementSibling;

      if (current?.tagName?.toLowerCase() === "table") {
        return current;
      }

      if (current?.querySelector) {
        const table = current.querySelector("table");
        if (table) return table;
      }
    }

    // Fallback: The first table is the Projects table.
    const allTables = Array.from(document.querySelectorAll("table"));
    return allTables[0] || null;
  }

  function getProjectInfoFromRow(row) {
      const cells = Array.from(row.querySelectorAll("td"));

      const nameCell = cells[0];
      const payCell = cells[1];
      const tasksCell = cells[2];

      if (!nameCell) return null;

      const link = nameCell.querySelector("a");

      return {
          name: cleanText(link ? link.textContent : nameCell.textContent),
          pay: cleanText(payCell?.textContent || ""),
          tasks: cleanText(tasksCell?.textContent || "")
      };
  }

  function cleanText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isInterestingProject(project) {
      return !CONFIG.ignoredTitlePatterns.some(pattern => project.name.includes(pattern));
  }

  /***********************
   * NOTIFICATIONS
   ***********************/
  function formatProjectForNotification(project) {
      return [
          project.name,
          project.pay ? `Pay: ${project.pay}` : null,
          project.tasks ? `Tasks: ${project.tasks}` : null
      ].filter(Boolean).join("\n");
  }

  function notifyAboutProjects(projects) {
    const title = "New DataAnnotation project found";

    const message =
        projects.length === 1
           ? formatProjectForNotification(projects[0])
           : `${projects.length} new projects:\n\n` +
              projects.map(formatProjectForNotification).join("\n\n");

    console.log("[DA Notifier] Notifying:", projects);

    if (CONFIG.useBrowserNotification) {
      sendBrowserNotification(title, message);
    }

    if (CONFIG.useTelegramNotification) {
      sendTelegramMessage(`${title}\n\n${message}`);
    }

    // Also make the browser tab obvious.
    document.title = `(${projects.length}) New DA Project!`;
  }

  function sendBrowserNotification(title, text) {
    try {
      GM_notification({
        title,
        text,
        timeout: 10_000,
        onclick: () => {
          window.focus();
        }
      });
    } catch (error) {
      console.error("[DA Notifier] Browser notification failed:", error);
    }
  }

  function sendTelegramMessage(text) {
    const token = CONFIG.telegramBotToken;
    const chatId = CONFIG.telegramChatId;

    if (!token || token.includes("PASTE_") || !chatId || chatId.includes("PASTE_")) {
      console.warn("[DA Notifier] Telegram token/chat ID not configured.");
      return;
    }

    GM_xmlhttpRequest({
      method: "POST",
      url: `https://api.telegram.org/bot${token}/sendMessage`,
      headers: {
        "Content-Type": "application/json"
      },
      data: JSON.stringify({
        chat_id: chatId,
        text
      }),
      onload: response => {
        if (response.status >= 200 && response.status < 300) {
          console.log("[DA Notifier] Telegram message sent.");
        } else {
          console.error("[DA Notifier] Telegram error:", response.status, response.responseText);
        }
      },
      onerror: error => {
        console.error("[DA Notifier] Telegram request failed:", error);
      }
    });
  }

  /***********************
   * MANUAL CONTROLS
   ***********************/

  unsafeWindow.DANotifier = {
    checkNow: checkDashboard,

    showCurrentProjects() {
      const projects = getTopProjectsTableProjects();
      console.log("[DA Notifier] Current projects:", projects);
      return projects;
    },

    setBaselineToCurrent() {
      const projects = getTopProjectsTableProjects();
      GM_setValue(STORAGE_KEYS.baselineProjects, projects);
      console.log("[DA Notifier] Baseline manually set:", projects);
      return projects;
    },

    clearBaseline() {
      GM_setValue(STORAGE_KEYS.baselineProjects, null);
      console.log("[DA Notifier] Baseline cleared.");
    },

    testTelegram() {
      sendTelegramMessage("DataAnnotation notifier test message.");
    },

    testBrowserNotification() {
      sendBrowserNotification(
        "DataAnnotation notifier test",
        "Browser notifications are working."
      );
    },

    showStoredData() {
      const data = {
        baselineProjects: GM_getValue(STORAGE_KEYS.baselineProjects, null),
        lastSeenProjects: GM_getValue(STORAGE_KEYS.lastSeenProjects, [])
      };
      console.log("[DA Notifier] Stored data:", data);
      return data;
    }
  };

})();
