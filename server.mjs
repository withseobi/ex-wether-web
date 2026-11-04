import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { requestWeather } from './lib/weather.mjs';

const root = new URL('./', import.meta.url);
const port = 8765;
const baseUrl = `http://127.0.0.1:${port}`;
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
]);

// 키는 요청 처리 중에만 사용하며 파일이나 로그에 기록하지 않습니다.
export function createWeatherServer(getWeather = requestWeather) {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };
    try {
      // 외부 웹페이지에서 이 로컬 서버를 이용하지 못하도록 출처를 확인합니다.
      if (!['127.0.0.1', 'localhost'].some(host => req.headers.host === `${host}:${res.socket.localPort}`)) {
        return json(403, { error: { code: 'INVALID_HOST' } });
      }
      const pathname = new URL(req.url, baseUrl).pathname;
      if (pathname === '/api/current') {
        if (req.method !== 'POST') return json(405, { error: { code: 'METHOD_NOT_ALLOWED' } });
        if (req.headers.origin && !['127.0.0.1', 'localhost'].some(host => req.headers.origin === `http://${host}:${res.socket.localPort}`)) {
          return json(403, { error: { code: 'INVALID_ORIGIN' } });
        }
        if (!req.headers['content-type']?.startsWith('application/json')) {
          return json(415, { error: { code: 'JSON_REQUIRED' } });
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString();
          if (body.length > 2048) return json(413, { error: { code: 'BODY_TOO_LARGE' } });
        }
        let input;
        try { input = JSON.parse(body); }
        catch { return json(400, { error: { code: 'INVALID_JSON' } }); }
        const key = typeof input?.key === 'string' ? input.key.trim() : '';
        if (!key || key.length > 200) return json(400, { error: { code: 1002 } });
        try {
          const { status, data } = await getWeather(key);
          return json(status, data);
        } catch (error) {
          return json(502, { error: { code: error.name === 'TimeoutError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK' } });
        }
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: { code: 'METHOD_NOT_ALLOWED' } });
      const file = staticFiles.get(pathname);
      if (!file) { res.writeHead(404); return res.end(); }
      const content = await readFile(new URL(file[0], root));
      res.writeHead(200, { 'Content-Type': file[1] });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch {
      if (!res.headersSent) json(500, { error: { code: 'LOCAL_SERVER_ERROR' } });
      else res.end();
    }
  });
}

function openBrowser() {
  if (process.platform === 'win32') {
    const browser = spawn('explorer.exe', [baseUrl], { detached: true, stdio: 'ignore' });
    browser.on('error', () => console.log(`Open your browser: ${baseUrl}`));
    browser.unref();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const server = createWeatherServer();
  server.on('error', async (error) => {
    if (error.code === 'EADDRINUSE') {
      // 동일한 앱이 실행 중일 때만 기존 창을 엽니다.
      try {
        const response = await fetch(`${baseUrl}/app.js`, { signal: AbortSignal.timeout(2000) });
        const script = await response.text();
        if (response.ok && script.includes('jeju-weather-api-key') && script.includes('useLocalServer')) {
          console.log(`Weather app is already running: ${baseUrl}`);
          if (process.argv.includes('--open')) openBrowser();
          return;
        }
      } catch { /* 포트가 다른 프로그램에 사용 중입니다. */ }
    }
    console.error(`Cannot start weather app (${error.code || 'unknown'}). Port: ${port}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Jeju Weather: ${baseUrl}`);
    console.log('Keep this window open while using the app. Press Ctrl+C to stop.');
    if (process.argv.includes('--open')) openBrowser();
  });
}
