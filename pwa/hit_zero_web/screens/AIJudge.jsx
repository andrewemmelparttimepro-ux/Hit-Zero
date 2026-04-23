// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO — AI Routine Judge (the money feature)
//
// Upload a routine → pre-flight checklist → "Analyze" → scorecard + timeline
// + per-audience feedback + proposed skill updates (coach approves to apply).
//
// Backed by window.HZdb.analyzeRoutine() — which mirrors the Supabase edge
// function analyze-routine exactly, but runs locally so the demo works with
// zero network. In production, swap the call for a fetch() to the real fn.
// ─────────────────────────────────────────────────────────────────────────────

const { useState: _aiUS, useEffect: _aiUE, useMemo: _aiUM, useRef: _aiUR } = React;

const SCORE_CALIBRATION_ANCHORS = [{
  label: 'Magic City comp day anchor',
  model_pct: 90.3,
  official_pct: 93.65,
  note: 'Single known day-of-competition score supplied by Andrew on 2026-04-23.',
}];

function clampProjectedScore(v) {
  return Math.max(0, Math.min(99.5, Number.isFinite(v) ? v : 0));
}

function calibrateScorecard(sc) {
  if (!sc || sc.calibration) return sc;
  const rawPct = Number(sc.pct ?? sc.total ?? 0);
  const possible = Number(sc.possible ?? 100) || 100;
  const anchor = SCORE_CALIBRATION_ANCHORS[0];
  const delta = anchor.official_pct - anchor.model_pct;
  const influence = Math.exp(-Math.abs(rawPct - anchor.model_pct) / 16);
  const adjustment = Number((delta * influence).toFixed(2));
  const pct = clampProjectedScore(rawPct + adjustment);
  return {
    ...sc,
    raw_pct: Number(rawPct.toFixed(2)),
    raw_total: Number((Number(sc.total ?? rawPct) || rawPct).toFixed(2)),
    pct: Number(pct.toFixed(2)),
    total: Number((pct / 100 * possible).toFixed(2)),
    calibration: {
      applied: Math.abs(adjustment) >= 0.05,
      basis: 'single_anchor_soft_offset',
      adjustment,
      raw_pct: Number(rawPct.toFixed(2)),
      raw_total: Number((Number(sc.total ?? rawPct) || rawPct).toFixed(2)),
      pct: Number(pct.toFixed(2)),
      total: Number((pct / 100 * possible).toFixed(2)),
      anchors: SCORE_CALIBRATION_ANCHORS,
    },
  };
}

