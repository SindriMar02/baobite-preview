/* Bao Bite Noodle Bar test prototype, round 4: walk the brush (round 2) + the ticket (round 3). See ../DESIGN.md.
   ui() always runs: language, drawer, links, filters, preview, the ticket. motion() runs only when the visitor has not asked
   for reduced motion and GSAP loaded; if it throws, the page falls back to the plain render.
   The ticket lives in localStorage (bb-ticket) so it survives a reload on the street. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const wide = matchMedia('(min-width: 1100px)');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const libs = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const motionOn = !reduce && libs;
  if (motionOn) root.classList.add('motion');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode: not saved */ } },
  };

  let lenis = null;
  let busy = false; // a page wipe is running
  let userPaused = false;
  let marquee = null;
  let marqueeInView = false;
  const refresh = () => { if (motionOn && window.ScrollTrigger && root.classList.contains('ready')) ScrollTrigger.refresh(); };

  const DATA = JSON.parse($('#dish-data').textContent);
  const sep = (n, c) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, c);
  // English readers would take 3.290 kr for 3.29, so English gets ISK 3,290 (same rule as the build)
  const money = (n) => `<span lang="en">ISK ${sep(n, ',')}</span><span lang="is">${sep(n, '.')} kr</span>`;
  const both = (en, is) => `<span lang="is">${is}</span><span lang="en">${en}</span>`;
  const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  /* ------------------------------------------------------------------ scrolling */
  const easeOut4 = (t) => 1 - Math.pow(1 - t, 4);
  const hdrH = () => $('#hdr').offsetHeight;
  const landY = (el) => {
    if (el === document.body) return 0;
    const land = (el.matches('section') && el.querySelector('h2')) || el; // sections land on their heading
    return Math.max(0, Math.round(land.getBoundingClientRect().top + scrollY - hdrH() - 24));
  };
  function scrollToY(y, instant) {
    if (lenis) { lenis.start(); lenis.scrollTo(y, instant ? { immediate: true, force: true } : { duration: 1.2, easing: easeOut4, force: true }); }
    else window.scrollTo({ top: y, behavior: instant || reduce ? 'auto' : 'smooth' });
  }
  /* brush-stroke page transition: four strokes in, jump while covered, four strokes out */
  function wipe(jump) {
    if (!motionOn || busy) { jump(); return; }
    busy = true;
    const strokes = $$('.wipe__s');
    const w = $('.wipe');
    gsap.timeline({ onComplete: () => { busy = false; } })
      .set(w, { autoAlpha: 1 })
      .fromTo(strokes, { xPercent: -112 }, { xPercent: 0, duration: 0.34, ease: 'power3.out', stagger: 0.04 })
      .add(jump)
      .to(strokes, { xPercent: 112, duration: 0.36, ease: 'power3.out', stagger: 0.04 }, '+=0.05')
      .set(w, { autoAlpha: 0 });
  }

  /* ------------------------------------------------------------------ language */
  const setLang = (l) => {
    root.lang = l;
    $$('.lang__b').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    store.set('bb-lang', l);
    refresh();
  };
  $$('.lang__b').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  setLang(root.lang === 'is' ? 'is' : 'en');

  /* ------------------------------------------------------------------ drawer and the open ticket never stack; one function decides what is inert */
  const drawer = $('#drawer');
  const burger = $('.hdr__burger');
  const ticket = $('#ticket');
  const stub = $('.stub');
  const ticketOpen = () => ticket.dataset.state === 'open';
  const syncInert = () => {
    const d = !drawer.hidden, t = ticketOpen();
    $('#main').inert = d || t; $('.foot').inert = d || t; $('#hdr').inert = t; stub.inert = d || t;
    if (lenis) { if (d || t) lenis.stop(); else lenis.start(); }
  };
  let byKey = false;
  const setDrawer = (open) => {
    if (open && ticketOpen()) closeTicket(false);
    root.classList.toggle('drawer-open', open);
    drawer.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
    syncInert();
    if (open && byKey) $('.drawer__a', drawer).focus({ preventScroll: true }); // a finger tap keeps focus where it is (no ring)
  };
  burger.addEventListener('click', (e) => { byKey = e.detail === 0; setDrawer(drawer.hidden); });
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches && !drawer.hidden) setDrawer(false); });

  /* ------------------------------------------------------------------ in-page links; the logo always lands at the top */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"], a[href^="?k="]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const href = a.getAttribute('href');
    e.preventDefault();
    if (!drawer.hidden) setDrawer(false);
    if (ticketOpen()) closeTicket(false);
    if (href === '#top') { scrollToY(0); history.replaceState(null, '', location.pathname + location.search); return; }
    const target = $(href.startsWith('?k=') ? '#menu' : href);
    if (!target) return;
    if (href.startsWith('?k=')) setFilter(a.dataset.kitchen || 'all', false);
    const go = () => {
      refresh();
      scrollToY(landY(target), true);
      const h = $('h2', target) || target; h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
    };
    if (motionOn && e.detail !== 0) wipe(go); /* keyboard activation (detail 0) never animates */
    else if (motionOn) go();
    else { scrollToY(landY(target)); const h = $('h2', target) || target; h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    history.replaceState(null, '', href.startsWith('?k=') ? href : href);
  });

  /* ------------------------------------------------------------------ menu: filters */
  const items = $$('.dishes > li');
  const KITCHENS = ['thai', 'vietnamese', 'korean', 'wok', 'small', 'vegan'];
  function setFilter(k, fromUser) {
    if (k !== 'all' && !KITCHENS.includes(k)) k = 'all';
    $$('.filter').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kitchen === k)));
    const row = $('.filters'), on = $('.filter[aria-pressed="true"]');
    if (row.scrollWidth > row.clientWidth && on) row.scrollTo({ left: Math.max(0, on.offsetLeft - row.offsetLeft - 16), behavior: fromUser && !reduce ? 'smooth' : 'auto' }); // keep the active kitchen in view on phones
    items.forEach((li) => { li.hidden = k !== 'all' && li.dataset.kitchen !== k; });
    const url = new URL(location.href);
    if (k === 'all') url.searchParams.delete('k'); else url.searchParams.set('k', k);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    const first = items.find((li) => !li.hidden && li.dataset.photo);
    if (first) showPreview(first, true);
    if (fromUser) {
      const n = items.filter((li) => !li.hidden && li.classList.contains('dish')).length;
      $('#ticket-status').textContent = root.lang === 'is' ? `${n} réttir sýndir.` : `${n} dishes shown.`;
      if (!reduce) items.filter((li) => !li.hidden).slice(0, 10).forEach((li, i) => li.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 30, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    }
    refresh();
  }
  $$('.filter').forEach((b) => b.addEventListener('click', () => {
    setFilter(b.dataset.kitchen, true);
    const top = $('.menu__grid').getBoundingClientRect().top;
    if (top < hdrH()) scrollToY(landY($('#menu')), false);
  }));

  /* the preview beside the menu (desktop): the dish on the ground it reads best on */
  const stage = $('[data-preview]');
  const pImg = $('.preview__img');
  const pFx = $('.preview__fx');
  let current = null;
  function showPreview(row, force) {
    if (!row || !stage || (row === current && !force) || !matchMedia('(min-width: 900px)').matches) return;
    current = row;
    $$('.row.is-active').forEach((r) => r.classList.remove('is-active'));
    row.classList.add('is-active');
    const photo = row.dataset.photo;
    pFx.style.opacity = '0';
    pFx.style.transform = 'translateY(16px) scale(.94) rotate(-4deg)';
    setTimeout(() => {
      if (current !== row) return;
      stage.className = 'preview__stage g-' + (row.dataset.ground || 'flame');
      pImg.src = row.dataset.hero === '1' ? `img/hero/${photo}.webp` : `img/dish/${photo}.webp`;
      pImg.dataset.code = row.dataset.code;
      pFx.style.opacity = '1';
      pFx.style.transform = 'none';
    }, reduce ? 0 : 110);
  }
  $$('.row[data-photo]').forEach((row) => {
    row.addEventListener('pointerenter', () => showPreview(row));
    row.addEventListener('focusin', () => showPreview(row));
  });
  /* while scrolling, the preview follows the row crossing the middle of the screen (the pointer still wins on hover) */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (fine && $('.rows:hover')) return;
      const hit = entries.filter((en) => en.isIntersecting).map((en) => en.target).pop();
      if (hit) showPreview(hit);
    }, { rootMargin: '-48% 0px -48% 0px' });
    $$('.row[data-photo]').forEach((row) => io.observe(row));
  }
  setFilter(new URLSearchParams(location.search).get('k') || 'all', false);

  /* tiles: the dish leans toward the pointer */
  if (fine) {
    $$('.tile').forEach((tile) => {
      const fx = $('.tile__fx', tile); // the variables live on the element that moves, so only it re-resolves
      tile.addEventListener('pointermove', (e) => {
        const r = tile.getBoundingClientRect();
        fx.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        fx.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
      tile.addEventListener('pointerleave', () => { fx.style.setProperty('--px', '0'); fx.style.setProperty('--py', '0'); });
    });
  }

  /* pause: the marquee is the only thing that moves on its own for more than five seconds */
  const toggles = $$('[data-motion-toggle]');
  toggles.forEach((t) => t.addEventListener('click', () => {
    userPaused = !userPaused;
    root.classList.toggle('motion-paused', userPaused);
    toggles.forEach((x) => {
      x.setAttribute('aria-pressed', String(userPaused));
      x.innerHTML = userPaused ? both('Play', 'Spila') : both('Pause', 'Stöðva');
    });
    if (marquee) marquee.paused(userPaused || !marqueeInView);
  }));
  if (!motionOn) toggles.forEach((t) => { t.hidden = true; });

  /* ------------------------------------------------------------------ the ticket */
  const rowsEl = $('.ticket__rows', ticket);
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
    stub.hidden = n === 0 && !wide.matches; // on wide screens the stub always hangs from the header
    root.classList.toggle('has-stub', !stub.hidden);
    $('.stub__n', stub).innerHTML = n ? both(`${n} ${n === 1 ? 'dish' : 'dishes'}`, `${n} ${n === 1 ? 'réttur' : 'réttir'}`) : both('empty', 'tómur');
    $('.stub__sum', stub).innerHTML = n ? money(total()) : '';
    $$('.add').forEach((a) => {
      const q = order.get(a.dataset.add) || 0;
      a.classList.toggle('is-on', q > 0);
      $('.add__n', a).textContent = q;
      const host = a.closest('.dish'); if (host) host.classList.toggle('is-on', q > 0);
    });
  }
  wide.addEventListener('change', () => renderTicket());

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
    stub.classList.remove('feed'); void stub.offsetWidth; stub.classList.add('feed');
  }

  /* the plate copy travels to wherever the ticket is on this screen */
  function fly(from, code) {
    if (reduce || !from) return;
    const host = from.closest('.dish, .j-beat');
    let src = host && [...host.querySelectorAll('.dish__img, .j-beat__img')].find((i) => i.getClientRects().length);
    if (!src && pImg && pImg.dataset.code === code && pImg.getClientRects().length) src = pImg; // desktop rows: the preview shows it
    if (!src || !DATA[code].photo) return;
    const target = !stub.hidden ? stub : $('.hdr__ticket');
    const a = src.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const ghost = document.createElement('img');
    ghost.src = `img/dish/${DATA[code].photo}.webp`;
    ghost.className = 'fly';
    ghost.alt = '';
    ghost.style.width = a.width + 'px';
    ghost.style.height = a.height + 'px';
    document.body.appendChild(ghost);
    const tx = b.left + b.width / 2 - (a.left + a.width / 2);
    const ty = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = Math.max(0.08, Math.min(0.3, 56 / a.width));
    const anim = ghost.animate([
      { transform: `translate(${a.left}px, ${a.top}px) rotate(0deg) scale(1)`, opacity: 1 },
      { transform: `translate(${a.left + tx * 0.5}px, ${a.top + ty * 0.5 - 90}px) rotate(-14deg) scale(${(1 + s) / 2})`, opacity: 1, offset: 0.55 },
      { transform: `translate(${a.left + tx}px, ${a.top + ty}px) rotate(-24deg) scale(${s})`, opacity: 0 },
    ], { duration: 460, easing: 'cubic-bezier(.33,0,.2,1)' });
    anim.onfinish = anim.oncancel = () => ghost.remove();
  }

  /* focus goes back to the control that opened something, or the nearest visible stand-in for it */
  function visibleFocus(el) {
    const seen = (x) => x && x.isConnected && x.getClientRects().length && !x.closest('[inert]');
    const target = [el, stub, $('.hdr__ticket'), $('#menu-h')].find(seen);
    if (!target) return;
    if (!target.matches('a, button')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
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

  /* open = full screen, to hold up at the till */
  let opener = null;
  function openTicket(from) {
    opener = from || document.activeElement;
    ticket.hidden = false;
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
    ticket.dataset.state = 'closed';
    ticket.hidden = true;
    ticket.removeAttribute('role');
    ticket.removeAttribute('aria-modal');
    root.classList.remove('ticket-open');
    $$('[data-open-ticket]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    syncInert();
    if (restore) visibleFocus(opener);
  }
  $$('[data-open-ticket]').forEach((b) => b.addEventListener('click', () => openTicket(b)));
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

  /* ------------------------------------------------------------------ motion (round 2's choreography) */
  function splitWords(h) {
    $$('span[lang]', h).forEach((sp) => {
      const text = sp.textContent;
      sp.textContent = '';
      sp.setAttribute('aria-label', text);
      text.split(' ').forEach((word, i, arr) => {
        const w = document.createElement('span');
        w.className = 'w'; w.setAttribute('aria-hidden', 'true');
        const inner = document.createElement('span');
        inner.textContent = word;
        w.appendChild(inner);
        sp.appendChild(w);
        if (i < arr.length - 1) sp.appendChild(document.createTextNode(' '));
      });
    });
  }

  function motion() {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    gsap.ticker.lagSmoothing(0); // entrances follow the wall clock

    /* Lenis only for a real wheel. Touch scroll stays native so iOS toolbars keep collapsing. */
    if (fine && typeof Lenis !== 'undefined') {
      lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true, syncTouch: false });
      lenis.on('scroll', ScrollTrigger.update);
      window.__lenis = lenis; // tools/verify.mjs drives it
      gsap.ticker.add((t) => lenis.raf(t * 1000));
    }
    const cl = (s) => `clamp(${s})`; // only ENDs are clamped: a clamped START breaks content already in a tall first viewport

    /* headline words rise out of masks */
    $$('[data-lines]').forEach((h) => {
      splitWords(h);
      $$('span[lang]', h).forEach((sp) => {
        gsap.fromTo($$('.w > span', sp), { yPercent: 112 }, { yPercent: 0, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: h, start: 'top 94%', end: cl('top 60%'), scrub: 0.5 } });
      });
    });

    /* hero entrance: the headline rises, the bowl is set down */
    const hero = $('.hero');
    gsap.timeline({ delay: 0.15, defaults: { ease: 'expo.out' } })
      .fromTo('.hero__line', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.1 }, 0)
      .fromTo('.hero__bowl .hero__dish', { opacity: 0, scale: 0.84, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 1.7 }, 0.25)
      .fromTo(['.hero__sub', '.hero__how'], { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1, stagger: 0.1 }, 0.55);

    /* the hero leaves slowly: bowl drifts and tightens, copy rises */
    gsap.to('.hero__bowl-fx', { yPercent: -9, scale: 0.94, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__copy', { yPercent: -8, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

    /* pointer parallax on the hero bowl (a mouse only); CSS individual `translate`, GSAP never touches this wrapper's transform */
    if (fine) {
      const bowl = $('.hero__bowl');
      let tx = 0; let ty = 0; let cx = 0; let cy = 0; let raf = 0;
      const step = () => { cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08; bowl.style.translate = `${cx.toFixed(2)}px ${cy.toFixed(2)}px`; raf = (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) ? requestAnimationFrame(step) : 0; };
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * -26;
        ty = ((e.clientY - r.top) / r.height - 0.5) * -20;
        if (!raf) raf = requestAnimationFrame(step);
      });
    }

    /* stage edges: the logo's brush is painted across as the section arrives (a comb of bristle tips, never a straight clip) */
    $$('.band').forEach((band) => {
      gsap.fromTo(band, { '--sq': 135 }, { '--sq': 30, ease: 'none', scrollTrigger: { trigger: band.parentElement, start: 'top 98%', end: cl('top 52%'), scrub: 0.4 } });
    });

    /* tiles: the dish rises into its colour */
    $$('.tile').forEach((tile) => {
      gsap.fromTo($('.tile__rise', tile), { yPercent: 26, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: tile, start: 'top 96%', end: cl('top 52%'), scrub: 0.5 } });
      gsap.fromTo($('.tile__name', tile), { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: tile, start: 'top 94%', end: cl('top 58%'), scrub: 0.5 } });
    });

    /* the one marquee: speeds up with scroll velocity, sleeps off screen and when paused */
    const track = $('.strip__track');
    if (track) {
      const tw = gsap.to(track, { xPercent: -50, duration: 44, ease: 'none', repeat: -1, paused: true });
      marquee = tw;
      let vel = 0;
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { vel = s.getVelocity(); } });
      gsap.ticker.add(() => { tw.timeScale(gsap.utils.interpolate(tw.timeScale(), 1 + Math.min(Math.abs(vel) / 500, 6), 0.08)); vel *= 0.9; });
      ScrollTrigger.create({ trigger: '.strip', start: 'top bottom', end: 'bottom top', onToggle: (s) => { marqueeInView = s.isActive; tw.paused(userPaused || !marqueeInView); } });
    }

    /* journey: walk the brush. Desktop pins and swaps beat by beat; narrow screens stack the beats (no pin). */
    const mm = gsap.matchMedia();
    const jr = $('.journey');
    const beats = $$('.j-beat');
    mm.add('(min-width: 900px)', () => {
      root.classList.add('pin');
      gsap.set(jr, { backgroundColor: beats[0].dataset.ground });
      const n = beats.length;
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: jr, start: 'top top', end: () => '+=' + Math.round(innerHeight * (n - 1) * 1.05 + innerHeight * 0.3), pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true } });
      const part = (b) => ({ word: $('.j-beat__word span', b), fx: $('.j-beat__fx', b), info: [$('.j-beat__info', b), $('.j-beat__buy', b)] });
      beats.forEach((b, i) => { if (i) gsap.set(b, { autoAlpha: 0 }); });
      for (let i = 0; i < n - 1; i++) {
        const a = part(beats[i]); const b = part(beats[i + 1]);
        const t = i;
        tl.to(jr, { backgroundColor: beats[i + 1].dataset.ground, duration: 0.8 }, t + 0.1)
          .to(a.word, { yPercent: -108, duration: 0.45, ease: 'power2.in' }, t + 0.1)
          .to(a.fx, { scale: 0.82, rotation: -16, opacity: 0, duration: 0.45, ease: 'power2.in' }, t + 0.1)
          .to(a.info, { opacity: 0, y: -26, duration: 0.3 }, t + 0.1)
          .fromTo(beats[i], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01 }, t + 0.58)
          .fromTo(beats[i + 1], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, t + 0.55)
          .fromTo(b.word, { yPercent: 108 }, { yPercent: 0, duration: 0.5, ease: 'power2.out' }, t + 0.55)
          .fromTo(b.fx, { scale: 1.18, rotation: 14, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, t + 0.55)
          .fromTo(b.info, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.4 }, t + 0.65);
      }
      tl.to({}, { duration: 0.35 }); // hold the last beat before unpinning
      return () => { root.classList.remove('pin'); gsap.set([jr, ...beats, ...$$('.j-beat__word span, .j-beat__fx, .j-beat__info, .j-beat__buy')], { clearProps: 'all' }); };
    });
    mm.add('(max-width: 899px)', () => {
      beats.forEach((b) => {
        gsap.fromTo($('.j-beat__word span', b), { yPercent: 100 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: b, start: 'top 90%', end: cl('top 40%'), scrub: 0.5 } });
        gsap.fromTo($('.j-beat__fx', b), { scale: 0.86, rotation: -8, opacity: 0.2 }, { scale: 1, rotation: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: b, start: 'top 85%', end: cl('top 35%'), scrub: 0.5 } });
      });
    });

    /* lunch price counts up once (the screen-reader text is a separate, static copy) */
    const priceNum = $('.lunch__num');
    if (priceNum) {
      const parts = $$('span[lang]', priceNum).map((sp) => ({ node: $('.lunch__n', sp).firstChild, sep: sp.lang === 'is' ? '.' : ',' }));
      const o = { v: 0 };
      const fmt = (v, s) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, s);
      parts.forEach((p) => { p.final = p.node.textContent; p.node.textContent = '0'; });
      ScrollTrigger.create({ trigger: priceNum, start: 'top 85%', once: true, onEnter: () => gsap.to(o, { v: 2800, duration: 1.4, ease: 'power3.out', onUpdate: () => parts.forEach((p) => { p.node.textContent = fmt(o.v, p.sep); }), onComplete: () => parts.forEach((p) => { p.node.textContent = p.final; }) }) });
    }
    gsap.fromTo('.lunch__fx', { yPercent: 14, rotation: -6 }, { yPercent: -6, rotation: 4, ease: 'none', scrollTrigger: { trigger: '.lunch', start: 'top bottom', end: 'bottom top', scrub: true } });

    /* find us: the bowl turns in; the receipt rows rise */
    gsap.fromTo('.visit__fx', { scale: 0.86, rotation: -10 }, { scale: 1, rotation: 0, ease: 'none', scrollTrigger: { trigger: '.visit', start: 'top 90%', end: cl('top 30%'), scrub: 0.6 } });
    gsap.fromTo($$('.act'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'none', stagger: 0.08, scrollTrigger: { trigger: '.visit__acts', start: 'top 94%', end: cl('top 60%'), scrub: 0.5 } });

    /* menu rows rise as the list enters */
    gsap.fromTo($$('.rows > li').slice(0, 14), { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'none', stagger: 0.07, scrollTrigger: { trigger: '.menu__grid', start: 'top 92%', end: cl('top 40%'), scrub: 0.5 } });

    /* GSAP now owns every start state; the css start-hidden rules are scoped to html:not(.ready) */
    root.classList.add('ready');

    /* a shared #menu link lands on the heading once the pin spacer exists */
    const t = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (t && t.matches('section')) requestAnimationFrame(() => { ScrollTrigger.refresh(); scrollToY(landY(t), true); });

    addEventListener('load', () => ScrollTrigger.refresh());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  if (motionOn) {
    try { motion(); } catch (err) {
      console.error('[baobite] motion failed, falling back to the plain render', err);
      root.classList.remove('motion'); root.classList.add('ready');
    }
  } else {
    root.classList.add('ready');
    const t = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (t && t.matches('section')) requestAnimationFrame(() => window.scrollTo(0, landY(t)));
  }
})();
