import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bot,
  Database,
  FileImage,
  FileText,
  FolderOpen,
  Home,
  KeyRound,
  Loader2,
  Search,
  Settings,
  Sparkles,
  Tags
} from 'lucide-react';

const api = window.documind ?? createBrowserFallback();
const isNativeRuntime = Boolean(window.documind?.isNative);

const navItems = [
  { id: 'home', label: 'Beranda', icon: Home },
  { id: 'scan', label: 'Pindai Folder', icon: FolderOpen },
  { id: 'library', label: 'Perpustakaan Dokumen', icon: Archive },
  { id: 'settings', label: 'Pengaturan', icon: Settings }
];

function App() {
  const [activePage, setActivePage] = useState('home');
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [search, setSearch] = useState('');
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
  }, []);

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
      setActivePage('scan');
    }
  }

  async function handleScan() {
    if (!selectedFolder) {
      setScanState({ status: 'error', message: 'Pilih folder terlebih dahulu.' });
      return;
    }

    setScanState({ status: 'loading', message: 'Memindai dokumen lokal...' });
    try {
      const result = await api.scanFolder(selectedFolder);
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

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? documents[0],
    [documents, selectedDocumentId]
  );

  return (
    <div className="min-h-screen bg-mist text-ink">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className="min-w-0 px-8 py-6">
          <Header onPickFolder={handlePickFolder} />

          {activePage === 'home' && (
            <HomePage
              documents={documents}
              stats={stats}
              onPickFolder={handlePickFolder}
              onOpenLibrary={() => setActivePage('library')}
            />
          )}

          {activePage === 'scan' && (
            <ScanPage
              selectedFolder={selectedFolder}
              scanState={scanState}
              onPickFolder={handlePickFolder}
              onScan={handleScan}
            />
          )}

          {activePage === 'library' && (
            <LibraryPage
              documents={documents}
              search={search}
              selectedDocument={selectedDocument}
              onSearch={setSearch}
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

function Header({ onPickFolder }) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">DocuMind Desktop</h1>
        <p className="mt-1 text-sm text-slate-500">
          Organisasi dokumen lokal dengan pondasi AI yang siap dikembangkan.
        </p>
      </div>
      <button type="button" className="primary-button" onClick={onPickFolder}>
        <FolderOpen size={18} />
        Pilih Folder
      </button>
    </header>
  );
}

function HomePage({ documents, stats, onPickFolder, onOpenLibrary }) {
  const recentDocuments = documents.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-4">
        <StatCard label="Dokumen Terindeks" value={stats.total_documents} icon={Archive} />
        <StatCard label="Total Ukuran" value={formatBytes(stats.total_size)} icon={Database} />
        <StatCard label="Format Dikenali" value="PDF, JPG, PNG" icon={FileText} />
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

      <DocumentTable documents={recentDocuments} onSelect={onOpenLibrary} compact />
    </div>
  );
}

function ScanPage({ selectedFolder, scanState, onPickFolder, onScan }) {
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
          Mulai Pindai
        </button>
        {scanState.message && (
          <span className={`text-sm ${scanState.status === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
            {scanState.message}
          </span>
        )}
      </div>
    </div>
  );
}

function LibraryPage({ documents, search, selectedDocument, onSearch, onSelect }) {
  return (
    <div className="grid grid-cols-[1fr_360px] gap-5">
      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="min-w-[230px]">
            <h2 className="section-title whitespace-nowrap">Perpustakaan Dokumen</h2>
            <p className="mt-1 text-sm text-slate-500">{documents.length} dokumen cocok dengan pencarian.</p>
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
        <DocumentTable documents={documents} onSelect={onSelect} />
      </section>
      <DetailPanel document={selectedDocument} />
    </div>
  );
}

function DetailPage({ document, onBack }) {
  if (!document) {
    return <EmptyState title="Belum ada dokumen" description="Pindai folder untuk mulai membuat perpustakaan." />;
  }

  return (
    <div className="space-y-5">
      <button type="button" className="secondary-button" onClick={onBack}>
        <Archive size={18} />
        Kembali ke Perpustakaan
      </button>
      <DetailPanel document={document} expanded />
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

function DocumentTable({ documents, onSelect, compact = false }) {
  if (!documents.length) {
    return <EmptyState title="Perpustakaan masih kosong" description="Pindai folder untuk mengindeks metadata dokumen lokal." />;
  }

  return (
    <div className="panel overflow-hidden">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-[34%] px-4 py-3">Nama file</th>
            <th className="w-[16%] px-4 py-3">Kategori</th>
            <th className="w-[18%] px-4 py-3">Tag</th>
            <th className="w-[12%] px-4 py-3">Ukuran</th>
            <th className="w-[20%] px-4 py-3">Diperbarui</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {documents.map((document) => (
            <tr key={document.id} className="cursor-pointer hover:bg-mist" onClick={() => onSelect(document)}>
              <td className="px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {document.file_type === 'PDF' ? <FileText className="text-sea" size={18} /> : <FileImage className="text-amber" size={18} />}
                  <span className="truncate font-medium">{document.file_name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-500">{document.category || 'Belum ada'}</td>
              <td className="px-4 py-3 text-slate-500">{formatTags(document.tags)}</td>
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

function DetailPanel({ document, expanded = false }) {
  if (!document) {
    return <EmptyState title="Pilih dokumen" description="Detail metadata akan tampil di sini." />;
  }

  const metadataRows = [
    ['Nama file', document.file_name],
    ['Path asli', document.file_path],
    ['Format', document.file_type],
    ['Ukuran', formatBytes(document.file_size)],
    ['Dibuat', formatDate(document.created_at)],
    ['Diperbarui', formatDate(document.updated_at)],
    ['Judul', document.title || 'Belum ada'],
    ['Kategori', document.category || 'Belum ada'],
    ['Tipe dokumen', document.document_type || 'Belum ada']
  ];

  return (
    <aside className={`panel min-w-0 p-5 ${expanded ? 'max-w-5xl' : ''}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{document.title || document.file_name}</h2>
          <p className="mt-1 text-sm text-slate-500">Detail Dokumen</p>
        </div>
        <button type="button" className="icon-button" title="Tampilkan di folder" onClick={() => api.showFile(document.file_path)}>
          <FolderOpen size={18} />
        </button>
      </div>

      <div className="space-y-3">
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
    getStats: async () => ({
      total_documents: sampleDocuments.length,
      total_size: sampleDocuments.reduce((sum, item) => sum + item.file_size, 0),
      types: [{ file_type: 'PDF', total: 1 }]
    }),
    getSetting: async () => '',
    setSetting: async (key, value) => ({ key, value }),
    showFile: async () => undefined
  };
}

export default App;