function AIJudge({ snap, session, navigate }) {
  const me = session?.profile || { id: 'u_coach', role: 'coach' };
  const [, _bump] = _aiUS(0);
  const [view, setView] = _aiUS('results'); // 'results' | 'upload' | 'trend'
  const [activeId, setActiveId] = _aiUS(null);
  const [draft, setDraft] = _aiUS(null);
  const [actionErr, setActionErr] = _aiUS(null);
  const [reevaluatingId, setReevaluatingId] = _aiUS(null);
  // Read team + athletes live from HZsel so the mirrored Supabase roster
  // takes precedence over the stale snap prop captured at mount.
  const team = (window.HZsel?.team?.()) || (snap.teams || [])[0];

  // On mount, pull the live roster (team + athletes) and any Supabase-side
  // analyses into the local HZdb so every screen reflects the real backend
  // rather than the mock seed.
  _aiUE(() => {
    let cancelled = false;
    (async () => {
      if (!window.HZmirror) return;
      if (window.HZmirror.roster) await window.HZmirror.roster();
      // Re-read the team after mirror — we may have just swapped the seed out.
      const t = window.HZsel?.team?.();
      if (t?.id) await window.HZmirror.recent(t.id, 20);
      if (!cancelled) _bump(n => n + 1);
    })();
    return () => { cancelled = true; };
  }, []);

  const analyses = window.HZsel.recentAnalyses(20);
  const resolvedActiveId = activeId || analyses[0]?.id || null;
  const active = window.HZsel.analysisById(resolvedActiveId) || analyses[0];

  async function startReevaluation(analysis) {
    if (!analysis || !team) return;
    setActionErr(null);
    setReevaluatingId(analysis.id);
    try {
      const source = await resolveAnalysisSource(team, analysis);
      if (!source?.video_path && !source?.video_id) {
        throw new Error('Could not find the stored upload for this run yet. Upload once more and I’ll keep the source attached for one-click reevaluations.');
      }
      setDraft({
        key: `${analysis.id}:${Date.now()}`,
        division: analysis.division || team.division || 'Senior Coed 4',
        level: Number(analysis.level ?? team.level ?? 4),
        teamSize: Number(analysis.team_size ?? 20),
        pf: coachFlagsFromPreflight(analysis.preflight),
        source: { ...source, analysis_id: analysis.id },
        reusedFromAnalysisId: analysis.id,
        autoRun: true,
      });
      setView('upload');
    } catch (e) {
      setActionErr(e.message || String(e));
    } finally {
      setReevaluatingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)' }}>AI Routine Judge · Assistant Mode</div>
          <div className="hz-display" style={{ fontSize: 56, lineHeight: 1 }}>
            24/7 coach in your <span className="hz-zero">pocket</span>.
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 14, marginTop: 8, maxWidth: 600 }}>
            Upload a full-out, get a USASF-style scorecard, element-by-element timeline, and actionable feedback for coaches, athletes, and parents — in under a minute.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={'hz-btn ' + (view === 'results' ? 'hz-btn--primary' : 'hz-btn--ghost')} onClick={() => { setActionErr(null); setView('results'); }}>Scorecard</button>
          <button className={'hz-btn ' + (view === 'upload' ? 'hz-btn--primary' : 'hz-btn--ghost')} onClick={() => { setDraft(null); setActionErr(null); setView('upload'); }}>+ New analysis</button>
          <button className={'hz-btn ' + (view === 'trend' ? 'hz-btn--primary' : 'hz-btn--ghost')} onClick={() => setView('trend')}>Trend</button>
        </div>
      </div>
      {actionErr && (
        <div style={{ marginBottom: 14, color: 'var(--hz-red)', fontSize: 13 }}>{actionErr}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18 }}>
        <aside>
          <div className="hz-eyebrow" style={{ marginBottom: 10 }}>History</div>
          {analyses.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No analyses yet. Upload your first full-out.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analyses.map(a => {
              const pct = Number(calibrateScorecard(a.scorecard)?.pct ?? 0).toFixed(0);
              const isActive = a.id === (active?.id);
              const degraded = String(a.engine_version || '').startsWith('heuristic') && analysisUsesStoredVideo(a);
              const retryNeeded = degraded || (a.status === 'failed' && analysisUsesStoredVideo(a));
              const statusLabel = retryNeeded ? 'retry_needed' : a.status;
              const statusColor = retryNeeded ? 'var(--hz-amber)' : a.status === 'complete' ? 'var(--hz-green)' : a.status === 'processing' ? 'var(--hz-teal)' : a.status === 'preflight_failed' ? 'var(--hz-red)' : 'var(--hz-dim)';
              return (
                <button key={a.id} onClick={() => { setActiveId(a.id); setView('results'); }}
                  className="hz-nosel"
                  style={{
                    textAlign: 'left', padding: 14, borderRadius: 12, cursor: 'pointer',
                    background: isActive ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid ' + (isActive ? 'var(--hz-line-2)' : 'var(--hz-line)'),
                    color: '#fff',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="hz-eyebrow" style={{ color: statusColor }}>{statusLabel}</div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginTop: 3 }}>{(a.division || 'Senior') + ' L' + (a.level ?? '—')}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--hz-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: 22 }}>
                      {pct}<span style={{ color: 'var(--hz-dim)', fontSize: 11 }}>%</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--hz-dim)', marginTop: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                    {new Date(a.completed_at || a.created_at || a.queued_at).toLocaleDateString()} · {a.engine_version}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section>
          {view === 'upload' && <NewAnalysis key={`${team?.id}:${team?.division}:${team?.level}:${draft?.key || 'fresh'}`} team={team} draft={draft} onDone={(id) => { setDraft(null); setActiveId(id); setView('results'); _bump(n => n + 1); }}/>}
          {view === 'trend' && <TrendView snap={snap} team={team}/>}
          {view === 'results' && active && <Scorecard analysis={active} me={me} snap={snap} onReevaluate={() => startReevaluation(active)} reevaluating={reevaluatingId === active.id}/>}
          {view === 'results' && !active && (
            <div className="hz-card" style={{ padding: 40, color: 'var(--hz-dim)', textAlign: 'center' }}>
              No analyses yet. Click <b style={{ color: '#fff' }}>+ New analysis</b>.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
window.AIJudge = AIJudge;

// ─── Upload + pre-flight + analyze ────────────────────────────────────────
// USASF All Star routine-time max (2025–2026 season) — governs what we'd
// expect a "full-out" clip to look like for each division. Mini caps at 2:00,
// every other competitive division at 2:30.
const ROUTINE_MAX_SEC = {
  'Tiny':                 90,
  'Mini':                 120,
  'Youth':                150,
  'Junior':               150,
  'Senior':               150,
  'Senior Coed':          150,
  'Senior Coed 4':        150,
  'International Open':   150,
  'International Open Coed': 150,
  'Open Elite':           150,
};
function routineMaxSec(division) {
  if (!division) return 150;
  for (const key of Object.keys(ROUTINE_MAX_SEC)) {
    if (division.toLowerCase().startsWith(key.toLowerCase())) return ROUTINE_MAX_SEC[key];
  }
  return 150;
}
function fmtRoutineMax(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return s === 0 ? `${m}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

// Large source videos, especially iPhone MOVs, can make the backend spend
// minutes re-uploading hundreds of MB to Gemini. Re-encode them in-browser to
// a smaller analysis-friendly clip first so the edge function stays inside its
// wall-clock budget.
const PREP_TRIGGER_BYTES = 80 * 1024 * 1024;
const PREP_MOV_TRIGGER_BYTES = 35 * 1024 * 1024;
const PREP_MAX_BYTES = 90 * 1024 * 1024;
const PREP_MAX_EDGE = 960;
const PREP_FPS = 12;
const PREP_VIDEO_BPS = 2_000_000;
const ANALYSIS_SOURCE_CACHE_KEY = 'hz_ai_judge_sources_v1';

function needsBrowserPrep(file) {
  if (!file) return false;
  const lower = String(file.name || '').toLowerCase();
  const isMov = file.type === 'video/quicktime' || lower.endsWith('.mov');
  return file.size > PREP_TRIGGER_BYTES || (isMov && file.size > PREP_MOV_TRIGGER_BYTES);
}

function pickPrepMime() {
  if (!window.MediaRecorder) return null;
  const opts = [
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
    { mimeType: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
    { mimeType: 'video/mp4', ext: 'mp4' },
  ];
  for (const opt of opts) {
    try {
      if (!window.MediaRecorder.isTypeSupported || window.MediaRecorder.isTypeSupported(opt.mimeType)) return opt;
    } catch {}
  }
  return null;
}

function storageSafeVideoMime(mime) {
  const clean = String(mime || '').split(';')[0].trim().toLowerCase();
  if (!clean) return 'video/mp4';
  if (clean === 'video/webm' || clean === 'video/mp4' || clean === 'video/quicktime') return clean;
  if (clean.startsWith('video/')) return clean;
  return 'video/mp4';
}

function readAnalysisSourceCache() {
  try {
    const raw = localStorage.getItem(ANALYSIS_SOURCE_CACHE_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch {
    return {};
  }
}

function writeAnalysisSourceCache(cache) {
  try { localStorage.setItem(ANALYSIS_SOURCE_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

function rememberAnalysisSource(analysisId, source) {
  if (!analysisId || !source) return;
  const cache = readAnalysisSourceCache();
  cache[analysisId] = {
    ...(cache[analysisId] || {}),
    ...source,
    analysis_id: analysisId,
    saved_at: new Date().toISOString(),
  };
  const ids = Object.keys(cache);
  if (ids.length > 60) {
    ids
      .sort((a, b) => Date.parse(cache[b]?.saved_at || 0) - Date.parse(cache[a]?.saved_at || 0))
      .slice(60)
      .forEach(id => { delete cache[id]; });
  }
  writeAnalysisSourceCache(cache);
}

function cachedAnalysisSource(analysisId) {
  if (!analysisId) return null;
  return readAnalysisSourceCache()[analysisId] || null;
}

function coachFlagsFromPreflight(pf) {
  const src = pf?.coach_flags || pf || {};
  return {
    angle_ok: src.angle_ok !== false,
    lighting_ok: src.lighting_ok !== false,
    mat_visible: src.mat_visible !== false,
  };
}

function displaySourceName(source) {
  return String(source?.video_name || 'existing upload')
    .replace(/^\d+-/, '')
    .replace(/_/g, ' ');
}

function analysisUsesStoredVideo(a) {
  const pf = a?.preflight || {};
  return !!(pf.source_video_path || pf.source_video_id || a?.video_id);
}

function analysisGeminiError(feedback) {
  const note = (feedback || []).find(f => /Gemini error/i.test(String(f.body || '')));
  if (!note) return null;
  return String(note.body || '').replace(/^Judge notes:\s*/i, '').trim();
}

function analysisIsGeminiFallback(a, feedback = []) {
  return String(a?.engine_version || '').startsWith('heuristic') &&
    (analysisUsesStoredVideo(a) || !!analysisGeminiError(feedback));
}

function friendlyGeminiFallback(errorText) {
  const clean = String(errorText || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Gemini did not finish this video run.';
  if (/503|UNAVAILABLE|high demand/i.test(clean)) {
    return 'Gemini was temporarily overloaded and did not finish this video run.';
  }
  return clean.length > 220 ? clean.slice(0, 217) + '...' : clean;
}

function advisoryPreflight(pf, meta = {}) {
  const warnings = [];
  if (pf?.angle_ok === false) warnings.push('Camera angle may reduce judging accuracy.');
  if (pf?.lighting_ok === false) warnings.push('Low or uneven lighting may reduce judging accuracy.');
  if (pf?.mat_visible === false) warnings.push('Missing mat edges may reduce judging accuracy.');
  const out = {
    angle_ok: true,
    lighting_ok: true,
    mat_visible: true,
    coach_flags: { ...(pf || {}) },
    warnings,
  };
  if (meta.source_video_path) out.source_video_path = meta.source_video_path;
  if (meta.source_video_name) out.source_video_name = meta.source_video_name;
  if (meta.source_video_mime) out.source_video_mime = meta.source_video_mime;
  if (meta.source_video_id) out.source_video_id = meta.source_video_id;
  if (meta.reused_from_analysis_id) out.reused_from_analysis_id = meta.reused_from_analysis_id;
  if (meta.source_guess) out.source_guess = true;
  return out;
}

async function guessStoredVideoSource(team, analysis) {
  if (!team?.program_id || !team?.id || !window.HZ_FN_BASE || !window.HZ_ANON_KEY) return null;
  const prefix = `${team.program_id}/${team.id}`;
  const res = await fetch((window.HZ_FN_BASE || '') + '/storage/v1/object/list/videos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + window.HZ_ANON_KEY,
      'apikey': window.HZ_ANON_KEY,
    },
    body: JSON.stringify({
      prefix,
      limit: 30,
      sortBy: { column: 'name', order: 'desc' },
    }),
  });
  if (!res.ok) throw new Error('Could not look up the stored upload for this run.');
  const items = await res.json();
  if (!Array.isArray(items) || !items.length) return null;

  const targetMs = Date.parse(analysis?.created_at || analysis?.queued_at || analysis?.started_at || '') || Date.now();
  const ranked = items
    .map(item => {
      const name = String(item?.name || '');
      const tsMatch = name.match(/^(\d{13})-/);
      const stamp = tsMatch ? Number(tsMatch[1]) : Date.parse(item?.created_at || item?.updated_at || '') || 0;
      return {
        item,
        name,
        stamp,
        delta: stamp ? Math.abs(stamp - targetMs) : Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => a.delta - b.delta || String(b.name).localeCompare(String(a.name)));

  const best = ranked[0];
  if (!best || !Number.isFinite(best.delta) || best.delta > 30 * 60 * 1000) return null;
  return {
    video_path: `${prefix}/${best.name}`,
    video_name: best.name,
    video_mime: best.item?.metadata?.mimetype || null,
    source_guess: true,
  };
}

async function resolveAnalysisSource(team, analysis) {
  if (!analysis) return null;
  const pf = analysis.preflight || {};
  if (pf.source_video_path || pf.source_video_id) {
    const direct = {
      video_path: pf.source_video_path || null,
      video_id: pf.source_video_id || analysis.video_id || null,
      video_name: pf.source_video_name || null,
      video_mime: pf.source_video_mime || null,
      source_guess: !!pf.source_guess,
    };
    rememberAnalysisSource(analysis.id, direct);
    return direct;
  }
  if (analysis.video_id) {
    const direct = { video_id: analysis.video_id, video_name: pf.source_video_name || null };
    rememberAnalysisSource(analysis.id, direct);
    return direct;
  }
  const cached = cachedAnalysisSource(analysis.id);
  if (cached) return cached;
  const guessed = await guessStoredVideoSource(team, analysis);
  if (guessed) rememberAnalysisSource(analysis.id, guessed);
  return guessed;
}

function waitFor(el, ok, fail, failMsg) {
  return new Promise((resolve, reject) => {
    const onOk = () => { cleanup(); resolve(); };
    const onFail = () => { cleanup(); reject(new Error(failMsg)); };
    const cleanup = () => {
      el.removeEventListener(ok, onOk);
      if (fail) el.removeEventListener(fail, onFail);
    };
    el.addEventListener(ok, onOk, { once: true });
    if (fail) el.addEventListener(fail, onFail, { once: true });
  });
}

async function prepVideoForGemini(file, { onProgress } = {}) {
  if (!needsBrowserPrep(file)) return { file, prepared: false };
  if (!window.MediaRecorder) throw new Error('Large videos need browser-side optimization first. Open Hit Zero in Chrome and try again.');
  const fmt = pickPrepMime();
  if (!fmt) throw new Error('This browser cannot re-encode large routine videos yet. Open Hit Zero in Chrome and try again.');
  const mkCanvas = document.createElement('canvas');
  if (!mkCanvas.captureStream) throw new Error('This browser cannot optimize large clips before upload. Open Hit Zero in Chrome and try again.');

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  let raf = 0;
  let stopped = false;
  let recorder = null;
  let stream = null;
  try {
    await waitFor(video, 'loadedmetadata', 'error', 'Could not read the video metadata.');
    const w = Math.max(2, video.videoWidth || 1280);
    const h = Math.max(2, video.videoHeight || 720);
    const scale = Math.min(1, PREP_MAX_EDGE / Math.max(w, h));
    const outW = Math.max(2, Math.round((w * scale) / 2) * 2);
    const outH = Math.max(2, Math.round((h * scale) / 2) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not initialize the video optimizer.');

    stream = canvas.captureStream(PREP_FPS);
    recorder = new window.MediaRecorder(stream, {
      mimeType: fmt.mimeType,
      videoBitsPerSecond: PREP_VIDEO_BPS,
    });

    const chunks = [];
    const draw = () => {
      ctx.drawImage(video, 0, 0, outW, outH);
      if (video.duration) onProgress?.(Math.min(1, video.currentTime / video.duration));
      if (!stopped && !video.paused && !video.ended) raf = requestAnimationFrame(draw);
    };

    const prepared = await new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      recorder.onerror = (e) => reject(new Error('Browser video optimization failed: ' + (e.error?.message || 'MediaRecorder error')));
      recorder.onstop = () => resolve(new Blob(chunks, { type: fmt.mimeType }));
      video.onerror = () => reject(new Error('Could not decode this video in the browser.'));
      video.onended = () => {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        onProgress?.(1);
        if (recorder.state !== 'inactive') recorder.stop();
      };

      recorder.start(1000);
      video.play().then(() => { draw(); }).catch(() => reject(new Error('Could not play the video for optimization.')));
    });

    const base = String(file.name || 'routine').replace(/\.[^.]+$/, '');
    const safeMime = storageSafeVideoMime(fmt.mimeType);
    const out = new File([prepared], `${base}-gemini.${fmt.ext}`, {
      type: safeMime,
      lastModified: Date.now(),
    });
    if (out.size > PREP_MAX_BYTES) {
      throw new Error(`Video is still ${(out.size / 1024 / 1024).toFixed(0)}MB after optimization. Trim it a bit and try again.`);
    }
    return { file: out, prepared: true };
  } finally {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    try { video.pause(); } catch {}
    if (stream) stream.getTracks().forEach(t => t.stop());
    URL.revokeObjectURL(url);
  }
}

function NewAnalysis({ team, onDone, draft }) {
  const [division, setDivision] = _aiUS(draft?.division || team?.division || 'Senior Coed 4');
  const [level, setLevel] = _aiUS(draft?.level || team?.level || 4);
  const [teamSize, setTeamSize] = _aiUS(draft?.teamSize || 20);
  const [file, setFile] = _aiUS(null);
  const [source, setSource] = _aiUS(draft?.source || null);
  const [pf, setPf] = _aiUS(draft?.pf || { angle_ok: true, lighting_ok: true, mat_visible: true });
  const [status, setStatus] = _aiUS('idle'); // idle, preparing, processing, done, error
  const [progress, setProgress] = _aiUS(0);
  const [err, setErr] = _aiUS(null);
  const autoRunRef = _aiUR(false);
  const maxSec = routineMaxSec(division);
  const maxFmt = fmtRoutineMax(maxSec);

  async function run() {
    setStatus(file && needsBrowserPrep(file) ? 'preparing' : 'processing');
    setProgress(0);
    setErr(null);

    // Progress is a soft indicator — the real work happens server-side in the
    // background. We tick up slowly to ~90% while polling, then snap to 100%
    // when the analysis row flips to 'complete'.
    let tick;
    const startTicks = () => {
      let i = 0;
      tick = setInterval(() => { i += 1; setProgress(Math.min(90, Math.round(i * 1.5))); }, 1000);
    };
    const stopTicks = () => { if (tick) clearInterval(tick); tick = null; };

    try {
      const supa = window.HZsupa;           // set by index.html when credentials are available

      // Prefer the real path whenever Supabase creds are wired — video is
      // optional; without one we still get a USASF-scored run from the rubric
      // engine (Gemini fallback), but we warn the coach so they're not
      // surprised.
      if (supa) {
        let videoPath = source?.video_path || null;
        let videoId = source?.video_id || null;
        let uploadFile = file;
        let prepared = false;
        let sourceMeta = source ? { ...source } : null;
        if (file) {
          const prep = await prepVideoForGemini(file, {
            onProgress: (ratio) => setProgress(Math.min(20, Math.round(ratio * 20))),
          });
          uploadFile = prep.file;
          prepared = prep.prepared;
          setStatus('processing');
          if (prepared) setProgress(20);

          videoPath = team.program_id + '/' + team.id + '/' + Date.now() + '-' + uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          videoId = null;
          sourceMeta = {
            video_path: videoPath,
            video_name: uploadFile.name,
            video_mime: storageSafeVideoMime(uploadFile.type),
          };
          // Resumable TUS upload. The stock storage API has a 50MB per-file
          // cap on free tier; TUS chunks in 6MB slices so a full routine
          // (200–500MB) goes through, and we get real byte-level progress.
          await new Promise((resolve, reject) => {
            if (!window.tus) return reject(new Error('tus client not loaded'));
            // Main hostname is the safe default — the `.storage.` subdomain
            // isn't provisioned on every project and fails CORS / DNS.
            const base = (window.HZ_FN_BASE || '');
            const uploadBase = prepared ? 20 : 0;
            const uploadSpan = prepared ? 60 : 80;
            const upload = new window.tus.Upload(uploadFile, {
              endpoint: base + '/storage/v1/upload/resumable',
              retryDelays: [0, 2000, 5000, 10000, 20000],
              headers: {
                authorization: 'Bearer ' + window.HZ_ANON_KEY,
                apikey: window.HZ_ANON_KEY,
                'x-upsert': 'false',
              },
              uploadDataDuringCreation: true,
              removeFingerprintOnSuccess: true,
              chunkSize: 6 * 1024 * 1024, // Supabase TUS requires exactly 6MB.
              metadata: {
                bucketName: 'videos',
                objectName: videoPath,
                contentType: storageSafeVideoMime(uploadFile.type),
                cacheControl: '3600',
              },
              onError: (e) => reject(new Error('upload failed: ' + (e.message || e))),
              onProgress: (bytesUploaded, bytesTotal) => {
                const ratio = bytesTotal ? (bytesUploaded / bytesTotal) : 0;
                const upPct = uploadBase + ratio * uploadSpan;
                setProgress(Math.min(80, Math.round(upPct)));
              },
              onSuccess: () => resolve(),
            });
            upload.start();
          });
        }
        // From here on, analysis is server-side. Tick slowly from wherever
        // upload ended up to ~95% while we poll.
        const pollStart = file ? 80 : (sourceMeta ? 12 : 0);
        setProgress(pollStart);
        let ti = 0;
        tick = setInterval(() => {
          ti += 1;
          setProgress((p) => Math.min(95, pollStart + Math.round(ti * 0.5)));
        }, 1000);

        // Kick off the analysis with retry + real error surfacing. Keep the
        // request headers CORS-safe for the current edge-function config:
        // `Authorization` is enough here, while `apikey` / `x-client-info`
        // can trigger a blocked preflight before the function ever runs.
        const kickBody = {
          team_id: team.id,
          video_path: videoPath,
          video_id: videoId,
          division,
          level: Number(level),
          team_size: Number(teamSize),
          preflight: advisoryPreflight(pf, {
            source_video_path: sourceMeta?.video_path || null,
            source_video_id: videoId || null,
            source_video_name: sourceMeta?.video_name || null,
            source_video_mime: sourceMeta?.video_mime || null,
            reused_from_analysis_id: draft?.reusedFromAnalysisId || source?.analysis_id || null,
            source_guess: !!sourceMeta?.source_guess,
          }),
        };
        let kick;
        async function tryFetch(attempt) {
          const ctrl = new AbortController();
          const timeout = setTimeout(() => ctrl.abort('timeout'), 30000);
          try {
            const fn = await fetch((window.HZ_FN_BASE || '') + '/functions/v1/analyze-routine-v3', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.HZ_ANON_KEY },
              body: JSON.stringify(kickBody),
              signal: ctrl.signal,
            });
            clearTimeout(timeout);
            if (!fn.ok) throw new Error('edge function ' + fn.status + ': ' + (await fn.text()));
            return await fn.json();
          } catch (e) {
            clearTimeout(timeout);
            throw new Error(`kick fetch failed (attempt ${attempt}): ${e.message || e.name || e}`);
          }
        }
        try {
          kick = await tryFetch(1);
        } catch (e1) {
          console.warn(e1.message);
          try {
            await new Promise(r => setTimeout(r, 1200));
            kick = await tryFetch(2);
          } catch (e2) {
            throw new Error(`${e1.message} · retry also failed: ${e2.message}`);
          }
        }
        if (!kick?.analysis_id) throw new Error('no analysis_id returned');
        if (sourceMeta || videoId) {
          rememberAnalysisSource(kick.analysis_id, {
            video_path: sourceMeta?.video_path || null,
            video_id: videoId || null,
            video_name: sourceMeta?.video_name || null,
            video_mime: sourceMeta?.video_mime || null,
            reused_from_analysis_id: draft?.reusedFromAnalysisId || source?.analysis_id || null,
            source_guess: !!sourceMeta?.source_guess,
          });
        }

        // Poll until the row flips to complete / failed / preflight_failed.
        // Gives us up to ~15 minutes of runway for long routines.
        const deadline = Date.now() + 15 * 60 * 1000;
        let row = null;
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 2500));
          const q = await supa.from('routine_analyses').select('id, status, error').eq('id', kick.analysis_id).maybeSingle();
          if (q.error) throw new Error('poll: ' + q.error.message);
          row = q.data;
          if (!row) continue;
          if (row.status === 'complete') break;
          if (row.status === 'failed' || row.status === 'preflight_failed') {
            throw new Error(row.error || ('analysis ' + row.status));
          }
        }
        if (!row || row.status !== 'complete') throw new Error('analysis timed out after 15 minutes');

        // Mirror the full Supabase-side analysis into the in-browser HZdb so
        // the existing history + scorecard screens can render it. This bridges
        // the mock-store UI to the real backend without a full rewrite.
        await window.HZmirror?.analysis(kick.analysis_id);

        stopTicks();
        setProgress(100);
        setTimeout(() => { setStatus('done'); onDone(kick.analysis_id); }, 300);
      } else {
        // Demo / offline path — in-browser heuristic, resolves synchronously.
        startTicks();
        const res = await window.HZdb.analyzeRoutine({
          team_id: team.id,
          video_id: file?.name ? 'v_' + file.name : null,
          division, level: Number(level), team_size: Number(teamSize),
          preflight: pf,
        });
        stopTicks();
        setProgress(100);
        setTimeout(() => { setStatus('done'); onDone(res.analysis_id); }, 300);
      }
    } catch (e) {
      stopTicks();
      setErr(e.message || String(e));
      setStatus('error');
    }
  }

  _aiUE(() => {
    if (!draft?.autoRun || autoRunRef.current) return;
    autoRunRef.current = true;
    run();
  }, [draft?.autoRun]);

  return (
    <div className="hz-card" style={{ padding: 28 }}>
      <div className="hz-eyebrow">New analysis</div>
      <div className="hz-display" style={{ fontSize: 28, marginTop: 4 }}>Upload a full-out.</div>

      <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
        {source ? (
          <div style={{ padding: 18, borderRadius: 14, border: '1px solid var(--hz-line-2)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Using existing upload</div>
            <div style={{ marginTop: 6, color: '#fff', fontSize: 16, fontWeight: 700 }}>{displaySourceName(source)}</div>
            <div style={{ marginTop: 6, color: 'var(--hz-dim)', fontSize: 12 }}>
              {source.source_guess
                ? 'Matched from this team’s recent uploads so you can reevaluate without dragging the file in again.'
                : 'This run will reuse the video already sitting in Supabase Storage.'}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="hz-btn hz-btn--ghost" type="button" onClick={() => setSource(null)}>Choose a different video</button>
            </div>
          </div>
        ) : (
          <FileDrop file={file} onFile={(next) => { setFile(next); if (next) setSource(null); }} maxFmt={maxFmt} division={division}/>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <L label="Division">
            <select value={division} onChange={(e) => setDivision(e.target.value)} className="hz-input">
              {['Tiny','Mini','Youth','Junior','Senior','Senior Coed','Senior Coed 4','International Open','International Open Coed','Open Elite'].map(d => <option key={d}>{d}</option>)}
            </select>
          </L>
          <L label="Level">
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="hz-input">
              {[1,2,3,4,5,6,7].map(l => <option key={l} value={l}>Level {l}</option>)}
            </select>
          </L>
          <L label="Team size">
            <input type="number" min="1" max="40" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="hz-input"/>
          </L>
        </div>

        <PreflightChecklist pf={pf} onChange={setPf}/>
      </div>

      <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'var(--hz-dim)', fontSize: 12, maxWidth: 380 }}>
          {status === 'preparing'
            ? `Optimizing video... ${progress}%`
            : status === 'processing'
            ? `Analyzing… ${progress}%`
            : source
            ? `Reevaluating the stored upload for this ${division} routine. No re-upload needed.`
            : `${division} routines cap at ${maxFmt} (USASF 2025–26). Analysis runs in 1–3 minutes — you can close this tab, it'll finish in the background.`}
        </div>
        <button
          className="hz-btn hz-btn--primary"
          disabled={status === 'processing' || status === 'preparing' || !team}
          onClick={run}>
          {(status === 'processing' || status === 'preparing') ? `${status === 'preparing' ? 'Optimizing' : 'Analyzing'}… ${progress}%` : 'Run AI Judge →'}
        </button>
      </div>

      {(status === 'processing' || status === 'preparing') && <ProgressBar pct={progress}/>}
      {err && <div style={{ marginTop: 12, color: 'var(--hz-red)', fontSize: 13 }}>Error: {err}</div>}
    </div>
  );
}
function ProgressBar({ pct }) {
  return (
    <div style={{ marginTop: 14, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))', transition: 'width 0.25s' }}/>
    </div>
  );
}
function L({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="hz-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}
// Hard cap on video length we send to Gemini — keeps token spend bounded
// and surfaces a clear error instead of a mystery timeout mid-upload.
const MAX_CLIP_SEC = 210; // 3:30

function FileDrop({ file, onFile, maxFmt, division }) {
  const [err, setErr] = _aiUS(null);
  const [hot, setHot] = _aiUS(false);

  async function pickFile(f) {
    setErr(null);
    if (!f) { onFile(null); return; }
    if (!f.type || !f.type.startsWith('video/')) {
      setErr(`That's not a video file (${f.type || 'unknown type'}). Pick an MP4, MOV, or WebM.`);
      onFile(null);
      return;
    }
    // Probe duration via a hidden <video> element so we can reject long clips
    // before the user pays to upload them.
    try {
      const url = URL.createObjectURL(f);
      const dur = await new Promise((resolve, reject) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => resolve(v.duration);
        v.onerror = () => reject(new Error('could not read duration'));
        v.src = url;
      }).finally(() => URL.revokeObjectURL(url));
      if (Number.isFinite(dur) && dur > MAX_CLIP_SEC + 0.5) {
        const m = Math.floor(dur / 60), s = Math.round(dur % 60);
        setErr(`Clip is ${m}:${String(s).padStart(2,'0')} — max is 3:30. Trim the intro/outro and try again.`);
        onFile(null);
        return;
      }
    } catch { /* non-fatal — let upload proceed if probing fails */ }
    onFile(f);
  }

  // Native drag-and-drop handlers. Without these, a drop on the <label> bubbles
  // to the window, Chrome navigates to the file URL, and you end up with a
  // duplicate in Downloads — which is exactly what was happening.
  function onDragOver(e) { e.preventDefault(); e.stopPropagation(); setHot(true); }
  function onDragLeave(e) { e.preventDefault(); e.stopPropagation(); setHot(false); }
  function onDrop(e) {
    e.preventDefault(); e.stopPropagation(); setHot(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) pickFile(f);
  }

  return (
    <label onDragOver={onDragOver} onDragEnter={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      border: '1.5px dashed ' + (hot ? 'var(--hz-pink)' : 'var(--hz-line-2)'),
      borderRadius: 14, padding: 28, cursor: 'pointer', textAlign: 'center', color: 'var(--hz-dim)',
      background: hot ? 'rgba(249,127,172,0.08)' : 'rgba(255,255,255,0.02)',
      transition: 'background 0.15s, border-color 0.15s',
    }}>
      <input type="file" accept="video/*" style={{ display: 'none' }}
        onChange={(e) => pickFile(e.target.files?.[0] || null)} />
      {file ? (
        <div>
          <div style={{ color: '#fff', fontWeight: 600 }}>{file.name}</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            {(file.size/1024/1024).toFixed(1)} MB · {needsBrowserPrep(file) ? 'Will optimize before upload' : 'Ready to analyze'}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
            {hot ? 'Drop it — we\u2019ll take it from here.' : 'Drop a video or click to pick'}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Full-mat wide shot. Clips up to <b style={{ color: '#fff' }}>3:30</b> supported — {division || 'Senior'} routines run to <b style={{ color: '#fff' }}>{maxFmt || '2:30'}</b> per USASF 2025–26. MP4 / MOV / WebM, up to 500MB. Large clips get optimized in-browser first so Gemini does not choke on giant phone exports. Skip for demo — we'll analyze with your roster.
          </div>
        </div>
      )}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--hz-red)' }}>{err}</div>}
    </label>
  );
}
function PreflightChecklist({ pf, onChange }) {
  const items = [
    { key: 'angle_ok',    label: 'Front wide shot (not the side of the mat)' },
    { key: 'lighting_ok', label: 'Gym lights fully on (no strobes, no backlight)' },
    { key: 'mat_visible', label: 'Entire mat visible edge to edge' },
  ];
  return (
    <div>
      <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Preflight</div>
      <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginBottom: 10 }}>
        Best-results checklist only. We&apos;ll still analyze if some boxes are unchecked.
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map(it => (
          <label key={it.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={pf[it.key]} onChange={(e) => onChange({ ...pf, [it.key]: e.target.checked })}
              style={{ accentColor: 'var(--hz-teal)' }}/>
            <span style={{ color: pf[it.key] ? '#fff' : 'var(--hz-dim)' }}>{it.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Scorecard (results) ──────────────────────────────────────────────────
function Scorecard({ analysis, me, snap, onReevaluate, reevaluating }) {
  const a = analysis;
  const sc = calibrateScorecard(a.scorecard || { categories: [], total: 0, possible: 100, pct: 0, deductions: { total: 0, count: 0 } });
  const elements = window.HZsel.elementsFor(a.id);
  const dedns = window.HZsel.deductionsFor(a.id);
  const audience = me.role === 'athlete' ? 'athlete' : me.role === 'parent' ? 'parent' : 'coach';
  const feedback = window.HZsel.feedbackFor(a.id, audience);
  const proposals = window.HZsel.pendingProposalsFor(a.id);
  const coachFeedback = window.HZsel.feedbackFor(a.id, 'coach');
  const geminiError = analysisGeminiError(coachFeedback);
  const geminiFallback = analysisIsGeminiFallback(a, coachFeedback);
  const failedVideoJudge = a.status === 'failed' && analysisUsesStoredVideo(a);

  if (a.status === 'processing' || a.status === 'queued') {
    return (
      <div className="hz-card" style={{ padding: 40, textAlign: 'center' }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Processing</div>
        <div className="hz-display" style={{ fontSize: 28, marginTop: 8 }}>Crunching the numbers…</div>
        <ProgressBar pct={80}/>
      </div>
    );
  }
  if (a.status === 'preflight_failed') {
    const msg = (a.error && a.error.trim() && a.error.trim() !== 'Preflight failed:')
      ? a.error
      : 'That older run was blocked by the checklist gate. Retry it — the live app now treats checklist misses as warnings instead of a hard stop.';
    return (
      <div className="hz-card" style={{ padding: 28, border: '1px solid rgba(255,94,108,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="hz-eyebrow" style={{ color: 'var(--hz-red)' }}>Preflight failed</div>
            <div className="hz-display" style={{ fontSize: 22, marginTop: 6 }}>Re-shoot and try again.</div>
          </div>
          {onReevaluate && (
            <button className="hz-btn hz-btn--ghost" disabled={!!reevaluating} onClick={onReevaluate}>
              {reevaluating ? 'Finding upload…' : 'Reevaluate'}
            </button>
          )}
        </div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 10 }}>{msg}</div>
      </div>
    );
  }
  if (failedVideoJudge) {
    const msg = friendlyGeminiFallback(a.error || geminiError || 'Video judge failed before it could return a score.');
    return (
      <div className="hz-card" style={{ padding: 28, border: '1px solid rgba(255,184,77,0.35)', background: 'rgba(255,184,77,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="hz-eyebrow" style={{ color: 'var(--hz-amber)' }}>Video judge unavailable</div>
            <div className="hz-display" style={{ fontSize: 22, marginTop: 6 }}>This run did not produce a valid score.</div>
          </div>
          {onReevaluate && (
            <button className="hz-btn hz-btn--primary" disabled={!!reevaluating} onClick={onReevaluate}>
              {reevaluating ? 'Finding upload…' : 'Retry Video Judge'}
            </button>
          )}
        </div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 10 }}>{msg}</div>
      </div>
    );
  }

  const durationSec = (a.duration_ms || 0) / 1000;
  const calibration = sc.calibration;
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {geminiFallback && (
        <div className="hz-card" style={{ padding: 22, border: '1px solid rgba(255,184,77,0.35)', background: 'rgba(255,184,77,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="hz-eyebrow" style={{ color: 'var(--hz-amber)' }}>Video judge unavailable</div>
              <div className="hz-display" style={{ fontSize: 24, marginTop: 6 }}>This score is a fallback estimate, not a real Gemini judge result.</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 10, maxWidth: 760 }}>
                {friendlyGeminiFallback(geminiError)} Retry the stored upload to get a real video analysis.
              </div>
            </div>
            {onReevaluate && (
              <button className="hz-btn hz-btn--primary" disabled={!!reevaluating} onClick={onReevaluate}>
                {reevaluating ? 'Finding upload…' : 'Retry Video Judge'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hero score */}
      <div className="hz-card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <div className="hz-eyebrow">{geminiFallback ? 'Fallback estimate' : 'Projected score'}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontFamily: 'var(--hz-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: 96, lineHeight: 1 }}>
                {Number(sc.pct ?? 0).toFixed(1)}
              </div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 18 }}>/100</div>
            </div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 6 }}>
              {(a.division || '—')} · L{a.level ?? '—'} · engine {a.engine_version} · ran in {durationSec.toFixed(1)}s
            </div>
            {calibration?.applied && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10, color: 'var(--hz-dim)', fontSize: 12 }}>
                <span className="hz-pill hz-pill-teal">Calibrated</span>
                <span>
                  Raw model {Number(calibration.raw_pct ?? sc.raw_pct ?? 0).toFixed(1)} · official anchor 90.3 → 93.65 · adjustment {Number(calibration.adjustment || 0) >= 0 ? '+' : ''}{Number(calibration.adjustment || 0).toFixed(1)}
                </span>
              </div>
            )}
            {onReevaluate && (
              <div style={{ marginTop: 14 }}>
                <button className="hz-btn hz-btn--ghost" disabled={!!reevaluating} onClick={onReevaluate}>
                  {reevaluating ? 'Finding upload…' : 'Reevaluate'}
                </button>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="hz-eyebrow">Confidence</div>
            <div style={{ fontFamily: 'var(--hz-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: 42 }}>
              {Math.round((a.confidence || 0) * 100)}%
            </div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>
              {dedns.length} deductions · {elements.length} elements
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="hz-card" style={{ padding: 22 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Category breakdown</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {sc.categories.map(c => (
            <div key={c.code}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{c.label}</span>
                <span style={{ color: 'var(--hz-dim)' }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{c.awarded.toFixed(1)}</span>/{c.max}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  width: Math.min(100, c.pct) + '%', height: '100%',
                  background: c.pct >= 85 ? 'var(--hz-green)' : c.pct >= 70 ? 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' : 'var(--hz-amber)',
                }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback */}
      <div className="hz-card" style={{ padding: 22 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 12 }}>{audience === 'coach' ? 'Coach notes' : audience === 'parent' ? 'Parent summary' : 'For you'}</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {feedback.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No feedback generated.</div>}
          {feedback.map(f => {
            const color = f.kind === 'praise' ? 'var(--hz-teal)' : f.kind === 'recommendation' ? 'var(--hz-pink)' : f.kind === 'warning' ? 'var(--hz-amber)' : 'var(--hz-dim)';
            return (
              <div key={f.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: 10, color, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 800 }}>
                  {f.kind}{f.category_code ? ' · ' + f.category_code.replace('_',' ') : ''}
                </div>
                <div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.45 }}>{f.body}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Proposed skill updates (coach only) */}
      {audience === 'coach' && proposals.length > 0 && (
        <div className="hz-card" style={{ padding: 22 }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)', marginBottom: 12 }}>Skill progress proposals · {proposals.length} pending</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginBottom: 12 }}>
            The AI detected these skills hitting at or above "most" threshold. Approve to flip in the Skill Matrix and fire the Hit Zero celebration.
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {proposals.map(p => {
              const athlete = (snap.athletes || []).find(x => x.id === p.athlete_id);
              const skill = (snap.skills || []).find(x => x.id === p.skill_id);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, border: '1px solid var(--hz-line)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {athlete?.display_name ?? '—'} · {skill?.name ?? p.skill_id}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 3 }}>
                      {p.from_status ?? 'none'} → <span style={{ color: p.to_status === 'mastered' ? 'var(--hz-pink)' : 'var(--hz-teal)', fontWeight: 700 }}>{p.to_status}</span> · {(p.confidence*100).toFixed(0)}% conf
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="hz-btn hz-btn--ghost" onClick={() => window.HZdb.applySkillUpdate(p.id, 'reject')}>Reject</button>
                    <button className="hz-btn hz-btn--primary" onClick={() => window.HZdb.applySkillUpdate(p.id, 'approve')}>Approve</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="hz-card" style={{ padding: 22 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Timeline · {elements.length} elements · {dedns.length} deductions</div>
        <Timeline elements={elements} deductions={dedns}/>
        <ElementsTable elements={elements} snap={snap}/>
      </div>
    </div>
  );
}

function Timeline({ elements, deductions }) {
  const end = Math.max(1, ...elements.map(e => e.t_end_ms), ...deductions.map(d => d.t_ms || 0));
  return (
    <div style={{ position: 'relative', height: 64, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)', overflow: 'hidden' }}>
      {elements.map(e => {
        const left = (e.t_start_ms / end) * 100;
        const width = Math.max(0.6, ((e.t_end_ms - e.t_start_ms) / end) * 100);
        const tier = e.metrics?.tier;
        const color = tier === 'max' ? 'var(--hz-green)' : tier === 'most' ? 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' : tier === 'majority' ? 'var(--hz-teal)' : 'var(--hz-dim)';
        return (
          <div key={e.id} title={e.label}
            style={{ position: 'absolute', left: left + '%', width: width + '%', top: 12, bottom: 12, borderRadius: 4, background: color, opacity: 0.85 }}/>
        );
      })}
      {deductions.map(d => {
        const left = ((d.t_ms || 0) / end) * 100;
        return (
          <div key={d.id} title={d.description}
            style={{ position: 'absolute', left: left + '%', top: 0, bottom: 0, width: 2, background: d.severity === 'major' ? 'var(--hz-red)' : 'var(--hz-amber)' }}/>
        );
      })}
    </div>
  );
}
function ElementsTable({ elements, snap }) {
  return (
    <div style={{ marginTop: 14, maxHeight: 260, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--hz-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, fontSize: 10 }}>
            {['Time','Element','Tier','Conf','Pts'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--hz-line)' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {elements.map(e => (
            <tr key={e.id} style={{ borderBottom: '1px dashed var(--hz-line)' }}>
              <td style={{ padding: '8px 10px', color: 'var(--hz-dim)' }}>{(e.t_start_ms/1000).toFixed(1)}s</td>
              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{e.label}</td>
              <td style={{ padding: '8px 10px', color: e.metrics?.tier === 'max' ? 'var(--hz-green)' : e.metrics?.tier === 'most' ? 'var(--hz-pink)' : 'var(--hz-dim)', textTransform: 'capitalize' }}>{e.metrics?.tier || '—'}</td>
              <td style={{ padding: '8px 10px', color: 'var(--hz-dim)' }}>{(e.confidence*100).toFixed(0)}%</td>
              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{Number(e.raw_score).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Trend view ───────────────────────────────────────────────────────────
function TrendView({ snap, team }) {
  const series = window.HZsel.scoreTrend(team?.id, 8).map(point => {
    const analysis = window.HZsel.analysisById(point.id);
    const sc = calibrateScorecard(analysis?.scorecard || { pct: point.pct, total: point.pct, possible: 100 });
    return { ...point, pct: Number(sc?.pct ?? point.pct ?? 0) };
  });
  if (series.length === 0) {
    return <div className="hz-card" style={{ padding: 40, color: 'var(--hz-dim)', textAlign: 'center' }}>No completed analyses yet.</div>;
  }
  const w = 720, h = 280, pad = 40;
  const xs = (i) => pad + (i / Math.max(1, series.length - 1)) * (w - 2*pad);
  const ys = (pct) => h - pad - (pct / 100) * (h - 2*pad);
  const path = series.map((p, i) => (i === 0 ? 'M' : 'L') + xs(i) + ' ' + ys(p.pct)).join(' ');
  const delta = series.length > 1 ? (series[series.length-1].pct - series[0].pct) : 0;
  return (
    <div className="hz-card" style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div className="hz-eyebrow">Score trend · last {series.length} analyses</div>
          <div className="hz-display" style={{ fontSize: 28, marginTop: 4 }}>
            {delta >= 0 ? 'Up ' : 'Down '}<span className="hz-zero">{Math.abs(delta).toFixed(1)}%</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="hz-eyebrow">Latest</div>
          <div style={{ fontFamily: 'var(--hz-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: 42 }}>
            {series[series.length-1].pct.toFixed(1)}<span style={{ color: 'var(--hz-dim)', fontSize: 18 }}>%</span>
          </div>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="tg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#27CFD7"/>
            <stop offset="100%" stopColor="#F97FAC"/>
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map(y => (
          <g key={y}>
            <line x1={pad} x2={w - pad} y1={ys(y)} y2={ys(y)} stroke="rgba(255,255,255,0.05)"/>
            <text x={pad - 6} y={ys(y)+4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">{y}</text>
          </g>
        ))}
        <path d={path} stroke="url(#tg)" strokeWidth="3" fill="none"/>
        {series.map((p, i) => (
          <g key={p.id}>
            <circle cx={xs(i)} cy={ys(p.pct)} r="4.5" fill="#fff"/>
            <text x={xs(i)} y={ys(p.pct) - 10} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.6)">{p.pct.toFixed(0)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
