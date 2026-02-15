const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const isDev = !app.isPackaged;
const RECENT_FILES_LIMIT = 10;
const execFileAsync = promisify(execFile);
const SUPPORTED_LOCALES = new Set(["zh-CN", "en-US"]);
let currentLocale = "en-US";

function normalizeLocale(locale) {
  if (typeof locale !== "string") return "en-US";
  const lower = locale.toLowerCase();
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("en")) return "en-US";
  return "en-US";
}

function t(key, vars = {}) {
  const messages = {
    "zh-CN": {
      menuFile: "文件",
      menuEdit: "编辑",
      menuParagraph: "段落",
      menuFormat: "格式",
      menuView: "视图",
      menuHelp: "帮助",
      menuNoRecentFiles: "暂无最近文件",
      menuNew: "新建",
      menuOpen: "打开...",
      menuSave: "保存",
      menuSaveAs: "另存为...",
      menuExportHtml: "导出 HTML",
      menuExportPdf: "导出 PDF",
      menuOpenRecent: "打开最近",
      menuUndo: "撤销",
      menuRedo: "重做",
      menuFind: "查找",
      menuHeading1: "标题 1",
      menuHeading2: "标题 2",
      menuParagraphText: "正文",
      menuBlockquote: "引用",
      menuBold: "加粗",
      menuItalic: "斜体",
      menuInlineCode: "行内代码",
      menuInsertTable: "插入表格",
      menuToggleOutline: "切换大纲",
      menuAbout: "关于 AinoldMarkdown",
      confirmUnsavedTitle: "你有未保存的更改。",
      confirmCloseDetail: "关闭窗口前是否保存？",
      confirmActionDetail: "在{action}前是否保存？",
      buttonSaveAndClose: "保存并关闭",
      buttonCloseWithoutSaving: "不保存并关闭",
      buttonSave: "保存",
      buttonDontSave: "不保存",
      buttonCancel: "取消",
      saveDefaultName: "未命名.md",
      filterMarkdown: "Markdown",
      filterHtml: "HTML",
      filterPdf: "PDF",
      exportTitle: "AinoldMarkdown 导出",
      actionContinue: "继续操作"
    },
    "en-US": {
      menuFile: "File",
      menuEdit: "Edit",
      menuParagraph: "Paragraph",
      menuFormat: "Format",
      menuView: "View",
      menuHelp: "Help",
      menuNoRecentFiles: "No Recent Files",
      menuNew: "New",
      menuOpen: "Open...",
      menuSave: "Save",
      menuSaveAs: "Save As...",
      menuExportHtml: "Export HTML",
      menuExportPdf: "Export PDF",
      menuOpenRecent: "Open Recent",
      menuUndo: "Undo",
      menuRedo: "Redo",
      menuFind: "Find",
      menuHeading1: "Heading 1",
      menuHeading2: "Heading 2",
      menuParagraphText: "Paragraph",
      menuBlockquote: "Blockquote",
      menuBold: "Bold",
      menuItalic: "Italic",
      menuInlineCode: "Inline Code",
      menuInsertTable: "Insert Table",
      menuToggleOutline: "Toggle Outline",
      menuAbout: "About AinoldMarkdown",
      confirmUnsavedTitle: "You have unsaved changes.",
      confirmCloseDetail: "Save before closing this window?",
      confirmActionDetail: "Save before {action}?",
      buttonSaveAndClose: "Save and Close",
      buttonCloseWithoutSaving: "Close Without Saving",
      buttonSave: "Save",
      buttonDontSave: "Don't Save",
      buttonCancel: "Cancel",
      saveDefaultName: "untitled.md",
      filterMarkdown: "Markdown",
      filterHtml: "HTML",
      filterPdf: "PDF",
      exportTitle: "AinoldMarkdown Export",
      actionContinue: "continue"
    }
  };

  const localeKey = SUPPORTED_LOCALES.has(currentLocale) ? currentLocale : "en-US";
  const template = messages[localeKey]?.[key] ?? messages["en-US"][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(vars[name] ?? ""));
}

