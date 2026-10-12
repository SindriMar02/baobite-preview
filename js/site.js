/* Bao Bite Noodle Bar test prototype. Motion identity: the brush (see ../DESIGN.md section 5).
   ui() always runs. motion() runs only when the visitor has not asked for reduced motion and GSAP loaded;
   if it throws, the page falls back to the plain render. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const libs = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const motionOn = !reduce && libs;
  const saver = !!(navigator.connection && navigator.connection.saveData);

  let lenis = null;
  let userPaused = false;
  let marquee = null;
  let marqueeInView = false;
  let busy = false; // a page transition is running

  const easeOut4 = (t) => 1 - Math.pow(1 - t, 4);
  const hdrH = () => $('#hdr').offsetHeight;

  /* ------------------------------------------------------------------ scrolling */
  function toTop() {
    if (lenis) { lenis.start(); lenis.scrollTo(0, { duration: 1.2, easing: easeOut4, force: true }); }
    else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
  /* nav targets land on the section heading, a little below the header */
  const landing = (el) => $('h2', el) || el;
  const landY = (el) => Math.max(0, Math.round(landing(el).getBoundingClientRect().top + scrollY - hdrH() - 28));
  function jumpTo(el) { // instant, used under the brush wipe
    if (!el) return;
    if (lenis) { lenis.start(); lenis.scrollTo(landY(el), { immediate: true, force: true }); }
    else window.scrollTo({ top: landY(el), behavior: 'auto' });
  }
  function glideTo(el) {
    if (!el) return;
    if (lenis) { lenis.start(); lenis.scrollTo(landY(el), { duration: 1.3, easing: easeOut4, force: true }); }
    else window.scrollTo({ top: landY(el), behavior: reduce ? 'auto' : 'smooth' });
  }

  /* brush-stroke page transition: four strokes in, jump while covered, four strokes out */
  function wipe(jump) {
    if (!motionOn || busy) { jump(); return; }
    busy = true;
    const strokes = $$('.wipe__s');
    const w = $('.wipe');
    gsap.timeline({ onComplete: () => { busy = false; } })
      .set(w, { autoAlpha: 1 })
      .fromTo(strokes, { xPercent: -112 }, { xPercent: 0, duration: 0.36, ease: 'power3.in', stagger: 0.045 })
      .add(jump)
      .to(strokes, { xPercent: 112, duration: 0.4, ease: 'power3.out', stagger: 0.045 }, '+=0.06')
      .set(w, { autoAlpha: 0 });
  }

  /* ------------------------------------------------------------------ ui (always) */
  function ui() {
    /* language: both are in the markup, we only flip the attribute */
    const setLang = (l) => {
      root.lang = l;
      $$('.lang__b').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
      try { localStorage.setItem('bb-lang', l); } catch (_) { /* private mode: not saved */ }
      if (motionOn && root.classList.contains('ready')) ScrollTrigger.refresh();
    };
    $$('.lang__b').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
    setLang(root.lang === 'is' ? 'is' : 'en');

    /* drawer (narrow screens). The logo sits above the open drawer, so a logo tap must close it too. */
    const drawer = $('#drawer');
    const burger = $('.hdr__burger');
    const setDrawer = (open) => {
      root.classList.toggle('drawer-open', open);
      drawer.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
      const use = $('use', burger);
      use.setAttribute('href', 'img/icons.svg#' + (open ? 'i-x-light' : 'i-list-light'));
      $('#main').inert = open;
      $('.foot').inert = open;
      $('.skip').inert = open;
      if (lenis) (open ? lenis.stop() : lenis.start());
      else document.body.style.overflow = open ? 'hidden' : '';
      if (open) { const first = $('a', drawer); if (first) first.focus({ preventScroll: true }); }
    };
    burger.addEventListener('click', () => setDrawer(!root.classList.contains('drawer-open')));
    matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
      if (e.matches && !drawer.hidden) {
        setDrawer(false);
        $('.hdr__logo').focus({ preventScroll: true });
      }
    });
    addEventListener('keydown', (e) => {
      const open = root.classList.contains('drawer-open');
      if (e.key === 'Escape' && open) { setDrawer(false); burger.focus(); }
      if (e.key === 'Tab' && open) {
        const items = $$('#hdr a, #hdr button, #drawer a, #drawer button').filter((el) => el.getClientRects().length && !el.disabled);
        const first = items[0]; const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    /* in-page links. The logo and every #top link land at the top, also with the drawer open. */
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      e.preventDefault();
      if (root.classList.contains('drawer-open')) setDrawer(false);
      if (id === '#top') { toTop(); return; }
      const target = $(id);
      if (!target) return;
      const go = () => { jumpTo(target); target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); };
      if (a.classList.contains('tile')) { setKitchen(a.dataset.kitchen); }
      if (motionOn && e.detail !== 0) wipe(go); /* keyboard activation (detail 0) never animates */ else if (motionOn) { go(); } else { glideTo(target); target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    }));

    /* menu tabs */
    const tabs = $$('.tab');
    const panels = $$('.panel');
    function setKitchen(id) {
      tabs.forEach((t) => {
        const on = t.dataset.kitchen === id;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach((p) => { p.hidden = p.dataset.kitchen !== id; });
      const first = $('.panel:not([hidden]) .row[data-photo]');
      if (first) showPreview(first);
      try { const u = new URL(location.href); u.searchParams.set('k', id); history.replaceState(null, '', u); } catch (_) { /* file or sandbox: skip */ }
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }
    window.__setKitchen = setKitchen;
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => setKitchen(t.dataset.kitchen));
      t.addEventListener('keydown', (e) => {
        const k = { ArrowRight: 1, ArrowLeft: -1, Home: 'h', End: 'e' }[e.key];
        if (k === undefined) return;
        e.preventDefault();
        const n = k === 'h' ? 0 : k === 'e' ? tabs.length - 1 : (i + k + tabs.length) % tabs.length;
        tabs[n].focus(); setKitchen(tabs[n].dataset.kitchen);
      });
    });

    /* dish preview beside the menu (desktop). Rows can be hovered; touch gets thumbnails instead. */
    const preview = $('.preview');
    const stage = $('[data-preview]');
    const pImg = $('.preview__img');
    const pFx = $('.preview__fx');
    const pCode = $('.preview__code');
    let current = null;
    function showPreview(row) {
      if (!row || !stage || row === current || !matchMedia('(min-width: 900px)').matches) return;
      current = row;
      $$('.row.is-active').forEach((r) => r.classList.remove('is-active'));
      row.classList.add('is-active');
      const photo = row.dataset.photo;
      const hero = row.dataset.hero === '1';
      const ground = row.dataset.ground || 'flame';
      pFx.style.opacity = '0';
      pFx.style.transform = 'translateY(16px) scale(.94) rotate(-4deg)';
      setTimeout(() => {
        if (current !== row) return;
        stage.className = 'preview__stage g-' + ground;
        pImg.src = hero ? `img/hero/${photo}.webp` : `img/dish/${photo}.webp`;
        pCode.textContent = row.dataset.code;
        pFx.style.opacity = '1';
        pFx.style.transform = 'none';
      }, reduce ? 0 : 110);
    }
    $$('.row[data-photo]').forEach((row) => {
      row.addEventListener('pointerenter', () => showPreview(row));
      row.addEventListener('click', () => showPreview(row));
    });
    const wanted = new URLSearchParams(location.search).get('k');
    if (wanted && tabs.some((t) => t.dataset.kitchen === wanted)) setKitchen(wanted);
    const firstRow = $('.panel:not([hidden]) .row[data-photo]');
    if (firstRow) showPreview(firstRow);

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

    /* pause control: everything that moves on its own for more than five seconds stops */
    const toggles = $$('[data-motion-toggle]');
    toggles.forEach((toggle) => toggle.addEventListener('click', () => {
      userPaused = !userPaused;
      root.classList.toggle('motion-paused', userPaused);
      toggles.forEach((t) => {
        t.setAttribute('aria-pressed', String(userPaused));
        const u = $('use', t); if (u) u.setAttribute('href', 'img/icons.svg#' + (userPaused ? 'i-play-light' : 'i-pause-light'));
      });
      if (marquee) marquee.paused(userPaused || !marqueeInView);
    }));
    if (reduce) toggles.forEach((t) => { t.hidden = true; });
  }

  /* split a heading into masked words, per language span */
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

  /* ------------------------------------------------------------------ motion */
  function motion() {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    gsap.ticker.lagSmoothing(0); // entrances follow the wall clock

    /* Lenis only for a real wheel. Touch scroll stays native so iOS toolbars keep collapsing. */
    if (fine && typeof Lenis !== 'undefined') {
      lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true, syncTouch: false });
      lenis.on('scroll', ScrollTrigger.update);
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

    /* hero entrance: the lockup is painted in left to right, then the bowl settles */
    const hero = $('.hero');
    gsap.timeline({ delay: 0.15, defaults: { ease: 'expo.out' } })
      .fromTo('.hero__logo', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.4 }, 0)
      .fromTo('.hero__bowl .hero__dish', { opacity: 0, scale: 0.84, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 1.7 }, 0.25)
      .fromTo('.hero__claim', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1 }, 0.7)
      .fromTo('.hero__ctas', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1 }, 0.85);

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

    /* stage edges: the logo's brush is painted across as the section arrives. The front is a comb of bristle tips
       (img/sweep.svg slid across the brush mask), never a straight clip. --sq runs 135 (nothing) to 30 (all of it). */
    $$('.band').forEach((band) => {
      gsap.fromTo(band, { '--sq': 135 }, { '--sq': 30, ease: 'none', scrollTrigger: { trigger: band.parentElement, start: 'top 98%', end: cl('top 52%'), scrub: 0.4 } });
    });

    /* tiles: the dish rises into its colour */
    $$('.tile').forEach((tile, i) => {
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
      const part = (b) => ({ code: $('.j-beat__code span', b), fx: $('.j-beat__fx', b), info: [$('.j-beat__info', b), $('.j-beat__price', b)] });
      beats.forEach((b, i) => { if (i) gsap.set(b, { autoAlpha: 0 }); });
      for (let i = 0; i < n - 1; i++) {
        const a = part(beats[i]); const b = part(beats[i + 1]);
        const t = i;
        tl.to(jr, { backgroundColor: beats[i + 1].dataset.ground, duration: 0.8 }, t + 0.1)
          .to(a.code, { yPercent: -108, duration: 0.45, ease: 'power2.in' }, t + 0.1)
          .to(a.fx, { scale: 0.82, rotation: -16, opacity: 0, duration: 0.45, ease: 'power2.in' }, t + 0.1)
          .to(a.info, { opacity: 0, y: -26, duration: 0.3 }, t + 0.1)
          .fromTo(beats[i], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01 }, t + 0.58)
          .fromTo(beats[i + 1], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, t + 0.55)
          .fromTo(b.code, { yPercent: 108 }, { yPercent: 0, duration: 0.5, ease: 'power2.out' }, t + 0.55)
          .fromTo(b.fx, { scale: 1.18, rotation: 14, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }, t + 0.55)
          .fromTo(b.info, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.4 }, t + 0.65);
      }
      tl.to({}, { duration: 0.35 }); // hold the last beat before unpinning
      return () => { root.classList.remove('pin'); gsap.set([jr, ...beats, ...$$('.j-beat__code span, .j-beat__fx, .j-beat__info, .j-beat__price')], { clearProps: 'all' }); };
    });
    mm.add('(max-width: 899px)', () => {
      beats.forEach((b) => {
        gsap.fromTo($('.j-beat__code span', b), { yPercent: 100 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: b, start: 'top 90%', end: cl('top 40%'), scrub: 0.5 } });
        gsap.fromTo($('.j-beat__fx', b), { scale: 0.86, rotation: -8, opacity: 0.2 }, { scale: 1, rotation: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: b, start: 'top 85%', end: cl('top 35%'), scrub: 0.5 } });
      });
    });

    /* lunch price counts up once (the screen-reader text is a separate, static copy) */
    const priceNum = $('.lunch__num');
    if (priceNum) {
      const parts = $$('span[lang]', priceNum).map((sp) => ({ node: $('.lunch__n', sp).firstChild, sep: sp.lang === 'is' ? '.' : ',' }));
      const o = { v: 0 };
      const fmt = (v, sep) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      parts.forEach((p) => { p.final = p.node.textContent; p.node.textContent = '0'; });
      ScrollTrigger.create({ trigger: priceNum, start: 'top 85%', once: true, onEnter: () => gsap.to(o, { v: 2800, duration: 1.4, ease: 'power3.out', onUpdate: () => parts.forEach((p) => { p.node.textContent = fmt(o.v, p.sep); }), onComplete: () => parts.forEach((p) => { p.node.textContent = p.final; }) }) });
    }
    gsap.fromTo('.lunch__fx', { yPercent: 14, rotation: -6 }, { yPercent: -6, rotation: 4, ease: 'none', scrollTrigger: { trigger: '.lunch', start: 'top bottom', end: 'bottom top', scrub: true } });

    /* proof quotes and the visit bowl */
    $$('.q').forEach((q) => gsap.fromTo($$('blockquote, figcaption', q), { y: 40, opacity: 0 }, { y: 0, opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: q, start: 'top 96%', end: cl('top 66%'), scrub: 0.5 } }));
    gsap.fromTo('.visit__fx', { scale: 0.86, rotation: -10 }, { scale: 1, rotation: 0, ease: 'none', scrollTrigger: { trigger: '.visit', start: 'top 90%', end: cl('top 30%'), scrub: 0.6 } });

    /* menu rows rise as the list enters */
    gsap.fromTo($$('.panel:not([hidden]) .row'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'none', stagger: 0.07, scrollTrigger: { trigger: '.menu__list', start: 'top 90%', end: cl('top 40%'), scrub: 0.5 } });

    /* GSAP now owns every start state; the css start-hidden rules are scoped to html:not(.ready) */
    root.classList.add('ready');

    addEventListener('load', () => ScrollTrigger.refresh());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  }

  /* ------------------------------------------------------------------ boot */
  ui();
  if (motionOn) {
    try { motion(); } catch (err) {
      console.error('[baobite] motion failed, falling back to the plain render', err);
      root.classList.add('rm', 'ready');
    }
  } else {
    root.classList.add('rm', 'ready');
  }
})();
