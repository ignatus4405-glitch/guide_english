const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('guideEnglish', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPath: (name) => ipcRenderer.invoke('app:getPath', name),
  isPackaged: () => ipcRenderer.invoke('app:isPackaged'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  quitAndInstall: () => ipcRenderer.invoke('app:quitAndInstall'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  // Store (persistent)
  storeGet: (key, defVal) => ipcRenderer.invoke('store:get', key, defVal),
  storeSet: (key, val) => ipcRenderer.invoke('store:set', key, val),
  storeDelete: (key) => ipcRenderer.invoke('store:delete', key),
  clearProgress: () => ipcRenderer.invoke('store:clearProgress'),

  // Dialog
  showMessage: (opts) => ipcRenderer.invoke('dialog:showMessage', opts),

  // Updater events
  onUpdaterChecking: (cb) => ipcRenderer.on('updater:checking', cb),
  onUpdaterAvailable: (cb) => ipcRenderer.on('updater:available', (_e, info) => cb(info)),
  onUpdaterNotAvailable: (cb) => ipcRenderer.on('updater:not-available', (_e, info) => cb(info)),
  onUpdaterProgress: (cb) => ipcRenderer.on('updater:progress', (_e, prog) => cb(prog)),
  onUpdaterDownloaded: (cb) => ipcRenderer.on('updater:downloaded', (_e, info) => cb(info)),
  onUpdaterError: (cb) => ipcRenderer.on('updater:error', (_e, err) => cb(err)),

  // generic remove listener helper
  removeAll: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Also expose minimal legacy api for compat
contextBridge.exposeInMainWorld('api', {
  getVersion: () => ipcRenderer.invoke('app:getVersion')
});