function getSettingsStorePath() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function readSettings() {
  try {
    const raw = await fs.readFile(getSettingsStorePath(), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

async function writeSettings(partial) {
  const current = await readSettings();
  const next = { ...current, ...partial };
  const storePath = getSettingsStorePath();
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function parseRegProgId(stdout) {
  const match = stdout.match(/ProgId\s+REG_SZ\s+([^\r\n]+)/i);
  if (!match) return null;
  return match[1].trim();
}

function isLikelyAinoldProgId(progId) {
  if (!progId) return false;
  const value = progId.toLowerCase();
  return value.includes("ainold") || value.includes("com.ainold.markdown");
}

async function getMdAssociationStatus() {
  if (process.platform !== "win32") {
    return { status: "unknown", detail: "File association check is only available on Windows." };
  }

  try {
    const userChoice = await execFileAsync("reg", [
      "query",
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.md\\UserChoice",
      "/v",
      "ProgId"
    ]);
    const progId = parseRegProgId(userChoice.stdout);
    if (isLikelyAinoldProgId(progId)) {
      return { status: "associated", detail: `ProgId: ${progId}` };
    }
    if (progId) {
      return { status: "not_associated", detail: `Current ProgId: ${progId}` };
    }
  } catch {
    // Continue to fallback lookup.
  }

  try {
    const classRoot = await execFileAsync("reg", ["query", "HKCR\\.md", "/ve"]);
    const match = classRoot.stdout.match(/REG_SZ\s+([^\r\n]+)/i);
    const progId = match?.[1]?.trim() || null;
    if (isLikelyAinoldProgId(progId)) {
      return { status: "associated", detail: `HKCR ProgId: ${progId}` };
    }
    if (progId) {
      return { status: "not_associated", detail: `HKCR ProgId: ${progId}` };
    }
  } catch {
    // Fall through.
  }

  return { status: "unknown", detail: "Cannot determine .md association from registry." };
}

function getRecentStorePath() {
  return path.join(app.getPath("userData"), "recent-files.json");
}

async function readRecentFiles() {
  try {
    const storePath = getRecentStorePath();
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.files)) return [];
    return parsed.files.filter((filePath) => typeof filePath === "string");
  } catch {
    return [];
  }
}

async function writeRecentFiles(files) {
  const storePath = getRecentStorePath();
  const payload = JSON.stringify({ files }, null, 2);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, payload, "utf8");
}

function sendMenuAction(actionId, payload) {
  const target = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!target) return;
  target.webContents.send("menu:action", { id: actionId, payload });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildExportHtmlDocument(contentHtml, documentTitle) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(documentTitle || "AinoldMarkdown Export")}</title>
    <style>
      body {
        margin: 24px auto;
        max-width: 860px;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: #2f3338;
        line-height: 1.72;
      }
      img { max-width: 100%; }
      pre {
        background: #222831;
        color: #f0f3f6;
        padding: 12px 14px;
        border-radius: 8px;
        overflow: auto;
      }
      code {
        background: #eceff2;
        border-radius: 4px;
        padding: 2px 6px;
      }
      pre code {
        background: transparent;
        padding: 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid #d2d5d9;
        padding: 8px 10px;
      }
      th { background: #eceff2; }

      @media print {
        @page {
          size: A4;
          margin: 16mm 14mm;
        }

        h1, h2, h3, h4 {
          page-break-after: avoid;
          break-after: avoid-page;
        }

        pre, blockquote, table, img {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        p, li {
          orphans: 3;
          widows: 3;
        }
      }
    </style>
  </head>
  <body>
    ${contentHtml}
  </body>
</html>`;
}

async function showSaveDialogWithDefault(defaultPath, filters) {
  const result = await dialog.showSaveDialog({ defaultPath, filters });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
}

async function rebuildAppMenu() {
  const recentFiles = await readRecentFiles();
  const recentSubmenu = recentFiles.length
    ? recentFiles.slice(0, 6).map((filePath) => ({
      label: path.basename(filePath),
      click: () => sendMenuAction("file.openRecent", { path: filePath })
    }))
    : [{ label: t("menuNoRecentFiles"), enabled: false }];

  const template = [
    {
      label: t("menuFile"),
      submenu: [
        { label: t("menuNew"), accelerator: "CmdOrCtrl+N", click: () => sendMenuAction("file.new") },
        { label: t("menuOpen"), accelerator: "CmdOrCtrl+O", click: () => sendMenuAction("file.open") },
        { label: t("menuSave"), accelerator: "CmdOrCtrl+S", click: () => sendMenuAction("file.save") },
        { label: t("menuSaveAs"), accelerator: "CmdOrCtrl+Shift+S", click: () => sendMenuAction("file.saveAs") },
        { type: "separator" },
        { label: t("menuExportHtml"), click: () => sendMenuAction("file.exportHtml") },
        { label: t("menuExportPdf"), click: () => sendMenuAction("file.exportPdf") },
        { type: "separator" },
        { label: t("menuOpenRecent"), submenu: recentSubmenu }
      ]
    },
    {
      label: t("menuEdit"),
      submenu: [
        { label: t("menuUndo"), accelerator: "CmdOrCtrl+Z", click: () => sendMenuAction("edit.undo") },
        { label: t("menuRedo"), accelerator: "CmdOrCtrl+Shift+Z", click: () => sendMenuAction("edit.redo") },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        { label: t("menuFind"), accelerator: "CmdOrCtrl+F", click: () => sendMenuAction("edit.find") }
      ]
    },
    {
      label: t("menuParagraph"),
      submenu: [
        { label: t("menuHeading1"), click: () => sendMenuAction("paragraph.h1") },
        { label: t("menuHeading2"), click: () => sendMenuAction("paragraph.h2") },
        { label: t("menuParagraphText"), click: () => sendMenuAction("paragraph.p") },
        { label: t("menuBlockquote"), click: () => sendMenuAction("paragraph.quote") }
      ]
    },
    {
      label: t("menuFormat"),
      submenu: [
        { label: t("menuBold"), accelerator: "CmdOrCtrl+B", click: () => sendMenuAction("format.bold") },
        { label: t("menuItalic"), accelerator: "CmdOrCtrl+I", click: () => sendMenuAction("format.italic") },
        { label: t("menuInlineCode"), click: () => sendMenuAction("format.code") },
        { type: "separator" },
        { label: t("menuInsertTable"), click: () => sendMenuAction("format.table") }
      ]
    },
    {
      label: t("menuView"),
      submenu: [
        { label: t("menuToggleOutline"), click: () => sendMenuAction("view.toggleOutline") },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: t("menuHelp"),
      submenu: [
        { label: t("menuAbout"), click: () => sendMenuAction("help.about") }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function trackRecentFile(filePath) {
  const current = await readRecentFiles();
  const deduped = [filePath, ...current.filter((item) => item !== filePath)].slice(0, RECENT_FILES_LIMIT);
  await writeRecentFiles(deduped);
  await rebuildAppMenu();
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  let canClose = false;
  win.on("close", async (event) => {
    if (canClose) return;

    event.preventDefault();

    const isDirty = await win.webContents
      .executeJavaScript("window.__AINOLD_IS_DIRTY__ ? window.__AINOLD_IS_DIRTY__() : false", true)
      .catch(() => false);

    if (!isDirty) {
      canClose = true;
      win.close();
      return;
    }

    const answer = await dialog.showMessageBox(win, {
      type: "warning",
      message: t("confirmUnsavedTitle"),
      detail: t("confirmCloseDetail"),
      buttons: [t("buttonSaveAndClose"), t("buttonCloseWithoutSaving"), t("buttonCancel")],
      defaultId: 0,
      cancelId: 2
    });

    if (answer.response === 2) return;

    if (answer.response === 0) {
      const saveSucceeded = await win.webContents
        .executeJavaScript("window.__AINOLD_SAVE_BEFORE_EXIT__ ? window.__AINOLD_SAVE_BEFORE_EXIT__() : false", true)
        .catch(() => false);

      if (!saveSucceeded) return;
    }

    canClose = true;
    win.close();
  });

  if (isDev) {
    await win.loadURL("http://localhost:5173");
  } else {
    await win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function getAssetsDirectory(documentPath) {
  const baseDir = path.dirname(documentPath);
  return path.join(baseDir, "assets");
}

function slugifyFileName(fileName) {
  const ext = path.extname(fileName) || ".png";
  const name = path.basename(fileName, ext);
  const normalized = name.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${normalized || "image"}-${Date.now()}${ext.toLowerCase()}`;
}

ipcMain.handle("file:openMarkdown", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: t("filterMarkdown"), extensions: ["md", "markdown"] }]
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, "utf8");
  await trackRecentFile(filePath);
  return { path: filePath, content };
});

