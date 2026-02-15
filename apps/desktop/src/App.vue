<template>
  <div class="app" :data-theme="resolvedTheme">
    <header class="menu-bar">
      <div class="title">{{ currentPath ? basename(currentPath) : t("untitled") }}</div>
      <div class="toolbar">
        <label class="toolbar-item">
          <span>{{ t("languageLabel") }}</span>
          <select v-model="locale">
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </label>
        <label class="toolbar-item">
          <span>{{ t("themeLabel") }}</span>
          <select v-model="themeMode">
            <option value="system">{{ t("themeSystem") }}</option>
            <option value="light">{{ t("themeLight") }}</option>
            <option value="dark">{{ t("themeDark") }}</option>
          </select>
        </label>
      </div>
      <div class="status">{{ isDirty ? `● ${t("unsaved")} | ${status}` : status }}</div>
    </header>

    <div v-if="showFindBar" class="find-bar">
      <input
        ref="findInputRef"
        v-model="findQuery"
        type="text"
        :placeholder="t('findInDocument')"
        @keydown.enter.prevent="findNext(1)"
      />
      <button @click="findNext(-1)">{{ t("prev") }}</button>
      <button @click="findNext(1)">{{ t("next") }}</button>
      <button @click="closeFindBar">{{ t("close") }}</button>
    </div>

    <div v-if="showInstallGuide" class="install-guide-mask">
      <div class="install-guide-card">
        <h3>{{ t("installSetup") }}</h3>
        <p>{{ t("installSetupHint") }}</p>
        <div class="install-guide-section">
          <div class="install-guide-label">{{ t("startWithWindows") }}</div>
          <div class="install-guide-choice-group">
            <button :class="{ selected: startupChoice === true }" @click="startupChoice = true">{{ t("enable") }}</button>
            <button :class="{ selected: startupChoice === false }" @click="startupChoice = false">{{ t("disable") }}</button>
          </div>
        </div>
        <div class="install-guide-section">
          <div class="install-guide-label">{{ t("setMdDefaultOpener") }}</div>
          <div class="install-guide-hint">{{ t("statusLabel") }}: {{ mdAssociationText }}</div>
          <div class="install-guide-choice-group">
            <button :class="{ selected: mdDefaultChoice === 'set_now' }" @click="chooseSetDefaultNow">{{ t("setNow") }}</button>
            <button :class="{ selected: mdDefaultChoice === 'later' }" @click="mdDefaultChoice = 'later'">{{ t("later") }}</button>
            <button @click="refreshMdAssociationStatus">{{ t("checkStatus") }}</button>
          </div>
        </div>
        <div class="install-guide-actions">
          <button :disabled="!isInstallGuideComplete" @click="applyInstallGuide">{{ t("completeSetup") }}</button>
        </div>
      </div>
    </div>

    <main :class="['workspace', { 'outline-hidden': !showOutline }]">
      <aside class="outline-pane" v-if="showOutline">
        <div class="outline-header">{{ t("outline") }}</div>
        <ul class="outline-list">
          <li v-for="item in outlineItems" :key="item.id">
            <button :class="['outline-item', `level-${item.level}`, { active: item.id === activeOutlineId }]" @click="jumpToHeading(item.pos)">
              {{ item.text }}
            </button>
          </li>
          <li v-if="outlineItems.length === 0" class="outline-empty">{{ t("noHeadings") }}</li>
        </ul>
      </aside>

      <section class="content-pane" @paste="onPaste" @drop="onDrop">
        <EditorContent class="editor-host" :editor="editor" />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { common, createLowlight } from "lowlight";

type OpenResult = { path: string; content: string } | null;
type ImageSaveResult = { markdownPath?: string; absolutePath?: string; error?: string } | null;
type ImageAlign = "left" | "center" | "right";
type ImageWidthPreset = "s" | "m" | "l";
type OutlineItem = { id: string; level: number; text: string; pos: number };
type Match = { from: number; to: number } | null;
type Locale = "zh-CN" | "en-US";
type ThemeMode = "system" | "light" | "dark";

