import { Capacitor, registerPlugin } from '@capacitor/core';
import { invoke, isTauri } from '@tauri-apps/api/core';

export type ModelProvider = 'kanshan' | 'deepseek' | 'kimi';
export type ModelSettings = {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  configured: boolean;
  enabled: boolean;
};
export type SaveModelSettings = Omit<ModelSettings, 'configured'> & { apiKey: string };
export type ModelMessage = { role: 'system' | 'user'; content: string };
export type ModelReply = { content: string; provider: ModelProvider; model: string };

interface NativeModelPlugin {
  load(): Promise<ModelSettings>;
  save(options: { settings: SaveModelSettings }): Promise<ModelSettings>;
  setEnabled(options: { enabled: boolean }): Promise<ModelSettings>;
  clear(): Promise<ModelSettings>;
  request(options: { messages: ModelMessage[]; maxTokens: number }): Promise<ModelReply>;
}

const android = registerPlugin<NativeModelPlugin>('CareerModel');
const blank: ModelSettings = {
  provider: 'kanshan',
  baseUrl: '',
  model: '',
  configured: false,
  enabled: false,
};
let current: ModelSettings = { ...blank };

export function isNativeModelAvailable(): boolean {
  return typeof window !== 'undefined' && (isTauri() || Capacitor.getPlatform() === 'android');
}

export function currentModelSettings(): ModelSettings {
  return { ...current };
}

function remember(settings: ModelSettings): ModelSettings {
  current = { ...settings, enabled: settings.enabled && settings.configured };
  return { ...current };
}

export async function loadModelSettings(): Promise<ModelSettings> {
  if (!isNativeModelAvailable()) return remember({ ...blank });
  const settings = isTauri()
    ? await invoke<ModelSettings>('career_model_load')
    : await android.load();
  return remember(settings);
}

export async function saveModelSettings(settings: SaveModelSettings): Promise<ModelSettings> {
  if (!isNativeModelAvailable()) throw new Error('模型配置仅在 Windows 或 Android 安装版中可用。');
  const result = isTauri()
    ? await invoke<ModelSettings>('career_model_save', { settings })
    : await android.save({ settings });
  return remember(result);
}

export async function setCloudEnabled(enabled: boolean): Promise<ModelSettings> {
  if (!isNativeModelAvailable()) throw new Error('请在 Windows 或 Android 安装版中配置云模型。');
  const result = isTauri()
    ? await invoke<ModelSettings>('career_model_set_enabled', { enabled })
    : await android.setEnabled({ enabled });
  return remember(result);
}

export async function clearModelSettings(): Promise<ModelSettings> {
  if (!isNativeModelAvailable()) return remember({ ...blank });
  return remember(
    isTauri() ? await invoke<ModelSettings>('career_model_clear') : await android.clear(),
  );
}

export async function requestModel(
  messages: ModelMessage[],
  maxTokens = 2400,
): Promise<ModelReply> {
  if (!isNativeModelAvailable() || !current.configured || !current.enabled) {
    throw new Error('云模型尚未配置或启用，请先在个人设置中完成配置。');
  }
  // HTTPS 与密钥处理均在原生层完成；WebView 不直接请求供应商，也不保存密钥。
  return isTauri()
    ? invoke<ModelReply>('career_model_request', { messages, maxTokens })
    : android.request({ messages, maxTokens });
}
