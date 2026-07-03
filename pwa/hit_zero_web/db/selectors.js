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
      programs, teams, athletes, skills, athlete_skills, sessions, attendance, routines, routine_sections,
      routine_audio_assets, music_licenses, routine_count_maps, routine_events,
      routine_formations, routine_positions, routine_assignments, routine_ai_suggestions, routine_exports,
      routine_versions, routine_comments,
      routine_audio_analysis_jobs, routine_remix_requests, routine_music_compliance_checks,
      celebrations, billing_accounts, billing_charges, program_payment_settings, announcements, profiles,
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
      pin_designs, athlete_pins, pin_drops, pin_quests,
      // AI Routine Judge
      rubric_versions, rubric_categories,
      routine_analyses, analysis_elements, analysis_deductions,
      analysis_feedback, analysis_skill_updates,
      // Owner-managed offerings (drives the marketing site)
      program_tracks, program_classes,
      family_info_packets, class_enrollments,
    ] = await Promise.all([
      q('programs'), q('teams'), q('athletes'), q('skills'), q('athlete_skills'), q('sessions'),
      q('attendance'), q('routines'), q('routine_sections'),
      q('routine_audio_assets'), q('music_licenses'), q('routine_count_maps'), q('routine_events'),
      q('routine_formations'), q('routine_positions'), q('routine_assignments'), q('routine_ai_suggestions'), q('routine_exports'),
      q('routine_versions'), q('routine_comments'),
      q('routine_audio_analysis_jobs'), q('routine_remix_requests'), q('routine_music_compliance_checks'),
      q('celebrations'),
      q('billing_accounts'), q('billing_charges'), q('program_payment_settings'), q('announcements'), q('profiles'),
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
      q('pin_designs'), q('athlete_pins'), q('pin_drops'), q('pin_quests'),
      q('rubric_versions'), q('rubric_categories'),
      q('routine_analyses'), q('analysis_elements'), q('analysis_deductions'),
      q('analysis_feedback'), q('analysis_skill_updates'),
      q('program_tracks'), q('program_classes'),
      q('family_info_packets'), q('class_enrollments'),
    ]);
    cache = {
      programs, teams, athletes, skills, athlete_skills, sessions, attendance, routines, routine_sections,
      routine_audio_assets, music_licenses, routine_count_maps, routine_events,
      routine_formations, routine_positions, routine_assignments, routine_ai_suggestions, routine_exports,
      routine_versions, routine_comments,
      routine_audio_analysis_jobs, routine_remix_requests, routine_music_compliance_checks,
      celebrations, billing_accounts, billing_charges, program_payment_settings, announcements, profiles,
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
      pin_designs, athlete_pins, pin_drops, pin_quests,
      rubric_versions, rubric_categories,
      routine_analyses, analysis_elements, analysis_deductions,
      analysis_feedback, analysis_skill_updates,
      program_tracks, program_classes,
      family_info_packets, class_enrollments,
    };
    return cache;
  }

  const STATUS_PCT = { none: 0, working: 0.33, got_it: 0.75, mastered: 1.0 };
  const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
  const isSettledRegistrationPayment = (status) => status === 'paid' || status === 'comped';

  function athleteById(id) { return cache?.athletes.find(a => a.id === id); }
  function skillById(id) { return cache?.skills.find(s => s.id === id); }
  function currentSession() {
    try { return window.HZdb?.auth?._getSession?.() || null; } catch { return null; }
  }
  function activeProgramId() {
    const session = currentSession();
    const raw = session?.actualProfile?.program_id || session?.profile?.program_id || null;
    return window.HZisPlaceholderProgramId?.(raw) ? null : raw;
  }
  function programProfile() {
    const pid = activeProgramId();
    return (pid ? cache?.programs?.find(p => p.id === pid) : null)
      || cache?.programs?.find(p => !window.HZisPlaceholderProgramId?.(p.id))
      || cache?.programs?.[0]
      || null;
  }
  function programPaymentSettings() {
    const pid = programProfile()?.id;
    return (pid ? cache?.program_payment_settings?.find(p => p.program_id === pid) : null) || cache?.program_payment_settings?.[0] || null;
  }
  function team() {
    const pid = programProfile()?.id;
    return (pid ? cache?.teams?.find(t => t.program_id === pid) : null) || cache?.teams?.[0];
  }

  function programTeams() {
    const pid = programProfile()?.id;
    return (cache?.teams || [])
      .filter(t => !pid || t.program_id === pid)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  function programAthletes() {
    const teamIds = new Set(programTeams().map(t => t.id));
    const pid = programProfile()?.id;
    return (cache?.athletes || [])
      .filter(a => !a.deleted_at && ((!pid && !teamIds.size) || teamIds.has(a.team_id) || a.program_id === pid))
      .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
  }

  function athletesForTeam(teamId) {
    return (teamId ? programAthletes().filter(a => a.team_id === teamId) : programAthletes())
      .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
  }

  // Owner-managed offerings (drives the marketing site)
  function programTracks() {
    const programId = programProfile()?.id;
    return (cache?.program_tracks || [])
      .filter(t => !programId || t.program_id === programId)
      .slice()
      .sort((a, b) => (a.display_order ?? 100) - (b.display_order ?? 100) || (a.name || '').localeCompare(b.name || ''));
  }

  function programClasses(trackId) {
    const programId = programProfile()?.id;
    return (cache?.program_classes || [])
      .filter(c => (!programId || c.program_id === programId) && (!trackId || c.track_id === trackId))
      .slice()
      .sort((a, b) => (a.display_order ?? 100) - (b.display_order ?? 100) || (a.name || '').localeCompare(b.name || ''));
  }

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
    const athlete = athleteById(aid);
    const now = Date.now();
    const done = (cache.sessions || []).filter(s => {
      if (athlete?.team_id && s.team_id && s.team_id !== athlete.team_id) return false;
      if (s.scheduled === false) return true;
      const when = new Date(s.scheduled_at || s.date || 0).getTime();
      return Number.isFinite(when) && when <= now;
    });
    const presentIds = new Set((cache.attendance || []).filter(a => a.athlete_id === aid && a.status === 'present').map(a => a.session_id));
    const attended = done.filter(s => presentIds.has(s.id)).length;
    return { attended, total: done.length, pct: done.length ? attended/done.length : null, empty: done.length === 0 };
  }

  function teamAttendance() {
    const now = Date.now();
    const done = (cache.sessions || []).filter(s => {
      if (s.scheduled === false) return true;
      const when = new Date(s.scheduled_at || s.date || 0).getTime();
      return Number.isFinite(when) && when <= now;
    });
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
    let got = 0, mastered = 0, working = 0, assessed = 0, total = 0;
    (cache.skills || []).forEach(s => {
      total++;
      const st = m[s.id] || 'none';
      if (st !== 'none') assessed++;
      if (st === 'got_it') got++;
      if (st === 'mastered') mastered++;
      if (st === 'working') working++;
    });
    return { got, mastered, working, assessed, total, empty: total === 0, notAssessed: total > 0 && assessed === 0 };
  }

  function routine() {
    const r = (cache.routines || [])[0];
    if (!r) return null;
    const secs = (cache.routine_sections || []).filter(s => s.routine_id === r.id).sort((a,b) => a.start_count - b.start_count);
    const audioAssets = (cache.routine_audio_assets || []).filter(a => a.routine_id === r.id);
    const countMaps = (cache.routine_count_maps || []).filter(m => m.routine_id === r.id);
    const licenses = (cache.music_licenses || []).filter(l => l.routine_id === r.id);
    const events = (cache.routine_events || []).filter(e => e.routine_id === r.id).sort((a,b) => (a.count_index || 0) - (b.count_index || 0));
    const formations = (cache.routine_formations || []).filter(f => f.routine_id === r.id).sort((a,b) => (a.start_count || 0) - (b.start_count || 0));
    const formationIds = new Set(formations.map(f => f.id));
    const positions = (cache.routine_positions || []).filter(p => formationIds.has(p.formation_id));
    const assignments = (cache.routine_assignments || []).filter(a => a.routine_id === r.id).sort((a,b) => (a.count_index || 0) - (b.count_index || 0));
    const aiSuggestions = (cache.routine_ai_suggestions || []).filter(s => s.routine_id === r.id).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const exports = (cache.routine_exports || []).filter(e => e.routine_id === r.id).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const versions = (cache.routine_versions || []).filter(v => v.routine_id === r.id).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const comments = (cache.routine_comments || []).filter(c => c.routine_id === r.id).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const audioJobs = (cache.routine_audio_analysis_jobs || []).filter(j => j.routine_id === r.id).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const remixRequests = (cache.routine_remix_requests || []).filter(req => req.routine_id === r.id).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const complianceChecks = (cache.routine_music_compliance_checks || []).filter(ch => ch.routine_id === r.id).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return { ...r, sections: secs, audioAssets, countMaps, licenses, events, formations, positions, assignments, aiSuggestions, exports, versions, comments, audioJobs, remixRequests, complianceChecks };
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
    const pid = programProfile()?.id;
    const athletesInProgram = new Set((cache.athletes || [])
      .filter(a => {
        const t = (cache.teams || []).find(team => team.id === a.team_id);
        return !pid || t?.program_id === pid || a.program_id === pid;
      })
      .map(a => a.id));
    const accounts = (cache.billing_accounts || []).filter(a => !pid || athletesInProgram.has(a.athlete_id));
    const accountIds = new Set(accounts.map(a => a.id));
    const charges = (cache.billing_charges || []).filter(c => accountIds.has(c.account_id));
    const enrollments = (cache.class_enrollments || []).filter(row => !pid || row.program_id === pid);
    const registrations = (cache.registrations || []).filter(row => !pid || row.program_id === pid);
    const accountPaid = accounts.reduce((s,a) => s + Number(a.paid || 0), 0);
    const accountTotal = accounts.reduce((s,a) => s + Number(a.season_total || 0), 0);
    const chargePaid = charges.reduce((s,c) => s + ((c.paid_at || c.external_status === 'paid') ? Number(c.amount || 0) : 0), 0);
    const chargeTotal = charges.reduce((s,c) => s + Number(c.amount || 0), 0);
    const enrollmentPaid = enrollments.reduce((s,row) => s + (row.payment_status === 'paid' ? Number(row.amount_paid_cents || 0) / 100 : 0), 0);
    const registrationPaid = registrations.reduce((s,row) => s + (row.payment_status === 'paid' ? Number(row.amount_paid_cents || 0) / 100 : 0), 0);
    const estimatedRegistrationTotal = registrations.reduce((sum, row) => {
      const klass = classById(row.class_id);
      const priced = Number(klass?.price_cents || 0) / 100;
      const paid = Number(row.amount_paid_cents || 0) / 100;
      return sum + Math.max(priced, paid);
    }, 0);
    const paid = round2(Math.max(accountPaid, chargePaid, enrollmentPaid, registrationPaid));
    const total = round2(Math.max(accountTotal, chargeTotal, estimatedRegistrationTotal, enrollmentPaid, registrationPaid, paid));
    const owed = round2(Math.max(0, total - paid));
    const delinquent = accounts.filter(a => (a.owed || 0) > 0).length;
    const pendingRegistrations = registrations.filter(row => !isSettledRegistrationPayment(row.payment_status) && row.payment_status !== 'refunded').length;
    const syncedPaid = accounts.reduce((s,a) => s + Number(a.synced_paid || 0), 0);
    const syncedOpen = accounts.reduce((s,a) => s + Number(a.synced_open_amount || 0), 0);
    const syncedOpenInvoices = accounts.reduce((s,a) => s + Number(a.synced_open_invoice_count || 0), 0);
    const syncedAccounts = accounts.filter(a => a.sync_status === 'matched').length;
    const linkedAccounts = accounts.filter(a => a.payment_provider || a.external_customer_id).length;
    return {
      paid,
      owed,
      delinquent,
      total,
      nAccounts: accounts.length,
      nCharges: charges.length,
      registrations: registrations.length,
      paidRegistrations: registrations.filter(row => row.payment_status === 'paid').length,
      pendingRegistrations,
      classEnrollments: enrollments.length,
      classRevenue: round2(enrollmentPaid),
      registrationRevenue: round2(registrationPaid),
      syncedPaid: round2(syncedPaid),
      syncedOpen: round2(syncedOpen),
      syncedOpenInvoices,
      syncedAccounts,
      linkedAccounts,
      hasSquareData: syncedAccounts > 0 || linkedAccounts > 0,
    };
  }

  function athleteBilling(aid) {
    const account = (cache.billing_accounts || []).find(a => a.athlete_id === aid);
    if (!account) return null;
    const charges = (cache.billing_charges || []).filter(c => c.account_id === account.id);
    return { account, charges };
  }

  function classById(id) {
    return (cache.program_classes || []).find(c => c.id === id) || null;
  }

  function decorateClassEnrollment(row) {
    if (!row) return null;
    const klass = classById(row.class_id);
    return {
      ...row,
      class: klass,
      class_name: klass?.name || row.class_name || row.metadata?.class_name || 'Class registration',
      schedule_summary: row.schedule_summary || klass?.schedule_summary || row.metadata?.schedule_summary || '',
      starts_at: row.starts_at || klass?.starts_at || null,
      ends_at: row.ends_at || klass?.ends_at || null,
      receipt_url: row.receipt_url || row.metadata?.receipt_url || '',
    };
  }

  function classEnrollmentsForAthlete(aid) {
    const athlete = athleteById(aid);
    const athleteName = String(athlete?.display_name || '').trim().toLowerCase();
    return (cache.class_enrollments || [])
      .filter(row => row.athlete_id === aid || (!!athleteName && String(row.athlete_name || '').trim().toLowerCase() === athleteName))
      .map(decorateClassEnrollment)
      .sort((a, b) => new Date(a.starts_at || a.created_at || 0) - new Date(b.starts_at || b.created_at || 0));
  }

  function classEnrollmentsForParent(sessionOrProfile) {
    const profile = sessionOrProfile?.actualProfile || sessionOrProfile?.profile || sessionOrProfile || {};
    const email = String(profile.email || '').trim().toLowerCase();
    const scope = window.HZviewerScope ? window.HZviewerScope(cache, sessionOrProfile?.profile ? sessionOrProfile : { profile }) : null;
    const visibleIds = scope?.visibleAthleteIds || new Set();
    const allowEmailFallback = !scope?.isLive || (!profile.id && !visibleIds.size);
    const rows = (cache.class_enrollments || []).filter(row => {
      if (profile.id && row.parent_id === profile.id) return true;
      if (row.athlete_id && visibleIds.has(row.athlete_id)) return true;
      if (!allowEmailFallback) return false;
      return !!email
        && !row.parent_id
        && (!row.athlete_id || !visibleIds.size)
        && String(row.parent_email || '').trim().toLowerCase() === email;
    });
    const seen = new Set();
    return rows
      .map(decorateClassEnrollment)
      .filter(row => {
        const key = row.registration_id || row.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(a.starts_at || a.created_at || 0) - new Date(b.starts_at || b.created_at || 0));
  }

  function classEnrollmentsForProgram(programId) {
    const pid = programId || programProfile()?.id;
    return (cache.class_enrollments || [])
      .filter(row => !pid || row.program_id === pid)
      .map(decorateClassEnrollment)
      .sort((a, b) => new Date(a.starts_at || a.created_at || 0) - new Date(b.starts_at || b.created_at || 0));
  }

  function openGymRegistrationsForProgram(programId) {
    const pid = programId || programProfile()?.id;
    return (cache.registrations || [])
      .filter(row => {
        const meta = row.intake_metadata || {};
        return (!pid || row.program_id === pid) && (meta.participant_kind === 'open_gym' || meta.account_required === false);
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
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
    const session = (cache.sessions || []).find(s => s.id === sessionId);
    const total = (cache.athletes || []).filter(a => !session?.team_id || a.team_id === session.team_id).length;
    tally.unknown = Math.max(0, total - tally.going - tally.maybe - tally.no);
    return tally;
  }

  // Upcoming sessions (scheduled, future or today), sorted ascending
  function upcomingSessions(limit = 10) {
    const now = Date.now();
    return (cache.sessions || [])
      .filter(s => (s.scheduled !== false) && new Date(s.scheduled_at).getTime() >= now - 86400000)
      .sort((a,b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
      .slice(0, limit);
  }

  function staffScheduleSessions(limit = 16) {
    const teamIds = new Set(programTeams().map(t => t.id));
    const rows = (cache.sessions || [])
      .filter(s => (s.scheduled !== false) && (!teamIds.size || teamIds.has(s.team_id)))
      .sort((a,b) => new Date(a.scheduled_at || a.date || 0) - new Date(b.scheduled_at || b.date || 0));
    const now = Date.now();
    const future = rows.filter(s => new Date(s.scheduled_at || s.date || 0).getTime() >= now - 86400000);
    if (future.length) return future.slice(0, limit);
    return rows.reverse().slice(0, Math.min(limit, 8));
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
  function leadSummary() {
    const rows = cache.leads || [];
    const byStage = leadsByStage();
    const active = rows.filter(l => !['converted', 'lost'].includes(l.stage)).length;
    const converted = byStage.converted?.length || 0;
    return {
      total: rows.length,
      active,
      converted,
      new: byStage.new?.length || 0,
      tours: byStage.tour?.length || 0,
      trials: byStage.trial?.length || 0,
      winRate: rows.length ? Math.round((converted / rows.length) * 100) : 0,
    };
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
  function isCheckoutHold(row) {
    const meta = row?.intake_metadata || {};
    return !isSettledRegistrationPayment(row?.payment_status)
      && (meta.payment_gate_required === true || meta.payment_gate_state === 'checkout_started');
  }
  function pendingRegistrations() {
    return (cache.registrations || []).filter(r => r.status === 'pending' && !isCheckoutHold(r)).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  }
  function registrationSummary() {
    return (cache.registrations || []).filter(r => !isCheckoutHold(r)).reduce((out, row) => {
      out.total += 1;
      out[row.status] = (out[row.status] || 0) + 1;
      return out;
    }, { total: 0, pending: 0, accepted: 0, waitlist: 0, rejected: 0, withdrawn: 0 });
  }

  // Pins
  function pinDesignById(id) {
    return (cache.pin_designs || []).find(d => d.id === id) || null;
  }
  function pinInventory(aid) {
    return (cache.athlete_pins || [])
      .filter(row => row.athlete_id === aid)
      .map(row => ({ ...row, design: pinDesignById(row.design_id) }))
      .filter(row => row.design)
      .sort((a, b) =>
        Number(!!b.favorite) - Number(!!a.favorite) ||
        new Date(b.unlocked_at || 0) - new Date(a.unlocked_at || 0)
      );
  }
  function pinDropsForAthlete(aid) {
    return (cache.pin_drops || [])
      .filter(drop => drop.from_athlete_id === aid || drop.to_athlete_id === aid)
      .map(drop => ({
        ...drop,
        design: pinDesignById(drop.design_id),
        fromAthlete: athleteById(drop.from_athlete_id),
        toAthlete: athleteById(drop.to_athlete_id),
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  function pinQuests(aid) {
    return (cache.pin_quests || [])
      .filter(row => row.athlete_id === aid)
      .map(row => ({ ...row, design: pinDesignById(row.reward_design_id) }))
      .sort((a, b) => new Date(a.expires_at || 0) - new Date(b.expires_at || 0));
  }
  function pinStats(aid) {
    const inventory = pinInventory(aid);
    const drops = pinDropsForAthlete(aid);
    return {
      unique: inventory.length,
      total: inventory.reduce((sum, row) => sum + Number(row.quantity || 1), 0),
      sent: drops.filter(drop => drop.from_athlete_id === aid).length,
      received: drops.filter(drop => drop.to_athlete_id === aid).length,
    };
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
    programTeams, programAthletes, athletesForTeam,
    athleteSkills, athleteReadiness, teamReadiness, categoryReadiness,
    athleteAttendance, teamAttendance, athleteSkillsSummary,
    predictedScore, daysToComp, needsWorkQueue, programProfile, programPaymentSettings, programBilling, athleteBilling,
    classById, classEnrollmentsForAthlete, classEnrollmentsForParent,
    classEnrollmentsForProgram, openGymRegistrationsForProgram,
    // Tier 1/2
    inboxThreads, threadMessages, threadMembers,
    sessionRsvp, upcomingSessions, staffScheduleSessions,
    athleteMedical,
    uniformsWithItems, athleteUniformOrders,
    leadsByStage, leadTouches, leadSummary,
    formTemplatesActive, formResponsesForTemplate,
    volunteerRolesAndAssignments,
    practicePlanForSession, allPracticePlans,
    pendingRegistrations, registrationSummary, isCheckoutHold, isSettledRegistrationPayment,
    pinDesignById, pinInventory, pinDropsForAthlete, pinQuests, pinStats,
    // AI Judge
    activeRubric, rubricCategories,
    recentAnalyses, analysisById,
    elementsFor, deductionsFor, feedbackFor,
    pendingProposalsFor, scoreTrend,
    // Owner-managed offerings
    programTracks, programClasses,
    SHEET,
    STATUS_PCT,
  };
})();
