import { create } from 'zustand';
import type { ZoneId } from './machineStore';

export type SimMode = 'auto' | 'manual' | 'paused';
export type TimeView = 'now' | '+6h' | '+24h';

interface SimulationState {
  timeMultiplier: number;
  cameraScale: number;
  cameraOffset: { x: number; y: number };
  selectedMachineId: string | null;
  mode: SimMode;
  tick: number;
  currentZone: ZoneId;
  isTransitioning: boolean;
  timeView: TimeView;
  setTimeMultiplier: (multiplier: number) => void;
  setCameraScale: (scale: number) => void;
  setCameraOffset: (offset: { x: number; y: number }) => void;
  setSelectedMachineId: (id: string | null) => void;
  setMode: (mode: SimMode) => void;
  incrementTick: () => void;
  setCurrentZone: (zone: ZoneId) => void;
  setIsTransitioning: (t: boolean) => void;
  setTimeView: (view: TimeView) => void;
}

export const ZONE_NEIGHBORS: Record<ZoneId, Partial<Record<'up' | 'down' | 'left' | 'right', ZoneId>>> = {
  A: { down: 'B' },
  B: { up: 'A', down: 'C', left: 'D', right: 'E' },
  C: { up: 'B' },
  D: { right: 'B' },
  E: { left: 'B' },
};

export const useSimulationStore = create<SimulationState>((set) => ({
  timeMultiplier: 1,
  cameraScale: 1,
  cameraOffset: { x: 0, y: 0 },
  selectedMachineId: null,
  mode: 'auto',
  tick: 0,
  currentZone: 'B',
  isTransitioning: false,
  timeView: 'now',
  setTimeMultiplier: (multiplier) => set({ timeMultiplier: multiplier }),
  setCameraScale: (scale) => set({ cameraScale: Math.max(0.5, Math.min(3, scale)) }),
  setCameraOffset: (offset) => set({ cameraOffset: offset }),
  setSelectedMachineId: (id) => set({ selectedMachineId: id }),
  setMode: (mode) => set({ mode }),
  incrementTick: () => set((state) => ({ tick: state.tick + 1 })),
  setCurrentZone: (zone) => set({ currentZone: zone }),
  setIsTransitioning: (t) => set({ isTransitioning: t }),
  setTimeView: (view) => set({ timeView: view }),
}));

