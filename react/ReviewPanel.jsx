import React from 'react';
import { Check, X } from 'lucide-react';

const btn = { fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)' };
const acceptStyle = { ...btn, border: '1px solid rgba(90,138,74,.45)', background: 'rgba(90,138,74,.12)', color: 'var(--green)' };
const rejectStyle = { ...btn, border: '1px solid rgba(176,70,60,.45)', background: 'rgba(176,70,60,.12)', color: '#c0553f' };

// Recenzní panel sledovaných změn a komentářů. Prezentační — data (view-modely) a
// akce z props. Re-render po přijmout/odmítnout dělá stará vrstva přes cached root.
export default function ReviewPanel({ items = [], onResolve, onClose }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--ink)' }}>
        <span>Revize a komentáře ({items.length})</span>
        <button onClick={onClose} title="Zavřít" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', display: 'flex', padding: 2 }}><X size={15} /></button>
      </div>
      {!items.length ? (
        <div style={{ padding: 16, color: 'var(--text-faint)' }}>Žádné změny ani komentáře.</div>
      ) : items.map((it, i) => (
        <div key={i} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: it.color, display: 'inline-block', flex: 'none' }} />
            <b style={{ color: 'var(--ink)' }}>{it.author}</b>
            <span style={{ opacity: .5 }}>{it.date}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: .6 }}>{it.kindLabel}</span>
          </div>
          <div style={{ margin: '6px 0', color: 'var(--text-2)' }}>{it.snippet}{it.ctx ? <span style={{ opacity: .55 }}> {it.ctx}</span> : null}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={acceptStyle} onClick={() => onResolve && onResolve(i, 'accept')}><Check size={12} /> {it.acceptLabel}</button>
            {it.kind !== 'comment' ? (
              <button style={rejectStyle} onClick={() => onResolve && onResolve(i, 'reject')}><X size={12} /> Odmítnout</button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
