// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO — Selectors. Pure derivations from DB state.
// All computation lives here so screens stay dumb. Matches the shape of
// HZSelect from the iOS prototype but sources from HZdb.
// ─────────────────────────────────────────────────────────────────────────────
(function(){
  // Cache a snapshot of arrays for sync-style selectors — refreshed on mutation
  let cache = null;
  async function snapshot() {
    const q = (t) => (async () => (await window.HZdb.from(t).select('*')).data || [])();
    const [teams, athletes, skills, athlete_skills, sessions, attendance, routines, routine_sections, celebrations, billing_accounts, billing_charges, announcements, profiles] = await Promise.all([
      q('teams'), q('athletes'), q('skills'), q('athlete_skills'), q('sessions'),
      q('attendance'), q('routines'), q('routine_sections'), q('celebrations'),
      q('billing_accounts'), q('billing_charges'), q('announcements'), q('profiles'),
    ]);
    cache = { teams, athletes, skills, athlete_skills, sessions, attendance, routines, routine_sections, celebrations, billing_accounts, billing_charges, announcements, profiles };
    return cache;
  }

  const STATUS_PCT = { none: 0, working: 0.33, got_it: 0.75, mastered: 1.0 };

  function athleteById(id) { return cache?.athletes.find(a => a.id === id); }
  function skillById(id) { return cache?.skills.find(s => s.id === id); }
  function team() { return cache?.teams?.[0]; }

  // Per-athlete skill map { skillId: status }
  function athleteSkills(aid) {
    const map = {};
    (cache?.athlete_skills || []).filter(r => r.athlete_id === aid).forEach(r => { map[r.skill_id] = r.status; });
    return map;
  }

  function athleteReadiness(aid) {
    const t = team();
    if (!t) return 0;
    const map = athleteSkills(aid);
    let sum = 0, n = 0;
    (cache.skills || []).forEach(s => {
      if (s.level <= t.level) { sum += STATUS_PCT[map[s.id] || 'none']; n++; }
    });
    return n ? sum/n : 0;
  }

  function teamReadiness() {
    const t = team();
    if (!t) return 0;
    let sum = 0, n = 0;
    (cache.athletes || []).forEach(a => {
      const m = athleteSkills(a.id);
      (cache.skills || []).forEach(s => {
        if (s.level <= t.level) { sum += STATUS_PCT[m[s.id] || 'none']; n++; }
      });
    });
    return n ? sum/n : 0;
  }

  function categoryReadiness(cat) {
    const t = team();
    if (!t) return 0;
    const skillsInCat = (cache.skills || []).filter(s => s.category === cat && s.level <= t.level);
    let sum = 0, n = 0;
    (cache.athletes || []).forEach(a => {
      const m = athleteSkills(a.id);
      skillsInCat.forEach(s => { sum += STATUS_PCT[m[s.id] || 'none']; n++; });
    });
    return n ? sum/n : 0;
  }

  function athleteAttendance(aid) {
    const done = (cache.sessions || []).filter(s => !s.scheduled);
    const presentIds = new Set((cache.attendance || []).filter(a => a.athlete_id === aid && a.status === 'present').map(a => a.session_id));
    const attended = done.filter(s => presentIds.has(s.id)).length;
    return { attended, total: done.length, pct: done.length ? attended/done.length : 0 };
  }

  function teamAttendance() {
    const done = (cache.sessions || []).filter(s => !s.scheduled);
    const nAthletes = (cache.athletes || []).length;
    let sum = 0;
    done.forEach(s => {
      const present = (cache.attendance || []).filter(a => a.session_id === s.id && a.status === 'present').length;
      sum += present / Math.max(1, nAthletes);
    });
    return done.length ? sum/done.length : 0;
  }

  function athleteSkillsSummary(aid) {
    const m = athleteSkills(aid);
    let got = 0, mastered = 0, working = 0, total = 0;
    (cache.skills || []).forEach(s => {
      total++;
      const st = m[s.id] || 'none';
      if (st === 'got_it') got++;
      if (st === 'mastered') mastered++;
      if (st === 'working') working++;
    });
    return { got, mastered, working, total };
  }

  function routine() {
    const r = (cache.routines || [])[0];
    if (!r) return null;
    const secs = (cache.routine_sections || []).filter(s => s.routine_id === r.id).sort((a,b) => a.start_count - b.start_count);
    return { ...r, sections: secs };
  }

  // USASF score sheet rows — same weights as iOS version
  const SHEET = [
    { id: 'standing_tumbling', label: 'Standing Tumbling',   max: 12, category: 'standing_tumbling' },
    { id: 'running_tumbling',  label: 'Running Tumbling',    max: 12, category: 'running_tumbling' },
    { id: 'jumps',             label: 'Jumps',               max: 8,  category: 'jumps' },
    { id: 'stunts',            label: 'Stunts',              max: 20, category: 'stunts' },
    { id: 'pyramid',           label: 'Pyramid',             max: 15, category: 'pyramids' },
    { id: 'baskets',           label: 'Baskets/Tosses',      max: 15, category: 'baskets' },
    { id: 'dance',             label: 'Dance',               max: 10, category: null },
    { id: 'routine',           label: 'Routine Composition', max: 8,  category: null },
  ];

  function predictedScore(extraDeductions) {
    const r = routine();
    if (!r) return { rows: [], subtotal: 0, deductions: 0, total: 0, max: 100 };
    const sectionsByType = {};
    r.sections.forEach(s => { sectionsByType[s.section_type] = (sectionsByType[s.section_type] || 0) + (s.end_count - s.start_count + 1); });

    const rows = SHEET.map(row => {
      let readiness = null;
      if (row.category) readiness = categoryReadiness(row.category);
      else if (row.id === 'dance') readiness = 0.82;
      else if (row.id === 'routine') {
        const keyTypes = ['standing_tumbling','running_tumbling','jumps','stunts','pyramid','dance'];
        const present = keyTypes.filter(t => sectionsByType[t] > 0).length / keyTypes.length;
        readiness = 0.6 + 0.35 * present;
      }
      let boost = 1;
      if (row.category) {
        const typeKey =
          row.category === 'standing_tumbling' ? 'standing_tumbling' :
          row.category === 'running_tumbling'  ? 'running_tumbling'  :
          row.category === 'stunts'            ? 'stunts'            :
          row.category === 'pyramids'          ? 'pyramid'           :
          row.category === 'baskets'           ? 'baskets'           :
          row.category === 'jumps'             ? 'jumps'             : null;
        if (typeKey) {
          const counts = sectionsByType[typeKey] || 0;
          boost = counts === 0 ? 0.35 : counts < 4 ? 0.8 : 1;
        }
      }
      const score = Math.max(0, Math.min(row.max, row.max * readiness * boost));
      return { ...row, readiness, boost, score };
    });
    const subtotal = rows.reduce((s,r) => s + r.score, 0);
    const deductions = (extraDeductions || []).reduce((s,d) => s + d.value, 0);
    const total = Math.max(0, subtotal - deductions);
    return { rows, subtotal, deductions, total, max: 100 };
  }

  function daysToComp() {
    // Next competition session
    const comp = (cache.sessions || []).find(s => s.is_competition);
    if (!comp) return null;
    const ms = new Date(comp.scheduled_at).getTime() - Date.now();
    return { days: Math.max(0, Math.ceil(ms / (1000*60*60*24))), session: comp };
  }

  // Needs-work queue: skills that multiple athletes are still 'working' on at team level
  function needsWorkQueue() {
    const t = team();
    if (!t) return [];
    const map = {}; // skillId -> { working, gotIt, notStarted }
    (cache.athlete_skills || []).forEach(r => {
      const s = skillById(r.skill_id);
      if (!s || s.level > t.level) return;
      map[r.skill_id] = map[r.skill_id] || { skill: s, working: 0, notStarted: 0, gotIt: 0, mastered: 0 };
      if (r.status === 'working') map[r.skill_id].working++;
      else if (r.status === 'none') map[r.skill_id].notStarted++;
      else if (r.status === 'got_it') map[r.skill_id].gotIt++;
      else map[r.skill_id].mastered++;
    });
    const items = Object.values(map)
      .filter(x => x.working + x.notStarted >= 3)
      .sort((a,b) => (b.working + b.notStarted*0.8) - (a.working + a.notStarted*0.8))
      .slice(0, 8);
    return items;
  }

  // Billing summary across all athletes
  function programBilling() {
    const accounts = cache.billing_accounts || [];
    const paid = accounts.reduce((s,a) => s + (a.paid || 0), 0);
    const owed = accounts.reduce((s,a) => s + (a.owed || 0), 0);
    const delinquent = accounts.filter(a => (a.owed || 0) > 0).length;
    return { paid, owed, delinquent, total: paid + owed, nAccounts: accounts.length };
  }

  function athleteBilling(aid) {
    const account = (cache.billing_accounts || []).find(a => a.athlete_id === aid);
    if (!account) return null;
    const charges = (cache.billing_charges || []).filter(c => c.account_id === account.id);
    return { account, charges };
  }

  window.HZsel = {
    snapshot,
    // getters (sync — require snapshot() first)
    cache: () => cache,
    team, athleteById, skillById, routine,
    athleteSkills, athleteReadiness, teamReadiness, categoryReadiness,
    athleteAttendance, teamAttendance, athleteSkillsSummary,
    predictedScore, daysToComp, needsWorkQueue, programBilling, athleteBilling,
    SHEET,
    STATUS_PCT,
  };
})();
