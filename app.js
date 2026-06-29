// ---- SVG 차트 헬퍼 ----
const svgns = 'http://www.w3.org/2000/svg';
function el(tag, attrs) {
  const e = document.createElementNS(svgns, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function hexToRgba(hex, a) {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const i = parseInt(n, 16);
  return `rgba(${(i >> 16) & 255},${(i >> 8) & 255},${i & 255},${a})`;
}

function sparkline(data, color, w, h) {
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, style: 'display:block;overflow:visible' });
  const min = Math.min(...data), max = Math.max(...data), r = (max - min) || 1, n = data.length, pad = 3;
  const X = i => pad + i * (w - 2 * pad) / (n - 1);
  const Y = v => pad + (1 - (v - min) / r) * (h - 2 * pad);
  let d = '';
  data.forEach((v, i) => { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1) + ' '; });
  svg.appendChild(el('path', { d: d.trim(), fill: 'none', stroke: color, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  svg.appendChild(el('circle', { cx: X(n - 1), cy: Y(data[n - 1]), r: 2.4, fill: color }));
  return svg;
}

function lineChart(data, opts) {
  const { w, h, color, id, fillFrom } = opts;
  const pad = 16, topPad = 12;
  const min = Math.min(...data), max = Math.max(...data), r = (max - min) || 1, n = data.length;
  const X = i => pad + i * (w - 2 * pad) / (n - 1);
  const Y = v => topPad + (1 - (v - min) / r) * (h - topPad - pad);
  let d = '';
  data.forEach((v, i) => { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1) + ' '; });
  const area = d + `L ${X(n - 1).toFixed(1)},${h - pad} L ${X(0).toFixed(1)},${h - pad} Z`;
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: h, style: 'display:block;overflow:visible' });
  const gid = 'grad' + id;
  const defs = el('defs', {});
  const grad = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.appendChild(el('stop', { offset: '0%', 'stop-color': fillFrom }));
  grad.appendChild(el('stop', { offset: '100%', 'stop-color': 'rgba(255,255,255,0)' }));
  defs.appendChild(grad);
  svg.appendChild(defs);
  for (let i = 0; i < 4; i++) {
    const yy = topPad + i * (h - topPad - pad) / 3;
    svg.appendChild(el('line', { x1: pad, y1: yy.toFixed(1), x2: w - pad, y2: yy.toFixed(1), stroke: '#1B1714', 'stroke-opacity': 0.06, 'stroke-width': 1 }));
  }
  svg.appendChild(el('path', { d: area, fill: `url(#${gid})` }));
  svg.appendChild(el('path', { d: d.trim(), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  data.forEach((v, i) => {
    const last = i === n - 1;
    svg.appendChild(el('circle', { cx: X(i), cy: Y(v), r: last ? 4.5 : 2.6, fill: last ? color : '#fff', stroke: color, 'stroke-width': 2 }));
  });
  return svg;
}

function donutChart(segs, size, thick) {
  const r = (size - thick) / 2, c = size / 2, circ = 2 * Math.PI * r, total = segs.reduce((s, x) => s + x.value, 0);
  let off = 0;
  const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size });
  svg.appendChild(el('circle', { cx: c, cy: c, r, fill: 'none', stroke: '#F1EDE9', 'stroke-width': thick }));
  segs.forEach(s => {
    const len = s.value / total * circ;
    svg.appendChild(el('circle', {
      cx: c, cy: c, r, fill: 'none', stroke: s.color, 'stroke-width': thick,
      'stroke-dasharray': `${len.toFixed(2)} ${(circ - len).toFixed(2)}`,
      'stroke-dashoffset': (-off).toFixed(2), transform: `rotate(-90 ${c} ${c})`
    }));
    off += len;
  });
  return svg;
}

// ---- 데이터 계산 ----
const DATA = computeAll();
const lastIdx = DATA.monthly.length - 1;
const prevIdx = lastIdx - 1;
const last = DATA.monthly[lastIdx];
const prev = DATA.monthly[prevIdx];

function trend(field) { return DATA.monthly.map(m => m[field]); }

