// The Strux app: the catalogue, the home page and the topic player.
(function (SEE) {
  'use strict';
  const X = SEE.Strux;
  const { h, icon } = SEE.UI;
  const store = SEE.UI.storage;
  const SPEEDS = [1700, 1150, 800, 560, 380, 240];

  class App {
    constructor() {
      X.app = this;
      this.settings = Object.assign({ theme: 'auto', projector: false, speed: 2, predict: true, sound: false }, store.get('settings', {}));
      this.done = new Set(store.get('done', []));
      this.applyTheme();
      try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (this.settings.theme === 'auto') this.applyTheme(); }); } catch (e) { /* old browsers */ }
      this.buildTop();
      this.renderSide();
      window.addEventListener('hashchange', () => this.route());
      document.addEventListener('keydown', (e) => this.onKey(e));
      this.route();
      window.__struxReady = true;
    }
    saveSettings() { store.set('settings', this.settings); }
    applyTheme() {
      let t = this.settings.theme;
      if (t === 'auto') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
      document.documentElement.dataset.projector = this.settings.projector ? 'on' : 'off';
      if (this.btnTheme) { this.btnTheme.innerHTML = ''; this.btnTheme.appendChild(icon(t === 'dark' ? 'sun' : 'moon')); }
      if (this.btnProj) this.btnProj.classList.toggle('on', !!this.settings.projector);
    }

    // ---- frame of the page -------------------------------------------------------------------------
    buildTop() {
      const menu = document.getElementById('btnMenu');
      menu.appendChild(icon('menu'));
      menu.addEventListener('click', () => document.getElementById('app').classList.toggle('menu-open'));
      document.getElementById('brand').addEventListener('click', (e) => { e.preventDefault(); location.hash = ''; });
      const nav = document.getElementById('topNav');
      for (const [id, label] of [['', 'Topics'], ['courses', 'Courses'], ['compare', 'Compare']]) {
        const b = h('button', { type: 'button', dataset: { route: id } }, label);
        b.addEventListener('click', () => { location.hash = id; });
        nav.appendChild(b);
      }
      const tools = document.getElementById('topTools');
      this.btnProj = h('button.icon-btn', { type: 'button', title: 'Projector mode: large type for a classroom', 'aria-label': 'Projector mode', id: 'btnProjector' }, icon('screen'));
      this.btnProj.addEventListener('click', () => { this.settings.projector = !this.settings.projector; this.saveSettings(); this.applyTheme(); if (this.player) this.player.redraw(); });
      this.btnTheme = h('button.icon-btn', { type: 'button', title: 'Light or dark', 'aria-label': 'Light or dark', id: 'btnTheme' });
      this.btnTheme.addEventListener('click', () => { this.settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; this.saveSettings(); this.applyTheme(); });
      const about = h('button.icon-btn', { type: 'button', title: 'About Strux', 'aria-label': 'About', id: 'btnAbout' }, icon('help'));
      about.addEventListener('click', () => this.aboutMenu(about));
      tools.append(this.btnProj, this.btnTheme, about);
      this.applyTheme();
    }
    aboutMenu(anchor) {
      const r = anchor.getBoundingClientRect();
      SEE.UI.showMenu([
        { label: 'Keyboard shortcuts', action: () => this.shortcuts() },
        { label: 'Settings…', action: () => this.settingsDialog() },
        { sep: true },
        { label: 'About Strux', action: () => this.about() },
        { label: 'About the author', action: () => SEE.authorDialog && SEE.authorDialog() },
      ], r.right - 220, r.bottom + 4, { anchor, keyboard: true });
    }

    route() {
      const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
      document.getElementById('app').classList.remove('menu-open');
      if (this.player) { this.player.dispose(); this.player = null; }
      for (const b of document.querySelectorAll('#topNav button')) b.classList.toggle('on', b.dataset.route === (hash.startsWith('topic=') ? '' : hash));
      const main = document.getElementById('main');
      main.innerHTML = '';
      main.scrollTop = 0;
      if (hash.startsWith('topic=')) {
        const [id, q] = hash.slice(6).split('?');
        const t = X.byId(id);
        if (t) { this.openTopic(t, q); return; }
      }
      if (hash === 'courses' && X.Courses) { X.Courses.render(this, main); return; }
      if (hash.startsWith('course=') && X.Courses) { X.Courses.open(this, main, hash.slice(7)); return; }
      if (hash.startsWith('compare') && X.Compare) { X.Compare.render(this, main, hash.slice(8)); return; }
      this.renderHome(main);
      this.renderSide();
    }

    // ---- catalogue ---------------------------------------------------------------------------------
    renderSide(current) {
      const side = document.getElementById('side');
      // the search box stays put (so it keeps focus while typing); only the list under it is redrawn
      let search = side.querySelector('.cat-search');
      if (!search) {
        search = h('input.cat-search', { type: 'search', placeholder: 'Find a topic', 'aria-label': 'Find a topic', id: 'catSearch' });
        search.addEventListener('input', () => this.renderSide(this.sideCurrent));
      }
      this.sideCurrent = current;
      const q = search.value;
      for (const c of [...side.children]) if (c !== search) c.remove();
      if (!search.parentNode) side.appendChild(search);
      const query = q.trim().toLowerCase();
      const open = new Set(store.get('openFams', []));
      if (current) open.add(current.family);
      for (const g of X.groups) {
        const fams = X.families.filter((f) => f.group === g);
        const blocks = [];
        for (const f of fams) {
          const ts = X.topics.filter((t) => t.family === f.id && (!query || (t.title + ' ' + f.title + ' ' + (t.blurb || '')).toLowerCase().includes(query)));
          if (!ts.length) continue;
          const fam = h('div.cat-fam' + (open.has(f.id) || query ? '.open' : ''), { dataset: { fam: f.id } });
          const head = h('button', { type: 'button', 'aria-expanded': String(open.has(f.id) || !!query) }, h('span', f.title), h('span.n', String(ts.length)));
          head.addEventListener('click', () => {
            if (open.has(f.id)) open.delete(f.id); else open.add(f.id);
            store.set('openFams', [...open]);
            fam.classList.toggle('open');
            head.setAttribute('aria-expanded', String(fam.classList.contains('open')));
          });
          const list = h('div.cat-topics');
          for (const t of ts) {
            const b = h('button.cat-topic' + (current === t ? '.on' : ''), { type: 'button', dataset: { topic: t.id } }, t.title, this.done.has(t.id) ? h('span.done', ' ✓') : null);
            b.addEventListener('click', () => { location.hash = 'topic=' + t.id; });
            list.appendChild(b);
          }
          fam.append(head, list);
          blocks.push(fam);
        }
        if (!blocks.length) continue;
        side.appendChild(h('div.cat-group', g));
        for (const b of blocks) side.appendChild(b);
      }
    }

    renderHome(main) {
      const box = h('div.home');
      box.append(
        h('h1', 'Watch your data structures think.'),
        h('p.lead', 'Every animation here is real C89 running on a simulated 32-bit machine. Choose the data, press play, and see every pointer move, every comparison and every swap, line by line. Pause to predict what happens next.'),
      );
      for (const g of X.groups) {
        box.appendChild(h('h2', { style: { marginTop: '26px', fontSize: '18px' } }, g));
        const grid = h('div.fam-grid');
        for (const f of X.families.filter((x) => x.group === g)) {
          const n = X.topics.filter((t) => t.family === f.id).length;
          if (!n) continue;
          const card = h('button.fam-card', { type: 'button', dataset: { fam: f.id } }, h('h3', f.title), h('p', f.blurb || ''), h('span.n', n + ' topic' + (n === 1 ? '' : 's')));
          card.addEventListener('click', () => { const first = X.topics.find((t) => t.family === f.id); if (first) location.hash = 'topic=' + first.id; });
          grid.appendChild(card);
        }
        box.appendChild(grid);
      }
      main.appendChild(box);
    }

    // ---- a topic -----------------------------------------------------------------------------------
    openTopic(t, query) {
      this.renderSide(t);
      const main = document.getElementById('main');
      const given = {};
      if (query) for (const part of query.split('&')) { const [k, v] = part.split('='); try { given[k] = JSON.parse(decodeURIComponent(v)); } catch (e) { /* ignore */ } }
      this.player = new X.Player(this, main, t, X.inputOf(t, Object.keys(given).length ? given : store.get('in:' + t.id, null)));
      document.title = t.title + ' · ' + X.familyOf(t).title + ' · Strux';
    }
    markDone(t) { this.done.add(t.id); store.set('done', [...this.done]); this.renderSide(t); }

    onKey(e) {
      if (SEE.UI.anyModalOpen()) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      const p = this.player;
      if (!p) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); p.toggle(); }
      else if (e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); p.step(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'j') { e.preventDefault(); p.step(-1); }
      else if (e.key === 'Home') { e.preventDefault(); p.go(0); }
      else if (e.key === 'End') { e.preventDefault(); p.go(p.frames.length - 1); }
      else if (e.key === 'r') { e.preventDefault(); p.go(0); p.play(); }
    }
    shortcuts() {
      const rows = [['Space', 'Play or pause'], ['→', 'Next step'], ['←', 'Step back'], ['Home / End', 'First or last step'], ['R', 'From the start']];
      SEE.UI.modal({ title: 'Keyboard shortcuts', body: h('table', ...rows.map(([k, v]) => h('tr', h('td', { style: { padding: '3px 14px 3px 0' } }, h('kbd', k)), h('td', v)))), buttons: [{ label: 'OK', value: true, primary: true }] });
    }
    settingsDialog() {
      const s = this.settings;
      const chk = (key, label) => { const c = h('input', { type: 'checkbox', checked: !!s[key] }); c.addEventListener('change', () => { s[key] = c.checked; this.saveSettings(); this.applyTheme(); }); return h('label', { style: { display: 'flex', gap: '8px', margin: '6px 0' } }, c, label); };
      SEE.UI.modal({ title: 'Settings', body: h('div', chk('predict', 'Stop and ask me to predict at key moments'), chk('sound', 'Soft sounds for comparisons and swaps'), chk('projector', 'Projector mode (large type)')), buttons: [{ label: 'Close', value: true, primary: true }] });
    }
    about() {
      const more = h('a', { href: '#' }, 'About the author');
      more.addEventListener('click', (e) => { e.preventDefault(); SEE.UI.closeAllModals(); setTimeout(() => SEE.authorDialog && SEE.authorDialog(), 50); });
      SEE.UI.modal({
        title: 'About Strux',
        body: h('div', h('p', h('b', 'Strux'), ' @@VERSION@@ animates data structures and algorithms by running real C89 code on a simulated 32-bit machine, the same machine as in See. Every node, pointer and comparison you see is read from that program\'s memory as it runs.'),
          h('p', 'Free software under the GNU General Public License, version 3 or later. Every copy and every derived work must keep this attribution: Based on "Strux" by Jyotiprakash Mishra (https://strux.jyotiprakash.org).'), h('p', 'Copyright © 2026 Jyotiprakash Mishra. The names Strux and See are not licensed for derived works.'), h('p', more)),
        buttons: [{ label: 'OK', value: true, primary: true }],
      });
    }
  }

  X.App = App;
  if (SEE.isBrowser) {
    const start = () => { try { new App(); } catch (e) { document.body.innerHTML = '<pre style="padding:20px;white-space:pre-wrap">Strux could not start: ' + SEE.escapeHtml(e.stack || e.message) + '</pre>'; throw e; } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
})(SEE);
