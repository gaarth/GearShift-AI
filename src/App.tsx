/**
 * App.tsx — Phases 8–13
 *
 * Full dashboard shell with:
 * - Phase 8:  Upgraded Quick Summary Pane (Fix All Critical, per-machine dispatch)
 * - Phase 9:  Agent Logs Drawer + ROI bar with animated ticking counter
 * - Phase 10: AI Explain Decision (in MachinePanel, already done)
 * - Phase 11: Manual / Autonomous mode toggle wired to engine
 * - Phase 12: +6h / +24h time projection toggle (canvas tint + label)
 * - Phase 13: Scenario Triggers (Fail / Cascade / Age Spike)
 */
import { useEffect, useState, useRef } from 'react';
import FactoryCanvas from './canvas/FactoryCanvas';
import ZoneNavArrows from './components/controls/ZoneNavArrows';
import MachinePanel from './components/panels/MachinePanel';
import AgentLogsDrawer from './components/logs/AgentLogsDrawer';
import { startCascadeEngine, stopCascadeEngine } from './engine/cascadeEngine';
import {
  triggerFailureScenario,
  triggerCascadeScenario,
  triggerAgingSpike,
} from './engine/agentPipeline';
import { dispatchWorkerToMachine } from './engine/workerDispatcher';
import { useMachineStore } from './store/machineStore';
import { useSimulationStore, type TimeView } from './store/simulationStore';
import { useRoiStore } from './store/roiStore';
import { useAgentLogStore } from './store/agentLogStore';
import { useShallow } from 'zustand/react/shallow';

// ── Helpers ──────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    critical: '#EF4444', watch: '#F59E0B', good: '#22C55E', isolated: '#94A3B8',
  };
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: colors[status] ?? '#888', marginRight: 4, flexShrink: 0,
    }} />
  );
}

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

// Smoothly animated ROI number
function AnimatedCounter({ value }: { value: number }) {
  const displayRef = useRef(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const target = value;
    const start  = displayRef.current;
    const diff   = target - start;
    if (Math.abs(diff) < 1) return;
    const steps  = 30;
    let step     = 0;
    const id = setInterval(() => {
      step++;
      const t = step / steps;
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out
      displayRef.current = Math.round(start + diff * eased);
      setDisplay(displayRef.current);
      if (step >= steps) { clearInterval(id); displayRef.current = target; setDisplay(target); }
    }, 16);
    return () => clearInterval(id);
  }, [value]);

  return <>{formatINR(display)}</>;
}

// ── Time projection ───────────────────────────────────────────────

