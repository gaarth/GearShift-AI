import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ZoneId = 'A' | 'B' | 'C' | 'D' | 'E';
export type WorkerVariant = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Worker {
  id: string;
  variant: WorkerVariant;
  zone: ZoneId;
  state: 'idle' | 'patrolling' | 'dispatched' | 'repairing' | 'returning';
  position: { x: number; y: number };
  targetPosition: { x: number; y: number } | null;
  assignedMachine: string | null;
  frame: 0 | 1 | 2;
  facing: 'left' | 'right';
  frameInterval: number; // 150-230ms
  idleTimer: number; // For tracking idle behaviors
}

interface WorkerState {
  workers: Record<string, Worker>;
  setWorkers: (workers: Record<string, Worker>) => void;
  updateWorkerPosition: (id: string, x: number, y: number) => void;
  updateWorkerState: (id: string, state: Worker['state'], target?: {x: number, y: number} | null, machine?: string | null) => void;
  updateWorkerAnim: (id: string, frame: 0 | 1 | 2, facing: 'left' | 'right') => void;
}

// Generate initial workers
const createInitialWorkers = (): Record<string, Worker> => {
  const workers: Record<string, Worker> = {};
  const zones: ZoneId[] = ['A', 'B', 'C', 'D', 'E'];
  
  let idCounter = 1;
  zones.forEach(zone => {
    // 2 workers per zone
    for (let i = 0; i < 2; i++) {
      // Pick variants: Supervisor (C) in B, rest randomized or pseudo-randomized
      const variant: WorkerVariant = zone === 'B' && i === 0 ? 'C' : 
        ['A', 'B', 'D', 'E'][Math.floor(Math.random() * 4)] as WorkerVariant;
        
      workers[`w-${idCounter}`] = {
        id: `w-${idCounter}`,
        variant,
        zone,
        state: 'patrolling',
        // Random start positions within central safe area
        position: { x: 450 + (Math.random() * 200 - 100), y: 325 + (Math.random() * 200 - 100) },
        targetPosition: null, // Will be set by patrol logic
        assignedMachine: null,
        frame: 0,
        facing: Math.random() > 0.5 ? 'left' : 'right',
        frameInterval: 150 + Math.random() * 80, // 150-230ms
        idleTimer: 0
      };
      idCounter++;
    }
  });
  
  return workers;
};

export const useWorkerStore = create<WorkerState>()(
  immer((set) => ({
    workers: createInitialWorkers(),
    
    setWorkers: (workers) => set((state) => {
      state.workers = workers;
    }),
    
    updateWorkerPosition: (id, x, y) => set((state) => {
      if (state.workers[id]) {
        state.workers[id].position.x = x;
        state.workers[id].position.y = y;
      }
    }),
    
    updateWorkerState: (id, wState, target, machine) => set((state) => {
      if (state.workers[id]) {
        state.workers[id].state = wState;
        // null = explicitly clear; undefined = don't touch
        if (target !== undefined) state.workers[id].targetPosition = target ?? null;
        if (machine !== undefined) state.workers[id].assignedMachine = machine ?? null;
      }
    }),
    
    updateWorkerAnim: (id, frame, facing) => set((state) => {
      if (state.workers[id]) {
        state.workers[id].frame = frame;
        state.workers[id].facing = facing;
      }
    }),
  }))
);
