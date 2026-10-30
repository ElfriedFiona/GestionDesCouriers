// Faux Zendesk en mémoire : même interface que zendeskClient.js
const { HttpError } = require('./errors');
let seq = 1000;
const tickets = new Map();
const comments = new Map();
const now = () => new Date().toISOString();
const low = (s) => String(s).toLowerCase();

function match(t, query) {
  return query.split(/\s+/).filter(Boolean).every((term) => {
    if (term.startsWith('tags:')) return t.tags.includes(term.slice(5));
    if (term.startsWith('status:')) return t.status === term.slice(7);
    if (term.startsWith('type:')) return true;
    return low(t.subject).includes(low(term)) ||
      (comments.get(t.id) || []).some((c) => low(c.body).includes(low(term)));
  });
}
const find = (id) => {
  const t = tickets.get(Number(id));
  if (!t) throw new HttpError(404, 'Ticket introuvable');
  return t;
};
const addComment = (id, c) => {
  const list = comments.get(id) || [];
  list.push({ id: ++seq, author_id: 1, body: c.body, public: c.public !== false, created_at: now() });
  comments.set(id, list);
};

module.exports = {
  search: async (query, page = 1, perPage = 25) => {
    const all = [...tickets.values()].filter((t) => match(t, query))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const start = (page - 1) * perPage;
    return { results: all.slice(start, start + perPage), count: all.length,
             next_page: start + perPage < all.length ? 'next' : null };
  },
  count: async (query) => ({ count: [...tickets.values()].filter((t) => match(t, query)).length }),
  getTicket: async (id) => ({ ticket: find(id) }),
  getComments: async (id) => { find(id); return { comments: comments.get(Number(id)) || [] }; },
  createTicket: async (data) => {
    const id = ++seq;
    const t = { id, subject: data.subject, tags: data.tags || [], priority: data.priority || 'normal',
                status: 'new', type: data.type, created_at: now(), updated_at: now() };
    tickets.set(id, t);
    if (data.comment) addComment(id, data.comment);
    return { ticket: t };
  },
  updateTicket: async (id, patch) => {
    const t = find(id);
    if (patch.status) t.status = patch.status;
    if (patch.priority) t.priority = patch.priority;
    if (patch.comment) addComment(t.id, patch.comment);
    t.updated_at = now();
    return { ticket: t };
  },
  deleteTicket: async (id) => { find(id); tickets.delete(Number(id)); comments.delete(Number(id)); return null; },
};
