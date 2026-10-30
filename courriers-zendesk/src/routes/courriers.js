const express = require('express');
const zd = require('../zendeskClient');
const { HttpError, asyncH } = require('../errors');
const { TYPES, PRIORITES, STATUT_TO_ZD, toZendeskTicket, toCourrier, toNote } = require('../mapper');

const router = express.Router();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const parseId = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Identifiant invalide');
  return n;
};

function validateCreation(b) {
  const e = [];
  if (!TYPES.includes(b.type)) e.push('type doit être entrant, sortant ou interne');
  if (typeof b.objet !== 'string' || b.objet.trim().length < 3 || b.objet.length > 150) e.push('objet : 3 à 150 caractères');
  if (typeof b.contenu !== 'string' || !b.contenu.trim()) e.push('contenu obligatoire');
  if (b.priorite && !PRIORITES.includes(b.priorite)) e.push('priorité invalide');
  if (b.email && !emailRe.test(b.email)) e.push('email invalide');
  if (e.length) throw new HttpError(400, 'Validation échouée', e);
}

// Liste + filtres
router.get('/courriers', asyncH(async (req, res) => {
  const { type, statut, q } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  let query = 'type:ticket tags:courrier';
  if (type) {
    if (!TYPES.includes(type)) throw new HttpError(400, 'type invalide');
    query += ` tags:${type}`;
  }
  if (statut) {
    if (!STATUT_TO_ZD[statut]) throw new HttpError(400, 'statut invalide');
    query += ` status:${STATUT_TO_ZD[statut]}`;
  }
  if (q) query += ` ${String(q).replace(/[^\p{L}\p{N}\s\-_.@]/gu, '')}`;
  const data = await zd.search(query, page);
  res.json({
    courriers: data.results.filter((r) => r.result_type === 'ticket' || r.subject).map(toCourrier),
    total: data.count,
    page,
    pageSuivante: !!data.next_page,
  });
}));

// Détail + notes
router.get('/courriers/:id', asyncH(async (req, res) => {
  const id = parseId(req.params.id);
  const [t, c] = await Promise.all([zd.getTicket(id), zd.getComments(id)]);
  res.json({ ...toCourrier(t.ticket), notes: c.comments.map(toNote) });
}));

// Création
router.post('/courriers', asyncH(async (req, res) => {
  validateCreation(req.body);
  const b = { ...req.body, objet: req.body.objet.trim(), contenu: req.body.contenu.trim() };
  const created = await zd.createTicket(toZendeskTicket(b));
  res.status(201).json(toCourrier(created.ticket));
}));

// Mise à jour statut / priorité
router.put('/courriers/:id', asyncH(async (req, res) => {
  const id = parseId(req.params.id);
  const { statut, priorite } = req.body;
  const patch = {};
  if (statut !== undefined) {
    if (!STATUT_TO_ZD[statut]) throw new HttpError(400, 'statut invalide');
    patch.status = STATUT_TO_ZD[statut];
  }
  if (priorite !== undefined) {
    if (!PRIORITES.includes(priorite)) throw new HttpError(400, 'priorité invalide');
    patch.priority = priorite;
  }
  if (!Object.keys(patch).length) throw new HttpError(400, 'Rien à mettre à jour');
  const r = await zd.updateTicket(id, patch);
  res.json(toCourrier(r.ticket));
}));

// Ajout d'une note interne
router.post('/courriers/:id/notes', asyncH(async (req, res) => {
  const id = parseId(req.params.id);
  const texte = (req.body.texte || '').trim();
  if (!texte) throw new HttpError(400, 'texte obligatoire');
  await zd.updateTicket(id, { comment: { body: texte, public: false } });
  res.status(201).json({ ok: true });
}));

// Suppression
router.delete('/courriers/:id', asyncH(async (req, res) => {
  await zd.deleteTicket(parseId(req.params.id));
  res.status(204).end();
}));

// Statistiques
router.get('/stats', asyncH(async (req, res) => {
  const base = 'type:ticket tags:courrier';
  const statuts = Object.keys(STATUT_TO_ZD);
  const [total, ...rest] = await Promise.all([
    zd.count(base),
    ...statuts.map((s) => zd.count(`${base} status:${STATUT_TO_ZD[s]}`)),
    ...TYPES.map((t) => zd.count(`${base} tags:${t}`)),
  ]);
  const parStatut = {}, parType = {};
  statuts.forEach((s, i) => (parStatut[s] = rest[i].count));
  TYPES.forEach((t, i) => (parType[t] = rest[statuts.length + i].count));
  res.json({ total: total.count, parStatut, parType });
}));

module.exports = router;
