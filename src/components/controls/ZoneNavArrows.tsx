/**
 * ZoneNavArrows.tsx
 * React overlay for zone navigation with directional arrows.
 * Arrows pulse red if the adjacent zone contains a critical machine.
 */
import { useSimulationStore, ZONE_NEIGHBORS } from '../../store/simulationStore';
import { useMachineStore } from '../../store/machineStore';
import type { ZoneId } from '../../store/machineStore';
import { useShallow } from 'zustand/react/shallow';

type Direction = 'up' | 'down' | 'left' | 'right';

const ARROW_LABEL: Record<Direction, string> = {
  up: '↑', down: '↓', left: '←', right: '→',
};
const ZONE_NAMES: Record<ZoneId, string> = {
  A: 'RAW MATERIALS',
  B: 'ASSEMBLY',
  C: 'PACKAGING',
  D: 'STORAGE',
  E: 'QC',
};

const ARROW_STYLE: Record<Direction, React.CSSProperties> = {
  up:    { top: '60px', left: '50%', transform: 'translateX(-50%)' },
  down:  { bottom: '60px', left: '50%', transform: 'translateX(-50%)' },
  left:  { top: '50%', left: '12px', transform: 'translateY(-50%)' },
  right: { top: '50%', right: '332px', transform: 'translateY(-50%)' },
};

export default function ZoneNavArrows() {
  const currentZone = useSimulationStore((s) => s.currentZone);
  const setCurrentZone = useSimulationStore((s) => s.setCurrentZone);
  const isTransitioning = useSimulationStore((s) => s.isTransitioning);
  const setIsTransitioning = useSimulationStore((s) => s.setIsTransitioning);
  const machines = useMachineStore(useShallow((s) => s.machines));

  const neighbors = ZONE_NEIGHBORS[currentZone] ?? {};

  const hasCriticalInZone = (zone: ZoneId) =>
    Object.values(machines).some((m) => m.zone === zone && m.status === 'critical');

  const navigate = (targetZone: ZoneId) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentZone(targetZone);
      setIsTransitioning(false);
    }, 300);
  };

  return (
    <>
      {(Object.entries(neighbors) as [Direction, ZoneId][]).map(([dir, targetZone]) => {
        const isCritical = hasCriticalInZone(targetZone);
        return (
          <button
            key={dir}
            onClick={() => navigate(targetZone)}
            style={{
              position: 'absolute',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: isCritical
                ? 'rgba(154, 64, 64, 0.85)'
                : 'rgba(44, 42, 40, 0.75)',
              border: `1.5px solid ${isCritical ? 'rgba(200, 80, 80, 0.8)' : 'rgba(138, 128, 120, 0.4)'}`,
              color: isCritical ? '#FFB0B0' : '#E8E4E0',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease',
              fontFamily: "'JetBrains Mono', monospace",
              animation: isCritical ? 'criticalPulse 1.2s ease-in-out infinite' : 'none',
              ...ARROW_STYLE[dir],
            }}
            title={`Go to Zone ${targetZone}: ${ZONE_NAMES[targetZone]}`}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{ARROW_LABEL[dir]}</span>
            <span style={{ fontSize: '8px', letterSpacing: '0.05em', opacity: 0.8 }}>
              {ZONE_NAMES[targetZone]}
            </span>
          </button>
        );
      })}
      <style>{`
        @keyframes criticalPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(154, 64, 64, 0); }
          50% { box-shadow: 0 0 12px 4px rgba(200, 80, 80, 0.5); }
        }
      `}</style>
    </>
  );
}
