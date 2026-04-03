import { extend } from '@pixi/react';
import { Graphics } from 'pixi.js';
import { useMachineStore } from '../store/machineStore';
import { useShallow } from 'zustand/react/shallow';
import { useCallback } from 'react';

extend({ Graphics });

export default function PipeSystem() {
  // useShallow for stable references — avoids infinite getSnapshot loop
  const pipes = useMachineStore(useShallow((state) => state.pipes));
  const machines = useMachineStore(useShallow((state) => state.machines));

  const draw = useCallback(
    (g: Graphics) => {
      g.clear();

      pipes.forEach((pipe) => {
        const fromMac = machines[pipe.from];
        const toMac = machines[pipe.to];
        if (!fromMac || !toMac) return;

        let color = 0x8A8078; // warm grey default
        if (fromMac.status === 'critical') color = 0x9A4040;
        else if (fromMac.status === 'watch') color = 0xA08040;
        else if (fromMac.status === 'isolated') color = 0xC0BCB8;

        g.moveTo(fromMac.position.x, fromMac.position.y);

        if (pipe.points?.length > 0) {
          pipe.points.forEach((pt) => g.lineTo(pt.x, pt.y));
        }

        g.lineTo(toMac.position.x, toMac.position.y);
        g.stroke({ width: 4, color });
      });
    },
    [pipes, machines]
  );

  return <pixiGraphics draw={draw} />;
}
