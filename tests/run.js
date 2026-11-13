// Testy: geometria (bez przeglądarki) i interfejs w jsdom. Uruchamiane przed każdą publikacją.
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const C = require(path.join(root, 'app/core.js'));
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const oka = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };
const cutShape = r => r.paths.filter(p => p.type === 'cut').map(p => p.pts.length + (p.closed ? 'c' : 'o')).join(',');

ok('szablony dają jeden zamknięty obrys i nie kolidują', () => {
  for (const fold of ['crease', 'vin', 'vout']) for (const t of ['tuck', 'tuckR', 'snap', 'tray', 'sleeve', 'mailer', 'one']) {
    const r = C.buildBox({ P: { S: 60, W: 100, G: 40, t: 0.5, fold }, panels: C.boxTemplate(t) });
    assert.match(cutShape(r), t === 'mailer' ? /^\d+c(,4c){4}$/ : /^\d+c$/, t + '/' + fold + ': ' + cutShape(r));
    assert.strictEqual(Object.keys(r.clash).length, 0, t + ' kolizja');
  }
});
ok('wymiary ścianek z wymiaru zewnętrznego i sposobu zginania', () => {
  const dims = fold => { const b = { P: { S: 60, W: 100, G: 40, t: 10, fold }, panels: C.boxTemplate('tuck') }; const r = C.buildBox(b); return b.panels.filter(p => p.kind === 'wall').map(p => r.dims[p.id].ext || r.dims[p.id].w + 'x' + r.dims[p.id].h).join(' '); };
  assert.strictEqual(dims('crease'), '55x90 30 50 20 20 20');
  assert.strictEqual(dims('vin'), '60x100 40 60 30 30 30');
  assert.strictEqual(dims('vout'), '50x80 20 40 10 10 10');
});
ok('zgięcia idą na warstwę narzędzia i nie leżą pod cięciem', () => {
  for (const [fold, layer] of [['crease', 'CREASE'], ['vin', 'VCUT'], ['vout', 'KISSCUT']]) {
    const r = C.buildBox({ P: { S: 60, W: 100, G: 40, t: 2, fold }, panels: C.boxTemplate('tuck') });
    const back = C.parseDXF(C.writeDXF(C.orderPaths(r.paths), 300, []));
    assert.deepStrictEqual([...new Set(back.map(p => p.src))].sort(), [layer, 'CUT'].sort());
    const folds = r.paths.filter(p => p.fold), cuts = r.paths.filter(p => !p.fold);
    folds.forEach(f => { const m = { x: (f.pts[0].x + f.pts[1].x) / 2, y: (f.pts[0].y + f.pts[1].y) / 2 }; cuts.forEach(c => assert.ok(C.nearestOnPath(c, m.x, m.y).d > 1e-3, 'big pod cięciem')); });
  }
});
ok('zamek zakładki, przesunięcia punktów i kolizje', () => {
  const box = { P: { S: 60, W: 100, G: 40, t: 0.5, fold: 'crease' }, panels: C.boxTemplate('tuck') };
  box.panels.filter(p => p.kind === 'tuck').forEach(p => p.lock = 4);
  let r = C.buildBox(box); assert.strictEqual(r.paths.filter(p => p.type === 'cut' && !p.closed).length, 4);
  const q = r.paths.find(p => p.type === 'cut').pts[5], before = [q.x, q.y]; box.ov = {}; q.ks.forEach(k => box.ov[k] = { x: 3, y: -2 });
  box.P.S = 90; r = C.buildBox(box);
  assert.ok(r.paths.some(p => p.pts.some(z => z.ks.includes(q.ks[0]) && Math.abs(z.y - (before[1] - 2)) < 1e-6)), 'przesunięcie trzyma się po zmianie wymiaru');
  assert.ok(r.paths.find(p => p.type === 'cut').closed);
  box.ov = {}; box.panels.push({ id: 99, kind: 'wall', parent: 6, edge: 'b', ext: { base: 'num', val: 30, kt: 0 } });
  assert.ok(Object.keys(C.buildBox(box).clash).length >= 2);
});
ok('obrys bez wiszących nacięć (odcinków tam i z powrotem)', () => {
  for (const tt of [0.5, 2, 10]) for (const tp of ['tuck', 'tuckR', 'snap', 'mailer', 'tray', 'sleeve']) {
    const r = C.buildBox({ P: { S: 60, W: 100, G: 40, t: tt, fold: 'crease' }, panels: C.boxTemplate(tp) });
    r.paths.filter(p => p.type === 'cut' && p.closed).forEach(p => { const a = p.pts, n = a.length;
      for (let i = 0; i < n; i++) { const pv = a[(i - 1 + n) % n], q = a[i], nx = a[(i + 1) % n]; if (q.c1x !== undefined || nx.c1x !== undefined) continue;
        const ax = q.x - pv.x, ay = q.y - pv.y, bx = nx.x - q.x, by = nx.y - q.y, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        assert.ok(!(la > 1e-6 && lb > 1e-6 && Math.abs(ax * by - ay * bx) < 1e-6 * la * lb && ax * bx + ay * by < 0), tp + ' t=' + tt + ' wąs przy ' + q.x + ',' + q.y); } });
  }
});
ok('obrys nie zamyka małych pętli, gdy cofnięte bigi dwóch klapek spotykają się w rogu', () => {
  for (const tpl of ['tuck', 'tuckR', 'snap']) for (const gap of [0, 1, 2]) for (const sink of [0, 1, 2]) for (const flip of [0, 1]) {
    const b = { P: { S: 60, W: 100, G: 40, t: 0.4, fold: 'crease' }, panels: C.boxTemplate(tpl) };
    b.panels.forEach(p => { if (p.kind !== 'wall') { p.gap = { kt: gap }; p.sink = { kt: sink }; if (flip) p.flip = !p.flip; } });
    C.buildBox(b).paths.filter(p => p.type === 'cut').forEach(p => { const seen = new Set(); p.pts.forEach(q => { const k = Math.round(q.x * 1000) + ',' + Math.round(q.y * 1000); assert.ok(!seen.has(k), tpl + ' gap ' + gap + ' sink ' + sink + ': pętla przy ' + k); seen.add(k); }); });
  }
});
ok('pudełko wysyłkowe: zawijane boki, wypustki i szczeliny w dnie; punkty dodane i usunięte', () => {
  for (const tt of [0.5, 1.5, 3]) { const r = C.buildBox({ P: { S: 200, W: 60, G: 150, t: tt, fold: 'crease' }, panels: C.boxTemplate('mailer') });
    assert.match(cutShape(r), /^\d+c,4c,4c,4c,4c$/, cutShape(r)); assert.strictEqual(Object.keys(r.clash).length, 0); }
  const box = { P: { S: 60, W: 100, G: 40, t: 0.5, fold: 'crease' }, panels: C.boxTemplate('tuck'), splits: [], dels: [], ov: {} };
  let r = C.buildBox(box); const cp = r.paths.find(p => p.type === 'cut'), n0 = cp.pts.length;
  box.splits.push({ id: 1, a: cp.pts[10].ks, b: cp.pts[11].ks, t: 0.5 }); r = C.buildBox(box);
  assert.strictEqual(r.paths.find(p => p.type === 'cut').pts.length, n0 + 1);
  box.dels.push(cp.pts[20].ks[0]); box.P.W = 120; r = C.buildBox(box); const c3 = r.paths.find(p => p.type === 'cut'); assert.strictEqual(c3.pts.length, n0); assert.ok(c3.closed);
});
ok('zamknięcia: zakładka z tabeli, klejenie, klapka z barkiem, wycięcie na palec, dno 1-2-3', () => {
  const mk = (tpl, P) => { const b = { P: Object.assign({ S: 60, W: 100, G: 40, t: 0.5, fold: 'crease' }, P), panels: C.boxTemplate(tpl) }; return { b, r: C.buildBox(b) }; };
  const ext = (x, kind) => x.b.panels.filter(p => p.kind === kind).map(p => x.r.dims[p.id].ext);
  assert.deepStrictEqual(ext(mk('tuck', { G: 40 }), 'tuck'), [20, 20]); assert.deepStrictEqual(ext(mk('tuck', { G: 22 }), 'tuck'), [13, 13]); assert.deepStrictEqual(ext(mk('tuck', { G: 120 }), 'tuck'), [25, 25]);
  assert.deepStrictEqual(ext(mk('tuck', { W: 50 }), 'glue'), [10]); assert.deepStrictEqual(ext(mk('tuck', { W: 200 }), 'glue'), [16]);
  const a = mk('tuck'), n1 = a.r.paths.find(p => p.type === 'cut').pts.length; a.b.panels.forEach(p => { if (p.kind === 'dust') p.shape = 'trap'; if (p.notch) p.notch = []; });
  const n2 = C.buildBox(a.b).paths.find(p => p.type === 'cut').pts.length; assert.ok(n1 > n2, 'bark i wycięcia dodają punkty');
  const rv = mk('tuckR'), tucks = rv.b.panels.filter(p => p.kind === 'tuck').map(p => rv.b.panels.find(q => q.id === p.parent).parent); assert.deepStrictEqual(tucks, [1, 3], 'odwrócone: wieczko na przodzie, dno na tyle');
  const lk = mk('tuck'); lk.b.panels.forEach(p => { if (p.kind === 'tuck') p.lock = 4; if (p.kind === 'dust') p.shape = 'round'; }); const lr = C.buildBox(lk.b), slits = lr.paths.filter(p => p.type === 'cut' && !p.closed);
  assert.strictEqual(slits.length, 4); assert.ok(lr.paths.find(p => p.type === 'cut' && p.closed)); slits.forEach(sp => { const ys = sp.pts.map(q => q.y), cr = Math.abs(ys[0]) > 50 ? (ys[0] > 0 ? 1 : -1) : -1; assert.ok(Math.max(...ys) - Math.min(...ys) > 0.5, 'haczyk przechodzi za big'); });
  const sn = mk('snap'); assert.deepStrictEqual(sn.b.panels.filter(p => /^snap/.test(p.kind)).map(p => p.kind), ['snapF', 'snapB']); assert.ok(sn.r.paths.find(p => p.type === 'cut').closed);
});
ok('DXF, PDF i SVG: zapis i odczyt', () => {
  const S = C.samplePaths(); S.forEach((p, i) => p.id = i + 1);
  const cfg = { W: 1010, H: 720, m: 12, gap: 3, max: 0, rot: 'auto', corner: 'tl', mk: 5 }, L = C.layoutSheet(S, cfg);
  assert.strictEqual(L.count, 18); assert.ok(Math.abs(L.cells[0].x - 12) < 1e-9 && Math.abs(L.cells[0].y - 12) < 1e-9);
  const items = C.jobItems(S, L), back = C.parseDXF(C.writeDXF(items, cfg.H, C.markList(cfg)));
  assert.strictEqual(back.length, items.length + 4);
  assert.ok(C.writePDF(items, cfg.W, cfg.H, []).startsWith('%PDF-1.4')); assert.ok(C.writeSVG(items, cfg.W, cfg.H, []).includes('id="CUT"'));
  const B = C.builder(null); C.parseD('M10 10h20v20h-20z M50,50a10 10 0 1 0 20 0a10,10 0 1,0-20 0z', B); const ps = B.done();
  assert.strictEqual(ps.length, 2); assert.ok(Math.abs(C.bboxOf([ps[1]]).w - 20) < 0.01);
});