const messages: Record<Locale, Record<string, string>> = {
  "zh-CN": {
    untitled: "未命名.md",
    unsaved: "未保存",
    languageLabel: "语言",
    themeLabel: "主题",
    themeSystem: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
    findInDocument: "在文档中查找",
    prev: "上一个",
    next: "下一个",
    close: "关闭",
    installSetup: "安装引导",
    installSetupHint: "请先各选择一次，再继续。",
    startWithWindows: "开机启动",
    enable: "开启",
    disable: "关闭",
    setMdDefaultOpener: "设置 `.md/.markdown` 默认打开方式",
    statusLabel: "状态",
    setNow: "立即设置",
    later: "稍后",
    checkStatus: "检查状态",
    checkFailed: "检查失败",
    completeSetup: "完成设置",
    outline: "大纲",
    noHeadings: "暂无标题",
    noTitle: "无标题",
    ready: "就绪",
    saveCanceled: "已取消保存",
    autoSaved: "自动保存",
    saved: "已保存",
    saveAsCanceled: "已取消另存为",
    exportHtmlCanceled: "已取消导出 HTML",
    exportedHtml: "已导出 HTML",
    exportPdfCanceled: "已取消导出 PDF",
    exportedPdf: "已导出 PDF",
    associated: "已关联",
    notAssociated: "未关联",
    unknown: "未知",
    openedSystemSettings: "已打开系统默认应用设置",
    setupCompleteStartupEnabled: "设置完成：已开启开机启动",
    setupCompleteStartupDisabled: "设置完成：已关闭开机启动",
    opened: "已打开",
    newDocument: "新建文档",
    openFailed: "打开失败",
    noMatches: "未找到",
    matched: "匹配到",
    saveFirstThenImage: "请先保存 Markdown 文件，再粘贴或拖拽图片。",
    imageImportFailed: "图片导入失败。",
    imageAdded: "已添加图片",
    markdownTablePasted: "已将 Markdown 表格粘贴为表格块",
    aboutText: "AinoldMarkdown：类 Typora 编辑器（Vue + TipTap）",
    startWriting: "开始写作...",
    actionCreatingNewDocument: "新建文档",
    actionOpeningAnotherFile: "打开其他文件",
    actionOpeningAnotherRecentFile: "打开其他最近文件"
  },
  "en-US": {
    untitled: "Untitled.md",
    unsaved: "Unsaved",
    languageLabel: "Language",
    themeLabel: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    findInDocument: "Find in document",
    prev: "Prev",
    next: "Next",
    close: "Close",
    installSetup: "Install Setup",
    installSetupHint: "Select each option once before continuing.",
    startWithWindows: "Start with Windows",
    enable: "Enable",
    disable: "Disable",
    setMdDefaultOpener: "Set `.md/.markdown` as default opener",
    statusLabel: "Status",
    setNow: "Set Now",
    later: "Later",
    checkStatus: "Check Status",
    checkFailed: "Check failed",
    completeSetup: "Complete Setup",
    outline: "Outline",
    noHeadings: "No headings",
    noTitle: "Untitled",
    ready: "Ready",
    saveCanceled: "Save canceled",
    autoSaved: "Auto-saved",
    saved: "Saved",
    saveAsCanceled: "Save As canceled",
    exportHtmlCanceled: "Export HTML canceled",
    exportedHtml: "Exported HTML",
    exportPdfCanceled: "Export PDF canceled",
    exportedPdf: "Exported PDF",
    associated: "Associated",
    notAssociated: "Not Associated",
    unknown: "Unknown",
    openedSystemSettings: "Opened system default apps settings",
    setupCompleteStartupEnabled: "Setup complete: startup enabled",
    setupCompleteStartupDisabled: "Setup complete: startup disabled",
    opened: "Opened",
    newDocument: "New document",
    openFailed: "Open failed",
    noMatches: "No matches",
    matched: "Matched",
    saveFirstThenImage: "Save markdown file first, then paste or drop image.",
    imageImportFailed: "Image import failed.",
    imageAdded: "Image added",
    markdownTablePasted: "Markdown table pasted as table block",
    aboutText: "AinoldMarkdown: Typora-like editor (Vue + TipTap)",
    startWriting: "Start writing...",
    actionCreatingNewDocument: "creating a new document",
    actionOpeningAnotherFile: "opening another file",
    actionOpeningAnotherRecentFile: "opening another recent file"
  }
};

const StyledImage = Image.extend({
  addAttributes() {
    const parentAttributes = this.parent?.() ?? {};
    return {
      ...parentAttributes,
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align || "center" })
      },
      widthPreset: {
        default: "m",
        parseHTML: (element) => element.getAttribute("data-width") || "m",
        renderHTML: (attributes) => ({ "data-width": attributes.widthPreset || "m" })
      }
    };
  }
});

