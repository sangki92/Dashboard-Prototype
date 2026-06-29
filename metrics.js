// 거래원장 / 마케팅비용 / 트래픽 원천 데이터로부터 모든 지표를 계산합니다.
// 노션 "뷰티브랜드 대시보드 지표 프레임워크"의 후행/선행/복합지표 정의를 그대로 따릅니다.

const ACCENT = '#A8526B';
const POS = '#3F8F6B';
const NEG = '#C2603F';
const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
const MONTH_LABELS = { '2026-01': '1월', '2026-02': '2월', '2026-03': '3월', '2026-04': '4월', '2026-05': '5월', '2026-06': '6월' };
const CHANNEL_COLORS = { '자사몰': ACCENT, '스마트스토어': '#C07F92', '올리브영': '#D9AEBA' };

function byMonth(rows, key) {
  const map = {};
  MONTHS.forEach(m => map[m] = []);
  rows.forEach(r => { const m = r[key]; if (map[m]) map[m].push(r); });
  return map;
}

function sum(arr, f) { return arr.reduce((s, x) => s + (f ? f(x) : x), 0); }
function avg(arr, f) { return arr.length ? sum(arr, f) / arr.length : 0; }
function uniq(arr, f) { return new Set(arr.map(f)).size; }
function fmtWon(v) {
  if (Math.abs(v) >= 100000000) return '₩' + (v / 100000000).toFixed(2) + '억';
  if (Math.abs(v) >= 10000) return '₩' + (v / 10000).toFixed(1) + '만';
  return '₩' + Math.round(v).toLocaleString();
}
function fmtPct(v) { return (v * 100).toFixed(1); }
function fmtNum(v, d = 0) { return v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }); }
function deltaStr(curr, prev, isPct) {
  if (prev === 0 || prev === undefined || prev === null) return { text: '–', cls: 'flat' };
  const diff = curr - prev;
  const pct = (diff / Math.abs(prev)) * 100;
  const sign = diff >= 0 ? '▲' : '▼';
  const cls = diff >= 0 ? 'pos' : 'neg';
  const txt = isPct ? `${sign} ${Math.abs(diff * 100).toFixed(1)}%p` : `${sign} ${Math.abs(pct).toFixed(1)}%`;
  return { text: txt, cls };
}

function computeAll() {
  const ledger = RAW_DATA.ledger;
  const marketing = RAW_DATA.marketing;
  const traffic = RAW_DATA.traffic;

  const ledgerByMonth = byMonth(ledger, '주문월');
  const mktByMonth = byMonth(marketing, '주문월');
  const trafficByMonth = byMonth(traffic, '주문월');

  const monthly = MONTHS.map(m => {
    const rows = ledgerByMonth[m];
    const mkt = mktByMonth[m];
    const traf = trafficByMonth[m];

    const gmv = sum(rows, r => r.결제금액);
    const margin = sum(rows, r => r.기여이익);
    const marginRate = gmv ? margin / gmv : 0;
    const orders = rows.length;
    const aov = orders ? gmv / orders : 0;
    const uniqueCustomers = uniq(rows, r => r.고객ID);
    const repeatOrders = rows.filter(r => r.고객유형 === '재구매').length;
    const newOrders = rows.filter(r => r.고객유형 === '신규').length;
    const repurchaseRate = orders ? repeatOrders / orders : 0;
    const returns = rows.filter(r => r.반품여부 === 'Y').length;
    const returnRate = orders ? returns / orders : 0;
    const reviewed = rows.filter(r => r.리뷰평점 != null);
    const avgReview = reviewed.length ? avg(reviewed, r => r.리뷰평점) : 0;
    const reviewCount = reviewed.length;
    const purchaseFreq = uniqueCustomers ? orders / uniqueCustomers : 0;

    const adSpend = sum(mkt, r => r.광고비);
    const newCustomers = sum(mkt, r => r.신규고객수);
    const cac = newCustomers ? adSpend / newCustomers : 0;
    const roas = adSpend ? gmv / adSpend : 0;

    const visits = sum(traf, r => r.방문수);
    const carts = sum(traf, r => r.장바구니수);
    const visitOrders = sum(traf, r => r.주문수);
    const cvr = visits ? visitOrders / visits : 0;
    const cartDropRate = carts ? 1 - (visitOrders / carts) : 0;

    const ltv = aov * purchaseFreq;
    const ltvCac = cac ? ltv / cac : 0;
    const avgCost = orders ? (gmv - margin) / orders : 0;
    const unitEconomics = aov - avgCost - cac;
    const mktEfficiency = roas * repurchaseRate;

    const channelGmv = {};
    rows.forEach(r => { channelGmv[r.채널] = (channelGmv[r.채널] || 0) + r.결제금액; });

    return {
      month: m, gmv, margin, marginRate, orders, aov, uniqueCustomers, repeatOrders, newOrders,
      repurchaseRate, returns, returnRate, avgReview, reviewCount, purchaseFreq,
      adSpend, newCustomers, cac, roas, visits, carts, visitOrders, cvr, cartDropRate,
      ltv, ltvCac, unitEconomics, mktEfficiency, channelGmv, rows, mkt, traf
    };
  });

  // 누적 (전체 기간) 값 — 지표대시보드 시트와 동일한 정의
  const totalOrders = ledger.length;
  const totalGmv = sum(ledger, r => r.결제금액);
  const totalMargin = sum(ledger, r => r.기여이익);
  const totalCustomers = uniq(ledger, r => r.고객ID);
  const customerOrderCounts = {};
  ledger.forEach(r => { customerOrderCounts[r.고객ID] = (customerOrderCounts[r.고객ID] || 0) + 1; });
  const repeatCustomers = Object.values(customerOrderCounts).filter(c => c >= 2).length;
  const overall = {
    gmv: totalGmv,
    margin: totalMargin,
    marginRate: totalMargin / totalGmv,
    orders: totalOrders,
    aov: totalGmv / totalOrders,
    customers: totalCustomers,
    repeatCustomers,
    repurchaseRate: repeatCustomers / totalCustomers,
    returnRate: ledger.filter(r => r.반품여부 === 'Y').length / totalOrders,
    avgReview: avg(ledger.filter(r => r.리뷰평점 != null), r => r.리뷰평점),
    purchaseFreq: totalOrders / totalCustomers,
    adSpend: sum(marketing, r => r.광고비),
    newCustomers: sum(marketing, r => r.신규고객수),
  };
  overall.cac = overall.adSpend / overall.newCustomers;
  overall.roas = overall.gmv / overall.adSpend;
  overall.ltv = overall.aov * overall.purchaseFreq;
  overall.ltvCac = overall.ltv / overall.cac;
  overall.unitEconomics = overall.aov - (overall.gmv - overall.margin) / overall.orders - overall.cac;
  overall.mktEfficiency = overall.roas * overall.repurchaseRate;

  const channelTotals = {};
  ledger.forEach(r => { channelTotals[r.채널] = (channelTotals[r.채널] || 0) + r.결제금액; });

  return { monthly, overall, channelTotals, ledger, marketing, traffic };
}
