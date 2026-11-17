package com.secondcurve.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Native HTTPS model transport. Credentials never cross back into JavaScript. */
@CapacitorPlugin(name = "CareerModel")
public class CareerModelPlugin extends Plugin {
    private static final String PREFS = "career_model_private";
    private static final String KEY_ALIAS = "second_curve_model_key_v1";
    private static final int MAX_RESPONSE = 2 * 1024 * 1024;
    private final Object configLock = new Object();
    private final ExecutorService workers = Executors.newFixedThreadPool(2);
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();
    private final Semaphore requests = new Semaphore(2);

    private static class ModelFailure extends Exception {
        final String code;
        ModelFailure(String code, String message) {
            super(message);
            this.code = code;
        }
    }

    private static class Config {
        String provider;
        String baseUrl;
        String model;
        String apiKey;
        boolean enabled;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void run(PluginCall call, Callable<JSObject> operation) {
        workers.execute(() -> {
            try {
                call.resolve(operation.call());
            } catch (ModelFailure error) {
                call.reject(error.getMessage(), error.code);
            } catch (SocketTimeoutException error) {
                call.reject("模型响应超时，请稍后重试", "MODEL_TIMEOUT");
            } catch (Exception error) {
                // Do not expose exception text, upstream bodies, request text, or API keys.
                call.reject("模型服务暂时不可用，请检查配置和网络后重试", "MODEL_UNAVAILABLE");
            }
        });
    }

    private SecretKey encryptionKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    private String decryptKey(SharedPreferences preferences) throws Exception {
        String encrypted = preferences.getString("key_ciphertext", "");
        String iv = preferences.getString("key_iv", "");
        if (encrypted.isEmpty() || iv.isEmpty()) return "";
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, encryptionKey(),
                new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    private Config readConfig(boolean withKey) throws Exception {
        SharedPreferences preferences = prefs();
        Config config = new Config();
        config.provider = preferences.getString("provider", "kanshan");
        config.baseUrl = preferences.getString("baseUrl", "");
        config.model = preferences.getString("model", "");
        config.enabled = preferences.getBoolean("enabled", false);
        config.apiKey = withKey ? decryptKey(preferences) : "";
        return config;
    }

    private JSObject publicConfig() throws Exception {
        Config config = readConfig(false);
        boolean configured = !config.baseUrl.isEmpty() && !config.model.isEmpty()
                && !prefs().getString("key_ciphertext", "").isEmpty();
        JSObject result = new JSObject();
        result.put("provider", config.provider);
        result.put("baseUrl", config.baseUrl);
        result.put("model", config.model);
        result.put("configured", configured);
        result.put("enabled", configured && config.enabled);
        return result;
    }

    private static String text(JSONObject object, String key, int max) throws Exception {
        Object value = object.opt(key);
        if (!(value instanceof String) || ((String) value).length() > max) {
            throw new ModelFailure("INVALID_CONFIG", key + " 配置无效");
        }
        return ((String) value).trim();
    }

    private static String normalizeBase(String value) throws ModelFailure {
        String base = value.trim().replaceAll("/+$", "");
        try {
            URI uri = new URI(base);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || (uri.getPort() != -1 && (uri.getPort() < 1 || uri.getPort() > 65535))) {
                throw new IllegalArgumentException();
            }
        } catch (Exception error) {
            throw new ModelFailure("INVALID_CONFIG", "模型接口地址必须是有效 HTTPS Base URL，不能包含密钥、查询参数或片段");
        }
        return base;
    }

    @PluginMethod
    public void load(PluginCall call) {
        run(call, () -> {
            synchronized (configLock) {
                return publicConfig();
            }
        });
    }

