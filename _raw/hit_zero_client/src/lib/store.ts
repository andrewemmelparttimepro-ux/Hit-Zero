// src/lib/store.ts — Zustand store; mirrors the prototype's shape.
import { create } from 'zustand';

type Role = 'coach' | 'owner' | 'athlete' | 'parent';

interface HZState {
  session: any | null;
  profile: any | null;
  role: Role;
  programId: string | null;
  teamId: string | null;
  setSession: (s: any) => void;
  setProfile: (p: any) => void;
  setRole: (r: Role) => void;
  setTeam: (t: string) => void;
}

export const useHZ = create<HZState>((set) => ({
  session: null,
  profile: null,
  role: 'coach',
  programId: null,
  teamId: null,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({
    profile,
    role: profile?.role ?? 'coach',
    programId: profile?.program_id ?? null
  }),
  setRole: (role) => set({ role }),
  setTeam: (teamId) => set({ teamId })
}));
