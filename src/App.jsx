import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Archive,
  Bot,
  Clipboard,
  Database,
  Download,
  Edit3,
  ExternalLink,
  FileImage,
  FileText,
  FolderOpen,
  Home,
  KeyRound,
  Loader2,
  Moon,
  RotateCw,
  Search,
  Save,
  Settings,
  Sparkles,
  Sun,
  Tags,
  Trash2,
  X
} from 'lucide-react';

const api = window.documind ?? createBrowserFallback();
const isNativeRuntime = Boolean(window.documind?.isNative);

const navItems = [
  { id: 'home', label: 'Beranda', icon: Home },
  { id: 'scan', label: 'Pindai Folder', icon: FolderOpen },
  { id: 'library', label: 'Perpustakaan Dokumen', icon: Archive },
  { id: 'settings', label: 'Pengaturan', icon: Settings }
];

const quickCategories = ['Keuangan', 'Legal', 'Pribadi', 'Pekerjaan', 'Pendidikan', 'Kesehatan', 'Lainnya'];

function App() {
  const [activePage, setActivePage] = useState('home');
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [search, setSearch] = useState('');
  const [recentFolders, setRecentFolders] = useState([]);
  const [theme, setTheme] = useState('light');
  const [stats, setStats] = useState({ total_documents: 0, total_size: 0, types: [] });
  const [scanState, setScanState] = useState({ status: 'idle', message: '' });

  async function refreshDocuments(nextSearch = search) {
    const [nextDocuments, nextStats] = await Promise.all([
      api.listDocuments(nextSearch),
      api.getStats()
    ]);
    setDocuments(nextDocuments);
    setStats(nextStats);
    if (!selectedDocumentId && nextDocuments.length > 0) {
      setSelectedDocumentId(nextDocuments[0].id);
    }
  }

  useEffect(() => {
    refreshDocuments();
    api.getSetting('last_scanned_folder').then((folder) => {
      if (folder) {
        setSelectedFolder(folder);
      }
    });
    api.getSetting('recent_folders').then((value) => {
      setRecentFolders(parseRecentFolders(value));
    });
    api.getSetting('theme').then((value) => {
      if (value === 'dark' || value === 'light') {
        setTheme(value);
      }
    });
  }, []);

  async function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    await api.setSetting('theme', nextTheme);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => refreshDocuments(search), 180);
    return () => window.clearTimeout(timeout);
  }, [search]);

  async function handlePickFolder() {
    if (!isNativeRuntime) {
      setScanState({
        status: 'error',
        message: 'Folder picker hanya tersedia saat aplikasi dibuka lewat Electron.'
      });
      setActivePage('scan');
      return;
    }

    const folder = await api.pickFolder();
    if (folder) {
      setSelectedFolder(folder);
      await rememberFolder(folder);
      setActivePage('scan');
    }
  }

  async function rememberFolder(folder) {
    const nextFolders = [folder, ...recentFolders.filter((item) => item !== folder)].slice(0, 5);
    setRecentFolders(nextFolders);
    await Promise.all([
      api.setSetting('last_scanned_folder', folder),
      api.setSetting('recent_folders', JSON.stringify(nextFolders))
    ]);
  }

  async function handleSelectRecentFolder(folder) {
    setSelectedFolder(folder);
    await rememberFolder(folder);
    setActivePage('scan');
  }

  async function handleScan() {
    if (!selectedFolder) {
      setScanState({ status: 'error', message: 'Pilih folder terlebih dahulu.' });
      return;
    }

    setScanState({ status: 'loading', message: 'Memindai dokumen lokal...' });
    try {
      const result = await api.scanFolder(selectedFolder);
      await rememberFolder(selectedFolder);
      setDocuments(result.documents);
      setSelectedDocumentId(result.documents[0]?.id ?? null);
      await refreshDocuments();
      setScanState({
        status: 'success',
        message: `${result.indexed} dokumen berhasil diindeks dari folder pilihan.`
      });
    } catch (error) {
      setScanState({
        status: 'error',
        message: error.message ?? 'Pemindaian gagal. Periksa izin folder.'
      });
    }
  }

  async function handleSaveDocumentMetadata(documentId, metadata) {
    const updatedDocument = await api.updateDocumentMetadata(documentId, metadata);
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) => (document.id === updatedDocument.id ? updatedDocument : document))
    );
    setSelectedDocumentId(updatedDocument.id);
    await refreshDocuments();
    return updatedDocument;
  }

  async function handleDeleteDocument(documentId) {
    await api.deleteDocument(documentId);
    const [nextDocuments, nextStats] = await Promise.all([
      api.listDocuments(search),
      api.getStats()
    ]);
    setDocuments(nextDocuments);
    setStats(nextStats);
    setSelectedDocumentId(nextDocuments[0]?.id ?? null);
  }

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? documents[0],
    [documents, selectedDocumentId]
  );

  return (
    <div className={`min-h-screen bg-mist text-ink ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className="min-w-0 px-8 py-6">
          <Header theme={theme} onToggleTheme={toggleTheme} onPickFolder={handlePickFolder} />

          {activePage === 'home' && (
            <HomePage
              documents={documents}
              stats={stats}
              selectedFolder={selectedFolder}
              onPickFolder={handlePickFolder}
              onScan={handleScan}
              onOpenLibrary={() => setActivePage('library')}
            />
          )}

          {activePage === 'scan' && (
            <ScanPage
              selectedFolder={selectedFolder}
              recentFolders={recentFolders}
              scanState={scanState}
              onPickFolder={handlePickFolder}
              onSelectRecentFolder={handleSelectRecentFolder}
              onScan={handleScan}
            />
          )}

          {activePage === 'library' && (
            <LibraryPage
              documents={documents}
              search={search}
              selectedDocument={selectedDocument}
              onSearch={setSearch}
              onSaveMetadata={handleSaveDocumentMetadata}
              onDeleteDocument={handleDeleteDocument}
              onSelect={(document) => {
                setSelectedDocumentId(document.id);
                setActivePage('detail');
              }}
            />
          )}

          {activePage === 'detail' && (
            <DetailPage
              document={selectedDocument}
              onBack={() => setActivePage('library')}
              onSaveMetadata={handleSaveDocumentMetadata}
              onDeleteDocument={handleDeleteDocument}
            />
          )}

          {activePage === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="border-r border-line bg-white px-4 py-5">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid size-10 place-items-center rounded-lg bg-leaf text-white">
          <Sparkles size={20} />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">DocuMind</p>
          <p className="text-xs text-slate-500">Desktop lokal</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id || (activePage === 'detail' && item.id === 'library');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                isActive
                  ? 'bg-leaf text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-8 rounded-lg border border-line bg-mist p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Database size={16} />
          Database lokal
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Metadata disimpan di SQLite pada perangkat ini. File asli tetap berada di folder asal.
        </p>
      </div>
    </aside>
  );
}

function Header({ theme, onToggleTheme, onPickFolder }) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">DocuMind Desktop</h1>
        <p className="mt-1 text-sm text-slate-500">
          Organisasi dokumen lokal dengan pondasi AI yang siap dikembangkan.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="icon-button"
          title={theme === 'dark' ? 'Gunakan mode terang' : 'Gunakan mode gelap'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button type="button" className="primary-button" onClick={onPickFolder}>
          <FolderOpen size={18} />
          Pilih Folder
        </button>
      </div>
    </header>
  );
}

function HomePage({ documents, stats, selectedFolder, onPickFolder, onScan, onOpenLibrary }) {
  const recentDocuments = documents.slice(0, 5);
  const folderSummaries = getFolderSummaries(documents).slice(0, 4);
  const duplicateCount = getDuplicateKeys(documents).size;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-4 gap-4">
        <StatCard label="Dokumen Terindeks" value={stats.total_documents} icon={Archive} />
        <StatCard label="Total Ukuran" value={formatBytes(stats.total_size)} icon={Database} />
        <StatCard label="Format Dikenali" value="PDF, JPG, PNG" icon={FileText} />
        <StatCard label="Folder Aktif" value={folderSummaries.length} icon={FolderOpen} />
      </section>

      <section className="grid grid-cols-[1.2fr_0.8fr] gap-5">
        <div className="panel p-5">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="section-title">Mulai indeks dokumen</h2>
              <p className="mt-1 text-sm text-slate-500">
                Pilih folder lokal dan DocuMind akan menyimpan metadata file yang ditemukan.
              </p>
            </div>
            <FolderOpen className="text-leaf" size={26} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {['Tidak unggah server', 'Tidak ubah file asli', 'OCR belum aktif'].map((item) => (
              <div key={item} className="rounded-lg border border-line bg-mist px-3 py-3 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <button type="button" className="primary-button" onClick={onPickFolder}>
              <FolderOpen size={18} />
              Pindai Folder
            </button>
            {selectedFolder && (
              <button type="button" className="secondary-button" onClick={onScan}>
                <RotateCw size={18} />
                Pindai Ulang
              </button>
            )}
            <button type="button" className="secondary-button" onClick={onOpenLibrary}>
              <Archive size={18} />
              Buka Perpustakaan
            </button>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="section-title">Ringkasan format</h2>
          <div className="mt-4 space-y-3">
            {(stats.types.length ? stats.types : [{ file_type: 'PDF', total: 0 }]).map((type) => (
              <div key={type.file_type} className="flex items-center justify-between rounded-lg bg-mist px-3 py-2">
                <span className="text-sm font-medium">{type.file_type}</span>
                <span className="text-sm text-slate-500">{type.total} file</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-[1fr_1fr] gap-5">
        <div className="panel p-5">
          <h2 className="section-title">Folder terindeks</h2>
          <div className="mt-4 space-y-3">
            {folderSummaries.length ? folderSummaries.map((folder) => (
              <div key={folder.path} className="flex items-center justify-between rounded-lg bg-mist px-3 py-2">
                <div className="folder-cell min-w-0" title={folder.path}>
                  <FolderOpen size={15} />
                  <span className="font-medium">{folder.name}</span>
                </div>
                <span className="text-sm text-slate-500">{folder.count} file</span>
              </div>
            )) : (
              <p className="text-sm text-slate-500">Belum ada folder yang diindeks.</p>
            )}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="section-title">Kesehatan indeks</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-lg border border-line bg-mist px-3 py-3 text-sm">
              <span className="font-semibold">{duplicateCount}</span>
              <span className="text-slate-500"> kandidat duplikat berdasarkan nama dan ukuran.</span>
            </div>
            <div className="rounded-lg border border-line bg-mist px-3 py-3 text-sm text-slate-500">
              File asli tetap berada di folder asal dan tidak diubah oleh DocuMind.
            </div>
          </div>
        </div>
      </section>

      <DocumentTable documents={recentDocuments} onSelect={onOpenLibrary} compact />
    </div>
  );
}

function ScanPage({ selectedFolder, recentFolders, scanState, onPickFolder, onSelectRecentFolder, onScan }) {
  return (
    <div className="panel p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="section-title">Pindai Folder</h2>
          <p className="mt-1 text-sm text-slate-500">
            DocuMind mencari PDF, JPG, JPEG, dan PNG secara rekursif dari folder pilihan.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={onPickFolder}>
          <FolderOpen size={18} />
          Ganti Folder
        </button>
      </div>

      <div className="rounded-lg border border-line bg-mist p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Folder terpilih</p>
        <p className="mt-2 break-all text-sm font-medium">
          {selectedFolder || 'Belum ada folder yang dipilih'}
        </p>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" className="primary-button" onClick={onScan} disabled={scanState.status === 'loading'}>
          {scanState.status === 'loading' ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
          {selectedFolder ? 'Pindai Ulang' : 'Mulai Pindai'}
        </button>
        {scanState.message && (
          <span className={`text-sm ${scanState.status === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
            {scanState.message}
          </span>
        )}
      </div>

      {recentFolders.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Folder terbaru</h3>
          <div className="mt-3 grid gap-2">
            {recentFolders.map((folder) => (
              <button
                key={folder}
                type="button"
                className="recent-folder-button"
                onClick={() => onSelectRecentFolder(folder)}
              >
                <FolderOpen size={16} />
                <span>{folder}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LibraryPage({ documents, search, selectedDocument, onSearch, onSelect, onSaveMetadata, onDeleteDocument }) {
  const [filters, setFilters] = useState({ fileType: 'all', category: 'all', tag: 'all', folder: 'all' });
  const [sortConfig, setSortConfig] = useState({ key: 'updated_at', direction: 'desc' });
  const [exportState, setExportState] = useState({ status: 'idle', message: '' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState('');

  const duplicateKeys = useMemo(() => getDuplicateKeys(documents), [documents]);

  const filterOptions = useMemo(() => {
    const fileTypes = new Set();
    const categories = new Set();
    const tags = new Set();
    const folders = new Set();

    for (const document of documents) {
      if (document.file_type) fileTypes.add(document.file_type);
      if (document.category) categories.add(document.category);
      if (document.file_path) folders.add(getFolderPath(document.file_path));
      for (const tag of parseTags(document.tags)) {
        tags.add(tag);
      }
    }

    return {
      fileTypes: [...fileTypes].sort(),
      categories: [...categories].sort((a, b) => a.localeCompare(b)),
      tags: [...tags].sort((a, b) => a.localeCompare(b)),
      folders: [...folders].sort((a, b) => a.localeCompare(b))
    };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const filtered = documents.filter((document) => {
        const matchesType = filters.fileType === 'all' || document.file_type === filters.fileType;
        const matchesCategory = filters.category === 'all' || document.category === filters.category;
        const matchesTag = filters.tag === 'all' || parseTags(document.tags).includes(filters.tag);
        const matchesFolder = filters.folder === 'all' || getFolderPath(document.file_path) === filters.folder;
        return matchesType && matchesCategory && matchesTag && matchesFolder;
      });

    return sortDocuments(filtered, sortConfig);
  }, [documents, filters, sortConfig]);

  const visibleSelectedDocument = filteredDocuments.find((document) => document.id === selectedDocument?.id)
    ?? filteredDocuments[0]
    ?? selectedDocument;
  const selectedDocuments = filteredDocuments.filter((document) => selectedIds.has(document.id));
  const allVisibleSelected = filteredDocuments.length > 0 && filteredDocuments.every((document) => selectedIds.has(document.id));

  useEffect(() => {
    setSelectedIds((current) => {
      const visibleIds = new Set(filteredDocuments.map((document) => document.id));
      return new Set([...current].filter((id) => visibleIds.has(id)));
    });
  }, [filteredDocuments]);

  function changeSort(key) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  }

  async function exportMetadata(format, targetDocuments = filteredDocuments) {
    setExportState({ status: 'loading', message: 'Menyiapkan export metadata...' });
    try {
      const result = await api.exportDocuments(targetDocuments, format);
      if (result?.canceled) {
        setExportState({ status: 'idle', message: '' });
        return;
      }

      setExportState({
        status: result?.ok ? 'success' : 'error',
        message: result?.ok ? 'Metadata berhasil diexport.' : 'Export metadata gagal.'
      });
      window.setTimeout(() => setExportState({ status: 'idle', message: '' }), 1800);
    } catch (error) {
      setExportState({
        status: 'error',
        message: error.message ?? 'Export metadata gagal.'
      });
    }
  }

  function toggleSelected(documentId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return new Set();
      }

      return new Set([...current, ...filteredDocuments.map((document) => document.id)]);
    });
  }

  async function bulkDeleteFromIndex() {
    if (!selectedDocuments.length) return;
    const confirmed = window.confirm(`Hapus ${selectedDocuments.length} dokumen dari indeks? File asli tidak akan dihapus.`);
    if (!confirmed) return;

    for (const document of selectedDocuments) {
      await onDeleteDocument(document.id);
    }
    setSelectedIds(new Set());
  }

  async function bulkAssignCategory() {
    if (!selectedDocuments.length || !bulkCategory) return;
    for (const document of selectedDocuments) {
      await onSaveMetadata(document.id, {
        title: document.title ?? '',
        category: bulkCategory,
        tags: formatTagsForInput(document.tags)
      });
    }
    setSelectedIds(new Set());
    setBulkCategory('');
  }

  return (
    <div className="grid grid-cols-[1fr_360px] gap-5">
      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="min-w-[230px]">
            <h2 className="section-title whitespace-nowrap">Perpustakaan Dokumen</h2>
            <p className="mt-1 text-sm text-slate-500">{filteredDocuments.length} dokumen cocok dengan pencarian.</p>
          </div>
          <label className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Cari nama, kategori, tag, atau teks..."
            />
          </label>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" className="secondary-button" onClick={() => exportMetadata('json')}>
            <Download size={18} />
            Export JSON
          </button>
          <button type="button" className="secondary-button" onClick={() => exportMetadata('csv')}>
            <Download size={18} />
            Export CSV
          </button>
          {exportState.message && (
            <span className={`text-sm ${exportState.status === 'error' ? 'text-red-600' : 'text-leaf'}`}>
              {exportState.message}
            </span>
          )}
        </div>

        {selectedDocuments.length > 0 && (
          <div className="bulk-bar">
            <span className="text-sm font-semibold">{selectedDocuments.length} dipilih</span>
            <button type="button" className="secondary-button" onClick={() => exportMetadata('json', selectedDocuments)}>
              <Download size={18} />
              Export Terpilih
            </button>
            <label className="bulk-select">
              <span>Kategori</span>
              <select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)}>
                <option value="">Pilih kategori</option>
                {quickCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <button type="button" className="secondary-button" disabled={!bulkCategory} onClick={bulkAssignCategory}>
              <Save size={18} />
              Terapkan
            </button>
            <button type="button" className="secondary-button danger-button" onClick={bulkDeleteFromIndex}>
              <Trash2 size={18} />
              Hapus dari Indeks
            </button>
            <button type="button" className="icon-button" title="Batal pilih" onClick={() => setSelectedIds(new Set())}>
              <X size={18} />
            </button>
          </div>
        )}

        <div className="mb-4 grid grid-cols-4 gap-3">
          <FilterSelect
            label="Tipe file"
            value={filters.fileType}
            onChange={(fileType) => setFilters((current) => ({ ...current, fileType }))}
            options={filterOptions.fileTypes}
            emptyLabel="Semua tipe"
          />
          <FilterSelect
            label="Kategori"
            value={filters.category}
            onChange={(category) => setFilters((current) => ({ ...current, category }))}
            options={filterOptions.categories}
            emptyLabel="Semua kategori"
          />
          <FilterSelect
            label="Tag"
            value={filters.tag}
            onChange={(tag) => setFilters((current) => ({ ...current, tag }))}
            options={filterOptions.tags}
            emptyLabel="Semua tag"
          />
          <FilterSelect
            label="Folder"
            value={filters.folder}
            onChange={(folder) => setFilters((current) => ({ ...current, folder }))}
            options={filterOptions.folders}
            emptyLabel="Semua folder"
            formatOption={getFolderName}
          />
        </div>

        {(filters.fileType !== 'all' || filters.category !== 'all' || filters.tag !== 'all' || filters.folder !== 'all') && (
          <button
            type="button"
            className="mb-4 secondary-button"
            onClick={() => setFilters({ fileType: 'all', category: 'all', tag: 'all', folder: 'all' })}
          >
            <X size={18} />
            Reset Filter
          </button>
        )}

        <DocumentTable
          documents={filteredDocuments}
          duplicateKeys={duplicateKeys}
          sortConfig={sortConfig}
          selectedIds={selectedIds}
          allVisibleSelected={allVisibleSelected}
          onSort={changeSort}
          onToggleSelected={toggleSelected}
          onToggleSelectAll={toggleSelectAllVisible}
          onSelect={onSelect}
        />
      </section>
      <DetailPanel
        document={visibleSelectedDocument}
        duplicateKeys={duplicateKeys}
        onSaveMetadata={onSaveMetadata}
        onDeleteDocument={onDeleteDocument}
      />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, emptyLabel, formatOption = (option) => option }) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOption(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailPage({ document, onBack, onSaveMetadata, onDeleteDocument }) {
  if (!document) {
    return <EmptyState title="Belum ada dokumen" description="Pindai folder untuk mulai membuat perpustakaan." />;
  }

  return (
    <div className="space-y-5">
      <button type="button" className="secondary-button" onClick={onBack}>
        <Archive size={18} />
        Kembali ke Perpustakaan
      </button>
      <DetailPanel document={document} expanded onSaveMetadata={onSaveMetadata} onDeleteDocument={onDeleteDocument} />
    </div>
  );
}

function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSetting('gemini_api_key').then(setApiKey);
  }, []);

  async function saveSettings() {
    await api.setSetting('gemini_api_key', apiKey);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="panel max-w-3xl p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="grid size-10 place-items-center rounded-lg bg-sea text-white">
          <KeyRound size={20} />
        </div>
        <div>
          <h2 className="section-title">Pengaturan</h2>
          <p className="mt-1 text-sm text-slate-500">
            Simpan Gemini API key untuk fitur AI di tahap berikutnya. Integrasi AI belum dijalankan pada MVP ini.
          </p>
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Gemini API key</span>
        <input
          className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/15"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Masukkan API key"
        />
      </label>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" className="primary-button" onClick={saveSettings}>
          <Settings size={18} />
          Simpan Pengaturan
        </button>
        {saved && <span className="text-sm text-leaf">Pengaturan disimpan.</span>}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="panel flex items-center justify-between p-5">
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </div>
      <div className="grid size-11 place-items-center rounded-lg bg-mist text-leaf">
        <Icon size={21} />
      </div>
    </div>
  );
}

