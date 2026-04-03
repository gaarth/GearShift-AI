import { useMachineStore } from '../../store/machineStore';
import { useSimulationStore, type SimMode } from '../../store/simulationStore';
import { useShallow } from 'zustand/react/shallow';
import { Activity, Pause, Play, Zap, AlertTriangle, CheckCircle } from 'lucide-react';

export default function TopBar() {
  const machines = useMachineStore(useShallow((s) => Object.values(s.machines)));
  const { mode, timeMultiplier, setMode, setTimeMultiplier, tick } = useSimulationStore(
    useShallow((s) => ({
      mode: s.mode,
      timeMultiplier: s.timeMultiplier,
      setMode: s.setMode,
      setTimeMultiplier: s.setTimeMultiplier,
      tick: s.tick,
    }))
  );

  const critical = machines.filter((m) => m.status === 'critical').length;
  const watch = machines.filter((m) => m.status === 'watch').length;
  const good = machines.filter((m) => m.status === 'good').length;

  const cycleMode = () => {
    const next: Record<SimMode, SimMode> = { auto: 'paused', paused: 'auto', manual: 'auto' };
    setMode(next[mode]);
  };

  return (
    <header className="h-12 shrink-0 border-b border-[var(--bg-floor-base)] flex items-center px-4 justify-between bg-[var(--bg-ui-surface)] z-50 gap-4">
      {/* Left: Logo + Tick */}
      <div className="flex items-center gap-3 min-w-0">
        <Activity size={14} className="text-[var(--accent-primary)] shrink-0" />
        <span className="font-display text-xs text-[var(--accent-primary)] tracking-tight whitespace-nowrap">
          GEARSWITCH
        </span>
        <span className="font-mono text-[10px] text-[var(--text-muted)] hidden sm:block">
          T+{tick.toString().padStart(4, '0')}
        </span>
      </div>

      {/* Center: Status counts */}
      <div className="flex items-center gap-4 font-mono text-xs">
        {critical > 0 && (
          <span className="flex items-center gap-1.5 text-[var(--status-critical)]">
            <AlertTriangle size={11} />
            {critical} CRITICAL
          </span>
        )}
        {watch > 0 && (
          <span className="flex items-center gap-1.5 text-[var(--status-watch)]">
            <AlertTriangle size={11} />
            {watch} WATCH
          </span>
        )}
        {critical === 0 && watch === 0 && (
          <span className="flex items-center gap-1.5 text-[var(--status-good)]">
            <CheckCircle size={11} />
            ALL NOMINAL
          </span>
        )}
        <span className="text-[var(--text-muted)] hidden md:block">
          {good}/{machines.length} OK
        </span>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Speed multiplier */}
        <div className="flex items-center gap-1 font-mono text-[10px] text-[var(--text-secondary)]">
          <Zap size={10} />
          {[1, 2, 5].map((n) => (
            <button
              key={n}
              onClick={() => setTimeMultiplier(n)}
              className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                timeMultiplier === n
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-ui-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-floor-base)]'
              }`}
            >
              {n}x
            </button>
          ))}
        </div>

        {/* Play / Pause */}
        <button
          onClick={cycleMode}
          className="flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[11px] transition-colors cursor-pointer bg-[var(--bg-ui-elevated)] hover:bg-[var(--bg-floor-base)] text-[var(--text-secondary)]"
        >
          {mode === 'paused' ? <Play size={11} /> : <Pause size={11} />}
          {mode === 'paused' ? 'RESUME' : mode.toUpperCase()}
        </button>
      </div>
    </header>
  );
}