const TyporaTable = Table.extend({
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.commands.goToNextCell()) return true;
        return this.editor.chain().addRowAfter().goToNextCell().run();
      },
      "Shift-Tab": () => this.editor.commands.goToPreviousCell()
    };
  }
});

function basename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

function basenameWithoutExt(filePath: string): string {
  const base = basename(filePath);
  const index = base.lastIndexOf(".");
  return index > 0 ? base.slice(0, index) : base;
}

function looksLikeMarkdownTable(text: string): boolean {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  if (!lines[0].includes("|")) return false;
  const separator = lines[1];
  return /^[:|\-\s]+$/.test(separator) && separator.includes("-");
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

const browserLocale = (navigator.language || "en-US").toLowerCase();
const initialLocale = (localStorage.getItem("ainold.locale") as Locale | null)
  ?? (browserLocale.startsWith("zh") ? "zh-CN" : "en-US");
const storedTheme = localStorage.getItem("ainold.theme");
const locale = ref<Locale>(initialLocale === "zh-CN" ? "zh-CN" : "en-US");
const themeMode = ref<ThemeMode>(
  storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
    ? storedTheme
    : "system"
);
const colorSchemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const systemPrefersDark = ref(colorSchemeMedia.matches);
const resolvedTheme = computed(() => (
  themeMode.value === "system"
    ? (systemPrefersDark.value ? "dark" : "light")
    : themeMode.value
));

function t(key: string): string {
  return messages[locale.value][key] ?? messages["en-US"][key] ?? key;
}

const status = ref(t("ready"));
const isDirty = ref(false);
const showOutline = ref(true);
const showFindBar = ref(false);
const findQuery = ref("");
const showInstallGuide = ref(false);
const startupChoice = ref<boolean | null>(null);
const mdDefaultChoice = ref<"set_now" | "later" | null>(null);
const mdAssociationStatus = ref<"associated" | "not_associated" | "unknown">("unknown");
const mdAssociationDetail = ref("");
const findInputRef = ref<HTMLInputElement | null>(null);
const currentPath = ref<string | null>(null);
const activeOutlineId = ref("");
const outlineItems = ref<OutlineItem[]>([]);
const lowlight = createLowlight(common);
const suppressDirty = ref(false);

const turndown = new TurndownService({ codeBlockStyle: "fenced" });
turndown.use(gfm);

const editor = useEditor({
  extensions: [
    StarterKit.configure({ codeBlock: false }),
    CodeBlockLowlight.configure({ lowlight }),
    TaskList,
    TaskItem.configure({ nested: true }),
    StyledImage,
    TyporaTable.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell
  ],
  content: `<h1>Ainold Markdown</h1><p>${t("startWriting")}</p>`,
  onUpdate: () => {
    if (suppressDirty.value) return;
    isDirty.value = true;
    refreshOutline();
  },
  onSelectionUpdate: () => refreshOutline()
});

function refreshOutline() {
  const instance = editor.value;
  if (!instance) return;

  const selectionPos = instance.state.selection.from;
  const next: OutlineItem[] = [];
  instance.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    next.push({
      id: `${pos}-${node.attrs.level}-${node.textContent}`,
      level: Number(node.attrs.level || 1),
      text: node.textContent?.trim() || t("noTitle"),
      pos
    });
  });

  outlineItems.value = next;
  const active = next.filter((item) => item.pos <= selectionPos).at(-1) ?? next[0];
  activeOutlineId.value = active?.id || "";
}

function setEditorContentSafely(html: string) {
  const instance = editor.value;
  if (!instance) return;
  suppressDirty.value = true;
  instance.commands.setContent(html);
  queueMicrotask(() => {
    suppressDirty.value = false;
    refreshOutline();
  });
}

function buildCurrentExportHtml() {
  const instance = editor.value;
  return instance ? instance.getHTML() : "";
}

function buildCurrentMarkdown() {
  const instance = editor.value;
  return instance ? turndown.turndown(instance.getHTML()) : "";
}

async function handleSave(source: "manual" | "auto" = "manual") {
  const instance = editor.value;
  if (!instance) return false;

  const markdown = turndown.turndown(instance.getHTML());
  const saved = await window.ainold.saveMarkdown({ path: currentPath.value, content: markdown });

  if (!saved) {
    if (source === "manual") status.value = t("saveCanceled");
    return false;
  }

  currentPath.value = saved.path;
  isDirty.value = false;
  status.value = `${source === "auto" ? t("autoSaved") : t("saved")}: ${saved.path}`;
  return true;
}

