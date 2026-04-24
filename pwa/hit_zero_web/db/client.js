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
  const LS_KEY = 'hz_db_v3';  // v3: + AI Routine Judge (rubrics, analyses, elements, deductions, feedback, proposed skill updates)
  const AUTH_VIEW_ROLE_KEY = 'hz_auth_view_role';
  const VIEW_AS_EMAIL = 'andrew@ndai.pro';
  const VIEW_AS_ROLES = ['owner', 'coach', 'parent', 'athlete'];
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
        { id: 'u_coach', program_id: 'p_mca', role: 'coach', display_name: 'Coach Brynn', email: 'brynn@magiccityallstars.com' },
        { id: 'u_coach_2', program_id: 'p_mca', role: 'coach', display_name: 'Carlie Wilson', email: 'carlie@magiccityallstars.com' },
        { id: 'u_owner', program_id: 'p_mca', role: 'owner', display_name: 'Erin Magic', email: 'erin@magiccityallstars.com' },
        { id: 'u_athlete', program_id: 'p_mca', role: 'athlete', display_name: 'Kenzie Rhodes', email: 'kenzie@demo.com' },
        { id: 'u_parent', program_id: 'p_mca', role: 'parent', display_name: 'Sam Rhodes', email: 'sam@demo.com' },
      ],
      athletes: roster.map(a => ({
        id: a.id, team_id: team.id, profile_id: a.id === 'a01' ? 'u_athlete' : null, display_name: a.name, initials: a.initials, age: a.age,
        role: a.role, photo_color: a.photo, photo_url: a.id === 'a01' ? '/profiles/arlowe-emmel.jpg' : null, joined_at: a.joined + '-15',
      })),
      parent_links: [
        { parent_id: 'u_parent', athlete_id: 'a01' },
        { parent_id: 'u_coach', athlete_id: 'a12' },
      ],
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
      ...buildTier1Tier2Seed(team, roster),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tier 1 + Tier 2 seed: messaging, RSVP, registrations, waivers, forms,
  // medical, uniforms, leads, volunteers, practice plans.
  // ─────────────────────────────────────────────────────────────────────────
  function buildTier1Tier2Seed(team, roster) {
    const now = Date.now();
    const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString();
    const days = (n) => n * 86400000;
    const hours = (n) => n * 3600000;
    const mins  = (n) => n * 60000;

    // ─── Message threads ───
    const message_threads = [
      { id: 't_coaches', program_id: 'p_mca', team_id: team.id, kind: 'coaches', title: 'Coaches — Senior 4', last_message_at: iso(-mins(12)), created_at: iso(-days(10)) },
      { id: 't_team',    program_id: 'p_mca', team_id: team.id, kind: 'team',    title: 'Magic Senior 4 — Team',   last_message_at: iso(-mins(45)), created_at: iso(-days(30)) },
      { id: 't_parents', program_id: 'p_mca', team_id: team.id, kind: 'parents', title: 'Parents — Senior 4',       last_message_at: iso(-hours(2)),  created_at: iso(-days(30)) },
      { id: 't_dm_k_c',  program_id: 'p_mca', team_id: team.id, kind: 'dm',      title: null,                       last_message_at: iso(-mins(6)),   created_at: iso(-days(4)) },
    ];
    const thread_members = [
      // Coach thread
      { thread_id: 't_coaches', profile_id: 'u_coach', role_in_thread: 'owner'  },
      { thread_id: 't_coaches', profile_id: 'u_coach_2', role_in_thread: 'member' },
      { thread_id: 't_coaches', profile_id: 'u_owner', role_in_thread: 'member' },
      // Team thread — coach + all athletes (just seed the demo ones)
      { thread_id: 't_team', profile_id: 'u_coach',   role_in_thread: 'owner'  },
      { thread_id: 't_team', profile_id: 'u_coach_2', role_in_thread: 'member' },
      { thread_id: 't_team', profile_id: 'u_athlete', role_in_thread: 'member' },
      // Parents thread — coach + parents
      { thread_id: 't_parents', profile_id: 'u_coach',  role_in_thread: 'owner'  },
      { thread_id: 't_parents', profile_id: 'u_coach_2', role_in_thread: 'member' },
      { thread_id: 't_parents', profile_id: 'u_parent', role_in_thread: 'member' },
      // DM — coach + Kenzie
      { thread_id: 't_dm_k_c', profile_id: 'u_coach',   role_in_thread: 'member' },
      { thread_id: 't_dm_k_c', profile_id: 'u_athlete', role_in_thread: 'member' },
    ];
    const messages = [
      // Coaches
      { id: 'm1', thread_id: 't_coaches', author_id: 'u_coach_2', body: 'Hotel block expires Friday — tell me ASAP if anyone isn\u2019t going.', created_at: iso(-mins(60)) },
      { id: 'm2', thread_id: 't_coaches', author_id: 'u_coach', body: 'Got 3 maybes. Will lock tomorrow after practice.', created_at: iso(-mins(12)) },
      // Team
      { id: 'm3', thread_id: 't_team', author_id: 'u_coach',   body: 'Full-out Friday. Be ready to run it 3x clean.', created_at: iso(-hours(5)) },
      { id: 'm4', thread_id: 't_team', author_id: 'u_athlete', body: 'On it \u2728', created_at: iso(-mins(45)) },
      // Parents
      { id: 'm5', thread_id: 't_parents', author_id: 'u_coach_2', body: 'Reminder: choreo fee due Friday. Venmo or Square link in billing.', created_at: iso(-hours(6)) },
      { id: 'm6', thread_id: 't_parents', author_id: 'u_parent', body: 'Paid. Thanks Coach Brynn!', created_at: iso(-hours(2)) },
      // DM
      { id: 'm7', thread_id: 't_dm_k_c', author_id: 'u_coach',   body: 'Saw the clip — your full landed clean. Proud of you.', created_at: iso(-hours(1)) },
      { id: 'm8', thread_id: 't_dm_k_c', author_id: 'u_athlete', body: 'Thank you!!!', created_at: iso(-mins(6)) },
    ];
    const message_reads = [
      { thread_id: 't_coaches', profile_id: 'u_coach', last_read_at: iso(-mins(10)) },
      { thread_id: 't_coaches', profile_id: 'u_coach_2', last_read_at: iso(-mins(11)) },
      { thread_id: 't_team',    profile_id: 'u_coach', last_read_at: iso(-mins(50)) },
      { thread_id: 't_team',    profile_id: 'u_coach_2', last_read_at: iso(-hours(1)) },
      { thread_id: 't_parents', profile_id: 'u_coach', last_read_at: iso(-hours(6)) },
      { thread_id: 't_parents', profile_id: 'u_coach_2', last_read_at: iso(-hours(5)) },
      { thread_id: 't_dm_k_c',  profile_id: 'u_coach', last_read_at: iso(-mins(6)) },
    ];

    // ─── Session RSVP / availability ───
    const upcoming = (window.HZ_SESSIONS || []).filter(s => s.scheduled).slice(0, 6).map(s => s.id);
    const session_availability = [];
    upcoming.forEach(sid => {
      roster.slice(0, 16).forEach((a, i) => {
        const statuses = ['going', 'going', 'going', 'going', 'maybe', 'no', 'unknown'];
        session_availability.push({
          session_id: sid, athlete_id: a.id,
          status: statuses[(a.id.charCodeAt(a.id.length-1) + i) % statuses.length],
          updated_at: iso(-hours(Math.floor(Math.random()*24))),
        });
      });
    });

    // ─── Calendar tokens (just owner's for the demo) ───
    const calendar_tokens = [
      { id: 'ct1', profile_id: 'u_owner',  team_id: null,    token: 'demo-program-owner', label: 'All teams', created_at: iso(-days(2)) },
      { id: 'ct2', profile_id: 'u_parent', team_id: team.id, token: 'demo-parent-senior4', label: 'Senior 4 (Kenzie)', created_at: iso(-days(1)) },
    ];

    // ─── Registrations ───
    const registration_windows = [
      { id: 'rw1', program_id: 'p_mca', slug: '2026-tryouts', title: '2026–27 Tryouts',
        description: 'All-Star tryouts for the 2026–27 season. Levels 1–6.',
        opens_at: iso(-days(7)), closes_at: iso(days(14)), fee_amount: 45, is_public: true,
        created_at: iso(-days(14)) },
      { id: 'rw2', program_id: 'p_mca', slug: 'summer-camp', title: 'Summer Tumble Camp',
        description: 'Week-long tumbling intensive. 3 sessions/day. Ages 6–18.',
        opens_at: iso(-days(3)), closes_at: iso(days(30)), fee_amount: 299, is_public: true,
        created_at: iso(-days(3)) },
    ];
    const registrations = [
      { id: 'reg1', window_id: 'rw1', program_id: 'p_mca', athlete_name: 'Ava Lindgren',  parent_name: 'Kristi Lindgren', parent_email: 'kristi@demo.com', parent_phone: '701-555-0148', level_interest: 3, source: 'referral',  status: 'pending',  created_at: iso(-days(1)) },
      { id: 'reg2', window_id: 'rw1', program_id: 'p_mca', athlete_name: 'Mila Pearson',  parent_name: 'Jen Pearson',     parent_email: 'jen@demo.com',    parent_phone: '701-555-0151', level_interest: 4, source: 'instagram', status: 'accepted', created_at: iso(-days(3)), decided_at: iso(-hours(12)), decided_by: 'u_owner' },
      { id: 'reg3', window_id: 'rw2', program_id: 'p_mca', athlete_name: 'Reed Becker',   parent_name: 'Tom Becker',      parent_email: 'tom@demo.com',    parent_phone: '701-555-0177', level_interest: 2, source: 'google',    status: 'pending',  created_at: iso(-hours(8)) },
    ];

    // ─── Waivers ───
    const waiver_templates = [
      { id: 'wt1', program_id: 'p_mca', title: 'Participation & Liability Release',
        version: 3, effective_at: iso(-days(60)),
        body: '# Magic City Allstars — Participation Waiver\n\nThe undersigned acknowledges the inherent risks of cheerleading, including the possibility of injury. Participant consents to emergency medical care. Parent/guardian signature required for minors.',
        created_by: 'u_owner', created_at: iso(-days(60)) },
      { id: 'wt2', program_id: 'p_mca', title: 'Media Release',
        version: 1, effective_at: iso(-days(60)),
        body: '# Media Release\n\nPermission for Magic City Allstars to use photos/video of the athlete in promotional materials. Opt out at any time by emailing erin@magiccityallstars.com.',
        created_by: 'u_owner', created_at: iso(-days(60)) },
    ];
    const waiver_signatures = [
      { id: 'ws1', template_id: 'wt1', program_id: 'p_mca', athlete_id: 'a01', signer_name: 'Sam Rhodes', signer_email: 'sam@demo.com', signed_at: iso(-days(45)) },
      { id: 'ws2', template_id: 'wt2', program_id: 'p_mca', athlete_id: 'a01', signer_name: 'Sam Rhodes', signer_email: 'sam@demo.com', signed_at: iso(-days(45)) },
    ];

    // ─── Forms / evaluations ───
    const form_templates = [
      { id: 'ft1', program_id: 'p_mca', kind: 'tryout', title: 'Tryout Scoresheet — L4',
        description: 'Standardised L4 tryout rubric. Jumps, stunts, tumbling.',
        is_active: true, created_by: 'u_coach', created_at: iso(-days(20)) },
      { id: 'ft2', program_id: 'p_mca', kind: 'evaluation', title: 'Mid-Season Progress Report',
        description: 'Fill out per athlete in Week 14. Auto-emailed to parents.',
        is_active: true, created_by: 'u_coach_2', created_at: iso(-days(14)) },
    ];
    const form_fields = [
      { id: 'ff1', template_id: 'ft1', label: 'Toe Touch (height + form)',    kind: 'score',   required: true,  weight: 2, position: 0, options: { min: 1, max: 10 } },
      { id: 'ff2', template_id: 'ft1', label: 'Standing Tumbling',             kind: 'rubric',  required: true,  weight: 3, position: 1, options: { choices: ['No BHS','BHS','BHS series','Jump→BHS','Tuck'] } },
      { id: 'ff3', template_id: 'ft1', label: 'Running Tumbling',              kind: 'rubric',  required: true,  weight: 3, position: 2, options: { choices: ['Cartwheel','RO','RO-BHS','RO-BHS-Tuck','RO-BHS-Layout','RO-BHS-Full'] } },
      { id: 'ff4', template_id: 'ft1', label: 'Stunt Level (base/flyer)',      kind: 'rubric',  required: true,  weight: 3, position: 3, options: { choices: ['Prep','Extension','Lib','Full-up','Double-up'] } },
      { id: 'ff5', template_id: 'ft1', label: 'Coachability (1–10)',           kind: 'score',   required: true,  weight: 1, position: 4, options: { min: 1, max: 10 } },
      { id: 'ff6', template_id: 'ft1', label: 'Notes',                          kind: 'longtext',required: false, weight: 0, position: 5 },
    ];
    const form_responses = [
      { id: 'fr1', template_id: 'ft1', subject_athlete_id: 'a01', submitted_by: 'u_coach', score_total: 88.5, submitted_at: iso(-days(5)), notes: 'Clean tumbler, great flyer, super coachable.' },
      { id: 'fr2', template_id: 'ft1', subject_athlete_id: 'a07', submitted_by: 'u_coach_2', score_total: 82.0, submitted_at: iso(-days(5)) },
      { id: 'fr3', template_id: 'ft1', subject_athlete_id: 'a14', submitted_by: 'u_coach', score_total: 79.5, submitted_at: iso(-days(4)) },
    ];

    // ─── Emergency contacts + medical ───
    const emergency_contacts = roster.slice(0, 8).map((a, i) => ({
      id: 'ec_' + a.id, athlete_id: a.id,
      name: ['Kristi','Sam','Jen','Tom','Alex','Jordan','Casey','Drew'][i] + ' ' + a.name.split(' ').slice(-1)[0],
      relation: 'parent', phone: '701-555-' + String(100 + i).padStart(4,'0'),
      email: a.name.split(' ')[0].toLowerCase() + 'parent@demo.com',
      is_primary: true, created_at: iso(-days(60)),
    }));
    const medical_records = roster.slice(0, 6).map((a, i) => ({
      athlete_id: a.id,
      blood_type: ['O+','A+','B+','AB+','O-','A-'][i % 6],
      allergies: [null,'Peanuts','Latex',null,null,'Bee stings'][i],
      medications: [null,null,'Albuterol (asthma)',null,null,null][i],
      conditions: [null,'Mild asthma',null,null,'ACL reconstruction 2024',null][i],
      insurance_carrier: ['Blue Cross ND','Sanford','Blue Cross ND','Sanford','Aetna','Blue Cross ND'][i],
      physician_name: 'Dr. Morales',
      physician_phone: '701-555-0199',
      last_physical: '2026-01-15',
      updated_at: iso(-days(30)),
    }));
    const injuries = [
      { id: 'inj1', athlete_id: 'a07', occurred_at: iso(-days(9)), body_part: 'right ankle', description: 'Rolled during RO-BHS-Layout', severity: 'minor', return_date: null, cleared_by: 'Dr. Morales', notes: 'Tape up for this week. No tumbling passes.', created_by: 'u_coach', created_at: iso(-days(9)) },
      { id: 'inj2', athlete_id: 'a03', occurred_at: iso(-days(28)), body_part: 'left wrist', description: 'Sprain — basket catch', severity: 'moderate', return_date: '2026-04-15', cleared_by: 'Dr. Morales', resolved_at: iso(-days(5)), created_at: iso(-days(28)) },
    ];

    // ─── Uniforms ───
    const uniforms = [
      { id: 'un1', program_id: 'p_mca', name: 'Senior 4 — Competition',  season: '2025-2026', vendor: 'Rebel Athletic', base_price: 425, is_active: true },
      { id: 'un2', program_id: 'p_mca', name: 'Practice Kit — Black',    season: '2025-2026', vendor: 'GK Elite',        base_price: 95,  is_active: true },
    ];
    const uniform_items = [
      { id: 'ui1', uniform_id: 'un1', item_type: 'top',     sku: 'RBL-S4-TOP-B',  required: true,  price: 225 },
      { id: 'ui2', uniform_id: 'un1', item_type: 'skirt',   sku: 'RBL-S4-SKT-B',  required: true,  price: 140 },
      { id: 'ui3', uniform_id: 'un1', item_type: 'bow',     sku: 'RBL-S4-BOW-R',  required: true,  price: 25 },
      { id: 'ui4', uniform_id: 'un1', item_type: 'shoes',   sku: 'RBK-CHAMP-W',   required: true,  price: 120 },
      { id: 'ui5', uniform_id: 'un2', item_type: 'top',     sku: 'GK-PRAC-T-BLK', required: true,  price: 45 },
      { id: 'ui6', uniform_id: 'un2', item_type: 'shorts',  sku: 'GK-PRAC-S-BLK', required: true,  price: 50 },
    ];
    const uniform_orders = roster.slice(0, 10).map((a, i) => ({
      id: 'uo_' + a.id, uniform_id: 'un1', athlete_id: a.id,
      fit_data: { top: ['AS','AXS','AM','AS','AL','AM','AS','AXS','AM','AS'][i], skirt: ['AXS','AXS','AS','AXS','AM','AS','AS','AXS','AS','AXS'][i], shoes: ['6','7','6.5','6','8','7.5','6.5','5.5','7','6.5'][i] },
      status: ['ordered','shipped','delivered','delivered','ordered','pending','ordered','shipped','delivered','pending'][i],
      ordered_at: iso(-days(20 + i)),
      delivered_at: i < 4 ? iso(-days(5 + i)) : null,
      created_at: iso(-days(30)),
    }));

    // ─── Leads / CRM ───
    const leads = [
      { id: 'ld1', program_id: 'p_mca', parent_name: 'Hanna Grove',   parent_email: 'hanna@demo.com',   parent_phone: '701-555-0211', athlete_name: 'Nora Grove',   athlete_age: 9,  interest: 'tryouts',     source: 'instagram', stage: 'trial',     assigned_to: 'u_owner', created_at: iso(-days(6)),  updated_at: iso(-hours(12)) },
      { id: 'ld2', program_id: 'p_mca', parent_name: 'Marcus Banks',  parent_email: 'marcus@demo.com',  parent_phone: '701-555-0232', athlete_name: 'Taya Banks',    athlete_age: 12, interest: 'tumbling',    source: 'referral',  stage: 'contacted', assigned_to: 'u_owner', created_at: iso(-days(4)),  updated_at: iso(-days(2)) },
      { id: 'ld3', program_id: 'p_mca', parent_name: 'Priya Rao',      parent_email: 'priya@demo.com',   parent_phone: '701-555-0245', athlete_name: 'Maya Rao',      athlete_age: 7,  interest: 'half-year',   source: 'google',    stage: 'new',       assigned_to: null,      created_at: iso(-hours(14)), updated_at: iso(-hours(14)) },
      { id: 'ld4', program_id: 'p_mca', parent_name: 'Jordan Allen',   parent_email: 'jallen@demo.com',  parent_phone: '701-555-0260', athlete_name: 'Skye Allen',    athlete_age: 10, interest: 'tryouts',     source: 'walk-in',   stage: 'tour',      assigned_to: 'u_owner', created_at: iso(-days(2)),  updated_at: iso(-days(1)) },
      { id: 'ld5', program_id: 'p_mca', parent_name: 'Leah Christiansen', parent_email: 'leahc@demo.com', parent_phone: '701-555-0271', athlete_name: 'Ellis C.',     athlete_age: 14, interest: 'tryouts',     source: 'instagram', stage: 'converted', assigned_to: 'u_owner', converted_at: iso(-days(12)), created_at: iso(-days(25)), updated_at: iso(-days(12)) },
    ];
    const lead_touches = [
      { id: 'lt1', lead_id: 'ld1', kind: 'tour',  body: 'Came in for a tour — parents impressed. Daughter shy but willing.', author_id: 'u_owner', created_at: iso(-days(5)) },
      { id: 'lt2', lead_id: 'ld1', kind: 'trial', body: 'Trial practice tonight — check in after.', author_id: 'u_owner', created_at: iso(-hours(12)) },
      { id: 'lt3', lead_id: 'ld2', kind: 'call',  body: 'Left VM. Following up Tue.', author_id: 'u_owner', created_at: iso(-days(2)) },
    ];

    // ─── Volunteers ───
    const volunteer_roles = [
      { id: 'vr1', program_id: 'p_mca', name: 'Bus Captain',          description: 'Loads bus, counts heads, walkie to coaches.', created_at: iso(-days(20)) },
      { id: 'vr2', program_id: 'p_mca', name: 'Warm-up Tech',         description: 'Owns the warm-up music + timing on comp day.', created_at: iso(-days(20)) },
      { id: 'vr3', program_id: 'p_mca', name: 'Photography',          description: 'Shoots the team walk-in + after-bid photos.', created_at: iso(-days(20)) },
      { id: 'vr4', program_id: 'p_mca', name: 'Hospitality',          description: 'Snacks/waters for athletes between rounds.', created_at: iso(-days(20)) },
    ];
    // Assign volunteers to the Dream On comp (last seeded session, is_competition=true)
    const compSession = (window.HZ_SESSIONS || []).find(s => s.comp);
    const volunteer_assignments = compSession ? [
      { id: 'va1', role_id: 'vr1', session_id: compSession.id, profile_id: 'u_parent', status: 'claimed',   claimed_at: iso(-days(1)), created_at: iso(-days(3)) },
      { id: 'va2', role_id: 'vr2', session_id: compSession.id, profile_id: null,         status: 'open',                              created_at: iso(-days(3)) },
      { id: 'va3', role_id: 'vr3', session_id: compSession.id, profile_id: null,         status: 'open',                              created_at: iso(-days(3)) },
      { id: 'va4', role_id: 'vr4', session_id: compSession.id, profile_id: null,         status: 'open',                              created_at: iso(-days(3)) },
    ] : [];

    // ─── Drills + Practice Plans ───
    const drills = [
      { id: 'dr1', program_id: 'p_mca', name: 'Jump circuit — 4 corners',   category: 'conditioning', duration_min: 12, description: 'Toe-touch / hurdler / pike / double-nine at each corner, 30s rotations.', created_at: iso(-days(40)) },
      { id: 'dr2', program_id: 'p_mca', name: 'RO-BHS-Tuck lines',           category: 'tumbling',     duration_min: 20, description: 'Three lines across the floor, coach spots the tuck.', created_at: iso(-days(40)) },
      { id: 'dr3', program_id: 'p_mca', name: 'Full-up drill (groups of 4)', category: 'stunting',     duration_min: 18, description: 'Groups rotate every minute. Backspot coaches the wrap.', created_at: iso(-days(40)) },
      { id: 'dr4', program_id: 'p_mca', name: 'Counts 1–16 choreo review',   category: 'choreo',       duration_min: 10, description: 'Sectional review with music. No tumbling.', created_at: iso(-days(40)) },
    ];
    const practice_plans = [
      { id: 'pp1', session_id: (window.HZ_SESSIONS || [])[0]?.id, team_id: team.id, title: 'Tuesday — Full-Out Day', focus: 'Stamina + clean jumps',
        created_by: 'u_coach', created_at: iso(-hours(18)) },
    ];
    const practice_plan_blocks = practice_plans[0] ? [
      { id: 'pb1', plan_id: 'pp1', drill_id: null,   custom_title: 'Warm-up',              duration_min: 10, position: 0, notes: 'Dynamic + joint prep' },
      { id: 'pb2', plan_id: 'pp1', drill_id: 'dr1',  custom_title: null,                    duration_min: 12, position: 1 },
      { id: 'pb3', plan_id: 'pp1', drill_id: 'dr2',  custom_title: null,                    duration_min: 20, position: 2 },
      { id: 'pb4', plan_id: 'pp1', drill_id: 'dr3',  custom_title: null,                    duration_min: 18, position: 3 },
      { id: 'pb5', plan_id: 'pp1', drill_id: null,   custom_title: 'Run it ×3',             duration_min: 25, position: 4, notes: '2-minute rest between. Score self.' },
      { id: 'pb6', plan_id: 'pp1', drill_id: null,   custom_title: 'Huddle + notes',        duration_min: 10, position: 5 },
    ] : [];

    // ─── Athlete social loop: collectible pins + drops ───
    const pin_designs = [
      { id: 'pin_hit_zero',          program_id: 'p_mca', name: 'Hit Zero',          emoji: '⚡', rarity: 'common',    accent_start: '#27CFD7', accent_end: '#8EE3F0', unlock_hint: 'Starter pin for every athlete.', lore: 'The first pin on the bag.' },
      { id: 'pin_red_bow',           program_id: 'p_mca', name: 'Red Bow Energy',    emoji: '🎀', rarity: 'common',    accent_start: '#F97FAC', accent_end: '#F4B1C8', unlock_hint: 'Earned from perfect attendance weeks.', lore: 'For girls who look comp-ready before warm-ups even start.' },
      { id: 'pin_clothespin',        program_id: 'p_mca', name: 'Lucky Clothespin',  emoji: '📍', rarity: 'rare',      accent_start: '#FFD76B', accent_end: '#FF9F6E', unlock_hint: 'Reward for dropping 3 pins at one competition.', lore: 'The digital version of the decorated clothespins girls clip on each other’s bags.' },
      { id: 'pin_stunt_stack',       program_id: 'p_mca', name: 'Stunt Stack',       emoji: '🏆', rarity: 'rare',      accent_start: '#88F7B3', accent_end: '#27CFD7', unlock_hint: 'Unlocked after a clean stunt full-out.', lore: 'Big trust energy.' },
      { id: 'pin_confetti_heart',    program_id: 'p_mca', name: 'Confetti Heart',    emoji: '💖', rarity: 'epic',      accent_start: '#F97FAC', accent_end: '#FFD76B', unlock_hint: 'Gifted when another athlete pins you for hype.', lore: 'You made somebody’s weekend.' },
      { id: 'pin_country_crossover', program_id: 'p_mca', name: 'Country Crossover', emoji: '🗺️', rarity: 'legendary', accent_start: '#C8A6FF', accent_end: '#6CE5E8', unlock_hint: 'Pin an athlete from another gym at a major comp.', lore: 'The one everybody notices on the bag.' },
    ];
    const athlete_pins = [
      { id: 'ap1', athlete_id: 'a01', design_id: 'pin_hit_zero',       quantity: 2, favorite: true,  unlocked_at: iso(-days(18)) },
      { id: 'ap2', athlete_id: 'a01', design_id: 'pin_red_bow',        quantity: 1, favorite: false, unlocked_at: iso(-days(9)) },
      { id: 'ap3', athlete_id: 'a01', design_id: 'pin_confetti_heart', quantity: 1, favorite: false, unlocked_at: iso(-hours(40)) },
      { id: 'ap4', athlete_id: 'a07', design_id: 'pin_hit_zero',       quantity: 2, favorite: true,  unlocked_at: iso(-days(20)) },
      { id: 'ap5', athlete_id: 'a07', design_id: 'pin_stunt_stack',    quantity: 1, favorite: false, unlocked_at: iso(-days(4)) },
      { id: 'ap6', athlete_id: 'a03', design_id: 'pin_hit_zero',       quantity: 1, favorite: false, unlocked_at: iso(-days(16)) },
      { id: 'ap7', athlete_id: 'a03', design_id: 'pin_clothespin',     quantity: 1, favorite: true,  unlocked_at: iso(-days(2)) },
    ];
    const pin_drops = [
      { id: 'pd1', design_id: 'pin_confetti_heart', from_athlete_id: 'a07', to_athlete_id: 'a01', recipient_name: 'Kenzie Rhodes', recipient_program: 'Magic City Allstars', recipient_city: 'Minot, ND', event_name: 'Dream On warm-up', message: 'You looked unreal in warm-ups.', created_at: iso(-hours(18)), status: 'received' },
      { id: 'pd2', design_id: 'pin_hit_zero',       from_athlete_id: 'a01', to_athlete_id: 'a03', recipient_name: 'Brooklyn Hale', recipient_program: 'Magic City Allstars', recipient_city: 'Minot, ND', event_name: 'Friday full-out',  message: 'That jump section ate.', created_at: iso(-days(2)),  status: 'sent' },
      { id: 'pd3', design_id: 'pin_red_bow',        from_athlete_id: 'a03', to_athlete_id: 'a01', recipient_name: 'Kenzie Rhodes', recipient_program: 'Magic City Allstars', recipient_city: 'Minot, ND', event_name: 'Bus ride',         message: 'Thanks for the pep talk.', created_at: iso(-days(3)),  status: 'received' },
      { id: 'pd4', design_id: 'pin_country_crossover', from_athlete_id: 'a01', to_athlete_id: null, recipient_name: 'Tatum Lee', recipient_program: 'Cheer Athletics', recipient_city: 'Dallas, TX', event_name: 'Next major comp', message: 'Save this one for a girl you meet out of state.', created_at: iso(days(7)), status: 'planned' },
    ];
    const pin_quests = [
      { id: 'pq1', athlete_id: 'a01', title: 'Warm-up Whisperer',      body: 'Drop 2 hype pins before the team takes the floor.', progress: 1, goal: 2, reward_design_id: 'pin_clothespin', expires_at: iso(days(2)), category: 'competition' },
      { id: 'pq2', athlete_id: 'a01', title: 'Meet somebody new',      body: 'Pin an athlete from another gym this weekend.',      progress: 0, goal: 1, reward_design_id: 'pin_country_crossover', expires_at: iso(days(10)), category: 'social' },
      { id: 'pq3', athlete_id: 'a07', title: 'Bench energy captain',   body: 'Send 3 pins after full-out to girls who hit clean.', progress: 2, goal: 3, reward_design_id: 'pin_confetti_heart', expires_at: iso(days(1)), category: 'team' },
    ];

    // ─── AI Judge: rubric + one seeded completed analysis ───
    const aiJudgeSeed = buildAiJudgeSeed(team, roster, now);

    return {
      message_threads, thread_members, messages, message_reads,
      session_availability,
      calendar_tokens,
      registration_windows, registrations,
      waiver_templates, waiver_signatures,
      form_templates, form_fields, form_responses, form_answers: [],
      emergency_contacts, medical_records, injuries,
      uniforms, uniform_items, uniform_orders,
      leads, lead_touches,
      volunteer_roles, volunteer_assignments,
      drills, practice_plans, practice_plan_blocks,
      pin_designs, athlete_pins, pin_drops, pin_quests,
      ...aiJudgeSeed,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AI Routine Judge — seed rubric + one completed example analysis so the
  // screen has something to show right out of the box.
  // ═══════════════════════════════════════════════════════════════════════
  function buildAiJudgeSeed(team, roster, now) {
    const iso = (offset = 0) => new Date(now + offset).toISOString();

    const rubric_versions = [{
      id: 'rv_usasf_2025_2026',
      org: 'usasf', season: '2025-2026',
      effective_at: '2025-08-01',
      total_points: 100, is_active: true,
      notes: 'USASF/United-style rubric per Grok report.',
    }];
    const rubric_categories = [
      { id: 'rc_stunts',     version_id: 'rv_usasf_2025_2026', code: 'stunts',              label: 'Stunts',              weight_pct: 25,   max_points: 25,   position: 0, rules: { majority: 0.51, most: 0.75, max: 1.0 } },
      { id: 'rc_pyramids',   version_id: 'rv_usasf_2025_2026', code: 'pyramids',            label: 'Pyramids',            weight_pct: 25,   max_points: 25,   position: 1, rules: { majority: 0.51, most: 0.75, max: 1.0 } },
      { id: 'rc_runtum',     version_id: 'rv_usasf_2025_2026', code: 'running_tumbling',    label: 'Running Tumbling',    weight_pct: 12.5, max_points: 12.5, position: 2, rules: { pass_min_pct: 0.66 } },
      { id: 'rc_standtum',   version_id: 'rv_usasf_2025_2026', code: 'standing_tumbling',   label: 'Standing Tumbling',   weight_pct: 12.5, max_points: 12.5, position: 3, rules: { pass_min_pct: 0.66 } },
      { id: 'rc_jumps',      version_id: 'rv_usasf_2025_2026', code: 'jumps',               label: 'Jumps',               weight_pct: 12.5, max_points: 12.5, position: 4, rules: { min_connected: 2 } },
      { id: 'rc_dance',      version_id: 'rv_usasf_2025_2026', code: 'dance',               label: 'Dance',               weight_pct: 6.25, max_points: 6.25, position: 5, rules: {} },
      { id: 'rc_comp',       version_id: 'rv_usasf_2025_2026', code: 'routine_composition', label: 'Routine Composition', weight_pct: 6.25, max_points: 6.25, position: 6, rules: {} },
    ];

    // One seeded analysis — a 2-day-old full-out run
    const analysisId = 'ra_seed_001';
    const routine_analyses = [{
      id: analysisId,
      team_id: team.id, routine_id: 'r_default', video_id: null,
      rubric_version_id: 'rv_usasf_2025_2026',
      division: team.division, level: team.level, team_size: roster.length,
      status: 'complete',
      queued_at: iso(-1000*60*60*48 - 120000),
      started_at: iso(-1000*60*60*48 - 90000),
      completed_at: iso(-1000*60*60*48),
      duration_ms: 94000, engine_version: 'heuristic-assistant-v0', confidence: 0.78,
      preflight: { angle_ok: true, lighting_ok: true, mat_visible: true, framerate: 60, resolution: { w: 1920, h: 1080 }, issues: [] },
      scorecard: {
        total: 77.2, possible: 100, pct: 77.2,
        categories: [
          { code: 'stunts', label: 'Stunts', awarded: 18.3, max: 25, pct: 73.2 },
          { code: 'pyramids', label: 'Pyramids', awarded: 19.4, max: 25, pct: 77.6 },
          { code: 'running_tumbling', label: 'Running Tumbling', awarded: 10.4, max: 12.5, pct: 83.2 },
          { code: 'standing_tumbling', label: 'Standing Tumbling', awarded: 9.2, max: 12.5, pct: 73.6 },
          { code: 'jumps', label: 'Jumps', awarded: 9.1, max: 12.5, pct: 72.8 },
          { code: 'dance', label: 'Dance', awarded: 5.0, max: 6.25, pct: 80.0 },
          { code: 'routine_composition', label: 'Routine Composition', awarded: 5.8, max: 6.25, pct: 92.8 },
        ],
        deductions: { total: 0, count: 0 },
        strongest: 'routine_composition', weakest: 'jumps',
      },
      total_score: 77.2, possible_score: 100,
      summary: "AI Judge (Assistant Mode): projected 77.2% overall. Strongest: Routine Composition. Biggest opportunity: Jumps.",
      parent_summary: "This routine would have scored 77%. Strongest category this time: Routine Composition.",
    }];

    const analysis_elements = [
      { id: 'ae1', analysis_id: analysisId, category_code: 'standing_tumbling', kind: 'tumbling_pass', skill_id: 'st_jump_bhs',    athlete_id: roster[0]?.id ?? null, athlete_ids: [roster[0]?.id ?? ''].filter(Boolean), t_start_ms: 0,     t_end_ms: 3200,  confidence: 0.82, raw_score: 2.3, metrics: { hit_rate: 0.88, tier: 'most',     stability: 0.81, landing_clean: true,  toe_point: 0.78 }, label: 'Jump → BHS — most' },
      { id: 'ae2', analysis_id: analysisId, category_code: 'standing_tumbling', kind: 'tumbling_pass', skill_id: 'st_tuck',        athlete_id: roster[1]?.id ?? null, athlete_ids: [roster[1]?.id ?? ''].filter(Boolean), t_start_ms: 3200,  t_end_ms: 6400,  confidence: 0.76, raw_score: 2.1, metrics: { hit_rate: 0.80, tier: 'most',     stability: 0.70, landing_clean: true,  toe_point: 0.65 }, label: 'Standing Tuck — most' },
      { id: 'ae3', analysis_id: analysisId, category_code: 'running_tumbling',  kind: 'tumbling_pass', skill_id: 'rt_ro_layout',   athlete_id: roster[6]?.id ?? null, athlete_ids: [roster[6]?.id ?? ''].filter(Boolean), t_start_ms: 6400,  t_end_ms: 9600,  confidence: 0.88, raw_score: 2.8, metrics: { hit_rate: 0.93, tier: 'max',      stability: 0.87, landing_clean: true,  toe_point: 0.74 }, label: 'RO BHS Layout — max' },
      { id: 'ae4', analysis_id: analysisId, category_code: 'running_tumbling',  kind: 'tumbling_pass', skill_id: 'rt_ro_full',     athlete_id: roster[13]?.id ?? null, athlete_ids: [roster[13]?.id ?? ''].filter(Boolean), t_start_ms: 9600, t_end_ms: 12800, confidence: 0.71, raw_score: 2.3, metrics: { hit_rate: 0.72, tier: 'most',     stability: 0.69, landing_clean: true,  toe_point: 0.60 }, label: 'RO BHS Full — most' },
      { id: 'ae5', analysis_id: analysisId, category_code: 'jumps',             kind: 'jump',          skill_id: 'j_toe_touch',    athlete_id: null, athlete_ids: roster.slice(0, 16).map(a => a.id), t_start_ms: 12800, t_end_ms: 15200, confidence: 0.80, raw_score: 4.2, metrics: { hit_rate: 0.82, tier: 'most',     stability: 0.75, landing_clean: true,  toe_point: 0.70 }, label: 'Toe Touch — most (team)' },
      { id: 'ae6', analysis_id: analysisId, category_code: 'jumps',             kind: 'jump',          skill_id: 'j_hurdler',      athlete_id: null, athlete_ids: roster.slice(0, 16).map(a => a.id), t_start_ms: 15200, t_end_ms: 17200, confidence: 0.66, raw_score: 3.4, metrics: { hit_rate: 0.71, tier: 'majority', stability: 0.66, landing_clean: true,  toe_point: 0.62 }, label: 'Front Hurdler — majority' },
      { id: 'ae7', analysis_id: analysisId, category_code: 'stunts',            kind: 'stunt',         skill_id: 's_full_up',      athlete_id: null, athlete_ids: [roster[0]?.id, roster[3]?.id, roster[8]?.id].filter(Boolean), t_start_ms: 17200, t_end_ms: 22000, confidence: 0.82, raw_score: 6.8, metrics: { hit_rate: 0.85, tier: 'most',     stability: 0.83, landing_clean: true,  toe_point: 0.77 }, label: 'Full Up to Extension — most' },
      { id: 'ae8', analysis_id: analysisId, category_code: 'stunts',            kind: 'stunt',         skill_id: 's_heel_stretch', athlete_id: null, athlete_ids: [roster[0]?.id, roster[3]?.id].filter(Boolean), t_start_ms: 22000, t_end_ms: 26000, confidence: 0.74, raw_score: 5.6, metrics: { hit_rate: 0.77, tier: 'most',     stability: 0.72, landing_clean: true,  toe_point: 0.66 }, label: 'Heel Stretch — most' },
      { id: 'ae9', analysis_id: analysisId, category_code: 'stunts',            kind: 'stunt',         skill_id: 's_tick_tock',    athlete_id: null, athlete_ids: [roster[0]?.id, roster[5]?.id].filter(Boolean), t_start_ms: 26000, t_end_ms: 30000, confidence: 0.69, raw_score: 5.9, metrics: { hit_rate: 0.79, tier: 'most',     stability: 0.70, landing_clean: true,  toe_point: 0.63 }, label: 'Tick-Tock — most' },
      { id: 'ae10', analysis_id: analysisId, category_code: 'pyramids',          kind: 'pyramid',       skill_id: 'p_extended',    athlete_id: null, athlete_ids: roster.slice(0, 8).map(a => a.id), t_start_ms: 30000, t_end_ms: 36000, confidence: 0.85, raw_score: 10.4, metrics: { hit_rate: 0.93, tier: 'max',     stability: 0.88, landing_clean: true,  toe_point: 0.80 }, label: 'Extended Pyramid — max' },
      { id: 'ae11', analysis_id: analysisId, category_code: 'pyramids',          kind: 'transition',    skill_id: 'p_release',     athlete_id: null, athlete_ids: roster.slice(0, 6).map(a => a.id), t_start_ms: 36000, t_end_ms: 40000, confidence: 0.72, raw_score: 9.0, metrics: { hit_rate: 0.83, tier: 'most',     stability: 0.74, landing_clean: true,  toe_point: 0.64 }, label: 'Release Transition — most' },
      { id: 'ae12', analysis_id: analysisId, category_code: 'dance',             kind: 'dance_section', skill_id: null,            athlete_id: null, athlete_ids: roster.map(a => a.id),                  t_start_ms: 40000, t_end_ms: 46000, confidence: 0.78, raw_score: 5.0, metrics: { sync: 0.84, musicality: 0.79, showmanship: 0.76 }, label: 'Dance section — sync 84%' },
      { id: 'ae13', analysis_id: analysisId, category_code: 'routine_composition', kind: 'transition',  skill_id: null,            athlete_id: null, athlete_ids: [],                                     t_start_ms: 0,     t_end_ms: 46000, confidence: 0.71, raw_score: 5.8, metrics: { variety: 0.88, flow: 0.83 }, label: 'Overall variety + flow' },
    ];

    const analysis_deductions = [];

    const analysis_feedback = [
      { id: 'af1', analysis_id: analysisId, audience: 'coach',   priority: 0, kind: 'observation',     category_code: null,           body: 'Projected total: 77.2/100 (77.2%) for Senior Coed 4. Routine Composition is your strongest category at 93%.', created_at: iso(-1000*60*60*48) },
      { id: 'af2', analysis_id: analysisId, audience: 'coach',   priority: 1, kind: 'recommendation',  category_code: 'jumps',        body: 'Jumps sit at 73% — one half-point per jump sequence is 2 full points back. Focus on hurdler form and sync.',    created_at: iso(-1000*60*60*48) },
      { id: 'af3', analysis_id: analysisId, audience: 'coach',   priority: 2, kind: 'praise',          category_code: 'pyramids',     body: "Best element of the run: Extended Pyramid — max (10.4 pts, confidence 85%).",                                     created_at: iso(-1000*60*60*48) },
      { id: 'af4', analysis_id: analysisId, audience: 'athlete', priority: 0, kind: 'praise',          category_code: null,           body: 'You showed up. Projected 77% — top category Routine Composition.',                                               created_at: iso(-1000*60*60*48) },
      { id: 'af5', analysis_id: analysisId, audience: 'athlete', priority: 1, kind: 'recommendation',  category_code: 'jumps',        body: 'Stretch goal: Jumps. Keep drilling — form is where points hide.',                                                 created_at: iso(-1000*60*60*48) },
      { id: 'af6', analysis_id: analysisId, audience: 'parent',  priority: 0, kind: 'observation',     category_code: null,           body: 'Your athlete team ran a clean 77% today. They are trending strong on Routine Composition.',                       created_at: iso(-1000*60*60*48) },
      { id: 'af7', analysis_id: analysisId, audience: 'parent',  priority: 1, kind: 'observation',     category_code: 'jumps',        body: 'Jumps has the most room to grow — the coach is focusing practice there next.',                                  created_at: iso(-1000*60*60*48) },
    ];

    const analysis_skill_updates = [
      { id: 'asu1', analysis_id: analysisId, athlete_id: roster[6]?.id,  skill_id: 'rt_ro_layout', from_status: 'got_it',  to_status: 'mastered', confidence: 0.88, reason: 'Detected at 6s with 88% confidence.', status: 'pending', created_at: iso(-1000*60*60*48) },
      { id: 'asu2', analysis_id: analysisId, athlete_id: roster[0]?.id,  skill_id: 's_full_up',    from_status: 'got_it',  to_status: 'mastered', confidence: 0.82, reason: 'Detected at 17s with 82% confidence.', status: 'pending', created_at: iso(-1000*60*60*48) },
      { id: 'asu3', analysis_id: analysisId, athlete_id: roster[3]?.id,  skill_id: 's_full_up',    from_status: 'working', to_status: 'got_it',   confidence: 0.82, reason: 'Detected at 17s with 82% confidence.', status: 'pending', created_at: iso(-1000*60*60*48) },
    ];

    return {
      rubric_versions, rubric_categories,
      routine_analyses, analysis_elements, analysis_deductions,
      analysis_feedback, analysis_skill_updates,
    };
  }

  // ─── Load / save ───
  function migrateData(existing) {
    const fresh = seed();
    let changed = false;
    ['pin_designs', 'athlete_pins', 'pin_drops', 'pin_quests'].forEach((table) => {
      if (!Array.isArray(existing[table])) {
        existing[table] = fresh[table] || [];
        changed = true;
      }
    });
    const linkedAthlete = (existing.athletes || []).find(a => a.id === 'a01');
    if (linkedAthlete && !linkedAthlete.profile_id) {
      linkedAthlete.profile_id = 'u_athlete';
      changed = true;
    }
    return { data: existing, changed };
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrated = migrateData(parsed);
        if (migrated.changed) save(migrated.data);
        return migrated.data;
      }
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
  const AUTH_KEY = 'hz_auth_v2';
  const AUTH_EMAIL_KEY = 'hz_auth_email_v1';
  const ATHLETE_LOGIN_DOMAIN = 'athletes.hit-zero.app';
  let realAuthSub = null;
  let authInitPromise = null;
  function getSession() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; }
  }
  function setSession(session) {
    if (session) localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    else localStorage.removeItem(AUTH_KEY);
    authListeners.forEach(fn => fn(session ? 'SIGNED_IN' : 'SIGNED_OUT', session));
  }
  function hasRealAuth() {
    return Boolean(window.HZsupa && window.HZsupa.auth);
  }
  function rememberEmail(email) {
    try { if (email) localStorage.setItem(AUTH_EMAIL_KEY, email); } catch {}
  }
  function lastEmail() {
    try { return localStorage.getItem(AUTH_EMAIL_KEY) || ''; } catch { return ''; }
  }
  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }
  function loginEmail(value) {
    const raw = normalizeEmail(value);
    if (!raw) return '';
    return raw.includes('@') ? raw : `${raw.replace(/^@+/, '')}@${ATHLETE_LOGIN_DOMAIN}`;
  }
  function canUseViewAs(raw, profile) {
    const email = normalizeEmail(profile?.email || raw?.user?.email || raw?.email);
    return email === VIEW_AS_EMAIL;
  }
  function readViewRole(raw, profile) {
    if (!canUseViewAs(raw, profile)) return null;
    try {
      const role = localStorage.getItem(AUTH_VIEW_ROLE_KEY);
      return VIEW_AS_ROLES.includes(role) ? role : null;
    } catch {
      return null;
    }
  }
  function writeViewRole(role) {
    try {
      if (VIEW_AS_ROLES.includes(role)) localStorage.setItem(AUTH_VIEW_ROLE_KEY, role);
      else localStorage.removeItem(AUTH_VIEW_ROLE_KEY);
    } catch {}
  }
  function upsertLocalProfile(profile) {
    if (!profile || !profile.id) return;
    data.profiles = data.profiles || [];
    const idx = data.profiles.findIndex(r => r.id === profile.id);
    const old = idx >= 0 ? data.profiles[idx] : null;
    if (idx >= 0) data.profiles[idx] = { ...data.profiles[idx], ...profile };
    else data.profiles.push(profile);
    save(data);
    emit('profiles', { eventType: old ? 'UPDATE' : 'INSERT', new: idx >= 0 ? data.profiles[idx] : profile, old });
  }
  function normalizeProfile(profile, user) {
    if (profile) return profile;
    const meta = user?.user_metadata || {};
    return {
      id: user?.id,
      email: user?.email || '',
      role: meta.role || 'parent',
      display_name: meta.display_name || (user?.email ? user.email.split('@')[0] : 'Hit Zero Member'),
      program_id: meta.program_id || data.teams?.[0]?.program_id || null,
    };
  }
  async function loadProfile(user) {
    if (!user) return null;
    if (!hasRealAuth()) {
      return (data.profiles || []).find(p => p.id === user.id || (user.email && p.email === user.email)) || null;
    }
    let profile = null;
    try {
      const byId = await window.HZsupa.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (byId.data) profile = byId.data;
    } catch (err) {
      console.warn('[HZ] profile lookup by id failed', err);
    }
    if (!profile && user.email) {
      try {
        const byEmail = await window.HZsupa.from('profiles').select('*').eq('email', user.email).maybeSingle();
        if (byEmail.data) profile = { ...byEmail.data, id: user.id, email: user.email };
      } catch (err) {
        console.warn('[HZ] profile lookup by email failed', err);
      }
    }
    profile = normalizeProfile(profile, user);
    if (profile) upsertLocalProfile(profile);
    return profile;
  }
  function wrapSession(raw, profile, mode = hasRealAuth() ? 'live' : 'prototype') {
    if (!raw || !profile) return null;
    const user = raw.user || { id: profile.id, email: profile.email };
    const canViewAs = canUseViewAs({ ...raw, user }, profile);
    const viewRole = readViewRole({ ...raw, user }, profile) || profile.role;
    const effectiveProfile = canViewAs
      ? {
          ...profile,
          role: viewRole,
          actual_role: profile.role,
          view_as_role: viewRole,
          is_view_as: viewRole !== profile.role,
        }
      : profile;
    return {
      ...raw,
      user,
      profile: effectiveProfile,
      actualProfile: profile,
      actualRole: profile.role,
      canViewAs,
      viewAsRole: effectiveProfile.role,
      mode,
    };
  }
  async function syncSupabaseSession(rawSession) {
    if (!rawSession?.user) {
      setSession(null);
      return null;
    }
    const profile = await loadProfile(rawSession.user);
    const wrapped = wrapSession(rawSession, profile);
    if (wrapped?.user?.email) rememberEmail(wrapped.user.email);
    setSession(wrapped);
    if (window.location.pathname === '/auth/callback') history.replaceState({}, '', '/');
    return wrapped;
  }
  function ensureRealAuthSubscription() {
    if (!hasRealAuth() || realAuthSub) return;
    const { data: sub } = window.HZsupa.auth.onAuthStateChange(async (_evt, session) => {
      try { await syncSupabaseSession(session); }
      catch (err) { console.warn('[HZ] auth sync failed', err); }
    });
    realAuthSub = sub.subscription;
  }
  async function initRealAuth() {
    if (!hasRealAuth()) return Promise.resolve(getSession());
    ensureRealAuthSubscription();
    if (!authInitPromise) {
      authInitPromise = window.HZsupa.auth.getSession()
        .then(async ({ data: result, error }) => {
          if (error) throw error;
          return syncSupabaseSession(result.session);
        })
        .catch((err) => {
          console.warn('[HZ] auth init failed', err);
          setSession(null);
          return null;
        });
    }
    return authInitPromise;
  }

  const auth = {
    async signInAsRole(role) {
      if (hasRealAuth()) {
        return { data: null, error: new Error('Prototype role switching is disabled for credentialed sign-in.') };
      }
      // Demo auth: map role to seeded profile
      const profile = (data.profiles || []).find(p => p.role === role);
      if (!profile) return { data: null, error: new Error('no profile') };
      const session = { user: { id: profile.id, email: profile.email }, profile, mode: 'prototype' };
      setSession(session);
      return { data: { session }, error: null };
    },
    async viewAsRole(role) {
      if (!VIEW_AS_ROLES.includes(role)) return { data: null, error: new Error('Unknown role.') };
      const current = getSession();
      if (!current?.canViewAs) return { data: null, error: new Error('View-as is only available to the credentialed owner account.') };
      writeViewRole(role);
      const next = wrapSession(current, current.actualProfile || current.profile, current.mode);
      setSession(next);
      return { data: { session: next }, error: null };
    },
    async signInWithMagicLink(email, role) {
      if (!hasRealAuth() || !window.HZ_FN_BASE || !window.HZ_ANON_KEY) {
        return { data: null, error: new Error('Magic-link auth is unavailable in prototype mode.') };
      }
      rememberEmail(email);
      try {
        const res = await fetch(window.HZ_FN_BASE + '/functions/v1/auth-link-v1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + window.HZ_ANON_KEY,
            'apikey': window.HZ_ANON_KEY,
          },
          body: JSON.stringify({
            email,
            role,
            redirect_to: window.location.origin + '/auth/callback',
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { data: null, error: new Error(payload?.error || payload?.message || 'We could not start the sign-in flow.') };
        }
        if (payload?.action_link) window.location.assign(payload.action_link);
        return { data: payload, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    async signInWithPassword(identifier, password) {
      if (!hasRealAuth()) return { data: null, error: new Error('Password auth is unavailable in prototype mode.') };
      const email = loginEmail(identifier);
      if (!email || !password) return { data: null, error: new Error('Username and password are required.') };
      rememberEmail(identifier);
      const { data: authData, error } = await window.HZsupa.auth.signInWithPassword({ email, password });
      if (error) return { data: null, error };
      const session = await syncSupabaseSession(authData.session);
      return { data: { session }, error: null };
    },
    async createChildAthlete(input = {}) {
      const current = getSession();
      const name = String(input.display_name || '').trim();
      if (!current?.profile?.id) return { data: null, error: new Error('You need to be signed in to add a child.') };
      if (!name) return { data: null, error: new Error('Child name is required.') };

      if (hasRealAuth() && window.HZ_FN_BASE && window.HZ_ANON_KEY) {
        try {
          const { data: authData, error: authError } = await window.HZsupa.auth.getSession();
          if (authError) throw authError;
          const token = authData?.session?.access_token;
          if (!token) throw new Error('Your sign-in session expired. Sign in again and retry.');
          const res = await fetch(window.HZ_FN_BASE + '/functions/v1/parent-athlete-v1', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token,
              'apikey': window.HZ_ANON_KEY,
            },
            body: JSON.stringify({ action: 'create_child', ...input }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload?.error || 'We could not add that child.');

          const raw = payload || {};
          if (raw.athlete) {
            data.athletes = data.athletes || [];
            data.athletes = [...data.athletes.filter(a => a.id !== raw.athlete.id), raw.athlete];
            emit('athletes', { eventType: 'INSERT', new: raw.athlete, old: null });
          }
          if (raw.parent_link) {
            data.parent_links = data.parent_links || [];
            data.parent_links = [
              ...data.parent_links.filter(l => !(l.parent_id === raw.parent_link.parent_id && l.athlete_id === raw.parent_link.athlete_id)),
              raw.parent_link,
            ];
            emit('parent_links', { eventType: 'INSERT', new: raw.parent_link, old: null });
          }
          if (raw.billing_account) {
            data.billing_accounts = data.billing_accounts || [];
            data.billing_accounts = [...data.billing_accounts.filter(a => a.id !== raw.billing_account.id), raw.billing_account];
            emit('billing_accounts', { eventType: 'INSERT', new: raw.billing_account, old: null });
          }
          save(data);
          if (window.HZmirror?.roster) await window.HZmirror.roster();
          if (window.HZsel?._refresh) await window.HZsel._refresh();
          window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'athletes', action: 'create_child' } }));
          return { data: raw, error: null };
        } catch (err) {
          return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
        }
      }

      const team = (data.teams || [])[0];
      if (!team?.id) return { data: null, error: new Error('No team exists yet.') };
      const athlete = {
        id: 'a_' + Math.random().toString(36).slice(2, 10),
        profile_id: null,
        team_id: team.id,
        display_name: name,
        initials: name.split(' ').filter(Boolean).map(s => s[0]).join('').slice(0, 2).toUpperCase() || 'HZ',
        age: input.age ? Number(input.age) : null,
        position: input.position || null,
        photo_color: input.photo_color || '#F97FAC',
        joined_at: new Date().toISOString().slice(0, 10),
      };
      const link = {
        parent_id: current.profile.id,
        athlete_id: athlete.id,
        relation: input.relation || 'parent',
        is_primary: true,
        created_at: new Date().toISOString(),
      };
      const billing = {
        id: 'ba_' + Math.random().toString(36).slice(2, 10),
        athlete_id: athlete.id,
        season_total: 0,
        paid: 0,
        owed: 0,
        autopay: false,
        updated_at: new Date().toISOString(),
      };
      data.athletes = [...(data.athletes || []), athlete];
      data.parent_links = [...(data.parent_links || []), link];
      data.billing_accounts = [...(data.billing_accounts || []), billing];
      save(data);
      emit('athletes', { eventType: 'INSERT', new: athlete, old: null });
      emit('parent_links', { eventType: 'INSERT', new: link, old: null });
      emit('billing_accounts', { eventType: 'INSERT', new: billing, old: null });
      window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'athletes', action: 'create_child' } }));
      return { data: { ok: true, athlete, parent_link: link, billing_account: billing }, error: null };
    },
    async createAthleteLogin(input = {}) {
      if (!hasRealAuth() || !window.HZ_FN_BASE || !window.HZ_ANON_KEY) {
        return { data: null, error: new Error('Athlete login setup needs live auth.') };
      }
      try {
        const { data: authData, error: authError } = await window.HZsupa.auth.getSession();
        if (authError) throw authError;
        const token = authData?.session?.access_token;
        if (!token) throw new Error('Your sign-in session expired. Sign in again and retry.');
        const res = await fetch(window.HZ_FN_BASE + '/functions/v1/parent-athlete-v1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
            'apikey': window.HZ_ANON_KEY,
          },
          body: JSON.stringify({ action: 'create_login', ...input }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'We could not create that athlete login.');
        if (payload?.athlete) {
          data.athletes = data.athletes || [];
          data.athletes = [...data.athletes.filter(a => a.id !== payload.athlete.id), payload.athlete];
          emit('athletes', { eventType: 'UPDATE', new: payload.athlete, old: null });
        }
        if (payload?.profile) upsertLocalProfile(payload.profile);
        save(data);
        if (window.HZmirror?.roster) await window.HZmirror.roster();
        if (window.HZsel?._refresh) await window.HZsel._refresh();
        window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'athletes', action: 'create_login' } }));
        return { data: payload, error: null };
      } catch (err) {
        return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    async signOut() {
      if (hasRealAuth()) {
        const { error } = await window.HZsupa.auth.signOut();
        if (error) return { error };
      }
      setSession(null);
      return { error: null };
    },
    async getSession() {
      if (hasRealAuth()) await initRealAuth();
      return { data: { session: getSession() }, error: null };
    },
    onAuthStateChange(cb) {
      authListeners.add(cb);
      if (hasRealAuth()) ensureRealAuthSubscription();
      cb(getSession() ? 'SIGNED_IN' : 'SIGNED_OUT', getSession());
      return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
    },
    // Synchronous helper just for the prototype
    _getSession: getSession,
    _setSession: setSession,
    _init: initRealAuth,
    _supportsMagicLink: hasRealAuth,
    _mode: () => hasRealAuth() ? 'live' : 'prototype',
    _lastEmail: lastEmail,
    _viewRoles: () => [...VIEW_AS_ROLES],
  };

  // ═══════════════════════════════════════════════════════════════════════
  // AI Routine Judge — client-side equivalent of the analyze-routine edge
  // function. Runs the same heuristic engine over the in-browser store so
  // the demo works completely offline. In production, this thin shim just
  // POSTs to the edge function and mirrors the response into localStorage.
  // ═══════════════════════════════════════════════════════════════════════
  function seededRand(seedStr) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return () => {
      h ^= h << 13; h >>>= 0;
      h ^= h >>> 17; h >>>= 0;
      h ^= h << 5;  h >>>= 0;
      return (h & 0xffffffff) / 0xffffffff;
    };
  }

  const SCORE_CALIBRATION_ANCHORS = [{
    label: 'Magic City comp day anchor',
    model_pct: 90.3,
    official_pct: 93.65,
    note: 'Single known day-of-competition score supplied by Andrew on 2026-04-23.',
  }];

  function clampScore(v) {
    return Math.max(0, Math.min(99.5, Number.isFinite(v) ? v : 0));
  }

  function calibrateProjectedScore(rawPct, totalMax) {
    const anchor = SCORE_CALIBRATION_ANCHORS[0];
    const delta = anchor.official_pct - anchor.model_pct;
    const distance = Math.abs(rawPct - anchor.model_pct);
    const influence = Math.exp(-distance / 16);
    const adjustment = Number((delta * influence).toFixed(2));
    const calibratedPct = clampScore(rawPct + adjustment);
    return {
      pct: calibratedPct,
      total: calibratedPct / 100 * totalMax,
      adjustment,
      raw_pct: Number(rawPct.toFixed(2)),
      raw_total: Number((rawPct / 100 * totalMax).toFixed(2)),
      applied: Math.abs(adjustment) >= 0.05,
      basis: 'single_anchor_soft_offset',
      anchors: SCORE_CALIBRATION_ANCHORS,
    };
  }

  async function analyzeRoutine({ team_id, video_id = null, routine_id = null, division, level, team_size, preflight }) {
    const active = (data.rubric_versions || []).find(v => v.is_active) || (data.rubric_versions || [])[0];
    if (!active) throw new Error('No active rubric');
    const categories = (data.rubric_categories || [])
      .filter(c => c.version_id === active.id)
      .sort((a,b) => a.position - b.position);
    const totalMax = categories.reduce((s, c) => s + Number(c.max_points), 0);

    const id = 'ra_' + Math.random().toString(36).slice(2, 10);
    const pf = preflight || { angle_ok: true, lighting_ok: true, mat_visible: true };
    const preflightFail = (pf.issues || []).length > 0 || pf.angle_ok === false || pf.lighting_ok === false || pf.mat_visible === false;

    const started = new Date();
    const base = {
      id, team_id, video_id, routine_id,
      rubric_version_id: active.id,
      division, level, team_size,
      status: preflightFail ? 'preflight_failed' : 'processing',
      queued_at: started.toISOString(),
      started_at: started.toISOString(),
      engine_version: 'heuristic-assistant-v0',
      possible_score: totalMax,
      preflight: pf,
      created_at: started.toISOString(),
    };
    data.routine_analyses = [...(data.routine_analyses || []), base];
    save(data);
    emit('routine_analyses', { eventType: 'INSERT', new: base, old: null });

    if (preflightFail) {
      const done = { ...base, status: 'preflight_failed', completed_at: new Date().toISOString(), error: 'Preflight failed — ' + (pf.issues || []).join('; ') };
      data.routine_analyses = data.routine_analyses.map(r => r.id === id ? done : r);
      save(data);
      emit('routine_analyses', { eventType: 'UPDATE', new: done, old: base });
      return { analysis_id: id, status: 'preflight_failed' };
    }

    const rand = seededRand([id, team_id, video_id, division, String(level || ''), String(team_size || '')].filter(Boolean).join('|'));

    const athletes = (data.athletes || []).filter(a => a.team_id === team_id);
    const aIds = athletes.map(a => a.id);
    const askills = (data.athlete_skills || []).filter(r => aIds.includes(r.athlete_id));
    const statusPct = { mastered: 1.0, got_it: 0.75, working: 0.45, none: 0.1 };
    const skillsByCat = {};
    for (const s of data.skills || []) (skillsByCat[s.category] ||= []).push(s);

    const catMap = { standing_tumbling:'standing_tumbling', running_tumbling:'running_tumbling', jumps:'jumps', stunts:'stunts', pyramids:'pyramids', dance:'dance', routine_composition:'composition' };
    const elements = [];
    const deductions = [];
    let t = 0;

    for (const cat of categories) {
      const mapped = catMap[cat.code] || cat.code;
      const catSkills = (skillsByCat[mapped] || []).filter(s => s.level <= (level || 4) + 1).sort((a,b) => b.level - a.level);
      const elemCount = Math.max(1, Math.round(Number(cat.max_points) / 4));
      for (let i = 0; i < elemCount; i++) {
        const skill = catSkills[Math.floor(rand() * Math.max(1, catSkills.length))] ?? null;
        const multi = cat.code === 'stunts' || cat.code === 'pyramids';
        const groupSize = multi ? Math.min(5, Math.max(2, Math.round((team_size||20) * 0.25))) : 1;
        const performers = [];
        for (let g = 0; g < groupSize; g++) {
          const p = aIds[Math.floor(rand() * Math.max(1, aIds.length))];
          if (p && !performers.includes(p)) performers.push(p);
        }
        let hitRate = 0.6 + rand() * 0.35;
        if (skill) {
          const rs = askills.filter(r => r.skill_id === skill.id).map(r => statusPct[r.status] ?? 0);
          if (rs.length) hitRate = rs.reduce((a,b) => a+b, 0) / rs.length;
        }
        const rules = cat.rules || {};
        const maj = Number(rules.majority ?? 0.51), mst = Number(rules.most ?? 0.75), mx = Number(rules.max ?? 1.0);
        let tier = 'majority';
        if (hitRate >= mx) tier = 'max';
        else if (hitRate >= mst) tier = 'most';
        else if (hitRate >= maj) tier = 'majority';
        else tier = 'below_majority';
        const mult = tier === 'max' ? 1.0 : tier === 'most' ? 0.85 : tier === 'majority' ? 0.65 : 0.35;
        const stability = 0.5 + rand() * 0.5;
        const landing = rand() < 0.92;
        const toePoint = 0.55 + rand() * 0.4;
        const exec = stability * 0.5 + (landing ? 0.4 : 0.2) + toePoint * 0.1;
        const raw = (Number(cat.max_points) / elemCount) * mult * exec;
        const dur = 2000 + Math.round(rand() * 4000);
        const label = skill ? (skill.name + ' — ' + tier.replace('_',' ')) : (cat.label + ' element ' + (i+1));
        const elem = {
          id: 'ae_' + Math.random().toString(36).slice(2,8),
          analysis_id: id,
          category_code: cat.code,
          kind: cat.code === 'stunts' ? 'stunt' : cat.code === 'pyramids' ? 'pyramid' : cat.code === 'jumps' ? 'jump' : cat.code === 'dance' ? 'dance_section' : 'tumbling_pass',
          skill_id: skill?.id ?? null,
          athlete_id: multi ? null : performers[0] ?? null,
          athlete_ids: performers,
          t_start_ms: t, t_end_ms: t + dur,
          confidence: Number((0.62 + rand() * 0.28).toFixed(3)),
          raw_score: Number(raw.toFixed(2)),
          metrics: { hit_rate: Number(hitRate.toFixed(3)), tier, stability: Number(stability.toFixed(3)), landing_clean: landing, toe_point: Number(toePoint.toFixed(3)) },
          label,
          created_at: new Date().toISOString(),
        };
        elements.push(elem);
        t += dur;
        if (!landing && rand() < 0.4) {
          deductions.push({ id: 'ad_' + Math.random().toString(36).slice(2,8), analysis_id: id, code: 'bobble', severity: 'minor', value: 0.25, t_ms: elem.t_end_ms - 200, description: 'Bobble on ' + label, confidence: 0.72, athlete_id: elem.athlete_id, created_at: new Date().toISOString() });
        }
        if (stability < 0.35 && rand() < 0.25) {
          deductions.push({ id: 'ad_' + Math.random().toString(36).slice(2,8), analysis_id: id, code: 'fall', severity: 'major', value: 0.75, t_ms: elem.t_end_ms - 300, description: 'Possible fall during ' + label, confidence: 0.66, athlete_id: elem.athlete_id, created_at: new Date().toISOString() });
        }
      }
    }

    data.analysis_elements = [...(data.analysis_elements || []), ...elements];
    data.analysis_deductions = [...(data.analysis_deductions || []), ...deductions];

    const totals = categories.map(c => {
      const awarded = elements.filter(e => e.category_code === c.code).reduce((s,e) => s+e.raw_score, 0);
      return { code: c.code, label: c.label, awarded: Number(awarded.toFixed(2)), max: Number(c.max_points), pct: 0 };
    });
    totals.forEach(c => c.pct = Number((c.awarded / c.max * 100).toFixed(1)));
    const totalA = totals.reduce((s,c) => s+c.awarded, 0);
    const totalD = deductions.reduce((s,d) => s+d.value, 0);
    const rawTotal = Math.max(0, totalA - totalD);
    const rawPct = rawTotal / totalMax * 100;
    const calibration = calibrateProjectedScore(rawPct, totalMax);
    const total = calibration.total;
    const pct = calibration.pct;
    const strongest = [...totals].sort((a,b) => (b.awarded/b.max) - (a.awarded/a.max))[0];
    const weakest = [...totals].sort((a,b) => (a.awarded/a.max) - (b.awarded/b.max))[0];

    // Feedback
    const now = new Date().toISOString();
    const fb = [];
    const rid = () => 'af_' + Math.random().toString(36).slice(2,8);
    fb.push({ id: rid(), analysis_id: id, audience: 'coach', priority: 0, kind: 'observation', body: `Projected total: ${total.toFixed(1)}/${totalMax.toFixed(0)} (${pct.toFixed(1)}%)${division ? ' for ' + division : ''}. ${strongest ? strongest.label + ' is your strongest category at ' + (strongest.awarded/strongest.max*100).toFixed(0) + '%.' : ''}`, created_at: now });
    if (weakest && weakest.awarded/weakest.max < 0.7) fb.push({ id: rid(), analysis_id: id, audience: 'coach', priority: 1, kind: 'recommendation', category_code: weakest.code, body: `${weakest.label} is leaving points on the floor (${(weakest.awarded/weakest.max*100).toFixed(0)}%). Drill this first — a half-point gain here is worth more than a polish pass anywhere else.`, created_at: now });
    if (totalD > 0.5) fb.push({ id: rid(), analysis_id: id, audience: 'coach', priority: 2, kind: 'warning', body: `Deductions totaling ${totalD.toFixed(2)} pts. Focus on landings and stability.`, created_at: now });
    const topElem = [...elements].sort((a,b) => b.raw_score - a.raw_score)[0];
    if (topElem) fb.push({ id: rid(), analysis_id: id, audience: 'coach', priority: 3, kind: 'praise', category_code: topElem.category_code, body: `Best element of the run: ${topElem.label} (${topElem.raw_score.toFixed(1)} pts, ${(topElem.confidence*100).toFixed(0)}% conf).`, created_at: now });
    fb.push({ id: rid(), analysis_id: id, audience: 'athlete', priority: 0, kind: 'praise', body: `You showed up. Projected ${pct.toFixed(0)}% — top category ${strongest?.label ?? 'the routine'}.`, created_at: now });
    if (weakest) fb.push({ id: rid(), analysis_id: id, audience: 'athlete', priority: 1, kind: 'recommendation', category_code: weakest.code, body: `Stretch goal: ${weakest.label}. Keep drilling — form is where points hide.`, created_at: now });
    fb.push({ id: rid(), analysis_id: id, audience: 'parent', priority: 0, kind: 'observation', body: `Your athlete's team ran a clean ${pct.toFixed(0)}% today. Trending strong on ${strongest?.label ?? 'the routine overall'}.`, created_at: now });
    if (weakest && weakest.awarded/weakest.max < 0.7) fb.push({ id: rid(), analysis_id: id, audience: 'parent', priority: 1, kind: 'observation', body: `${weakest.label} has the most room to grow — the coach is focusing practice there next.`, created_at: now });
    data.analysis_feedback = [...(data.analysis_feedback || []), ...fb];

    // Proposed skill updates
    const curMap = new Map();
    for (const r of data.athlete_skills || []) curMap.set(r.athlete_id + '|' + r.skill_id, r.status);
    const proposals = [];
    const seen = new Set();
    for (const e of elements) {
      if (!e.skill_id || e.confidence < 0.72) continue;
      const tier = e.metrics?.tier;
      if (tier !== 'most' && tier !== 'max') continue;
      const to = tier === 'max' ? 'mastered' : 'got_it';
      const targets = e.athlete_ids.length ? e.athlete_ids : (e.athlete_id ? [e.athlete_id] : []);
      for (const aid of targets) {
        const key = aid + '|' + e.skill_id;
        if (seen.has(key)) continue;
        const cur = curMap.get(key) ?? null;
        if (cur === 'mastered' || cur === to) continue;
        proposals.push({
          id: 'asu_' + Math.random().toString(36).slice(2,8),
          analysis_id: id, athlete_id: aid, skill_id: e.skill_id,
          from_status: cur, to_status: to, confidence: e.confidence,
          reason: `Detected at ${Math.round(e.t_start_ms/1000)}s with ${(e.confidence*100).toFixed(0)}% confidence.`,
          status: 'pending', created_at: now,
        });
        seen.add(key);
      }
    }
    data.analysis_skill_updates = [...(data.analysis_skill_updates || []), ...proposals];

    // Finalize
    const completed = new Date();
    const scorecard = {
      total: Number(total.toFixed(2)),
      possible: totalMax,
      pct: Number(pct.toFixed(2)),
      raw_total: Number(rawTotal.toFixed(2)),
      raw_pct: Number(rawPct.toFixed(2)),
      calibration: {
        ...calibration,
        total: Number(calibration.total.toFixed(2)),
        pct: Number(calibration.pct.toFixed(2)),
      },
      categories: totals,
      deductions: { total: Number(totalD.toFixed(2)), count: deductions.length },
      strongest: strongest?.code ?? null,
      weakest: weakest?.code ?? null,
    };
    const updated = {
      ...base, status: 'complete',
      completed_at: completed.toISOString(),
      duration_ms: completed.getTime() - started.getTime(),
      confidence: 0.78,
      scorecard, total_score: Number(total.toFixed(2)),
      summary: `AI Judge (Assistant Mode): projected ${pct.toFixed(1)}% overall. Strongest: ${strongest?.label ?? 'N/A'}. Biggest opportunity: ${weakest?.label ?? 'N/A'}.`,
      parent_summary: `This routine would have scored ${pct.toFixed(0)}%. Strongest category this time: ${strongest?.label ?? 'the routine'}.`,
    };
    data.routine_analyses = data.routine_analyses.map(r => r.id === id ? updated : r);
    save(data);
    emit('routine_analyses', { eventType: 'UPDATE', new: updated, old: base });
    return { analysis_id: id, status: 'complete', scorecard, elements_count: elements.length, deductions_count: deductions.length, proposals_count: proposals.length };
  }

  async function applySkillUpdate(proposalId, decision /* 'approve' | 'reject' */) {
    const p = (data.analysis_skill_updates || []).find(x => x.id === proposalId);
    if (!p) return { error: 'not found' };
    const now = new Date().toISOString();
    if (decision === 'reject') {
      p.status = 'rejected';
      p.decided_at = now;
    } else {
      p.status = 'applied';
      p.decided_at = now;
      // Apply to athlete_skills
      const key = p.athlete_id + '|' + p.skill_id;
      let row = (data.athlete_skills || []).find(r => r.athlete_id === p.athlete_id && r.skill_id === p.skill_id);
      if (row) {
        const old = { ...row };
        row.status = p.to_status;
        row.updated_at = now;
        emit('athlete_skills', { eventType: 'UPDATE', new: row, old });
      } else {
        const nr = { athlete_id: p.athlete_id, skill_id: p.skill_id, status: p.to_status, updated_at: now };
        data.athlete_skills = [...(data.athlete_skills || []), nr];
        emit('athlete_skills', { eventType: 'INSERT', new: nr, old: null });
      }
      // Celebrate
      const athlete = (data.athletes || []).find(a => a.id === p.athlete_id);
      const skill = (data.skills || []).find(s => s.id === p.skill_id);
      if (athlete && skill && p.to_status === 'mastered') {
        const cel = {
          id: 'cel_' + Math.random().toString(36).slice(2,8),
          team_id: athlete.team_id, athlete_id: athlete.id,
          kind: 'skill_progress', skill_id: skill.id,
          from_status: p.from_status || 'working', to_status: 'mastered',
          headline: `${athlete.display_name} mastered ${skill.name}`,
          body: 'via AI Judge',
          created_at: now,
        };
        data.celebrations = [...(data.celebrations || []), cel];
        emit('celebrations', { eventType: 'INSERT', new: cel, old: null });
      }
    }
    save(data);
    emit('analysis_skill_updates', { eventType: 'UPDATE', new: p, old: null });
    return p;
  }

  // ─── Public surface ───
  window.HZdb = {
    from, channel, auth,
    // AI Judge
    analyzeRoutine,
    applySkillUpdate,
    // Escape hatches for the prototype (not present in real Supabase)
    _reset() { localStorage.removeItem(LS_KEY); data = load(); listeners.clear(); },
    _raw: () => data,
  };
})();
