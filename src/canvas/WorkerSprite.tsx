import { useCallback, useRef } from 'react';
import { Graphics, Container } from 'pixi.js';
import { extend } from '@pixi/react';
import type { WorkerVariant } from '../store/workerStore';

extend({ Graphics, Container });

interface WorkerSpriteProps {
  id: string;
  variant: WorkerVariant;
  frame: 0 | 1 | 2;
  facing: 'left' | 'right';
  x: number;
  y: number;
  repairing?: boolean;
}

type VariantConfig = {
  hat: number | null;
  shirt: number;
  pants: number;
  boots: number;
  accessory: number | null;
  hair: number | null;
  scale?: number;
};

const VARIANTS: Record<WorkerVariant, VariantConfig> = {
  A: { hat: 0xFACC15, shirt: 0x3B82F6, pants: 0x1E3A8A, boots: 0x111111, accessory: null, hair: null },
  B: { hat: 0xF8FAFC, shirt: 0xF97316, pants: 0x475569, boots: 0x78350F, accessory: 0x94A3B8, hair: null },
  C: { hat: 0xEF4444, shirt: 0x22C55E, pants: 0xD4D4D8, boots: 0x111111, accessory: null, hair: null, scale: 1.15 },
  D: { hat: null,     shirt: 0x64748B, pants: 0x475569, boots: 0x334155, accessory: 0xCA8A04, hair: 0x1E293B },
  E: { hat: 0x2563EB, shirt: 0xF1F5F9, pants: 0x1E3A8A, boots: 0x111111, accessory: 0x334155, hair: null },
};

export default function WorkerSprite({ variant, frame, facing, x, y, repairing }: WorkerSpriteProps) {
  const containerRef = useRef<Container>(null);
  const cfg = VARIANTS[variant];
  
  const drawWorker = useCallback((g: Graphics) => {
    g.clear();
    
    // Scale for supervisor
    const s = cfg.scale || 1.0;
    
    // Base outlines and offsets
    const hw = 8 * s;
    const hh = 12 * s;
    const legW = 6 * s;
    const legH = 8 * s;

    // Body (shirt)
    g.rect(-hw, -hh + (4 * s), hw * 2, hh);
    g.fill({ color: cfg.shirt });
    g.stroke({ width: 1, color: 0x111111 });

    // Accessory (Technician's inner shirt, Maintenance tool belt, Engineer tie)
    if (variant === 'B' && cfg.accessory) {
      g.rect(-hw + 2, -hh + 5, 8, 8); // grey inner shirt peaking
      g.fill({ color: cfg.accessory });
    } else if (variant === 'D' && cfg.accessory) { // toolbelt
      g.rect(-hw - 1, hh - 6, hw * 2 + 2, 4);
      g.fill({ color: cfg.accessory });
    } else if (variant === 'E' && cfg.accessory) { // tie
      g.rect(-1 * s, -hh + 5 * s, 2 * s, 8 * s);
      g.fill({ color: cfg.accessory });
    }
    
    // Legs based on animation frame
    // Legs start right below body (at y = hh/2 approx)
    let leftLegY = hh;
    let rightLegY = hh;
    let leftLegX = -hw + 1;
    let rightLegX = 1;

    if (frame === 1) { // Left leg forward/up
      leftLegY = hh - 2;
    } else if (frame === 2) { // Right leg forward/up
      rightLegY = hh - 2;
    }

    // Left Leg
    g.rect(leftLegX, leftLegY, legW, legH);
    g.fill({ color: cfg.pants });
    g.stroke({ width: 1, color: 0x111111 });
    // Left Boot
    g.rect(leftLegX - 1, leftLegY + legH, legW + 2, 4);
    g.fill({ color: cfg.boots });

    // Right Leg
    g.rect(rightLegX, rightLegY, legW, legH);
    g.fill({ color: cfg.pants });
    g.stroke({ width: 1, color: 0x111111 });
    // Right Boot
    g.rect(rightLegX - 1, rightLegY + legH, legW + 2, 4);
    g.fill({ color: cfg.boots });
    
    // Head (Skin + Face)
    const headSize = 12 * s;
    g.circle(0, -hh - (headSize / 2), headSize / 2 + 2);
    g.fill({ color: 0xFCD34D }); // Pale skin tone
    g.stroke({ width: 1, color: 0x111111 });

    // Hat / Hair
    if (cfg.hat !== null) {
      // Hard hat
      g.rect(-headSize / 2 - 2, -hh - headSize, headSize + 4, headSize / 2 + 2);
      g.fill({ color: cfg.hat });
      g.stroke({ width: 1, color: 0x111111 });
      // Hat brim
      g.rect(-headSize / 2 - 4, -hh - headSize / 2 - 2, headSize + 8, 3);
      g.fill({ color: cfg.hat });
      g.stroke({ width: 1, color: 0x111111 });
    } else if (cfg.hair !== null) {
      // Small hair
      g.roundRect(-headSize / 2 - 2, -hh - headSize, headSize + 4, headSize / 2, 2);
      g.fill({ color: cfg.hair });
    }
    
    // Idle Tool/clipboard holding check (handled if frame is 0 or repairing state)
    // Could draw a small wrench or clipboard if variants D or E and frame is 0
    if (repairing) {
      // Wrench icon (small rectangle + circle = simplified wrench)
      g.rect(-hw - 8, -hh + 4, 5, 10);
      g.fill({ color: 0xB45309 });
      g.stroke({ width: 1, color: 0x111111 });
      g.circle(-hw - 5.5, -hh + 4, 4);
      g.fill({ color: 0x92400E });
    } else if (frame === 0 && variant === 'E') {
      // Clipboard
      g.rect(-hw - 6, -hh + 6, 8, 12);
      g.fill({ color: 0xE2E8F0 });
      g.stroke({ width: 1, color: 0x334155 });
    }

  }, [cfg, frame, variant, repairing]);

  // Flip Sprite Horizontally based on facing direction
  // But wait, since it's an isometric/top-down 2D, flipping scale.x works
  const scaleX = facing === 'left' ? -1 : 1;

  return (
    <pixiContainer ref={containerRef} x={x} y={y} scale={{ x: scaleX, y: 1 }}>
      <pixiGraphics draw={drawWorker} />
    </pixiContainer>
  );
}
