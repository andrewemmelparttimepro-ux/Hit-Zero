// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO — Core cheer data model
// USASF skill taxonomy, roster, routine, sessions, billing.
// Every screen in the app derives from this. State mutations persist
// to localStorage via the store (see store.js).
// ─────────────────────────────────────────────────────────────────────────────

// USASF Levels 1–7, simplified skill catalogs per category.
// Categories track what shows up on a USASF Worlds-style score sheet:
// Standing Tumbling, Running Tumbling, Jumps, Stunts, Pyramids, Tosses, Dance.
window.HZ_SKILL_TREE = {
  standing_tumbling: {
    label: 'Standing Tumbling',
    short: 'ST',
    skills: [
      { id: 'st_handstand',      name: 'Handstand',                level: 1 },
      { id: 'st_cartwheel',      name: 'Cartwheel',                level: 1 },
      { id: 'st_bwo',            name: 'Back Walkover',            level: 1 },
      { id: 'st_bhs',            name: 'Back Handspring',          level: 2 },
      { id: 'st_2bhs',           name: 'Back Handspring Series',   level: 2 },
      { id: 'st_jump_bhs',       name: 'Jump → Back Handspring',   level: 3 },
      { id: 'st_tuck',           name: 'Standing Tuck',            level: 4 },
      { id: 'st_layout',         name: 'Standing Layout',          level: 5 },
      { id: 'st_bhs_tuck',       name: 'BHS → Tuck',               level: 4 },
      { id: 'st_bhs_layout',     name: 'BHS → Layout',             level: 5 },
      { id: 'st_full',           name: 'Standing Full',            level: 6 },
    ],
  },
  running_tumbling: {
    label: 'Running Tumbling',
    short: 'RT',
    skills: [
      { id: 'rt_ro_bhs',         name: 'Round-off Back Handspring',      level: 2 },
      { id: 'rt_ro_bhs_tuck',    name: 'RO BHS Tuck',                    level: 3 },
      { id: 'rt_ro_bhs_layout',  name: 'RO BHS Layout',                  level: 4 },
      { id: 'rt_ro_bhs_full',    name: 'RO BHS Full',                    level: 5 },
      { id: 'rt_punch_front',    name: 'Punch Front',                    level: 3 },
      { id: 'rt_aerial',         name: 'Aerial',                         level: 4 },
      { id: 'rt_double',         name: 'RO BHS Double Full',             level: 6 },
      { id: 'rt_whip_full',      name: 'Whip Through to Full',           level: 5 },
    ],
  },
  stunts: {
    label: 'Stunts',
    short: 'ST',
    skills: [
      { id: 's_prep',            name: 'Prep (shoulder level)',          level: 1 },
      { id: 's_extension',       name: 'Extension',                      level: 2 },
      { id: 's_lib',             name: 'Liberty',                        level: 2 },
      { id: 's_half_up',         name: 'Half Up to Extension',           level: 3 },
      { id: 's_full_up',         name: 'Full Up to Extension',           level: 3 },
      { id: 's_full_up_lib',     name: 'Full Up to Liberty',             level: 4 },
      { id: 's_tick_tock',       name: 'Tick-Tock',                      level: 3 },
      { id: 's_ball_up_lib',     name: 'Ball-up 360 to Lib',             level: 5 },
      { id: 's_rewind',          name: 'Rewind to Extension',            level: 5 },
      { id: 's_double_up',       name: 'Double Up to Extension',         level: 6 },
      { id: 's_kick_double',     name: 'Kick Double Basket Catch',       level: 6 },
    ],
  },
  pyramids: {
    label: 'Pyramids',
    short: 'PY',
    skills: [
      { id: 'p_prep_2_high',     name: '2-High Prep Pyramid',            level: 2 },
      { id: 'p_braced_ext',      name: 'Braced Extension Pyramid',       level: 3 },
      { id: 'p_flat_back',       name: 'Flat Back Transition',           level: 3 },
      { id: 'p_kick_single',     name: 'Kick Single (braced)',           level: 4 },
      { id: 'p_braced_lib',      name: 'Braced Liberty Chain',           level: 4 },
      { id: 'p_braced_flip',     name: 'Braced Front Flip Transition',   level: 5 },
      { id: 'p_inverted_brace', name: 'Inverted Brace Transition',      level: 6 },
    ],
  },
  baskets: {
    label: 'Baskets & Tosses',
    short: 'BK',
    skills: [
      { id: 'b_straight',        name: 'Straight Ride',                  level: 2 },
      { id: 'b_toe_touch',       name: 'Toe Touch Basket',               level: 3 },
      { id: 'b_pike_open',       name: 'Pike Open',                      level: 3 },
      { id: 'b_kick_single',     name: 'Kick Single Full',               level: 4 },
      { id: 'b_kick_double',     name: 'Kick Double Full',               level: 5 },
      { id: 'b_arabian',         name: 'Arabian',                        level: 5 },
      { id: 'b_rewind',          name: 'Rewind',                         level: 5 },
      { id: 'b_kick_double_ld', name: 'Kick Double w/ Layout Down',     level: 6 },
    ],
  },
  jumps: {
    label: 'Jumps',
    short: 'JP',
    skills: [
      { id: 'j_toe_touch',       name: 'Toe Touch',                      level: 1 },
      { id: 'j_hurdler',         name: 'Hurdler',                        level: 1 },
      { id: 'j_pike',            name: 'Pike',                           level: 1 },
      { id: 'j_double_tt',       name: 'Double Toe Touch',               level: 2 },
      { id: 'j_tt_bhs',          name: 'Toe Touch → BHS',                level: 3 },
      { id: 'j_jump_series',     name: '3-Jump Series (same altitude)',  level: 4 },
    ],
  },
};