// ---- 카드 정의 ----
const compositeDefs = [
  { key: 'ltvCac', label: 'LTV / CAC 비율', unit: '배', value: last.ltvCac, prevValue: prev.ltvCac, fmt: v => v.toFixed(2), series: trend('ltvCac'), note: '목표 3.0배↑ · 건강 기준', detail: 'ltvCac' },
  { key: 'unitEconomics', label: '단위경제 (Unit Eco.)', unit: '/건', value: last.unitEconomics, prevValue: prev.unitEconomics, fmt: v => fmtWon(v), series: trend('unitEconomics'), note: '주문 1건당 실이익', detail: 'unitEconomics' },
  { key: 'mktEfficiency', label: '마케팅 효율 지수', unit: '', value: last.mktEfficiency, prevValue: prev.mktEfficiency, fmt: v => v.toFixed(2), series: trend('mktEfficiency'), note: 'ROAS × 재구매율', detail: 'mktEfficiency' },
  { key: 'marginRate', label: '기여이익률 (충성도 보완)', unit: '%', value: last.marginRate, prevValue: prev.marginRate, isPct: true, fmt: v => fmtPct(v), series: trend('marginRate').map(v => v * 100), note: '할인·원가 차감 후 실이익률', detail: 'marginRate' },
];

const leadingDefs = [
  { key: 'newCustomers', label: '신규 고객 수', unit: '명', value: last.newCustomers, prevValue: prev.newCustomers, fmt: v => fmtNum(v), series: trend('newCustomers'), note: `CAC ${fmtWon(last.cac)}`, detail: 'newCustomers' },
  { key: 'cvr', label: '구매 전환율 (CVR)', unit: '%', value: last.cvr, prevValue: prev.cvr, isPct: true, fmt: v => fmtPct(v), series: trend('cvr').map(v => v * 100), note: '방문자 중 구매 비율', detail: 'cvr' },
  { key: 'cartDropRate', label: '장바구니 이탈률', unit: '%', value: last.cartDropRate, prevValue: prev.cartDropRate, isPct: true, invert: true, fmt: v => fmtPct(v), series: trend('cartDropRate').map(v => v * 100), note: '결제·배송비 신호', detail: 'cartDropRate' },
  { key: 'roas', label: 'ROAS', unit: '배', value: last.roas, prevValue: prev.roas, fmt: v => v.toFixed(2), series: trend('roas'), note: '광고비 대비 매출', detail: 'roas' },
  { key: 'avgReview', label: '평균 리뷰평점', unit: '/5', value: last.avgReview, prevValue: prev.avgReview, fmt: v => v.toFixed(2), series: trend('avgReview'), note: `리뷰 ${fmtNum(last.reviewCount)}건 (이달)`, detail: 'avgReview' },
  { key: 'adSpend', label: '총 광고비', unit: '', value: last.adSpend, prevValue: prev.adSpend, fmt: v => fmtWon(v), series: trend('adSpend'), note: '채널 합산 광고 지출', detail: 'adSpend' },
  { key: 'visits', label: '방문수', unit: '명', value: last.visits, prevValue: prev.visits, fmt: v => fmtNum(v), series: trend('visits'), note: '전체 채널 합산', detail: 'visits' },
];

const laggingDefs = [
  { key: 'marginRate', label: '기여이익률 (마진)', unit: '%', value: last.marginRate, prevValue: prev.marginRate, isPct: true, fmt: v => fmtPct(v), series: trend('marginRate').map(v => v * 100), note: '할인·물류·수수료 차감 후', detail: 'marginRate' },
  { key: 'repurchaseRate', label: '재구매율', unit: '%', value: last.repurchaseRate, prevValue: prev.repurchaseRate, isPct: true, fmt: v => fmtPct(v), series: trend('repurchaseRate').map(v => v * 100), note: '2회↑ 구매 주문 비율', detail: 'repurchaseRate' },
  { key: 'ltv', label: '고객생애가치 (LTV)', unit: '', value: last.ltv, prevValue: prev.ltv, fmt: v => fmtWon(v), series: trend('ltv'), note: '객단가×구매빈도', detail: 'ltv' },
  { key: 'returnRate', label: '반품·교환률', unit: '%', value: last.returnRate, prevValue: prev.returnRate, isPct: true, invert: true, fmt: v => fmtPct(v), series: trend('returnRate').map(v => v * 100), note: '낮을수록 양호', detail: 'returnRate' },
  { key: 'aov', label: '객단가 (AOV)', unit: '', value: last.aov, prevValue: prev.aov, fmt: v => fmtWon(v), series: trend('aov'), note: '결제금액 / 주문수', detail: 'aov' },
];

