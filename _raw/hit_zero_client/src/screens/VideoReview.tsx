// src/screens/VideoReview.tsx — coach leaves timestamped notes on a clip.
// Tapping the timeline drops a marker; writing a note attaches at that ms.

import { useEffect, useRef, useState } from 'react';
import { db, subscribeTable } from '../lib/supabase';
import { haptics } from '../lib/native';

interface Note { id: string; at_ms: number; body: string; author_id: string; }

export function VideoReview({ videoId, canVerify }: { videoId: string; canVerify: boolean }) {
  const [video, setVideo] = useState<any>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [markAt, setMarkAt] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    (async () => {
      const { data: v } = await db.from('videos').select('*').eq('id', videoId).single();
      setVideo(v);
      const { data: url } = await db.storage.from('videos').createSignedUrl(v.storage_path, 3600);
      if (url && videoRef.current) videoRef.current.src = url.signedUrl;
      const { data: n } = await db.from('video_notes').select('*').eq('video_id', videoId).order('at_ms');
      setNotes(n ?? []);
    })();

    return subscribeTable('video_notes', { video_id: videoId }, (row, evt) => {
      setNotes(prev => {
        if (evt === 'DELETE') return prev.filter(n => n.id !== row.id);
        const idx = prev.findIndex(n => n.id === row.id);
        if (idx >= 0) { const c = [...prev]; c[idx] = row; return c; }
        return [...prev, row].sort((a,b) => a.at_ms - b.at_ms);
      });
    });
  }, [videoId]);

  async function addNote() {
    if (markAt == null || !draft.trim()) return;
    const { data: { user } } = await db.auth.getUser();
    await db.from('video_notes').insert({
      video_id: videoId, at_ms: markAt, author_id: user!.id, body: draft
    });
    setDraft(''); setMarkAt(null);
    haptics.tap();
  }

  async function verify() {
    const { data: { user } } = await db.auth.getUser();
    await db.from('videos').update({
      is_verified: true, verified_by: user!.id, verified_at: new Date().toISOString()
    }).eq('id', videoId);
    if (video?.athlete_id && video?.skill_id) {
      await db.from('athlete_skills').update({ status: 'mastered', video_url: videoId })
        .eq('athlete_id', video.athlete_id).eq('skill_id', video.skill_id);
      await db.from('celebrations').insert({
        team_id: video.team_id,
        athlete_id: video.athlete_id,
        kind: 'skill_progress',
        skill_id: video.skill_id,
        from_status: 'got_it',
        to_status: 'mastered',
        headline: 'Mastered on video'
      });
    }
    haptics.success();
  }

  const dur = videoRef.current?.duration ? videoRef.current.duration * 1000 : 0;

  return (
    <div className="review">
      <video ref={videoRef} controls playsInline
        onTimeUpdate={() => {/* could highlight current note */}} />
      <div className="timeline" onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const pct = (e.clientX - r.left) / r.width;
        setMarkAt(Math.round(pct * dur));
        if (videoRef.current) videoRef.current.currentTime = pct * (dur/1000);
      }}>
        {notes.map(n => (
          <div key={n.id} className="marker" style={{ left: `${(n.at_ms/dur)*100}%` }}
               title={n.body} />
        ))}
        {markAt != null && <div className="marker new" style={{ left: `${(markAt/dur)*100}%` }} />}
      </div>

      {markAt != null && (
        <div className="note-compose">
          <div className="at">{(markAt/1000).toFixed(1)}s</div>
          <input value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="Note at this moment…" autoFocus />
          <button onClick={addNote} disabled={!draft.trim()}>Add</button>
        </div>
      )}

      <ul className="notes">
        {notes.map(n => (
          <li key={n.id} onClick={() => { if (videoRef.current) videoRef.current.currentTime = n.at_ms/1000; }}>
            <span className="at">{(n.at_ms/1000).toFixed(1)}s</span>
            <span>{n.body}</span>
          </li>
        ))}
      </ul>

      {canVerify && !video?.is_verified && (
        <button className="primary verify" onClick={verify}>
          ✓ Verify skill — mark as mastered
        </button>
      )}
      {video?.is_verified && <div className="verified">Verified</div>}
    </div>
  );
}
