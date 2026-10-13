/* Bao Bite Noodle Bar test prototype, round 3 "the ticket" (see ../DESIGN.md).
   No libraries. Everything works without motion; html.motion only adds the entrance, the paper feed and the flying plate.
   The ticket lives in localStorage (bb-ticket) so it survives a reload on the street. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width: 1100px)');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode: not saved */ } },
  };
  if (!reduce) root.classList.add('motion');

  const DATA = JSON.parse($('#dish-data').textContent);
  const sep = (n, c) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, c);
  // English readers would take 3.290 kr for 3.29, so English gets ISK 3,290 (same rule as the build)
  const money = (n) => `<span lang="en">ISK ${sep(n, ',')}</span><span lang="is">${sep(n, '.')} kr</span>`;
  const both = (en, is) => `<span lang="is">${is}</span><span lang="en">${en}</span>`;
  const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const smooth = () => (reduce ? 'auto' : 'smooth');
  const hdrH = () => $('#hdr').offsetHeight;
  const goTo = (el) => {
    if (!el) return;
    const land = el === document.body ? null : (el.matches('section') && el.querySelector('h2')) || el; // sections land on their heading
    const y = land ? Math.max(0, Math.round(land.getBoundingClientRect().top + scrollY - hdrH() - 24)) : 0;
    window.scrollTo({ top: y, behavior: smooth() });
  };

  /* ------------------------------------------------------------------ language */
  const setLang = (l) => {
    root.lang = l;
    $$('.lang__b').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    store.set('bb-lang', l);
  };
  $$('.lang__b').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  setLang(root.lang === 'is' ? 'is' : 'en');

  /* ------------------------------------------------------------------ drawer (narrow screens) */
  const drawer = $('#drawer');
  const burger = $('.hdr__burger');
  /* drawer and open ticket never stack: both set their state, then one function decides what is inert */
  const syncInert = () => {
    const d = !drawer.hidden, t = ticketOpen();
    $('#main').inert = d || t; $('.foot').inert = d || t; $('#hdr').inert = t; $('.stub').inert = d || t;
  };
  const setDrawer = (open) => {
    if (open && ticketOpen()) closeTicket(false);
    root.classList.toggle('drawer-open', open);
    drawer.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    syncInert();
    if (open) $('.drawer__a', drawer).focus({ preventScroll: true });
  };
  burger.addEventListener('click', () => setDrawer(drawer.hidden));
  matchMedia('(min-width: 760px)').addEventListener('change', (e) => { if (e.matches && !drawer.hidden) setDrawer(false); });

  /* ------------------------------------------------------------------ in-page links; the logo always lands at the top */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"], a[href^="?k="]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const href = a.getAttribute('href');
    e.preventDefault();
    if (!drawer.hidden) setDrawer(false);
    if (ticketOpen()) closeTicket(false);
    if (href.startsWith('?k=')) {
      setFilter(a.dataset.kitchen || 'all', true);
      goTo($('#menu'));
      return;
    }
    if (href === '#top') { goTo(document.body); history.replaceState(null, '', location.pathname + location.search); return; }
    const t = $(href);
    if (t) { goTo(t); history.replaceState(null, '', href); }
  });

  /* ------------------------------------------------------------------ menu: filters and view */
  const list = $('.dishes');
  const items = $$('.dishes > li');
  const KITCHENS = ['thai', 'vietnamese', 'korean', 'wok', 'small', 'vegan'];
  function setFilter(k, fromUser) {
    if (k !== 'all' && !KITCHENS.includes(k)) k = 'all';
    $$('.filter').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kitchen === k)));
    items.forEach((li) => { li.hidden = k !== 'all' && li.dataset.kitchen !== k; });
    const url = new URL(location.href);
    if (k === 'all') url.searchParams.delete('k'); else url.searchParams.set('k', k);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    if (fromUser) {
      const n = items.filter((li) => !li.hidden && li.classList.contains('dish')).length;
      $('#ticket-status').textContent = root.lang === 'is' ? `${n} réttir sýndir.` : `${n} dishes shown.`;
    }
    if (fromUser && !reduce) {
      const shown = items.filter((li) => !li.hidden).slice(0, 10);
      shown.forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 30, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    }
  }
  $$('.filter').forEach((b) => b.addEventListener('click', () => {
    setFilter(b.dataset.kitchen, true);
    const top = $('.menu__body').getBoundingClientRect().top;
    if (top < hdrH()) goTo($('.menu__body'));
  }));
  setFilter(new URLSearchParams(location.search).get('k') || 'all', false);

  const setView = (v) => {
    list.dataset.view = v;
    $$('.view__b').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    store.set('bb-view', v);
  };
  $$('.view__b').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  setView(store.get('bb-view') === 'list' ? 'list' : 'photos');

  /* ------------------------------------------------------------------ the ticket */
  const ticket = $('#ticket');
  const rowsEl = $('.ticket__rows', ticket);
  const stub = $('.stub');
  let order = new Map();
  try {
    const saved = JSON.parse(store.get('bb-ticket') || '[]');
    if (Array.isArray(saved)) saved.forEach(([c, q]) => { if (DATA[c] && q > 0) order.set(c, Math.min(20, q | 0)); });
  } catch (_) { /* a broken saved ticket starts empty */ }

  const save = () => store.set('bb-ticket', JSON.stringify([...order]));
  const total = () => [...order].reduce((s, [c, q]) => s + DATA[c].p * q, 0);
  const dishes = () => [...order.values()].reduce((s, q) => s + q, 0);

  function renderTicket(newCode) {
    rowsEl.innerHTML = [...order].map(([c, q]) => {
      const d = DATA[c];
      return `<li class="trow${c === newCode ? ' is-new' : ''}" data-code="${c}">
        <span class="trow__q">${q}×</span>
        <span class="trow__c" translate="no">${c}</span>
        <span class="trow__n">${both(escH(d.en), escH(d.is))}</span>
        <span class="trow__p">${money(d.p * q)}</span>
        <button class="trow__x" type="button" data-remove="${c}">${both('Remove', 'Fjarlægja')}<span class="visually-hidden"> ${both(escH(d.en), escH(d.is))}</span></button>
      </li>`;
    }).join('');
    const n = dishes();
    ticket.classList.toggle('has-items', n > 0);
    $('.ticket__sum', ticket).innerHTML = money(total());
    $$('.ticket-count').forEach((s) => { s.textContent = n; });
    stub.hidden = n === 0;
    root.classList.toggle('has-stub', n > 0);
    $('.stub__n', stub).innerHTML = both(`${n} ${n === 1 ? 'dish' : 'dishes'}`, `${n} ${n === 1 ? 'réttur' : 'réttir'}`);
    $('.stub__sum', stub).innerHTML = money(total());
    $$('.add').forEach((a) => {
      const q = order.get(a.dataset.add) || 0;
      a.classList.toggle('is-on', q > 0);
      $('.add__n', a).textContent = q;
      a.closest('.dish').classList.toggle('is-on', q > 0);
    });
  }

  function change(code, step, from) {
    const q = Math.max(0, Math.min(20, (order.get(code) || 0) + step));
    if (q === 0) order.delete(code); else order.set(code, q);
    save();
    renderTicket(step > 0 ? code : null);
    const d = DATA[code]; const n = dishes();
    $('#ticket-status').textContent = root.lang === 'is'
      ? `${d.is}: ${q} á miðanum. ${n} ${n === 1 ? 'réttur' : 'réttir'} alls.`
      : `${d.en}: ${q} on your ticket. ${n} ${n === 1 ? 'dish' : 'dishes'} in total.`;
    if (step > 0 && from) { fly(from, code); bump(); }
  }

  function bump() {
    if (reduce) return;
    $$('.hdr__ticket').forEach((b) => { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); });
    if (wide.matches) { ticket.classList.remove('feed'); void ticket.offsetWidth; ticket.classList.add('feed'); }
  }

  /* the plate copy travels to wherever the ticket is on this screen */
  function fly(from, code) {
    if (reduce || !from) return;
    const src = from.closest('.dish')?.querySelector('.dish__img');
    if (!src || !src.offsetParent) return;
    const target = wide.matches ? $('.ticket__rows', ticket).lastElementChild || $('.ticket__paper', ticket)
      : (!stub.hidden ? stub : $('.hdr__ticket'));
    const a = src.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const ghost = src.cloneNode(false);
    ghost.removeAttribute('srcset');
    ghost.src = `img/dish/${DATA[code].photo}.webp`;
    ghost.className = 'fly';
    ghost.alt = '';
    ghost.style.width = a.width + 'px';
    ghost.style.height = a.height + 'px';
    document.body.appendChild(ghost);
    const tx = b.left + b.width / 2 - (a.left + a.width / 2);
    const ty = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = Math.max(0.12, Math.min(0.3, 56 / a.width));
    const anim = ghost.animate([
      { transform: `translate(${a.left}px, ${a.top}px) rotate(0deg) scale(1)`, opacity: 1 },
      { transform: `translate(${a.left + tx * 0.5}px, ${a.top + ty * 0.5 - 90}px) rotate(-14deg) scale(${(1 + s) / 2})`, opacity: 1, offset: 0.55 },
      { transform: `translate(${a.left + tx}px, ${a.top + ty}px) rotate(-24deg) scale(${s})`, opacity: 0 },
    ], { duration: 460, easing: 'cubic-bezier(.33,0,.2,1)' });
    anim.onfinish = anim.oncancel = () => ghost.remove();
  }

  document.addEventListener('click', (e) => {
    const step = e.target.closest('.add [data-step]');
    if (step) {
      const box = step.closest('.add');
      change(box.dataset.add, Number(step.dataset.step), e.detail === 0 ? null : step); // keyboard presses (detail 0) skip the flight
      if (!step.getClientRects().length) $('.add__plus', box).focus({ preventScroll: true }); // the minus hides at zero
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      order.delete(rm.dataset.remove); save(); renderTicket();
      const next = $('.trow__x', rowsEl);
      if (next) next.focus(); else if (ticketOpen()) $('[data-close-ticket]', ticket).focus(); else visibleFocus(null);
    }
  });

  /* Clear asks twice: the first tap arms it for three seconds */
  const clearBtn = $('[data-clear]', ticket);
  let armed = 0;
  clearBtn.addEventListener('click', () => {
    if (!armed) {
      clearBtn.dataset.label = clearBtn.innerHTML;
      clearBtn.innerHTML = both('Tap again to clear', 'Smelltu aftur til að hreinsa');
      armed = setTimeout(() => { clearBtn.innerHTML = clearBtn.dataset.label; armed = 0; }, 3000);
      return;
    }
    clearTimeout(armed); armed = 0; clearBtn.innerHTML = clearBtn.dataset.label;
    order.clear(); save(); renderTicket();
    if (ticketOpen()) closeTicket(true); else visibleFocus(null);
    $('#ticket-status').textContent = root.lang === 'is' ? 'Miðinn er tómur.' : 'Your ticket is empty.';
  });

  /* focus goes back to the control that opened something, or the nearest visible stand-in for it */
  function visibleFocus(el) {
    const seen = (x) => x && x.isConnected && x.getClientRects().length && !x.closest('[inert]');
    const target = [el, $('.hdr__ticket'), stub, $('.ticket__h', ticket), $('#menu-h')].find(seen);
    if (!target) return;
    if (!target.matches('a, button')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  /* open = full screen, to hold up at the till */
  let opener = null;
  const ticketOpen = () => ticket.dataset.state === 'open';
  function openTicket(from) {
    opener = from || document.activeElement;
    ticket.dataset.state = 'open';
    ticket.setAttribute('role', 'dialog');
    ticket.setAttribute('aria-modal', 'true');
    root.classList.add('ticket-open');
    if (!drawer.hidden) { root.classList.remove('drawer-open'); drawer.hidden = true; burger.setAttribute('aria-expanded', 'false'); }
    $$('[data-open-ticket]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    syncInert();
    $('[data-close-ticket]', ticket).focus({ preventScroll: true });
  }
  function closeTicket(restore = true) {
    ticket.dataset.state = 'docked';
    ticket.removeAttribute('role');
    ticket.removeAttribute('aria-modal');
    root.classList.remove('ticket-open');
    $$('[data-open-ticket]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    syncInert();
    if (restore) visibleFocus(opener);
  }
  $$('[data-open-ticket]').forEach((b) => b.addEventListener('click', () => openTicket(b)));
  $('[data-counter]', ticket).addEventListener('click', (e) => openTicket(e.currentTarget));
  $('[data-close-ticket]', ticket).addEventListener('click', () => closeTicket(true));
  ticket.addEventListener('click', (e) => { if (ticketOpen() && e.target === ticket) closeTicket(true); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (ticketOpen()) closeTicket(true);
      else if (!drawer.hidden) { setDrawer(false); burger.focus(); }
      return;
    }
    if (e.key !== 'Tab') return;
    const scope = ticketOpen() ? [ticket] : (!drawer.hidden ? [$('#hdr'), drawer] : null);
    if (!scope) return;
    const focusables = $$('a[href], button:not([disabled])').filter((el) => scope.some((c) => c.contains(el)) && el.getClientRects().length && !el.closest('[inert]')); // document order
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  renderTicket();

  /* ------------------------------------------------------------------ arrival */
  if (!reduce && 'IntersectionObserver' in window) {
    const below = items.filter((li) => li.classList.contains('dish') && li.getBoundingClientRect().top > innerHeight);
    below.forEach((li) => li.classList.add('pre'));
    const io = new IntersectionObserver((entries) => {
      let i = 0;
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const li = en.target;
        li.style.transitionDelay = (i++ % 4) * 0.06 + 's';
        li.classList.remove('pre');
        io.unobserve(li);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    below.forEach((li) => io.observe(li));
    const band = $('.band');
    const bio = new IntersectionObserver((en) => { if (en[0].isIntersecting) { band.classList.add('is-painted'); bio.disconnect(); } }, { rootMargin: '0px 0px -20% 0px' });
    bio.observe(band);
  }
  const ready = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));
  if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(ready);
  else ready();
})();
