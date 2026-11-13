(async function () {
  const { hbar, columns, line, fmt, el, esc } = Charts;
  const $ = id => document.getElementById(id);
  const D = await fetch('data/dashboard.json').then(r => r.json());

  const CAT = {
    chips: { name: 'Chips e infraestructura', color: '--s1' },
    big: { name: 'Gigantes tecnológicos', color: '--s2' },
    labs: { name: 'Laboratorios y startups', color: '--s3' },
    soft: { name: 'Software y negocios', color: '--s4' }
  };
  const E = ['--e1', '--e2', '--e3', '--e4', '--e5'];
  const co = id => D.companies.find(c => c.id === id);
  const byCat = cat => D.companies.filter(c => c.cat === cat);
  const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
  const uniq = a => [...new Set(a.filter(Boolean))];

  /* ---------- referencias numeradas ---------- */
  const refs = new Map();
  const refN = u => { if (!refs.has(u)) refs.set(u, refs.size + 1); return refs.get(u); };
  const cite = urls => uniq(urls).map(u => `<sup class="fn"><a href="#ref-${refN(u)}">[${refN(u)}]</a></sup>`).join('');
  function src(id, urls, lead = 'Fuentes') {
    const u = uniq(urls); if (!u.length) return;
    $(id).innerHTML = u.length > 10
      ? `<details class="srcs"><summary>${lead} (${u.length})</summary> ${cite(u)}</details>`
      : `${lead}: ${cite(u)}`;
  }
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fdate = d => { if (!d) return ''; const [y, m] = String(d).split('-'); return m ? `${MES[+m - 1]} ${y}` : y; };
  function table(id, head, rows) {
    const t = el('table');
    t.appendChild(el('thead', {}, el('tr', {}, head.map(h => el('th', { text: h })))));
    t.appendChild(el('tbody', {}, rows.map(r => el('tr', {}, r.map((c, i) => el(i ? 'td' : 'th', { html: c == null ? '<span class="muted">s/d</span>' : c }))))));
    $(id).appendChild(t);
  }
  const tile = (label, value, detail) => el('div', { class: 'tile' }, [el('div', { class: 'tl', text: label }), el('div', { class: 'tv', text: value }), el('div', { class: 'td', html: detail || '' })]);

  /* ---------- agregados por grupo ---------- */
  const agg = {};
  for (const k of ['chips', 'big', 'soft']) {
    const cs = byCat(k), g = cs.filter(c => c.mc0 && c.mc1);
    const chg = cs.map(c => c.chg).filter(v => v != null).sort((a, b) => a - b);
    agg[k] = {
      n: cs.length, mc0: sum(g, c => c.mc0), mc1: sum(g, c => c.mc1), gain: sum(g, c => c.mc1 - c.mc0), ni: sum(cs, c => c.ni),
      median: chg.length % 2 ? chg[(chg.length - 1) / 2] : (chg[chg.length / 2 - 1] + chg[chg.length / 2]) / 2,
      below: cs.filter(c => c.chg < 0).length
    };
  }
  const labsPriv = D.labs_table.filter(l => l.val && !/SpaceX/.test(l.name));
  const labsVal = sum(labsPriv, l => l.val);
  const P = D.lab_pnl;
  const labsOp = -(P.openai.op_loss_2025 + P.anthropic.op_loss_9m_2026);

  /* ---------- veredicto ---------- */
  const softDown = D.soft_ytd.filter(s => s.pct < 0).length;
  [
    { k: 'chips', tag: 'Ganan hoy', big: '+' + fmt.usdB(agg.chips.gain).replace('US$ ', 'US$ '), cap: 'de valor en bolsa desde nov-2022 (×' + fmt.num(agg.chips.mc1 / agg.chips.mc0, 1) + ')',
      why: `Utilidad neta de ${fmt.usdB(agg.chips.ni)} en 12 meses. Nvidia retiene ${fmt.num(co('nvidia').op_margin)} % de cada dólar vendido como utilidad operativa; la memoria, cerca de 75 %.` },
    { k: 'big', tag: 'Apuesta abierta', big: '+' + fmt.usdB(agg.big.gain), cap: 'de valor en bolsa desde nov-2022 (×' + fmt.num(agg.big.mc1 / agg.big.mc0, 1) + ')',
      why: 'Sus nubes crecen entre 39 % y 103 % al año y tienen pedidos por US$ 2.5 billones, pero el flujo de caja libre de Amazon y Oracle ya es negativo.' },
    { k: 'labs', tag: 'Crecen sin ganancias', big: fmt.usdB(labsVal), cap: `de valoración privada en ${labsPriv.length} empresas`,
      why: 'Anthropic factura a un ritmo de US$ 81 mil millones al año y roza el equilibrio operativo; OpenAI prevé quemar caja hasta 2030. Varias startups ya fueron absorbidas o quebraron.' },
    { k: 'soft', tag: 'La mayoría pierde', big: fmt.pct(agg.soft.median), cap: `mediana del precio de la acción desde nov-2022 (chips: ${fmt.pct(agg.chips.median)})`,
      why: `${softDown} de ${D.soft_ytd.length} empresas perdieron valor en 2026 y ${agg.soft.below} cotizan por debajo de 2022. Ganan las que venden IA como producto: Palantir y AppLovin.` }
  ].forEach(v => {
    $('verdict').appendChild(el('div', { class: 'vcard', style: `--c:var(${CAT[v.k].color})` }, [
      el('h3', {}, [el('span', { text: CAT[v.k].name }), el('span', { class: 'tag', text: v.tag })]),
      el('div', { class: 'big', text: v.big }), el('div', { class: 'cap', text: v.cap }), el('p', { class: 'why', text: v.why })
    ]));
  });
  $('heroN').textContent = fmt.num(D.gap[0].value / D.gap[1].value, 1) + '×';

  /* ---------- 1. la apuesta ---------- */
  columns($('c-capex'), {
    cats: D.capex.cats, catNote: [null, null, null, null, 'guía de las empresas, no gasto realizado'],
    series: D.capex.series.map((s, i) => ({ name: s.name, color: E[i], values: s.values })),
    height: 340, aria: 'Inversión de capital anual de Amazon, Alphabet, Microsoft y Meta, 2022 a 2026'
  });
  src('s-capex', D.capex.src.concat(D.risks.forecast_2027.src));

  /* ---------- 2. ¿se paga? ---------- */
  hbar($('c-gap'), {
    rows: D.gap.map(g => ({ label: g.name, sub: g.sub, value: g.value, color: g.hl ? '--s2' : '--neutral' })),
    labelHead: 'Concepto', valueHead: 'US$ al año'
  });
  src('s-gap', D.gap.flatMap(g => g.src));
  columns($('c-cahn'), {
    cats: D.cahn.map(c => c.year), series: [{ name: 'Ingresos necesarios', color: '--s2', values: D.cahn.map(c => c.value) }],
    height: 260, aria: 'Ingresos anuales necesarios según David Cahn, 2023 a 2026'
  });
  src('s-cahn', D.cahn.flatMap(c => c.src));
  D.roi.forEach(r => $('t-roi').appendChild(tile(r.label, r.value, '')));
  $('t-roi').querySelectorAll('.tile').forEach(t => { t.insertBefore(t.children[1], t.children[0]); });
  src('s-roi', D.roi.flatMap(r => r.src), 'Fuentes de los estudios');
  $('bain').innerHTML = `<b>Bain &amp; Company</b> calcula que la IA necesitará ingresos de ${fmt.usdB(D.bain.need_2031)} al año hacia 2031 para financiar el cómputo previsto, y que ${fmt.usdB(D.bain.missing_2031)} de ese total todavía no tiene de dónde salir.${cite(D.bain.src)} En sentido contrario, Exponential View sostiene que los ingresos actuales ya cubren la depreciación de los equipos.${cite(D.gap[1].src)}`;

  /* ---------- 3. ranking ---------- */
  hbar($('c-catgain'), {
    rows: [
      { label: CAT.chips.name, sub: `${fmt.usdB(agg.chips.mc0)} → ${fmt.usdB(agg.chips.mc1)}`, value: agg.chips.gain, color: CAT.chips.color },
      { label: CAT.big.name, sub: `${fmt.usdB(agg.big.mc0)} → ${fmt.usdB(agg.big.mc1)}`, value: agg.big.gain, color: CAT.big.color },
      { label: CAT.labs.name, sub: `valoración privada, ${labsPriv.length} empresas`, value: labsVal, color: CAT.labs.color },
      { label: CAT.soft.name, sub: `${fmt.usdB(agg.soft.mc0)} → ${fmt.usdB(agg.soft.mc1)}`, value: agg.soft.gain, color: CAT.soft.color }
    ], labelHead: 'Grupo', valueHead: 'Valor creado'
  });
  src('s-catgain', ['https://stockanalysis.com/stocks/nvda/market-cap/'].concat(labsPriv.slice(0, 2).flatMap(l => l.src)), 'Suma de las empresas del ranking; fuentes por empresa abajo. Ejemplos');
  hbar($('c-catni'), {
    rows: [
      { label: CAT.big.name, sub: `${agg.big.n} empresas; incluye ganancias de papel`, value: agg.big.ni, color: CAT.big.color },
      { label: CAT.chips.name, sub: `${agg.chips.n} empresas`, value: agg.chips.ni, color: CAT.chips.color },
      { label: CAT.soft.name, sub: `${agg.soft.n - 1} empresas (sin SAP)`, value: agg.soft.ni, color: CAT.soft.color },
      { label: 'OpenAI + Anthropic', sub: 'resultado operativo, periodos distintos', value: labsOp, color: CAT.labs.color }
    ], labelHead: 'Grupo', valueHead: 'Utilidad'
  });
  src('s-catni', P.openai.src.slice(1, 2).concat(P.anthropic.src.slice(0, 1)), 'Suma de las empresas del ranking. Laboratorios');

  const METRICS = {
    chg: { name: 'Precio de la acción', f: c => c.chg, fmt: fmt.pct, head: 'Cambio', sub: 'Cambio en el precio de la acción del 30 de noviembre de 2022 al 12–13 de noviembre de 2026, sin dividendos.' },
    gain: { name: 'Valor creado', f: c => (c.mc0 && c.mc1 ? c.mc1 - c.mc0 : null), fmt: fmt.usdB, head: 'Valor creado', sub: 'Aumento de la capitalización bursátil desde el 30 de noviembre de 2022. Sin dato para las que no cotizaban.' },
    ni: { name: 'Utilidad neta', f: c => c.ni, fmt: fmt.usdB, head: 'Utilidad neta', sub: 'Utilidad neta de los últimos 12 meses disponibles (o último año fiscal).' }
  };
  const state = { metric: 'chg', cat: 'all' };
  function drawRank() {
    const m = METRICS[state.metric];
    const list = D.companies.filter(c => state.cat === 'all' || c.cat === state.cat).filter(c => m.f(c) != null).sort((a, b) => m.f(b) - m.f(a));
    $('rank-sub').textContent = m.sub + (state.cat === 'all' ? ` ${list.length} empresas.` : '');
    hbar($('c-rank'), {
      rows: list.map(c => ({
        label: c.name, sub: c.sub + (state.metric === 'chg' && c.since !== '2022-11-30' ? ` · desde ${fdate(c.since)}` : ''),
        value: m.f(c), color: CAT[c.cat].color, tip: c.note || '',
        extra: [CAT[c.cat].name, fmt.usdB(c.mc1), c.note || '']
      })),
      fmt: m.fmt, legend: ['chips', 'big', 'soft'].map(k => ({ name: CAT[k].name, color: CAT[k].color })),
      valueHead: m.head, extraHead: ['Grupo', 'Capitalización actual', 'Nota']
    });
    src('s-rank', list.flatMap(c => c.src), 'Fuentes por empresa');
  }
  function seg(id, opts, key) {
    opts.forEach(([v, label]) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(state[key] === v), text: label });
      b.addEventListener('click', () => { state[key] = v; $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawRank(); });
      $(id).appendChild(b);
    });
  }
  seg('f-metric', Object.entries(METRICS).map(([k, m]) => [k, m.name]), 'metric');
  seg('f-cat', [['all', 'Todos'], ['chips', 'Chips'], ['big', 'Gigantes'], ['soft', 'Software']], 'cat');
  drawRank();

  /* ---------- 4. chips ---------- */
  const nv = co('nvidia'), mu = co('micron'), dell = co('dell'), cw = co('coreweave');
  [
    ['Utilidad neta de Nvidia, 12 meses', fmt.usdB(nv.ni), `sobre ventas de ${fmt.usdB(nv.rev)}`],
    ['Acción de Micron desde nov-2022', fmt.pct(mu.chg), 'SK Hynix: ' + fmt.pct(co('skhynix').chg)],
    ['Margen bruto de Dell', fmt.pctPlain(dell.gross_margin), `Nvidia: ${fmt.pctPlain(nv.gross_margin)}; Super Micro: ${fmt.pctPlain(co('supermicro').gross_margin)}`],
    ['Resultado neto de CoreWeave, 12 meses', fmt.usdB(cw.ni), `con deuda cercana a ${fmt.usdB(D.risks.coreweave_debt.value)}`]
  ].forEach(t => $('t-chips').appendChild(tile(...t)));
  columns($('c-nvda'), { cats: D.nvda_dc.cats, series: [{ name: 'Centros de datos', color: '--s1', values: D.nvda_dc.values }], height: 260, catHead: 'Año fiscal', aria: 'Ventas de Nvidia a centros de datos por año fiscal' });
  src('s-nvda', D.nvda_dc.src.concat(D.nvda_dc.latest_q.src));
  const mg = byCat('chips').filter(c => c.op_margin != null).sort((a, b) => b.op_margin - a.op_margin);
  hbar($('c-margin'), { rows: mg.map(c => ({ label: c.name, sub: c.sub, value: c.op_margin, color: '--s1', extra: [fmt.pctPlain(c.gross_margin)] })), fmt: fmt.pctPlain, valueHead: 'Margen operativo', extraHead: ['Margen bruto'] });
  src('s-margin', mg.map(c => c.src[0]), 'Fuentes por empresa');
  $('nvda-note').innerHTML = `<b>Dependencia mutua.</b> En el primer semestre fiscal de Nvidia, tres clientes directos sumaron 44 % de sus ventas.${cite(D.nvda_conc_src)} Nvidia, a su vez, tiene US$ 99 mil millones invertidos en acciones de clientes y socios como OpenAI, Anthropic, CoreWeave e Intel.${cite(D.nvda_portfolio_src)}`;

  /* ---------- 5. gigantes ---------- */
  D.cloud_q.forEach(c => $('t-cloud').appendChild(tile(`${c.name} · ingresos del trimestre`, fmt.usdB(c.rev), `+${c.growth} % en un año` + (c.op ? ` · utilidad operativa ${fmt.usdB(c.op)}` : ''))));
  src('s-cloud', D.cloud_q.flatMap(c => c.src), 'Trimestre a septiembre de 2026 (Oracle: a agosto). Fuentes');
  line($('c-fcf'), { series: D.fcf.series.map((s, i) => ({ name: s.name, color: E[i], points: s.points })), height: 320, aria: 'Flujo de caja libre de cinco gigantes, 2022 a 2026' });
  src('s-fcf', D.fcf.src);
  hbar($('c-backlog'), { rows: D.backlog.map(b => ({ label: b.name, sub: b.note, value: b.value, color: CAT[b.cat].color })), legend: [{ name: CAT.big.name, color: CAT.big.color }, { name: CAT.chips.name, color: CAT.chips.color }], valueHead: 'Pedidos pendientes' });
  src('s-backlog', D.backlog.flatMap(b => b.src));

  /* ---------- 6. labs ---------- */
  [
    ['Anthropic · ingresos, 9 meses de 2026', fmt.usdB(P.anthropic.rev_9m_2026), `pérdida operativa de ${fmt.usdB(P.anthropic.op_loss_9m_2026)}; caja operativa positiva de ${fmt.usdB(P.anthropic.op_cash_9m_2026)}`],
    ['OpenAI · ingresos de 2025', fmt.usdB(P.openai.rev_2025), `pérdida operativa de ${fmt.usdB(P.openai.op_loss_2025)}`],
    ['OpenAI · caja que prevé quemar en 2026', fmt.usdB(P.openai.burn_2026), 'proyección reportada por la prensa'],
    ['OpenAI · flujo de caja negativo 2026–2030', fmt.usdB(P.openai.neg_fcf_2026_2030), 'proyección acumulada (FT, sep-2026)']
  ].forEach(t => $('t-labs').appendChild(tile(...t)));
  src('s-labt', P.anthropic.src.concat(P.openai.src));
  const LABC = { anthropic: '--e2', openai: '--e3', xai: '--e1' };
  line($('c-val'), { series: D.valuations.series.map(s => ({ name: s.name, color: LABC[s.id], points: s.points })), height: 320, valueHead: 'Valoración', aria: 'Valoración de Anthropic, OpenAI y xAI' });
  src('s-val', D.valuations.src);
  line($('c-run'), { series: D.runrate.series.map(s => ({ name: s.name, short: s.name.split(' ')[0], color: LABC[s.id], points: s.points })), height: 320, valueHead: 'Ritmo anual', aria: 'Ritmo anual de ingresos de Anthropic y OpenAI' });
  src('s-run', D.runrate.src);
  hbar($('c-labmoney'), {
    rows: D.lab_money.map(r => ({ label: r.name, sub: r.sub, value: r.value, color: r.kind === 'commit' ? '--s2' : '--s3' })),
    legend: [{ name: 'Compromisos de cómputo', color: '--s2' }, { name: 'Ingresos anualizados', color: '--s3' }], labelHead: 'Concepto'
  });
  src('s-labmoney', D.lab_money.flatMap(r => r.src));
  const mult = D.multiples.slice().sort((a, b) => b.mult - a.mult);
  hbar($('c-mult'), {
    rows: mult.map(m => ({ label: m.name, value: m.mult, color: CAT[m.cat].color, tip: `Valor ${fmt.usdB(m.val)} (${fdate(m.val_date) || m.val_date}) ÷ ingresos ${fmt.usdB(m.rev)} (${/^\d/.test(m.rev_date) ? fdate(m.rev_date) : m.rev_date})`, extra: [fmt.usdB(m.val), fmt.usdB(m.rev)] })),
    fmt: fmt.x, legend: ['labs', 'chips', 'big', 'soft'].map(k => ({ name: k === 'labs' ? 'Privadas (valoración)' : CAT[k].name + ' (bolsa)', color: CAT[k].color })),
    valueHead: 'Múltiplo', extraHead: ['Valor', 'Ingresos anuales']
  });
  src('s-mult', mult.flatMap(m => m.src), 'Fuentes por empresa');
  table('tb-labs', ['Empresa', 'Qué hace', 'Valoración', 'Fecha', 'Ingresos anualizados', 'Fecha'],
    D.labs_table.map(l => [esc(l.name) + cite(l.src.slice(0, 1)), esc(l.what), l.val ? esc(fmt.usdB(l.val)) + (l.val_est ? ' <span class="pill">estimado</span>' : '') : null, fdate(l.val_date), l.rev ? esc(fmt.usdB(l.rev)) + cite(l.src.slice(1, 2)) : null, fdate(l.rev_date)]));
  table('tb-fail', ['Empresa', 'Año', 'Qué pasó'], D.failures.map(f => [esc(f.name), String(f.year), esc(f.what) + cite(f.src)]));

  /* ---------- 7. software ---------- */
  const ytd = D.soft_ytd.slice().sort((a, b) => b.pct - a.pct);
  hbar($('c-ytd'), { rows: ytd.map(s => ({ label: s.name, value: s.pct, color: '--s4', extra: [fmt.usdB(s.mc_2025), fmt.usdB(s.mc_now)] })), fmt: fmt.pct, valueHead: 'Cambio en 2026', extraHead: ['31-dic-2025', '12-nov-2026'] });
  src('s-ytd', ytd.flatMap(s => s.src), 'Fuentes por empresa');
  table('tb-aim', ['Empresa', 'Indicador', 'Valor'], D.ai_metrics.map(a => [esc(a.co), esc(a.metric) + cite(a.src), esc(a.value)]));

  /* ---------- 8. circular ---------- */
  D.flows.forEach(f => $('flows').appendChild(el('div', { class: 'flow' }, [
    el('div', { html: `<b>${esc(f.a)}</b>` }),
    el('div', { class: 'amt', html: `${esc(f.amt)} →<small>${esc(f.kind)}</small>` }),
    el('div', { class: 'to', html: `<b>${esc(f.b)}</b>` }),
    el('div', { class: 'what', html: esc(f.what) + cite(f.src) })
  ])));
  hbar($('c-paper'), { rows: D.paper_gains.map(g => ({ label: g.name, sub: g.sub, value: g.value, color: '--s2' })), labelHead: 'Empresa y periodo', valueHead: 'Ganancia contable' });
  src('s-paper', D.paper_gains.flatMap(g => g.src));

  /* ---------- 9. riesgos ---------- */
  const R = D.risks;
  [
    ['Bonos de los cinco mayores compradores, ene–may 2026', fmt.usdB(R.bonds_2026_5m.value), `más que en todo 2025 (${fmt.usdB(R.bonds_2025.value)})`],
    ['Deuda de largo plazo de Amazon', fmt.usdB(R.amazon_debt.to), `desde ${fmt.usdB(R.amazon_debt.from)} nueve meses antes`],
    ['Capex previsto para 2027', '1.2–1.6 bill.', 'US$; Goldman Sachs y Morgan Stanley'],
    ['Electricidad de los centros de datos', `${fmt.num(R.iea.y2025)} TWh`, `en 2025; cerca de ${fmt.num(R.iea.y2030)} TWh en 2030 (AIE)`]
  ].forEach(t => $('t-risk').appendChild(tile(...t)));
  src('s-risk', [].concat(R.bonds_2026_5m.src, R.amazon_debt.src, R.forecast_2027.src, R.iea.src));
  table('tb-events', ['Fecha', 'Qué pasó'], D.events.map(e => [`<span style="white-space:nowrap">${esc(e.date)}</span>`, esc(e.what) + cite(e.src)]));

  /* ---------- referencias ---------- */
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  [...refs.keys()].forEach(u => {
    const li = el('li', { id: 'ref-' + refs.get(u) });
    li.appendChild(el('a', { href: u, rel: 'noopener', target: '_blank', text: host(u) }));
    let path = ''; try { path = decodeURIComponent(new URL(u).pathname).replace(/\/$/, ''); } catch (e) {}
    if (path.length > 1) li.appendChild(document.createTextNode(' · ' + (path.length > 70 ? path.slice(0, 68) + '…' : path)));
    $('refs').appendChild(li);
  });

  /* ---------- tema ---------- */
  $('theme').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('tema', next); } catch (e) {}
  });
})();
