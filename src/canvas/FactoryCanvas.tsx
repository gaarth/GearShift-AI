/**
 * FactoryCanvas.tsx — Phase 3
 * - Zone-per-view rendering (one zone visible at a time)
 * - Status-based machine visuals (glow, shake, flicker via ticker)
 * - Animated pipe pulses based on upstream status
 * - Zoom (scroll wheel 0.5x–3x) + pan (click-drag)
 * - Click machine to select
 */
import { Application, extend, useTick } from '@pixi/react';
import {
  Container,
  Graphics,
  Text,
  TextStyle,
  Ticker,
  Sprite,
  Texture,
  Assets,
} from 'pixi.js';

// Limit global Pixi animations to 24 FPS for retro pixel-art aesthetic
Ticker.shared.maxFPS = 24;
import { useMachineStore, type Machine, type Pipe } from '../store/machineStore';
import { useSimulationStore } from '../store/simulationStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import SmokeSystem from './SmokeSystem';
import WorkerSystem from './WorkerSystem';

extend({ Container, Graphics, Text, Sprite });

// ── Constants ────────────────────────────────────────────────────
const CANVAS_W = 900;
const CANVAS_H = 650;

// Machine body dimensions by shape
function getMachineDims(shape: Machine['shape']): { w: number; h: number } {
  switch (shape) {
    case 'tall-rect':     return { w: 48, h: 72 };
    case 'wide-squat':   return { w: 80, h: 48 };
    case 'long-bar':     return { w: 120, h: 36 };
    case 'large-square': return { w: 72, h: 72 };
    case 'medium-square':return { w: 56, h: 56 };
    case 'wide-rect':    return { w: 96, h: 48 };
    case 'l-shape':      return { w: 72, h: 72 };
    case 'small-square': return { w: 44, h: 44 };
    default:             return { w: 56, h: 56 };
  }
}

// Status glow colors (hex numbers)
const STATUS_GLOW: Record<string, number> = {
  good:     0x5A8A5A,
  watch:    0xA08040,
  critical: 0x9A4040,
  isolated: 0x8A8A8A,
};
const STATUS_GLOW_BRIGHT: Record<string, number> = {
  good:     0x7ACC7A,
  watch:    0xE8B840,
  critical: 0xFF5555,
  isolated: 0xAAAAAA,
};

// Projected status glow — slightly desaturated/tinted purple to show it's a forecast
const PROJ_GLOW: Record<string, number> = {
  good:     0x4A7A8A,  // teal-ish
  watch:    0xC08060,  // warm amber
  critical: 0xBB4488,  // magenta-red = "would be critical"
  isolated: 0x6A6A9A,
};
const PROJ_GLOW_BRIGHT: Record<string, number> = {
  good:     0x6ABECC,
  watch:    0xFFCC66,
  critical: 0xFF66BB,
  isolated: 0xAAAABB,
};

// Calculate projected risk and status for a machine N hours ahead
function projectMachine(machine: Machine, hours: number): { risk: number; status: Machine['status'] } {
  // Drift rate: older machines age faster. ~3-8%/hour based on age ratio.
  const ageFactor = machine.age / machine.ratedLife;
  const driftPerHour = 2.5 + ageFactor * 5.5; // 2.5–8% per hour
  const projRisk = Math.min(100, machine.riskScore + driftPerHour * hours);
  const projStatus: Machine['status'] =
    projRisk >= 90 ? 'critical'
    : projRisk >= 70 ? 'watch'
    : 'good';
  return { risk: projRisk, status: projStatus };
}

// Zone floor colors
const ZONE_FLOOR: Record<string, number> = {
  A: 0xC8D0C0,
  B: 0xC4CCD8,
  C: 0xD4C8C0,
  D: 0xC8C4B8,
  E: 0xC0CCC8,
};
const ZONE_BORDER = 0x5A5048;

