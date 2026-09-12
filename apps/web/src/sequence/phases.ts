import { create } from 'zustand';
import type { Phase } from '../data/types';

interface PhaseState {
  phase: Phase; eventId: string | null; resolvedMarks: string[]; provenanceVisible: boolean; stopIndex: number;
  setPhase: (p: Phase) => void; setEvent: (id: string | null) => void; resolveMark: (id: string) => void; toggleProvenance: () => void; setStop: (i: number) => void;
}
export const usePhases = create<PhaseState>((set) => ({
  phase: 'hub', eventId: null, resolvedMarks: [], provenanceVisible: false, stopIndex: -1,
  setPhase: (phase) => set({ phase }), setEvent: (eventId) => set({ eventId, phase: 'hub', stopIndex: -1 }),
  resolveMark: (id) => set((s) => (s.resolvedMarks.includes(id) ? s : { resolvedMarks: [...s.resolvedMarks, id] })),
  toggleProvenance: () => set((s) => ({ provenanceVisible: !s.provenanceVisible })), setStop: (stopIndex) => set({ stopIndex }),
}));
