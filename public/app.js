// Avenirs · Espace parents — application monopage (routage par #hash).
// Toutes les données viennent de /api/* (qui interroge Airtable côté serveur).

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const lightbox = document.getElementById('lightbox');

// Allergènes proposés en sélection rapide (les 14 allergènes majeurs réglementaires).
// Le parent peut toujours saisir une autre allergie librement.
const ALLERGENES = [
  'Arachides', 'Lait', 'Œufs', 'Gluten', 'Fruits à coque', 'Poisson', 'Crustacés',
  'Mollusques', 'Soja', 'Sésame', 'Moutarde', 'Céleri', 'Sulfites', 'Lupin',
];

const state = { user: null, children: null };

/* ---------------------------------------------------------------- utilitaires */

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const normalize = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').toLowerCase().replace(/s\b/g, '').trim();

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !['/api/login', '/api/me'].includes(path)) {
    state.user = null;
    state.children = null;
    go('/login');
    throw new ApiError(401, data.error || 'Session expirée.');
  }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Une erreur est survenue.');
  return data;
}

function go(path) {
  if (location.hash !== `#${path}`) location.hash = path;
  else render();
}

let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  toastEl.style.animation = 'none';
  void toastEl.offsetWidth;
  toastEl.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2800);
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const dateLongFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const toDate = (iso) => (iso ? new Date(`${iso}T12:00:00`) : null);
const fmtDate = (iso, long = false) => (iso ? (long ? dateLongFmt : dateFmt).format(toDate(iso)).replace(/\.$/, '') : '');
const fmtHours = (e) => [e.heureDebut, e.heureFin].filter(Boolean).join(' – ').replace(/:/g, 'h');

function dateRange(e, long = false) {
  if (!e.dateDebut) return 'Date à venir';
  if (e.dateFin && e.dateFin !== e.dateDebut) return `Du ${fmtDate(e.dateDebut, long)} au ${fmtDate(e.dateFin, long)}`;
  return fmtDate(e.dateDebut, long);
}

/* ---------------------------------------------------------------- icônes */

const icon = {
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v5M12 16h.01"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7M5 10v10h14V10"/></svg>',
};

const rule = '<div class="rule" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>';
const tri = '<span class="tri" aria-hidden="true"></span>';

function photo(img, alt, cls) {
  return img?.url
    ? `<img class="${cls}" src="${esc(img.url)}" alt="${esc(alt)}" loading="lazy" decoding="async">`
    : `<div class="${cls} avatar-fallback" role="img" aria-label="${esc(alt)}"></div>`;
}

/* ---------------------------------------------------------------- gabarits communs */

function topbar() {
  return `
    <header class="topbar">
      <a class="topbar__logo" href="#/" aria-label="Avenirs — accueil"><img src="/assets/logo-avenirs.png" alt="avenirs" width="120" height="30"></a>
      <button class="icon-btn" data-action="logout" type="button">${icon.logout}<span>Quitter</span></button>
    </header>`;
}

function switcher(currentId, section) {
  const kids = state.children || [];
  if (kids.length < 2) return '';
  return `
    <nav class="switcher" aria-label="Changer d'enfant">
      ${kids.map((k) => `
        <a class="switcher__kid" href="#/enfant/${esc(k.id)}${section ? `/${section}` : ''}" aria-current="${k.id === currentId}">
          ${photo(k.photo, '', '')}<span>${esc(k.prenom)}</span>
        </a>`).join('')}
    </nav>`;
}

function tabbar(childId, active) {
  const tabs = [
    ['', 'Profil', icon.user, 'profil'],
    ['/agenda', 'Agenda', icon.calendar, 'agenda'],
    ['/allergies', 'Allergies', icon.shield, 'allergies'],
  ];
  return `
    <nav class="tabbar" aria-label="Navigation">
      ${tabs.map(([path, label, ico, key]) => `
        <a class="tab" href="#/enfant/${esc(childId)}${path}" ${key === active ? 'aria-current="page"' : ''}>${ico}<span>${label}</span></a>`).join('')}
    </nav>`;
}

function childShell(childId, section, active, inner) {
  return `${topbar()}${switcher(childId, section)}<main class="page page--tabs">${inner}</main>${tabbar(childId, active)}`;
}

