import { useEffect, useRef } from 'react';
import { useTick, extend } from '@pixi/react';
import { Graphics, Container } from 'pixi.js';
import { useMachineStore, type MachineStatus } from '../store/machineStore';
import { useShallow } from 'zustand/react/shallow';

extend({ Container, Graphics });

// ── Smoke config per status tier ──────────────────────────────────
interface SmokeTierConfig {
  emitRate: number;       // ms between emissions
  puffCount: number;      // puffs per emission burst
  baseAlpha: number;
  colors: number[];       // pixel colors to pick from
  sizeMin: number;        // min pixel cluster size
  sizeMax: number;        // max pixel cluster size
  lifetime: number;       // ms before puff dies
  riseSpeed: number;      // pixels per ms upward
  driftRange: number;     // horizontal sway amplitude
  scatterChance: number;  // chance of extra scattered pixel fragments
}

const SMOKE_TIERS: Record<MachineStatus, SmokeTierConfig | null> = {
  good: {
    emitRate: 3000,
    puffCount: 1,
    baseAlpha: 0.4,
    colors: [0xD8D8D8, 0xEFEFEF, 0xC8C8C8],
    sizeMin: 2,
    sizeMax: 4,
    lifetime: 2500,
    riseSpeed: 0.018,
    driftRange: 0.3,
    scatterChance: 0.1,
  },
  watch: {
    emitRate: 1000,
    puffCount: 2,
    baseAlpha: 0.6,
    colors: [0xC0B090, 0xA08060, 0xB0A080, 0x908060],
    sizeMin: 3,
    sizeMax: 6,
    lifetime: 2000,
    riseSpeed: 0.025,
    driftRange: 0.5,
    scatterChance: 0.3,
  },
  critical: {
    emitRate: 350,
    puffCount: 4,
    baseAlpha: 0.85,
    colors: [0x6A5040, 0x4A3428, 0x5A4030, 0x3A2820, 0x785848],
    sizeMin: 3,
    sizeMax: 8,
    lifetime: 1400,
    riseSpeed: 0.035,
    driftRange: 1.0,
    scatterChance: 0.6,
  },
  isolated: null,
};

// ── Puff particle data ────────────────────────────────────────────
interface Puff {
  x: number;
  y: number;
  vx: number;           // horizontal drift velocity
  size: number;
  color: number;
  alpha: number;
  maxAlpha: number;
  age: number;          // ms alive
  lifetime: number;     // ms total
  seed: number;         // for sway
  // Pixel fragment cluster: array of offsets from center
  fragments: { dx: number; dy: number; size: number }[];
}

const MAX_PUFFS_PER_MACHINE = 12;

function createPuff(
  mx: number, my: number, machineH: number, tier: SmokeTierConfig
): Puff {
  const size = tier.sizeMin + Math.random() * (tier.sizeMax - tier.sizeMin);
  const color = tier.colors[Math.floor(Math.random() * tier.colors.length)];

  // Build pixel fragment cluster (chunky pixel-art look)
  const fragments: Puff['fragments'] = [{ dx: 0, dy: 0, size }];
  // Add 1-3 surrounding pixel chunks for a cloud shape
  const extraCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < extraCount; i++) {
    fragments.push({
      dx: (Math.random() - 0.5) * size * 1.8,
      dy: (Math.random() - 0.5) * size * 1.2,
      size: size * (0.4 + Math.random() * 0.5),
    });
  }

  // Scatter fragments (small distant pixels that break off)
  if (Math.random() < tier.scatterChance) {
    const scatterCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < scatterCount; i++) {
      fragments.push({
        dx: (Math.random() - 0.5) * size * 4,
        dy: (Math.random() - 0.5) * size * 3 - size,
        size: 1 + Math.random() * 2,
      });
    }
  }

  return {
    x: mx + (Math.random() - 0.5) * 8,   // slight x jitter around machine center
    y: my - machineH / 2 - 4,             // start at top of machine
    vx: (Math.random() - 0.5) * 0.02,
    size,
    color,
    alpha: tier.baseAlpha,
    maxAlpha: tier.baseAlpha,
    age: 0,
    lifetime: tier.lifetime * (0.8 + Math.random() * 0.4),
    seed: Math.random() * Math.PI * 2,
    fragments,
  };
}

