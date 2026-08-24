import React, { useEffect, useRef } from 'react';

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' };
const modalBase = { background: 'var(--surface)', padding: 24, borderRadius: 12, boxShadow: '0 15px 30px rgba(0,0,0,.2)', fontFamily: 'var(--font-ui)', color: 'var(--ink)', border: '1px solid var(--border)' };
const btnPrimary = { padding: '8px 16px', background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 500, border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-ui)' };
const btnSecondary = { padding: '8px 16px', background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 500, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-ui)' };

// Jednotný dialog (alert / confirm / prompt) — nahrazuje ruční overlay v lexis-dialogs.js.
// text/title je HTML (emoji už převedené na ikony volající vrstvou).
export default function Dialog({ mode = 'alert', text = '', okLabel = 'OK', cancelLabel = 'Zrušit', defaultValue = '', onResult, onClose }) {
  const inputRef = useRef(null);
  const okRef = useRef(null);

  const done = (result) => { if (onResult) onResult(result); if (onClose) onClose(); };
  const cancelResult = () => (mode === 'prompt' ? null : (mode === 'confirm' ? false : undefined));

  useEffect(() => {
    if (mode === 'prompt' && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
    else if (okRef.current) okRef.current.focus();
    const onKey = (e) => { if (e.key === 'Escape') done(cancelResult()); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const confirmValue = () => (mode === 'prompt' ? (inputRef.current ? inputRef.current.value : '') : (mode === 'confirm' ? true : undefined));

  return (
    <div style={overlayStyle} onMouseDown={(e) => { if (e.target === e.currentTarget && mode === 'alert') done(undefined); }}>
      <div style={{ ...modalBase, width: mode === 'confirm' ? 360 : 320 }} role="dialog" aria-modal="true">
        {mode === 'prompt'
          ? <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }} dangerouslySetInnerHTML={{ __html: text }} />
          : <div style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--ink)' }} dangerouslySetInnerHTML={{ __html: text }} />}
        {mode === 'prompt' && (
          <input ref={inputRef} defaultValue={defaultValue == null ? '' : String(defaultValue)}
            onKeyDown={(e) => { if (e.key === 'Enter') done(e.currentTarget.value); }}
            style={{ width: '100%', padding: 10, border: '1px solid var(--border-strong)', borderRadius: 6, marginBottom: 20, boxSizing: 'border-box', fontSize: 13, outline: 'none', background: 'var(--surface)', color: 'var(--ink)' }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {mode !== 'alert' && (
            <button style={btnSecondary} onClick={() => done(cancelResult())}>{mode === 'prompt' ? 'Zrušit' : cancelLabel}</button>
          )}
          <button ref={okRef} style={btnPrimary} onClick={() => done(confirmValue())}>
            {mode === 'alert' ? 'Rozumím' : (mode === 'prompt' ? 'Potvrdit' : okLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}