function loading(childId, section, active) {
  const inner = `<div class="skeleton sk-hero"></div><div class="skeleton sk-line"></div><div class="skeleton sk-block"></div>`;
  return childId ? childShell(childId, section, active, inner) : `${topbar()}<main class="page">${inner}</main>`;
}

function errorView(err, childId) {
  const notFound = err.status === 404;
  return `
    <div class="error-page">
      <h1>${notFound ? 'Page introuvable' : 'Oups'}</h1>
      <p>${esc(err.message || 'Une erreur est survenue.')}</p>
      <a class="btn" href="#${childId ? `/enfant/${esc(childId)}` : '/'}">${icon.home} Retour</a>
    </div>`;
}

async function ensureChildren() {
  if (!state.children) state.children = (await api('/api/children')).children;
  return state.children;
}

/* ---------------------------------------------------------------- pages */

function renderLogin() {
  document.title = 'Connexion · Avenirs';
  app.innerHTML = `
    <main class="login page">
      <img class="login__logo" src="/assets/logo-avenirs.png" alt="avenirs" width="300" height="75">
      <span class="label login__tag">Espace parents</span>
      <form class="card login__card" novalidate>
        <h1>Connexion</h1>
        <p>Retrouvez le parcours, les lectures et les sorties de vos enfants.</p>
        <div class="alert" hidden></div>
        <label class="field">
          <span>Identifiant</span>
          <input class="input" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
        </label>
        <label class="field">
          <span>Mot de passe</span>
          <div class="password">
            <input class="input" name="password" type="password" autocomplete="current-password" required>
            <button type="button" data-action="toggle-password" aria-label="Afficher le mot de passe">Voir</button>
          </div>
        </label>
        <button class="btn btn--block" type="submit">Se connecter ${tri}</button>
      </form>
    </main>`;

  const form = app.querySelector('form');
  const alertEl = form.querySelector('.alert');
  form.username.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) {
      alertEl.textContent = 'Merci de renseigner votre identifiant et votre mot de passe.';
      alertEl.hidden = false;
      return;
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.firstChild.textContent = 'Connexion… ';
    try {
      const { user } = await api('/api/login', { method: 'POST', body: { username, password } });
      state.user = user;
      go('/');
    } catch (err) {
      alertEl.textContent = err.message;
      alertEl.hidden = false;
      form.password.value = '';
      form.password.focus();
      btn.disabled = false;
      btn.firstChild.textContent = 'Se connecter ';
    }
  });
}

async function renderHome() {
  document.title = 'Mes enfants · Avenirs';
  app.innerHTML = loading();
  const kids = await ensureChildren();
  app.innerHTML = `
    ${topbar()}
    <main class="page">
      <section class="hello">
        <span class="label">Espace parents</span>
        <h1 class="mt">Bonjour ${esc(state.user)}</h1>
        ${rule}
        <p>Choisissez un enfant pour voir son profil et son agenda.</p>
      </section>
      <div class="kids">
        ${kids.length ? kids.map((k) => `
          <a class="card kid-card" href="#/enfant/${esc(k.id)}">
            ${photo(k.photo, `Photo de ${k.prenom}`, 'kid-card__photo')}
            <div class="kid-card__foot">
              <span class="kid-card__name">${esc(k.prenom)}</span>
              <span class="kid-card__go">Profil ${tri}</span>
            </div>
          </a>`).join('') : '<p class="empty">Aucun enfant rattaché à ce compte.</p>'}
      </div>
    </main>`;
}

function skillList(items, done) {
  if (!items.length) return `<p class="empty">${done ? 'Aucune compétence validée pour le moment.' : 'Aucune compétence en cours.'}</p>`;
  return `<ul class="skills">${items.map((s) => `
    <li class="skill ${done ? 'skill--done' : 'skill--doing'}">
      <span class="skill__icon" aria-hidden="true">${done ? '✓' : ''}</span>
      <span>${esc(s)}</span>
    </li>`).join('')}</ul>`;
}

