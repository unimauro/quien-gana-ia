/* Mini librería de gráficos (SVG/HTML, sin dependencias).
   Cada gráfico: leyenda si hay ≥2 series, tooltip al pasar, y vista de tabla. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    [].concat(kids).forEach(c => c && n.appendChild(c));
    return n;
  };
  const svg = (tag, attrs = {}, text) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- formato ---------- */
  const num = (v, d = 0) => v.toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt = {
    usdB(v) {
      if (v == null) return 's/d';
      const a = Math.abs(v), s = v < 0 ? '−' : '';
      if (a >= 1000) return `${s}US$ ${(a / 1000).toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: a >= 10000 ? 1 : 2 })} bill.`;
      if (a >= 100) return `${s}US$ ${num(a)} mil M`;
      if (a >= 1) return `${s}US$ ${num(a, a >= 10 ? 0 : 1)} mil M`;
      return `${s}US$ ${num(a * 1000)} M`;
    },
    usdBshort(v) {
      if (v == null) return 's/d';
      const a = Math.abs(v), s = v < 0 ? '−' : '';
            if (a >= 10 || a === 0) return `${s}${num(a)}`;
      return `${s}${num(a, 1)}`;
    },
    pct(v) { return v == null ? 's/d' : `${v < 0 ? '−' : v > 0 ? '+' : ''}${num(Math.abs(v))} %`; },
    pctPlain(v) { return v == null ? 's/d' : `${v < 0 ? '−' : ''}${num(Math.abs(v))} %`; },
    x(v) { return v == null ? 's/d' : `${num(v, v < 10 ? 1 : 0)}×`; },
    num
  };

  /* ---------- tooltip ---------- */
  let tip;
  function showTip(html, x, y) {
    if (!tip) { tip = el('div', { class: 'tip', role: 'status' }); document.body.appendChild(tip); }
    tip.innerHTML = html;
    tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (left < 8) left = 8;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    tip.style.left = left + 'px'; tip.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  addEventListener('scroll', hideTip, { passive: true });
  function bindTip(node, htmlFn) {
    node.addEventListener('pointermove', e => showTip(htmlFn(), e.clientX, e.clientY));
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', () => { const r = node.getBoundingClientRect(); showTip(htmlFn(), r.left + r.width / 2, r.top); });
    node.addEventListener('blur', hideTip);
  }

  function niceTicks(min, max, n = 5) {
    if (min === max) max = min + 1;
    const span = max - min, raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p, step = (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1) * p;
    const t = [];
    for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) t.push(+v.toFixed(10));
    if (t[t.length - 1] < max) t.push(t[t.length - 1] + step);
    return t;
  }

  /* ---------- armazón: leyenda + gráfico + tabla ---------- */
  function frame(host, { legend, table }) {
    host.innerHTML = '';
    host.classList.add('chart');
    if (legend && legend.length >= 2) {
      host.appendChild(el('div', { class: 'legend' }, legend.map(l =>
        el('span', { class: 'lg' }, [el('i', { class: l.line ? 'key line' : 'key', style: `background:var(${l.color})` }), el('span', { text: l.name })]))));
    }
    const plot = el('div', { class: 'plot' });
    host.appendChild(plot);
    if (table) {
      const det = el('details', { class: 'tview' }, [el('summary', { text: 'Ver datos en tabla' })]);
      const wrap = el('div', { class: 'twrap' });
      const t = el('table');
      t.appendChild(el('thead', {}, el('tr', {}, table.head.map(h => el('th', { text: h })))));
      t.appendChild(el('tbody', {}, table.rows.map(r => el('tr', {}, r.map((c, i) => el(i ? 'td' : 'th', { text: c == null ? 's/d' : c }))))));
      wrap.appendChild(t); det.appendChild(wrap); host.appendChild(det);
    }
    return plot;
  }
  function onResize(node, draw) {
    let w = 0;
    new ResizeObserver(() => { const nw = node.clientWidth; if (nw && Math.abs(nw - w) > 4) { w = nw; draw(nw); } }).observe(node);
  }

  /* ---------- barras horizontales (admite negativos) ----------
     rows: [{label, value, color, sub, tip}] */
  function hbar(host, o) {
    const f = o.fmt || fmt.usdB;
    const rows = o.rows.filter(r => r.value != null);
    const max = Math.max(0, ...rows.map(r => r.value)), min = Math.min(0, ...rows.map(r => r.value));
    const span = (max - min) || 1, zero = (-min / span) * 100;
    const plot = frame(host, {
      legend: o.legend,
      table: { head: [o.labelHead || 'Empresa', o.valueHead || 'Valor'].concat(o.extraHead || []), rows: o.rows.map(r => [r.label, f(r.value)].concat(r.extra || [])) }
    });
    const list = el('div', { class: 'hbars' + (min < 0 ? ' neg' : '') });
    rows.forEach((r, ri) => {
      const w = Math.abs(r.value) / span * 100;
      const left = r.value >= 0 ? zero : zero - w;
      const bar = el('i', { class: 'bar ' + (r.value >= 0 ? 'pos' : 'negv'), style: `left:${left}%;width:${Math.max(w, 0.4)}%;background:var(${r.color || '--s1'});--i:${Math.min(ri, 24)}` });
      const track = el('div', { class: 'track' }, [bar]);
      if (min < 0) track.appendChild(el('i', { class: 'zero', style: `left:${zero}%` }));
      const row = el('div', { class: 'hrow', tabindex: '0' }, [
        el('div', { class: 'hl' }, [el('span', { text: r.label }), r.sub ? el('small', { text: r.sub }) : null]),
        track,
        el('div', { class: 'hv', text: f(r.value) })
      ]);
      bindTip(row, () => `<b>${esc(r.label)}</b>${r.sub ? `<span>${esc(r.sub)}</span>` : ''}<span class="tv">${esc(f(r.value))}</span>${r.tip ? `<span>${esc(r.tip)}</span>` : ''}`);
      list.appendChild(row);
    });
    plot.appendChild(list);
  }

  /* ---------- columnas (apiladas o agrupadas) ----------
     cats: ['2021',…]; series: [{name,color,values:[…]}] */
  function columns(host, o) {
    const f = o.fmt || fmt.usdB, fs = o.fmtShort || fmt.usdBshort;
    const H = o.height || 300, stacked = o.stacked !== false && o.series.length > 1 && !o.grouped;
    const plot = frame(host, {
      legend: o.series.map(s => ({ name: s.name, color: s.color })),
      table: {
        head: [o.catHead || 'Año'].concat(o.series.map(s => s.name), stacked ? ['Total'] : []),
        rows: o.cats.map((c, i) => [c].concat(o.series.map(s => f(s.values[i])), stacked ? [f(o.series.reduce((a, s) => a + (s.values[i] || 0), 0))] : []))
      }
    });
    const totals = o.cats.map((_, i) => o.series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0));
    const vmax = stacked ? Math.max(...totals) : Math.max(...o.series.flatMap(s => s.values.map(v => v || 0)));
    const vmin = Math.min(0, ...o.series.flatMap(s => s.values.map(v => v || 0)));
    const ticks = niceTicks(vmin, vmax, 4), top = ticks[ticks.length - 1], bot = ticks[0];
    onResize(plot, W => {
      plot.innerHTML = '';
      const m = { l: 44, r: 8, t: 22, b: 30 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
      const y = v => m.t + ph - (v - bot) / (top - bot) * ph;
      const s = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.aria || 'Gráfico de columnas' });
      ticks.forEach(t => {
        s.appendChild(svg('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }));
        s.appendChild(svg('text', { x: m.l - 6, y: y(t) + 4, class: 'tick', 'text-anchor': 'end' }, fs(t)));
      });
      const band = pw / o.cats.length;
      o.cats.forEach((c, i) => {
        const cx = m.l + band * i + band / 2;
        s.appendChild(svg('text', { x: cx, y: H - 8, class: 'tick' + (o.catNote && o.catNote[i] ? ' est' : ''), 'text-anchor': 'middle' }, c));
        const g = svg('g', { tabindex: 0, class: 'colg', style: `--i:${i}` });
        if (stacked) {
          const bw = Math.min(24 * 1.6, band * 0.56); let acc = 0;
          o.series.forEach((se, k) => {
            const v = se.values[i] || 0; if (v <= 0) return;
            const y1 = y(acc + v), y0 = y(acc); acc += v;
            const last = !o.series.slice(k + 1).some(z => (z.values[i] || 0) > 0);
            const h = Math.max(0, y0 - y1 - 2);
            g.appendChild(svg('path', { d: roundTop(cx - bw / 2, y1, bw, h, last ? 4 : 0), fill: `var(${se.color})`, opacity: o.catNote && o.catNote[i] ? 0.55 : 1 }));
          });
          s.appendChild(svg('text', { x: cx, y: y(totals[i]) - 6, class: 'vlabel', 'text-anchor': 'middle' }, fs(totals[i])));
        } else {
          const n = o.series.length, bw = Math.min(24, (band * 0.7) / n - 2), gw = n * bw + (n - 1) * 2;
          o.series.forEach((se, k) => {
            const v = se.values[i]; if (v == null) return;
            const x = cx - gw / 2 + k * (bw + 2), y1 = y(Math.max(v, 0)), h = Math.abs(y(v) - y(0));
            g.appendChild(svg('path', { d: v >= 0 ? roundTop(x, y1, bw, h, 4) : roundBottom(x, y(0), bw, h, 4), fill: `var(${se.color})`, opacity: o.catNote && o.catNote[i] ? 0.55 : 1 }));
            if (band > 70 || n === 1) s.appendChild(svg('text', { x: x + bw / 2, y: (v >= 0 ? y1 - 6 : y(v) + 14), class: 'vlabel', 'text-anchor': 'middle' }, fs(v)));
          });
        }
        g.appendChild(svg('rect', { x: m.l + band * i, y: m.t, width: band, height: ph, fill: 'transparent' }));
        bindTip(g, () => `<b>${esc(c)}${o.catNote && o.catNote[i] ? ' · ' + esc(o.catNote[i]) : ''}</b>` +
          o.series.map(se => se.values[i] == null ? '' : `<span class="tr"><i style="background:var(${se.color})"></i>${esc(se.name)}<em>${esc(f(se.values[i]))}</em></span>`).join('') +
          (stacked ? `<span class="tr tot">Total<em>${esc(f(totals[i]))}</em></span>` : ''));
        s.appendChild(g);
      });
      plot.appendChild(s);
    });
  }
  function roundTop(x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  function roundBottom(x, y, w, h, r) {
    r = Math.min(r, h, w / 2);
    return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
  }

  /* ---------- líneas ----------
     series: [{name,color,points:[{x:'2024-03'|2024, y, note}]}] */
  const tx = v => typeof v === 'number' ? v : (() => { const [Y, M = 1, D = 1] = String(v).split('-').map(Number); return Y + (M - 1) / 12 + (D - 1) / 365; })();
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const xLabel = v => typeof v === 'number' ? String(v) : (() => { const [Y, M] = String(v).split('-').map(Number); return M ? `${MES[M - 1]} ${Y}` : String(Y); })();
  function line(host, o) {
    const f = o.fmt || fmt.usdB, fs = o.fmtShort || fmt.usdBshort, H = o.height || 300, log = !!o.log;
    const series = o.series.map(s => ({ ...s, pts: s.points.filter(p => p.y != null && (!log || p.y > 0)).map(p => ({ ...p, X: tx(p.x) })).sort((a, b) => a.X - b.X) })).filter(s => s.pts.length);
    const all = series.flatMap(s => s.pts);
    const plot = frame(host, {
      legend: series.map(s => ({ name: s.name, color: s.color, line: true })),
      table: { head: ['Serie', 'Fecha', o.valueHead || 'Valor'], rows: series.flatMap(s => s.pts.map(p => [s.name, xLabel(p.x), f(p.y) + (p.note ? ` (${p.note})` : '')])) }
    });
    const x0 = Math.min(...all.map(p => p.X)), x1 = Math.max(...all.map(p => p.X));
    const ymax = Math.max(...all.map(p => p.y)), ymin = Math.min(...all.map(p => p.y));
    let ticks, Y;
    if (log) {
      const lo = Math.floor(Math.log10(ymin)), hi = Math.ceil(Math.log10(ymax));
      ticks = []; for (let e = lo; e <= hi; e++) ticks.push(Math.pow(10, e));
      Y = (v, t, ph) => t + ph - (Math.log10(v) - lo) / ((hi - lo) || 1) * ph;
    } else {
      ticks = niceTicks(Math.min(0, ymin), ymax, 4);
      const b = ticks[0], tp = ticks[ticks.length - 1];
      Y = (v, t, ph) => t + ph - (v - b) / (tp - b) * ph;
    }
    onResize(plot, W => {
      plot.innerHTML = '';
      const direct = series.length <= 4 && W > 520;
      const m = { l: 46, r: direct ? 118 : 14, t: 16, b: 30 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
      const X = v => m.l + (x1 === x0 ? pw / 2 : (v - x0) / (x1 - x0) * pw), y = v => Y(v, m.t, ph);
      const s = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.aria || 'Gráfico de líneas' });
      ticks.forEach(t => {
        s.appendChild(svg('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }));
        s.appendChild(svg('text', { x: m.l - 6, y: y(t) + 4, class: 'tick', 'text-anchor': 'end' }, fs(t)));
      });
      const yStep = pw / (Math.ceil(x1) - Math.floor(x0) || 1) < 46 ? 2 : 1;
      for (let yr = Math.ceil(x0); yr <= Math.floor(x1); yr += yStep) {
        s.appendChild(svg('text', { x: X(yr), y: H - 8, class: 'tick', 'text-anchor': 'middle' }, yr));
        s.appendChild(svg('line', { x1: X(yr), x2: X(yr), y1: m.t + ph, y2: m.t + ph + 4, class: 'axis' }));
      }
      const ends = [];
      series.forEach(se => {
        s.appendChild(svg('path', { d: se.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.X).toFixed(1)},${y(p.y).toFixed(1)}`).join(''), class: 'ln', pathLength: 1, fill: 'none', stroke: `var(${se.color})`, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
        se.pts.forEach((p, i) => {
          const last = i === se.pts.length - 1;
          const c = svg('circle', { cx: X(p.X), cy: y(p.y), r: last ? 4.5 : 3, fill: `var(${se.color})`, class: 'dot', tabindex: 0 });
          const hit = svg('circle', { cx: X(p.X), cy: y(p.y), r: 13, fill: 'transparent' });
          const h = () => `<b>${esc(se.name)}</b><span>${esc(xLabel(p.x))}</span><span class="tv">${esc(f(p.y))}</span>${p.note ? `<span>${esc(p.note)}</span>` : ''}`;
          bindTip(hit, h); bindTip(c, h);
          s.appendChild(c); s.appendChild(hit);
        });
        const lp = se.pts[se.pts.length - 1];
        ends.push({ se, y: y(lp.y), x: X(lp.X), v: lp.y });
      });
      if (direct) {
        ends.sort((a, b) => a.y - b.y);
        for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 26) ends[i].ly = (ends[i - 1].ly || ends[i - 1].y) + 26;
        ends.forEach(e => {
          const ly = e.ly || e.y;
          if (e.ly) s.appendChild(svg('line', { x1: e.x + 6, y1: e.y, x2: e.x + 12, y2: ly, class: 'axis' }));
          s.appendChild(svg('text', { x: e.x + 14, y: ly - 1, class: 'elabel' }, e.se.short || e.se.name));
          s.appendChild(svg('text', { x: e.x + 14, y: ly + 12, class: 'evalue' }, f(e.v)));
        });
      }
      plot.appendChild(s);
    });
  }

  window.Charts = { hbar, columns, line, fmt, el, esc };
})();
