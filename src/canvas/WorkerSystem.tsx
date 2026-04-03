/**
 * WorkerSystem.tsx — performance-optimised
 *
 * All per-frame logic (movement, animation, progress bar) runs inside
 * useTick and writes ONLY to PixiJS objects via refs.
 * Zustand store writes happen ONLY on state transitions, not per-frame.
 *
 * Zero React re-renders during movement. Zero Zustand writes for position/anim.
 */
import { useRef, useEffect, useState } from 'react';
import { useWorkerStore, type WorkerVariant } from '../store/workerStore';
import { useRepairStore } from '../store/repairStore';
import { useShallow } from 'zustand/react/shallow';
import { useTick, extend } from '@pixi/react';
import { releaseWorker } from '../engine/workerDispatcher';
import { Graphics, Container, Texture, Rectangle, Sprite, Assets } from 'pixi.js';

extend({ Graphics, Container, Sprite });

// ── Zone patrol bounds ───────────────────────────────────────────
const ZONE_BOUNDS = {
  A: { minX: 80, maxX: 820, minY: 80, maxY: 580 },
  B: { minX: 80, maxX: 820, minY: 80, maxY: 580 },
  C: { minX: 80, maxX: 820, minY: 80, maxY: 580 },
  D: { minX: 80, maxX: 820, minY: 80, maxY: 580 },
  E: { minX: 80, maxX: 820, minY: 80, maxY: 580 },
};

const WORKER_SPEED = 0.07; // px/ms

// ── Module-level position cache (for workerDispatcher distance checks) ──
export const workerPositionCache = new Map<string, { x: number; y: number }>();

const WORKER_TEXTURES = {} as Record<string, Record<string, Texture[]>>;
const WORKER_LOAD_PROMISES = {} as Record<string, Promise<void>>;

/** Load sprite sheet and slice into sub-textures. Returns a promise. */
function loadWorkerTextures(variant: WorkerVariant): Promise<void> {
  const key = variant.toLowerCase();
  if (WORKER_TEXTURES[key]) return Promise.resolve();
  if (key in WORKER_LOAD_PROMISES) return WORKER_LOAD_PROMISES[key];

  const imgPath = `/assets/sprites/worker_${key}.png`;
  WORKER_LOAD_PROMISES[key] = Assets.load<Texture>(imgPath).then((tex) => {
    const source = tex.source;
    // Generated images are 512x512 with a 4x4 grid → each cell is 128x128
    WORKER_TEXTURES[key] = {
      left: [
        new Texture({ source, frame: new Rectangle(0,   128, 128, 128) }),
        new Texture({ source, frame: new Rectangle(128, 128, 128, 128) }),
        new Texture({ source, frame: new Rectangle(256, 128, 128, 128) }),
      ],
      right: [
        new Texture({ source, frame: new Rectangle(0,   256, 128, 128) }),
        new Texture({ source, frame: new Rectangle(128, 256, 128, 128) }),
        new Texture({ source, frame: new Rectangle(256, 256, 128, 128) }),
      ],
      down: [
        new Texture({ source, frame: new Rectangle(0, 0, 128, 128) }),
      ]
    };
  });
  return WORKER_LOAD_PROMISES[key];
}

function getWorkerTexture(variant: WorkerVariant, facing: 'left'|'right', frame: 0|1|2, repairing: boolean): Texture | null {
  const key = variant.toLowerCase();
  const cache = WORKER_TEXTURES[key];
  if (!cache) return null;
  if (repairing) return cache.down[0];
  return cache[facing]?.[frame] ?? cache.down[0];
}

