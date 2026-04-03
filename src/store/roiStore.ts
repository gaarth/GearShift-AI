import { create } from 'zustand';

interface RoiState {
  totalSavings: number;
  totalLoss: number;
  actionsExecuted: number;
  addSaving: (amount: number) => void;
  addLoss: (amount: number) => void;
  incrementActions: () => void;
  reset: () => void;
}

export const useRoiStore = create<RoiState>((set) => ({
  totalSavings: 0,
  totalLoss: 0,
  actionsExecuted: 0,
  addSaving: (amount) =>
    set((state) => ({ totalSavings: state.totalSavings + amount })),
  addLoss: (amount) =>
    set((state) => ({ totalLoss: state.totalLoss + amount })),
  incrementActions: () =>
    set((state) => ({ actionsExecuted: state.actionsExecuted + 1 })),
  reset: () => set({ totalSavings: 0, totalLoss: 0, actionsExecuted: 0 }),
}));