const ZoneFloor = ({ zone }: { zone: string }) => {
  const floorColor = ZONE_FLOOR[zone] ?? 0xD8D4CC;
  const [mapTexture, setMapTexture] = useState<Texture | null>(null);

  const drawBg = useCallback((g: Graphics) => {
    g.clear();
    g.rect(0, 0, CANVAS_W, CANVAS_H);
    g.stroke({ width: 6, color: ZONE_BORDER });
  }, []);

  // Actually fetch the map image via Assets.load()
  useEffect(() => {
    const imgPath = `/assets/maps/zone_${zone.toLowerCase()}_map.png`;
    Assets.load<Texture>(imgPath).then((tex) => {
      setMapTexture(tex);
    }).catch(() => {
      console.warn(`[ZoneFloor] Failed to load map: ${imgPath}`);
    });
  }, [zone]);

  return (
    <pixiContainer>
      {/* Background color block as fallback */}
      <pixiGraphics draw={(g) => { g.clear(); g.rect(0, 0, CANVAS_W, CANVAS_H); g.fill(floorColor); }} />
      {/* Generated Map image — only shown once loaded */}
      {mapTexture && (
        <pixiSprite
          anchor={0}
          texture={mapTexture}
          width={CANVAS_W}
          height={CANVAS_H}
          alpha={0.85}
        />
      )}
      {/* Overlay border */}
      <pixiGraphics draw={drawBg} />
    </pixiContainer>
  );
};

// ── Zone Label ───────────────────────────────────────────────────
const ZONE_NAMES: Record<string, string> = {
  A: 'ZONE A: RAW MATERIALS',
  B: 'ZONE B: ASSEMBLY',
  C: 'ZONE C: PACKAGING',
  D: 'ZONE D: STORAGE',
  E: 'ZONE E: QC',
};

