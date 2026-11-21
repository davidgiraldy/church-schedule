# Instruksi Proyek — Church Schedule (PPW)

Website jadwal pelayan ibadah mingguan GBI House of Happiness (PPW). Web statis tanpa build
step, data di Supabase. Dibuka panitia untuk mengisi petugas tiap minggu, lalu dibagikan ke
grup WhatsApp sebagai gambar + caption.

## Instruksi tetap dari user (2026-11-21)

1. **Setelah mengedit file di folder ini, langsung commit dan push ke GitHub `main`.** Tidak perlu
   minta izin dulu untuk commit/push rutin.
2. **RLS Supabase sengaja terbuka** (publik boleh baca *dan* tulis). User sudah memutuskan ini sadar:
   "biar siapapun edit nggak apa-apa". Jangan mengusulkan atau memasang login/auth kecuali diminta.

## Bahasa

- **Percakapan: Indonesia**, ringkas dan langsung.
- **Kode, komentar, nama file, pesan commit: Inggris.**

## Peta file

```
index.html          struktur UI: header, filter bar, kartu jadwal, modal form, view People
css/styles.css      seluruh styling + style khusus kartu share (.share-render-root, .share-card)
js/config.js        kredensial Supabase, ROLE_TEMPLATE (4 grup role), template caption WhatsApp
js/supabaseClient.js  inisialisasi window.sb
js/api.js           semua akses data (CRUD + storage dress code)
js/app.js           semua UI/logika: render, filter, modal, People view, share ke PNG
schema.sql          DDL + policy RLS (bukan migrasi otomatis — DB sudah terpasang manual)
```

Library dari CDN, tanpa bundler: supabase-js v2, html2canvas 1.4.1, SortableJS 1.15.2.
**Jangan menambahkan framework/build step tanpa diminta** — cukup buka `index.html` lewat server.

## Supabase

- Project ref: `cvfntybtqkqfbmkwdjaj` — `https://cvfntybtqkqfbmkwdjaj.supabase.co`
- Key: `sb_publishable_…` (anon/publishable) di `js/config.js`. Boleh tampil di klien; yang
  menjaga akses adalah RLS, bukan kerahasiaan key ini.
- Tabel: `schedules` → `schedule_times`, `schedule_assignments` (cascade delete), dan `people`
  (hanya untuk autocomplete, bukan foreign key).
- Storage bucket: `dress-code` (gambar dress code per minggu).
- Kolom `schedules`: `id, service_date, label, dress_code_image_path, dress_code_notes,
  created_at, updated_at`.
- Bentuk data: satu baris `schedules` = satu minggu; `schedule_times` = jam ibadah minggu itu
  (biasanya 08:00 & 10:00); `schedule_assignments` = satu baris per role (`role_group`, `role`,
  `role_order`, `person_name`), nama kosong berarti belum diisi.

## Menjalankan lokal

```bash
cd ~/Documents/01_work/05_project_church_website/church-schedule
python3 -m http.server 8765    # buka http://127.0.0.1:8765
```

Jangan buka `index.html` lewat `file://` — `fetch`/CORS untuk gambar dress code akan gagal.
Hati-hati: server lokal ini menulis ke **DB produksi**, tidak ada database terpisah.

## Git & identitas

- Remote pakai alias SSH khusus akun personal: `git@github-church:davidgiraldy/church-schedule.git`
  (alias di `~/.ssh/config`, key `~/.ssh/id_ed25519_church`).
- Identitas repo sudah di-set lokal: `David Jose Giraldy <davidjosegiraldy@gmail.com>`.
- **Jangan pernah pakai akun kantor** (`shho-davidgiraldy`, aktif di `gh` global) untuk repo ini.
  Jangan jalankan `gh auth switch` / `gh repo` ke repo ini tanpa diminta.
- Pesan commit: bahasa Inggris, imperative, satu baris, tanpa prefix Conventional Commits —
  meniru 33 commit sebelumnya (`Fix Safari canvas taint error on Share`, `Add PPW WhatsApp caption
  template`).

## Jebakan yang sudah diketahui

- **`_replaceTimes` / `_replaceAssignments` (`js/api.js`) menghapus dulu, baru insert.** Kalau
  insert gagal, jam & petugas lama hilang permanen. Belum diperbaiki — kalau menyentuh area ini,
  perbaiki sekalian atau minimal jangan menambah pemanggilan baru ke pola ini.
- `createSchedule` bisa meninggalkan baris jadwal kosong kalau langkah setelah insert gagal.
- Cek tanggal dobel hanya di klien (`checkDuplicateDate`), tidak ada unique constraint di DB —
  dua orang menyimpan tanggal sama bersamaan tetap bisa menghasilkan dua jadwal.
- Nomor "Week" di gambar share = minggu ke-berapa dalam bulan (`Math.ceil(tanggal/7)`), bukan
  nomor minggu liturgis.
- Share: caption dikopi ke clipboard **terpisah** dari `navigator.share({files})` — menggabungkan
  keduanya membuat iOS menduplikasi gambar saat user memilih "Copy". Jangan disatukan.
- `html2canvas` dengan `scale: 4`; gambar cross-origin di-fetch jadi blob dulu supaya Safari tidak
  kena canvas taint.
- `people` bisa menumpuk varian ejaan nama (mis. "Irene"/"iren"), yang membuat autocomplete
  berisik. Belum ada normalisasi.

## Deployment

**Tidak diketahui.** Tidak ada `CNAME`, workflow CI, `wrangler.toml`, atau `netlify.toml` di repo;
GitHub Pages untuk repo ini 404; `church-schedule.pages.dev` adalah aplikasi lain ("Jadwal Pelayan
GAB Alfa Omega"). Jangan menganggap push ke `main` otomatis tayang — kalau perlu memastikan,
tanya user dulu di mana hosting-nya.

## Kalau menyentuh database

Tidak ada backup otomatis. Sebelum UPDATE/DELETE massal atau perubahan skema, ekspor dulu isi
`schedules` + `schedule_times` + `schedule_assignments` ke file JSON lokal, dan taruh di luar repo.
