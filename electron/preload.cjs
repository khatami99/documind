const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('documind', {
  isNative: true,
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  scanFolder: (folderPath) => ipcRenderer.invoke('documents:scan', folderPath),
  listDocuments: (search) => ipcRenderer.invoke('documents:list', search),
  getDocument: (id) => ipcRenderer.invoke('documents:get', id),
  updateDocumentMetadata: (id, metadata) => ipcRenderer.invoke('documents:updateMetadata', id, metadata),
  deleteDocument: (id) => ipcRenderer.invoke('documents:delete', id),
  exportDocuments: (documents, format) => ipcRenderer.invoke('documents:export', documents, format),
  getStats: () => ipcRenderer.invoke('documents:stats'),
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  showFile: (filePath) => ipcRenderer.invoke('file:show', filePath),
  openFile: (filePath) => ipcRenderer.invoke('file:open', filePath),
  copyPath: (filePath) => ipcRenderer.invoke('file:copyPath', filePath),
  getFileStatus: (filePath) => ipcRenderer.invoke('file:status', filePath),
  getImagePreview: (filePath) => ipcRenderer.invoke('file:imagePreview', filePath),
  getPdfPreview: (filePath) => ipcRenderer.invoke('file:pdfPreview', filePath)
});