ipcMain.handle("file:openRecentMarkdown", async (_event, payload) => {
  if (!payload?.path) return null;

  const content = await fs.readFile(payload.path, "utf8");
  await trackRecentFile(payload.path);
  return { path: payload.path, content };
});

ipcMain.handle("file:getRecentFiles", async () => {
  return readRecentFiles();
});

ipcMain.handle("app:getInstallOptions", async () => {
  const settings = await readSettings();
  return {
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    installGuideSeen: !!settings.installGuideSeen
  };
});

ipcMain.handle("app:getLocale", async () => {
  return { locale: currentLocale };
});

ipcMain.handle("app:setLocale", async (_event, payload) => {
  const nextLocale = normalizeLocale(payload?.locale);
  currentLocale = nextLocale;
  await writeSettings({ locale: nextLocale });
  await rebuildAppMenu();
  return { locale: nextLocale };
});

ipcMain.handle("app:setOpenAtLogin", async (_event, payload) => {
  const enabled = !!payload?.enabled;
  app.setLoginItemSettings({ openAtLogin: enabled });
  await writeSettings({ openAtLogin: enabled });
  return { openAtLogin: enabled };
});

ipcMain.handle("app:markInstallGuideSeen", async () => {
  await writeSettings({ installGuideSeen: true });
  return { ok: true };
});

