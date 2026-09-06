import { nextSortOrder } from '../../domain/schedule.js';
export function renderBasket(host, items, accounts, locations, visits, dragEnabled, onPlace) {
    const accountById = new Map(accounts.map(a => [a.id, a]));
    const locationById = new Map(locations.map(s => [s.id, s]));
    host.innerHTML = '';
    if (!items.length) {
        host.innerHTML = '<div class="basket-empty"><strong>Basket empty</strong><p>Drag a visit here when you want to move it out of the week.</p></div>';
        return { destroy() { host.innerHTML = ''; } };
    }
    const list = document.createElement('div');
    list.className = 'basket-list';
    host.append(list);
    const cleanup = [];
    for (const item of items) {
        const account = accountById.get(item.accountId), location = item.serviceLocationId ? locationById.get(item.serviceLocationId) : undefined;
        const card = document.createElement('article');
        card.className = `basket-card basket-card-compact${dragEnabled ? ' basket-draggable' : ' basket-locked'}`;
        card.dataset.queueItemId = item.id;
        card.innerHTML = `<div><strong>${esc(account?.name || item.accountId)}</strong><small>${esc(location?.address || 'Address not linked')}${location?.suburb ? ` · ${esc(location.suburb)}` : ''}</small></div><b title="${dragEnabled ? 'Drag to calendar' : 'Turn on Drag mode to place this visit'}">${dragEnabled ? '⋮⋮' : '•'}</b>`;
        card.title = dragEnabled ? 'Drag onto a team/day' : 'Turn on Drag mode to place Basket visits';
        list.append(card);
        if (dragEnabled) {
            const down = (event) => beginPointerDrag(event, item, card, onPlace, visits);
            card.addEventListener('pointerdown', down);
            cleanup.push(() => card.removeEventListener('pointerdown', down));
        }
    }
    return { destroy() { cleanup.forEach(fn => fn()); host.innerHTML = ''; } };
}
function beginPointerDrag(event, item, card, onPlace, visits) {
    if (event.button !== 0)
        return;
    event.preventDefault();
    const rect = card.getBoundingClientRect(), ghost = document.createElement('div');
    ghost.className = 'drag-ghost drag-id-ghost';
    ghost.innerHTML = `<strong>${esc(card.querySelector('strong')?.textContent || 'Basket item')}</strong><small>ID ${esc(shortId(item.id))}</small>`;
    document.body.append(ghost);
    const ox = event.clientX - rect.left, oy = event.clientY - rect.top;
    let moved = false;
    place(event.clientX, event.clientY);
    const move = (e) => { e.preventDefault(); moved = true; place(e.clientX, e.clientY); };
    const end = (e) => { cleanup(); if (!moved)
        return; const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-schedule-cell]'); const date = target?.dataset.date, teamId = target?.dataset.teamId; if (date && teamId)
        void onPlace({ queueItemId: item.id, date: date, teamId, sortOrder: nextSortOrder(visits, date, teamId) }); };
    const cancel = () => cleanup();
    function place(x, y) { ghost.style.left = `${x - ox}px`; ghost.style.top = `${y - oy}px`; }
    function cleanup() { ghost.remove(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', cancel); }
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
}
function shortId(value) { const text = String(value || ''); return text.length <= 8 ? text : text.slice(-8); }
function esc(v) { return String(v).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch)); }
//# sourceMappingURL=basket.js.map