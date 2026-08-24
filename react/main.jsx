import React from 'react';
import { createRoot } from 'react-dom/client';
import AccountPanel from './AccountPanel.jsx';
import RecentDocs from './RecentDocs.jsx';
import ReviewPanel from './ReviewPanel.jsx';

// Cache root per element — mountAccount lze volat opakovaně (po uložení profilu,
// návratu na úvodku) a jen se re-renderuje místo vytváření nového rootu.
const _roots = new WeakMap();
function rootFor(el) { let r = _roots.get(el); if (!r) { r = createRoot(el); _roots.set(el, r); } return r; }

// Most mezi starou skořápkou a React islandy. Stará appka volá s ŽIVÝMI daty:
//   window.LexisReactIslands.mountAccount(el, { profile, level, onProfile, onSettings, onLock })
window.LexisReactIslands = {
  mountAccount(el, props = {}) { if (!el) return; rootFor(el).render(React.createElement(AccountPanel, props)); },
  mountRecentDocs(el, props = {}) { if (!el) return; rootFor(el).render(React.createElement(RecentDocs, props)); },
  mountReviewPanel(el, props = {}) { if (!el) return; rootFor(el).render(React.createElement(ReviewPanel, props)); },
  unmount(el) { const r = _roots.get(el); if (r) { r.unmount(); _roots.delete(el); } },
};

// Volitelný auto-mount pro statická data přes data-atribut (demo).
function auto() {
  document.querySelectorAll('[data-react-island="account"]').forEach((el) => {
    let props = {}; try { props = JSON.parse(el.getAttribute('data-props') || '{}'); } catch (e) {}
    window.LexisReactIslands.mountAccount(el, props);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
