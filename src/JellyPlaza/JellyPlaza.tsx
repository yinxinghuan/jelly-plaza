import { useState, useCallback } from 'react';
import { AnimatedCharacter } from './components/AnimatedCharacter';
import { CHARACTERS } from './characters';
import './JellyPlaza.less';

export function JellyPlaza() {
  const [activeChar, setActiveChar] = useState<string | null>(null);

  const handlePoke = useCallback((id: string) => {
    setActiveChar(id);
  }, []);

  return (
    <div className="jp">
      {/* Background gradient overlay */}
      <div className="jp__bg" />

      {/* Ambient particles */}
      <div className="jp__particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="jp__particle" style={{
            left: `${10 + Math.random() * 80}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 6}s`,
            opacity: 0.15 + Math.random() * 0.2,
            width: 3 + Math.random() * 4,
            height: 3 + Math.random() * 4,
          }} />
        ))}
      </div>

      {/* Header */}
      <div className="jp__header">
        <div className="jp__title">Plaza</div>
        <div className="jp__online">
          <span className="jp__online-dot" />
          {CHARACTERS.length} online
        </div>
      </div>

      {/* Plaza area with characters */}
      <div className="jp__plaza">
        {CHARACTERS.map((char) => (
          <AnimatedCharacter
            key={char.id}
            config={char}
            onPoke={handlePoke}
            isActive={activeChar === char.id}
          />
        ))}
      </div>

      {/* Bottom nav bar */}
      <div className="jp__nav">
        <div className="jp__nav-item jp__nav-item--active">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
          <span>Plaza</span>
        </div>
        <div className="jp__nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
          <span>Chat</span>
        </div>
        <div className="jp__nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
          <span>Me</span>
        </div>
      </div>

      {/* Watermark */}
      <img src={`${import.meta.env.BASE_URL}img/aigram.svg`} className="jp__watermark" draggable={false} />
    </div>
  );
}
