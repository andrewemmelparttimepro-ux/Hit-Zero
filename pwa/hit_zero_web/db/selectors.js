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
    const [
      teams, athletes, skills, athlete_skills, sessions, attendance, routines, routine_sections, celebrations, billing_accounts, billing_charges, announcements, profiles,
      // Tier 1 + Tier 2 additions
      message_threads, thread_members, messages, message_reads,
      session_availability, calendar_tokens,
      registration_windows, registrations,
      waiver_templates, waiver_signatures,
      form_templates, form_fields, form_responses, form_answers,
      emergency_contacts, medical_records, injuries,
      uniforms, uniform_items, uniform_orders,
      leads, lead_touches,
      volunteer_roles, volunteer_assignments,
      drills, practice_plans, practice_plan_blocks, parent_links,
      // AI Routine Judge
      rubric_versions, rubric_categories,
      routine_analyses, analysis_elements, analysis_deductions,
      analysis_feedback, analysis_skill_updates,
    ] = await Promise.all([
      q('teams'), q('athletes'), q('skills'), q('athlete_skills'), q('sessions'),
      q('attendance'), q('routines'), q('routine_sections'), q('celebrations'),
      q('billing_accounts'), q('billing_charges'), q('announcements'), q('profiles'),
      q('message_threads'), q('thread_members'), q('messages'), q('message_reads'),
      q('session_availability'), q('calendar_tokens'),
      q('registration_windows'), q('registrations'),
      q('waiver_templates'), q('waiver_signatures'),
      q('form_templates'), q('form_fields'), q('form_responses'), q('form_answers'),
      q('emergency_contacts'), q('medical_records'), q('injuries'),
      q('uniforms'), q('uniform_items'), q('uniform_orders'),
      q('leads'), q('lead_touches'),
      q('volunteer_roles'), q('volunteer_assignments'),
      q('drills'), q('practice_plans'), q('practice_plan_blocks'), q('parent_links'),
      q('rubric_versions'), q('rubric_categories'),
      q('routine_analyses'), q('analysis_elements'), q('analysis_deductions'),
      q('analysis_feedback'), q('analysis_skill_updates'),
    ]);
    cache = {
      teams, athletes, skills, athlete_skills, sessions, attendance, routines, routine_sections, celebrations, billing_accounts, billing_charges, announcements, profiles,
      message_threads, thread_members, messages, message_reads,
      session_availability, calendar_tokens,
      registration_windows, registrations,
      waiver_templates, waiver_signatures,
      form_templates, form_fields, form_responses, form_answers,
      emergency_contacts, medical_records, injuries,
      uniforms, uniform_items, uniform_orders,
      leads, lead_touches,
      volunteer_roles, volunteer_assignments,
      drills, practice_plans, practice_plan_blocks, parent_links,
      rubric_versions, rubric_categories,
      routine_analyses, analysis_elements, analysis_deductions,
      analysis_feedback, analysis_skill_updates,
    };
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

  // ─── Tier 1 / Tier 2 selectors ───────────────────────────────────────────

  // Messaging — inbox: threads user is a member of, sorted by last activity.
  function inboxThreads(profileId) {
    const myThreadIds = new Set(
      (cache.thread_members || []).filter(m => m.profile_id === profileId).map(m => m.thread_id)
    );
    const threads = (cache.message_threads || []).filter(t => myThreadIds.has(t.id));
    threads.sort((a,b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at));
    return threads.map(t => {
      const reads = (cache.message_reads || []).find(r => r.thread_id === t.id && r.profile_id === profileId);
      const lastReadAt = reads ? new Date(reads.last_read_at).getTime() : 0;
      const msgs = (cache.messages || []).filter(m => m.thread_id === t.id);
      const last = msgs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
      const unread = msgs.filter(m => new Date(m.created_at).getTime() > lastReadAt && m.author_id !== profileId).length;
      const members = (cache.thread_members || []).filter(m => m.thread_id === t.id);
      return { ...t, unread, last, memberCount: members.length };
    });
  }

  function threadMessages(threadId) {
    return (cache.messages || [])
      .filter(m => m.thread_id === threadId)
      .sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  }

  function threadMembers(threadId) {
    const members = (cache.thread_members || []).filter(m => m.thread_id === threadId);
    return members.map(m => ({
      ...m,
      profile: (cache.profiles || []).find(p => p.id === m.profile_id)
    }));
  }

  // RSVP roll-up for a session
  function sessionRsvp(sessionId) {
    const rows = (cache.session_availability || []).filter(r => r.session_id === sessionId);
    const tally = { going: 0, maybe: 0, no: 0, unknown: 0 };
    rows.forEach(r => tally[r.status] = (tally[r.status] || 0) + 1);
    const total = (cache.athletes || []).length;
    tally.unknown = Math.max(0, total - tally.going - tally.maybe - tally.no);
    return tally;
  }

  // Upcoming sessions (scheduled, future or today), sorted ascending
  function upcomingSessions(limit = 10) {
    const now = Date.now();
    return (cache.sessions || [])
      .filter(s => s.scheduled && new Date(s.scheduled_at).getTime() >= now - 86400000)
      .sort((a,b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
      .slice(0, limit);
  }

  // Medical roll-up per athlete
  function athleteMedical(aid) {
    return {
      record: (cache.medical_records || []).find(m => m.athlete_id === aid) || null,
      contacts: (cache.emergency_contacts || []).filter(c => c.athlete_id === aid),
      injuries: (cache.injuries || []).filter(i => i.athlete_id === aid).sort((a,b) => new Date(b.occurred_at) - new Date(a.occurred_at)),
    };
  }

  // Uniforms
  function uniformsWithItems() {
    return (cache.uniforms || []).map(u => ({
      ...u,
      items: (cache.uniform_items || []).filter(i => i.uniform_id === u.id)
    }));
  }
  function athleteUniformOrders(aid) {
    return (cache.uniform_orders || []).filter(o => o.athlete_id === aid);
  }

  // Leads pipeline
  function leadsByStage() {
    const stages = ['new','contacted','tour','trial','converted','lost'];
    const out = {};
    stages.forEach(s => out[s] = []);
    (cache.leads || []).forEach(l => (out[l.stage] || (out[l.stage] = [])).push(l));
    stages.forEach(s => out[s].sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)));
    return out;
  }
  function leadTouches(leadId) {
    return (cache.lead_touches || []).filter(t => t.lead_id === leadId).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // Forms
  function formTemplatesActive() {
    return (cache.form_templates || []).filter(t => t.is_active);
  }
  function formResponsesForTemplate(templateId) {
    return (cache.form_responses || []).filter(r => r.template_id === templateId).sort((a,b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  }

  // Volunteers
  function volunteerRolesAndAssignments(sessionId) {
    const assignments = (cache.volunteer_assignments || []).filter(a => a.session_id === sessionId);
    return (cache.volunteer_roles || []).map(r => {
      const mine = assignments.filter(a => a.role_id === r.id);
      return { role: r, assignments: mine };
    });
  }

  // Practice plans
  function practicePlanForSession(sessionId) {
    const plan = (cache.practice_plans || []).find(p => p.session_id === sessionId);
    if (!plan) return null;
    const blocks = (cache.practice_plan_blocks || []).filter(b => b.plan_id === plan.id).sort((a,b) => a.position - b.position);
    return { plan, blocks };
  }
  function allPracticePlans() {
    return (cache.practice_plans || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // Registrations
  function pendingRegistrations() {
    return (cache.registrations || []).filter(r => r.status === 'pending').sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // ─── AI Routine Judge selectors ──────────────────────────────────────────
  function activeRubric() {
    return (cache.rubric_versions || []).find(v => v.is_active) || (cache.rubric_versions || [])[0] || null;
  }
  function rubricCategories(versionId) {
    const vid = versionId || activeRubric()?.id;
    return (cache.rubric_categories || []).filter(c => c.version_id === vid).sort((a,b) => a.position - b.position);
  }
  function recentAnalyses(limit = 12) {
    return [...(cache.routine_analyses || [])]
      .sort((a, b) => new Date(b.created_at || b.queued_at) - new Date(a.created_at || a.queued_at))
      .slice(0, limit);
  }
  function analysisById(id) {
    return (cache.routine_analyses || []).find(a => a.id === id) || null;
  }
  function elementsFor(id) {
    return (cache.analysis_elements || [])
      .filter(e => e.analysis_id === id)
      .sort((a, b) => a.t_start_ms - b.t_start_ms);
  }
  function deductionsFor(id) {
    return (cache.analysis_deductions || [])
      .filter(d => d.analysis_id === id)
      .sort((a, b) => (a.t_ms || 0) - (b.t_ms || 0));
  }
  function feedbackFor(id, audience) {
    let rows = (cache.analysis_feedback || []).filter(f => f.analysis_id === id);
    if (audience) rows = rows.filter(f => f.audience === audience);
    return rows.sort((a, b) => a.priority - b.priority);
  }
  function pendingProposalsFor(id) {
    return (cache.analysis_skill_updates || []).filter(p => p.analysis_id === id && p.status === 'pending');
  }
  function scoreTrend(teamId, limit = 8) {
    return (cache.routine_analyses || [])
      .filter(a => a.team_id === teamId && a.status === 'complete' && a.total_score != null)
      .sort((a, b) => new Date(a.completed_at || a.created_at) - new Date(b.completed_at || b.created_at))
      .slice(-limit)
      .map(a => ({ id: a.id, t: a.completed_at || a.created_at, pct: Number(a.scorecard?.pct ?? a.total_score ?? 0) }));
  }

  // Re-populate the cache from the current HZdb data without re-fetching.
  // Used by the mirror (index.html) after it injects real Supabase rows so
  // selectors see them immediately.
  async function _refresh() { await snapshot(); }

  window.HZsel = {
    snapshot, _refresh,
    // getters (sync — require snapshot() first)
    cache: () => cache,
    team, athleteById, skillById, routine,
    athleteSkills, athleteReadiness, teamReadiness, categoryReadiness,
    athleteAttendance, teamAttendance, athleteSkillsSummary,
    predictedScore, daysToComp, needsWorkQueue, programBilling, athleteBilling,
    // Tier 1/2
    inboxThreads, threadMessages, threadMembers,
    sessionRsvp, upcomingSessions,
    athleteMedical,
    uniformsWithItems, athleteUniformOrders,
    leadsByStage, leadTouches,
    formTemplatesActive, formResponsesForTemplate,
    volunteerRolesAndAssignments,
    practicePlanForSession, allPracticePlans,
    pendingRegistrations,
    // AI Judge
    activeRubric, rubricCategories,
    recentAnalyses, analysisById,
    elementsFor, deductionsFor, feedbackFor,
    pendingProposalsFor, scoreTrend,
    SHEET,
    STATUS_PCT,
  };
})();
