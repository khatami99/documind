import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDocument,
  getDocumentStats,
  getSetting,
  initializeDatabase,
  listDocuments,
  setSetting,
  upsertDocuments
} from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supportedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1040,
    minHeight: 720,
    title: 'DocuMind Desktop',
    backgroundColor: '#f7faf9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

async function scanDirectory(directoryPath) {
  const found = [];
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      const nested = await scanDirectory(fullPath);
      found.push(...nested);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!supportedExtensions.has(extension)) {
      continue;
    }

    const stats = await fs.stat(fullPath);
    found.push({
      file_name: entry.name,
      file_path: fullPath,
      file_type: extension.slice(1).toUpperCase(),
      file_size: stats.size,
      created_at: stats.birthtime.toISOString(),
      updated_at: stats.mtime.toISOString()
    });
  }

  return found;
}

app.whenReady().then(async () => {
  await initializeDatabase(app.getPath('userData'));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('folder:pick', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('documents:scan', async (_event, folderPath) => {
  const documents = await scanDirectory(folderPath);
  const indexed = upsertDocuments(documents);
  return {
    folderPath,
    found: documents.length,
    indexed,
    documents: listDocuments()
  };
});

ipcMain.handle('documents:list', (_event, search) => listDocuments(search));
ipcMain.handle('documents:get', (_event, id) => getDocument(id));
ipcMain.handle('documents:stats', () => getDocumentStats());
ipcMain.handle('settings:get', (_event, key) => getSetting(key));
ipcMain.handle('settings:set', (_event, key, value) => setSetting(key, value));
ipcMain.handle('file:show', (_event, filePath) => shell.showItemInFolder(filePath));
