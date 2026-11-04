(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const storageKey = 'jeju-weather-api-key';
  const keyInput = $('api-key');
  const remember = $('remember');
  let apiKey = '';
  let loading = false;
  let hasWeather = false;

  // 제주 시내 좌표로 조회하고 lang=ko로 한국어 설명을 요청합니다.
  const endpoint = 'https://api.weatherapi.com/v1/current.json';
  const useLocalServer = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
    && window.location.protocol === 'http:';
  const errors = {
    1002: 'API 키를 입력해 주세요.',
    1003: '조회 위치가 누락되었습니다.',
    1006: '제주 위치를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.',
    2006: 'API 키가 올바르지 않습니다. 연결 설정에서 확인해 주세요.',
    2007: 'API 사용 한도를 초과했습니다. WeatherAPI 계정을 확인해 주세요.',
    2008: '비활성화된 API 키입니다. WeatherAPI 계정을 확인해 주세요.',
    2009: '현재 API 키로 날씨를 조회할 수 없습니다. 계정 권한을 확인해 주세요.'
  };

  function setStatus(message, isError = false) {
    $('status').textContent = message;
    $('status').classList.toggle('error', isError);
  }

  function setLoading(value) {
    loading = value;
    $('weather-card').setAttribute('aria-busy', String(value));
    $('refresh').disabled = value;
    $('connect').disabled = value;
    $('refresh-label').textContent = value ? '날씨를 불러오는 중…' : '새로고침';
  }

  async function loadWeather() {
    if (loading) return;
    if (!apiKey) {
      $('settings').open = true;
      setStatus('아래 연결 설정에 API 키를 입력해 주세요.');
      return;
    }
    setLoading(true);
    setStatus('제주의 현재 날씨를 확인하고 있어요.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({ key: apiKey, q: '33.4996,126.5312', lang: 'ko', aqi: 'no' });
      const response = await fetch(useLocalServer ? '/api/current' : `${endpoint}?${params}`, {
        signal: controller.signal,
        cache: 'no-store',
        ...(useLocalServer ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: apiKey })
        } : {})
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error(`날씨 서비스에서 올바른 응답을 받지 못했습니다 (HTTP ${response.status}).`); }
      if (!response.ok || data.error) {
        const code = data.error?.code;
        if ([1002, 2006, 2008, 2009].includes(code)) $('settings').open = true;
        throw new Error(errors[code]
          || (code === 'UPSTREAM_TIMEOUT' ? '날씨 서버의 응답이 늦어지고 있습니다. 다시 시도해 주세요.' : '')
          || (code === 'UPSTREAM_NETWORK' ? '로컬 서버에서 WeatherAPI에 연결하지 못했습니다. 네트워크 연결을 확인해 주세요.' : '')
          || `날씨 서비스에 연결할 수 없습니다 (HTTP ${response.status}). 잠시 후 다시 시도해 주세요.`);
      }
      const weather = data.current;
      if (!weather || !Number.isFinite(weather.temp_c) || !Number.isFinite(weather.humidity)
        || typeof weather.condition?.text !== 'string' || typeof weather.last_updated !== 'string') {
        throw new Error('날씨 데이터가 완전하지 않습니다. 다시 시도해 주세요.');
      }
      $('temperature').textContent = String(weather.temp_c);
      $('humidity').textContent = `${weather.humidity}%`;
      $('condition').textContent = weather.condition.text;
      $('updated').textContent = weather.last_updated;
      $('badge').textContent = '현재 관측';
      $('badge').classList.add('live');
      hasWeather = true;
      setStatus('현재 날씨를 불러왔어요. 새로고침으로 다시 확인할 수 있습니다.');
    } catch (error) {
      $('badge').textContent = hasWeather ? '이전 조회 데이터' : '연결 확인 필요';
      $('badge').classList.remove('live');
      let message = error.name === 'AbortError' ? '응답이 늦어지고 있습니다. 잠시 후 새로고침해 주세요.'
        : error instanceof TypeError
          ? (useLocalServer ? '앱 실행 창이 닫혔거나 로컬 서버에 연결할 수 없습니다. start.cmd를 다시 실행해 주세요.'
            : '브라우저에서 날씨 서버에 연결하지 못했습니다. 날씨앱 폴더의 start.cmd를 실행해 열린 화면에서 다시 연결해 주세요.')
          : error.message;
      if (hasWeather) message += ' 화면에는 이전에 불러온 날씨가 표시됩니다.';
      setStatus(message, true);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  $('api-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (loading) return;
    apiKey = keyInput.value.trim();
    if (!apiKey) { setStatus('API 키를 입력해 주세요.', true); keyInput.focus(); return; }
    // 브라우저가 저장소 접근을 제한하더라도 현재 화면에서는 연결합니다.
    try {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
      (remember.checked ? localStorage : sessionStorage).setItem(storageKey, apiKey);
    } catch { /* 저장할 수 없는 환경에서는 메모리에서만 유지합니다. */ }
    $('settings').open = false;
    loadWeather();
  });
  $('refresh').addEventListener('click', loadWeather);

  try {
    const savedKey = localStorage.getItem(storageKey);
    apiKey = savedKey || sessionStorage.getItem(storageKey) || '';
    remember.checked = Boolean(savedKey);
    keyInput.value = apiKey;
  } catch { /* 저장소를 사용할 수 없으면 직접 입력받습니다. */ }
  // 저장된 키가 있으면 화면을 열 때 바로 날씨를 요청합니다.
  loadWeather();
})();
