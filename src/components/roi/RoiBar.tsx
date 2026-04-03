import { useRoiStore } from '../../store/roiStore';
import { useShallow } from 'zustand/react/shallow';
import { TrendingUp, TrendingDown, Wrench } from 'lucide-react';

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

export default function RoiBar() {
  const { totalSavings, totalLoss, actionsExecuted } = useRoiStore(
    useShallow((s) => ({
      totalSavings: s.totalSavings,
      totalLoss: s.totalLoss,
      actionsExecuted: s.actionsExecuted,
    }))
  );

  const net = totalSavings - totalLoss;

  return (
    <footer className="h-11 shrink-0 border-t border-[var(--bg-floor-base)] bg-[var(--bg-ui-surface)] z-40 flex items-center px-4 gap-6 font-mono text-[11px]">
      <span className="flex items-center gap-1.5 text-[var(--money-save)]">
        <TrendingUp size={12} />
        SAVED: {formatINR(totalSavings)}
      </span>
      {totalLoss > 0 && (
        <span className="flex items-center gap-1.5 text-[var(--money-loss)]">
          <TrendingDown size={12} />
          LOST: {formatINR(totalLoss)}
        </span>
      )}
      <span
        className={`flex items-center gap-1.5 font-bold ${
          net >= 0 ? 'text-[var(--money-save)]' : 'text-[var(--money-loss)]'
        }`}
      >
        NET: {net >= 0 ? '+' : ''}{formatINR(net)}
      </span>
      <span className="flex items-center gap-1.5 text-[var(--text-muted)] ml-auto">
        <Wrench size={11} />
        {actionsExecuted} ACTIONS DISPATCHED
      </span>
    </footer>
  );
}
