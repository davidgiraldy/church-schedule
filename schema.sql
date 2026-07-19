-- schedules: 1 row per jadwal ibadah mingguan
create table schedules (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- schedule_times: jam-jam ibadah dalam 1 schedule (bisa nambah kapan aja, mis. jam 8 & jam 10)
create table schedule_times (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  service_time time not null,
  note text
);

create index idx_schedule_times_schedule_id on schedule_times(schedule_id);

-- schedule_assignments: 1 row per role + petugas dalam 1 schedule (berlaku untuk semua jam di minggu itu)
create table schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  role_group text not null,
  role text not null,
  role_order int not null default 0,
  person_name text
);

create index idx_schedule_assignments_schedule_id on schedule_assignments(schedule_id);

-- RLS: publik bisa baca & tulis semua (sesuai keputusan: tanpa login/proteksi)
alter table schedules enable row level security;
alter table schedule_times enable row level security;
alter table schedule_assignments enable row level security;

create policy "public read schedules" on schedules for select using (true);
create policy "public write schedules" on schedules for insert with check (true);
create policy "public update schedules" on schedules for update using (true);
create policy "public delete schedules" on schedules for delete using (true);

create policy "public read times" on schedule_times for select using (true);
create policy "public write times" on schedule_times for insert with check (true);
create policy "public update times" on schedule_times for update using (true);
create policy "public delete times" on schedule_times for delete using (true);

create policy "public read assignments" on schedule_assignments for select using (true);
create policy "public write assignments" on schedule_assignments for insert with check (true);
create policy "public update assignments" on schedule_assignments for update using (true);
create policy "public delete assignments" on schedule_assignments for delete using (true);

-- dress code image per schedule, stored in the "dress-code" Storage bucket (create it via Dashboard first)
alter table schedules add column dress_code_image_path text;

create policy "public read dress code images" on storage.objects for select using (bucket_id = 'dress-code');
create policy "public upload dress code images" on storage.objects for insert with check (bucket_id = 'dress-code');
create policy "public update dress code images" on storage.objects for update using (bucket_id = 'dress-code');
create policy "public delete dress code images" on storage.objects for delete using (bucket_id = 'dress-code');