// ── Component ─────────────────────────────────────────────────────

export default function SmokeSystem({ zone }: { zone: string }) {
  const machineIds = useMachineStore(
    useShallow((s) => Object.keys(s.machines).filter((id) => s.machines[id].zone === zone))
  );
  const machines = useMachineStore(useShallow((s) => s.machines));

  const containerRef = useRef<Container>(null);
  const graphicsRef = useRef<Graphics>(null);

  // Pool: per-machine array of puffs
  const poolRef = useRef<Record<string, Puff[]>>({});
  const lastEmitRef = useRef<Record<string, number>>({});

  // Initialize pools
  useEffect(() => {
    machineIds.forEach(id => {
      if (!poolRef.current[id]) {
        poolRef.current[id] = [];
        lastEmitRef.current[id] = 0;
      }
    });
  }, [machineIds]);

  useTick((ticker) => {
    if (!graphicsRef.current) return;
    const g = graphicsRef.current;
    g.clear();

    machineIds.forEach(id => {
      const m = machines[id];
      if (!m) return;

      const tier = SMOKE_TIERS[m.status];
      if (!tier) return;

      const pool = poolRef.current[id];
      if (!pool) return;

      // Emission
      lastEmitRef.current[id] = (lastEmitRef.current[id] || 0) + ticker.deltaMS;
      if (lastEmitRef.current[id] >= tier.emitRate) {
        lastEmitRef.current[id] = 0;

        for (let i = 0; i < tier.puffCount; i++) {
          if (pool.length < MAX_PUFFS_PER_MACHINE) {
            // Estimate machine height from shape
            const shapeH = m.shape === 'tall-rect' ? 72 :
              m.shape === 'long-bar' ? 36 :
              m.shape === 'wide-squat' ? 48 :
              m.shape === 'large-square' ? 72 :
              m.shape === 'l-shape' ? 72 :
              m.shape === 'small-square' ? 44 :
              m.shape === 'medium-square' ? 56 : 56;
            pool.push(createPuff(m.position.x, m.position.y, shapeH, tier));
          }
        }
      }

      // Update & draw puffs
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        p.age += ticker.deltaMS;

        if (p.age >= p.lifetime) {
          pool.splice(i, 1);
          continue;
        }

        const progress = p.age / p.lifetime; // 0→1

        // Rise
        p.y -= tier.riseSpeed * ticker.deltaMS;

        // Sway
        p.x += Math.sin(p.age * 0.003 + p.seed) * tier.driftRange * 0.3;
        p.x += p.vx * ticker.deltaMS;

        // Fade out + grow slightly
        p.alpha = p.maxAlpha * (1 - progress * progress); // quadratic fade
        const scaleFactor = 1 + progress * 0.6; // grow 60% over lifetime

        // Draw each fragment as a pixel rectangle (chunky pixel-art look)
        p.fragments.forEach(frag => {
          const fragSize = frag.size * scaleFactor;
          // Snap to pixel grid for that crunchy pixel feel
          const fx = Math.round(p.x + frag.dx * scaleFactor);
          const fy = Math.round(p.y + frag.dy * scaleFactor);

          g.rect(fx - fragSize / 2, fy - fragSize / 2, fragSize, fragSize);
          g.fill({ color: p.color, alpha: p.alpha });
        });
      }
    });
  });

  return (
    <pixiContainer ref={containerRef}>
      <pixiGraphics ref={graphicsRef} draw={() => {}} />
    </pixiContainer>
  );
}
