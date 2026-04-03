/**
 * MachinePanel.tsx — Phase 7
 *
 * Slide-in panel from the left when a machine is selected.
 * Shows:
 *  • Status tab: root cause, risk score, recommended action button, what-if table
 *  • Machine Life tab: age bar, monthly costs, replacement cost analysis
 *
 * Dispatch is wired to workerDispatcher.dispatchWorkerToMachine()
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMachineStore } from '../../store/machineStore';
import { useRepairStore } from '../../store/repairStore';
import { useSimulationStore } from '../../store/simulationStore';
import { dispatchWorkerToMachine } from '../../engine/workerDispatcher';
import { X, Wrench, TrendingUp, AlertTriangle, CheckCircle, Clock, RotateCcw } from 'lucide-react';

type Tab = 'status' | 'life';

const STATUS_COLOR: Record<string, string> = {
  good:     '#22C55E',
  watch:    '#F59E0B',
  critical: '#EF4444',
  isolated: '#94A3B8',
};

const STATUS_LABEL: Record<string, string> = {
  good:     'GOOD',
  watch:    'WATCH',
  critical: 'CRITICAL',
  isolated: 'ISOLATED',
};

// What-if table: action → estimated outcomes
const WHAT_IF_TABLE = [
  { action: 'Repair Now',     downtime: 0,      cost: 15000,  riskAfter: 10, savings: 95000 },
  { action: 'Schedule Maint', downtime: 4,      cost: 8000,   riskAfter: 25, savings: 60000 },
  { action: 'Monitor Only',   downtime: 0,      cost: 0,      riskAfter: 85, savings: -55000 },
  { action: 'Replace Unit',   downtime: 24,     cost: 350000, riskAfter: 5,  savings: 280000 },
];

function formatINR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000)   return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

export default function MachinePanel() {
  const selectedId      = useSimulationStore((s) => s.selectedMachineId);
  const setSelectedId   = useSimulationStore((s) => s.setSelectedMachineId);
  const machines        = useMachineStore((s) => s.machines);
  const repairJobs      = useRepairStore((s) => s.jobs);

  const machine = selectedId ? machines[selectedId] : null;
  const repairJob = machine ? repairJobs[machine.id] : null;

  const [tab, setTab] = useState<Tab>('status');
  const [dispatched, setDispatched] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);

  // Reset panel state on machine change
  useEffect(() => {
    setTab('status');
    setDispatched(false);
    setExplainOpen(false);
  }, [selectedId]);

  // Close panel when machine gets fixed
  useEffect(() => {
    if (machine?.status === 'good' && dispatched) {
      setDispatched(false);
    }
  }, [machine?.status, dispatched]);

  const handleDispatch = () => {
    if (!machine) return;
    const workerId = dispatchWorkerToMachine(machine.id);
    if (workerId) setDispatched(true);
  };

  const agePct = machine ? Math.min(100, (machine.age / machine.ratedLife) * 100) : 0;
  const totalMonthlyCost = machine
    ? machine.monthlyCosts.oil + machine.monthlyCosts.power + machine.monthlyCosts.maintenance
    : 0;

  return (
    <AnimatePresence>
      {machine && (
        <>
          {/* Backdrop dimmer */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
              zIndex: 39, pointerEvents: 'none',
            }}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: -420 }}
            animate={{ x: 0 }}
            exit={{ x: -420 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            style={{
              position: 'fixed',
              left: 0, top: 48, bottom: 48,
              width: 400,
              zIndex: 40,
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(180deg, #0F1117 0%, #13151F 100%)',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '4px 0 32px rgba(0,0,0,0.6)',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.03)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: STATUS_COLOR[machine.status],
                boxShadow: `0 0 8px ${STATUS_COLOR[machine.status]}`,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#F8FAFC', fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>
                  {machine.label}
                </div>
                <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                  Zone {machine.zone} · {machine.shape.replace('-', ' ').toUpperCase()}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
                color: STATUS_COLOR[machine.status],
                padding: '3px 8px',
                border: `1px solid ${STATUS_COLOR[machine.status]}44`,
                borderRadius: 4,
                background: `${STATUS_COLOR[machine.status]}11`,
              }}>
                {STATUS_LABEL[machine.status]}
              </span>
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#475569', padding: 4, borderRadius: 6,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Risk Score Bar */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#94A3B8', fontSize: 10, letterSpacing: 1 }}>RISK SCORE</span>
                <span style={{
                  color: machine.riskScore >= 90 ? '#EF4444' : machine.riskScore >= 70 ? '#F59E0B' : '#22C55E',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {machine.riskScore}%
                </span>
              </div>
              <div style={{ background: '#1E2533', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${machine.riskScore}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{
                    height: '100%', borderRadius: 4,
                    background: machine.riskScore >= 90
                      ? 'linear-gradient(90deg, #991B1B, #EF4444)'
                      : machine.riskScore >= 70
                      ? 'linear-gradient(90deg, #92400E, #F59E0B)'
                      : 'linear-gradient(90deg, #14532D, #22C55E)',
                  }}
                />
              </div>
            </div>

            {/* Repair Progress (if active) */}
            {repairJob && (
              <div style={{
                margin: '12px 20px',
                padding: '10px 14px',
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Wrench size={13} color="#FBBF24" />
                  <span style={{ color: '#FBBF24', fontSize: 11, fontWeight: 600 }}>REPAIR IN PROGRESS</span>
                  <span style={{ color: '#64748B', fontSize: 10, marginLeft: 'auto' }}>
                    Worker {repairJob.workerId}
                  </span>
                </div>
                <div style={{ background: '#1E2533', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${repairJob.progress}%` }}
                    transition={{ duration: 0.3 }}
                    style={{
                      height: '100%', borderRadius: 3,
                      background: 'linear-gradient(90deg, #92400E, #FBBF24)',
                    }}
                  />
                </div>
                <div style={{ color: '#94A3B8', fontSize: 10, marginTop: 5, textAlign: 'right' }}>
                  {Math.round(repairJob.progress)}% complete
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)',
              padding: '0 20px',
            }}>
              {(['status', 'life'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: '10px 0',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: tab === t ? '#F8FAFC' : '#475569',
                    fontSize: 11, fontWeight: tab === t ? 700 : 400,
                    letterSpacing: 1,
                    borderBottom: tab === t ? `2px solid #3B82F6` : '2px solid transparent',
                    textTransform: 'uppercase',
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  {t === 'status' ? 'Status & Actions' : 'Machine Life'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
              <AnimatePresence mode="wait">
                {tab === 'status' ? (
                  <motion.div key="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                    {/* Root Cause */}
                    {machine.rootCause && (
                      <div style={{
                        background: 'rgba(239,68,68,0.07)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 8, padding: '12px 14px', marginBottom: 16,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <AlertTriangle size={13} color="#EF4444" />
                          <span style={{ color: '#EF4444', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>ROOT CAUSE</span>
                        </div>
                        <p style={{ color: '#CBD5E1', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                          {machine.rootCause}
                        </p>
                      </div>
                    )}

                    {/* Recommended Action Button */}
                    {(machine.status === 'watch' || machine.status === 'critical') && !repairJob && (
                      <button
                        onClick={handleDispatch}
                        disabled={dispatched}
                        style={{
                          width: '100%', padding: '13px',
                          background: dispatched
                            ? 'rgba(34,197,94,0.15)'
                            : machine.status === 'critical'
                            ? 'linear-gradient(135deg, #991B1B, #DC2626)'
                            : 'linear-gradient(135deg, #92400E, #D97706)',
                          border: 'none', borderRadius: 8, cursor: dispatched ? 'default' : 'pointer',
                          color: '#F8FAFC', fontSize: 12, fontWeight: 700, letterSpacing: 1,
                          fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          marginBottom: 16,
                          boxShadow: dispatched ? 'none' : '0 4px 14px rgba(0,0,0,0.4)',
                          transition: 'all 0.2s',
                          opacity: dispatched ? 0.7 : 1,
                        }}
                      >
                        <Wrench size={14} />
                        {dispatched ? 'WORKER DISPATCHED' : `DISPATCH REPAIR — ${machine.recommendedAction ?? 'REPAIR NOW'}`}
                      </button>
                    )}
                    {machine.status === 'good' && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', marginBottom: 16,
                        background: 'rgba(34,197,94,0.08)',
                        border: '1px solid rgba(34,197,94,0.2)',
                        borderRadius: 8,
                      }}>
                        <CheckCircle size={14} color="#22C55E" />
                        <span style={{ color: '#22C55E', fontSize: 12 }}>Operating normally — no action needed</span>
                      </div>
                    )}

                    {/* What-If Simulation */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ color: '#64748B', fontSize: 10, letterSpacing: 1, marginBottom: 10 }}>
                        WHAT-IF SIMULATION
                      </div>
                      <div style={{
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 8, overflow: 'hidden',
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                              <th style={{ padding: '8px 12px', color: '#64748B', textAlign: 'left', fontWeight: 600 }}>Action</th>
                              <th style={{ padding: '8px 8px', color: '#64748B', textAlign: 'right', fontWeight: 600 }}>Cost</th>
                              <th style={{ padding: '8px 8px', color: '#64748B', textAlign: 'right', fontWeight: 600 }}>Risk After</th>
                              <th style={{ padding: '8px 12px', color: '#64748B', textAlign: 'right', fontWeight: 600 }}>Net Savings</th>
                            </tr>
                          </thead>
                          <tbody>
                            {WHAT_IF_TABLE.map((row, i) => (
                              <tr
                                key={i}
                                style={{
                                  borderTop: '1px solid rgba(255,255,255,0.05)',
                                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                                }}
                              >
                                <td style={{ padding: '8px 12px', color: '#CBD5E1' }}>{row.action}</td>
                                <td style={{ padding: '8px 8px', color: '#94A3B8', textAlign: 'right' }}>{formatINR(row.cost)}</td>
                                <td style={{
                                  padding: '8px 8px', textAlign: 'right',
                                  color: row.riskAfter >= 70 ? '#EF4444' : row.riskAfter >= 40 ? '#F59E0B' : '#22C55E',
                                }}>
                                  {row.riskAfter}%
                                </td>
                                <td style={{
                                  padding: '8px 12px', textAlign: 'right',
                                  color: row.savings >= 0 ? '#22C55E' : '#EF4444',
                                  fontWeight: 700,
                                }}>
                                  {formatINR(row.savings)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Explain Decision */}
                    <button
                      onClick={() => setExplainOpen(!explainOpen)}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'rgba(59,130,246,0.08)',
                        border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: 8, cursor: 'pointer',
                        color: '#93C5FD', fontSize: 11, fontFamily: 'inherit',
                        textAlign: 'left', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>💡 Explain AI Decision</span>
                      <span style={{ fontSize: 10 }}>{explainOpen ? '▲' : '▼'}</span>
                    </button>
                    <AnimatePresence>
                      {explainOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{
                            padding: '12px 14px', marginTop: 4,
                            background: 'rgba(15,17,23,0.8)',
                            border: '1px solid rgba(59,130,246,0.15)',
                            borderRadius: 8,
                            color: '#93C5FD', fontSize: 11, lineHeight: 1.7,
                          }}>
                            <span style={{ color: '#3B82F6', fontWeight: 700 }}>[PREDICTION]</span>{' '}
                            Risk score {machine.riskScore}% exceeds threshold. Based on sensor correlation
                            (temperature +12°C, vibration amplitude 2.3× baseline), failure
                            probability within 72h: <span style={{ color: '#F59E0B' }}>87%</span>.
                            <br /><br />
                            <span style={{ color: '#22C55E', fontWeight: 700 }}>[STRATEGY]</span>{' '}
                            Immediate repair minimizes downtime cost vs. reactive replacement.
                            Projected savings: <span style={{ color: '#22C55E' }}>₹95,000</span>.
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </motion.div>
                ) : (
                  <motion.div key="life" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

                    {/* Age Bar */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: '#94A3B8', fontSize: 10, letterSpacing: 1 }}>MACHINE AGE</span>
                        <span style={{
                          color: agePct >= 90 ? '#EF4444' : agePct >= 60 ? '#F59E0B' : '#94A3B8',
                          fontSize: 12, fontWeight: 700,
                        }}>
                          {machine.age}y / {machine.ratedLife}y rated
                        </span>
                      </div>
                      <div style={{ background: '#1E2533', height: 12, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${agePct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          style={{
                            height: '100%', borderRadius: 6,
                            background: agePct >= 90
                              ? 'repeating-linear-gradient(45deg, #991B1B, #991B1B 4px, #DC2626 4px, #DC2626 8px)'
                              : agePct >= 60
                              ? 'linear-gradient(90deg, #92400E, #D97706)'
                              : 'linear-gradient(90deg, #1D4ED8, #3B82F6)',
                          }}
                        />
                        {agePct >= 90 && (
                          <div style={{
                            position: 'absolute', top: '50%', left: '50%',
                            transform: 'translate(-50%,-50%)',
                            fontSize: 8, fontWeight: 800, color: '#FFF',
                            letterSpacing: 1,
                          }}>
                            END OF LIFE
                          </div>
                        )}
                      </div>
                      <div style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>
                        {(100 - agePct).toFixed(1)}% remaining useful life
                      </div>
                    </div>

                    {/* Monthly Cost Breakdown */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ color: '#64748B', fontSize: 10, letterSpacing: 1, marginBottom: 10 }}>
                        MONTHLY COST BREAKDOWN
                      </div>
                      {[
                        { label: 'Oil & Lubrication', value: machine.monthlyCosts.oil, color: '#FBBF24' },
                        { label: 'Power Consumption', value: machine.monthlyCosts.power, color: '#60A5FA' },
                        { label: 'Maintenance Labor', value: machine.monthlyCosts.maintenance, color: '#34D399' },
                      ].map((row) => (
                        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: row.color, flexShrink: 0 }} />
                          <span style={{ color: '#94A3B8', fontSize: 11, flex: 1 }}>{row.label}</span>
                          <span style={{ color: '#CBD5E1', fontSize: 12, fontWeight: 600 }}>{formatINR(row.value)}</span>
                        </div>
                      ))}
                      <div style={{
                        borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 4,
                        display: 'flex', justifyContent: 'space-between',
                      }}>
                        <span style={{ color: '#64748B', fontSize: 11 }}>Total / month</span>
                        <span style={{ color: '#F8FAFC', fontSize: 13, fontWeight: 700 }}>{formatINR(totalMonthlyCost)}</span>
                      </div>
                    </div>

                    {/* Replacement Analysis */}
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 8, padding: '14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <RotateCcw size={13} color="#94A3B8" />
                        <span style={{ color: '#94A3B8', fontSize: 10, letterSpacing: 1 }}>REPLACEMENT ANALYSIS</span>
                      </div>
                      {[
                        { label: 'Replacement Cost',     value: formatINR(totalMonthlyCost * 30),   color: '#EF4444' },
                        { label: 'Annual Overrun',        value: formatINR(totalMonthlyCost * agePct / 100 * 12), color: '#F59E0B' },
                        { label: 'Projected 5yr Savings', value: formatINR(totalMonthlyCost * 0.3 * 60), color: '#22C55E' },
                      ].map((item) => (
                        <div key={item.label} style={{
                          display: 'flex', justifyContent: 'space-between', marginBottom: 8,
                        }}>
                          <span style={{ color: '#64748B', fontSize: 11 }}>{item.label}</span>
                          <span style={{ color: item.color, fontSize: 12, fontWeight: 700 }}>{item.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Timeline icons */}
                    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                      <div style={{
                        flex: 1, padding: '10px', textAlign: 'center',
                        background: 'rgba(59,130,246,0.08)',
                        border: '1px solid rgba(59,130,246,0.2)',
                        borderRadius: 8,
                      }}>
                        <Clock size={14} color="#60A5FA" style={{ margin: '0 auto 4px' }} />
                        <div style={{ color: '#60A5FA', fontSize: 10, fontWeight: 700 }}>+6h Projection</div>
                        <div style={{ color: '#94A3B8', fontSize: 10, marginTop: 2 }}>Risk +{Math.min(15, machine.riskScore * 0.1).toFixed(0)}%</div>
                      </div>
                      <div style={{
                        flex: 1, padding: '10px', textAlign: 'center',
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 8,
                      }}>
                        <TrendingUp size={14} color="#F87171" style={{ margin: '0 auto 4px' }} />
                        <div style={{ color: '#F87171', fontSize: 10, fontWeight: 700 }}>+24h Projection</div>
                        <div style={{ color: '#94A3B8', fontSize: 10, marginTop: 2 }}>Risk +{Math.min(35, machine.riskScore * 0.3).toFixed(0)}%</div>
                      </div>
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