async function renderProfile(childId) {
  app.innerHTML = loading(childId, '', 'profil');
  await ensureChildren();
  const { child: c } = await api(`/api/children?id=${encodeURIComponent(childId)}`);
  document.title = `${c.prenom} · Avenirs`;
  app.innerHTML = childShell(childId, '', 'profil', `
    <section class="hero">
      ${c.photo ? `<img class="hero__photo" src="${esc(c.photo.url)}" alt="Photo de ${esc(c.prenom)}">` : '<div class="hero__photo"></div>'}
      <div class="hero__meta">
        <span class="label">Profil</span>
        <h1>${esc(c.prenom)}</h1>
        <p class="hero__allergy">
          ${c.allergies.length
            ? `Allergies : <a href="#/enfant/${esc(c.id)}/allergies">${esc(c.allergies.join(', '))}</a>`
            : `<a href="#/enfant/${esc(c.id)}/allergies">Aucune allergie renseignée</a>`}
        </p>
      </div>
    </section>

    <section class="section" aria-labelledby="acq">
      <div class="section__head"><h2 id="acq">Compétences acquises</h2><span class="count">${c.acquises.length}</span></div>
      ${skillList(c.acquises, true)}
    </section>

    <section class="section" aria-labelledby="enc">
      <div class="section__head"><h2 id="enc">En cours d'acquisition</h2><span class="count">${c.enCours.length}</span></div>
      ${skillList(c.enCours, false)}
    </section>

    <section class="section" aria-labelledby="livre">
      <div class="section__head"><h2 id="livre">Livre du moment</h2></div>
      ${c.livre ? `
        <article class="card book">
          ${c.livre.couverture ? `<img class="book__cover" src="${esc(c.livre.couverture.url)}" alt="Couverture de « ${esc(c.livre.titre)} »" loading="lazy">` : ''}
          <div>
            <span class="label">En lecture</span>
            <h3 class="book__title">${esc(c.livre.titre)}</h3>
            ${c.livre.auteur ? `<p class="book__author">de ${esc(c.livre.auteur)}</p>` : ''}
          </div>
        </article>` : '<p class="empty">Pas de livre en cours pour le moment.</p>'}
    </section>

    <div class="shortcut">
      <a class="btn btn--block" href="#/enfant/${esc(c.id)}/agenda">${icon.calendar} Voir l'agenda de ${esc(c.prenom)} ${tri}</a>
    </div>`);
}

async function renderAgenda(childId) {
  app.innerHTML = loading(childId, 'agenda', 'agenda');
  await ensureChildren();
  const { child, events } = await api(`/api/events?child=${encodeURIComponent(childId)}`);
  document.title = `Agenda de ${child.prenom} · Avenirs`;
  app.innerHTML = childShell(childId, 'agenda', 'agenda', `
    <section class="section">
      <span class="label">Agenda</span>
      <h1 class="mt">Les sorties de ${esc(child.prenom)}</h1>
      ${rule}
    </section>
    ${events.length ? `<div class="events">${events.map((e) => `
      <a class="card event-card" href="#/enfant/${esc(childId)}/agenda/${esc(e.id)}">
        <div class="event-card__media">
          ${photo(e.image, '', 'event-card__img')}
          <span class="label event-card__date">${esc(fmtDate(e.dateDebut) || 'Date à venir')}</span>
        </div>
        <div class="event-card__body">
          <h2 class="event-card__title">${esc(e.titre)}</h2>
          <p class="meta">
            ${fmtHours(e) ? `<span>${icon.clock}${esc(fmtHours(e))}</span>` : ''}
            ${e.lieu ? `<span>${icon.pin}${esc(e.lieu)}</span>` : ''}
          </p>
        </div>
      </a>`).join('')}</div>` : `<div class="section"><p class="empty">Aucune sortie prévue pour ${esc(child.prenom)}.</p></div>`}`);
}

