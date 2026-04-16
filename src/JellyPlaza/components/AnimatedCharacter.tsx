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
  const [pokeAnim, setPokeAnim] = useState(false);
  const bubbleTimeout = useRef<number>(0);

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

  const handlePoke = useCallback(() => {
    onPoke(config.id);
    setPokeAnim(true);
    setTimeout(() => setPokeAnim(false), 600);
    clearTimeout(bubbleTimeout.current);
    setShowBubble(true);
    bubbleTimeout.current = window.setTimeout(() => setShowBubble(false), 3000);
  }, [config.id, onPoke]);

  const layerBase = `${import.meta.env.BASE_URL}layers/${config.id}/`;

  return (
    <div
      className={`jp-char ${isActive ? 'jp-char--active' : ''} ${pokeAnim ? 'jp-char--poke' : ''}`}
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
      <div className="jp-char__stage" style={{ width: config.stageSize, height: config.stageSize }}>
        {config.layers.map((layer) => (
          <img
            key={layer.tag}
            ref={BLINK_TAGS.has(layer.tag) ? setBlinkRef(layer.tag) : undefined}
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
