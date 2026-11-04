// WeatherAPI 키는 이 요청에만 사용하고 저장하거나 로그에 출력하지 않습니다.
export async function requestWeather(key) {
  const params = new URLSearchParams({ key, q: '33.4996,126.5312', lang: 'ko', aqi: 'no' });
  const response = await fetch(`https://api.weatherapi.com/v1/current.json?${params}`, {
    signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/json' }
  });
  return { status: response.status, data: await response.json() };
}

export async function handleWeatherRequest(request, getWeather = requestWeather) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const json = (status, data) => Response.json(data, { status, headers });
  if (request.method !== 'POST') {
    return Response.json({ error: { code: 'METHOD_NOT_ALLOWED' } }, {
      status: 405, headers: { ...headers, Allow: 'POST' }
    });
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json(403, { error: { code: 'INVALID_ORIGIN' } });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return json(415, { error: { code: 'JSON_REQUIRED' } });
  }
  let input;
  try {
    const body = await request.text();
    if (body.length > 2048) return json(413, { error: { code: 'BODY_TOO_LARGE' } });
    input = JSON.parse(body);
  } catch { return json(400, { error: { code: 'INVALID_JSON' } }); }
  const key = typeof input?.key === 'string' ? input.key.trim() : '';
  if (!key || key.length > 200) return json(400, { error: { code: 1002 } });
  try {
    const { status, data } = await getWeather(key);
    return json(status, data);
  } catch (error) {
    return json(502, { error: { code: error.name === 'TimeoutError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK' } });
  }
}
