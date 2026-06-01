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

Metadata dokumen seperti judul, kategori, dan tag dapat diedit dari halaman detail. Folder terakhir yang dipindai disimpan di `settings` agar pengguna bisa menjalankan pindai ulang tanpa memilih folder lagi.

Halaman detail juga menyediakan action lokal untuk membuka dokumen di aplikasi bawaan, menampilkan file di folder asal, menyalin path, dan menampilkan preview inline untuk file gambar JPG/JPEG/PNG serta PDF berukuran wajar. Jika file terlalu besar atau viewer sistem tidak mendukung preview inline, file tetap bisa dibuka lewat aplikasi bawaan sistem.

DocuMind juga memeriksa status file asli dari halaman detail. Jika file dipindahkan, dihapus, atau ukurannya berubah di luar aplikasi, pengguna mendapat peringatan tanpa menghapus metadata yang sudah tersimpan.

Perpustakaan dokumen mendukung filter folder, filter tipe/kategori/tag, sort sederhana, indikator kemungkinan duplikat berdasarkan nama file dan ukuran yang sama, kategori cepat dari halaman detail, serta export metadata terfilter ke JSON atau CSV.

Dokumen dapat dihapus dari indeks DocuMind tanpa menghapus file asli. Pencarian juga mencakup judul dokumen yang diedit pengguna. Halaman pindai menyimpan daftar folder terbaru agar pengguna bisa cepat memilih ulang folder lokal yang sering dipakai.

Perpustakaan juga mendukung bulk actions untuk dokumen yang sedang terlihat: pilih beberapa dokumen, export metadata terpilih, terapkan kategori cepat, atau hapus dari indeks tanpa menghapus file asli. Beranda menampilkan ringkasan folder terindeks dan kandidat duplikat.

Tampilan mendukung mode terang dan mode gelap dengan palet forest green/olive. Pilihan tema disimpan secara lokal di SQLite settings.

## Berikutnya

- Tambahkan OCR lokal untuk PDF dan gambar.
- Tambahkan integrasi Gemini setelah pengaturan API key siap.
- Tambahkan impor ulang terjadwal dan deteksi duplikat berbasis hash file.
- Tambahkan kontrol zoom/halaman untuk preview PDF.
- Tambahkan packaging installer untuk Windows/macOS/Linux.
