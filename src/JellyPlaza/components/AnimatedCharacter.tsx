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

/** Tags that bounce on poke (head zone) */
const HEAD_TAGS = new Set([
  'face', 'nose', 'mouth', 'front hair', 'back hair',
  'headwear', 'eyewear', 'eyebrow-r', 'eyebrow-l',
  'eyelash-r', 'eyelash-l', 'eyewhite-r', 'eyewhite-l',
  'irides-r', 'irides-l', 'ears-r', 'ears-l',
]);

export function AnimatedCharacter({ config, onPoke, isActive }: Props) {
  const blinkRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  const blinkTimer = useRef<number>(0);
  const [showBubble, setShowBubble] = useState(false);
  const [poked, setPoked] = useState(false);
  const bubbleTimeout = useRef<number>(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const setBlinkRef = useCallback((id: string) => (el: HTMLImageElement | null) => {
    if (el) blinkRefs.current.set(id, el);
    else blinkRefs.current.delete(id);
  }, []);

  // Blink: close both eyes simultaneously
  const blink = useCallback(() => {
    const refs = blinkRefs.current;

    // Close
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
      // Open
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

  // Poke reaction: per-layer animation via JS
  const triggerPokeReaction = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // 1. Quick surprised blink
    const refs = blinkRefs.current;
    refs.forEach((el, id) => {
      if (id.startsWith('eyelash')) {
        el.style.transition = 'transform 60ms ease-in';
        el.style.transform = 'scaleY(0.1)';
      } else if (id.startsWith('eyewhite') || id.startsWith('irides')) {
        // Eyes widen briefly
        el.style.transition = 'transform 100ms ease-out';
        el.style.transform = 'scale(1.15)';
      }
    });
    setTimeout(() => {
      refs.forEach((el, id) => {
        if (id.startsWith('eyelash')) {
          el.style.transition = 'transform 100ms ease-out';
          el.style.transform = 'scaleY(1)';
        } else if (id.startsWith('eyewhite') || id.startsWith('irides')) {
          el.style.transition = 'transform 150ms ease-out';
          el.style.transform = 'scale(1.2)'; // stay wide for a moment
        }
      });
    }, 80);
    // Return eyes to normal
    setTimeout(() => {
      refs.forEach((el, id) => {
        if (id.startsWith('eyewhite') || id.startsWith('irides')) {
          el.style.transition = 'transform 300ms ease-in-out';
          el.style.transform = 'scale(1)';
        }
      });
    }, 600);

    // 2. Head tilt via CSS class on head layers
    const layers = stage.querySelectorAll<HTMLElement>('.jp-layer');
    layers.forEach((el) => {
      const tag = el.dataset.tag;
      if (tag && HEAD_TAGS.has(tag)) {
        el.classList.add('jp-layer--poke-head');
      } else {
        el.classList.add('jp-layer--poke-body');
      }
    });
    setTimeout(() => {
      layers.forEach((el) => {
        el.classList.remove('jp-layer--poke-head', 'jp-layer--poke-body');
      });
    }, 700);
  }, []);

  const handlePoke = useCallback(() => {
    onPoke(config.id);
    setPoked(true);
    setTimeout(() => setPoked(false), 700);
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
        className={`jp-char__stage ${poked ? 'jp-char__stage--poked' : ''}`}
        ref={stageRef}
        style={{ width: config.stageSize, height: config.stageSize }}
      >
        {config.mode === 'single' && config.rawImage ? (
          <img
            src={config.rawImage}
            className="jp-layer jp-layer--single"
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          config.layers.map((layer) => (
            <img
              key={layer.tag}
              ref={BLINK_TAGS.has(layer.tag) ? setBlinkRef(layer.tag) : undefined}
              data-tag={layer.tag}
              src={layerBase + layer.file}
              className={`jp-layer ${layer.cssClass || ''} ${
                layer.tag.startsWith('eyelash') ? 'jp-layer--eyelash' : ''
              }`}
              draggable={false}
              style={{
                left: layer.left,
                top: layer.top,
                width: layer.width,
                height: layer.height,
              }}
            />
          ))
        )}
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
