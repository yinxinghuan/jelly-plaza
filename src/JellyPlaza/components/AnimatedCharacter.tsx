import { useEffect, useRef, useCallback, useState } from 'react';
import type { CharacterConfig } from '../types';
import './AnimatedCharacter.less';

interface Props {
  config: CharacterConfig;
  onPoke: (id: string) => void;
  isActive: boolean;
}

export function AnimatedCharacter({ config, onPoke, isActive }: Props) {
  const eyewhiteRef = useRef<HTMLImageElement>(null);
  const iridesRef = useRef<HTMLImageElement>(null);
  const eyelashRef = useRef<HTMLImageElement>(null);
  const blinkTimer = useRef<number>(0);
  const [showBubble, setShowBubble] = useState(false);
  const [pokeAnim, setPokeAnim] = useState(false);
  const bubbleTimeout = useRef<number>(0);

  // Blink logic (only for layered characters)
  const blink = useCallback(() => {
    const eyelash = eyelashRef.current;
    const eyewhite = eyewhiteRef.current;
    const irides = iridesRef.current;
    if (!eyelash || !eyewhite || !irides) return;

    eyelash.style.transition = 'transform 70ms ease-in';
    eyelash.style.transform = 'scaleY(0.05)';
    eyewhite.style.transition = 'opacity 50ms';
    eyewhite.style.opacity = '0';
    irides.style.transition = 'opacity 50ms';
    irides.style.opacity = '0';

    setTimeout(() => {
      eyelash.style.transition = 'transform 120ms ease-out';
      eyelash.style.transform = 'scaleY(1)';
      eyewhite.style.transition = 'opacity 80ms 30ms';
      eyewhite.style.opacity = '1';
      irides.style.transition = 'opacity 80ms 30ms';
      irides.style.opacity = '1';
      blinkTimer.current = window.setTimeout(blink, 2500 + Math.random() * 3500);
    }, 150);
  }, []);

  useEffect(() => {
    if (config.mode === 'layered') {
      blinkTimer.current = window.setTimeout(blink, 1000 + Math.random() * 2000);
    }
    return () => clearTimeout(blinkTimer.current);
  }, [blink, config.mode]);

  const handlePoke = useCallback(() => {
    onPoke(config.id);
    setPokeAnim(true);
    setTimeout(() => setPokeAnim(false), 600);
    clearTimeout(bubbleTimeout.current);
    setShowBubble(true);
    bubbleTimeout.current = window.setTimeout(() => setShowBubble(false), 3000);
  }, [config.id, onPoke]);

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

      {/* Character visual */}
      {config.mode === 'layered' ? (
        <div className="jp-char__stage" style={{ width: config.stageSize, height: config.stageSize }}>
          {config.layers.map((layer) => (
            <img
              key={layer.tag}
              ref={
                layer.id === 'eyewhite' ? eyewhiteRef :
                layer.id === 'irides' ? iridesRef :
                layer.id === 'eyelash' ? eyelashRef :
                undefined
              }
              src={`/layers/${config.id}/${layer.file}`}
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
      ) : (
        <div className="jp-char__single" style={{
          width: config.imageWidth,
          height: config.imageHeight,
        }}>
          <img
            src={config.image}
            className="jp-char__single-img"
            draggable={false}
          />
        </div>
      )}

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