function renderDeltaTag(curr, prevV, isPct, invert) {
  let d = deltaStr(curr, prevV, isPct);
  if (invert && d.cls !== 'flat') d.cls = d.cls === 'pos' ? 'neg' : 'pos';
  return d;
}

function metricCard(def, size) {
  const card = document.createElement('div');
  card.className = `card metric-card ${size}`;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const d = renderDeltaTag(def.value, def.prevValue, def.isPct, def.invert);

  const labelEl = document.createElement('span');
  labelEl.className = 'card-label';
  labelEl.textContent = def.label;
  card.appendChild(labelEl);

  const valueRow = document.createElement('div');
  valueRow.className = 'value-row';
  const valueEl = document.createElement('span');
  valueEl.className = 'value';
  valueEl.textContent = def.fmt(def.value);
  const unitEl = document.createElement('span');
  unitEl.className = 'unit';
  unitEl.textContent = def.unit;
  valueRow.appendChild(valueEl);
  valueRow.appendChild(unitEl);
  card.appendChild(valueRow);

  const deltaRow = document.createElement('div');
  deltaRow.className = 'delta-row';
  const deltaEl = document.createElement('span');
  deltaEl.className = 'delta ' + d.cls;
  deltaEl.textContent = d.text;
  deltaRow.appendChild(deltaEl);
  const vsEl = document.createElement('span');
  vsEl.className = 'vs-label';
  vsEl.textContent = 'vs 전월';
  deltaRow.appendChild(vsEl);
  card.appendChild(deltaRow);

  const chartWrap = document.createElement('div');
  chartWrap.className = 'chart-wrap';
  const cw = size === 'composite' ? 130 : 104, ch = size === 'composite' ? 42 : 30;
  const sectionColor = size === 'composite' ? '#A8526B' : size === 'leading' ? '#2C7A8C' : '#A6791F';
  chartWrap.appendChild(sparkline(def.series, sectionColor, cw, ch));
  card.appendChild(chartWrap);

  const noteEl = document.createElement('span');
  noteEl.className = 'note';
  noteEl.textContent = def.note;
  card.appendChild(noteEl);

  card.addEventListener('click', () => openDetail(def));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openDetail(def); });
  return card;
}

function renderGrids() {
  const cg = document.getElementById('compositeGrid');
  compositeDefs.forEach(d => cg.appendChild(metricCard(d, 'composite')));

  const lg = document.getElementById('leadingGrid');
  leadingDefs.forEach(d => lg.appendChild(metricCard(d, 'leading')));

  const lag = document.getElementById('laggingGrid');
  laggingDefs.forEach(d => lag.appendChild(metricCard(d, 'lagging')));
}

function renderGmv() {
  const gmvSeries = trend('gmv');
  const d = deltaStr(last.gmv, prev.gmv, false);
  document.getElementById('gmvValue').textContent = fmtWon(last.gmv);
  const deltaEl = document.getElementById('gmvDelta');
  deltaEl.textContent = d.text;
  deltaEl.className = 'delta ' + d.cls;

  const chartEl = document.getElementById('gmvChart');
  chartEl.appendChild(lineChart(gmvSeries, { w: 740, h: 200, color: ACCENT, id: 'gmv', fillFrom: hexToRgba(ACCENT, 0.16) }));

  const monthsEl = document.getElementById('gmvMonths');
  MONTHS.forEach(m => {
    const s = document.createElement('span');
    s.textContent = MONTH_LABELS[m];
    monthsEl.appendChild(s);
  });

  document.getElementById('gmvCard').addEventListener('click', () => openDetail({ key: 'gmv', label: '매출 / GMV', unit: '', value: last.gmv, prevValue: prev.gmv, fmt: fmtWon, series: gmvSeries, detail: 'gmv' }));
}

