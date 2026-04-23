// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO — Backend client (Supabase API-compatible)
//
// In production this file is replaced by ~3 lines:
//     import { createClient } from '@supabase/supabase-js'
//     export const db = createClient(URL, ANON_KEY)
//
// For the prototype we provide a mock that implements the same surface
// against localStorage with a simple pub/sub event bus. Every screen talks
// to window.HZdb — swap the implementation, the screens don't change.
// ─────────────────────────────────────────────────────────────────────────────
(function(){
  const LS_KEY = 'hz_db_v1';
  const listeners = new Map(); // table -> Set<fn>
  const authListeners = new Set();

  // ─── Seed tables from the existing HZ_* globals ───
  function seed() {
    const roster = window.HZ_ROSTER || [];
    const team = window.HZ_TEAM || {};
    const skillTree = window.HZ_SKILL_TREE || {};
    const skills = [];
    Object.keys(skillTree).forEach(cat => {
      skillTree[cat].skills.forEach(s => skills.push({ id: s.id, category: cat, name: s.name, level: s.level }));
    });
    const athleteSkills = [];
    roster.forEach(a => {
      const aSkills = (window.HZ_INITIAL_SKILLS && window.HZ_INITIAL_SKILLS[a.id]) || {};
      Object.keys(aSkills).forEach(sid => {
        athleteSkills.push({ athlete_id: a.id, skill_id: sid, status: aSkills[sid], note: null, updated_at: new Date().toISOString() });
      });
    });
    const sessions = (window.HZ_SESSIONS || []).map(s => ({
      id: s.id,
      team_id: team.id,
      scheduled_at: s.date + 'T17:30:00',
      duration_min: s.duration,
      type: s.type,
      is_competition: !!s.comp,
      scheduled: !!s.scheduled,
    }));
    const attendance = [];
    (window.HZ_SESSIONS || []).forEach(s => {
      (s.attended || []).forEach(aid => attendance.push({ session_id: s.id, athlete_id: aid, status: 'present' }));
    });
    const routine = window.HZ_DEFAULT_ROUTINE ? {
      id: window.HZ_DEFAULT_ROUTINE.id,
      team_id: team.id,
      name: window.HZ_DEFAULT_ROUTINE.name,
      length_counts: window.HZ_DEFAULT_ROUTINE.length,
      bpm: window.HZ_DEFAULT_ROUTINE.bpm,
    } : null;
    const routineSections = (window.HZ_DEFAULT_ROUTINE?.sections || []).map((s, i) => ({
      id: s.id, routine_id: window.HZ_DEFAULT_ROUTINE.id,
      section_type: s.type, label: s.label, start_count: s.start, end_count: s.end, position: i,
    }));

    // Billing from roster.paid/owed
    const billingAccounts = roster.map(a => ({
      id: 'b_' + a.id, athlete_id: a.id, season_total: a.paid + a.owed, paid: a.paid, owed: a.owed, autopay: a.owed === 0,
    }));
    const billingCharges = [];
    roster.forEach(a => {
      const acctId = 'b_' + a.id;
      ['May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'].forEach((m, i) => {
        billingCharges.push({
          id: 'c_' + a.id + '_' + i,
          account_id: acctId,
          kind: 'monthly',
          amount: 400,
          due_at: '2025-' + String(((i+4)%12)+1).padStart(2,'0') + '-01',
          paid_at: i < 10 ? new Date().toISOString() : null,
        });
      });
    });

    // Celebrations - seed a few
    const celebrations = [
      { id: 'cel1', team_id: team.id, athlete_id: 'a07', kind: 'skill_progress', skill_id: 'rt_ro_bhs_layout', from_status: 'working', to_status: 'got_it', headline: 'Rylee just got RO BHS Layout', created_at: new Date(Date.now()-1000*60*12).toISOString() },
      { id: 'cel2', team_id: team.id, athlete_id: 'a01', kind: 'skill_progress', skill_id: 's_full_up_lib', from_status: 'got_it', to_status: 'mastered', headline: 'Kenzie mastered Full Up to Liberty', created_at: new Date(Date.now()-1000*60*47).toISOString() },
      { id: 'cel3', team_id: team.id, athlete_id: 'a14', kind: 'skill_progress', skill_id: 'rt_ro_bhs_full', from_status: 'working', to_status: 'got_it', headline: 'Ashton landed RO BHS Full', created_at: new Date(Date.now()-1000*60*60*3).toISOString() },
      { id: 'cel4', team_id: team.id, athlete_id: 'a03', kind: 'milestone', headline: 'Brooklyn hit 100% attendance this month', created_at: new Date(Date.now()-1000*60*60*24).toISOString() },
    ];

    const announcements = [
      { id: 'an1', program_id: 'p_mca', audience: 'all', title: 'Dream On competition — 20 days out', body: 'Bus leaves the gym 6 AM Friday May 8. Uniform + warm-ups + red bow required. Parents: hotel block info in email.', pinned: true, created_at: new Date(Date.now()-1000*60*60*6).toISOString(), created_by: 'owner' },
      { id: 'an2', program_id: 'p_mca', audience: 'parents', title: 'Choreo fee — final reminder', body: 'Final $150 choreo balance due Friday. Venmo @magiccityallstars or square link in your billing tab.', pinned: false, created_at: new Date(Date.now()-1000*60*60*24*2).toISOString(), created_by: 'owner' },
    ];

    return {
      programs: [{ id: 'p_mca', name: 'Magic City Allstars', city: 'Minot, ND' }],
      teams: [{ id: team.id, program_id: 'p_mca', name: team.name, division: team.division, level: team.level, season_start: team.seasonStart }],
      profiles: [
        { id: 'u_coach', program_id: 'p_mca', role: 'coach', display_name: 'Coach Jamie', email: 'jamie@magiccityallstars.com' },
        { id: 'u_owner', program_id: 'p_mca', role: 'owner', display_name: 'Erin Magic', email: 'erin@magiccityallstars.com' },
        { id: 'u_athlete', program_id: 'p_mca', role: 'athlete', display_name: 'Kenzie Rhodes', email: 'kenzie@demo.com' },
        { id: 'u_parent', program_id: 'p_mca', role: 'parent', display_name: 'Sam Rhodes', email: 'sam@demo.com' },
      ],
      athletes: roster.map(a => ({
        id: a.id, team_id: team.id, display_name: a.name, initials: a.initials, age: a.age,
        role: a.role, photo_color: a.photo, joined_at: a.joined + '-15',
      })),
      parent_links: [{ parent_id: 'u_parent', athlete_id: 'a01' }],
      skills,
      athlete_skills: athleteSkills,
      routines: routine ? [routine] : [],
      routine_sections: routineSections,
      sessions,
      attendance,
      celebrations,
      billing_accounts: billingAccounts,
      billing_charges: billingCharges,
      announcements,
      score_runs: [],
      score_deductions: [],
    };
  }

  // ─── Load / save ───
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    const fresh = seed();
    save(fresh);
    return fresh;
  }
  function save(d) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {}
  }

  let data = load();

  // ─── Notify listeners on mutations ───
  function emit(table, event) {
    (listeners.get(table) || new Set()).forEach(fn => fn(event));
    (listeners.get('*') || new Set()).forEach(fn => fn({ table, ...event }));
  }

  // ─── Query builder (Supabase-like) ───
  function from(table) {
    const state = {
      op: 'select',
      filters: [],
      _cols: '*',
      _order: null,
      _limit: null,
      _single: false,
      _payload: null,
      _update: null,
      _match: null,
    };

    function apply(rows) {
      let r = rows;
      state.filters.forEach(f => { r = r.filter(f); });
      if (state._order) {
        const { col, asc } = state._order;
        r = [...r].sort((a,b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      }
      if (state._limit) r = r.slice(0, state._limit);
      return r;
    }

    const api = {
      select(cols) { state.op = 'select'; state._cols = cols || '*'; return api; },
      insert(payload) { state.op = 'insert'; state._payload = Array.isArray(payload) ? payload : [payload]; return api; },
      update(patch) { state.op = 'update'; state._update = patch; return api; },
      upsert(payload, opts) { state.op = 'upsert'; state._payload = Array.isArray(payload) ? payload : [payload]; state._onConflict = (opts && opts.onConflict) || 'id'; return api; },
      delete() { state.op = 'delete'; return api; },
      eq(col, val) { state.filters.push(r => r[col] === val); return api; },
      neq(col, val) { state.filters.push(r => r[col] !== val); return api; },
      in(col, vals) { state.filters.push(r => vals.includes(r[col])); return api; },
      gte(col, val) { state.filters.push(r => r[col] >= val); return api; },
      lte(col, val) { state.filters.push(r => r[col] <= val); return api; },
      match(m) { Object.keys(m).forEach(k => state.filters.push(r => r[k] === m[k])); return api; },
      order(col, opts) { state._order = { col, asc: !(opts && opts.ascending === false) }; return api; },
      limit(n) { state._limit = n; return api; },
      single() { state._single = true; return api; },
      then(resolve, reject) {
        try {
          let result;
          if (state.op === 'select') {
            const rows = apply(data[table] || []);
            result = state._single ? rows[0] || null : rows;
          } else if (state.op === 'insert') {
            const withIds = state._payload.map(p => ({ ...p, id: p.id || ('x_' + Math.random().toString(36).slice(2,10)) }));
            data[table] = [...(data[table] || []), ...withIds];
            save(data);
            withIds.forEach(row => emit(table, { eventType: 'INSERT', new: row, old: null }));
            result = state._single ? withIds[0] : withIds;
          } else if (state.op === 'update') {
            const updated = [];
            data[table] = (data[table] || []).map(r => {
              if (state.filters.every(f => f(r))) {
                const next = { ...r, ...state._update };
                updated.push({ old: r, new: next });
                return next;
              }
              return r;
            });
            save(data);
            updated.forEach(({ old, new: n }) => emit(table, { eventType: 'UPDATE', new: n, old }));
            result = updated.map(u => u.new);
          } else if (state.op === 'upsert') {
            const key = state._onConflict;
            const compositeKey = key.includes(',');
            const keys = compositeKey ? key.split(',').map(s => s.trim()) : [key];
            const matches = (a,b) => keys.every(k => a[k] === b[k]);
            const results = [];
            state._payload.forEach(p => {
              const idx = (data[table] || []).findIndex(r => matches(r, p));
              if (idx >= 0) {
                const old = data[table][idx];
                const next = { ...old, ...p };
                data[table][idx] = next;
                results.push(next);
                emit(table, { eventType: 'UPDATE', new: next, old });
              } else {
                const withId = { ...p, id: p.id || ('x_' + Math.random().toString(36).slice(2,10)) };
                data[table] = [...(data[table] || []), withId];
                results.push(withId);
                emit(table, { eventType: 'INSERT', new: withId, old: null });
              }
            });
            save(data);
            result = results;
          } else if (state.op === 'delete') {
            const kept = [], removed = [];
            (data[table] || []).forEach(r => (state.filters.every(f => f(r)) ? removed : kept).push(r));
            data[table] = kept;
            save(data);
            removed.forEach(r => emit(table, { eventType: 'DELETE', new: null, old: r }));
            result = removed;
          }
          resolve({ data: result, error: null });
        } catch (e) {
          resolve({ data: null, error: e });
          if (reject) reject(e);
        }
      },
    };
    return api;
  }

  // ─── Realtime channel API ───
  function channel(name) {
    const subs = [];
    return {
      on(event, cfg, cb) {
        const { table } = cfg || {};
        const handler = (e) => {
          if (event === 'postgres_changes') cb(e);
        };
        const set = listeners.get(table) || new Set();
        set.add(handler);
        listeners.set(table, set);
        subs.push({ table, handler });
        return this;
      },
      subscribe(cb) { cb && cb('SUBSCRIBED'); return this; },
      unsubscribe() {
        subs.forEach(({ table, handler }) => listeners.get(table)?.delete(handler));
      },
    };
  }

  // ─── Auth ───
  const AUTH_KEY = 'hz_auth_v1';
  function getSession() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; }
  }
  function setSession(session) {
    if (session) localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    else localStorage.removeItem(AUTH_KEY);
    authListeners.forEach(fn => fn(session ? 'SIGNED_IN' : 'SIGNED_OUT', session));
  }

  const auth = {
    async signInAsRole(role) {
      // Demo auth: map role to seeded profile
      const profile = (data.profiles || []).find(p => p.role === role);
      if (!profile) return { data: null, error: new Error('no profile') };
      const session = { user: { id: profile.id, email: profile.email }, profile };
      setSession(session);
      return { data: { session }, error: null };
    },
    async signOut() { setSession(null); return { error: null }; },
    getSession() { return Promise.resolve({ data: { session: getSession() }, error: null }); },
    onAuthStateChange(cb) {
      authListeners.add(cb);
      cb(getSession() ? 'SIGNED_IN' : 'SIGNED_OUT', getSession());
      return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
    },
    // Synchronous helper just for the prototype
    _getSession: getSession,
    _setSession: setSession,
  };

  // ─── Public surface ───
  window.HZdb = {
    from, channel, auth,
    // Escape hatches for the prototype (not present in real Supabase)
    _reset() { localStorage.removeItem(LS_KEY); data = load(); listeners.clear(); },
    _raw: () => data,
  };
})();
