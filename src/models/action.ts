// src/models/action.ts

export type ActionType = 'FIX_NOW' | 'SCHEDULE' | 'MONITOR' | 'ESCALATE';
export type ActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActionRecommendation {
  id: string;
  machineId: string;
  action: ActionType;
  priority: ActionPriority;
  reason: string;
  estimatedCost: number;         // cost if NOT acted upon
  estimatedSavings: number;       // savings if acted upon NOW
  deadline: number;               // ticks until too late
  createdAt: number;
  executed: boolean;
}
