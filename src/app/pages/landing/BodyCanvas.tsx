import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { es } from '@/i18n/es';
import { Button } from '@/ui/shadcn/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/shadcn/tooltip';
import type { BodyScene, BodySceneOptions } from './art/bodyScene';
import { prefersReducedMotion } from './reducedMotion';

/**
 * Canvas with the 3D human body. The mesh (built in a worker) and the scene code load on demand,
 * after the page is interactive. Hands the scene to `onScene` so a scroll story can drive it, and
 * shows a visible pause control for the looping motion.
 */
export function BodyCanvas({
  mode,
  label,
  className,
  onScene,
}: {
  mode: BodySceneOptions['mode'];
  label: string;
  className?: string;
  onScene?: (scene: BodyScene | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BodyScene | null>(null);
  const [reduced] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(!reduced);
  const [ready, setReady] = useState(false);
  const onSceneRef = useRef(onScene);
  useEffect(() => {
    onSceneRef.current = onScene;
  }, [onScene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    let cancelled = false;
    void Promise.all([import('./art/bodyScene'), import('./art/bodyMesh').then(({ loadBodyMesh }) => loadBodyMesh())]).then(
      ([{ createBodyScene }, mesh]) => {
        if (cancelled) return;
        sceneRef.current = createBodyScene(canvas, { reducedMotion: reduced, mode, mesh });
        setReady(sceneRef.current !== null);
        onSceneRef.current?.(sceneRef.current);
      },
    );
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      onSceneRef.current?.(null);
    };
  }, [reduced, mode]);

  const toggle = () => {
    const next = !playing;
    setPlaying(next);
    sceneRef.current?.setPlaying(next);
  };

  const action = playing ? es.landing.scene.pause : es.landing.scene.play;
  return (
    <div className={['lp-canvas', className].filter(Boolean).join(' ')} data-ready={ready || undefined}>
      <canvas ref={canvasRef} className="lp-canvas__surface" role="img" aria-label={label} />
      {reduced || !ready ? null : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="lp-canvas__pause" aria-label={action} onClick={toggle}>
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{action}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
