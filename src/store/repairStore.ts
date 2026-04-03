/**
 * repairStore.ts
 * Tracks active repairs per machine (which worker, progress 0-100).
 * Lives separately so the canvas and panel can both subscribe cheaply.
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface RepairJob {
  machineId: string;
  workerId: string;
  progress: number;   // 0–100
  startedAt: number;  // Date.now()
  duration: number;   // ms (e.g. 8000)
}

interface RepairState {
  jobs: Record<string, RepairJob>; // keyed by machineId
  startRepair: (job: RepairJob) => void;
  updateProgress: (machineId: string, progress: number) => void;
  finishRepair: (machineId: string) => void;
}

export const useRepairStore = create<RepairState>()(
  immer((set) => ({
    jobs: {},

    startRepair: (job) => set((s) => {
      s.jobs[job.machineId] = job;
    }),

    updateProgress: (machineId, progress) => set((s) => {
      if (s.jobs[machineId]) s.jobs[machineId].progress = progress;
    }),

    finishRepair: (machineId) => set((s) => {
      delete s.jobs[machineId];
    }),
  }))
);
