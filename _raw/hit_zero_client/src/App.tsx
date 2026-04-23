// src/App.tsx — router shell. Handles auth gate + role-based routing.
import { useEffect, useState } from 'react';
import { db, currentProfile } from './lib/supabase';
import { useHZ } from './lib/store';
import { registerPush } from './lib/native';
import { AuthScreen } from './screens/AuthScreen';
// The prototype screens live under /src/screens/* and import db from ./lib/supabase —
// drop them in as-is once the React-port of the HTML is done.

export function App() {
  const { session, profile, setSession, setProfile } = useHZ();
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    db.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const p = await currentProfile();
        setProfile(p);
        if (p) registerPush(p.id);
      }
      setBooting(false);
    });

    const { data: sub } = db.auth.onAuthStateChange(async (_evt, s) => {
      setSession(s);
      if (s) {
        const p = await currentProfile();
        setProfile(p);
        if (p) registerPush(p.id);
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (booting) return <div className="booting"><div className="spinner" /></div>;
  if (!session) return <AuthScreen />;

  // TODO: port HZShell + screens from hit_zero_web/ into /src/screens/
  return <Shell profile={profile} />;
}

function Shell({ profile }: { profile: any }) {
  return (
    <div className="shell">
      <header className="top">
        <div className="brand">Hit Zero</div>
        <div className="who">{profile?.display_name} · {profile?.role}</div>
      </header>
      <main className="content">
        <div className="placeholder">
          <h2>Signed in as {profile?.display_name}</h2>
          <p>Role: <b>{profile?.role}</b></p>
          <p>Program: <code>{profile?.program_id}</code></p>
          <p>Port the prototype screens (CoachToday, Roster, SkillMatrix…) into <code>src/screens/</code>.</p>
        </div>
      </main>
    </div>
  );
}
