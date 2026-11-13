(async function () {
  const { hbar, hgroup, network, columns, line, fmt, el, esc } = Charts;
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

  hbar($('c-pnl'), {
    rows: D.pnl_top.map(r => ({ label: r.name, sub: r.sub, value: r.value, color: CAT[r.cat].color, tip: r.note || '', extra: [CAT[r.cat].name, r.sub] })),
    legend: ['chips', 'big', 'labs', 'soft'].map(k => ({ name: CAT[k].name, color: CAT[k].color })),
    valueHead: 'Ganancia o pérdida', extraHead: ['Grupo', 'Qué mide']
  });
  src('s-pnl', D.pnl_top.flatMap(r => r.src), 'Fuentes por empresa');

  /* ---------- inversión frente a ganancia ---------- */
  const withF = D.companies.filter(c => c.f && c.f.rev != null);
  const INV = {
    capex: ['Las que más invierten', l => l.filter(c => c.f.capex != null).sort((a, b) => b.f.capex - a.f.capex)],
    ni: ['Las que más ganan', l => l.slice().sort((a, b) => b.f.ni - a.f.ni)],
    chips: ['Chips', l => l.filter(c => c.cat === 'chips').sort((a, b) => b.f.rev - a.f.rev)],
    big: ['Gigantes', l => l.filter(c => c.cat === 'big').sort((a, b) => b.f.rev - a.f.rev)],
    soft: ['Software', l => l.filter(c => c.cat === 'soft').sort((a, b) => b.f.rev - a.f.rev)]
  };
  function drawInv(k) {
    const list = INV[k][1](withF).slice(0, 12);
    hgroup($('c-inv'), {
      groups: list.map(c => ({
        label: c.name + (c.f.fx ? '*' : ''), sub: CAT[c.cat].name, tip: c.note || '',
        bars: [
          { name: 'Inversión (capex)', value: c.f.capex == null ? null : -c.f.capex, shown: c.f.capex, color: '--out' },
          { name: 'Ganancia bruta', value: c.f.gp, color: '--s1' },
          { name: 'Utilidad neta', value: c.f.ni, color: '--s3' },
          { name: 'Caja libre', value: c.f.fcf, color: '--s4' }
        ]
      })),
      legend: [{ name: 'Inversión (sale)', color: '--out' }, { name: 'Ganancia bruta', color: '--s1' }, { name: 'Utilidad neta', color: '--s3' }, { name: 'Caja libre', color: '--s4' }]
    });
    $('c-inv').classList.add('inview');
    src('s-inv', list.flatMap(c => [c.links && c.links.fin, c.links && c.links.cash]), '* Reporta en otra moneda; montos convertidos (estimado). Fuentes por empresa');
  }
  if (withF.length) {
    Object.entries(INV).forEach(([k, [label]], i) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(i === 0), text: label });
      b.addEventListener('click', () => { $('f-inv').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawInv(k); });
      $('f-inv').appendChild(b);
    });
    drawInv('capex'); $('c-inv').classList.remove('inview');
  } else { $('c-inv').closest('.card').hidden = true; }

  /* ---------- desde 2017 ---------- */
  const H = D.hist;
  if (H) {
    const Y = H.years.map(String), G = H.groups, last = Y.length - 1;
    const Y0 = Y[0], Y1 = Y[last], RANGE = `${Y0}–${Y1}`;
    document.querySelectorAll('.h-y0').forEach(x => x.textContent = Y0);
    document.querySelectorAll('.h-y1').forEach(x => x.textContent = Y1);
    document.querySelectorAll('.h-n').forEach(x => x.textContent = `Las ${H.panel_n}`);
    $('h-warn').textContent = `Los estados financieros gratuitos solo cubren de ${Y0} a ${Y1}; los años 2017 a ${+Y0 - 1} están pendientes (vendrán de los registros oficiales de la SEC). El valor en bolsa y los hitos sí parten de 2017.`;
    $('h-capsub').textContent = `Miles de millones de US$. Suma de las ${H.panel_n} empresas con dato en todos los años${H.panel_out.length ? ' (fuera: ' + H.panel_out.join(', ') + ')' : ''}. Cada año fiscal se asigna al año calendario en que cae la mayor parte.`;
    $('h-mcsub').textContent = `Suma de la capitalización al 31 de diciembre de las ${H.mcap_n} empresas con dato todos los años desde 2017, en miles de millones de US$. Quedan fuera por falta de datos o porque no cotizaban: ${H.mcap_out.map(x => x.name).join(', ')}.`;
    const tot = k => G.all[k].reduce((t, v) => t + (v || 0), 0);
    const totC = (c, k) => G[c][k].reduce((t, v) => t + (v || 0), 0);
    [
      [`Inversión de capital ${RANGE}`, fmt.usdB(tot('capex')), `${H.panel_n} empresas; ${fmt.usdB(G.all.capex[0])} en ${Y0} y ${fmt.usdB(G.all.capex[last])} en ${Y1}`],
      [`Utilidad neta ${RANGE}`, fmt.usdB(tot('net_income')), `${fmt.num(tot('net_income') / tot('capex'), 2)} dólares de utilidad por cada dólar invertido`],
      ['Gigantes: invirtieron', fmt.usdB(totC('big', 'capex')), `y ganaron ${fmt.usdB(totC('big', 'net_income'))} netos en el mismo periodo`],
      ['Chips: invirtieron', fmt.usdB(totC('chips', 'capex')), `y ganaron ${fmt.usdB(totC('chips', 'net_income'))} netos en el mismo periodo`]
    ].forEach(t => $('h-tiles').appendChild(tile(...t)));
    const allSrc = H.companies.flatMap(c => c.src);
    src('s-htiles', allSrc.concat(H.fx_src), 'Estados financieros por empresa');

    columns($('c-hcapex'), {
      cats: Y, series: ['big', 'chips', 'soft'].map(k => ({ name: CAT[k].name, color: CAT[k].color, values: G[k].capex })),
      height: 320, aria: `Inversión de capital por año y grupo, ${RANGE}`
    });
    src('s-hcapex', allSrc, 'Fuentes por empresa');

    function drawFlow(k) {
      const g = G[k];
      columns($('c-hflow'), {
        cats: Y, grouped: true, labels: false, height: 320, aria: 'Inversión, utilidad neta y caja libre por año',
        series: [{ name: 'Inversión (sale)', color: '--out', values: g.capex.map(v => v == null ? null : -v) },
          { name: 'Utilidad neta', color: '--s3', values: g.net_income }, { name: 'Caja libre', color: '--s4', values: g.fcf }]
      });
      $('c-hflow').classList.add('inview');
    }
    [['all', 'Todos'], ['big', 'Gigantes'], ['chips', 'Chips'], ['soft', 'Software']].forEach(([v, label], i) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(i === 0), text: label });
      b.addEventListener('click', () => { $('f-hgrp').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawFlow(v); });
      $('f-hgrp').appendChild(b);
    });
    drawFlow('all'); $('c-hflow').classList.remove('inview');
    src('s-hflow', allSrc, 'Fuentes por empresa');

    const byName = H.companies.slice().sort((a, b) => a.name.localeCompare(b.name));
    byName.forEach(c => $('f-hco').appendChild(el('option', { value: c.id, text: c.name + (c.fx ? ' *' : '') })));
    function drawCo(id) {
      const c = H.companies.find(x => x.id === id), r = y => c.rows[y] || {};
      const t = H.totals.find(x => x.id === id);
      $('h-cosub').textContent = `Miles de millones de US$ por año.${c.fx ? ' Reporta en otra moneda: convertido con el tipo de cambio promedio de cada año (estimado).' : ''} Total ${t.first || Y0}–${Y1}: inversión ${fmt.usdB(t.capex)}, utilidad neta ${fmt.usdB(t.net_income)}, caja libre ${fmt.usdB(t.fcf)}.`;
      columns($('c-hco'), {
        cats: Y, grouped: true, labels: false, height: 300, aria: 'Serie anual de ' + c.name,
        series: [{ name: 'Inversión (sale)', color: '--out', values: Y.map(y => r(y).capex == null ? null : -r(y).capex) },
          { name: 'Ganancia bruta', color: '--s1', values: Y.map(y => r(y).gross_profit) },
          { name: 'Utilidad neta', color: '--s3', values: Y.map(y => r(y).net_income) },
          { name: 'Caja libre', color: '--s4', values: Y.map(y => r(y).fcf) }]
      });
      $('c-hco').classList.add('inview');
      src('s-hco', c.src);
    }
    $('f-hco').value = 'amazon' in Object.fromEntries(H.companies.map(c => [c.id, 1])) ? 'amazon' : byName[0].id;
    $('f-hco').addEventListener('change', e => drawCo(e.target.value));
    drawCo($('f-hco').value); $('c-hco').classList.remove('inview');

    const TOT = {
      capex: ['Las que más invirtieron', l => l.filter(x => x.capex != null).sort((a, b) => b.capex - a.capex)],
      ni: ['Las que más ganaron', l => l.filter(x => x.net_income != null).sort((a, b) => b.net_income - a.net_income)],
      ratio: ['Más utilidad por dólar invertido', l => l.filter(x => x.capex > 1 && x.net_income != null).sort((a, b) => b.net_income / b.capex - a.net_income / a.capex)],
      worst: ['Menos utilidad por dólar invertido', l => l.filter(x => x.capex > 1 && x.net_income != null).sort((a, b) => a.net_income / a.capex - b.net_income / b.capex)]
    };
    function drawTot(k) {
      const list = TOT[k][1](H.totals).slice(0, 15);
      hgroup($('c-htot'), {
        groups: list.map(x => ({
          label: x.name + (x.fx ? '*' : ''), sub: `${CAT[x.cat].name} · ${x.first && x.first > +Y0 ? 'desde ' + x.first : RANGE}`,
          tip: x.capex ? `Utilidad neta por cada dólar invertido: ${fmt.num(x.net_income / x.capex, 2)}` : '',
          bars: [{ name: 'Inversión acumulada', value: x.capex == null ? null : -x.capex, shown: x.capex, color: '--out' },
            { name: 'Ganancia bruta acumulada', value: x.gross_profit, color: '--s1' },
            { name: 'Utilidad neta acumulada', value: x.net_income, color: '--s3' },
            { name: 'Caja libre acumulada', value: x.fcf, color: '--s4' }]
        })),
        legend: [{ name: 'Inversión (sale)', color: '--out' }, { name: 'Ganancia bruta', color: '--s1' }, { name: 'Utilidad neta', color: '--s3' }, { name: 'Caja libre', color: '--s4' }]
      });
      $('c-htot').classList.add('inview');
      src('s-htot', list.flatMap(x => x.src), '* Convertido de otra moneda (estimado). Fuentes por empresa');
    }
    Object.entries(TOT).forEach(([k, [label]], i) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(i === 0), text: label });
      b.addEventListener('click', () => { $('f-htot').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawTot(k); });
      $('f-htot').appendChild(b);
    });
    drawTot('capex'); $('c-htot').classList.remove('inview');

    const MY = H.mcap_years.map(String);
    line($('c-hmcap'), {
      series: ['big', 'chips', 'soft'].map(k => ({ name: CAT[k].name, short: CAT[k].name.split(' ')[0], color: CAT[k].color, points: MY.map((y, i) => ({ x: +y, y: H.mcap_groups[k][i] })).filter(p => p.y) })),
      height: 320, valueHead: 'Capitalización', aria: 'Capitalización bursátil por grupo al cierre de cada año'
    });
    src('s-hmcap', H.mcap.flatMap(m => m.src), 'Fuentes por empresa');

    if (H.milestones.length) table('tb-hito', ['Fecha', 'Hito'], H.milestones.map(m => [fdate(m.date), `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a>`]));
    else $('tb-hito').closest('.card').hidden = true;
  } else { $('historia').hidden = true; }

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
    ni: { name: 'Utilidad neta', f: c => c.ni, fmt: fmt.usdB, head: 'Utilidad neta', sub: 'Utilidad neta de los últimos 12 meses disponibles (o último año fiscal).' },
    gp: { name: 'Ganancia bruta', f: c => c.f && c.f.gp, fmt: fmt.usdB, head: 'Ganancia bruta', sub: 'Ventas menos costo directo de lo vendido, últimos 12 meses.' },
    gm: { name: 'Margen bruto', f: c => c.f && c.f.gm, fmt: fmt.pctPlain, head: 'Margen bruto', sub: 'Ganancia bruta como porcentaje de las ventas, últimos 12 meses.' },
    nm: { name: 'Margen neto', f: c => c.f && c.f.nm, fmt: fmt.pctPlain, head: 'Margen neto', sub: 'Utilidad neta como porcentaje de las ventas, últimos 12 meses.' },
    capex: { name: 'Inversión (capex)', f: c => c.f && c.f.capex, fmt: fmt.usdB, head: 'Inversión de capital', sub: 'Inversión de capital de los últimos 12 meses (toda la empresa, no solo IA).' }
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
  seg('f-metric', Object.entries(METRICS).filter(([k, m]) => D.companies.some(c => m.f(c) != null)).map(([k, m]) => [k, m.name]), 'metric');
  seg('f-cat', [['all', 'Todos'], ['chips', 'Chips'], ['big', 'Gigantes'], ['soft', 'Software']], 'cat');
  drawRank();

  /* ---------- fichas ---------- */
  const A = (l, text) => l ? `<a href="${esc(typeof l === 'string' ? l : l.url)}" target="_blank" rel="noopener">${text}${l.pdf ? ' <span class="pill pdf">PDF</span>' : ''}</a>` : '';
  const fs = { cat: 'all', key: 'rev', dir: -1 };
  const money = v => v == null ? '<span class="muted">s/d</span>' : `<span class="${v < 0 ? 'neg' : ''}">${esc(fmt.usdB(v).replace('US$ ', ''))}</span>`;
  const pc = v => v == null ? '<span class="muted">s/d</span>' : `<span class="${v < 0 ? 'neg' : ''}">${esc(fmt.pctPlain(v))}</span>`;
  const was = (a, b) => b == null ? pc(b) : (a == null ? '' : `<span class="mm">${esc(fmt.pctPlain(a))} → </span>`) + pc(b);
  const COLS = [
    ['Empresa', 'name'], ['Ingresos', 'rev'], ['Ganancia bruta', 'gp'], ['Margen bruto 2022 → hoy', 'gm'], ['Margen operativo', 'om'],
    ['Utilidad neta', 'ni'], ['Margen neto 2022 → hoy', 'nm'], ['Inversión (capex)', 'capex'], ['Capex / ingresos', 'capex_pct'], ['Flujo de caja libre', 'fcf'], ['Más detalle', null]
  ];
  function drawFichas() {
    const host = $('tb-fichas'); host.innerHTML = '';
    const list = D.companies.filter(c => c.f && (fs.cat === 'all' || c.cat === fs.cat));
    const val = c => fs.key === 'name' ? c.name : c.f[fs.key];
    list.sort((a, b) => { const x = val(a), y = val(b); if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * fs.dir; });
    const t = el('table'), hr = el('tr');
    COLS.forEach(([h, k], i) => {
      const th = el('th', { text: h, class: i ? 'n' : '' });
      if (k) { if (k === fs.key) th.setAttribute('aria-sort', fs.dir < 0 ? 'descending' : 'ascending'); th.tabIndex = 0;
        const go = () => { fs.dir = fs.key === k ? -fs.dir : (k === 'name' ? 1 : -1); fs.key = k; drawFichas(); };
        th.addEventListener('click', go); th.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); }
      hr.appendChild(th);
    });
    t.appendChild(el('thead', {}, hr));
    t.appendChild(el('tbody', {}, list.map(c => { const f = c.f, L = c.links || {}; return el('tr', {}, [
      el('th', { html: `<span class="dotc" style="background:var(${CAT[c.cat].color})"></span>${esc(c.name)}${f.fx ? '*' : ''}<small>${esc(c.sub || '')}</small>` }),
      el('td', { class: 'n', html: money(f.rev) }), el('td', { class: 'n', html: money(f.gp) }), el('td', { class: 'n', html: was(f.gm22, f.gm) }),
      el('td', { class: 'n', html: pc(f.om) }), el('td', { class: 'n', html: money(f.ni) }), el('td', { class: 'n', html: was(f.nm22, f.nm) }),
      el('td', { class: 'n', html: money(f.capex) }), el('td', { class: 'n', html: pc(f.capex_pct) }), el('td', { class: 'n', html: money(f.fcf) }),
      el('td', { class: 'lk', html: A(L.fin, 'Estados') + A(L.annual, 'Informe anual') + A(L.quarterly, 'Resultados') + A(L.ir, 'Inversionistas') })
    ]); })));
    host.appendChild(t);
  }
  if (D.companies.some(c => c.f)) {
    [['all', 'Todos'], ['chips', 'Chips'], ['big', 'Gigantes'], ['soft', 'Software']].forEach(([v, label]) => {
      const b = el('button', { type: 'button', 'aria-pressed': String(fs.cat === v), text: label });
      b.addEventListener('click', () => { fs.cat = v; $('f-fcat').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawFichas(); });
      $('f-fcat').appendChild(b);
    });
    drawFichas();
  } else { $('fichas').hidden = true; }

  /* ---------- documentos ---------- */
  (D.studies || []).forEach(d => $('doc-studies').appendChild(el('li', { html: `<span class="o">${esc(d.org || '')}${d.date ? ' · ' + esc(fdate(d.date)) : ''}</span><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title || d.url)}</a>${d.pdf ? '<span class="pill pdf">PDF</span>' : ''}` })));
  D.companies.filter(c => c.links && (c.links.annual || c.links.quarterly || c.links.ir)).forEach(c => { const L = c.links;
    $('doc-cos').appendChild(el('li', { html: `<b>${esc(c.name)}</b> <span class="lk">${A(L.annual, esc(((L.annual && L.annual.title) || 'Informe anual').replace(/\s*\((SEC )?EDGAR[^)]*\)/i, '')))}${A(L.quarterly, 'Últimos resultados')}${A(L.ir, 'Inversionistas')}</span>` })); });
  if (!$('doc-studies').children.length && !$('doc-cos').children.length) $('documentos').hidden = true;

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
  network($('c-net'), {
    nodes: D.net.nodes, edges: D.net.edges, aria: 'Red de inversiones y contratos de cómputo entre proveedores y laboratorios de IA',
    kinds: [{ id: 'inv', name: 'Inversión: el proveedor pone capital en el laboratorio', color: '--s3' }, { id: 'buy', name: 'Compra: el laboratorio se compromete a gastar en el proveedor', color: '--s2' }]
  });
  src('s-net', D.net.edges.flatMap(e => e.src));
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

  /* ---------- apoyo: QR de Yape ---------- */
  $('yape-btn').addEventListener('click', () => {
    const open = $('yape-btn').getAttribute('aria-expanded') !== 'true';
    $('yape-btn').setAttribute('aria-expanded', String(open));
    $('yape-box').hidden = !open;
  });

  /* ---------- movimiento ---------- */
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window) || document.documentElement.classList.contains('quieto');
  const reveal = document.querySelectorAll('.card, .tile, .vcard, .flow, .callout, .heroFig');
  const charts = document.querySelectorAll('.chart');
  if (still) {
    reveal.forEach(n => n.classList.add('in')); charts.forEach(n => n.classList.add('inview'));
  } else {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add(e.target.classList.contains('chart') ? 'inview' : 'in'); io.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveal.forEach((n, i) => { n.style.setProperty('--d', (i % 4) * 70 + 'ms'); io.observe(n); });
    charts.forEach(n => io.observe(n));
    // contador de la cifra principal
    const target = D.gap[0].value / D.gap[1].value, t0 = performance.now();
    (function tick(t) {
      const k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3);
      $('heroN').textContent = fmt.num(target * e, 1) + '×';
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
  // páginas: cada sección es una pestaña
  document.querySelectorAll('main > .page[hidden]').forEach(x => { const l = document.querySelector(`.nav a[href="#${x.id}"]`); if (l) l.remove(); });
  const pages = [...document.querySelectorAll('main > .page')].filter(x => !x.hidden);
  const links = [...document.querySelectorAll('.nav a')];
  const title = id => { const l = links.find(a => a.getAttribute('href') === '#' + id); return l ? l.textContent : id; };
  pages.forEach((pg, i) => {
    const nav = el('div', { class: 'pager' });
    if (i > 0) nav.appendChild(el('a', { href: '#' + pages[i - 1].id, class: 'prev', html: `<small>← Anterior</small><b>${esc(title(pages[i - 1].id))}</b>` }));
    if (i < pages.length - 1) nav.appendChild(el('a', { href: '#' + pages[i + 1].id, class: 'next', html: `<small>Siguiente →</small><b>${esc(title(pages[i + 1].id))}</b>` }));
    pg.querySelector('.wrap').appendChild(nav);
  });
  function show(id, target) {
    pages.forEach(x => x.classList.toggle('active', x.id === id));
    links.forEach(a => { const on = a.getAttribute('href') === '#' + id; a.classList.toggle('on', on); if (on) a.parentNode.scrollTo({ left: a.offsetLeft - 60, behavior: 'smooth' }); });
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'center' })); else scrollTo(0, 0);
    onScroll();
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1)) || 'resumen';
    if (pages.some(x => x.id === h)) return show(h);
    const t = document.getElementById(h), host = t && t.closest('.page');
    if (host) show(host.id, t); else show('resumen');
  }
  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    $('progress').style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('hashchange', route);
  route();

  /* ---------- tema ---------- */
  $('theme').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('tema', next); } catch (e) {}
  });
})();