function renderChannelDonut() {
  const total = Object.values(DATA.channelTotals).reduce((s, v) => s + v, 0);
  const segs = Object.entries(DATA.channelTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: CHANNEL_COLORS[label] || '#ccc' }));

  const wrap = document.getElementById('donutWrap');
  wrap.style.position = 'relative';
  wrap.appendChild(donutChart(segs, 132, 22));
  const center = document.createElement('div');
  center.className = 'donut-center';
  center.innerHTML = `<span class="donut-num">${segs.length}개</span><span class="donut-sub">채널</span>`;
  wrap.appendChild(center);

  const legend = document.getElementById('channelLegend');
  segs.forEach(s => {
    const row = document.createElement('div');
    row.className = 'legend-row';
    row.innerHTML = `<span class="dot" style="background:${s.color}"></span><span class="legend-label">${s.label}</span><span class="legend-pct">${((s.value / total) * 100).toFixed(0)}%</span>`;
    legend.appendChild(row);
  });

  document.getElementById('channelCard').addEventListener('click', () => openChannelDetail(segs, total));
}

// ---- 상세 모달 ----
const METRIC_META = {
  gmv: { title: '매출 / GMV', source: '자사몰·스마트스토어·올리브영 주문 DB + PG사 결제 데이터', formula: '결제금액 = 수량 × 단가 − 할인액 의 합계', breakdownBy: 'channel', field: 'gmv', isMoney: true },
  ltvCac: { title: 'LTV / CAC 비율', source: '거래원장 + 마케팅비용 시트', formula: 'LTV ÷ CAC · 3 이상이면 사업이 건강하다고 판단', breakdownBy: 'monthlyOnly', field: 'ltvCac' },
  unitEconomics: { title: '단위경제 (Unit Economics)', source: '거래원장 + 마케팅비용 시트', formula: '객단가 − 평균원가 − CAC = 주문 1건당 실이익', breakdownBy: 'monthlyOnly', field: 'unitEconomics', isMoney: true },
  mktEfficiency: { title: '마케팅 효율 지수', source: 'ROAS × 재구매율', formula: '한 번 사고 마는 고객을 거른 진짜 광고 효율', breakdownBy: 'monthlyOnly', field: 'mktEfficiency' },
  marginRate: { title: '기여이익률 (마진)', source: '거래원장 결제금액·원가합계', formula: '기여이익 ÷ 결제금액 = (결제금액 − 원가합계) ÷ 결제금액', breakdownBy: 'category', field: 'marginRate', isPct: true },
  newCustomers: { title: '신규 고객 수', source: '마케팅비용 시트 (채널별 광고비 대비 신규고객수)', formula: 'CAC = 광고비 ÷ 신규고객수', breakdownBy: 'channelMkt', field: 'newCustomers' },
  cvr: { title: '구매 전환율 (CVR)', source: '트래픽 시트 (채널별 방문수·주문수)', formula: 'CVR = 주문수 ÷ 방문수', breakdownBy: 'channelTraffic', field: 'cvr', isPct: true },
  cartDropRate: { title: '장바구니 이탈률', source: '트래픽 시트 (채널별 장바구니수·주문수)', formula: '이탈률 = 1 − (주문수 ÷ 장바구니수)', breakdownBy: 'channelTraffic', field: 'cartDropRate', isPct: true },
  roas: { title: 'ROAS', source: '거래원장 매출 ÷ 마케팅비용 시트 광고비', formula: 'ROAS = 매출 ÷ 광고비', breakdownBy: 'channelMkt', field: 'roas' },
  avgReview: { title: '평균 리뷰평점', source: '거래원장 리뷰평점 컬럼 (리뷰 작성된 주문만)', formula: '리뷰가 달린 주문의 평점 평균', breakdownBy: 'category', field: 'avgReview' },
  adSpend: { title: '총 광고비', source: '마케팅비용 시트', formula: '채널별 광고비 합산', breakdownBy: 'channelMkt', field: 'adSpend', isMoney: true },
  visits: { title: '방문수', source: '트래픽 시트', formula: '채널별 방문수 합산', breakdownBy: 'channelTraffic', field: 'visits' },
  repurchaseRate: { title: '재구매율', source: '거래원장 고객유형 컬럼', formula: '재구매 주문수 ÷ 전체 주문수', breakdownBy: 'category', field: 'repurchaseRate', isPct: true },
  ltv: { title: '고객생애가치 (LTV)', source: '거래원장 (객단가 × 구매빈도)', formula: 'LTV = AOV × (주문수 ÷ 고유고객수)', breakdownBy: 'monthlyOnly', field: 'ltv', isMoney: true },
  returnRate: { title: '반품·교환률', source: '거래원장 반품여부 컬럼', formula: '반품 주문수 ÷ 전체 주문수', breakdownBy: 'category', field: 'returnRate', isPct: true },
  aov: { title: '객단가 (AOV)', source: '거래원장', formula: 'AOV = 결제금액 합계 ÷ 주문수', breakdownBy: 'category', field: 'aov', isMoney: true },
};