// ── WorkerNode — single PixiJS node per worker ─────────────────
function WorkerNode({ id }: { id: string }) {
  // Only subscribe to what triggers logical state changes (not per-frame data)
  const workerVariant = useWorkerStore((s) => s.workers[id]?.variant ?? 'A');
  const workerZone    = useWorkerStore((s) => s.workers[id]?.zone ?? 'B');

  // Load sprite sheet on mount
  const [spriteReady, setSpriteReady] = useState(false);
  useEffect(() => {
    loadWorkerTextures(workerVariant).then(() => setSpriteReady(true));
  }, [workerVariant]);

  // The job key subscription lets us know when a repair job is assigned
  const assignedJobKey = useRepairStore(
    useShallow((s) => {
      const job = Object.values(s.jobs).find((j) => j.workerId === id);
      return job ? job.machineId : null;
    })
  );

  // Zustand actions — stable refs, no re-render risk
  const updateWorkerState    = useWorkerStore.getState().updateWorkerState;
  const updateProgress       = useRepairStore.getState().updateProgress;

  const containerRef = useRef<Container>(null);
  const shadowGfxRef = useRef<Graphics>(null);
  const bodySpriteRef = useRef<Sprite>(null);
  const barGfxRef    = useRef<Graphics>(null);
  const shadowScale  = useRef(1);

  const posRef   = useRef({ x: 200 + Math.random() * 500, y: 200 + Math.random() * 300 });
  const animRef  = useRef<{ frame: 0|1|2; facing: 'left'|'right'; phase: number }>({
    frame: 0, facing: 'right', phase: 0,
  });

  const walkTimerRef         = useRef(0);
  const idleTimerRef         = useRef(0);
  const idleDurationRef      = useRef(3000);
  const repairElapsedRef     = useRef(0);
  const progressSyncTimerRef = useRef(0);
  const progressRef          = useRef(0);

  const prevStateRef         = useRef<string>('');
  const prevFrameRef         = useRef<0|1|2>(-1 as 0|1|2);
  const prevRepairingRef     = useRef(false);
  const spriteRefData        = useRef<string>('');

  // ── useTick: all per-frame logic, NO Zustand writes except state transitions ──
  useTick((ticker) => {
    const w = useWorkerStore.getState().workers[id];
    if (!w) return;
    const dt = ticker.deltaMS;

    animRef.current.phase += dt * 0.003;

    // Detect state entry (idle duration set once)
    if (w.state === 'idle' && prevStateRef.current !== 'idle') {
      idleTimerRef.current    = 0;
      idleDurationRef.current = 2500 + Math.random() * 3000;
    }
    prevStateRef.current = w.state;

    const isRepairing = w.state === 'repairing';

    const ctr = containerRef.current;
    if (ctr) {
      ctr.x = posRef.current.x;
      ctr.y = posRef.current.y;
      ctr.zIndex = posRef.current.y; // Layering depth based on Y-position
      // Do NOT flip scale.x anymore! The sprite sheet has dedicated left/right views.
    }

    // ── Update worker sprite texture ONLY when frame/facing/repairing changes ──
    const frameChanged      = animRef.current.frame !== prevFrameRef.current;
    const repairingChanged  = isRepairing !== prevRepairingRef.current;
    
    if ((frameChanged || repairingChanged || animRef.current.facing !== (spriteRefData.current ?? '')) && spriteReady) {
      prevFrameRef.current     = animRef.current.frame;
      prevRepairingRef.current = isRepairing;
      spriteRefData.current    = animRef.current.facing;
      
      if (bodySpriteRef.current) {
        const tex = getWorkerTexture(workerVariant, animRef.current.facing, animRef.current.frame, isRepairing);
        if (tex) bodySpriteRef.current.texture = tex;
      }
    }

    // ── Progress bar: only draw when repairing ──────────────────
    const bar = barGfxRef.current;
    if (bar) {
      if (isRepairing) {
        const W = 36, H = 6;
        const bx = -W / 2;
        const by = -34;
        bar.clear();
        bar.rect(bx, by, W, H);          bar.fill({ color: 0x1A1A1A, alpha: 0.8 });
        const fw = Math.max(1, (progressRef.current / 100) * W);
        const fc = progressRef.current < 40 ? 0xEF4444 : progressRef.current < 75 ? 0xF59E0B : 0x22C55E;
        bar.rect(bx, by, fw, H);         bar.fill({ color: fc, alpha: 0.95 });
        bar.rect(bx, by, W, H);          bar.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.15 });
      } else {
        bar.clear();
      }
    }

    // ────────────────────────────────────────────────────────────
    // STATE: REPAIRING
    // ────────────────────────────────────────────────────────────
    if (isRepairing) {
      const job = assignedJobKey
        ? useRepairStore.getState().jobs[assignedJobKey]
        : null;

      if (!job) {
        updateWorkerState(id, 'patrolling', null);
        return;
      }

      repairElapsedRef.current += dt;
      progressRef.current = Math.min(100, (repairElapsedRef.current / job.duration) * 100);

      // Throttled store sync for panel UI only (500ms)
      progressSyncTimerRef.current += dt;
      if (progressSyncTimerRef.current > 500) {
        progressSyncTimerRef.current = 0;
        updateProgress(job.machineId, progressRef.current);
      }

      // Tool-bob animation
      walkTimerRef.current += dt;
      if (walkTimerRef.current > 280) {
        walkTimerRef.current = 0;
        animRef.current.frame = animRef.current.frame === 0 ? 1 : 0;
      }

      // Repair complete
      if (progressRef.current >= 100) {
        updateProgress(job.machineId, 100);
        repairElapsedRef.current    = 0;
        progressRef.current         = 0;
        progressSyncTimerRef.current = 0;
        releaseWorker(id, job.machineId);
      }
      return;
    }

    repairElapsedRef.current = 0;
    progressRef.current      = 0;

    // ────────────────────────────────────────────────────────────
    // STATE: MOVING
    // ────────────────────────────────────────────────────────────
    if (w.state === 'patrolling' || w.state === 'dispatched' || w.state === 'returning') {
      if (!w.targetPosition && w.state === 'patrolling') {
        const b = ZONE_BOUNDS[w.zone as keyof typeof ZONE_BOUNDS] ?? ZONE_BOUNDS.B;
        updateWorkerState(id, 'patrolling', {
          x: b.minX + Math.random() * (b.maxX - b.minX),
          y: b.minY + Math.random() * (b.maxY - b.minY),
        });
        return;
      }

      if (w.targetPosition) {
        const dx = w.targetPosition.x - posRef.current.x;
        const dy = w.targetPosition.y - posRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 6) {
          animRef.current.frame = 0;
          walkTimerRef.current  = 0;
          workerPositionCache.set(id, { ...posRef.current });
          if (w.state === 'patrolling') {
            updateWorkerState(id, 'idle', null);          // null clears targetPosition
          } else if (w.state === 'dispatched') {
            updateWorkerState(id, 'repairing', null);
          } else if (w.state === 'returning') {
            updateWorkerState(id, 'patrolling', null);
          }
          return;
        }

        const step = WORKER_SPEED * dt;
        posRef.current.x += (dx / dist) * Math.min(step, dist);
        posRef.current.y += (dy / dist) * Math.min(step, dist);
        animRef.current.facing = dx > 0 ? 'right' : 'left';

        walkTimerRef.current += dt;
        
        // Bouncing logic while walking
        const bouncePercent = (walkTimerRef.current % w.frameInterval) / w.frameInterval;
        const bounceOffset = Math.sin(bouncePercent * Math.PI) * -6; // jumps up 6px
        if (bodySpriteRef.current) {
          bodySpriteRef.current.y = -20 + bounceOffset;
        }
        shadowScale.current = 1 - (bounceOffset / -12); // slightly shrink shadow while up
        
        if (shadowGfxRef.current) {
          const sg = shadowGfxRef.current;
          sg.clear();
          sg.ellipse(0, 0, 14 * shadowScale.current, 5 * shadowScale.current);
          sg.fill({ color: 0x000000, alpha: 0.35 });
        }

        if (walkTimerRef.current > w.frameInterval) {
          walkTimerRef.current = 0;
          const nf = animRef.current.frame === 0 ? 1 : animRef.current.frame === 1 ? 2 : 0;
          animRef.current.frame = nf as 0|1|2;
          // Update position cache (used by dispatcher for distance calc)
          workerPositionCache.set(id, { ...posRef.current });
        }
      }
      return;
    }

    // ────────────────────────────────────────────────────────────
    // STATE: IDLE
    // ────────────────────────────────────────────────────────────
    // Reset bounce in idle/repair
    if (bodySpriteRef.current && bodySpriteRef.current.y !== -20) {
      bodySpriteRef.current.y = -20;
    }
    if (shadowGfxRef.current && shadowScale.current !== 1) {
      shadowScale.current = 1;
      const sg = shadowGfxRef.current;
      sg.clear();
      sg.ellipse(0, 0, 14, 5);
      sg.fill({ color: 0x000000, alpha: 0.35 });
    }

    if (w.state === 'idle') {
      idleTimerRef.current += dt;
      if (idleTimerRef.current >= idleDurationRef.current) {
        idleTimerRef.current = 0;
        updateWorkerState(id, 'patrolling', null);
      } else {
        // Occasional glance — only toggle facing, no store write
        const slot = Math.floor(idleTimerRef.current / 1800);
        const prevSlot = Math.floor((idleTimerRef.current - dt) / 1800);
        if (slot !== prevSlot) {
          animRef.current.facing = Math.random() > 0.5 ? 'left' : 'right';
        }
      }
    }
  });

  if (!workerZone) return null;

  return (
    <pixiContainer ref={containerRef} x={posRef.current.x} y={posRef.current.y}>
      <pixiGraphics ref={shadowGfxRef} draw={(g) => { g.clear(); g.ellipse(0, 0, 14, 5); g.fill({ color: 0x000000, alpha: 0.35 }); }} />
      <pixiSprite ref={bodySpriteRef} anchor={0.5} y={-20} width={52} height={52} />
      <pixiGraphics ref={barGfxRef}  draw={() => {}} />
    </pixiContainer>
  );
}

// ── WorkerSystem — zone-scoped container ────────────────────────
export default function WorkerSystem({ zone }: { zone: string }) {
  const workerIds = useWorkerStore(
    useShallow((s) =>
      Object.keys(s.workers).filter((id) => s.workers[id].zone === zone)
    )
  );

  return (
    <pixiContainer sortableChildren={true}>
      {workerIds.map((id) => <WorkerNode key={id} id={id} />)}
    </pixiContainer>
  );
}
