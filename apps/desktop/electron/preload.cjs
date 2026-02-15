const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ainold", {
  onMenuAction: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("menu:action", handler);
    return () => ipcRenderer.removeListener("menu:action", handler);
  },
  openMarkdown: () => ipcRenderer.invoke("file:openMarkdown"),
  openRecentMarkdown: (payload) => ipcRenderer.invoke("file:openRecentMarkdown", payload),
  getRecentFiles: () => ipcRenderer.invoke("file:getRecentFiles"),
  confirmUnsavedAction: (payload) => ipcRenderer.invoke("app:confirmUnsavedAction", payload),
  getInstallOptions: () => ipcRenderer.invoke("app:getInstallOptions"),
  getLocale: () => ipcRenderer.invoke("app:getLocale"),
  setLocale: (payload) => ipcRenderer.invoke("app:setLocale", payload),
  setOpenAtLogin: (payload) => ipcRenderer.invoke("app:setOpenAtLogin", payload),
  markInstallGuideSeen: () => ipcRenderer.invoke("app:markInstallGuideSeen"),
  openDefaultAppsSettings: () => ipcRenderer.invoke("app:openDefaultAppsSettings"),
  getMdAssociationStatus: () => ipcRenderer.invoke("app:getMdAssociationStatus"),
  saveMarkdown: (payload) => ipcRenderer.invoke("file:saveMarkdown", payload),
  saveMarkdownAs: (payload) => ipcRenderer.invoke("file:saveMarkdownAs", payload),
  exportHtml: (payload) => ipcRenderer.invoke("export:html", payload),
  exportPdf: (payload) => ipcRenderer.invoke("export:pdf", payload),
  importImageFile: (payload) => ipcRenderer.invoke("file:importImageFile", payload),
  savePastedImage: (payload) => ipcRenderer.invoke("file:savePastedImage", payload)
});
