/* Same application interface; requests stay on this site's key-holding server. */
var WorkBuddyCloud = (() => {
  'use strict';

  class CloudOpenAIError extends Error {
    constructor(error, options = {}) {
      const detail = typeof error === 'string' ? {message:error} : error || {};
      super(detail.message || 'OpenAI 请求失败。');
      this.name = 'CloudOpenAIError';
      this.error = {message:this.message, type:detail.type || 'server_error', param:detail.param ?? null, code:detail.code ?? null};
      this.code = this.error.code;
      this.status = options.status;
      this.requestId = options.requestId;
      this.retryAfterMs = options.retryAfterMs;
      if (options.cause !== undefined) this.cause = options.cause;
    }
  }

  function aborted(signal) {
    if (signal?.aborted) throw new DOMException('已停止生成。', 'AbortError');
  }
  function invalidResponse() {
    return new CloudOpenAIError({message:'接口返回格式不正确，请检查服务端配置。', code:'gateway_invalid_response'});
  }
  function normalizeModel(model) {
    if (!model || typeof model.id !== 'string' || !model.id.trim()) return null;
    return {
      ...model,
      id:model.id,
      name:typeof model.name === 'string' && model.name ? model.name : model.id,
      provider:'OpenAI',
      enabled:model.enabled !== false && model.disabled !== true,
      disabled:model.disabled === true,
      modalities:model.modalities || {input:['text'], output:['text']},
      capabilities:{streaming:true, ...(model.capabilities || {})}
    };
  }
  async function responseError(response) {
    let detail;
    try { detail = (await response.json())?.error; } catch (_) {}
    const retry = Number(response.headers.get('retry-after'));
    return new CloudOpenAIError({
      message:typeof detail?.message === 'string' ? detail.message : `接口请求失败（HTTP ${response.status}）。`,
      type:detail?.type || 'server_error', code:detail?.code ?? null, param:detail?.param ?? null
    }, {
      status:response.status,
      requestId:response.headers.get('x-request-id') || undefined,
      retryAfterMs:Number.isFinite(retry) && retry > 0 ? retry * 1000 : undefined
    });
  }
  async function fetchChecked(url, init) {
    aborted(init.signal);
    let response;
    try { response = await fetch(url, {...init, credentials:'same-origin', cache:'no-store'}); }
    catch (error) {
      if (init.signal?.aborted || error?.name === 'AbortError') throw error;
      throw new CloudOpenAIError({message:'无法连接 OpenAI 接入服务，请确认服务已启动。', code:'gateway_network_error'}, {cause:error});
    }
    if (!response.ok) throw await responseError(response);
    return response;
  }

  function createWorkBuddyCloud() {
    let csrfToken = '';
    async function list(signalOrOptions) {
      const signal = signalOrOptions?.signal || signalOrOptions;
      const response = await fetchChecked('/api/models', {method:'GET', headers:{Accept:'application/json'}, signal});
      let payload;
      try { payload = await response.json(); } catch (_) { throw invalidResponse(); }
      aborted(signal);
      if (typeof payload?.csrf_token === 'string') csrfToken = payload.csrf_token;
      const models = Array.isArray(payload) ? payload : payload?.data;
      if (!Array.isArray(models)) throw invalidResponse();
      return models.map(normalizeModel).filter(Boolean);
    }
    async function request(body, options) {
      const signal = options?.signal || body?.signal;
      aborted(signal);
      if (!csrfToken) await list(signal);
      const {signal:ignoredSignal, conversationId:ignoredConversation, ...payload} = body || {};
      const response = await fetchChecked('/api/chat/completions', {
        method:'POST', signal,
        headers:{'Content-Type':'application/json', Accept:payload.stream === true ? 'text/event-stream' : 'application/json', 'X-Second-Curve-Token':csrfToken},
        body:JSON.stringify(payload)
      });
      return {response, signal};
    }
    async function nonStreaming(body, options) {
      const {response, signal} = await request(body, options);
      let payload;
      try { payload = await response.json(); } catch (_) { throw invalidResponse(); }
      aborted(signal);
      if (payload?.error) throw new CloudOpenAIError(payload.error);
      if (!Array.isArray(payload?.choices)) throw invalidResponse();
      return payload;
    }
    async function* streaming(body, options) {
      const {response, signal} = await request({...body, stream:true}, options);
      if (!response.body) throw invalidResponse();
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '', eventName = '', data = [], ended = false;
      const cancel = () => { void reader.cancel().catch(() => {}); };
      const event = line => {
        if (line === '') {
          const result = {name:eventName, text:data.join('\n')};
          eventName = ''; data = [];
          return result;
        }
        if (line.startsWith(':')) return null;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        let value = colon < 0 ? '' : line.slice(colon + 1);
        if (value.startsWith(' ')) value = value.slice(1);
        if (field === 'event') eventName = value;
        if (field === 'data') data.push(value);
        return null;
      };
      const parse = entry => {
        if (!entry?.text) return null;
        if (entry.text === '[DONE]') { ended = true; return null; }
        if (entry.name && entry.name !== 'message' && entry.name !== 'error') return null;
        let payload;
        try { payload = JSON.parse(entry.text); } catch (_) { throw invalidResponse(); }
        if (entry.name === 'error' || payload?.error) throw new CloudOpenAIError(payload?.error || payload);
        if (!payload || typeof payload !== 'object') throw invalidResponse();
        return payload;
      };
      signal?.addEventListener('abort', cancel, {once:true});
      try {
        aborted(signal);
        while (!ended) {
          const {done, value} = await reader.read();
          aborted(signal);
          buffer += done ? decoder.decode() : decoder.decode(value, {stream:true});
          if (buffer.length > 8 * 1024 * 1024) throw invalidResponse();
          let offset = 0;
          while (offset < buffer.length) {
            let end = offset;
            while (end < buffer.length && buffer[end] !== '\n' && buffer[end] !== '\r') end++;
            if (end === buffer.length || (!done && end === buffer.length - 1 && buffer[end] === '\r')) break;
            const line = buffer.slice(offset, end);
            offset = end + (buffer[end] === '\r' && buffer[end + 1] === '\n' ? 2 : 1);
            const chunk = parse(event(line));
            if (chunk) yield chunk;
            if (ended) break;
          }
          buffer = buffer.slice(offset);
          if (done) {
            if (buffer) event(buffer);
            const tail = parse(event(''));
            if (tail) yield tail;
            break;
          }
        }
        if (!ended) throw new CloudOpenAIError({message:'流式响应中断，请重试。', code:'gateway_stream_interrupted'});
      } finally {
        signal?.removeEventListener('abort', cancel);
        try { await reader.cancel(); } catch (_) {}
        reader.releaseLock();
      }
    }
    return {llm:{models:{list}, chat:{completions:{
      create(body, options) { return body?.stream === true ? streaming(body, options) : nonStreaming(body, options); }
    }}}, database:{from(table) {
      return {select() { return {order() {
        const rows = typeof globalThis.__REAL_JOBS__ === 'object' && Array.isArray(globalThis.__REAL_JOBS__) ? globalThis.__REAL_JOBS__ : [];
        return Promise.resolve(table === 'jobs' ? {data:rows, error:null} : {data:[], error:{message:'没有此本地数据表。'}});
      }}; }};
    }}};
  }
  return Object.freeze({
    createWorkBuddyCloud, CloudOpenAIError,
    getModelDisplayName:model => model?.name || model?.id || '',
    getModelCapability:(model, capability) => model?.capabilities?.[capability],
    provider:'OpenAI'
  });
})();