export default function App() {
  const machines       = useMachineStore(useShallow((s) => s.machines));
  const currentZone    = useSimulationStore((s) => s.currentZone);
  const isTransitioning= useSimulationStore((s) => s.isTransitioning);
  const mode           = useSimulationStore((s) => s.mode);
  const setMode        = useSimulationStore((s) => s.setMode);
  const setSelectedId  = useSimulationStore((s) => s.setSelectedMachineId);
  const timeView       = useSimulationStore((s) => s.timeView);
  const setTimeView    = useSimulationStore((s) => s.setTimeView);
  const totalSavings   = useRoiStore((s) => s.totalSavings);
  const totalLoss      = useRoiStore((s) => s.totalLoss);
  const actionsExecuted= useRoiStore((s) => s.actionsExecuted);
  const logCount       = useAgentLogStore((s) => s.entries.length);

  const [logsOpen,  setLogsOpen]  = useState(false);

  useEffect(() => {
    startCascadeEngine(5000);
    return () => stopCascadeEngine();
  }, []);

  const allMachines    = Object.values(machines);
  const criticalCount  = allMachines.filter((m) => m.status === 'critical').length;
  const watchCount     = allMachines.filter((m) => m.status === 'watch').length;
  const goodCount      = allMachines.filter((m) => m.status === 'good').length;

  const zoneNames: Record<string, string> = {
    A: 'Zone A: Raw Materials', B: 'Zone B: Assembly',
    C: 'Zone C: Packaging', D: 'Zone D: Storage', E: 'Zone E: QC',
  };

  const handleFixAll = () => {
    allMachines
      .filter((m) => m.status === 'critical' || m.status === 'watch')
      .forEach((m) => dispatchWorkerToMachine(m.id));
  };

  const isAuto = mode === 'auto';
  const unreadLogs = logCount;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0C0E14', color: '#F1F5F9', fontFamily: "'JetBrains Mono', monospace" }}>

      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <header style={{
        height: 48, flexShrink: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 14,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: isAuto
          ? 'linear-gradient(90deg, #0C0E14 0%, rgba(139,92,246,0.12) 100%)'
          : '#0C0E14',
        boxShadow: isAuto ? '0 0 0 1px rgba(139,92,246,0.3)' : 'none',
        transition: 'all 0.4s',
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 12, letterSpacing: '0.06em',
          color: isAuto ? '#A78BFA' : '#F59E0B',
          transition: 'color 0.4s',
        }}>
          GEARSWITCH
        </div>

        {/* Zone name */}
        <div style={{
          fontSize: 10, color: '#64748B', letterSpacing: '0.12em',
          textTransform: 'uppercase',
          opacity: isTransitioning ? 0.2 : 1,
          transition: 'opacity 0.3s',
        }}>
          {zoneNames[currentZone]}
        </div>

        {/* Status counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10 }}>
          {criticalCount > 0 && (
            <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center' }}>
              <StatusDot status="critical" />{criticalCount} Critical
            </span>
          )}
          {watchCount > 0 && (
            <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center' }}>
              <StatusDot status="watch" />{watchCount} Watch
            </span>
          )}
          <span style={{ color: '#22C55E', display: 'flex', alignItems: 'center' }}>
            <StatusDot status="good" />{goodCount} Good
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Time projection toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: 2, gap: 2 }}>
          {(['now', '+6h', '+24h'] as TimeView[]).map((v) => (
            <button key={v} onClick={() => setTimeView(v)} style={{
              padding: '3px 10px', fontSize: 9, borderRadius: 4,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: timeView === v ? (v === 'now' ? '#3B82F6' : '#7C3AED') : 'transparent',
              color: timeView === v ? '#FFF' : '#64748B',
              transition: 'all 0.15s',
            }}>
              {v === 'now' ? 'NOW' : v}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <button
          onClick={() => setMode(isAuto ? 'manual' : 'auto')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 9.5,
            border: `1px solid ${isAuto ? '#7C3AED' : 'rgba(255,255,255,0.12)'}`,
            background: isAuto ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
            color: isAuto ? '#A78BFA' : '#94A3B8',
            fontFamily: 'inherit', transition: 'all 0.2s', fontWeight: isAuto ? 700 : 400,
          }}
        >
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: isAuto ? '#A78BFA' : '#94A3B8',
            boxShadow: isAuto ? '0 0 6px #A78BFA' : 'none',
          }} />
          {isAuto ? '⚡ AUTONOMOUS' : '✋ MANUAL'}
        </button>

        {/* Logs button */}
        <button
          onClick={() => setLogsOpen(o => !o)}
          style={{
            position: 'relative',
            padding: '5px 12px', fontSize: 9.5, borderRadius: 6,
            border: `1px solid ${logsOpen ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.12)'}`,
            background: logsOpen ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
            color: logsOpen ? '#60A5FA' : '#94A3B8',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          📋 LOGS
          {unreadLogs > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: '#EF4444', color: '#FFF',
              fontSize: 8, fontWeight: 800, borderRadius: '50%',
              width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {Math.min(99, unreadLogs)}
            </span>
          )}
        </button>
      </header>

      {/* ── Main Body ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>

        {/* Canvas */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          opacity: isTransitioning ? 0 : 1, transition: 'opacity 0.3s',
        }}>
          {/* Time projection overlay */}
          {timeView !== 'now' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 5,
              background: timeView === '+24h'
                ? 'rgba(124,58,237,0.14)' : 'rgba(99,102,241,0.08)',
              pointerEvents: 'none',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              paddingTop: 16,
            }}>
              <div style={{
                background: 'rgba(124,58,237,0.7)', color: '#FFF',
                fontSize: 11, fontWeight: 700, letterSpacing: 2,
                padding: '4px 16px', borderRadius: 4,
                fontFamily: "'Press Start 2P', monospace",
              }}>
                PROJECTED STATE — {timeView}
              </div>
            </div>
          )}
          <FactoryCanvas />
        </div>

        {/* Zone nav arrows */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div style={{ pointerEvents: 'all' }}><ZoneNavArrows /></div>
          </div>
        </div>

        {/* ── Right: Quick Summary Pane ──────────────────────────── */}
        <aside style={{
          width: 300, marginLeft: 'auto', height: '100%',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(13,15,21,0.97)',
          backdropFilter: 'blur(12px)',
          zIndex: 30, padding: '14px 14px 10px',
          flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {/* Pane header */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
            color: isAuto ? '#A78BFA' : '#F59E0B',
            textTransform: 'uppercase',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            paddingBottom: 8,
          }}>
            ⚡ Quick Summary
          </div>

          {/* Scenario triggers */}
          <div>
            <div style={{ color: '#475569', fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>DEMO CONTROLS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: '🔴 Trigger Failure', fn: triggerFailureScenario, color: '#EF4444' },
                { label: '🔗 Trigger Cascade', fn: triggerCascadeScenario, color: '#F59E0B' },
                { label: '⏳ Aging Spike',     fn: triggerAgingSpike,       color: '#A78BFA' },
              ].map(({ label, fn, color }) => (
                <button key={label} onClick={fn} style={{
                  width: '100%', padding: '6px 10px', fontSize: 9.5, fontFamily: 'inherit',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${color}33`,
                  borderRadius: 5, cursor: 'pointer', color, textAlign: 'left',
                  transition: 'background 0.15s',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Fix all button */}
          {(criticalCount > 0 || watchCount > 0) && (
            <button
              onClick={handleFixAll}
              style={{
                width: '100%', padding: '10px',
                background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                border: 'none', borderRadius: 6, cursor: 'pointer',
                color: '#FFF', fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                boxShadow: '0 4px 14px rgba(124,58,237,0.4)',
              }}
            >
              ⚡ FIX ALL CRITICAL ({criticalCount + watchCount})
            </button>
          )}

          {/* Machine list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto' }}>
            <div style={{ color: '#475569', fontSize: 9, letterSpacing: 1 }}>ACTIVE ALERTS</div>
            {allMachines
              .filter((m) => m.status !== 'good')
              .sort((a, b) => b.riskScore - a.riskScore)
              .map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 9px', borderRadius: 5, cursor: 'pointer',
                    background: m.status === 'critical'
                      ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)',
                    border: `1px solid ${m.status === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    transition: 'background 0.15s',
                  }}
                >
                  <StatusDot status={m.status} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, flex: 1 }}>{m.label}</span>
                  <span style={{ fontSize: 9, color: '#475569' }}>Z{m.zone}</span>
                  <span style={{
                    fontSize: 10,
                    color: m.status === 'critical' ? '#EF4444' : '#F59E0B',
                    fontWeight: 700,
                  }}>
                    {m.riskScore.toFixed(0)}%
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); dispatchWorkerToMachine(m.id); }}
                    style={{
                      background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                      borderRadius: 4, cursor: 'pointer', color: '#4ADE80',
                      fontSize: 9, padding: '2px 6px', fontFamily: 'inherit',
                    }}
                  >
                    → FIX
                  </button>
                </div>
              ))}
            {allMachines.filter((m) => m.status !== 'good').length === 0 && (
              <div style={{ fontSize: 10, color: '#22C55E', padding: '8px 0' }}>
                ✓ All systems nominal
              </div>
            )}
          </div>

          {/* Financials */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Savings</span>
              <span style={{ color: '#22C55E', fontWeight: 700 }}>
                <AnimatedCounter value={totalSavings} />
              </span>
            </div>
            {totalLoss > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>At risk</span>
                <span style={{ color: '#EF4444', fontWeight: 700 }}>
                  <AnimatedCounter value={totalLoss} />
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Actions</span>
              <span style={{ color: '#A78BFA' }}>{actionsExecuted}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Agent Logs Drawer ─────────────────────────────────────── */}
      <AgentLogsDrawer open={logsOpen} onClose={() => setLogsOpen(false)} />

      {/* ── Machine Panel ─────────────────────────────────────────── */}
      <MachinePanel />

      {/* ── ROI Bar ──────────────────────────────────────────────── */}
      <footer style={{
        height: 48, flexShrink: 0, zIndex: 40,
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: '#090B10',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 28,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '0.08em',
      }}>
        <span style={{ color: '#22C55E', fontWeight: 700 }}>
          💰 SAVED: <AnimatedCounter value={totalSavings} />
        </span>
        <span style={{ color: '#475569', fontSize: 11 }}>|</span>
        <span style={{ color: '#64748B', fontSize: 10 }}>
          ACTIONS: {actionsExecuted}
        </span>
        {criticalCount > 0 && (
          <>
            <span style={{ color: '#475569', fontSize: 11 }}>|</span>
            <span style={{ color: '#EF4444', fontSize: 10 }}>
              ⚠ {criticalCount} CRITICAL MACHINE{criticalCount > 1 ? 'S' : ''}
            </span>
          </>
        )}
        <span style={{ marginLeft: 'auto', color: '#334155', fontSize: 9 }}>
          {isAuto ? '⚡ AUTONOMOUS MODE ACTIVE' : '✋ MANUAL MODE'} · CASCADE 5s
        </span>
      </footer>
    </div>
  );
}
