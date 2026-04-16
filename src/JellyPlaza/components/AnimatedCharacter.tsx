import { useEffect, useRef, useCallback } from 'react';
import type { CharacterConfig } from '../types';
import './AnimatedCharacter.less';

interface Props {
  config: CharacterConfig;
  onPoke: (id: string) => void;
}

const BLINK_TAGS = new Set([
  'eyelash-r', 'eyelash-l',
  'eyewhite-r', 'eyewhite-l',
  'irides-r', 'irides-l',
]);

export function AnimatedCharacter({ config, onPoke }: Props) {
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

    // Kill breathing + pause idle blink (blink scaleY would overwrite zone translateY)
    char.classList.add('jp-char--poking');
    clearTimeout(blinkTimer.current);

    // Show bubble (DOM only, no setState)
    bubbleRef.current?.classList.add('jp-char__bubble--show');
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => {
      bubbleRef.current?.classList.remove('jp-char__bubble--show');
    }, 3000);

    // ── Phase 1: Surprise dip (0-120ms) ──
    // Reset any mid-blink state on eyelashes, hide eyewhite/irides
    refs.forEach((el, id) => {
      if (id.startsWith('eyelash')) {
        el.style.transition = '';
        el.style.transform = '';
      } else if (id.startsWith('eyewhite') || id.startsWith('irides')) {
        el.style.transition = 'opacity 40ms';
        el.style.opacity = '0';
      }
    });
    // All zones dip down together
    const armR = stage.querySelector<HTMLElement>('.jp-arm-wrap[data-tag="handwear-r"] .jp-arm__img');
    const armL = stage.querySelector<HTMLElement>('.jp-arm-wrap[data-tag="handwear-l"] .jp-arm__img');
    zones.forEach(el => {
      el.style.transition = 'transform 80ms cubic-bezier(0.25, 0, 0.6, 1)';
      el.style.transform = 'translateY(4px)';
    });

    // ── Phase 2: Big bounce up + arms swing wide (80-350ms) ──
    later(() => {
      refs.forEach((el, id) => {
        if (id.startsWith('eyewhite') || id.startsWith('irides')) {
          el.style.transition = 'transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 60ms';
          el.style.opacity = '1';
          el.style.transform = 'scale(1.5)';
        }
      });
      zones.forEach(el => {
        el.style.transition = 'transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.transform = 'translateY(-70px)';
      });
      // Right arm swings wide, left arm gentle
      if (armR) {
        armR.style.transition = 'transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        armR.style.transform = 'rotate(22deg)';
      }
      if (armL) {
        armL.style.transition = 'transform 350ms ease-out';
        armL.style.transform = 'rotate(-12deg)';
      }
    }, 80);

    // ── Phase 3: Right hand wave, left sways back gently ──
    // Wave 1: big + slow (enthusiastic start)
    later(() => {
      if (armR) {
        armR.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
        armR.style.transform = 'rotate(-25deg)';
      }
      if (armL) {
        armL.style.transition = 'transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        armL.style.transform = 'rotate(-20deg)';
      }
    }, 350);
    // Wave 2: swing back
    later(() => {
      if (armR) {
        armR.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
        armR.style.transform = 'rotate(20deg)';
      }
    }, 630);
    // Wave 3: smaller + faster (natural deceleration)
    later(() => {
      if (armR) {
        armR.style.transition = 'transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        armR.style.transform = 'rotate(-14deg)';
      }
      if (armL) {
        armL.style.transition = 'transform 350ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        armL.style.transform = 'rotate(-12deg)';
      }
    }, 890);
    // Wave 4: smallest (winding down)
    later(() => {
      if (armR) {
        armR.style.transition = 'transform 200ms ease-out';
        armR.style.transform = 'rotate(8deg)';
      }
    }, 1110);

    // ── Phase 4: Settle (1300ms) ──
    later(() => {
      refs.forEach((el, id) => {
        if (id.startsWith('eyewhite') || id.startsWith('irides')) {
          el.style.transition = 'transform 400ms ease-in-out';
          el.style.transform = 'scale(1)';
        }
      });
      zones.forEach(el => {
        el.style.transition = 'transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        el.style.transform = 'translateY(0)';
      });
      if (armR) {
        armR.style.transition = 'transform 400ms ease-in-out';
        armR.style.transform = 'rotate(0deg)';
      }
      if (armL) {
        armL.style.transition = 'transform 500ms ease-in-out';
        armL.style.transform = 'rotate(0deg)';
      }
    }, 1300);

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
      stage.querySelectorAll<HTMLElement>('.jp-arm__img').forEach(img => {
        img.style.transition = '';
        img.style.transform = '';
      });
      char.classList.remove('jp-char--poking');
      // Resume idle blink
      blinkTimer.current = window.setTimeout(blink, 800 + Math.random() * 1500);
    }, 1900);
  }, [later]);

  const handlePoke = useCallback(() => {
    onPoke(config.id);
    triggerPokeReaction();
  }, [config.id, onPoke, triggerPokeReaction]);

  const layerBase = `${import.meta.env.BASE_URL}layers/${config.id}/`;

  return (
    <div
      className="jp-char"
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
          if (isArm) {
            // Wrapper: positioned + zone breathing (translateY follows body)
            // Inner img: rotate from detected shoulder pivot
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
                <img
                  data-tag={layer.tag}
                  src={layerBase + layer.file}
                  className="jp-arm__img"
                  draggable={false}
                  style={{
                    width: layer.width,
                    height: layer.height,
                    transformOrigin: layer.pivot
                      ? `${layer.pivot.x}% ${layer.pivot.y}%`
                      : '50% 0%',
                  }}
                />
              </div>
            );
          }
          return (
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
          );
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
