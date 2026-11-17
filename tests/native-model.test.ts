import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  tauri: false,
  platform: 'web',
  invoke: vi.fn(),
  plugin: { load: vi.fn(), save: vi.fn(), setEnabled: vi.fn(), clear: vi.fn(), request: vi.fn() },
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => native.tauri, invoke: native.invoke }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => native.platform },
  registerPlugin: () => native.plugin,
}));

import {
  loadModelSettings,
  saveModelSettings,
  setCloudEnabled,
  clearModelSettings,
  requestModel,
  currentModelSettings,
} from '../lib/native-model';

const config = {
  provider: 'kanshan' as const,
  baseUrl: 'https://model.example/v1',
  model: 'official-model-id',
  configured: true,
  enabled: true,
};

beforeEach(async () => {
  vi.stubGlobal('window', {});
  native.tauri = false;
  native.platform = 'web';
  vi.clearAllMocks();
  await loadModelSettings();
});

describe('native model bridge selection', () => {
  it('keeps web preview local and never requests a model', async () => {
    expect((await loadModelSettings()).configured).toBe(false);
    await expect(requestModel([{ role: 'user', content: 'test' }])).rejects.toThrow('尚未配置');
    expect(native.invoke).not.toHaveBeenCalled();
    expect(native.plugin.request).not.toHaveBeenCalled();
  });

  it('routes Windows through Tauri commands without fetching from the WebView', async () => {
    native.tauri = true;
    native.invoke
      .mockResolvedValueOnce(config)
      .mockResolvedValueOnce({ content: '[]', provider: 'kanshan', model: config.model });
    await loadModelSettings();
    await requestModel([{ role: 'user', content: 'test' }], 1000);
    expect(native.invoke.mock.calls[0][0]).toBe('career_model_load');
    expect(native.invoke.mock.calls[1]).toEqual([
      'career_model_request',
      { messages: [{ role: 'user', content: 'test' }], maxTokens: 1000 },
    ]);
  });

  it('routes Android config and requests through its plugin', async () => {
    native.platform = 'android';
    native.plugin.save.mockResolvedValue(config);
    native.plugin.request.mockResolvedValue({
      content: '[]',
      provider: 'kanshan',
      model: config.model,
    });
    await saveModelSettings({
      provider: 'kanshan',
      baseUrl: config.baseUrl,
      model: config.model,
      enabled: true,
      apiKey: 'test-only-key',
    });
    expect(currentModelSettings()).not.toHaveProperty('apiKey');
    await requestModel([
      { role: 'system', content: 'JSON' },
      { role: 'user', content: 'test' },
    ]);
    expect(native.plugin.request).toHaveBeenCalledOnce();
    expect(native.invoke).not.toHaveBeenCalled();
  });

  it('turns off native requests immediately when disabled or cleared', async () => {
    native.tauri = true;
    native.invoke
      .mockResolvedValueOnce(config)
      .mockResolvedValueOnce({ ...config, enabled: false })
      .mockResolvedValueOnce({
        provider: 'kanshan',
        baseUrl: '',
        model: '',
        configured: false,
        enabled: false,
      });
    await loadModelSettings();
    await setCloudEnabled(false);
    await expect(requestModel([{ role: 'user', content: 'test' }])).rejects.toThrow('尚未配置');
    await clearModelSettings();
    expect(currentModelSettings().configured).toBe(false);
  });
});