async function renderEvent(childId, eventId) {
  app.innerHTML = loading(childId, 'agenda', 'agenda');
  await ensureChildren();
  const { child, event: e } = await api(`/api/events?child=${encodeURIComponent(childId)}&id=${encodeURIComponent(eventId)}`);
  document.title = `${e.titre} · Avenirs`;
  app.innerHTML = childShell(childId, 'agenda', 'agenda', `
    <a class="back" href="#/enfant/${esc(childId)}/agenda">← Agenda de ${esc(child.prenom)}</a>
    <div class="spacer"></div>
    ${e.image ? `
      <button class="detail__media" type="button" data-action="zoom" data-src="${esc(e.image.full)}" data-alt="${esc(e.titre)}" aria-label="Agrandir l'image">
        <img class="detail__img" src="${esc(e.image.full)}" alt="${esc(e.titre)}">
        <span class="label label--light detail__zoom">Agrandir ⤢</span>
      </button>` : ''}
    <article class="detail__body">
      <span class="label">${esc(dateRange(e))}</span>
      <h1>${esc(e.titre)}</h1>
      <p class="meta">
        <span>${icon.calendar}${esc(dateRange(e, true))}</span>
        ${fmtHours(e) ? `<span>${icon.clock}${esc(fmtHours(e))}</span>` : ''}
        ${e.lieu ? `<span>${icon.pin}${esc(e.lieu)}</span>` : ''}
      </p>
      ${rule}
      ${e.resume ? `<p class="detail__resume">${esc(e.resume)}</p>` : ''}
    </article>
    <section class="card detail__allergies" aria-labelledby="all">
      <h2 id="all">Allergies de ${esc(child.prenom)}</h2>
      ${child.allergies.length
        ? `<ul class="chips">${child.allergies.map((a) => `<li class="chip chip--static">${esc(a)}</li>`).join('')}</ul>`
        : '<p class="hint hint--block">Aucune allergie signalée pour le moment.</p>'}
      <a class="btn btn--block" href="#/enfant/${esc(childId)}/allergies?from=${esc(eventId)}">${icon.shield} Ajouter une allergie</a>
    </section>`);
}

async function renderAllergies(childId, fromEventId) {
  app.innerHTML = loading(childId, 'allergies', 'allergies');
  await ensureChildren();
  const { child } = await api(`/api/children?id=${encodeURIComponent(childId)}`);
  document.title = `Allergies de ${child.prenom} · Avenirs`;
  let allergies = child.allergies;
  const selected = new Set();

  const draw = () => {
    const known = new Set(allergies.map(normalize));
    app.innerHTML = childShell(childId, 'allergies', 'allergies', `
      ${fromEventId ? `<a class="back" href="#/enfant/${esc(childId)}/agenda/${esc(fromEventId)}">← Retour à la sortie</a>` : ''}
      <section class="section">
        <span class="label">Santé</span>
        <h1 class="mt">Allergies de ${esc(child.prenom)}</h1>
        ${rule}
      </section>

      <section class="section" aria-labelledby="deja">
        <div class="section__head"><h2 id="deja">Déjà renseignées</h2><span class="count">${allergies.length}</span></div>
        ${allergies.length ? `<ul class="chips">${allergies.map((a) => `
          <li class="chip chip--static">${esc(a)}
            <button class="chip__remove" type="button" data-action="remove" data-value="${esc(a)}" aria-label="Retirer ${esc(a)}">✕</button>
          </li>`).join('')}</ul>` : `<p class="empty">Aucune allergie renseignée pour ${esc(child.prenom)}.</p>`}
      </section>

      <section class="section" aria-labelledby="ajout">
        <div class="section__head"><h2 id="ajout">Ajouter une allergie</h2></div>
        <form class="card add-box" novalidate>
          <h3>Sélection rapide</h3>
          <div class="chips">
            ${ALLERGENES.map((a) => {
              const isKnown = known.has(normalize(a));
              return `<button class="chip" type="button" data-action="pick" data-value="${esc(a)}" aria-pressed="${selected.has(a)}" ${isKnown ? 'disabled title="Déjà renseignée"' : ''}>${esc(a)}</button>`;
            }).join('')}
          </div>
          <h3><label for="autre">Autre allergie</label></h3>
          <div class="add-row">
            <input class="input" id="autre" name="autre" maxlength="60" placeholder="Ex. : kiwi, pénicilline…" autocomplete="off">
          </div>
          <p class="hint">Une allergie à la fois. Elle sera ajoutée à la fiche de ${esc(child.prenom)}.</p>
          <button class="btn btn--block" type="submit">Enregistrer ${tri}</button>
        </form>
      </section>`);

    const form = app.querySelector('form');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const other = form.autre.value.trim();
      const toAdd = [...selected, ...(other ? [other] : [])];
      if (!toAdd.length) { toast('Sélectionnez ou saisissez une allergie.'); form.autre.focus(); return; }
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      const added = [];
      try {
        for (const value of toAdd) {
          const res = await api(`/api/allergies?child=${encodeURIComponent(childId)}`, { method: 'POST', body: { allergie: value } });
          allergies = res.allergies;
          added.push(value);
          selected.delete(value);
        }
        toast(added.length > 1 ? `${added.length} allergies ajoutées` : `« ${added[0]} » ajoutée`);
        draw();
      } catch (err) {
        if (added.length) draw();
        toast(err.message);
        btn.disabled = false;
      }
    });
  };

  app.onclick = async (ev) => {
    const target = ev.target.closest('[data-action]');
    if (!target || !app.contains(target)) return;
    const { action, value } = target.dataset;
    if (action === 'pick') {
      selected.has(value) ? selected.delete(value) : selected.add(value);
      target.setAttribute('aria-pressed', String(selected.has(value)));
    }
    if (action === 'remove') {
      if (!target.classList.contains('is-confirm')) {
        target.classList.add('is-confirm');
        target.textContent = 'Retirer ?';
        setTimeout(() => { if (target.isConnected) { target.classList.remove('is-confirm'); target.textContent = '✕'; } }, 3000);
        return;
      }
      target.disabled = true;
      try {
        const res = await api(`/api/allergies?child=${encodeURIComponent(childId)}`, { method: 'DELETE', body: { allergie: value } });
        allergies = res.allergies;
        toast(`« ${value} » retirée`);
        draw();
      } catch (err) {
        toast(err.message);
        target.disabled = false;
      }
    }
  };

  draw();
}