async function handleSaveAs() {
  const saved = await window.ainold.saveMarkdownAs({
    currentPath: currentPath.value,
    content: buildCurrentMarkdown()
  });
  if (!saved) {
    status.value = t("saveAsCanceled");
    return false;
  }

  currentPath.value = saved.path;
  isDirty.value = false;
  status.value = `${t("saved")}: ${saved.path}`;
  return true;
}

async function handleExportHtml() {
  const baseName = currentPath.value ? basenameWithoutExt(currentPath.value) : "untitled";
  const exported = await window.ainold.exportHtml({
    defaultName: `${baseName}.html`,
    contentHtml: buildCurrentExportHtml(),
    documentTitle: currentPath.value ? basename(currentPath.value) : t("untitled")
  });
  if (!exported) {
    status.value = t("exportHtmlCanceled");
    return;
  }
  status.value = `${t("exportedHtml")}: ${exported.path}`;
}

async function handleExportPdf() {
  const baseName = currentPath.value ? basenameWithoutExt(currentPath.value) : "untitled";
  const exported = await window.ainold.exportPdf({
    defaultName: `${baseName}.pdf`,
    contentHtml: buildCurrentExportHtml(),
    documentTitle: currentPath.value ? basename(currentPath.value) : t("untitled")
  });
  if (!exported) {
    status.value = t("exportPdfCanceled");
    return;
  }
  status.value = `${t("exportedPdf")}: ${exported.path}`;
}

async function loadInstallGuideState() {
  const options = await window.ainold.getInstallOptions().catch(() => ({
    openAtLogin: false,
    installGuideSeen: true
  }));
  startupChoice.value = options.installGuideSeen ? !!options.openAtLogin : null;
  mdDefaultChoice.value = options.installGuideSeen ? "later" : null;
  showInstallGuide.value = !options.installGuideSeen;
  await refreshMdAssociationStatus();
}

const isInstallGuideComplete = computed(() => startupChoice.value !== null && mdDefaultChoice.value !== null);
const mdAssociationText = computed(() => {
  const label = mdAssociationStatus.value === "associated"
    ? t("associated")
    : mdAssociationStatus.value === "not_associated"
      ? t("notAssociated")
      : t("unknown");
  return mdAssociationDetail.value ? `${label} (${mdAssociationDetail.value})` : label;
});

async function refreshMdAssociationStatus() {
  const result = await window.ainold.getMdAssociationStatus().catch(() => ({
    status: "unknown" as const,
    detail: t("checkFailed")
  }));
  mdAssociationStatus.value = result.status;
  mdAssociationDetail.value = result.detail || "";
}

async function chooseSetDefaultNow() {
  mdDefaultChoice.value = "set_now";
  await window.ainold.openDefaultAppsSettings();
  status.value = t("openedSystemSettings");
}

async function applyInstallGuide() {
  if (!isInstallGuideComplete.value) return;
  await window.ainold.setOpenAtLogin({ enabled: !!startupChoice.value });
  await window.ainold.markInstallGuideSeen();
  showInstallGuide.value = false;
  status.value = startupChoice.value ? t("setupCompleteStartupEnabled") : t("setupCompleteStartupDisabled");
}

async function confirmProceedWhenDirty(action: string) {
  if (!isDirty.value) return true;
  const decision = await window.ainold.confirmUnsavedAction({ action });
  if (decision === "save") return handleSave("manual");
  if (decision === "discard") {
    isDirty.value = false;
    return true;
  }
  return false;
}

async function handleOpenResult(result: OpenResult) {
  if (!result) return;
  const html = await marked.parse(result.content);
  setEditorContentSafely(html);
  currentPath.value = result.path;
  isDirty.value = false;
  status.value = `${t("opened")}: ${result.path}`;
}

async function handleNew() {
  const ok = await confirmProceedWhenDirty(t("actionCreatingNewDocument"));
  if (!ok) return;
  setEditorContentSafely("<p></p>");
  currentPath.value = null;
  isDirty.value = false;
  status.value = t("newDocument");
}

async function handleOpen() {
  const ok = await confirmProceedWhenDirty(t("actionOpeningAnotherFile"));
  if (!ok) return;
  await handleOpenResult(await window.ainold.openMarkdown());
}

async function handleOpenRecent(filePath: string) {
  const ok = await confirmProceedWhenDirty(t("actionOpeningAnotherRecentFile"));
  if (!ok) return;
  const result = await window.ainold.openRecentMarkdown({ path: filePath }).catch(() => null);
  if (!result) {
    status.value = `${t("openFailed")}: ${filePath}`;
    return;
  }
  await handleOpenResult(result);
}

