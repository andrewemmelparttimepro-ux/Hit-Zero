// src/screens/VideoRecorder.tsx — record a skill-attempt clip, upload, attach.
// Works natively via Capacitor Camera on iOS/Android; uses MediaRecorder on web.

import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/supabase';
import { isNative, haptics } from '../lib/native';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface Props {
  athleteId: string;
  skillId: string;
  programId: string;
  onDone: (videoId: string) => void;
  onCancel: () => void;
}

export function VideoRecorder({ athleteId, skillId, programId, onDone, onCancel }: Props) {
  const [phase, setPhase] = useState<'idle'|'recording'|'review'|'uploading'>('idle');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => teardown(), []);

  function teardown() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }

  async function startNative() {
    // Native: use Capacitor Camera for a single best-quality capture.
    try {
      const res = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 90
      });
      if (res.webPath) {
        const b = await fetch(res.webPath).then(r => r.blob());
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setPhase('review');
        haptics.click();
      }
    } catch { onCancel(); }
  }

  async function startWeb() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: 1280 },
      audio: true
    });
    streamRef.current = stream;
    if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: 'video/webm' });
      setBlob(b);
      setPreviewUrl(URL.createObjectURL(b));
      setPhase('review');
    };
    rec.start();
    setPhase('recording');
    haptics.click();
    const start = Date.now();
    timerRef.current = window.setInterval(() => setElapsed(Date.now() - start), 100);
  }

  function stop() {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) window.clearInterval(timerRef.current);
    haptics.thunk();
  }

  async function upload() {
    if (!blob) return;
    setPhase('uploading');
    const videoId = crypto.randomUUID();
    const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
    const path = `${programId}/${athleteId}/${videoId}.${ext}`;

    const up = await db.storage.from('videos').upload(path, blob, {
      contentType: blob.type,
      upsert: false
    });
    if (up.error) { alert(up.error.message); setPhase('review'); return; }

    const { data: { user } } = await db.auth.getUser();
    const { error } = await db.from('videos').insert({
      id: videoId,
      uploaded_by: user!.id,
      athlete_id: athleteId,
      skill_id: skillId,
      storage_path: path,
      kind: 'skill_attempt'
    });
    if (error) { alert(error.message); setPhase('review'); return; }

    haptics.success();
    onDone(videoId);
  }

  return (
    <div className="recorder">
      {phase === 'idle' && (
        <div className="recorder-start">
          <h2>Record skill attempt</h2>
          <p>One clean take. Coach will timestamp feedback on playback.</p>
          <button className="primary" onClick={isNative ? startNative : startWeb}>
            Start camera
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      )}
      {phase === 'recording' && (
        <div className="recorder-live">
          <video ref={videoRef} muted playsInline />
          <div className="timer">{(elapsed/1000).toFixed(1)}s</div>
          <button className="stop" onClick={stop}>Stop</button>
        </div>
      )}
      {phase === 'review' && previewUrl && (
        <div className="recorder-review">
          <video src={previewUrl} controls playsInline />
          <div className="row">
            <button onClick={() => { setBlob(null); setPreviewUrl(null); setPhase('idle'); }}>
              Redo
            </button>
            <button className="primary" onClick={upload}>Upload + request verify</button>
          </div>
        </div>
      )}
      {phase === 'uploading' && (
        <div className="recorder-loading"><div className="spinner" /> Uploading…</div>
      )}
    </div>
  );
}