// ---- interfejs
const { JSDOM, VirtualConsole } = require('jsdom');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<link[^>]*>/g, '')
  .replace(/<script src="(app\/[a-z.]+)(\?v=[^"]*)?"><\/script>/g, (m, f) => '<script>' + fs.readFileSync(path.join(root, f), 'utf8') + '</script>');
const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message + ' ' + ((e.detail && e.detail.stack) || '').split('\n').slice(0, 3).join(' | ')));
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://example.test/' });
const w = dom.window, d = w.document, g = id => d.getElementById(id), cv = g('cv');
const ev = (el, t) => el.dispatchEvent(new w.Event(t, { bubbles: true }));
const pe = (el, t, x, y, o) => el.dispatchEvent(new w.MouseEvent(t, Object.assign({ bubbles: true, button: 0, clientX: x, clientY: y }, o || {})));
const key = (k, o) => w.dispatchEvent(new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, o || {})));
const click = (x, y, o) => { pe(cv, 'pointerdown', x, y, o); pe(cv, 'pointerup', x, y, o); };
const dragOn = (el, x0, y0, x1, y1, o) => { pe(el, 'pointerdown', x0, y0, o); pe(cv, 'pointermove', (x0 + x1) / 2, (y0 + y1) / 2, o); pe(cv, 'pointermove', x1, y1, o); pe(cv, 'pointerup', x1, y1, o); };
const wait = ms => new Promise(r => setTimeout(r, ms));
// jsdom nie liczy układu: świat = (ekran − 40) / 2

