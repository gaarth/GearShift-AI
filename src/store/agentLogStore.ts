import { create } from 'zustand';

export type LogType = 'sensor' | 'predict' | 'rca' | 'action' | 'roi' | 'thinking';

export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogType;
  machineId: string | null;
  message: string;
}

interface AgentLogState {
  entries: LogEntry[];
  addEntry: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearAll: () => void;
}

export const useAgentLogStore = create<AgentLogState>((set) => ({
  entries: [],
  addEntry: (entry) =>
    set((state) => ({
      entries: [
        {
          ...entry,
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
        },
        ...state.entries,
      ].slice(0, 200), // keep max 200 entries
    })),
  clearAll: () => set({ entries: [] }),
}));
