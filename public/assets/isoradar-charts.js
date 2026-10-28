/* ==========================================================================
   ISO Radar — dashboard and KPI charts.

   Replaces the page's original chart functions, which mixed invented values
   (random jitter, fixed fill-ins) into the trend and gave every standard the
   same average. Everything here is drawn from what the server returns:
     • compliance_trend  — monthly average of completed inspections (null = no data)
     • iso_breakdown     — each standard's own inspection average and count
     • nonconformances   — Pareto by category
     • kpi.history       — KPI sparklines and the KPI detail chart
   Charts share one look (ISO Radar palette, page fonts, RTL-aware tooltips),
   show a clear empty state instead of a blank box, and respect reduced motion.
   Depends on: Chart.js, window.MOCK_DB (the page's loaded data).
   ========================================================================== */
(function () {
  'use strict';
  if (!window.Chart) return;

  const C = {
    ink: '#142D4E', teal: '#17796f', tealFill: '#22A699', gold: '#D9A441', goldDeep: '#8a6410',
    blue: '#1d5fa8', red: '#c2410c', muted: '#5d6b7e', fog: '#A7B0BC', grid: 'rgba(20,45,78,.06)',
  };
  const SERIES = [C.teal, C.ink, C.gold, C.blue, C.red, '#6b7f99'];
  // the four main standards always get the same palette colour, whatever is stored on them
  const STD_COLOR = { ISO_9001: C.teal, ISO_45001: C.ink, ISO_14001: C.gold, ISO_27001: C.blue };
  const isEn = () => document.documentElement.lang === 'en';
  const isRtl = () => document.documentElement.dir === 'rtl';
  const t = (ar, en) => (isEn() ? en : ar);
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── shared look ──────────────────────────────────────────────────────
  const bodyFont = getComputedStyle(document.body).fontFamily || '"IBM Plex Sans Arabic", system-ui, sans-serif';
  Chart.defaults.font.family = bodyFont;
  Chart.defaults.font.size = 11;
  Chart.defaults.color = C.muted;
  Chart.defaults.borderColor = C.grid;
  // set fields, never replace the animation object: Chart.js keeps internal resolvers on it
  Chart.defaults.animation.duration = reduced ? 0 : 650;
  Chart.defaults.animation.easing = 'easeOutQuart';
  Chart.defaults.plugins.legend.position = 'bottom';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.padding = 14;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: C.ink, titleColor: '#fff', bodyColor: '#e6ebf2', padding: 10, cornerRadius: 10,
    displayColors: true, boxPadding: 4,
  });
  Chart.defaults.elements.bar.borderRadius = 6;
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.point.hoverRadius = 6;

  const tooltipDir = () => ({ rtl: isRtl(), textDirection: isRtl() ? 'rtl' : 'ltr' });
  const charts = (window._dashCharts = window._dashCharts || {});
  const kill = key => { if (charts[key]) { charts[key].destroy(); delete charts[key]; } };

  /** Hides the canvas and shows one message in its place (never stacks duplicates). */
  function empty(canvas, msg) {
    canvas.style.display = 'none';
    let box = canvas.parentElement.querySelector(':scope > .ir-chart-empty');
    if (!box) {
      box = document.createElement('div');
      box.className = 'ir-chart-empty';
      canvas.insertAdjacentElement('afterend', box);
    }
    box.innerHTML = '<i class="fas fa-chart-line"></i><span></span>';
    box.querySelector('span').textContent = msg;
  }
  function show(canvas) {
    canvas.style.display = '';
    canvas.parentElement.querySelector(':scope > .ir-chart-empty')?.remove();
  }

  const monthLabel = key => {
    const d = new Date(key + '-01T00:00:00');
    return isNaN(d) ? key : d.toLocaleDateString(isEn() ? 'en-GB' : 'ar-SA', { month: 'short', year: '2-digit' });
  };
  const areaFill = (ctx, color) => {
    const { chart } = ctx;
    if (!chart.chartArea) return color + '1f';
    const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
    g.addColorStop(0, color + '38');
    g.addColorStop(1, color + '02');
    return g;
  };

  // ── compliance trend ─────────────────────────────────────────────────
  let trendSeries = [];

  function setPeriodButtons(active) {
    [3, 6, 12].forEach(m => {
      const b = document.getElementById('trend-btn-' + m);
      if (!b) return;
      const on = m === active;
      b.classList.toggle('is-active', on);
      b.style.background = on ? '#fff' : 'transparent';
      b.style.color = on ? C.teal : C.muted;
      b.style.boxShadow = on ? '0 1px 3px rgba(20,45,78,.12)' : 'none';
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function drawTrend(points) {
    const canvas = document.getElementById('chart-trend');
    if (!canvas) return;
    kill('trend');
    if (!points.some(p => p.avg_score !== null && p.avg_score !== undefined)) {
      empty(canvas, t('لا توجد تفتيشات مكتملة في هذه الفترة بعد', 'No completed inspections in this period yet'));
      return;
    }
    show(canvas);
    const vals = points.map(p => (p.avg_score === null || p.avg_score === undefined ? null : Number(p.avg_score)));
    const known = vals.filter(v => v !== null);
    charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels: points.map(p => monthLabel(p.month)),
        datasets: [{
          label: t('متوسط الامتثال %', 'Average compliance %'),
          data: vals,
          borderColor: C.teal,
          backgroundColor: ctx => areaFill(ctx, C.teal),
          fill: true, tension: 0.35, spanGaps: true,
          pointBackgroundColor: '#fff', pointBorderColor: C.teal, pointBorderWidth: 2, pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        // gradient fills cannot be colour-interpolated by Chart.js
        animations: { colors: false },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipDir(),
            callbacks: {
              label: ctx => {
                const p = points[ctx.dataIndex];
                return `${Math.round(ctx.raw)}% · ${p.count || 0} ${t('تفتيش', 'inspections')}`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 12 } },
          y: {
            suggestedMin: Math.max(0, Math.floor((Math.min(...known) - 10) / 10) * 10),
            max: 100,
            ticks: { callback: v => v + '%' },
          },
        },
      },
    });
  }

  window.renderTrendChart = function (trend) {
    trendSeries = Array.isArray(trend) ? trend : [];
    const months = window._trendMonths || 6;
    const from = document.getElementById('trend-date-from');
    const to = document.getElementById('trend-date-to');
    if (trendSeries.length && from && to) {
      from.value = trendSeries[Math.max(0, trendSeries.length - months)].month;
      to.value = trendSeries[trendSeries.length - 1].month;
    }
    window.updateTrendChart(months);
  };
  window.updateTrendChart = function (months) {
    window._trendMonths = months;
    setPeriodButtons(months);
    drawTrend(trendSeries.slice(-months));
  };
  window.updateTrendChartCustom = function () {
    const from = document.getElementById('trend-date-from')?.value;
    const to = document.getElementById('trend-date-to')?.value;
    if (!from || !to || from > to) return;
    setPeriodButtons(null);
    drawTrend(trendSeries.filter(p => p.month >= from && p.month <= to));
  };
  window.buildTrendData = () => ({ labels: trendSeries.map(p => monthLabel(p.month)), datasets: [] });

  // ── standards doughnut ───────────────────────────────────────────────
  let isoBreakdown = [];

  window.renderISOChart = function (iso) {
    isoBreakdown = Array.isArray(iso) ? iso : [];
    window.updateISOChart();
  };
  window.updateISOChart = function () {
    const canvas = document.getElementById('chart-iso');
    if (!canvas) return;
    kill('iso');
    const metric = document.getElementById('iso-chart-metric')?.value || 'compliance';
    const cert = window.MOCK_DB?.org_profile?.certified_standards || [];
    const stds = (window.MOCK_DB?.iso_standards || []).filter(s => !cert.length || cert.includes(s.code));
    const rows = stds.length
      ? stds.map(s => ({ std: s, d: isoBreakdown.find(b => b.iso_standard === s.code) || {} }))
      : isoBreakdown.map(b => ({ std: { code: b.iso_standard, color: b.color }, d: b }));
    const gap = window.MOCK_DB?.gap_analysis || {};

    let vals, unit;
    if (metric === 'inspections') {
      vals = rows.map(r => r.d.total_inspections || 0);
      unit = ' ' + t('تفتيش', 'inspections');
    } else if (metric === 'gap') {
      vals = rows.map(r => {
        const v = Object.values(gap[r.std.code]?.clauses || {});
        return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
      });
      unit = '%';
    } else {
      vals = rows.map(r => Math.round(r.d.avg_compliance || 0));
      unit = '%';
    }

    if (!rows.length || vals.every(v => !v)) {
      empty(canvas, metric === 'gap'
        ? t('لم يُجرَ تقييم فجوة بعد', 'No gap assessment yet')
        : t('لا توجد تفتيشات مكتملة مرتبطة بالمعايير بعد', 'No completed inspections linked to standards yet'));
      return;
    }
    show(canvas);
    charts.iso = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: rows.map(r => r.std.code.replace('_', ' ')),
        datasets: [{
          data: vals,
          backgroundColor: rows.map((r, i) => STD_COLOR[r.std.code] || SERIES[i % SERIES.length]),
          borderColor: '#fff', borderWidth: 3, hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, cutout: '64%',
        plugins: { tooltip: { ...tooltipDir(), callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}${unit}` } } },
      },
    });
  };

  // ── NC Pareto ────────────────────────────────────────────────────────
  const CAT = {
    safety: ['السلامة', 'Safety'], quality: ['الجودة', 'Quality'], environmental: ['البيئة', 'Environment'],
    process: ['العمليات', 'Process'], documentation: ['الوثائق', 'Documentation'], equipment: ['المعدات', 'Equipment'],
    security: ['الأمن', 'Security'], other: ['أخرى', 'Other'],
  };
  window.renderParetoChart = function () { window.updateParetoChart(); };
  window.updateParetoChart = function () {
    const canvas = document.getElementById('chart-pareto');
    if (!canvas) return;
    kill('pareto');
    const iso = document.getElementById('pareto-filter-iso')?.value || '';
    const status = document.getElementById('pareto-filter-status')?.value || '';
    const ncs = (window.MOCK_DB?.nonconformances || []).filter(n =>
      (!iso || n.iso_standard === iso) && (!status || String(n.status || '').toLowerCase() === status));
    const counts = {};
    ncs.forEach(n => { const k = String(n.category || 'other').toLowerCase(); counts[k] = (counts[k] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) {
      empty(canvas, iso || status
        ? t('لا توجد حالات عدم مطابقة لهذا الفلتر', 'No nonconformities for this filter')
        : t('لا توجد حالات عدم مطابقة مسجّلة', 'No nonconformities recorded'));
      return;
    }
    show(canvas);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    let run = 0;
    const cum = sorted.map(([, v]) => { run += v; return Math.round((run / total) * 100); });
    charts.pareto = new Chart(canvas, {
      data: {
        labels: sorted.map(([k]) => (CAT[k] ? CAT[k][isEn() ? 1 : 0] : k)),
        datasets: [
          {
            type: 'bar', label: t('عدد الحالات', 'Cases'), data: sorted.map(([, v]) => v), yAxisID: 'y', order: 2,
            backgroundColor: cum.map(p => (p <= 80 ? C.red : C.fog)), maxBarThickness: 36,
          },
          {
            type: 'line', label: t('التراكمي %', 'Cumulative %'), data: cum, yAxisID: 'y2', order: 1,
            borderColor: C.ink, backgroundColor: C.ink, pointBackgroundColor: '#fff', pointBorderColor: C.ink,
            pointBorderWidth: 2, pointRadius: 3.5, tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        // gradient fills cannot be colour-interpolated by Chart.js
        animations: { colors: false },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: {
            ...tooltipDir(),
            callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.raw + (ctx.dataset.type === 'line' ? '%' : '') },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } },
          y2: { position: isRtl() ? 'left' : 'right', min: 0, max: 100, grid: { display: false }, ticks: { callback: v => v + '%' } },
        },
      },
    });
  };

  // ── KPI history (sparklines + detail chart) ─────────────────────────
  /** A KPI's recorded values, oldest first, as { month, val } (last 12). */
  window.IR_kpiHist = function (kpi) {
    const h = Array.isArray(kpi?.history) ? kpi.history : [];
    return h
      .filter(x => x && x.val !== null && x.val !== undefined && !isNaN(Number(x.val)))
      .slice(-12)
      .map(x => ({
        month: x.month || (x.date ? new Date(x.date).toLocaleDateString(isEn() ? 'en-GB' : 'ar-SA', { day: 'numeric', month: 'short' }) : ''),
        val: Number(x.val),
      }));
  };

  window.IR_drawKpiChart = function (canvasId, kpi, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    kill('kpi');
    const hist = window.IR_kpiHist(kpi);
    if (!hist.length) { empty(canvas, t('لا توجد قراءات مسجّلة لهذا المؤشر بعد', 'No readings recorded for this KPI yet')); return; }
    show(canvas);
    const target = kpi.target_value === null || kpi.target_value === undefined ? null : Number(kpi.target_value);
    charts.kpi = new Chart(canvas, {
      type: 'line',
      data: {
        labels: hist.map(h => h.month),
        datasets: [
          {
            label: kpi.name, data: hist.map(h => h.val), borderColor: color,
            backgroundColor: ctx => areaFill(ctx, color), fill: true, tension: 0.35,
            pointBackgroundColor: '#fff', pointBorderColor: color, pointBorderWidth: 2, pointRadius: 4,
          },
          ...(target !== null ? [{
            label: t('الهدف', 'Target'), data: hist.map(() => target), borderColor: C.gold,
            borderDash: [6, 5], pointRadius: 0, fill: false, borderWidth: 1.5,
          }] : []),
        ],
      },
      options: {
        responsive: true,
        // gradient fills cannot be colour-interpolated by Chart.js
        animations: { colors: false },
        interaction: { mode: 'index', intersect: false },
        plugins: { tooltip: { ...tooltipDir(), callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}${kpi.unit || ''}` } } },
        scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => v + (kpi.unit || '') } } },
      },
    });
  };
})();
