import { useEffect, useRef, useCallback } from 'react';
import type { CharacterConfig } from '../types';
import './AnimatedCharacter.less';

interface Props {
  config: CharacterConfig;
  onPoke: (id: string) => void;
  isActive: boolean;
}

const BLINK_TAGS = new Set([
  'eyelash-r', 'eyelash-l',
  'eyewhite-r', 'eyewhite-l',
  'irides-r', 'irides-l',
]);

export function AnimatedCharacter({ config, onPoke, isActive }: Props) {
  const blinkRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  const blinkTimer = useRef<number>(0);
  const charRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pokeTimers = useRef<number[]>([]);
  const bubbleTimer = useRef<number>(0);

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

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    pokeTimers.current.push(id);
    return id;
  }, []);

  // ── Poke reaction (100% DOM, zero React state) ──
  const triggerPokeReaction = useCallback(() => {
    const stage = stageRef.current;
    const char = charRef.current;
    if (!stage || !char) return;

    pokeTimers.current.forEach(clearTimeout);
    pokeTimers.current = [];

    const refs = blinkRefs.current;
    const zones = stage.querySelectorAll<HTMLElement>(
      '.jp-zone--torso, .jp-zone--head, .jp-zone--hair, .jp-zone--arms'
    );

    // Kill breathing (CSS class → animation: none !important)
    char.classList.add('jp-char--poking');

    // Show bubble (DOM only, no setState)
    bubbleRef.current?.classList.add('jp-char__bubble--show');
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => {
      bubbleRef.current?.classList.remove('jp-char__bubble--show');
    }, 3000);

    // Helper: get inner arm img
    const armImg = (tag: string) =>
      stage.querySelector<HTMLElement>(`.jp-arm-wrap[data-tag="${tag}"] .jp-arm__img`);

    // ── Phase 1: Surprise dip (0-120ms) ──
    // Quick blink
    refs.forEach((el, id) => {
      if (id.startsWith('eyewhite') || id.startsWith('irides')) {
        el.style.transition = 'opacity 40ms';
        el.style.opacity = '0';
      }
    });
    // All upper body dips down together (arms wrapper = same Y as torso)
    zones.forEach(el => {
      el.style.transition = 'transform 120ms cubic-bezier(0.25, 0, 0.6, 1)';
      const tag = el.dataset.tag || '';
      if (tag.includes('hair')) {
        el.style.transform = 'translateY(20px) translateX(4px)';
      } else {
        el.style.transform = 'translateY(30px)';
      }
    });
    // Arm inner: slight inward swing on dip
    [armImg('handwear-r'), armImg('handwear-l')].forEach(img => {
      if (img) {
        img.style.transition = 'transform 120ms ease';
        img.style.transform = 'rotate(-3deg)';
      }
    });

    // ── Phase 2: Bounce up (120-400ms) ──
    later(() => {
      // Eyes widen
      refs.forEach((el, id) => {
        if (id.startsWith('eyewhite') || id.startsWith('irides')) {
          el.style.transition = 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 80ms';
          el.style.opacity = '1';
          el.style.transform = 'scale(1.4)';
        }
      });
      // Body bounces up (arms wrapper = same Y as torso)
      zones.forEach(el => {
        el.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        const tag = el.dataset.tag || '';
        if (tag.includes('hair')) {
          el.style.transform = 'translateY(-55px) translateX(-5px)';
        } else {
          el.style.transform = 'translateY(-45px) translateX(3px)';
        }
      });
      // Arm inner: swing outward on bounce
      const rImg = armImg('handwear-r');
      if (rImg) {
        rImg.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        rImg.style.transform = 'rotate(14deg)';
      }
      const lImg = armImg('handwear-l');
      if (lImg) {
        lImg.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        lImg.style.transform = 'rotate(-6deg)';
      }
    }, 120);

    // ── Phase 3: Hand wave (400-700ms) — rotate the inner img ──
    later(() => {
      const img = armImg('handwear-r');
      if (img) {
        img.style.transition = 'transform 150ms ease-in-out';
        img.style.transform = 'rotate(-8deg)';
      }
    }, 400);
    later(() => {
      const img = armImg('handwear-r');
      if (img) {
        img.style.transition = 'transform 150ms ease-in-out';
        img.style.transform = 'rotate(12deg)';
      }
    }, 550);

    // ── Phase 4: Settle (700-1200ms) ──
    later(() => {
      refs.forEach((el, id) => {
        if (id.startsWith('eyewhite') || id.startsWith('irides')) {
          el.style.transition = 'transform 400ms ease-in-out';
          el.style.transform = 'scale(1)';
        }
      });
      // Wrappers back to neutral
      zones.forEach(el => {
        el.style.transition = 'transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        el.style.transform = 'translateY(0)';
      });
      // Arm imgs back to neutral
      [armImg('handwear-r'), armImg('handwear-l')].forEach(img => {
        if (img) {
          img.style.transition = 'transform 400ms ease-in-out';
          img.style.transform = 'rotate(0deg)';
        }
      });
    }, 700);

    // ── Cleanup: resume breathing ──
    later(() => {
      refs.forEach(el => {
        el.style.transition = '';
        el.style.transform = '';
        el.style.opacity = '';
      });
      zones.forEach(el => {
        el.style.transition = '';
        el.style.transform = '';
      });
      // Clear arm inner img inline styles
      stage.querySelectorAll<HTMLElement>('.jp-arm__img').forEach(img => {
        img.style.transition = '';
        img.style.transform = '';
      });
      char.classList.remove('jp-char--poking');
    }, 1300);
  }, [later]);

  const handlePoke = useCallback(() => {
    onPoke(config.id);
    triggerPokeReaction();
  }, [config.id, onPoke, triggerPokeReaction]);

  const layerBase = `${import.meta.env.BASE_URL}layers/${config.id}/`;

  return (
    <div
      className={`jp-char ${isActive ? 'jp-char--active' : ''}`}
      ref={charRef}
      style={{
        left: `${config.x}%`,
        top: `${config.y}%`,
        '--char-scale': config.scale,
      } as React.CSSProperties}
      onPointerDown={handlePoke}
    >
      {/* Chat bubble — toggled via DOM classList, not React state */}
      <div className="jp-char__bubble-wrap">
        <div className="jp-char__bubble" ref={bubbleRef}>
          <span>{config.greeting}</span>
          <div className="jp-char__bubble-tail" />
        </div>
      </div>

      <div
        className="jp-char__stage"
        ref={stageRef}
        style={{ width: config.stageSize, height: config.stageSize }}
      >
        {config.layers.map((layer) => {
          const isArm = layer.tag.startsWith('handwear');
          const img = (
            <img
              key={isArm ? undefined : layer.tag}
              ref={BLINK_TAGS.has(layer.tag) ? setBlinkRef(layer.tag) : undefined}
              data-tag={layer.tag}
              src={layerBase + layer.file}
              className={`jp-layer ${isArm ? 'jp-arm__img' : ''} ${layer.cssClass || ''}`}
              draggable={false}
              style={isArm ? { width: layer.width, height: layer.height } : {
                left: layer.left,
                top: layer.top,
                width: layer.width,
                height: layer.height,
              }}
            />
          );
          if (isArm) {
            // Wrapper: positioned + zone breathing (translateY)
            // Inner img: rotate from shoulder pivot
            return (
              <div
                key={layer.tag}
                className={`jp-layer jp-arm-wrap ${layer.cssClass || ''}`}
                data-tag={layer.tag}
                style={{
                  left: layer.left,
                  top: layer.top,
                  width: layer.width,
                  height: layer.height,
                }}
              >
                {img}
              </div>
            );
          }
          return img;
        })}
      </div>

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