/* ---------------------------------------------------------------- actions globales */

document.addEventListener('click', async (ev) => {
  const target = ev.target.closest('[data-action]');
  if (!target) return;
  const { action } = target.dataset;
  if (action === 'logout') {
    await api('/api/logout', { method: 'POST', body: {} }).catch(() => {});
    state.user = null;
    state.children = null;
    go('/login');
  }
  if (action === 'toggle-password') {
    const input = target.previousElementSibling;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    target.textContent = show ? 'Masquer' : 'Voir';
  }
  if (action === 'zoom') openLightbox(target.dataset.src, target.dataset.alt);
});

function openLightbox(src, alt) {
  lightbox.innerHTML = `<button type="button">Fermer ✕</button><img src="${esc(src)}" alt="${esc(alt)}">`;
  lightbox.hidden = false;
  lightbox.querySelector('button').focus();
}
function closeLightbox() { lightbox.hidden = true; lightbox.innerHTML = ''; }
lightbox.addEventListener('click', closeLightbox);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightbox.hidden) closeLightbox(); });

/* ---------------------------------------------------------------- routeur */

const REC = '(rec[A-Za-z0-9]{14})';
const routes = [
  [/^\/login$/, () => renderLogin(), { public: true }],
  [/^\/?$/, () => renderHome()],
  [new RegExp(`^/enfant/${REC}$`), (m) => renderProfile(m[1])],
  [new RegExp(`^/enfant/${REC}/agenda$`), (m) => renderAgenda(m[1])],
  [new RegExp(`^/enfant/${REC}/agenda/${REC}$`), (m) => renderEvent(m[1], m[2])],
  [new RegExp(`^/enfant/${REC}/allergies$`), (m, q) => renderAllergies(m[1], /^rec[A-Za-z0-9]{14}$/.test(q.get('from') || '') ? q.get('from') : null)],
];

let renderId = 0;
async function render() {
  const id = ++renderId;
  closeLightbox();
  app.onclick = null;
  const [path, qs = ''] = (location.hash.slice(1) || '/').split('?');
  const query = new URLSearchParams(qs);
  const match = routes.map(([re, fn, opts]) => [path.match(re), fn, opts || {}]).find(([m]) => m);

  try {
    if (!state.user) {
      state.user = await api('/api/me').then((d) => d.user).catch(() => null);
      if (id !== renderId) return;
    }
    if (!match) throw new ApiError(404, "Cette page n'existe pas.");
    const [m, fn, opts] = match;
    if (!opts.public && !state.user) return go('/login');
    if (opts.public && state.user) return go('/');
    await fn(m, query);
    if (id === renderId) window.scrollTo(0, 0);
  } catch (err) {
    if (id !== renderId || err.status === 401) return;
    const childId = path.match(/^\/enfant\/(rec[A-Za-z0-9]{14})/)?.[1];
    app.innerHTML = `${state.user ? topbar() : ''}<main class="page">${errorView(err, err.status === 404 ? null : childId)}</main>`;
  }
}

window.addEventListener('hashchange', render);
render();