function runEditorCommand(action: () => void) {
  if (!editor.value) return;
  action();
}

function openFindBar() {
  showFindBar.value = true;
  nextTick(() => {
    findInputRef.value?.focus();
    findInputRef.value?.select();
  });
}

function closeFindBar() {
  showFindBar.value = false;
}

function findNext(direction: 1 | -1) {
  const term = findQuery.value.trim();
  if (!term) return;

  const instance = editor.value;
  if (!instance) return;

  const normalized = term.toLowerCase();
  const fromPos = direction > 0 ? instance.state.selection.to : instance.state.selection.from;
  let firstMatch: Match = null;
  let nextMatch: Match = null;

  instance.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const textLower = node.text.toLowerCase();
    const allMatches: number[] = [];
    let start = 0;
    while (start <= textLower.length) {
      const idx = textLower.indexOf(normalized, start);
      if (idx < 0) break;
      allMatches.push(idx);
      start = idx + Math.max(1, normalized.length);
    }
    if (!allMatches.length) return;

    if (!firstMatch) {
      const idx = direction > 0 ? allMatches[0] : allMatches[allMatches.length - 1];
      firstMatch = { from: pos + idx, to: pos + idx + term.length };
    }

    const targetIndex = direction > 0
      ? allMatches.find((idx) => pos + idx >= fromPos)
      : [...allMatches].reverse().find((idx) => pos + idx < fromPos);

    if (targetIndex !== undefined && !nextMatch) {
      nextMatch = { from: pos + targetIndex, to: pos + targetIndex + term.length };
    }
  });

  const target = nextMatch ?? firstMatch;
  if (!target) {
    status.value = `${t("noMatches")}: ${term}`;
    return;
  }

  instance.chain().focus().setTextSelection(target).scrollIntoView().run();
  status.value = `${t("matched")}: ${term}`;
}

function jumpToHeading(pos: number) {
  const instance = editor.value;
  if (!instance) return;
  instance.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
  refreshOutline();
}

function insertImageByMarkdownPath(markdownPath: string) {
  const instance = editor.value;
  if (!instance) return;
  instance.chain().focus().setImage({
    src: markdownPath,
    align: "center" as ImageAlign,
    widthPreset: "m" as ImageWidthPreset
  }).run();
}

function handleImageSaveResult(result: ImageSaveResult) {
  if (!result) return;
  if (result.error === "UNSAVED_DOCUMENT") {
    status.value = t("saveFirstThenImage");
    return;
  }
  if (result.error || !result.markdownPath) {
    status.value = t("imageImportFailed");
    return;
  }

  insertImageByMarkdownPath(result.markdownPath);
  status.value = `${t("imageAdded")}: ${result.markdownPath}`;
}

async function handlePasteImage(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files || []);
  const imageFile = files.find((file) => file.type.startsWith("image/"));
  if (!imageFile) return false;

  event.preventDefault();
  const dataUrl = await fileToDataUrl(imageFile);
  handleImageSaveResult(await window.ainold.savePastedImage({
    documentPath: currentPath.value,
    dataUrl,
    fileName: "pasted-image"
  }));
  return true;
}

async function handlePasteMarkdownTable(event: ClipboardEvent) {
  const instance = editor.value;
  if (!instance) return false;

  const text = event.clipboardData?.getData("text/plain") || "";
  if (!looksLikeMarkdownTable(text)) return false;

  event.preventDefault();
  const html = await marked.parse(text);
  instance.chain().focus().insertContent(html).run();
  status.value = t("markdownTablePasted");
  return true;
}

async function onPaste(event: ClipboardEvent) {
  if (await handlePasteImage(event)) return;
  await handlePasteMarkdownTable(event);
}

async function onDrop(event: DragEvent) {
  const files = Array.from(event.dataTransfer?.files || []);
  const imageFile = files.find((file) => file.type.startsWith("image/"));
  if (!imageFile) return;

  event.preventDefault();

  const electronPath = (imageFile as File & { path?: string }).path;
  if (electronPath) {
    handleImageSaveResult(await window.ainold.importImageFile({
      documentPath: currentPath.value,
      sourcePath: electronPath
    }));
    return;
  }

  const dataUrl = await fileToDataUrl(imageFile);
  handleImageSaveResult(await window.ainold.savePastedImage({
    documentPath: currentPath.value,
    dataUrl,
    fileName: imageFile.name || "dropped-image"
  }));
}