// ── Animated Machine Node ────────────────────────────────────────
const AnimatedMachineNode = ({ machineId }: { machineId: string }) => {
  const machine    = useMachineStore((s) => s.machines[machineId]);
  const isSelected = useSimulationStore((s) => s.selectedMachineId === machineId);
  const setSelected= useSimulationStore((s) => s.setSelectedMachineId);
  const timeView   = useSimulationStore((s) => s.timeView);
  const glowPhase  = useRef(Math.random() * Math.PI * 2);
  const shakeOffset= useRef({ x: 0, y: 0 });
  const containerRef = useRef<Container | null>(null);
  const graphicsRef  = useRef<Graphics | null>(null);

  // Animate each frame via useTick
  useTick((ticker) => {
    if (!machine) return;
    glowPhase.current += ticker.deltaMS * 0.003;

    // Use projected or real status for animation intensity
    const projHours = timeView === '+6h' ? 6 : timeView === '+24h' ? 24 : 0;
    const effective = projHours > 0 ? projectMachine(machine, projHours) : { risk: machine.riskScore, status: machine.status };

    const pct = machine.age / machine.ratedLife;
    let ageSway = { x: 0, y: 0 };
    if (pct >= 0.9) {
      const intensity = 0.5;
      ageSway = { x: (Math.random() - 0.5) * intensity, y: (Math.random() - 0.5) * intensity };
    } else if (pct >= 0.8) {
      ageSway = { x: Math.sin(glowPhase.current * 0.2) * 0.5, y: 0 };
    }

    if (effective.status === 'critical') {
      shakeOffset.current = {
        x: (Math.random() - 0.5) * 3 + ageSway.x,
        y: (Math.random() - 0.5) * 3 + ageSway.y,
      };
    } else if (effective.status === 'watch') {
      shakeOffset.current = { x: Math.sin(glowPhase.current * 0.4) * 1.2 + ageSway.x, y: ageSway.y };
    } else {
      shakeOffset.current = ageSway;
    }

    if (containerRef.current) {
      containerRef.current.x = machine.position.x + shakeOffset.current.x;
      containerRef.current.y = machine.position.y + shakeOffset.current.y;
    }

    if (graphicsRef.current) {
      redrawMachine(graphicsRef.current, machine, isSelected, glowPhase.current, effective.status, effective.risk, timeView !== 'now');
    }
  });

  const redrawMachine = (
    g: Graphics, m: Machine, selected: boolean, phase: number,
    effectiveStatus: Machine['status'] = m.status,
    _effectiveRisk: number = m.riskScore,
    isProjected: boolean = false,
  ) => {
    g.clear();
    const { w, h } = getMachineDims(m.shape);
    const hw = w / 2, hh = h / 2;

    // Use projected colors in projection mode
    const glowBright = isProjected ? PROJ_GLOW_BRIGHT[effectiveStatus] : STATUS_GLOW_BRIGHT[effectiveStatus];
    const glowBase   = isProjected ? PROJ_GLOW[effectiveStatus]       : STATUS_GLOW[effectiveStatus];
    const pulse = 0.5 + 0.5 * Math.sin(phase * (effectiveStatus === 'critical' ? 4 : effectiveStatus === 'watch' ? 2 : 1));

    // Outer glow halo (larger + more vivid for projected critical)
    const glowAlpha  = effectiveStatus === 'isolated' ? 0.1 : 0.15 + pulse * (isProjected ? 0.35 : 0.25);
    const glowRadius = (effectiveStatus === 'critical' ? 14 : effectiveStatus === 'watch' ? 10 : 7) + pulse * 4;
    g.rect(-hw - glowRadius, -hh - glowRadius, w + glowRadius * 2, h + glowRadius * 2);
    g.fill({ color: glowBase, alpha: glowAlpha });

    // Machine drop shadow for depth
    g.rect(-hw + 6, -hh + 10, w, h);
    g.fill({ color: 0x000000, alpha: 0.35 });

    // Main body fill
    let fillColor = 0x8A8078;
    if (m.baseColor?.startsWith('#')) fillColor = parseInt(m.baseColor.replace('#', ''), 16);

    // In projection mode: tint the body darker to indicate "forecast"
    if (isProjected && effectiveStatus !== m.status) {
      // Mix fillColor with projected status tint
      fillColor = Math.round(fillColor * 0.7);
    }

    if (m.shape === 'l-shape') {
      g.rect(-hw, -hh, w, h); g.fill(fillColor);
      g.rect(hw - 24, -hh, 24, h / 2); g.fill({ color: fillColor, alpha: 0.7 });
    } else {
      g.rect(-hw, -hh, w, h); g.fill(fillColor);
    }

    // Aging overlays
    const pct = m.age / m.ratedLife;
    if (pct >= 0.5 && pct < 0.8) {
      g.rect(-hw, -hh, w, h); g.fill({ color: 0x000000, alpha: 0.1 });
      g.rect(-hw, -hh, 4, 4); g.fill({ color: 0x5C4033, alpha: 0.3 });
      g.rect(hw - 4, hh - 4, 4, 4); g.fill({ color: 0x5C4033, alpha: 0.3 });
    } else if (pct >= 0.8 && pct < 0.9) {
      g.rect(-hw, -hh, w, h); g.fill({ color: 0x000000, alpha: 0.15 });
      g.rect(-hw, -hh, w, h); g.fill({ color: 0xFFB347, alpha: 0.1 });
      g.rect(-hw, -hh, 12, 12); g.fill({ color: 0x8B4513, alpha: 0.5 });
      g.rect(hw - 12, hh - 12, 12, 12); g.fill({ color: 0x8B4513, alpha: 0.5 });
    } else if (pct >= 0.9) {
      g.rect(-hw, -hh, w, h); g.fill({ color: 0x000000, alpha: 0.2 });
      g.rect(-hw, -hh, w, h); g.fill({ color: 0xFFB347, alpha: 0.15 });
      g.rect(-hw, -hh, 14, 14); g.fill({ color: 0x8B2010, alpha: 0.7 });
      g.rect(hw - 14, hh - 14, 14, 14); g.fill({ color: 0x8B2010, alpha: 0.7 });
      g.rect(-hw, hh - 8, 8, 8); g.fill({ color: 0x8B2010, alpha: 0.7 });
      g.rect(hw - 8, -hh, 8, 8); g.fill({ color: 0x8B2010, alpha: 0.7 });
      g.rect(-4, -4, 8, 8); g.fill({ color: 0x8B2010, alpha: 0.5 });
    }

    // Status tint overlay
    if (effectiveStatus === 'watch') {
      g.rect(-hw, -hh, w, h); g.fill({ color: isProjected ? 0xCC8840 : 0xB87030, alpha: isProjected ? 0.18 : 0.12 });
      g.rect(-hw, -hh, 8, 8); g.fill({ color: 0x8B4513, alpha: 0.4 });
      g.rect(hw - 8, hh - 8, 8, 8); g.fill({ color: 0x8B4513, alpha: 0.4 });
    } else if (effectiveStatus === 'critical') {
      g.rect(-hw, -hh, w, h); g.fill({ color: isProjected ? 0xCC2088 : 0xB83010, alpha: isProjected ? 0.25 : 0.2 });
      g.rect(-hw, -hh, 12, 12); g.fill({ color: 0x8B2010, alpha: 0.6 });
      g.rect(hw - 12, -hh, 12, 12); g.fill({ color: 0x8B2010, alpha: 0.6 });
      g.rect(-hw, hh - 12, 12, 12); g.fill({ color: 0x8B2010, alpha: 0.6 });
      g.rect(hw - 12, hh - 12, 12, 12); g.fill({ color: 0x8B2010, alpha: 0.6 });
    }

    // Projected status: pulsing double-border (cheap — just 2 rect strokes)
    if (isProjected && effectiveStatus !== m.status) {
      const outerAlpha = 0.6 + pulse * 0.4;
      // Outer glow rect
      g.rect(-hw - 3, -hh - 3, w + 6, h + 6);
      g.stroke({ width: 2, color: glowBright, alpha: outerAlpha * 0.5 });
      // Inner dashed-look rect (slightly inset)
      g.rect(-hw, -hh, w, h);
      g.stroke({ width: 2, color: glowBright, alpha: outerAlpha });
    } else {
      // Normal solid border
      const borderColor = selected ? 0x4A6A8A : (pulse > 0.5 ? glowBright : glowBase);
      const borderWidth = selected ? 4 : (effectiveStatus === 'critical' ? 3 : 2);
      g.rect(-hw, -hh, w, h);
      g.stroke({ width: borderWidth, color: borderColor });
    }

    // Status indicator dot (top-right)
    const dotColor = pulse > 0.5 ? glowBright : glowBase;
    g.circle(hw - 5, -hh + 5, 5);
    g.fill(dotColor);

    // In projection mode: show projected risk % in bottom-left corner
    if (isProjected && effectiveStatus !== m.status) {
      // Mini badge: show projected risk
      g.rect(-hw, hh - 14, 28, 14);
      g.fill({ color: effectiveStatus === 'critical' ? 0x8B1040 : 0x8B5010, alpha: 0.9 });
    }
  };

  const initialDraw = useCallback((g: Graphics) => {
    if (!machine) return;
    graphicsRef.current = g;
    const projHours = timeView === '+6h' ? 6 : timeView === '+24h' ? 24 : 0;
    const eff = projHours > 0 ? projectMachine(machine, projHours) : { risk: machine.riskScore, status: machine.status };
    redrawMachine(g, machine, isSelected, glowPhase.current, eff.status, eff.risk, projHours > 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!machine) return null;

  // Projected data for labels
  const projHours = timeView === '+6h' ? 6 : timeView === '+24h' ? 24 : 0;
  const proj = projHours > 0 ? projectMachine(machine, projHours) : null;
  const willDeterioriate = proj && proj.status !== machine.status;
  const { h: mh } = getMachineDims(machine.shape);

  return (
    <pixiContainer
      ref={containerRef}
      x={machine.position.x}
      y={machine.position.y}
      interactive={true}
      onPointerDown={() => setSelected(isSelected ? null : machineId)}
      cursor="pointer"
    >
      <pixiGraphics draw={initialDraw} />
      {/* Main label */}
      <pixiText
        text={machine.label}
        x={0}
        y={mh / 2 + 6}
        anchor={{ x: 0.5, y: 0 }}
        style={new TextStyle({
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, fill: 0x2C2A28, fontWeight: 'bold',
        })}
      />
      {/* Age warning badge */}
      {(machine.age / machine.ratedLife) >= 0.9 && (
        <pixiContainer y={-mh / 2 - 20}>
          <pixiGraphics draw={(g) => { g.clear(); g.roundRect(-24, -8, 48, 16, 2); g.fill(0xEAB308); }} />
          <pixiText
            text={`! ${machine.age.toFixed(1)}y`}
            x={0} y={0} anchor={{ x: 0.5, y: 0.5 }}
            style={new TextStyle({ fontFamily: "'Press Start 2P', monospace", fontSize: 7, fill: 0x111111 })}
          />
        </pixiContainer>
      )}
      {/* Projection badge — shown when this machine will deteriorate in the forecast window */}
      {willDeterioriate && proj && (
        <pixiContainer y={-mh / 2 - (machine.age / machine.ratedLife >= 0.9 ? 38 : 20)}>
          <pixiGraphics draw={(g) => {
            g.clear();
            const badgeColor = proj.status === 'critical' ? 0xBB2288 : 0xCC7722;
            g.roundRect(-30, -8, 60, 16, 2);
            g.fill({ color: badgeColor, alpha: 0.9 });
          }} />
          <pixiText
            text={`▲${timeView} ${proj.risk.toFixed(0)}%`}
            x={0} y={0} anchor={{ x: 0.5, y: 0.5 }}
            style={new TextStyle({
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 6,
              fill: proj.status === 'critical' ? 0xFFCCEE : 0xFFEECC,
            })}
          />
        </pixiContainer>
      )}
    </pixiContainer>
  );
};

// ── Animated Pipe System ─────────────────────────────────────────
const AnimatedPipeSystem = ({ zone }: { zone: string }) => {
  const pipes = useMachineStore(useShallow((s) => s.pipes));
  const machines = useMachineStore(useShallow((s) => s.machines));
  const gRef = useRef<Graphics | null>(null);
  const phase = useRef(0);

  useTick((ticker) => {
    phase.current += ticker.deltaMS * 0.002;
    if (gRef.current) drawPipes(gRef.current);
  });

  const drawPipes = (g: Graphics) => {
    g.clear();
    const localPipes = pipes.filter((pipe) => {
      const fromM = machines[pipe.from];
      const toM = machines[pipe.to];
      // Draw a pipe in this zone if either endpoint is in this zone
      return (fromM?.zone === zone || toM?.zone === zone);
    });

    localPipes.forEach((pipe: Pipe) => {
      const fromM = machines[pipe.from];
      const toM  = machines[pipe.to];
      if (!fromM) return;

      const isCrossZone = pipe.crossZone || (fromM.zone !== toM?.zone);

      let color = 0x8A8078;
      let width = 4;
      let pulseAlpha = 1;

      if (fromM.status === 'critical') {
        color = 0x9A4040;
        width = 6;
        pulseAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(phase.current * 6));
      } else if (fromM.status === 'watch') {
        color = 0xA08040;
        pulseAlpha = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(phase.current * 2.5));
      } else if (fromM.status === 'isolated') {
        color = 0xC0BCB8;
        pulseAlpha = 0.5;
      }

      g.setStrokeStyle({ width, color, alpha: pulseAlpha });

      const startX = fromM.position.x;
      const startY = fromM.position.y;

      if (isCrossZone) {
        // Cross-zone: draw a short stub arrow pointing to zone edge
        const { w } = getMachineDims(fromM.shape);
        // Determine exit direction based on machine label
        let arrowX = startX + w / 2 + 30;
        let arrowY = startY;

        if (fromM.zone === zone) {
          // Draw the stub from this machine's half
          g.moveTo(startX, startY);
          g.lineTo(arrowX - 10, arrowY);
          g.stroke();
          // Arrow head
          g.moveTo(arrowX, arrowY);
          g.lineTo(arrowX - 10, arrowY - 6);
          g.moveTo(arrowX, arrowY);
          g.lineTo(arrowX - 10, arrowY + 6);
          g.stroke();
        }
        return;
      }

      if (!toM) return;
      // Same-zone pipe
      g.moveTo(fromM.position.x, fromM.position.y);
      if (pipe.points?.length > 0) {
        pipe.points.forEach((pt) => g.lineTo(pt.x, pt.y));
      }
      g.lineTo(toM.position.x, toM.position.y);
      g.stroke();
    });
  };

  const initialDraw = useCallback((g: Graphics) => {
    gRef.current = g;
    drawPipes(g);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <pixiGraphics draw={initialDraw} />;
};

// ── Zone Label Text ──────────────────────────────────────────────
const ZoneLabelText = ({ zone }: { zone: string }) => {
  return (
    <pixiText
      text={ZONE_NAMES[zone] ?? zone}
      x={16}
      y={16}
      alpha={0.55}
      style={new TextStyle({
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 11,
        fill: 0x2C2A28,
      })}
    />
  );
};

// ── Zone Scene (all of a single zone's content) ──────────────────
const ZoneScene = ({ zone }: { zone: string }) => {
  const machineIds = useMachineStore(
    useShallow((s) => Object.keys(s.machines).filter((id) => s.machines[id].zone === zone))
  );

  return (
    <pixiContainer>
      <ZoneFloor zone={zone} />
      <AnimatedPipeSystem zone={zone} />
      {machineIds.map((id) => (
        <AnimatedMachineNode key={id} machineId={id} />
      ))}
      <SmokeSystem zone={zone} />
      <WorkerSystem zone={zone} />
      <ZoneLabelText zone={zone} />
    </pixiContainer>
  );
};

// ── Inner Canvas (has access to app context via useApp) ──────────
function InnerCanvas() {
  const currentZone = useSimulationStore((s) => s.currentZone);

  return (
    <pixiContainer>
      <ZoneScene zone={currentZone} />
    </pixiContainer>
  );
}

// ── FactoryCanvas ────────────────────────────────────────────────
export default function FactoryCanvas() {
  const cameraScale = useSimulationStore((s) => s.cameraScale);
  const cameraOffset = useSimulationStore((s) => s.cameraOffset);
  const setCameraScale = useSimulationStore((s) => s.setCameraScale);
  const setCameraOffset = useSimulationStore((s) => s.setCameraOffset);

  const isDragging = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });
  const canvasRef  = useRef<HTMLDivElement>(null);

  const [canvasSize, setCanvasSize] = useState({ w: window.innerWidth - 320, h: window.innerHeight - 96 });

  useEffect(() => {
    const onResize = () => {
      setCanvasSize({ w: window.innerWidth - 320, h: window.innerHeight - 96 });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Scroll → zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    setCameraScale(cameraScale * delta);
  }, [cameraScale, setCameraScale]);

  // Drag → pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setCameraOffset({ x: cameraOffset.x + dx, y: cameraOffset.y + dy });
  }, [cameraOffset, setCameraOffset]);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      ref={canvasRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', cursor: isDragging.current ? 'grabbing' : 'grab' }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <Application
        width={canvasSize.w}
        height={canvasSize.h}
        backgroundAlpha={0}
        antialias={false}
        resolution={1}
      >
        <pixiContainer
          scale={cameraScale}
          x={cameraOffset.x + (canvasSize.w - CANVAS_W * cameraScale) / 2}
          y={cameraOffset.y + (canvasSize.h - CANVAS_H * cameraScale) / 2}
        >
          <InnerCanvas />
        </pixiContainer>
      </Application>
    </div>
  );
}
