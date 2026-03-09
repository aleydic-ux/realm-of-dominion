import { useState } from 'react';

/**
 * Lightweight CSS tooltip wrapper. Shows a styled popup above children on hover.
 * content: string or JSX
 * width: pixel width of popup (default 220)
 */
export default function Tooltip({ content, children, width = 220 }) {
  const [show, setShow] = useState(false);
  if (!content) return children;

  return (
    <span
      style={{ position: 'relative', display: 'inline-block', cursor: 'default' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: `${width}px`,
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
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(200,160,72,0.35)',
          }} />
        </span>
      )}
    </span>
  );
}