(async () => {
  await wait(150);
  await oka('start: pudełko, plusy i pasek narzędzi od razu', () => {
    assert.strictEqual(d.querySelectorAll('.plus').length, 7); assert.strictEqual(d.querySelectorAll('#dockTools button').length, 7);
    assert.strictEqual(g('ver').textContent, 'vdev'); assert.ok(g('banner').hidden);
  });
  await oka('wymiary na żywo, proporcje i sposób zginania', () => {
    const s = g('bS'); s.focus(); s.value = '80'; ev(s, 'input'); assert.ok(g('status').textContent.includes('80×100×40'));
    g('bLock').checked = true; s.value = '160'; ev(s, 'input'); assert.strictEqual(g('bW').value, '200'); g('bLock').checked = false;
    s.value = '60'; ev(s, 'input'); g('bW').value = '100'; ev(g('bW'), 'input'); g('bG').value = '40'; ev(g('bG'), 'input');
    g('fold').value = 'vin'; ev(g('fold'), 'change'); assert.ok(d.querySelector('#world .t-vcut')); g('fold').value = 'crease'; ev(g('fold'), 'change');
  });
  await oka('ścianka: klik, karta, plus, nowa ścianka bierze wymiar sąsiada, usunięcie', () => {
    click(60, 60); assert.strictEqual(g('subWall').textContent, 'pierwsza'); assert.ok(g('pv-w').textContent.includes('59,8'));
    pe(d.querySelector('[data-plus="1:l"]'), 'pointerdown', 5, 5); d.querySelector('#menu [data-mi="0"]').click();
    assert.ok(g('pv-ext').textContent.includes('39,8'), g('pv-ext').textContent); assert.strictEqual(d.querySelectorAll('.plus').length, 9);
    d.querySelector('[data-under="1"]').click(); d.querySelector('[data-notch="a"]').click(); key('Delete'); assert.strictEqual(d.querySelectorAll('.plus').length, 7);
    assert.strictEqual(d.querySelectorAll('#menu .menu__sub').length, 3); pe(d.querySelector('[data-plus="1:l"]'), 'pointerdown', 5, 5); d.querySelector('#menu [data-mi="1"][data-si="1"]').click();
    assert.strictEqual(g('subWall').textContent, 'zakładka'); assert.strictEqual(d.querySelector('[data-lock="10"]').getAttribute('aria-pressed'), 'true'); d.querySelector('[data-rad="8"]').click();
    d.querySelector('[data-setkind=dust]').click(); d.querySelector('[data-shape=shoulder]').click(); d.querySelector('[data-flip]').click(); key('Delete'); assert.strictEqual(d.querySelectorAll('.plus').length, 7);
  });
  await oka('Enter otwiera punkty pudełka bez utraty pudełka; przesunięcie trzyma się wymiarów', () => {
    click(60, 60); key('Enter'); assert.ok(g('crumb').textContent.includes('Punkty')); assert.ok(!d.querySelector('[data-card=box]').hidden);
    const nd = [...d.querySelectorAll('.nd')]; assert.ok(nd.length > 20);
    const n0 = nd[0], x = +n0.getAttribute('x') + 3.5, y = +n0.getAttribute('y') + 3.5; dragOn(n0, x, y, x + 20, y - 10, { altKey: true });
    assert.ok(!g('bOv').hidden); key('Escape'); assert.strictEqual(d.querySelectorAll('.plus').length, 7);
    g('bOv').click(); assert.ok(g('bOv').hidden);
    click(60, 60); key('Enter'); const nn = d.querySelectorAll('.nd').length; cv.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true, clientX: 100, clientY: 40 }));
    assert.strictEqual(d.querySelectorAll('.nd').length, nn + 1, 'dwuklik dodaje punkt pudełka'); key('Delete'); assert.strictEqual(d.querySelectorAll('.nd').length, nn); key('Escape');
  });
  await oka('rysowanie: prostokąt z Shift, wielokąt z liczbą boków, przypięcie do ścianki', async () => {
    key('r'); dragOn(cv, 60, 100, 100, 130, { shiftKey: true });
    assert.strictEqual(d.querySelectorAll('.hit').length, 1); assert.ok(g('info').textContent.includes('przypięte'));
    const before = d.querySelector('.hit').getAttribute('d'); g('bW').value = '140'; ev(g('bW'), 'input');
    assert.notStrictEqual(d.querySelector('.hit').getAttribute('d'), before, 'kształt jedzie za ścianką'); g('bW').value = '100'; ev(g('bW'), 'input');
    key('p'); key('ArrowUp'); key('ArrowUp'); assert.strictEqual(g('sidesN').textContent, '5'); dragOn(cv, 700, 300, 700, 340, { shiftKey: true });
    assert.strictEqual(d.querySelectorAll('.hit')[1].getAttribute('d').split('L').length, 5);
    key('o'); dragOn(cv, 800, 300, 840, 320); key('l'); dragOn(cv, 900, 300, 960, 310, { shiftKey: true });
    assert.strictEqual(d.querySelectorAll('.hit').length, 4); assert.ok(/L460 130$/.test(d.querySelectorAll('.hit')[3].getAttribute('d')));
  });
  await oka('uchwyty: skalowanie i obrót; kopiuj, wklej, powiel, rozłóż', async () => {
    assert.strictEqual(d.querySelectorAll('.th').length, 9);
    const se = d.querySelector('[data-t=se]'); dragOn(se, +se.getAttribute('x') + 4, +se.getAttribute('y') + 4, +se.getAttribute('x') + 44, +se.getAttribute('y') + 4);
    await wait(40); assert.ok(/L480 /.test(d.querySelectorAll('.hit')[3].getAttribute('d')), d.querySelectorAll('.hit')[3].getAttribute('d'));
    const rot = d.querySelector('[data-t=rot]'); dragOn(rot, +rot.getAttribute('cx'), +rot.getAttribute('cy'), +rot.getAttribute('cx') + 200, +rot.getAttribute('cy') + 200, { shiftKey: true });
    key('c', { ctrlKey: true }); key('v', { ctrlKey: true }); key('d', { ctrlKey: true }); assert.strictEqual(d.querySelectorAll('.hit').length, 6);
    pe(cv, 'pointerdown', 2400, 600); pe(cv, 'pointermove', 1000, 100); pe(cv, 'pointerup', 1000, 100); await wait(40);
    d.querySelector('[data-al=dh]').click(); d.querySelector('[data-al=t]').click();
  });
  await oka('wzorzec wyrównania: drugi klik w zaznaczony element albo ściankę', async () => {
    key('Escape'); const hs = () => [...d.querySelectorAll('.hit')], bx = el => el.getAttribute('d').match(/^M(-?[\d.]+) (-?[\d.]+)/).slice(1).map(Number);
    pe(hs()[1], 'pointerdown', 0, 0); pe(cv, 'pointerup', 0, 0); pe(hs()[2], 'pointerdown', 0, 0, { shiftKey: true }); pe(cv, 'pointerup', 0, 0, { shiftKey: true });
    pe(hs()[1], 'pointerdown', 0, 0); pe(cv, 'pointerup', 0, 0); assert.ok(g('info').textContent.includes('wzorzec: linia')); assert.strictEqual(d.querySelectorAll('.hit.key').length, 1);
    const keyBefore = hs()[1].getAttribute('d'); d.querySelector('[data-al=t]').click(); assert.strictEqual(hs()[1].getAttribute('d'), keyBefore, 'wzorzec stoi w miejscu');
    key('Escape'); pe(hs()[1], 'pointerdown', 0, 0); pe(cv, 'pointerup', 0, 0); click(60, 60, { shiftKey: true }); assert.ok(g('info').textContent.includes('ścianka'));
    const before = hs()[1].getAttribute('d'); d.querySelector('[data-al=l]').click(); await wait(20); assert.notStrictEqual(hs()[1].getAttribute('d'), before, 'kształt dosuwa się do ścianki');
    click(60, 60); assert.ok(g('info').textContent.includes('wzorzec: ścianka')); key('Escape');
  });
  await oka('punkty linii: łuk, uchwyty, dodanie i usunięcie punktu', async () => {
    key('Escape'); const h0 = d.querySelector('.hit'); h0.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true, clientX: 60, clientY: 100 }));
    assert.strictEqual(d.querySelectorAll('.nd').length, 4); const nd = d.querySelector('.nd'); pe(nd, 'pointerdown', 0, 0); pe(cv, 'pointerup', 0, 0);
    g('bCurve').click(); assert.strictEqual(d.querySelectorAll('.hd').length, 2);
    const hd = d.querySelector('.hd'); dragOn(hd, +hd.getAttribute('cx'), +hd.getAttribute('cy'), +hd.getAttribute('cx') + 10, +hd.getAttribute('cy') + 10); await wait(40);
    assert.ok(d.querySelector('.hit').getAttribute('d').includes('C')); key('Delete'); assert.strictEqual(d.querySelectorAll('.nd').length, 3); key('Escape');
  });
  await oka('prostokąt → ścianka, autozapis i plik projektu', async () => {
    pe(cv, 'pointerdown', 2400, 2400); pe(cv, 'pointermove', -900, -900); pe(cv, 'pointerup', -900, -900); await wait(30); key('Delete');
    assert.ok(g('status').textContent.includes('Pusty')); key('r'); dragOn(cv, 100, 100, 220, 300); assert.ok(!g('bWall').hidden); g('bWall').click();
    assert.ok(!d.querySelector('[data-card=box]').hidden); assert.strictEqual(d.querySelectorAll('.plus').length, 4); assert.strictEqual(g('bS').value, '60'); assert.strictEqual(g('bW').value, '100');
    await wait(650); const saved = JSON.parse(w.localStorage.getItem('wykr-doc')); assert.strictEqual(saved.app, 'khorei-wykrojnik'); assert.strictEqual(saved.box.P.S, 60); assert.ok(g('saved').textContent.startsWith('Zapisano'));
    d.querySelector('[data-tpl=tuck]').click();
  });
  await oka('impozycja od rogu, cofanie, zamiana na linie, zapis', async () => {
    d.querySelector('[data-card=arkusz] .card__title').click(); assert.ok(/szt\./.test(g('impBig').textContent)); assert.ok(d.querySelector('#world use').getAttribute('transform').startsWith('translate(12 12)'));
    d.querySelector('[data-corner=br]').click(); assert.ok(!d.querySelector('#world use').getAttribute('transform').startsWith('translate(12 12)'));
    d.querySelector('[data-card=arkusz] .card__title').click();
    for (const t of ['mailer', 'tray', 'sleeve', 'snap', 'tuckR', 'tuck']) { d.querySelector('[data-tpl=' + t + ']').click(); assert.ok(!g('status').textContent.includes('nachodzą'), t); }
    const nb = d.querySelectorAll('.hit').length; g('bFlat').click(); assert.ok(d.querySelector('[data-card=box]').hidden); assert.ok(d.querySelectorAll('.hit').length > nb);
    g('bUndo').click(); assert.ok(!d.querySelector('[data-card=box]').hidden); g('exDxf').click(); g('exPdf').click(); g('exSvg').click();
  });
  await oka('po odświeżeniu strona wraca do zapisanej pracy', async () => {
    g('bS').value = '77'; ev(g('bS'), 'input'); key('r'); dragOn(cv, 60, 100, 100, 130); await wait(650);
    const stored = w.localStorage.getItem('wykr-doc'), e2 = [], vc2 = new VirtualConsole(); vc2.on('jsdomError', e => e2.push(e.message));
    const dom2 = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc2, url: 'https://example.test/', beforeParse(win) { win.localStorage.setItem('wykr-doc', stored); } });
    await wait(150); const d2 = dom2.window.document; assert.deepStrictEqual(e2, []);
    assert.strictEqual(d2.getElementById('bS').value, '77'); assert.strictEqual(d2.querySelectorAll('.hit').length, d.querySelectorAll('.hit').length); assert.ok(d2.querySelectorAll('.plus').length > 0);
  });
  await wait(50);
  assert.deepStrictEqual(errors, [], 'błędy skryptu:\n' + errors.join('\n'));
  console.log('\n' + n + ' testów OK'); process.exit(0);
})().catch(e => { console.error(e); console.error(errors.join('\n')); process.exit(1); });
