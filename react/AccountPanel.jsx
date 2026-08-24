import React from 'react';
import { Settings, Lock, ShieldCheck } from 'lucide-react';

// Úrovně (edice) → popisek + barva tečky. Stejné mapování jako ve vanilla verzi.
const LEVELS = {
  core:     { label: 'Základní',   dot: 'var(--text-faint)' },
  legal:    { label: 'Legal',      dot: 'var(--accent)' },
  business: { label: 'Business',   dot: 'var(--gold)' },
  full:     { label: 'Plná verze', dot: 'var(--gold)' },
};

function initials(name) {
  const base = String(name || '').split(',')[0]
    .replace(/^((JUD|Mg|In)r\.|Bc\.|Ph\.?D\.?|MUDr\.)\s*/gi, '').trim();
  const p = base.split(/\s+/).filter(Boolean);
  if (!p.length) return '+';
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// Patička účtu na úvodní obrazovce. Používá STEJNÉ CSS třídy jako vanilla verze
// (.start-account*), takže styl bere z css/lexis-style.css a motiv z css/tokens.css.
export default function AccountPanel({ profile = {}, level = 'full', onProfile, onSettings, onLock }) {
  const lv = LEVELS[level] || LEVELS.full;
  const hasName = !!(profile.name && String(profile.name).trim());
  const displayName = hasName ? ((profile.title ? profile.title + ' ' : '') + profile.name) : 'Nastavit profil';
  return (
    <div className="start-account">
      <div className="start-account-row" onClick={onProfile} title="Otevřít profil advokáta">
        <div className="start-avatar">{hasName ? initials(profile.name) : '+'}</div>
        <div className="start-account-id">
          <div className="start-account-name">{displayName}</div>
          <div className="start-account-firm">{profile.firm || ''}</div>
        </div>
        <button className="start-lock-btn" title="Nastavení"
          onClick={(e) => { e.stopPropagation(); onSettings && onSettings(); }}><Settings size={15} /></button>
        <button className="start-lock-btn" title="Zamknout aplikaci"
          onClick={(e) => { e.stopPropagation(); onLock && onLock(); }}><Lock size={15} /></button>
      </div>
      <div className="start-level-row">
        <span className="start-level-badge">
          <ShieldCheck size={13} />
          <span className="lv">{lv.label}</span>
          <span className="dot" style={{ background: lv.dot }} />
        </span>
        <span className="start-level-manage" onClick={onProfile}>Spravovat</span>
      </div>
    </div>
  );
}
