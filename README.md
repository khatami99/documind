# DocuMind Desktop

DocuMind Desktop adalah aplikasi desktop local-first untuk mengindeks dan mengelola dokumen pribadi tanpa mengunggah file ke server.

## Menjalankan aplikasi

```bash
npm install
npm run dev
```

Untuk melihat UI React saja di browser:

```bash
npm run dev:web
```

## Struktur proyek

- `electron/main.js`: proses utama Electron, jendela aplikasi, IPC, dialog folder.
- `electron/preload.js`: bridge aman antara React dan Electron.
- `electron/database.js`: koneksi SQLite, skema tabel, query metadata dokumen, dan pengaturan.
- `src/`: aplikasi React, halaman, komponen, dan gaya Tailwind.
- `src/App.jsx`: navigasi halaman, scan folder, pencarian, detail dokumen, dan pengaturan.

## Cara SQLite digunakan

SQLite disimpan secara lokal di folder data aplikasi Electron dengan nama `documind.sqlite`. Tabel `documents` menyimpan metadata file seperti nama, path asli, tipe, ukuran, tanggal, kategori, tag JSON, teks ekstraksi, ringkasan AI, tipe dokumen, dan metadata AI JSON. Tabel `settings` menyimpan nilai pengaturan lokal seperti Gemini API key.

Saat folder dipindai, DocuMind hanya membaca metadata file PDF, JPG, JPEG, dan PNG. File asli tidak dipindahkan, tidak diganti nama, dan tidak dihapus.

## Berikutnya

- Tambahkan OCR lokal untuk PDF dan gambar.
- Tambahkan integrasi Gemini setelah pengaturan API key siap.
- Tambahkan kategori dan tag yang bisa diedit dari halaman detail.
- Tambahkan filter lanjutan, impor ulang terjadwal, dan deteksi duplikat.
- Tambahkan packaging installer untuk Windows/macOS/Linux.
