import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = await readFile(new URL('./openai-adapter.js', import.meta.url), 'utf8');
const encoder = new TextEncoder();
function createClient(chatResponse, onRequest = () => {}) {
  const calls = [];
  const context = vm.createContext({DOMException, TextDecoder, fetch:async (url, init) => {
    calls.push({url, init});
    onRequest(url, init);
    if (url === '/api/models') return Response.json({csrf_token:'test-token', data:[{id:'gpt-test', isDefault:true}]});
    assert.equal(url, '/api/chat/completions');
    assert.equal(init.headers['X-Second-Curve-Token'], 'test-token');
    assert.equal(init.credentials, 'same-origin');
    assert.ok(!('signal' in JSON.parse(init.body)));
    return typeof chatResponse === 'function' ? chatResponse(url, init) : chatResponse;
  }});
  vm.runInContext(source, context);
  return {sdk:context.WorkBuddyCloud, client:context.WorkBuddyCloud.createWorkBuddyCloud(), calls};
}
function sse(text, size = 3) {
  const bytes = encoder.encode(text);
  let cancelled = false;
  let index = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (index >= bytes.length) { controller.close(); return; }
      controller.enqueue(bytes.slice(index, index + size));
      index += size;
    },
    cancel() { cancelled = true; }
  });
  return {response:new Response(body, {headers:{'Content-Type':'text/event-stream'}}), cancelled:() => cancelled};
}
const baseBody = {model:'gpt-test', messages:[{role:'user',content:'测试'}]};

test('models keep legacy array interface and same-origin CSRF handshake', async () => {
  const {client, sdk, calls} = createClient(Response.json({choices:[]}));
  const models = await client.llm.models.list();
  assert.equal(Array.isArray(models), true);
  assert.equal(models[0].id, 'gpt-test');
  assert.equal(models[0].enabled, true);
  assert.equal(models[0].provider, 'OpenAI');
  assert.equal(sdk.getModelDisplayName(models[0]), 'gpt-test');
  assert.equal(sdk.getModelCapability(models[0], 'streaming'), true);
  assert.equal(calls[0].url, '/api/models');
});

test('non-stream response and body.signal compatibility', async () => {
  const {client, calls} = createClient(Response.json({choices:[{message:{content:'好'}}]}));
  const controller = new AbortController();
  const result = await client.llm.chat.completions.create({...baseBody,signal:controller.signal});
  assert.equal(result.choices[0].message.content, '好');
  assert.equal(calls[1].init.signal, controller.signal);
});

test('stream parses split UTF-8, split CRLF, multiline JSON, comments and DONE', async () => {
  const text = ':keepalive\r\ndata: {"choices":\r\ndata: [{"delta":{"content":"你好"}}]}\r\n\r\nevent: message\ndata: {"choices":[{"delta":{"content":"世界"}}]}\n\ndata: [DONE]\n\n';
  const stream = sse(text, 1);
  const {client} = createClient(stream.response);
  const chunks = [];
  for await (const item of client.llm.chat.completions.create({...baseBody,stream:true})) chunks.push(item.choices[0].delta.content);
  assert.equal(chunks.join(''), '你好世界');
});

test('stream accepts final DONE without trailing blank line', async () => {
  const {client} = createClient(sse('data: {"choices":[]}\n\ndata: [DONE]', 2).response);
  let count = 0;
  for await (const item of client.llm.chat.completions.create({...baseBody,stream:true})) count++;
  assert.equal(count, 1);
});

test('stream rejects premature EOF instead of reporting success', async () => {
  const {client} = createClient(sse('data: {"choices":[]}\n\n').response);
  await assert.rejects(async () => {
    for await (const item of client.llm.chat.completions.create({...baseBody,stream:true})) {}
  }, error => error.code === 'gateway_stream_interrupted');
});

test('stream event errors preserve code and reader is cancelled', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(c) { c.enqueue(encoder.encode('event: error\ndata: {"error":{"message":"限流","code":"rate_limit_exceeded"}}\n\n')); },
    cancel() { cancelled = true; }
  });
  const {client} = createClient(new Response(body));
  await assert.rejects(async () => {
    for await (const item of client.llm.chat.completions.create({...baseBody,stream:true})) {}
  }, error => error.message === '限流' && error.code === 'rate_limit_exceeded');
  assert.equal(cancelled, true);
});

test('HTTP failures expose structured status, no response HTML', async () => {
  const {client} = createClient(Response.json({error:{message:'请配置 OPENAI_API_KEY',code:'missing_api_key'}},{status:503}));
  await assert.rejects(client.llm.chat.completions.create(baseBody), error => error.status === 503 && error.code === 'missing_api_key');
  const plain = createClient(new Response('<h1>Private proxy diagnostic</h1>',{status:502}));
  await assert.rejects(plain.client.llm.chat.completions.create(baseBody), error => !error.message.includes('Private'));
});

test('abort before request never sends a request', async () => {
  const {client,calls} = createClient(Response.json({choices:[]}));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(client.llm.chat.completions.create({...baseBody,signal:controller.signal}), error => error.name === 'AbortError');
  assert.equal(calls.length,0);
});

test('abort during streaming cancels a blocked reader', async () => {
  let cancelled = false;
  const controller = new AbortController();
  const body = new ReadableStream({start(c){c.enqueue(encoder.encode('data: {"choices":[]}\n\n'));},cancel(){cancelled=true;}});
  const {client} = createClient(new Response(body));
  const iterator = client.llm.chat.completions.create({...baseBody,stream:true},{signal:controller.signal});
  assert.equal((await iterator.next()).done,false);
  const pending = iterator.next();
  controller.abort();
  await assert.rejects(pending,error => error.name === 'AbortError');
  assert.equal(cancelled,true);
});

test('consumer break cancels upstream reader', async () => {
  let cancelled = false;
  const body = new ReadableStream({start(c){c.enqueue(encoder.encode('data: {"choices":[]}\n\n'));},cancel(){cancelled=true;}});
  const {client} = createClient(new Response(body));
  for await (const item of client.llm.chat.completions.create({...baseBody,stream:true})) break;
  assert.equal(cancelled,true);
});

test('invalid stream JSON is rejected', async () => {
  const {client} = createClient(sse('data: invalid\n\ndata: [DONE]\n\n').response);
  await assert.rejects(async () => {
    for await (const item of client.llm.chat.completions.create({...baseBody,stream:true})) {}
  }, error => error.code === 'gateway_invalid_response');
});

test('legacy jobs data fallback stays local and does not call a cloud database', async () => {
  const {client, calls} = createClient(Response.json({choices:[]}));
  const result = await client.database.from('jobs').select('*').order('id', {ascending:true});
  assert.equal(Array.isArray(result.data), true);
  assert.equal(result.error, null);
  assert.equal(calls.length, 0);
});
