const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('documind', {
  isNative: true,
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  scanFolder: (folderPath) => ipcRenderer.invoke('documents:scan', folderPath),
  listDocuments: (search) => ipcRenderer.invoke('documents:list', search),
  getDocument: (id) => ipcRenderer.invoke('documents:get', id),
  getStats: () => ipcRenderer.invoke('documents:stats'),
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  showFile: (filePath) => ipcRenderer.invoke('file:show', filePath)
});
