import React from 'react';
import { FileText, X } from 'lucide-react';

// Seznam nedávných dokumentů na úvodní obrazovce. Prezentační — data (view-modely)
// i akce dostává z props; filtrování/počet řeší stará vrstva (renderRecentDocuments).
export default function RecentDocs({ docs = [], onOpen, onDelete, emptyText = 'Zatím žádné dokumenty' }) {
  if (!docs.length) {
    return (
      <div style={{ padding: '22px 2px', color: 'var(--text-faint)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
        {emptyText}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {docs.map((d) => (
        <div key={d.id} className="recent-doc-row" onClick={() => onOpen && onOpen(d.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
                   border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer',
                   transition: 'border-color .15s', fontFamily: 'var(--font-ui)' }}>
          <FileText size={22} strokeWidth={1.3} style={{ color: 'var(--border-strong)', flex: 'none' }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{d.subtitle}</div>
          </div>
          {d.statusLabel ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 10, letterSpacing: '.08em',
                           padding: '4px 9px', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)',
                           background: 'var(--surface-2)', whiteSpace: 'nowrap', flex: 'none' }}>{d.statusLabel}</span>
          ) : null}
          {d.deadlineText ? (
            <span style={{ fontWeight: 700, fontSize: 12, color: d.deadlineColor, whiteSpace: 'nowrap', flex: 'none' }}>{d.deadlineText}</span>
          ) : null}
          <button title="Smazat" onClick={(e) => { e.stopPropagation(); onDelete && onDelete(d.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '2px 4px', flex: 'none', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
