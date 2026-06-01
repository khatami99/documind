import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deleteDocument,
  getDocument,
  getDocumentStats,
  getSetting,
  initializeDatabase,
  listDocuments,
  setSetting,
  updateDocumentMetadata,
  upsertDocuments
} from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const supportedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
const imageMimeTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png']
]);
const maxPreviewBytes = 20 * 1024 * 1024;
const maxPdfPreviewBytes = 35 * 1024 * 1024;

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
ipcMain.handle('documents:updateMetadata', (_event, id, metadata) => updateDocumentMetadata(id, metadata));
ipcMain.handle('documents:delete', (_event, id) => deleteDocument(id));
ipcMain.handle('documents:stats', () => getDocumentStats());
ipcMain.handle('documents:export', async (_event, documents, format) => {
  const normalizedFormat = format === 'csv' ? 'csv' : 'json';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Metadata Dokumen',
    defaultPath: `documind-metadata.${normalizedFormat}`,
    filters: [
      normalizedFormat === 'csv'
        ? { name: 'CSV', extensions: ['csv'] }
        : { name: 'JSON', extensions: ['json'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  const content = normalizedFormat === 'csv'
    ? toCsv(documents)
    : JSON.stringify(documents, null, 2);

  await fs.writeFile(result.filePath, content, 'utf8');
  return { ok: true, filePath: result.filePath };
});
ipcMain.handle('settings:get', (_event, key) => getSetting(key));
ipcMain.handle('settings:set', (_event, key, value) => setSetting(key, value));
ipcMain.handle('file:show', (_event, filePath) => shell.showItemInFolder(filePath));
ipcMain.handle('file:open', async (_event, filePath) => {
  const errorMessage = await shell.openPath(filePath);
  return { ok: !errorMessage, error: errorMessage };
});
ipcMain.handle('file:copyPath', (_event, filePath) => {
  clipboard.writeText(filePath);
  return { ok: true };
});
ipcMain.handle('file:imagePreview', async (_event, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = imageMimeTypes.get(extension);

  if (!mimeType) {
    return null;
  }

  const stats = await fs.stat(filePath);
  if (stats.size > maxPreviewBytes) {
    return {
      error: 'Ukuran gambar terlalu besar untuk preview cepat.'
    };
  }

  const imageBuffer = await fs.readFile(filePath);
  return {
    dataUrl: `data:${mimeType};base64,${imageBuffer.toString('base64')}`
  };
});
ipcMain.handle('file:status', async (_event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      exists: true,
      size: stats.size,
      updated_at: stats.mtime.toISOString()
    };
  } catch {
    return {
      exists: false
    };
  }
});
ipcMain.handle('file:pdfPreview', async (_event, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension !== '.pdf') {
    return null;
  }

  const stats = await fs.stat(filePath);
  if (stats.size > maxPdfPreviewBytes) {
    return {
      error: 'Ukuran PDF terlalu besar untuk preview cepat.'
    };
  }

  const pdfBuffer = await fs.readFile(filePath);
  return {
    dataUrl: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`
  };
});

function toCsv(documents) {
  const columns = [
    'file_name',
    'file_path',
    'file_type',
    'file_size',
    'created_at',
    'updated_at',
    'title',
    'category',
    'tags',
    'extracted_text',
    'ai_summary',
    'document_type',
    'ai_metadata'
  ];

  const rows = documents.map((document) =>
    columns.map((column) => escapeCsvValue(document[column] ?? '')).join(',')
  );

  return [columns.join(','), ...rows].join('\n');
}

function escapeCsvValue(value) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}