ipcMain.handle("app:openDefaultAppsSettings", async () => {
  if (process.platform === "win32") {
    await shell.openExternal("ms-settings:defaultapps");
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle("app:getMdAssociationStatus", async () => {
  return getMdAssociationStatus();
});

ipcMain.handle("app:confirmUnsavedAction", async (_event, payload) => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const actionLabel = payload?.action || t("actionContinue");
  const result = await dialog.showMessageBox(focusedWindow ?? undefined, {
    type: "warning",
    message: t("confirmUnsavedTitle"),
    detail: t("confirmActionDetail", { action: actionLabel }),
    buttons: [t("buttonSave"), t("buttonDontSave"), t("buttonCancel")],
    defaultId: 0,
    cancelId: 2
  });

  if (result.response === 0) return "save";
  if (result.response === 1) return "discard";
  return "cancel";
});

ipcMain.handle("file:saveMarkdown", async (_event, payload) => {
  let targetPath = payload.path;

  if (!targetPath) {
    const result = await dialog.showSaveDialog({
      defaultPath: t("saveDefaultName"),
      filters: [{ name: t("filterMarkdown"), extensions: ["md"] }]
    });

    if (result.canceled || !result.filePath) return null;
    targetPath = result.filePath;
  }

  await fs.writeFile(targetPath, payload.content, "utf8");
  await trackRecentFile(targetPath);
  return { path: targetPath };
});

ipcMain.handle("file:saveMarkdownAs", async (_event, payload) => {
  const defaultPath = payload.currentPath || "untitled.md";
  const targetPath = await showSaveDialogWithDefault(defaultPath, [
    { name: t("filterMarkdown"), extensions: ["md"] }
  ]);
  if (!targetPath) return null;

  await fs.writeFile(targetPath, payload.content, "utf8");
  await trackRecentFile(targetPath);
  return { path: targetPath };
});

ipcMain.handle("export:html", async (_event, payload) => {
  const defaultPath = payload.defaultName || "export.html";
  const targetPath = await showSaveDialogWithDefault(defaultPath, [
    { name: t("filterHtml"), extensions: ["html"] }
  ]);
  if (!targetPath) return null;

  const html = buildExportHtmlDocument(payload.contentHtml || "", payload.documentTitle || t("exportTitle"));
  await fs.writeFile(targetPath, html, "utf8");
  return { path: targetPath };
});

ipcMain.handle("export:pdf", async (_event, payload) => {
  const defaultPath = payload.defaultName || "export.pdf";
  const targetPath = await showSaveDialogWithDefault(defaultPath, [
    { name: t("filterPdf"), extensions: ["pdf"] }
  ]);
  if (!targetPath) return null;

  const documentTitle = payload.documentTitle || t("exportTitle");
  const html = buildExportHtmlDocument(payload.contentHtml || "", documentTitle);
  const printerWindow = new BrowserWindow({ show: false });

  try {
    await printerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await printerWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:9px;width:100%;text-align:center;color:#6b7280;">${escapeHtml(documentTitle)}</div>`,
      footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#6b7280;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margins: {
        top: 0.65,
        bottom: 0.7,
        left: 0.55,
        right: 0.55
      }
    });
    await fs.writeFile(targetPath, pdfBuffer);
    return { path: targetPath };
  } finally {
    if (!printerWindow.isDestroyed()) {
      printerWindow.destroy();
    }
  }
});

