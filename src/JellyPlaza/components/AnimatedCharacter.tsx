import { useEffect, useRef, useCallback, useState } from 'react';
import type { CharacterConfig } from '../types';
import './AnimatedCharacter.less';

interface Props {
  config: CharacterConfig;
  onPoke: (id: string) => void;
  isActive: boolean;
}

/** Tags that participate in the blink animation */
const BLINK_TAGS = new Set([
  'eyelash-r', 'eyelash-l',
  'eyewhite-r', 'eyewhite-l',
  'irides-r', 'irides-l',
]);

export function AnimatedCharacter({ config, onPoke, isActive }: Props) {
  const blinkRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  const blinkTimer = useRef<number>(0);
  const [showBubble, setShowBubble] = useState(false);
  const bubbleTimeout = useRef<number>(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const pokeTimers = useRef<number[]>([]);

  const setBlinkRef = useCallback((id: string) => (el: HTMLImageElement | null) => {
    if (el) blinkRefs.current.set(id, el);
    else blinkRefs.current.delete(id);
  }, []);

  // ── Idle blink ──
  const blink = useCallback(() => {
    const refs = blinkRefs.current;
    refs.forEach((el, id) => {
      if (id.startsWith('eyelash')) {
        el.style.transition = 'transform 70ms ease-in';
        el.style.transform = 'scaleY(0.05)';
      } else {
        el.style.transition = 'opacity 50ms';
        el.style.opacity = '0';
      }
    });
    setTimeout(() => {
      refs.forEach((el, id) => {
        if (id.startsWith('eyelash')) {
          el.style.transition = 'transform 120ms ease-out';
          el.style.transform = 'scaleY(1)';
        } else {
          el.style.transition = 'opacity 80ms 30ms';
          el.style.opacity = '1';
        }
      });
      blinkTimer.current = window.setTimeout(blink, 2500 + Math.random() * 3500);
    }, 150);
  }, []);

  useEffect(() => {
    blinkTimer.current = window.setTimeout(blink, 1000 + Math.random() * 2000);
    return () => clearTimeout(blinkTimer.current);
  }, [blink]);

  // ── Helper: schedule a callback and track it for cleanup ──
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    pokeTimers.current.push(id);
    return id;
  }, []);

  // ── Poke reaction ──
  const triggerPokeReaction = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Clear any ongoing poke timers
    pokeTimers.current.forEach(clearTimeout);
    pokeTimers.current = [];

    const refs = blinkRefs.current;
    const getLayer = (tag: string) =>
      stage.querySelector<HTMLElement>(`.jp-layer[data-tag="${tag}"]`);

    // ── Phase 1: Surprise (0-100ms) ──
    // Quick blink (surprise reflex)
    refs.forEach((el, id) => {
      if (id.startsWith('eyelash')) {
        el.style.transition = 'transform 50ms ease-in';
        el.style.transform = 'scaleY(0.05)';
      } else {
        el.style.transition = 'opacity 40ms';
        el.style.opacity = '0';
      }
    });

    // Upper body dips down (startled squat)
    stage.querySelectorAll<HTMLElement>('.jp-zone--torso, .jp-zone--head, .jp-zone--hair, .jp-zone--arms').forEach(el => {
      el.style.transition = 'transform 120ms cubic-bezier(0.25, 0, 0.6, 1)';
      const tag = el.dataset.tag || '';
      if (tag === 'topwear' || tag === 'neck' || tag === 'neckwear' || tag === 'objects') {
        el.style.transform = 'translateY(12px)';
      } else if (tag.includes('hair')) {
        el.style.transform = 'translateY(8px) translateX(2px)';
      } else if (tag.startsWith('handwear')) {
        el.style.transform = 'translateY(10px) rotate(-2deg)';
      } else {
        el.style.transform = 'translateY(10px)';
      }
    });

    // ── Phase 2: Eyes wide open + bounce up (100-300ms) ──
    later(() => {
      refs.forEach((el, id) => {
        if (id.startsWith('eyelash')) {
          el.style.transition = 'transform 80ms ease-out';
          el.style.transform = 'scaleY(1.1)';
        } else if (id.startsWith('eyewhite') || id.startsWith('irides')) {
          el.style.transition = 'transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 80ms';
          el.style.opacity = '1';
          el.style.transform = 'scale(1.3)';  // wide surprised eyes
        }
      });

      // Bounce up past neutral (overshoot)
      stage.querySelectorAll<HTMLElement>('.jp-zone--torso, .jp-zone--head, .jp-zone--hair, .jp-zone--arms').forEach(el => {
        el.style.transition = 'transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        const tag = el.dataset.tag || '';
        if (tag === 'topwear' || tag === 'neck' || tag === 'neckwear' || tag === 'objects') {
          el.style.transform = 'translateY(-18px) translateX(2px)';
        } else if (tag.includes('hair')) {
          el.style.transform = 'translateY(-22px) translateX(-3px)';
        } else if (tag === 'handwear-r') {
          // Right hand waves up
          el.style.transform = 'translateY(-24px) rotate(8deg)';
        } else if (tag === 'handwear-l') {
          el.style.transform = 'translateY(-16px) rotate(-3deg)';
        } else {
          // Head layers
          el.style.transform = 'translateY(-16px) translateX(3px)';
        }
      });
    }, 120);

    // ── Phase 3: Hand wave (300-600ms) ──
    later(() => {
      const handR = getLayer('handwear-r');
      if (handR) {
        handR.style.transition = 'transform 180ms ease-in-out';
        handR.style.transform = 'translateY(-20px) rotate(-5deg)';
      }
    }, 350);

    later(() => {
      const handR = getLayer('handwear-r');
      if (handR) {
        handR.style.transition = 'transform 180ms ease-in-out';
        handR.style.transform = 'translateY(-22px) rotate(6deg)';
      }
    }, 530);

    // ── Phase 4: Settle back to neutral (600-1000ms) ──
    later(() => {
      // Eyes back to normal size
      refs.forEach((el, id) => {
        if (id.startsWith('eyelash')) {
          el.style.transition = 'transform 300ms ease-in-out';
          el.style.transform = 'scaleY(1)';
        } else if (id.startsWith('eyewhite') || id.startsWith('irides')) {
          el.style.transition = 'transform 400ms ease-in-out';
          el.style.transform = 'scale(1)';
        }
      });

      // All layers ease back (CSS breathing will resume)
      stage.querySelectorAll<HTMLElement>('.jp-zone--torso, .jp-zone--head, .jp-zone--hair, .jp-zone--arms').forEach(el => {
        el.style.transition = 'transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        el.style.transform = '';
      });
    }, 700);

    // ── Cleanup: remove inline styles so CSS animations resume ──
    later(() => {
      refs.forEach((el) => {
        el.style.transition = '';
        el.style.transform = '';
        el.style.opacity = '';
      });
      stage.querySelectorAll<HTMLElement>('.jp-zone--torso, .jp-zone--head, .jp-zone--hair, .jp-zone--arms').forEach(el => {
        el.style.transition = '';
        el.style.transform = '';
      });
    }, 1200);
  }, [later]);

  const handlePoke = useCallback(() => {
    onPoke(config.id);
    triggerPokeReaction();
    clearTimeout(bubbleTimeout.current);
    setShowBubble(true);
    bubbleTimeout.current = window.setTimeout(() => setShowBubble(false), 3000);
  }, [config.id, onPoke, triggerPokeReaction]);

  const layerBase = `${import.meta.env.BASE_URL}layers/${config.id}/`;

  return (
    <div
      className={`jp-char ${isActive ? 'jp-char--active' : ''}`}
      style={{
        left: `${config.x}%`,
        top: `${config.y}%`,
        '--char-scale': config.scale,
      } as React.CSSProperties}
      onPointerDown={handlePoke}
    >
      {/* Chat bubble */}
      <div className="jp-char__bubble-wrap">
        <div className={`jp-char__bubble ${showBubble ? 'jp-char__bubble--show' : ''}`}>
          <span>{config.greeting}</span>
          <div className="jp-char__bubble-tail" />
        </div>
      </div>

      {/* Layer stage */}
      <div
        className="jp-char__stage"
        ref={stageRef}
        style={{ width: config.stageSize, height: config.stageSize }}
      >
        {config.layers.map((layer) => (
          <img
            key={layer.tag}
            ref={BLINK_TAGS.has(layer.tag) ? setBlinkRef(layer.tag) : undefined}
            data-tag={layer.tag}
            src={layerBase + layer.file}
            className={`jp-layer ${layer.cssClass || ''}`}
            draggable={false}
            style={{
              left: layer.left,
              top: layer.top,
              width: layer.width,
              height: layer.height,
            }}
          />
        ))}
      </div>

      {/* Name + status badge */}
      <div className="jp-char__info">
        <span className="jp-char__name">{config.name}</span>
        <div className="jp-char__status">
          <span className="jp-char__status-dot" />
          <span>{config.statusEmoji} {config.status}</span>
        </div>
      </div>
    </div>
  );
}