    @PluginMethod
    public void save(PluginCall call) {
        run(call, () -> {
            JSObject input = call.getObject("settings");
            if (input == null) throw new ModelFailure("INVALID_CONFIG", "缺少模型设置");
            String provider = text(input, "provider", 30);
            if (!provider.equals("kanshan") && !provider.equals("deepseek") && !provider.equals("kimi")) {
                throw new ModelFailure("INVALID_CONFIG", "请选择看山、DeepSeek 或 Kimi");
            }
            String baseUrl = normalizeBase(text(input, "baseUrl", 2000));
            String model = text(input, "model", 200);
            if (model.isEmpty()) throw new ModelFailure("INVALID_CONFIG", "请填写平台提供的模型 ID");
            String enteredKey = input.has("apiKey") ? text(input, "apiKey", 4096) : "";
            if (enteredKey.contains("\r") || enteredKey.contains("\n")) {
                throw new ModelFailure("INVALID_CONFIG", "API Key 不能包含换行");
            }
            synchronized (configLock) {
                Config previous = readConfig(false);
                boolean sameDestination = provider.equals(previous.provider) && baseUrl.equals(previous.baseUrl);
                String apiKey = enteredKey;
                if (apiKey.isEmpty() && sameDestination) apiKey = decryptKey(prefs());
                if (apiKey.isEmpty()) {
                    throw new ModelFailure("INVALID_CONFIG", "首次配置或更换平台地址时，请重新输入 API Key");
                }
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.ENCRYPT_MODE, encryptionKey());
                byte[] encrypted = cipher.doFinal(apiKey.getBytes(StandardCharsets.UTF_8));
                boolean saved = prefs().edit().putString("provider", provider)
                        .putString("baseUrl", baseUrl).putString("model", model)
                        .putBoolean("enabled", input.optBoolean("enabled", false))
                        .putString("key_ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP))
                        .putString("key_iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).commit();
                if (!saved) throw new ModelFailure("CONFIG_SAVE_FAILED", "模型设置保存失败，请重试");
                return publicConfig();
            }
        });
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        run(call, () -> {
            Boolean enabled = call.getBoolean("enabled");
            if (enabled == null) throw new ModelFailure("INVALID_CONFIG", "缺少启用状态");
            synchronized (configLock) {
                if (enabled && !publicConfig().getBoolean("configured", false)) {
                    throw new ModelFailure("MODEL_NOT_CONFIGURED", "请先保存模型地址、模型 ID 和 API Key");
                }
                if (!prefs().edit().putBoolean("enabled", enabled).commit()) {
                    throw new ModelFailure("CONFIG_SAVE_FAILED", "模型设置保存失败，请重试");
                }
                return publicConfig();
            }
        });
    }

    @PluginMethod
    public void clear(PluginCall call) {
        run(call, () -> {
            synchronized (configLock) {
                if (!prefs().edit().clear().commit()) {
                    throw new ModelFailure("CONFIG_SAVE_FAILED", "模型设置清除失败，请重试");
                }
                KeyStore store = KeyStore.getInstance("AndroidKeyStore");
                store.load(null);
                if (store.containsAlias(KEY_ALIAS)) store.deleteEntry(KEY_ALIAS);
                return publicConfig();
            }
        });
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (!requests.tryAcquire()) {
            call.reject("正在处理其他请求，请稍后再试", "MODEL_BUSY");
            return;
        }
        run(call, () -> {
            try {
                Config config;
                synchronized (configLock) {
                    config = readConfig(true);
                }
                if (!config.enabled || config.apiKey.isEmpty()) {
                    throw new ModelFailure("MODEL_NOT_CONFIGURED", "请先保存并启用云模型配置");
                }
                return performRequest(config, call);
            } finally {
                requests.release();
            }
        });
    }

    private JSObject performRequest(Config config, PluginCall call) throws Exception {
        JSONArray source = call.getArray("messages");
        Integer maxTokens = call.getInt("maxTokens");
        if (source == null || source.length() < 1 || source.length() > 16
                || maxTokens == null || maxTokens < 1 || maxTokens > 16000) {
            throw new ModelFailure("INVALID_INPUT", "模型请求参数无效");
        }
        int totalLength = 0;
        JSONArray messages = new JSONArray();
        for (int index = 0; index < source.length(); index++) {
            JSONObject original = source.optJSONObject(index);
            if (original == null) throw new ModelFailure("INVALID_INPUT", "对话消息格式无效");
            String role = text(original, "role", 20);
            String content = text(original, "content", 120000);
            totalLength += content.length();
            if ((!role.equals("system") && !role.equals("user") && !role.equals("assistant"))
                    || content.isEmpty() || totalLength > 160000) {
                throw new ModelFailure("INVALID_INPUT", "对话内容过长或消息角色无效");
            }
            messages.put(new JSONObject().put("role", role).put("content", content));
        }
        JSONObject payload = new JSONObject().put("model", config.model).put("messages", messages)
                .put("max_tokens", maxTokens).put("stream", false);
        if (config.provider.equals("deepseek")) {
            payload.put("thinking", new JSONObject().put("type", "disabled"));
        } else if (config.provider.equals("kimi")) {
            payload.put("reasoning_effort", "low");
        }
        byte[] requestBytes = payload.toString().getBytes(StandardCharsets.UTF_8);
        if (requestBytes.length > 512 * 1024) throw new ModelFailure("INVALID_INPUT", "请求内容过大，请精简后重试");
        HttpURLConnection connection = (HttpURLConnection) new URI(normalizeBase(config.baseUrl) + "/chat/completions").toURL().openConnection();
        Future<?> watchdog = timer.schedule(connection::disconnect, 90, TimeUnit.SECONDS);
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(90);
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(90000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setUseCaches(false);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Authorization", "Bearer " + config.apiKey);
            connection.setFixedLengthStreamingMode(requestBytes.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(requestBytes);
            }
            int status = connection.getResponseCode();
            if (status == 401 || status == 403) throw new ModelFailure("MODEL_AUTH_ERROR", "模型鉴权失败，请检查 API Key 和模型权限");
            if (status == 429) throw new ModelFailure("MODEL_RATE_LIMITED", "模型额度或速率受限，请稍后再试");
            if (status < 200 || status >= 300) {
                throw new ModelFailure("MODEL_HTTP_ERROR", "模型平台返回 HTTP " + status + "，请检查接口地址和模型 ID");
            }
            ByteArrayOutputStream response = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (System.nanoTime() > deadline) throw new SocketTimeoutException();
                    if (response.size() + count > MAX_RESPONSE) throw new ModelFailure("MODEL_BAD_OUTPUT", "模型响应过大，请精简输入后重试");
                    response.write(buffer, 0, count);
                }
            }
            try {
                JSONObject envelope = new JSONObject(response.toString(StandardCharsets.UTF_8.name()));
                JSONArray choices = envelope.optJSONArray("choices");
                JSONObject choice = choices == null ? null : choices.optJSONObject(0);
                if (choice == null) throw new IllegalArgumentException();
                if ("length".equals(choice.optString("finish_reason"))) {
                    throw new ModelFailure("MODEL_TRUNCATED", "模型输出未完成，请精简输入后重试");
                }
                JSONObject message = choice.optJSONObject("message");
                Object content = message == null ? null : message.opt("content");
                if (!(content instanceof String) || ((String) content).trim().isEmpty()) throw new IllegalArgumentException();
                JSObject result = new JSObject();
                result.put("content", ((String) content).trim());
                result.put("provider", config.provider);
                result.put("model", config.model);
                return result;
            } catch (ModelFailure failure) {
                throw failure;
            } catch (Exception error) {
                throw new ModelFailure("MODEL_BAD_OUTPUT", "模型响应格式无效，请稍后重试");
            }
        } catch (Exception error) {
            if (System.nanoTime() > deadline) throw new ModelFailure("MODEL_TIMEOUT", "模型响应超时，请稍后重试");
            throw error;
        } finally {
            watchdog.cancel(false);
            connection.disconnect();
        }
    }

    @Override
    protected void handleOnDestroy() {
        workers.shutdownNow();
        timer.shutdownNow();
    }
}