// Skill status progression — 4 states we track per athlete per skill.
window.HZ_SKILL_STATUS = [
  { id: 'none',     label: 'Not Started', short: '·',   pct: 0,    color: 'dim' },
  { id: 'working',  label: 'Working',     short: 'WIP', pct: 0.33, color: 'amber' },
  { id: 'got_it',   label: 'Got It',      short: 'GOT', pct: 0.75, color: 'teal' },
  { id: 'mastered', label: 'Mastered',    short: 'HIT', pct: 1.0,  color: 'pink' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MCA roster — Senior 4 "Magic"
// Real names/ages commented out; using archetype-style names.
// Each athlete has a role: flyer / base / backspot / tumbler / all-around.
// ─────────────────────────────────────────────────────────────────────────────
window.HZ_ROSTER = [
  { id: 'a01', name: 'Kenzie Rhodes',    age: 16, role: 'flyer',     joined: '2023-08', paid: 4800, owed: 0,    photo: '#f97fac', initials: 'KR' },
  { id: 'a02', name: 'Avery Lang',       age: 15, role: 'flyer',     joined: '2022-08', paid: 4800, owed: 0,    photo: '#27cfd7', initials: 'AL' },
  { id: 'a03', name: 'Brooklyn Pate',    age: 17, role: 'base',      joined: '2021-08', paid: 4800, owed: 0,    photo: '#f97fac', initials: 'BP' },
  { id: 'a04', name: 'Maddox Rivera',    age: 16, role: 'base',      joined: '2023-01', paid: 4200, owed: 600,  photo: '#27cfd7', initials: 'MR' },
  { id: 'a05', name: 'Jules Okafor',     age: 15, role: 'backspot',  joined: '2022-08', paid: 4800, owed: 0,    photo: '#f97fac', initials: 'JO' },
  { id: 'a06', name: 'Tatum Sorenson',   age: 16, role: 'backspot',  joined: '2023-08', paid: 4200, owed: 600,  photo: '#27cfd7', initials: 'TS' },
  { id: 'a07', name: 'Rylee Kim',        age: 14, role: 'tumbler',   joined: '2024-08', paid: 3600, owed: 1200, photo: '#f97fac', initials: 'RK' },
  { id: 'a08', name: 'Indie Vasquez',    age: 17, role: 'tumbler',   joined: '2020-08', paid: 4800, owed: 0,    photo: '#27cfd7', initials: 'IV' },
  { id: 'a09', name: 'Sage Holloway',    age: 16, role: 'all-around',joined: '2022-01', paid: 4800, owed: 0,    photo: '#f97fac', initials: 'SH' },
  { id: 'a10', name: 'Quinn Bellamy',    age: 15, role: 'all-around',joined: '2023-08', paid: 4500, owed: 300,  photo: '#27cfd7', initials: 'QB' },
  { id: 'a11', name: 'Noa Winters',      age: 16, role: 'base',      joined: '2021-08', paid: 4800, owed: 0,    photo: '#f97fac', initials: 'NW' },
  { id: 'a12', name: 'Skye Deveraux',    age: 15, role: 'flyer',     joined: '2024-01', paid: 3900, owed: 900,  photo: '#27cfd7', initials: 'SD' },
  { id: 'a13', name: 'River Alvarez',    age: 17, role: 'backspot',  joined: '2020-08', paid: 4800, owed: 0,    photo: '#f97fac', initials: 'RA' },
  { id: 'a14', name: 'Ashton Wolfe',     age: 16, role: 'tumbler',   joined: '2022-08', paid: 4800, owed: 0,    photo: '#27cfd7', initials: 'AW' },
  { id: 'a15', name: 'Harley Chen',      age: 15, role: 'all-around',joined: '2023-08', paid: 4200, owed: 600,  photo: '#f97fac', initials: 'HC' },
  { id: 'a16', name: 'Blakely Morse',    age: 16, role: 'flyer',     joined: '2022-08', paid: 4800, owed: 0,    photo: '#27cfd7', initials: 'BM' },
  { id: 'a17', name: 'Ember Solis',      age: 14, role: 'base',      joined: '2024-08', paid: 3000, owed: 1800, photo: '#f97fac', initials: 'ES' },
  { id: 'a18', name: 'Lennox Pryor',     age: 17, role: 'all-around',joined: '2019-08', paid: 4800, owed: 0,    photo: '#27cfd7', initials: 'LP' },
  { id: 'a19', name: 'Phoenix Ray',      age: 16, role: 'tumbler',   joined: '2023-01', paid: 4800, owed: 0,    photo: '#f97fac', initials: 'PR' },
  { id: 'a20', name: 'Marlowe Hart',     age: 15, role: 'backspot',  joined: '2023-08', paid: 4500, owed: 300,  photo: '#27cfd7', initials: 'MH' },
];

// Team info — Senior 4 "Magic"
window.HZ_TEAM = {
  id: 't_magic_s4',
  name: 'Magic',
  division: 'Senior Coed 4',
  level: 4,
  gym: 'Magic City Allstars',
  city: 'Minot, ND',
  seasonStart: '2025-05-01',
  nextComp: { name: 'Dream On Dance & Cheer', date: '2026-05-09', city: 'Bismarck, ND', daysOut: 20 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Routine structure — 2:30 = 46 eight-counts.
// Canonical cheer section types + point weights in a USASF Worlds-style sheet
// (approximate; the real sheets use comparative ranges).
// ─────────────────────────────────────────────────────────────────────────────
window.HZ_SECTION_TYPES = {
  opening:          { label: 'Opening',              color: '#f97fac', icon: 'star' },
  standing_tumbling:{ label: 'Standing Tumbling',    color: '#27cfd7', icon: 'spark' },
  running_tumbling: { label: 'Running Tumbling',     color: '#27cfd7', icon: 'bolt' },
  jumps:            { label: 'Jumps',                color: '#f97fac', icon: 'up' },
  stunts:           { label: 'Stunts',               color: '#27cfd7', icon: 'lift' },
  pyramid:          { label: 'Pyramid',              color: '#f97fac', icon: 'pyr' },
  baskets:          { label: 'Baskets',              color: '#27cfd7', icon: 'toss' },
  dance:            { label: 'Dance',                color: '#f97fac', icon: 'dance' },
  transition:       { label: 'Transition',           color: '#555',    icon: 'dot' },
};

// Default routine layout — 46 counts, placed sections
window.HZ_DEFAULT_ROUTINE = {
  id: 'rt_2026_magic',
  name: 'Magic 2026',
  length: 46, // 8-counts
  bpm: 144,
  // sections: each occupies a range of 8-counts [startCount, endCount]
  sections: [
    { id: 'sec1', type: 'opening',            start: 1,  end: 4,  label: 'Opening' },
    { id: 'sec2', type: 'standing_tumbling',  start: 5,  end: 10, label: 'Standing' },
    { id: 'sec3', type: 'stunts',             start: 11, end: 18, label: 'Stunt 1' },
    { id: 'sec4', type: 'jumps',              start: 19, end: 22, label: 'Jumps' },
    { id: 'sec5', type: 'running_tumbling',   start: 23, end: 28, label: 'Running' },
    { id: 'sec6', type: 'stunts',             start: 29, end: 34, label: 'Stunt 2' },
    { id: 'sec7', type: 'pyramid',            start: 35, end: 40, label: 'Pyramid' },
    { id: 'sec8', type: 'dance',              start: 41, end: 46, label: 'Dance' },
  ],
};

// USASF Worlds-style score sheet weights (approximate)
// Sum = 100 points possible.
window.HZ_SCORE_SHEET = [
  { id: 'standing_tumbling', label: 'Standing Tumbling',     max: 12, category: 'standing_tumbling' },
  { id: 'running_tumbling',  label: 'Running Tumbling',      max: 12, category: 'running_tumbling' },
  { id: 'jumps',             label: 'Jumps',                 max: 8,  category: 'jumps' },
  { id: 'stunts',            label: 'Stunts',                max: 20, category: 'stunts' },
  { id: 'pyramid',           label: 'Pyramid',               max: 15, category: 'pyramids' },
  { id: 'baskets',           label: 'Baskets/Tosses',        max: 15, category: 'baskets' },
  { id: 'dance',             label: 'Dance',                 max: 10, category: null },
  { id: 'routine',           label: 'Routine Composition',   max: 8,  category: null },
];

// Common USASF deductions
window.HZ_DEDUCTIONS = [
  { id: 'fall_stunt',      label: 'Fall from a Stunt',       value: 0.5, type: 'minor' },
  { id: 'fall_pyramid',    label: 'Fall from a Pyramid',     value: 0.75, type: 'minor' },
  { id: 'bobble',          label: 'Bobble/Stumble',          value: 0.25, type: 'minor' },
  { id: 'tumbling_fall',   label: 'Tumbling Fall',           value: 0.5, type: 'minor' },
  { id: 'bf',              label: 'Building Fundamental',    value: 0.25, type: 'minor' },
  { id: 'major_bf',        label: 'Major Building Fund.',    value: 0.50, type: 'major' },
  { id: 'safety',          label: 'Safety Violation',        value: 1.0, type: 'major' },
  { id: 'time',            label: 'Time Violation',          value: 0.25, type: 'minor' },
  { id: 'choreo_boundary', label: 'Choreography Boundary',   value: 0.25, type: 'minor' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sessions & schedule — last 30 days + upcoming
// ─────────────────────────────────────────────────────────────────────────────
window.HZ_SESSIONS = [
  // Past (for attendance computation)
  { id: 's01', date: '2026-03-24', type: 'Practice',   duration: 120, attended: ['a01','a02','a03','a04','a05','a06','a07','a08','a09','a10','a11','a12','a13','a14','a15','a16','a18','a19','a20'] },
  { id: 's02', date: '2026-03-26', type: 'Tumbling',   duration: 90,  attended: ['a07','a08','a14','a19','a09','a10','a15','a18'] },
  { id: 's03', date: '2026-03-28', type: 'Practice',   duration: 120, attended: ['a01','a02','a03','a04','a05','a06','a07','a08','a09','a10','a11','a12','a13','a14','a15','a16','a17','a18','a19','a20'] },
  { id: 's04', date: '2026-03-31', type: 'Stunts',     duration: 90,  attended: ['a01','a02','a03','a04','a05','a06','a11','a12','a13','a16','a17','a18','a20'] },
  { id: 's05', date: '2026-04-02', type: 'Practice',   duration: 120, attended: ['a01','a02','a03','a04','a05','a06','a07','a08','a09','a10','a11','a12','a13','a14','a15','a16','a17','a18','a19','a20'] },
  { id: 's06', date: '2026-04-04', type: 'Full-Out',   duration: 150, attended: ['a01','a02','a03','a04','a05','a06','a07','a08','a09','a10','a11','a12','a13','a14','a15','a16','a17','a18','a19','a20'] },
  { id: 's07', date: '2026-04-07', type: 'Practice',   duration: 120, attended: ['a01','a02','a03','a05','a06','a07','a08','a09','a10','a11','a12','a13','a14','a15','a18','a19','a20'] },
  { id: 's08', date: '2026-04-09', type: 'Tumbling',   duration: 90,  attended: ['a07','a08','a14','a19','a09','a10','a15','a18','a01','a02'] },
  { id: 's09', date: '2026-04-11', type: 'Practice',   duration: 120, attended: ['a01','a02','a03','a04','a05','a06','a07','a08','a09','a10','a11','a12','a13','a14','a15','a16','a17','a18','a19','a20'] },
  { id: 's10', date: '2026-04-14', type: 'Full-Out',   duration: 150, attended: ['a01','a02','a03','a04','a05','a06','a07','a08','a09','a10','a11','a12','a13','a14','a16','a17','a18','a19','a20'] },
  { id: 's11', date: '2026-04-16', type: 'Stunts',     duration: 90,  attended: ['a01','a02','a03','a04','a05','a06','a11','a12','a13','a16','a17','a18','a20'] },
  { id: 's12', date: '2026-04-18', type: 'Practice',   duration: 120, attended: ['a01','a02','a03','a04','a05','a06','a07','a08','a09','a10','a11','a12','a13','a14','a15','a16','a17','a18','a19','a20'] },
  // Today & upcoming
  { id: 's13', date: '2026-04-19', type: 'Full-Out',   duration: 150, attended: [], scheduled: true },
  { id: 's14', date: '2026-04-21', type: 'Practice',   duration: 120, attended: [], scheduled: true },
  { id: 's15', date: '2026-04-23', type: 'Stunts',     duration: 90,  attended: [], scheduled: true },
  { id: 's16', date: '2026-04-25', type: 'Full-Out',   duration: 150, attended: [], scheduled: true },
  { id: 's17', date: '2026-04-28', type: 'Practice',   duration: 120, attended: [], scheduled: true },
  { id: 's18', date: '2026-05-02', type: 'Full-Out',   duration: 150, attended: [], scheduled: true },
  { id: 's19', date: '2026-05-05', type: 'Dress',      duration: 180, attended: [], scheduled: true },
  { id: 's20', date: '2026-05-09', type: 'COMPETITION: Dream On', duration: 0, attended: [], scheduled: true, comp: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Initial skill status per athlete
// Generated pseudo-randomly with weighting toward level-appropriate skills
// ─────────────────────────────────────────────────────────────────────────────
(function buildInitialSkills() {
  const tree = window.HZ_SKILL_TREE;
  const roster = window.HZ_ROSTER;
  const skillsByAthlete = {};
  // deterministic pseudorandom based on athlete id + skill id
  const hash = (s) => { let h = 5381; for (let i=0;i<s.length;i++) h = ((h<<5)+h)+s.charCodeAt(i); return Math.abs(h); };

  roster.forEach(a => {
    skillsByAthlete[a.id] = {};
    Object.keys(tree).forEach(cat => {
      tree[cat].skills.forEach(sk => {
        // Role-based weighting: flyers more likely to have stunts/pyramids; tumblers more tumbling; etc.
        let roleBoost = 0;
        if (a.role === 'flyer'    && (cat === 'stunts' || cat === 'pyramids')) roleBoost = 1;
        if (a.role === 'tumbler'  && (cat === 'standing_tumbling' || cat === 'running_tumbling')) roleBoost = 1;
        if (a.role === 'base'     && (cat === 'stunts' || cat === 'baskets' || cat === 'pyramids')) roleBoost = 1;
        if (a.role === 'backspot' && (cat === 'stunts' || cat === 'baskets' || cat === 'pyramids')) roleBoost = 1;
        if (a.role === 'all-around') roleBoost = 0.5;

        // Level 1-3 = mostly known. Level 4 = mixed. Level 5+ = mostly working/not started.
        const team_level = 4;
        const h = hash(a.id + sk.id);
        const r = (h % 100) / 100;
        let status;
        if (sk.level <= team_level - 1) {
          status = r < 0.85 + roleBoost*0.1 ? 'mastered' : r < 0.97 ? 'got_it' : 'working';
        } else if (sk.level === team_level) {
          // The actual team level — this is what's being worked on
          const rr = r + roleBoost * 0.15;
          status = rr > 0.75 ? 'mastered' : rr > 0.5 ? 'got_it' : rr > 0.25 ? 'working' : 'none';
        } else if (sk.level === team_level + 1) {
          const rr = r + roleBoost * 0.2;
          status = rr > 0.8 ? 'got_it' : rr > 0.55 ? 'working' : 'none';
        } else {
          status = r > 0.9 ? 'working' : 'none';
        }
        skillsByAthlete[a.id][sk.id] = status;
      });
    });
  });
  window.HZ_INITIAL_SKILLS = skillsByAthlete;
})();