ipcMain.handle("file:importImageFile", async (_event, payload) => {
  if (!payload.documentPath) return { error: "UNSAVED_DOCUMENT" };

  const assetsDir = getAssetsDirectory(payload.documentPath);
  await fs.mkdir(assetsDir, { recursive: true });

  const sourceName = path.basename(payload.sourcePath);
  const targetName = slugifyFileName(sourceName);
  const absoluteTargetPath = path.join(assetsDir, targetName);

  await fs.copyFile(payload.sourcePath, absoluteTargetPath);

  return {
    markdownPath: `assets/${targetName}`.replace(/\\/g, "/"),
    absolutePath: absoluteTargetPath
  };
});

ipcMain.handle("file:savePastedImage", async (_event, payload) => {
  if (!payload.documentPath) return { error: "UNSAVED_DOCUMENT" };

  const assetsDir = getAssetsDirectory(payload.documentPath);
  await fs.mkdir(assetsDir, { recursive: true });

  const mimeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(payload.dataUrl || "");
  if (!mimeMatch) return { error: "INVALID_IMAGE_DATA" };

  const mime = mimeMatch[1];
  const base64Data = mimeMatch[2];
  const extensionByMime = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif"
  };
  const ext = extensionByMime[mime] || ".png";
  const baseName = payload.fileName || "pasted-image";
  const targetName = slugifyFileName(`${baseName}${ext}`);
  const absoluteTargetPath = path.join(assetsDir, targetName);

  const buffer = Buffer.from(base64Data, "base64");
  await fs.writeFile(absoluteTargetPath, buffer);

  return {
    markdownPath: `assets/${targetName}`.replace(/\\/g, "/"),
    absolutePath: absoluteTargetPath
  };
});

app.whenReady().then(async () => {
  const settings = await readSettings();
  currentLocale = normalizeLocale(settings.locale || app.getLocale());
  await rebuildAppMenu();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
