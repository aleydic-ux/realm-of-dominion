import { useState, useRef, useCallback } from 'react';

/**
 * Tooltip using fixed positioning + viewport clamping — never clips off-screen.
 * Shows above by default; flips below if not enough room.
 */
export default function Tooltip({ content, children, width = 220 }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, flipped: false });
  const triggerRef = useRef(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 8;
    const tooltipW = Math.min(width, window.innerWidth - 16);
    const estimatedH = 80;

    let left = rect.left + rect.width / 2 - tooltipW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));

    let flipped = false;
    let top;
    if (rect.top - estimatedH - gap < 8) {
      top = rect.bottom + gap;
      flipped = true;
    } else {
      top = rect.top - gap;
    }

    setPos({ top, left, flipped });
  }, [width]);

  const handleEnter = useCallback(() => {
    updatePos();
    setShow(true);
  }, [updatePos]);

  if (!content) return children;

  return (
    <span
      ref={triggerRef}
      style={{ display: 'inline-block', cursor: 'default' }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
      onFocus={handleEnter}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span style={{
          position: 'fixed',
          top: pos.flipped ? `${pos.top}px` : undefined,
          bottom: pos.flipped ? undefined : `${window.innerHeight - pos.top}px`,
          left: `${pos.left}px`,
          zIndex: 9999,
          width: `${Math.min(width, window.innerWidth - 16)}px`,
          background: 'linear-gradient(to bottom, #1a2840, #111c30)',
          border: '1px solid rgba(200,160,72,0.35)',
          borderRadius: '4px',
          padding: '8px 10px',
          fontSize: '0.7rem',
          color: '#c8d8e8',
          lineHeight: '1.45',
          boxShadow: '0 4px 20px rgba(0,0,0,0.75)',
          pointerEvents: 'none',
          whiteSpace: 'normal',
          textAlign: 'left',
        }}>
          {content}
          <span style={{
            position: 'absolute',
            ...(pos.flipped
              ? { top: '-5px', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid rgba(200,160,72,0.35)' }
              : { top: '100%', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid rgba(200,160,72,0.35)' }),
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
          }} />
        </span>
      )}
    </span>
  );
}
