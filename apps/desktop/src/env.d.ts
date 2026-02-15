/// <reference types="vite/client" />

interface OpenResult {
  path: string;
  content: string;
}

interface SaveResult {
  path: string;
}

interface ImageSaveResult {
  markdownPath?: string;
  absolutePath?: string;
  error?: string;
}

interface MenuActionPayload {
  id: string;
  payload?: unknown;
}

declare global {
  interface Window {
    ainold: {
      onMenuAction: (callback: (action: MenuActionPayload) => void) => () => void;
      openMarkdown: () => Promise<OpenResult | null>;
      openRecentMarkdown: (payload: { path: string }) => Promise<OpenResult | null>;
      getRecentFiles: () => Promise<string[]>;
      confirmUnsavedAction: (payload: { action: string }) => Promise<"save" | "discard" | "cancel">;
      getInstallOptions: () => Promise<{ openAtLogin: boolean; installGuideSeen: boolean }>;
      getLocale: () => Promise<{ locale: "zh-CN" | "en-US" }>;
      setLocale: (payload: { locale: "zh-CN" | "en-US" }) => Promise<{ locale: "zh-CN" | "en-US" }>;
      setOpenAtLogin: (payload: { enabled: boolean }) => Promise<{ openAtLogin: boolean }>;
      markInstallGuideSeen: () => Promise<{ ok: boolean }>;
      openDefaultAppsSettings: () => Promise<{ ok: boolean }>;
      getMdAssociationStatus: () => Promise<{ status: "associated" | "not_associated" | "unknown"; detail: string }>;
      saveMarkdown: (payload: { path: string | null; content: string }) => Promise<SaveResult | null>;
      saveMarkdownAs: (payload: { currentPath: string | null; content: string }) => Promise<SaveResult | null>;
      exportHtml: (payload: { defaultName: string; contentHtml: string; documentTitle?: string }) => Promise<{ path: string } | null>;
      exportPdf: (payload: { defaultName: string; contentHtml: string; documentTitle?: string }) => Promise<{ path: string } | null>;
      importImageFile: (payload: { documentPath: string | null; sourcePath: string }) => Promise<ImageSaveResult | null>;
      savePastedImage: (payload: { documentPath: string | null; dataUrl: string; fileName?: string }) => Promise<ImageSaveResult | null>;
    };
    __AINOLD_IS_DIRTY__?: () => boolean;
    __AINOLD_SAVE_BEFORE_EXIT__?: () => Promise<boolean>;
  }
}

export {};
