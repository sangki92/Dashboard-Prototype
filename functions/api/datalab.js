// Cloudflare Pages Function — 네이버 데이터랩 API 프록시
// 배포 후 /api/datalab 엔드포인트로 동작합니다.
// API 키는 Cloudflare Pages 환경변수에서만 읽어 브라우저에 노출되지 않습니다.

const NAVER_API = 'https://openapi.naver.com/v1/datalab/search';

export async function onRequestPost(context) {
  const { NAVER_CLIENT_ID, NAVER_CLIENT_SECRET } = context.env;

  // 환경변수 미설정 시 명확한 오류 반환
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: 'API 키가 설정되지 않았습니다. Cloudflare Pages 환경변수를 확인해 주세요.' }),
      { status: 500, headers: corsHeaders('application/json') }
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: '요청 형식이 올바르지 않습니다.' }),
      { status: 400, headers: corsHeaders('application/json') }
    );
  }

  const resp = await fetch(NAVER_API, {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });

  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: corsHeaders('application/json'),
  });
}

// CORS preflight 처리
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders(contentType) {
  const h = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}
