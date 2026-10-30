const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABELS = { enregistre: 'Enregistré', en_traitement: 'En traitement', en_attente: 'En attente', traite: 'Traité', cloture: 'Clôturé' };
let page = 1, hasNext = false;

async function api(url, opts = {}) {
  const r = await fetch('/api' + url, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error([d.erreur, ...(d.details || [])].filter(Boolean).join(' – ') || 'Erreur');
  return d;
}
function say(text, ok = true) { const m = $('#msg'); m.textContent = text; m.className = ok ? 'ok' : 'ko'; }

async function loadStats() {
  try {
    const s = await api('/stats');
    $('#stats').innerHTML =
      `<div class="card"><b>${s.total}</b>Total</div>` +
      Object.entries(s.parStatut).map(([k, v]) => `<div class="card"><b>${v}</b>${LABELS[k]}</div>`).join('') +
      Object.entries(s.parType).map(([k, v]) => `<div class="card"><b>${v}</b>${esc(k)}</div>`).join('');
  } catch (e) { $('#stats').textContent = e.message; }
}

async function loadList() {
  const p = new URLSearchParams({ page });
  if ($('#q').value) p.set('q', $('#q').value);
  if ($('#fType').value) p.set('type', $('#fType').value);
  if ($('#fStatut').value) p.set('statut', $('#fStatut').value);
  try {
    const d = await api('/courriers?' + p);
    hasNext = d.pageSuivante;
    $('#pageNum').textContent = page;
    $('#liste').innerHTML = d.courriers.map((c) => `
      <tr data-id="${c.id}">
        <td>${esc(c.reference)}</td><td>${esc(c.objet)}</td><td>${esc(c.type)}</td>
        <td><span class="badge ${esc(c.priorite)}">${esc(c.priorite)}</span></td>
        <td>${esc(LABELS[c.statut] || c.statut)}</td>
        <td>${new Date(c.creeLe).toLocaleDateString('fr-FR')}</td></tr>`).join('')
      || '<tr><td colspan="6">Aucun courrier</td></tr>';
  } catch (e) { $('#liste').innerHTML = `<tr><td colspan="6">${esc(e.message)}</td></tr>`; }
}

async function openDetail(id) {
  const c = await api('/courriers/' + id);
  $('#detailBody').innerHTML = `
    <h3>${esc(c.reference)} – ${esc(c.objet)}</h3>
    <p>Type : <b>${esc(c.type)}</b> | Service : ${esc(c.service || '-')}</p>
    <label>Statut <select id="dStatut">${Object.entries(LABELS).filter(([k]) => k !== 'cloture')
      .map(([k, v]) => `<option value="${k}" ${k === c.statut ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Priorité <select id="dPrio">${['low', 'normal', 'high', 'urgent']
      .map((p) => `<option ${p === c.priorite ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
    <button id="dSave">Mettre à jour</button>
    <h4>Historique / notes</h4>
    ${c.notes.map((n) => `<div class="note">${esc(n.texte)}<br><small>${new Date(n.creeLe).toLocaleString('fr-FR')} ${n.publique ? '' : '(interne)'}</small></div>`).join('')}
    <textarea id="dNote" placeholder="Nouvelle note de traitement"></textarea>
    <button id="dAdd">Ajouter la note</button>
    <button id="dDel" class="danger">Supprimer</button>`;
  $('#dSave').onclick = async () => { try { await api('/courriers/' + id, { method: 'PUT', body: { statut: $('#dStatut').value, priorite: $('#dPrio').value } }); refresh(); openDetail(id); } catch (e) { alert(e.message); } };
  $('#dAdd').onclick = async () => { try { await api(`/courriers/${id}/notes`, { method: 'POST', body: { texte: $('#dNote').value } }); openDetail(id); } catch (e) { alert(e.message); } };
  $('#dDel').onclick = async () => { if (!confirm('Supprimer ce courrier ?')) return; try { await api('/courriers/' + id, { method: 'DELETE' }); $('#detail').close(); refresh(); } catch (e) { alert(e.message); } };
  if (!$('#detail').open) $('#detail').showModal();
}

const refresh = () => { loadStats(); loadList(); };

$('#form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const body = Object.fromEntries(new FormData(ev.target));
  Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
  try { const c = await api('/courriers', { method: 'POST', body }); say(`Courrier enregistré : ${c.reference}`); ev.target.reset(); setTimeout(refresh, 1500); }
  catch (e) { say(e.message, false); }
});
$('#btnFiltrer').onclick = () => { page = 1; loadList(); };
$('#prev').onclick = () => { if (page > 1) { page--; loadList(); } };
$('#next').onclick = () => { if (hasNext) { page++; loadList(); } };
$('#liste').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openDetail(tr.dataset.id); });
$('#fermer').onclick = () => $('#detail').close();
refresh();