function buildTrendTable(field, isMoney, isPct) {
  const rows = DATA.monthly.map(m => {
    const v = m[field];
    const text = isMoney ? fmtWon(v) : isPct ? fmtPct(v) + '%' : (typeof v === 'number' ? fmtNum(v, v < 10 ? 2 : 0) : v);
    return `<tr><td>${MONTH_LABELS[m.month]}</td><td class="num">${text}</td></tr>`;
  }).join('');
  return `<table class="detail-table"><thead><tr><th>월</th><th>값</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildChannelTable(field, isMoney, isPct, rowsSource) {
  const channels = ['자사몰', '스마트스토어', '올리브영'];
  const trs = channels.map(ch => {
    let v;
    if (rowsSource === 'channelMkt') {
      const rows = last.mkt.filter(r => r.채널 === ch);
      const ad = sum(rows, r => r.광고비), nc = sum(rows, r => r.신규고객수);
      const chGmv = last.channelGmv[ch] || 0;
      v = field === 'newCustomers' ? nc : field === 'adSpend' ? ad : field === 'roas' ? (ad ? chGmv / ad : 0) : 0;
    } else if (rowsSource === 'channelTraffic') {
      const rows = last.traf.filter(r => r.채널 === ch);
      const visits = sum(rows, r => r.방문수), carts = sum(rows, r => r.장바구니수), ord = sum(rows, r => r.주문수);
      v = field === 'visits' ? visits : field === 'cvr' ? (visits ? ord / visits : 0) : field === 'cartDropRate' ? (carts ? 1 - ord / carts : 0) : 0;
    } else if (rowsSource === 'channel') {
      v = last.channelGmv[ch] || 0;
    }
    const text = isMoney ? fmtWon(v) : isPct ? fmtPct(v) + '%' : fmtNum(v, v < 10 ? 2 : 0);
    return `<tr><td>${ch}</td><td class="num">${text}</td></tr>`;
  }).join('');
  return `<table class="detail-table"><thead><tr><th>채널</th><th>이번 달 값</th></tr></thead><tbody>${trs}</tbody></table>`;
}

function buildCategoryTable(field, isMoney, isPct) {
  const cats = Array.from(new Set(last.rows.map(r => r.카테고리)));
  const trs = cats.map(cat => {
    const rows = last.rows.filter(r => r.카테고리 === cat);
    const gmv = sum(rows, r => r.결제금액);
    const margin = sum(rows, r => r.기여이익);
    const orders = rows.length;
    const repeat = rows.filter(r => r.고객유형 === '재구매').length;
    const returns = rows.filter(r => r.반품여부 === 'Y').length;
    const reviewed = rows.filter(r => r.리뷰평점 != null);
    let v;
    if (field === 'marginRate') v = gmv ? margin / gmv : 0;
    else if (field === 'repurchaseRate') v = orders ? repeat / orders : 0;
    else if (field === 'returnRate') v = orders ? returns / orders : 0;
    else if (field === 'avgReview') v = reviewed.length ? avg(reviewed, r => r.리뷰평점) : 0;
    else if (field === 'aov') v = orders ? gmv / orders : 0;
    else v = 0;
    const text = isMoney ? fmtWon(v) : isPct ? fmtPct(v) + '%' : v.toFixed(2);
    return `<tr><td>${cat}</td><td class="num">${text}</td><td class="num muted">${orders}건</td></tr>`;
  }).join('');
  return `<table class="detail-table"><thead><tr><th>카테고리</th><th>이번 달 값</th><th>주문수</th></tr></thead><tbody>${trs}</tbody></table>`;
}

function openDetail(def) {
  const meta = METRIC_META[def.detail] || {};
  const body = document.getElementById('modalBody');
  const d = deltaStr(def.value, def.prevValue, def.isPct);

  let chartHtml = '';
  if (def.series) {
    const tmp = document.createElement('div');
    tmp.appendChild(lineChart(def.series, { w: 560, h: 160, color: ACCENT, id: 'detail', fillFrom: hexToRgba(ACCENT, 0.16) }));
    chartHtml = `<div class="detail-chart">${tmp.innerHTML}</div>
      <div class="month-labels" style="margin-top:4px">${MONTHS.map(m => `<span>${MONTH_LABELS[m]}</span>`).join('')}</div>`;
  }

  let breakdownHtml = '';
  if (meta.breakdownBy === 'channel' || meta.breakdownBy === 'channelMkt' || meta.breakdownBy === 'channelTraffic') {
    breakdownHtml = `<div class="detail-section"><h4>채널별 (이번 달)</h4>${buildChannelTable(meta.field, meta.isMoney, meta.isPct, meta.breakdownBy)}</div>`;
  } else if (meta.breakdownBy === 'category') {
    breakdownHtml = `<div class="detail-section"><h4>카테고리별 (이번 달)</h4>${buildCategoryTable(meta.field, meta.isMoney, meta.isPct)}</div>`;
  }

  body.innerHTML = `
    <div class="detail-head">
      <span class="detail-tag">${(def.unit || '')}</span>
      <h3>${meta.title || def.label}</h3>
    </div>
    <div class="detail-value-row">
      <span class="detail-value">${def.fmt(def.value)}</span>
      <span class="detail-unit">${def.unit || ''}</span>
      <span class="delta ${d.cls}">${d.text}</span>
      <span class="vs-label">vs 전월</span>
    </div>
    ${meta.formula ? `<p class="detail-formula"><strong>산출 방식</strong> · ${meta.formula}</p>` : ''}
    ${meta.source ? `<p class="detail-source"><strong>데이터 원천</strong> · ${meta.source}</p>` : ''}
    <div class="detail-section"><h4>최근 6개월 추이</h4>${chartHtml}${buildTrendTable(meta.field || def.key, meta.isMoney, meta.isPct)}</div>
    ${breakdownHtml}
  `;
  showModal();
}

function openChannelDetail(segs, total) {
  const body = document.getElementById('modalBody');
  const rows = segs.map(s => `<tr><td><span class="dot" style="background:${s.color}"></span>${s.label}</td><td class="num">${fmtWon(s.value)}</td><td class="num">${((s.value / total) * 100).toFixed(1)}%</td></tr>`).join('');
  body.innerHTML = `
    <div class="detail-head"><h3>채널별 매출 비중 (누적 6개월)</h3></div>
    <p class="detail-formula"><strong>산출 방식</strong> · 거래원장 채널 컬럼 기준 결제금액 합산</p>
    <div class="detail-section"><h4>채널별 누적 매출</h4>
      <table class="detail-table"><thead><tr><th>채널</th><th>누적 매출</th><th>비중</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  `;
  showModal();
}

function showModal() {
  document.getElementById('modalBackdrop').classList.add('open');
}
function hideModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
}

document.getElementById('modalClose').addEventListener('click', hideModal);
document.getElementById('modalBackdrop').addEventListener('click', e => {
  if (e.target.id === 'modalBackdrop') hideModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideModal(); });

renderGrids();
renderGmv();
renderChannelDonut();