function DocumentTable({
  documents,
  onSelect,
  compact = false,
  duplicateKeys = new Set(),
  sortConfig,
  selectedIds = new Set(),
  allVisibleSelected = false,
  onSort,
  onToggleSelected,
  onToggleSelectAll
}) {
  if (!documents.length) {
    return <EmptyState title="Tidak ada dokumen" description="Pindai folder atau ubah filter untuk menampilkan dokumen." />;
  }

  return (
    <div className="panel overflow-hidden">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {onToggleSelected && (
              <th className="w-[44px] px-4 py-3">
                <input
                  aria-label="Pilih semua dokumen yang terlihat"
                  checked={allVisibleSelected}
                  type="checkbox"
                  onChange={onToggleSelectAll}
                />
              </th>
            )}
            <SortableHeader className="w-[30%]" label="Nama file" sortKey="file_name" sortConfig={sortConfig} onSort={onSort} />
            <th className="w-[14%] px-4 py-3">Kategori</th>
            <th className="w-[18%] px-4 py-3">Folder</th>
            <SortableHeader className="w-[12%]" label="Ukuran" sortKey="file_size" sortConfig={sortConfig} onSort={onSort} />
            <SortableHeader className="w-[18%]" label="Diperbarui" sortKey="updated_at" sortConfig={sortConfig} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {documents.map((document) => (
            <tr key={document.id} className="cursor-pointer hover:bg-mist" onClick={() => onSelect(document)}>
              {onToggleSelected && (
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  <input
                    aria-label={`Pilih ${document.file_name}`}
                    checked={selectedIds.has(document.id)}
                    type="checkbox"
                    onChange={() => onToggleSelected(document.id)}
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {document.file_type === 'PDF' ? <FileText className="text-sea" size={18} /> : <FileImage className="text-amber" size={18} />}
                  <span className="truncate font-medium">{document.file_name}</span>
                  {duplicateKeys.has(getDuplicateKey(document)) && (
                    <span className="duplicate-badge">Duplikat?</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-slate-500">{document.category || 'Belum ada'}</td>
              <td className="px-4 py-3 text-slate-500">
                <div className="folder-cell" title={getFolderPath(document.file_path)}>
                  <FolderOpen size={15} />
                  <span>{getFolderName(getFolderPath(document.file_path))}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-500">{formatBytes(document.file_size)}</td>
              <td className="px-4 py-3 text-slate-500">{formatDate(document.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {compact && documents.length >= 5 && (
        <div className="border-t border-line bg-mist px-4 py-3 text-sm text-slate-500">
          Menampilkan 5 dokumen terbaru.
        </div>
      )}
    </div>
  );
}

function SortableHeader({ className, label, sortKey, sortConfig, onSort }) {
  if (!onSort) {
    return <th className={`${className} px-4 py-3`}>{label}</th>;
  }

  const isActive = sortConfig?.key === sortKey;
  const suffix = isActive ? (sortConfig.direction === 'asc' ? 'naik' : 'turun') : '';

  return (
    <th className={`${className} px-4 py-3`}>
      <button type="button" className="sort-button" onClick={() => onSort(sortKey)}>
        {label}
        <ArrowUpDown size={14} />
        <span className="sr-only">{suffix}</span>
      </button>
    </th>
  );
}

function DetailPanel({ document, expanded = false, onSaveMetadata, onDeleteDocument, duplicateKeys = new Set() }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ title: '', category: '', tags: '' });
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' });
  const [actionState, setActionState] = useState({ status: 'idle', message: '' });
  const [previewState, setPreviewState] = useState({ status: 'idle', dataUrl: '', message: '' });
  const [fileStatus, setFileStatus] = useState({ status: 'idle', exists: true });

  useEffect(() => {
    if (!document) {
      return;
    }

    setForm({
      title: document.title ?? '',
      category: document.category ?? '',
      tags: formatTagsForInput(document.tags)
    });
    setIsEditing(false);
    setSaveState({ status: 'idle', message: '' });
    setActionState({ status: 'idle', message: '' });
    setFileStatus({ status: 'loading', exists: true });

    api.getFileStatus(document.file_path)
      .then((status) => setFileStatus({ status: 'ready', ...status }))
      .catch(() => setFileStatus({ status: 'ready', exists: false }));
  }, [document?.id]);

  useEffect(() => {
    let isCanceled = false;

    async function loadPreview() {
      if (!document || (!isImageDocument(document) && document.file_type !== 'PDF')) {
        setPreviewState({ status: 'idle', dataUrl: '', message: '' });
        return;
      }

      const previewLabel = isImageDocument(document) ? 'gambar' : 'PDF';
      setPreviewState({ status: 'loading', dataUrl: '', message: `Memuat preview ${previewLabel}...` });
      try {
        const result = isImageDocument(document)
          ? await api.getImagePreview(document.file_path)
          : await api.getPdfPreview(document.file_path);
        if (isCanceled) return;

        if (result?.dataUrl) {
          setPreviewState({ status: 'success', dataUrl: result.dataUrl, message: '' });
          return;
        }

        setPreviewState({
          status: 'error',
          dataUrl: '',
          message: result?.error ?? `Preview ${previewLabel} belum tersedia.`
        });
      } catch (error) {
        if (isCanceled) return;
        setPreviewState({
          status: 'error',
          dataUrl: '',
          message: error.message ?? 'Preview gambar gagal dimuat.'
        });
      }
    }

    loadPreview();

    return () => {
      isCanceled = true;
    };
  }, [document?.id, document?.file_path, document?.file_type]);

  if (!document) {
    return <EmptyState title="Pilih dokumen" description="Detail metadata akan tampil di sini." />;
  }

  async function saveMetadata() {
    setSaveState({ status: 'loading', message: 'Menyimpan metadata...' });
    try {
      await onSaveMetadata(document.id, form);
      setIsEditing(false);
      setSaveState({ status: 'success', message: 'Metadata disimpan.' });
      window.setTimeout(() => setSaveState({ status: 'idle', message: '' }), 1600);
    } catch (error) {
      setSaveState({
        status: 'error',
        message: error.message ?? 'Metadata gagal disimpan.'
      });
    }
  }

  async function openDocument() {
    const result = await api.openFile(document.file_path);
    if (result?.ok) {
      setActionState({ status: 'success', message: 'Dokumen dibuka di aplikasi bawaan.' });
      window.setTimeout(() => setActionState({ status: 'idle', message: '' }), 1600);
      return;
    }

    setActionState({
      status: 'error',
      message: result?.error || 'Dokumen gagal dibuka.'
    });
  }

  async function copyPath() {
    await api.copyPath(document.file_path);
    setActionState({ status: 'success', message: 'Path disalin ke clipboard.' });
    window.setTimeout(() => setActionState({ status: 'idle', message: '' }), 1600);
  }

  async function deleteFromIndex() {
    const confirmed = window.confirm('Hapus dokumen ini dari indeks DocuMind? File asli tidak akan dihapus.');
    if (!confirmed) {
      return;
    }

    await onDeleteDocument(document.id);
  }

  const metadataRows = [
    ['Nama file', document.file_name],
    ['Path asli', document.file_path],
    ['Format', document.file_type],
    ['Ukuran', formatBytes(document.file_size)],
    ['Dibuat', formatDate(document.created_at)],
    ['Diperbarui', formatDate(document.updated_at)],
    ['Tipe dokumen', document.document_type || 'Belum ada']
  ];
  const isDuplicateCandidate = duplicateKeys.has(getDuplicateKey(document));
  const categoryOptions = quickCategories.includes(form.category) || !form.category
    ? quickCategories
    : [form.category, ...quickCategories];

  return (
    <aside className={`panel min-w-0 p-5 ${expanded ? 'max-w-5xl' : ''}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{document.title || document.file_name}</h2>
          <p className="mt-1 text-sm text-slate-500">Detail Dokumen</p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button type="button" className="icon-button" title="Batal edit" onClick={() => setIsEditing(false)}>
                <X size={18} />
              </button>
              <button type="button" className="icon-button" title="Simpan metadata" onClick={saveMetadata}>
                <Save size={18} />
              </button>
            </>
          ) : (
            <button type="button" className="icon-button" title="Edit metadata" onClick={() => setIsEditing(true)}>
              <Edit3 size={18} />
            </button>
          )}
          <button type="button" className="icon-button" title="Tampilkan di folder" onClick={() => api.showFile(document.file_path)}>
            <FolderOpen size={18} />
          </button>
        </div>
      </div>

      <FileStatusNotice fileStatus={fileStatus} document={document} />

      {isDuplicateCandidate && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={17} />
            Kemungkinan duplikat
          </div>
          <p className="mt-1">Ada dokumen lain dengan nama file dan ukuran yang sama.</p>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <button type="button" className="secondary-button" onClick={openDocument}>
          <ExternalLink size={18} />
          Buka Dokumen
        </button>
        <button type="button" className="secondary-button" onClick={() => api.showFile(document.file_path)}>
          <FolderOpen size={18} />
          Tampilkan di Folder
        </button>
        <button type="button" className="secondary-button" onClick={copyPath}>
          <Clipboard size={18} />
          Salin Path
        </button>
        <button type="button" className="secondary-button danger-button" onClick={deleteFromIndex}>
          <Trash2 size={18} />
          Hapus dari Indeks
        </button>
      </div>

      {actionState.message && (
        <p className={`mb-4 text-sm ${actionState.status === 'error' ? 'text-red-600' : 'text-leaf'}`}>
          {actionState.message}
        </p>
      )}

      <PreviewPanel document={document} previewState={previewState} />

      {isEditing && (
        <div className="mb-5 rounded-lg border border-line bg-mist p-4">
          <div className="grid gap-3">
            <label className="metadata-field">
              <span>Judul</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Contoh: Kontrak Kerja Sama 2026"
              />
            </label>
            <label className="metadata-field">
              <span>Kategori</span>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              >
                <option value="">Belum ada</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="metadata-field">
              <span>Tag</span>
              <input
                value={form.tags}
                onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                placeholder="Pisahkan dengan koma, contoh: kontrak, 2026, penting"
              />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" className="primary-button" onClick={saveMetadata} disabled={saveState.status === 'loading'}>
              {saveState.status === 'loading' ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Simpan Metadata
            </button>
            <button type="button" className="secondary-button" onClick={() => setIsEditing(false)}>
              <X size={18} />
              Batal
            </button>
          </div>
        </div>
      )}

      {saveState.message && (
        <p className={`mb-4 text-sm ${saveState.status === 'error' ? 'text-red-600' : 'text-leaf'}`}>
          {saveState.message}
        </p>
      )}

      <div className="space-y-3">
        <div className="rounded-lg border border-line bg-mist p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Judul</p>
          <p className="mt-1 break-words text-sm">{document.title || 'Belum ada'}</p>
        </div>
        <div className="rounded-lg border border-line bg-mist p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Kategori</p>
          <p className="mt-1 break-words text-sm">{document.category || 'Belum ada'}</p>
        </div>
        {metadataRows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-mist p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        <AiBlock icon={Tags} title="Tag" value={formatTags(document.tags)} />
        <AiBlock icon={Bot} title="Ringkasan AI" value={document.ai_summary || 'Belum tersedia'} />
        <AiBlock icon={FileText} title="Teks Ekstraksi" value={document.extracted_text || 'Belum tersedia'} />
      </div>
    </aside>
  );
}

function FileStatusNotice({ fileStatus, document }) {
  if (fileStatus.status === 'loading') {
    return <p className="mb-4 text-sm text-slate-500">Memeriksa file asli...</p>;
  }

  if (!fileStatus.exists) {
    return (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        File asli tidak ditemukan di path tersimpan. Metadata tetap aman, tapi dokumen mungkin sudah dipindahkan atau dihapus di luar DocuMind.
      </div>
    );
  }

  const hasChanged = fileStatus.size !== undefined && Number(fileStatus.size) !== Number(document.file_size);
  if (hasChanged) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        File asli masih ada, tetapi ukurannya berbeda dari metadata terakhir. Jalankan pindai ulang untuk memperbarui indeks.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-line bg-mist p-3 text-sm text-slate-600">
      File asli tersedia di folder lokal.
    </div>
  );
}

function PreviewPanel({ document, previewState }) {
  if (isImageDocument(document)) {
    return (
      <div className="preview-panel">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FileImage size={17} />
          Preview Gambar
        </div>
        {previewState.status === 'success' && (
          <img className="preview-image" src={previewState.dataUrl} alt={`Preview ${document.file_name}`} />
        )}
        {previewState.status !== 'success' && (
          <div className="preview-empty">
            <FileImage size={28} />
            <p>{previewState.message || 'Preview gambar akan tampil di sini.'}</p>
          </div>
        )}
      </div>
    );
  }

  if (document.file_type === 'PDF') {
    return (
      <div className="preview-panel">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FileText size={17} />
          Preview PDF
        </div>
        {previewState.status === 'success' && (
          <iframe className="preview-pdf" title={`Preview ${document.file_name}`} src={previewState.dataUrl} />
        )}
        {previewState.status !== 'success' && (
          <div className="preview-empty">
            <FileText size={30} />
            <p>{previewState.message || 'Preview PDF akan tampil di sini jika ukuran file mendukung.'}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function AiBlock({ icon: Icon, title, value }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Icon size={16} />
        {title}
      </div>
      <p className="text-sm leading-6 text-slate-500">{value}</p>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="panel grid min-h-[220px] place-items-center p-8 text-center">
      <div>
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-mist text-leaf">
          <Archive size={22} />
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function formatBytes(bytes = 0) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function formatTags(tags) {
  if (!tags) return 'Belum ada';
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) && parsed.length ? parsed.join(', ') : 'Belum ada';
  } catch {
    return tags;
  }
}

function parseTags(tags) {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.map((tag) => String(tag).trim()).filter(Boolean) : [];
  } catch {
    return String(tags).split(',').map((tag) => tag.trim()).filter(Boolean);
  }
}

function isImageDocument(document) {
  return ['JPG', 'JPEG', 'PNG'].includes(document?.file_type);
}

function formatTagsForInput(tags) {
  if (!tags) return '';
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.join(', ') : '';
  } catch {
    return tags;
  }
}

function getFolderPath(filePath = '') {
  const normalizedPath = String(filePath);
  const separatorIndex = Math.max(normalizedPath.lastIndexOf('\\'), normalizedPath.lastIndexOf('/'));
  return separatorIndex >= 0 ? normalizedPath.slice(0, separatorIndex) : normalizedPath;
}

function getFolderName(folderPath = '') {
  const normalizedPath = String(folderPath).replace(/[\\/]+$/, '');
  const separatorIndex = Math.max(normalizedPath.lastIndexOf('\\'), normalizedPath.lastIndexOf('/'));
  return separatorIndex >= 0 ? normalizedPath.slice(separatorIndex + 1) : normalizedPath || 'Folder';
}

function parseRecentFolders(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((folder) => String(folder)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function getDuplicateKey(document) {
  return `${String(document?.file_name ?? '').toLowerCase()}::${Number(document?.file_size ?? 0)}`;
}

function getDuplicateKeys(documents) {
  const counts = new Map();
  for (const document of documents) {
    const key = getDuplicateKey(document);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function getFolderSummaries(documents) {
  const folders = new Map();
  for (const document of documents) {
    const path = getFolderPath(document.file_path);
    const current = folders.get(path) ?? {
      path,
      name: getFolderName(path),
      count: 0
    };
    current.count += 1;
    folders.set(path, current);
  }

  return [...folders.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function sortDocuments(documents, sortConfig) {
  return [...documents].sort((a, b) => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    const left = a[sortConfig.key];
    const right = b[sortConfig.key];

    if (sortConfig.key === 'file_size') {
      return (Number(left ?? 0) - Number(right ?? 0)) * direction;
    }

    if (sortConfig.key === 'updated_at') {
      return (new Date(left ?? 0).getTime() - new Date(right ?? 0).getTime()) * direction;
    }

    return String(left ?? '').localeCompare(String(right ?? '')) * direction;
  });
}

function createBrowserFallback() {
  const sampleDocuments = [
    {
      id: 1,
      file_name: 'contoh-kontrak.pdf',
      file_path: 'C:\\Dokumen\\contoh-kontrak.pdf',
      file_type: 'PDF',
      file_size: 248900,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      title: null,
      category: null,
      tags: null,
      extracted_text: null,
      ai_summary: null,
      document_type: null
    }
  ];

  return {
    pickFolder: async () => 'C:\\Dokumen',
    scanFolder: async () => ({ indexed: sampleDocuments.length, documents: sampleDocuments }),
    listDocuments: async () => sampleDocuments,
    getDocument: async (id) => sampleDocuments.find((item) => item.id === id),
    updateDocumentMetadata: async (id, metadata) => {
      const document = sampleDocuments.find((item) => item.id === id);
      if (!document) return null;
      document.title = metadata.title?.trim() || null;
      document.category = metadata.category?.trim() || null;
      document.tags = metadata.tags
        ? JSON.stringify(metadata.tags.split(',').map((tag) => tag.trim()).filter(Boolean))
        : null;
      return document;
    },
    deleteDocument: async (id) => {
      const index = sampleDocuments.findIndex((item) => item.id === id);
      if (index >= 0) {
        sampleDocuments.splice(index, 1);
      }
      return { ok: true, id };
    },
    exportDocuments: async () => ({ ok: true }),
    getStats: async () => ({
      total_documents: sampleDocuments.length,
      total_size: sampleDocuments.reduce((sum, item) => sum + item.file_size, 0),
      types: [{ file_type: 'PDF', total: 1 }]
    }),
    getSetting: async () => '',
    setSetting: async (key, value) => ({ key, value }),
    showFile: async () => undefined,
    openFile: async () => ({ ok: true }),
    copyPath: async () => ({ ok: true }),
    getFileStatus: async () => ({ exists: true }),
    getImagePreview: async () => null,
    getPdfPreview: async () => null
  };
}

export default App;