function executeMenuAction(action: MenuActionPayload) {
  const id = action?.id;
  switch (id) {
    case "file.new":
      void handleNew();
      return;
    case "file.open":
      void handleOpen();
      return;
    case "file.save":
      void handleSave("manual");
      return;
    case "file.saveAs":
      void handleSaveAs();
      return;
    case "file.exportHtml":
      void handleExportHtml();
      return;
    case "file.exportPdf":
      void handleExportPdf();
      return;
    case "file.openRecent": {
      const filePath = (action.payload as { path?: string })?.path;
      if (filePath) void handleOpenRecent(filePath);
      return;
    }
    case "edit.undo":
      runEditorCommand(() => { editor.value?.chain().focus().undo().run(); });
      return;
    case "edit.redo":
      runEditorCommand(() => { editor.value?.chain().focus().redo().run(); });
      return;
    case "edit.find":
      openFindBar();
      return;
    case "paragraph.h1":
      runEditorCommand(() => { editor.value?.chain().focus().setHeading({ level: 1 }).run(); });
      return;
    case "paragraph.h2":
      runEditorCommand(() => { editor.value?.chain().focus().setHeading({ level: 2 }).run(); });
      return;
    case "paragraph.p":
      runEditorCommand(() => { editor.value?.chain().focus().setParagraph().run(); });
      return;
    case "paragraph.quote":
      runEditorCommand(() => { editor.value?.chain().focus().toggleBlockquote().run(); });
      return;
    case "format.bold":
      runEditorCommand(() => { editor.value?.chain().focus().toggleBold().run(); });
      return;
    case "format.italic":
      runEditorCommand(() => { editor.value?.chain().focus().toggleItalic().run(); });
      return;
    case "format.code":
      runEditorCommand(() => { editor.value?.chain().focus().toggleCode().run(); });
      return;
    case "format.table":
      runEditorCommand(() => { editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); });
      return;
    case "view.toggleOutline":
      showOutline.value = !showOutline.value;
      return;
    case "help.about":
      status.value = t("aboutText");
      return;
    default:
      return;
  }
}

function onKeyDown(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "s") {
    event.preventDefault();
    void handleSave("manual");
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "f") {
    event.preventDefault();
    openFindBar();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "o") {
    event.preventDefault();
    void handleOpen();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && key === "n") {
    event.preventDefault();
    void handleNew();
    return;
  }

  if (key === "escape" && showFindBar.value) {
    closeFindBar();
  }
}

let disposeMenuActionListener: (() => void) | null = null;
const onColorSchemeChange = (event: MediaQueryListEvent) => {
  systemPrefersDark.value = event.matches;
};

onMounted(() => {
  refreshOutline();
  void loadInstallGuideState();
  void window.ainold.getLocale().then(({ locale: mainLocale }) => {
    if (mainLocale === "zh-CN" || mainLocale === "en-US") {
      locale.value = mainLocale;
    }
  }).catch(() => undefined);
  window.addEventListener("keydown", onKeyDown);
  colorSchemeMedia.addEventListener("change", onColorSchemeChange);
  disposeMenuActionListener = window.ainold.onMenuAction((action) => executeMenuAction(action));
  document.documentElement.lang = locale.value;

  window.__AINOLD_IS_DIRTY__ = () => isDirty.value;
  window.__AINOLD_SAVE_BEFORE_EXIT__ = async () => handleSave("manual");
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  colorSchemeMedia.removeEventListener("change", onColorSchemeChange);
  disposeMenuActionListener?.();
  disposeMenuActionListener = null;
  delete window.__AINOLD_IS_DIRTY__;
  delete window.__AINOLD_SAVE_BEFORE_EXIT__;
});

watch(locale, (next) => {
  localStorage.setItem("ainold.locale", next);
  document.documentElement.lang = next;
  void window.ainold.setLocale({ locale: next });
});

watch(themeMode, (next) => {
  localStorage.setItem("ainold.theme", next);
});

watch([isDirty, currentPath], ([dirty, filePath], _oldValue, onCleanup) => {
  if (!dirty || !filePath) return;

  const timer = window.setTimeout(() => {
    if (isDirty.value && currentPath.value) {
      void handleSave("auto");
    }
  }, 1600);

  onCleanup(() => {
    window.clearTimeout(timer);
  });
});
</script>
