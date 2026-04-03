import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ZoneId = 'A' | 'B' | 'C' | 'D' | 'E';
export type MachineStatus = 'good' | 'watch' | 'critical' | 'isolated';

export interface Machine {
  id: string;
  label: string;
  zone: ZoneId;
  status: MachineStatus;
  riskScore: number;
  age: number;
  ratedLife: number;
  // Position within the zone canvas (zone canvas is 900x650)
  position: { x: number; y: number };
  shape: 'tall-rect' | 'wide-squat' | 'long-bar' | 'large-square' | 'medium-square' | 'wide-rect' | 'l-shape' | 'small-square';
  baseColor: string;
  monthlyCosts: { oil: number; power: number; maintenance: number };
  rootCause: string | null;
  recommendedAction: string | null;
}

export interface Pipe {
  id: string;
  from: string; // machine id
  to: string;   // machine id
  // waypoints drawn within the same zone canvas
  points: { x: number; y: number }[];
  crossZone?: boolean; // if this pipe spans zones, just draw stub
}

interface MachineState {
  machines: Record<string, Machine>;
  pipes: Pipe[];
  updateMachineStatus: (id: string, status: MachineStatus) => void;
  updateMachineRisk: (id: string, riskScore: number) => void;
  updateMachineRootCause: (id: string, rootCause: string | null, recommendedAction: string | null) => void;
}

// All positions are relative to a 900x650 zone canvas
const INITIAL_MACHINES: Record<string, Machine> = {
  // ── Zone A: Raw Materials ──────────────────────────────────────
  'crusher': {
    id: 'crusher', label: 'CRSH', zone: 'A', status: 'good', riskScore: 30, age: 10, ratedLife: 12,
    position: { x: 220, y: 300 }, shape: 'large-square', baseColor: '#4A6B5A',
    monthlyCosts: { oil: 15000, power: 45000, maintenance: 8000 },
    rootCause: null, recommendedAction: null,
  },
  'conveyor': {
    id: 'conveyor', label: 'CONV', zone: 'A', status: 'good', riskScore: 50, age: 4, ratedLife: 15,
    position: { x: 560, y: 300 }, shape: 'long-bar', baseColor: '#6A6460',
    monthlyCosts: { oil: 5000, power: 12000, maintenance: 0 },
    rootCause: null, recommendedAction: null,
  },

  // ── Zone B: Assembly ───────────────────────────────────────────
  'motor-1': {
    id: 'motor-1', label: 'MTR-1', zone: 'B', status: 'good', riskScore: 10, age: 3, ratedLife: 10,
    position: { x: 280, y: 280 }, shape: 'tall-rect', baseColor: '#4A6A8A',
    monthlyCosts: { oil: 12000, power: 8000, maintenance: 0 },
    rootCause: null, recommendedAction: null,
  },
  'motor-2': {
    id: 'motor-2', label: 'MTR-2', zone: 'B', status: 'watch', riskScore: 75, age: 8.5, ratedLife: 10,
    position: { x: 450, y: 280 }, shape: 'tall-rect', baseColor: '#3A5A7A',
    monthlyCosts: { oil: 32640, power: 14640, maintenance: 5000 },
    rootCause: 'Bearing wear — temp spike + abnormal vibration pattern', recommendedAction: 'Repair Now',
  },
  'welder': {
    id: 'welder', label: 'WLDR', zone: 'B', status: 'good', riskScore: 20, age: 2, ratedLife: 8,
    position: { x: 620, y: 380 }, shape: 'wide-squat', baseColor: '#9A6030',
    monthlyCosts: { oil: 0, power: 25000, maintenance: 0 },
    rootCause: null, recommendedAction: null,
  },

  // ── Zone C: Packaging ─────────────────────────────────────────
  'sealer': {
    id: 'sealer', label: 'SEAL', zone: 'C', status: 'good', riskScore: 15, age: 1, ratedLife: 5,
    position: { x: 250, y: 300 }, shape: 'medium-square', baseColor: '#7A6A8A',
    monthlyCosts: { oil: 0, power: 8000, maintenance: 0 },
    rootCause: null, recommendedAction: null,
  },
  'wrapper': {
    id: 'wrapper', label: 'WRPR', zone: 'C', status: 'good', riskScore: 5, age: 0.5, ratedLife: 8,
    position: { x: 580, y: 300 }, shape: 'wide-rect', baseColor: '#4A8A9A',
    monthlyCosts: { oil: 0, power: 6000, maintenance: 0 },
    rootCause: null, recommendedAction: null,
  },

  // ── Zone D: Storage ───────────────────────────────────────────
  'forklift-bay': {
    id: 'forklift-bay', label: 'FRKT', zone: 'D', status: 'good', riskScore: 25, age: 5, ratedLife: 10,
    position: { x: 420, y: 300 }, shape: 'l-shape', baseColor: '#8A7A30',
    monthlyCosts: { oil: 20000, power: 0, maintenance: 15000 },
    rootCause: null, recommendedAction: null,
  },

  // ── Zone E: QC ────────────────────────────────────────────────
  'qc-scanner': {
    id: 'qc-scanner', label: 'QCSC', zone: 'E', status: 'good', riskScore: 5, age: 2, ratedLife: 5,
    position: { x: 420, y: 300 }, shape: 'small-square', baseColor: '#4A8A9A',
    monthlyCosts: { oil: 0, power: 2000, maintenance: 0 },
    rootCause: null, recommendedAction: null,
  },
};

// Pipes — all within the same zone (cross-zone marked with crossZone:true, just draw stub arrow)
const INITIAL_PIPES: Pipe[] = [
  // Zone A internal
  { id: 'p-crsh-conv', from: 'crusher', to: 'conveyor', points: [] },
  // Zone A → Zone B (cross-zone stubs drawn differently)
  { id: 'p-conv-mtr1', from: 'conveyor', to: 'motor-1', points: [], crossZone: true },
  // Zone B internal
  { id: 'p-mtr1-mtr2', from: 'motor-1', to: 'motor-2', points: [] },
  { id: 'p-mtr2-wldr', from: 'motor-2', to: 'welder', points: [] },
  // Zone B → Zone C (cross-zone)
  { id: 'p-wldr-seal', from: 'welder', to: 'sealer', points: [], crossZone: true },
  // Zone C internal
  { id: 'p-seal-wrpr', from: 'sealer', to: 'wrapper', points: [] },
  // Zone C → Zone D (cross-zone)
  { id: 'p-wrpr-frkt', from: 'wrapper', to: 'forklift-bay', points: [], crossZone: true },
  // Zone B → Zone E (cross-zone)
  { id: 'p-mtr2-qcsc', from: 'motor-2', to: 'qc-scanner', points: [], crossZone: true },
];

export const useMachineStore = create<MachineState>()(
  immer((set) => ({
    machines: INITIAL_MACHINES,
    pipes: INITIAL_PIPES,
    updateMachineStatus: (id, status) => set((state) => {
      if (state.machines[id]) state.machines[id].status = status;
    }),
    updateMachineRisk: (id, riskScore) => set((state) => {
      if (state.machines[id]) {
        state.machines[id].riskScore = riskScore;
        if (riskScore >= 90) state.machines[id].status = 'critical';
        else if (riskScore >= 70) state.machines[id].status = 'watch';
        else state.machines[id].status = 'good';
      }
    }),
    updateMachineRootCause: (id, rootCause, recommendedAction) => set((state) => {
      if (state.machines[id]) {
        state.machines[id].rootCause = rootCause;
        state.machines[id].recommendedAction = recommendedAction;
      }
    }),
  }))
);
