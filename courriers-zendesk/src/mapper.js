const TYPES = ['entrant', 'sortant', 'interne'];
const PRIORITES = ['low', 'normal', 'high', 'urgent'];
const STATUT_TO_ZD = { enregistre: 'new', en_traitement: 'open', en_attente: 'pending', traite: 'solved' };
const ZD_TO_STATUT = { new: 'enregistre', open: 'en_traitement', pending: 'en_attente', hold: 'en_attente', solved: 'traite', closed: 'cloture' };

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const genRef = () => `CR-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;

function toZendeskTicket({ type, objet, contenu, priorite = 'normal', service, nom, email }) {
  const reference = genRef();
  const tags = ['courrier', type, `ref_${reference.toLowerCase()}`];
  if (service) tags.push(`svc_${slug(service)}`);
  const ticket = {
    subject: `[${reference}] ${objet}`,
    comment: { body: contenu },
    priority: priorite,
    type: 'task',
    tags,
  };
  if (email) ticket.requester = { name: nom || email, email };
  return ticket;
}

function toCourrier(t) {
  const tags = t.tags || [];
  const ref = (t.subject || '').match(/^\[(CR-[^\]]+)\]\s*(.*)$/);
  return {
    id: t.id,
    reference: ref ? ref[1] : null,
    objet: ref ? ref[2] : t.subject,
    type: tags.find((x) => TYPES.includes(x)) || null,
    service: (tags.find((x) => x.startsWith('svc_')) || '').replace('svc_', '') || null,
    priorite: t.priority,
    statut: ZD_TO_STATUT[t.status] || t.status,
    creeLe: t.created_at,
    misAJourLe: t.updated_at,
  };
}

const toNote = (c) => ({ id: c.id, auteurId: c.author_id, texte: c.body, publique: c.public, creeLe: c.created_at });

module.exports = { TYPES, PRIORITES, STATUT_TO_ZD, toZendeskTicket, toCourrier, toNote };
