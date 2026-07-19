// Supabase project credentials (publishable key is safe to expose client-side; RLS controls access)
window.SUPABASE_URL = "https://cvfntybtqkqfbmkwdjaj.supabase.co";
window.SUPABASE_KEY = "sb_publishable_F6NVoq7rjbPoSc4mIgpT6g_PLzPqe27";

// Default role template used when creating a new schedule, based on the original spreadsheet layout.
// Fully editable per-schedule afterwards (roles can be added, renamed, or removed).
window.ROLE_TEMPLATE = [
  { group: "Stage", roles: [
    "Pembicara I", "Pembicara II", "Worship Leader",
    "Singer I", "Singer II", "Singer III", "Singer IV",
    "Keyboard", "Bass", "Guitar", "Drum",
    "Dancer I", "Dancer II", "Dancer III", "Dancer IV", "Dancer V", "Dancer VI",
    "Soundman", "Multimedia"
  ]},
  { group: "Usher", roles: [
    "Lift Bawah", "Lift Atas",
    "Pintu Ibadah I", "Pintu Ibadah II",
    "Ruang Ibadah I", "Ruang Ibadah II", "Ruang Ibadah III", "Ruang Ibadah IV",
    "Absen Jemaat"
  ]},
  { group: "Collect", roles: [
    "Head Kolekte (I&II)", "Kolekte (I&II)", "Kolekte (I&II)", "Kolekte (II)",
    "Pendamping HT", "Pengumuman"
  ]},
  { group: "Pendoa", roles: [
    "PIR", "Doa Syafaat I", "Doa Syafaat II", "Musik Pendoa"
  ]}
];
