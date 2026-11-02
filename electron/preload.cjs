const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('insighterDesktop', {
  isDesktopApp: true,
  platform: process.platform,
  toggleNativeFullscreen: () => ipcRenderer.invoke('insighter:toggle-native-fullscreen'),
  hideToMenuBar: () => ipcRenderer.invoke('insighter:hide-to-menubar'),
  getConnectedDisplays: () => ipcRenderer.invoke('insighter:get-displays'),
  moveToDisplay: (displayId) => ipcRenderer.invoke('insighter:move-to-display', displayId),
  loadSourceFromPath: (rawPath) => ipcRenderer.invoke('insighter:load-source-from-path', rawPath),
  extractPdfText: (rawPath) => ipcRenderer.invoke('insighter:extract-pdf-text', rawPath),
  getPathForFile: (file) => {
    try {
      return webUtils && typeof webUtils.getPathForFile === 'function'
        ? webUtils.getPathForFile(file)
        : file?.path || '';
    } catch {
      return file?.path || '';
    }
  },
  onZoomIn: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu-zoom-in', handler);
    return () => ipcRenderer.removeListener('menu-zoom-in', handler);
  },
  onZoomOut: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu-zoom-out', handler);
    return () => ipcRenderer.removeListener('menu-zoom-out', handler);
  },
  onZoomReset: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu-zoom-reset', handler);
    return () => ipcRenderer.removeListener('menu-zoom-reset', handler);
  },
  onZoomFit: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu-zoom-fit', handler);
    return () => ipcRenderer.removeListener('menu-zoom-fit', handler);
  },
  checkForUpdates: (silent = false) => ipcRenderer.invoke('insighter:check-for-updates', silent),
  installUpdate: () => ipcRenderer.invoke('insighter:install-update'),
  getUpdateState: () => ipcRenderer.invoke('insighter:get-update-state'),
  onUpdateStatus: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('insighter:update-status', handler);
    return () => ipcRenderer.removeListener('insighter:update-status', handler);
  },
});
