// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO — Shared state store with localStorage persistence
// Thin pub/sub store. Every screen subscribes to the same single object and
// re-renders when it changes. This is what makes the prototype feel like a
// real app — actions in Skill Matrix update Parent Dashboard and Mock Score
// instantly.
// ─────────────────────────────────────────────────────────────────────────────

(function(){
  const LS_KEY = 'hitzero_state_v1';

  const defaultState = () => ({
    role: 'coach',                 // 'coach' | 'athlete' | 'parent' | 'owner'
    activeAthleteId: 'a01',        // for athlete/parent views
    skills: window.HZ_INITIAL_SKILLS,
    routine: JSON.parse(JSON.stringify(window.HZ_DEFAULT_ROUTINE)),
    sessions: window.HZ_SESSIONS,
    roster: window.HZ_ROSTER,
    team: window.HZ_TEAM,
    // Mock scoring state
    mockDeductions: [],
    // Celebration queue — recent skill progressions
    recent: [],
    adminOpen: false,
  });

  let state = loadOr(defaultState());
  const listeners = new Set();

  function loadOr(fallback) {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return fallback;
      const saved = JSON.parse(raw);
      // merge with defaults (keeps forward-compat)
      return { ...fallback, ...saved };
    } catch {
      return fallback;
    }
  }

  function save() {
    try {
      // Don't persist ephemeral stuff
      const toSave = { ...state };
      delete toSave.recent;
      localStorage.setItem(LS_KEY, JSON.stringify(toSave));
    } catch {}
  }

  function emit() {
    listeners.forEach(l => l(state));
  }

  window.HZStore = {
    get: () => state,
    subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
    set(patch) { state = { ...state, ...patch }; save(); emit(); },
    reset() { state = defaultState(); save(); emit(); },
    // Skill mutation — core action. Cycles through status or sets directly.
    setSkill(athleteId, skillId, newStatus) {
      const cur = state.skills[athleteId]?.[skillId] || 'none';
      if (cur === newStatus) return;
      state.skills = {
        ...state.skills,
        [athleteId]: { ...state.skills[athleteId], [skillId]: newStatus },
      };
      // push to recent (for celebration feed)
      state.recent = [
        { athleteId, skillId, from: cur, to: newStatus, at: Date.now() },
        ...(state.recent || []).slice(0, 19),
      ];
      save(); emit();
    },
    cycleSkill(athleteId, skillId) {
      const order = ['none','working','got_it','mastered'];
      const cur = state.skills[athleteId]?.[skillId] || 'none';
      const next = order[(order.indexOf(cur) + 1) % order.length];
      window.HZStore.setSkill(athleteId, skillId, next);
    },
    // Routine mutation
    updateRoutine(patch) {
      state.routine = { ...state.routine, ...patch };
      save(); emit();
    },
    updateSection(sectionId, patch) {
      state.routine = {
        ...state.routine,
        sections: state.routine.sections.map(s => s.id === sectionId ? { ...s, ...patch } : s),
      };
      save(); emit();
    },
    // Session mutation — toggle athlete attendance on a session
    toggleAttend(sessionId, athleteId) {
      state.sessions = state.sessions.map(s => {
        if (s.id !== sessionId) return s;
        const has = s.attended.includes(athleteId);
        return { ...s, attended: has ? s.attended.filter(x => x !== athleteId) : [...s.attended, athleteId] };
      });
      save(); emit();
    },
    // Deductions (mock score simulator)
    addDeduction(ded) {
      state.mockDeductions = [...state.mockDeductions, { ...ded, _id: Math.random().toString(36).slice(2) }];
      save(); emit();
    },
    removeDeduction(_id) {
      state.mockDeductions = state.mockDeductions.filter(d => d._id !== _id);
      save(); emit();
    },
    clearDeductions() {
      state.mockDeductions = [];
      save(); emit();
    },
    setRole(role) {
      state.role = role;
      if (role === 'athlete' || role === 'parent') {
        // Default to Kenzie for the demo
        state.activeAthleteId = state.activeAthleteId || 'a01';
      }
      save(); emit();
    },
    setActiveAthlete(id) {
      state.activeAthleteId = id;
      save(); emit();
    },
    toggleAdmin() {
      state.adminOpen = !state.adminOpen;
      emit();
    },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Derived selectors — all computations live here so screens stay dumb.
  // ─────────────────────────────────────────────────────────────────────────
  window.HZSelect = {
    athlete(id) { return state.roster.find(a => a.id === id); },

    // Team readiness 0-1 — avg mastery of current-level skills across team
    teamReadiness() {
      const tree = window.HZ_SKILL_TREE;
      const level = state.team.level;
      const statusMap = Object.fromEntries(window.HZ_SKILL_STATUS.map(s => [s.id, s.pct]));
      let sum = 0, n = 0;
      state.roster.forEach(a => {
        Object.keys(tree).forEach(cat => {
          tree[cat].skills.forEach(sk => {
            if (sk.level <= level) {
              const st = state.skills[a.id]?.[sk.id] || 'none';
              sum += statusMap[st];
              n += 1;
            }
          });
        });
      });
      return n ? sum / n : 0;
    },

    // Readiness of a single category (for score sheet input)
    categoryReadiness(category) {
      if (!category) return null;
      const tree = window.HZ_SKILL_TREE[category];
      if (!tree) return null;
      const level = state.team.level;
      const statusMap = Object.fromEntries(window.HZ_SKILL_STATUS.map(s => [s.id, s.pct]));
      let sum = 0, n = 0;
      state.roster.forEach(a => {
        tree.skills.forEach(sk => {
          if (sk.level <= level) {
            const st = state.skills[a.id]?.[sk.id] || 'none';
            sum += statusMap[st];
            n += 1;
          }
        });
      });
      return n ? sum / n : 0;
    },

    // Readiness of a single athlete at team level (0-1)
    athleteReadiness(athleteId) {
      const tree = window.HZ_SKILL_TREE;
      const level = state.team.level;
      const statusMap = Object.fromEntries(window.HZ_SKILL_STATUS.map(s => [s.id, s.pct]));
      let sum = 0, n = 0;
      Object.keys(tree).forEach(cat => {
        tree[cat].skills.forEach(sk => {
          if (sk.level <= level) {
            const st = state.skills[athleteId]?.[sk.id] || 'none';
            sum += statusMap[st];
            n += 1;
          }
        });
      });
      return n ? sum / n : 0;
    },

    // Skills gained this month for athlete (working→got_it, got_it→mastered)
    // For MVP we just count mastered + got_it; in real app this would be time-bounded
    athleteSkillsLearned(athleteId) {
      const tree = window.HZ_SKILL_TREE;
      let got = 0, mastered = 0, working = 0, total = 0;
      Object.keys(tree).forEach(cat => {
        tree[cat].skills.forEach(sk => {
          total++;
          const st = state.skills[athleteId]?.[sk.id] || 'none';
          if (st === 'got_it') got++;
          if (st === 'mastered') mastered++;
          if (st === 'working') working++;
        });
      });
      return { got, mastered, working, total };
    },

    attendance(athleteId) {
      const done = state.sessions.filter(s => !s.scheduled);
      const attended = done.filter(s => s.attended.includes(athleteId)).length;
      return { attended, total: done.length, pct: done.length ? attended/done.length : 0 };
    },

    teamAttendance() {
      const done = state.sessions.filter(s => !s.scheduled);
      let sum = 0;
      done.forEach(s => { sum += s.attended.length / state.roster.length; });
      return done.length ? sum / done.length : 0;
    },

    // Computed competition prediction — blends category readiness with routine section weights
    predictedScore() {
      const sheet = window.HZ_SCORE_SHEET;
      const routine = state.routine;
      const sectionsByType = {};
      routine.sections.forEach(s => {
        sectionsByType[s.type] = (sectionsByType[s.type] || 0) + (s.end - s.start + 1);
      });

      const rows = sheet.map(row => {
        let readiness = null;
        if (row.category) readiness = window.HZSelect.categoryReadiness(row.category);
        else if (row.id === 'dance') readiness = 0.82; // dance isn't skill-tracked
        else if (row.id === 'routine') {
          // routine composition: penalize if major sections are missing
          const keyTypes = ['standing_tumbling','running_tumbling','jumps','stunts','pyramid','dance'];
          const present = keyTypes.filter(t => sectionsByType[t] > 0).length / keyTypes.length;
          readiness = 0.6 + 0.35 * present;
        }
        // section-presence multiplier
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

      const subtotal = rows.reduce((s, r) => s + r.score, 0);
      const deductions = state.mockDeductions.reduce((s, d) => s + d.value, 0);
      const total = Math.max(0, subtotal - deductions);
      return { rows, subtotal, deductions, total, max: 100 };
    },
  };
})();
