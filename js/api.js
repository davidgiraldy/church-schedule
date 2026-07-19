window.Api = {
  async listSchedules() {
    const { data, error } = await window.sb
      .from("schedules")
      .select("*, schedule_times(*), schedule_assignments(*)")
      .order("service_date", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getSchedule(id) {
    const { data, error } = await window.sb
      .from("schedules")
      .select("*, schedule_times(*), schedule_assignments(*)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async createSchedule({ service_date, label, times, assignments, dressCodeFile }) {
    const { data: schedule, error: scheduleErr } = await window.sb
      .from("schedules")
      .insert({ service_date, label: label || null })
      .select()
      .single();
    if (scheduleErr) throw scheduleErr;

    await this._replaceTimes(schedule.id, times);
    await this._replaceAssignments(schedule.id, assignments);

    if (dressCodeFile) {
      const path = await this.uploadDressCodeImage(schedule.id, dressCodeFile);
      await window.sb.from("schedules").update({ dress_code_image_path: path }).eq("id", schedule.id);
      schedule.dress_code_image_path = path;
    }
    return schedule;
  },

  async updateSchedule(id, { service_date, label, times, assignments, dressCodeFile, removeDressCode, existingDressCodePath }) {
    const { error: scheduleErr } = await window.sb
      .from("schedules")
      .update({ service_date, label: label || null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (scheduleErr) throw scheduleErr;

    await this._replaceTimes(id, times);
    await this._replaceAssignments(id, assignments);

    if (dressCodeFile) {
      if (existingDressCodePath) await this.deleteDressCodeImage(existingDressCodePath);
      const path = await this.uploadDressCodeImage(id, dressCodeFile);
      await window.sb.from("schedules").update({ dress_code_image_path: path }).eq("id", id);
    } else if (removeDressCode && existingDressCodePath) {
      await this.deleteDressCodeImage(existingDressCodePath);
      await window.sb.from("schedules").update({ dress_code_image_path: null }).eq("id", id);
    }
  },

  async deleteSchedule(id) {
    const { error } = await window.sb.from("schedules").delete().eq("id", id);
    if (error) throw error;
  },

  async uploadDressCodeImage(scheduleId, file) {
    const ext = file.name.split(".").pop();
    const path = `${scheduleId}-${Date.now()}.${ext}`;
    const { error } = await window.sb.storage.from("dress-code").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  },

  async deleteDressCodeImage(path) {
    if (!path) return;
    await window.sb.storage.from("dress-code").remove([path]);
  },

  getDressCodeUrl(path) {
    if (!path) return null;
    const { data } = window.sb.storage.from("dress-code").getPublicUrl(path);
    return data.publicUrl;
  },

  async listPeople() {
    const { data, error } = await window.sb.from("people").select("*").order("name");
    if (error) throw error;
    return data;
  },

  async syncPeople(names) {
    const unique = [...new Set(names.map((n) => (n || "").trim()).filter((n) => n && n !== "-"))];
    if (!unique.length) return;
    const { error } = await window.sb
      .from("people")
      .upsert(unique.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true });
    if (error) throw error;
  },

  async _replaceTimes(scheduleId, times) {
    await window.sb.from("schedule_times").delete().eq("schedule_id", scheduleId);
    const rows = times
      .filter((t) => t.service_time)
      .map((t) => ({ schedule_id: scheduleId, service_time: t.service_time, note: t.note || null }));
    if (rows.length) {
      const { error } = await window.sb.from("schedule_times").insert(rows);
      if (error) throw error;
    }
  },

  async _replaceAssignments(scheduleId, assignments) {
    await window.sb.from("schedule_assignments").delete().eq("schedule_id", scheduleId);
    const rows = assignments.map((a, i) => ({
      schedule_id: scheduleId,
      role_group: a.role_group,
      role: a.role,
      role_order: i,
      person_name: a.person_name || null,
    }));
    if (rows.length) {
      const { error } = await window.sb.from("schedule_assignments").insert(rows);
      if (error) throw error;
    }
  },
};
