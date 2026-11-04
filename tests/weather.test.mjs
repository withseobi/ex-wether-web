import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { handleWeatherRequest } from '../lib/weather.mjs';
import { createWeatherServer } from '../server.mjs';

const weather = { current: { temp_c:18.5, humidity:70, condition:{text:'맑음'}, last_updated:'2026-11-04 13:00' } };
const request = (body, options = {}) => new Request('https://example.vercel.app/api/current', {
  method:'POST', headers:{'Content-Type':'application/json',Origin:'https://example.vercel.app'},
  body:typeof body === 'string' ? body : JSON.stringify(body), ...options
});

test('배포 API는 키를 요청에만 사용하고 날씨를 반환한다', async () => {
  const response = await handleWeatherRequest(request({key:' test-key '}), async key => {
    assert.equal(key,'test-key'); return {status:200,data:weather};
  });
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),weather);
});

test('잘못된 요청은 WeatherAPI에 전달하지 않는다', async () => {
  const never = () => { throw Error('must not call upstream'); };
  assert.equal((await handleWeatherRequest(new Request('https://example.vercel.app/api/current'),never)).status,405);
  assert.equal((await handleWeatherRequest(request({key:'test'},{headers:{'Content-Type':'application/json',Origin:'https://elsewhere.example'}}),never)).status,403);
  assert.equal((await handleWeatherRequest(request({key:'test'},{headers:{'Content-Type':'text/plain'}}),never)).status,415);
  assert.equal((await handleWeatherRequest(request('{bad'),never)).status,400);
  assert.equal((await handleWeatherRequest(request({key:''}),never)).status,400);
  assert.equal((await handleWeatherRequest(request({key:'x'.repeat(2100)}),never)).status,413);
});

test('키 오류, 네트워크 오류, 시간 초과를 구분한다', async () => {
  const invalid = await handleWeatherRequest(request({key:'test'}),async()=>({status:401,data:{error:{code:2006}}}));
  assert.equal(invalid.status,401); assert.equal((await invalid.json()).error.code,2006);
  for (const [name,code] of [['TypeError','UPSTREAM_NETWORK'],['TimeoutError','UPSTREAM_TIMEOUT']]) {
    const result=await handleWeatherRequest(request({key:'test'}),async()=>{const error=new Error();error.name=name;throw error;});
    assert.equal(result.status,502); assert.equal((await result.json()).error.code,code);
  }
});

test('로컬 실행도 같은 날씨 조회를 지원한다', async () => {
  const server=createWeatherServer(async()=>({status:200,data:weather}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const response=await fetch(`${base}/api/current`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'test'})});
    assert.deepEqual(await response.json(),weather);
    assert.equal((await fetch(`${base}/`)).status,200);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('배포 주소와 로컬 주소 모두 동일 출처 API로 요청하고 새로고침한다', async () => {
  const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
  for (const [protocol,hostname] of [['https:','example.vercel.app'],['http:','127.0.0.1'],['file:','']]) {
    const elements=new Map();
    const el=id=>{
      if(!elements.has(id))elements.set(id,{value:'',textContent:'',handlers:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(k,v){this.handlers[k]=v;},focus(){}});
      return elements.get(id);
    };
    const calls=[];
    const storage={getItem(){return null;},setItem(){},removeItem(){}};
    vm.runInNewContext(source,{document:{getElementById:el},window:{location:{protocol,hostname}},localStorage:storage,sessionStorage:storage,URLSearchParams,AbortController,setTimeout,clearTimeout,TypeError,
      fetch:async(...args)=>{calls.push(args);return {ok:true,status:200,json:async()=>weather};}});
    el('api-key').value='test-key'; el('api-form').handlers.submit({preventDefault(){}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(el('temperature').textContent,'18.5');
    if(protocol==='file:')assert.match(calls[0][0],/^https:\/\/api.weatherapi.com/);
    else {assert.equal(calls[0][0],'/api/current');assert.equal(calls[0][1].method,'POST');}
    await el('refresh').handlers.click(); assert.equal(calls.length,2);
  }
});
