// 네이버 데이터랩 키워드 인사이트 모듈
// /api/datalab (Cloudflare Pages Function)을 통해 검색어 트렌드를 가져옵니다.

const COLORS_KEYWORD = ['#A8526B', '#2C7A8C', '#A6791F', '#5A6DB7', '#6A9B5E'];
const MONTH_KO = { '01': '1월', '02': '2월', '03': '3월', '04': '4월', '05': '5월', '06': '6월', '07': '7월', '08': '8월', '09': '9월', '10': '10월', '11': '11월', '12': '12월' };

// 기본 비교 키워드 세트 (뷰티 도메인)
const PRESET_GROUPS = [
  { label: '선케어', keywords: ['선크림', '선스틱', '선쿠션'] },
  { label: '스킨케어', keywords: ['세럼', '토너', '에센스'] },
  { label: '메이크업', keywords: ['쿠션팩트', '립틴트', '파운데이션'] },
  { label: '클렌징', keywords: ['클렌징오일', '클렌징폼', '마스크팩'] },
];

function dateRange(months) {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

async function fetchTrend(keywordGroups, months) {
  const { startDate, endDate } = dateRange(months);
  const body = {
    startDate,
    endDate,
    timeUnit: 'month',
    keywordGroups: keywordGroups.map(g => ({ groupName: g.name, keywords: g.keywords })),
  };

  const res = await fetch('/api/datalab', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API 오류 (${res.status})`);
  }
  return res.json();
}

// ---- 차트 렌더링 (app.js의 SVG 헬퍼 재사용) ----
function renderKeywordChart(results, container) {
  const w = container.clientWidth || 600, h = 200;
  const pad = { l: 36, r: 16, t: 12, b: 28 };
  const allValues = results.flatMap(r => r.data.map(d => d.ratio));
  const minV = 0, maxV = Math.max(...allValues) || 100;

  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: h, style: 'display:block;overflow:visible' });

  // 가로 그리드
  [0, 25, 50, 75, 100].forEach(pct => {
    const y = pad.t + (1 - pct / 100) * (h - pad.t - pad.b);
    svg.appendChild(el('line', { x1: pad.l, y1: y.toFixed(1), x2: w - pad.r, y2: y.toFixed(1), stroke: '#1B1714', 'stroke-opacity': 0.06, 'stroke-width': 1 }));
    const txt = document.createElementNS(svgns, 'text');
    txt.setAttribute('x', pad.l - 5); txt.setAttribute('y', (y + 4).toFixed(1));
    txt.setAttribute('text-anchor', 'end'); txt.setAttribute('font-size', '9'); txt.setAttribute('fill', '#B7AFA8');
    txt.textContent = pct;
    svg.appendChild(txt);
  });

  results.forEach((r, ri) => {
    const color = COLORS_KEYWORD[ri % COLORS_KEYWORD.length];
    const n = r.data.length;
    const X = i => pad.l + i * (w - pad.l - pad.r) / (n - 1);
    const Y = v => pad.t + (1 - (v - minV) / (maxV - minV || 1)) * (h - pad.t - pad.b);
    let d = '';
    r.data.forEach((pt, i) => { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(pt.ratio).toFixed(1) + ' '; });
    svg.appendChild(el('path', { d: d.trim(), fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    r.data.forEach((pt, i) => {
      const last = i === n - 1;
      svg.appendChild(el('circle', { cx: X(i), cy: Y(pt.ratio), r: last ? 4 : 2.2, fill: last ? color : '#fff', stroke: color, 'stroke-width': 1.8 }));
    });
  });

  // X축 월 레이블
  if (results[0]?.data?.length) {
    const n = results[0].data.length;
    results[0].data.forEach((pt, i) => {
      if (i % Math.ceil(n / 8) !== 0 && i !== n - 1) return;
      const [, mo] = pt.period.split('-');
      const txt = document.createElementNS(svgns, 'text');
      const X = i2 => pad.l + i2 * (w - pad.l - pad.r) / (n - 1);
      txt.setAttribute('x', X(i).toFixed(1)); txt.setAttribute('y', h - 4);
      txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('font-size', '9'); txt.setAttribute('fill', '#B7AFA8');
      txt.textContent = MONTH_KO[mo] || mo;
      svg.appendChild(txt);
    });
  }

  container.innerHTML = '';
  container.appendChild(svg);
}

function renderKeywordLegend(results, container) {
  container.innerHTML = '';
  results.forEach((r, ri) => {
    const color = COLORS_KEYWORD[ri % COLORS_KEYWORD.length];
    const last = r.data[r.data.length - 1]?.ratio ?? 0;
    const prev = r.data[r.data.length - 2]?.ratio ?? last;
    const diff = last - prev;
    const sign = diff >= 0 ? '▲' : '▼';
    const cls = diff >= 0 ? 'pos' : 'neg';
    const chip = document.createElement('div');
    chip.className = 'kw-legend-chip';
    chip.innerHTML = `
      <span class="kw-dot" style="background:${color}"></span>
      <span class="kw-name">${r.title}</span>
      <span class="kw-val">${last.toFixed(1)}</span>
      <span class="delta ${cls}" style="font-size:11px">${sign} ${Math.abs(diff).toFixed(1)}</span>
    `;
    container.appendChild(chip);
  });
}

function renderPeakTable(results, container) {
  const rows = results.map((r, ri) => {
    const color = COLORS_KEYWORD[ri % COLORS_KEYWORD.length];
    const peak = r.data.reduce((a, b) => a.ratio >= b.ratio ? a : b, { ratio: 0, period: '-' });
    const avg = r.data.reduce((s, d) => s + d.ratio, 0) / (r.data.length || 1);
    const last = r.data[r.data.length - 1]?.ratio ?? 0;
    return `<tr>
      <td><span class="kw-dot" style="background:${color};display:inline-block"></span> ${r.title}</td>
      <td class="num">${last.toFixed(1)}</td>
      <td class="num">${avg.toFixed(1)}</td>
      <td class="num">${peak.ratio.toFixed(1)} <span style="color:#B7AFA8;font-size:10px">(${peak.period?.slice(0, 7) || '-'})</span></td>
    </tr>`;
  }).join('');
  container.innerHTML = `
    <table class="detail-table">
      <thead><tr><th>키워드</th><th>최근값</th><th>평균</th><th>최고점</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ---- UI 초기화 ----
function initKeywordInsight() {
  const section = document.getElementById('insightSection');
  if (!section) return;

  const searchInput = document.getElementById('kwSearchInput');
  const searchBtn = document.getElementById('kwSearchBtn');
  const periodBtns = document.querySelectorAll('.kw-period-btn');
  const presetBtns = document.querySelectorAll('.kw-preset-btn');
  const statusEl = document.getElementById('kwStatus');
  const chartWrap = document.getElementById('kwChartWrap');
  const legendWrap = document.getElementById('kwLegendWrap');
  const tableWrap = document.getElementById('kwTableWrap');
  const resultArea = document.getElementById('kwResultArea');

  let currentMonths = 12;

  periodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      periodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMonths = parseInt(btn.dataset.months);
      if (searchInput.value.trim()) runSearch(searchInput.value.trim(), currentMonths);
    });
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.preset);
      const preset = PRESET_GROUPS[idx];
      searchInput.value = preset.keywords.join(', ');
      runSearch(searchInput.value, currentMonths);
    });
  });

  searchBtn.addEventListener('click', () => {
    if (searchInput.value.trim()) runSearch(searchInput.value.trim(), currentMonths);
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && searchInput.value.trim()) runSearch(searchInput.value.trim(), currentMonths);
  });

  async function runSearch(raw, months) {
    const keywords = raw.split(/[,，\s]+/).map(k => k.trim()).filter(Boolean).slice(0, 5);
    if (!keywords.length) return;

    statusEl.textContent = '네이버 데이터랩 조회 중...';
    statusEl.className = 'kw-status loading';
    resultArea.style.display = 'none';
    searchBtn.disabled = true;

    try {
      const keywordGroups = keywords.map(k => ({ name: k, keywords: [k] }));
      const data = await fetchTrend(keywordGroups, months);

      if (!data.results?.length) throw new Error('결과가 없습니다.');

      statusEl.textContent = `"${keywords.join(', ')}" · 최근 ${months}개월 네이버 검색 트렌드`;
      statusEl.className = 'kw-status ok';

      renderKeywordChart(data.results, chartWrap);
      renderKeywordLegend(data.results, legendWrap);
      renderPeakTable(data.results, tableWrap);
      resultArea.style.display = 'block';
    } catch (err) {
      statusEl.textContent = `오류: ${err.message}`;
      statusEl.className = 'kw-status error';
    } finally {
      searchBtn.disabled = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', initKeywordInsight);
