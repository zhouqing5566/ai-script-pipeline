import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeApiConfig } from "./src/model-config.js";
import { resolveRequestFormat } from "./src/request-format.js";
import { classifyProviderError, diagnoseProviderProtocol, suggestProviderFix } from "./src/provider-diagnostics.js";
import { callGemini } from "./src/provider-adapters/gemini.js";
import { callOpenAICompatible } from "./src/provider-adapters/openai-compatible.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const port = Number(process.env.PORT || 4178);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const dataDirs = [
  "data/projects",
  "data/cases",
  "data/assets",
  "data/skills",
  "data/settings",
  "data/logs",
  "data/exports"
];

async function ensureDataDirs() {
  await Promise.all(dataDirs.map((dir) => fs.mkdir(path.join(rootDir, dir), { recursive: true })));
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function safeExportName(name, fallback = "export") {
  const clean = String(name || fallback)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 90);
  return clean || fallback;
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      product: "AI 剧本结构学习与细纲生产系统",
      mode: "demo",
      now: new Date().toISOString()
    });
    return true;
  }

  if (url.pathname === "/api/snapshot" && req.method === "GET") {
    const filePath = path.join(rootDir, "data/projects/current-snapshot.json");
    try {
      const content = await fs.readFile(filePath, "utf8");
      sendJson(res, 200, JSON.parse(content));
    } catch {
      sendJson(res, 200, null);
    }
    return true;
  }

  if (url.pathname === "/api/snapshot" && req.method === "POST") {
    const body = await readBody(req);
    const filePath = path.join(rootDir, "data/projects/current-snapshot.json");
    await fs.writeFile(filePath, JSON.stringify(redactSecrets(body), null, 2), "utf8");
    sendJson(res, 200, { ok: true, path: filePath });
    return true;
  }

  if (url.pathname === "/api/model-call-log" && req.method === "POST") {
    const body = await readBody(req);
    const line = JSON.stringify({ ...body, receivedAt: new Date().toISOString() });
    await fs.appendFile(path.join(rootDir, "data/logs/model-calls.jsonl"), `${line}\n`, "utf8");
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (url.pathname === "/api/settings" && req.method === "GET") {
    const filePath = path.join(rootDir, "data/settings/model-settings.json");
    try {
      const content = await fs.readFile(filePath, "utf8");
      sendJson(res, 200, JSON.parse(content));
    } catch {
      sendJson(res, 200, null);
    }
    return true;
  }

  if (url.pathname === "/api/settings" && req.method === "POST") {
    const body = await readBody(req);
    const filePath = path.join(rootDir, "data/settings/model-settings.json");
    await fs.writeFile(filePath, JSON.stringify(body, null, 2), "utf8");
    sendJson(res, 200, { ok: true, path: filePath });
    return true;
  }

  if (url.pathname === "/api/test-provider" && req.method === "POST") {
    const body = await readBody(req);
    const startedAt = performance.now();
    let provider = null;
    let model = null;
    let settingsUpdatedAt = null;
    try {
      const resolved = await resolveProviderModel(body, { requireCurrentProviderModel: true, allowProtocolError: true });
      provider = resolved.provider;
      model = resolved.model;
      settingsUpdatedAt = resolved.settings.updatedAt || null;
      const diagnostics = diagnoseProviderProtocol(provider, model);
      if (provider.providerType === "local") {
        const responseBody = {
          ok: true,
          message: "本地 Demo Provider 可用。这是 Demo Provider 测试，不代表真实 API 可用。",
          mode: "demo",
          endpointType: "local_demo",
          taskType: body.taskType || "testProvider",
          routeId: body.routeId || null,
          providerId: provider.id || null,
          providerName: provider.name || "",
          modelId: model?.id || null,
          modelName: model?.displayName || model?.modelName || "",
          requestFormat: "demo",
          serverStatus: 200,
          providerStatus: 200,
          providerRawPreview: "local demo provider",
          settingsUpdatedAt,
          providerUpdatedAt: provider.updatedAt || null,
          modelUpdatedAt: model?.updatedAt || null,
          latencyMs: Math.round(performance.now() - startedAt)
        };
        await appendServerProxyLog({ ...responseBody, source: "test-provider", success: true });
        sendJson(res, 200, responseBody);
        return true;
      }
      if (!model?.id) {
        sendJson(res, 400, { ok: false, error: "该 Provider 下没有启用模型，请先新增或启用一个模型。" });
        return true;
      }
      if (!provider.baseUrl || !provider.apiKey) {
        sendJson(res, 400, { ok: false, error: "缺少 Base URL 或 API Key。" });
        return true;
      }
      if (diagnostics.severity === "error") {
        const responseBody = {
          ok: false,
          endpointType: "server_proxy",
          taskType: body.taskType || "testProvider",
          routeId: body.routeId || null,
          providerId: provider.id || null,
          providerName: provider.name || "",
          modelId: model.id || null,
          modelName: model.displayName || model.modelName || "",
          requestFormat: resolveRequestFormat({ provider, model }),
          serverStatus: 400,
          providerStatus: null,
          providerRawPreview: "",
          settingsUpdatedAt,
          providerUpdatedAt: provider.updatedAt || null,
          modelUpdatedAt: model.updatedAt || null,
          latencyMs: Math.round(performance.now() - startedAt),
          errorType: "provider_protocol_mismatch",
          diagnostics,
          suggestions: diagnostics.suggestions || [],
          error: diagnostics.issues.join("；") || "Provider 协议预检失败。",
          errorMessage: diagnostics.issues.join("；") || "Provider 协议预检失败。"
        };
        await appendServerProxyLog({ ...responseBody, source: "test-provider", success: false });
        sendJson(res, 400, responseBody);
        return true;
      }
      const adapterResult = await performProviderCall({
        provider,
        model,
        messages: [{ role: "user", content: "ping" }],
        options: { maxOutputTokens: 8, temperature: 0, timeoutMs: Number(provider.timeoutMs) || 30000 },
        source: "test-provider"
      });
      const responseBody = {
        ok: true,
        status: 200,
        message: "真实 API 连接测试通过。",
        endpointType: "server_proxy",
        taskType: body.taskType || "testProvider",
        routeId: body.routeId || null,
        providerId: provider.id || null,
        providerName: provider.name || "",
        modelId: model.id || null,
        modelName: model.displayName || model.modelName || "",
        requestFormat: adapterResult.requestFormat,
        serverStatus: 200,
        providerStatus: adapterResult.providerStatus || 200,
        providerRawPreview: adapterResult.providerRawPreview,
        settingsUpdatedAt,
        providerUpdatedAt: provider.updatedAt || null,
        modelUpdatedAt: model.updatedAt || null,
        diagnostics,
        suggestions: diagnostics.suggestions || [],
        latencyMs: Math.round(performance.now() - startedAt),
        preview: adapterResult.outputText.slice(0, 300)
      };
      await appendServerProxyLog({ ...responseBody, source: "test-provider", success: true });
      sendJson(res, 200, responseBody);
    } catch (error) {
      const normalized = normalizeProviderError(error, provider, model);
      const responseBody = {
        ok: false,
        endpointType: "server_proxy",
        taskType: body.taskType || "testProvider",
        routeId: body.routeId || null,
        providerId: provider?.id || body.providerId || null,
        providerName: provider?.name || "",
        modelId: model?.id || body.modelId || null,
        modelName: model?.displayName || model?.modelName || "",
        requestFormat: provider && model ? resolveRequestFormat({ provider, model }) : body.requestFormat || "auto",
        serverStatus: 502,
        providerStatus: null,
        providerRawPreview: "",
        settingsUpdatedAt,
        providerUpdatedAt: provider?.updatedAt || null,
        modelUpdatedAt: model?.updatedAt || null,
        errorType: normalized.errorType,
        diagnostics: normalized.diagnostics,
        suggestions: normalized.suggestions,
        latencyMs: Math.round(performance.now() - startedAt),
        error: normalized.message,
        errorMessage: normalized.message
      };
      await appendServerProxyLog({ ...responseBody, source: "test-provider", success: false });
      sendJson(res, 502, responseBody);
    }
    return true;
  }

  if (url.pathname === "/api/model-call" && req.method === "POST") {
    const body = await readBody(req);
    const startedAt = performance.now();
    let provider = null;
    let model = null;
    let requestFormat = body.requestFormat || "auto";
    let settingsUpdatedAt = null;
    try {
      const resolved = await resolveProviderModel(body);
      settingsUpdatedAt = resolved.settings.updatedAt || null;
      model = resolved.model;
      requestFormat = body.requestFormat || resolved.provider.requestFormat || "auto";
      provider = { ...resolved.provider, requestFormat };
      const diagnostics = diagnoseProviderProtocol(provider, model);
      if (diagnostics.severity === "error") {
        const message = diagnostics.issues.join("；") || "Provider 协议预检失败。";
        const protocolError = new Error(message);
        protocolError.diagnostics = diagnostics;
        throw protocolError;
      }
      const adapterResult = await performProviderCall({
        provider,
        model,
        messages: body.messages || [],
        options: body.options || {},
        source: "model-call"
      });
      const responseBody = {
        ok: true,
        endpointType: "server_proxy",
        status: 200,
        providerId: provider.id || null,
        providerName: provider.name || "",
        modelId: model.id || null,
        modelName: model.displayName || model.modelName || "",
        routeId: body.routeId || null,
        taskType: body.taskType || null,
        requestFormat: adapterResult.requestFormat,
        serverStatus: 200,
        providerStatus: adapterResult.providerStatus || 200,
        providerRawPreview: adapterResult.providerRawPreview,
        effectiveTimeoutMs: adapterResult.effectiveTimeoutMs,
        routeTimeoutMs: Number(body.options?.timeoutMs) || null,
        providerTimeoutMs: Number(provider.timeoutMs) || null,
        effectiveMaxOutputTokens: Number(body.options?.maxOutputTokens) || null,
        routeMaxOutputTokens: Number(body.options?.requestedMaxOutputTokens || body.options?.maxOutputTokens) || null,
        effectiveInvocation: createEffectiveInvocationLog({ body, provider, model, requestFormat: adapterResult.requestFormat, effectiveTimeoutMs: adapterResult.effectiveTimeoutMs }),
        settingsUpdatedAt,
        providerUpdatedAt: provider.updatedAt || null,
        modelUpdatedAt: model.updatedAt || null,
        outputText: adapterResult.outputText,
        tokenUsage: adapterResult.tokenUsage,
        latencyMs: Math.round(performance.now() - startedAt)
      };
      await appendServerProxyLog({ ...responseBody, success: true });
      sendJson(res, 200, responseBody);
    } catch (error) {
      const normalized = normalizeProviderError(error, provider, model);
      const responseBody = {
        ok: false,
        endpointType: "server_proxy",
        status: 502,
        providerId: provider?.id || body.providerId || null,
        providerName: provider?.name || "",
        modelId: model?.id || body.modelId || null,
        modelName: model?.displayName || model?.modelName || "",
        routeId: body.routeId || null,
        taskType: body.taskType || null,
        requestFormat: provider && model ? resolveRequestFormat({ provider: { ...provider, requestFormat }, model }) : requestFormat,
        serverStatus: 502,
        providerStatus: null,
        providerRawPreview: "",
        effectiveTimeoutMs: Number(body.options?.timeoutMs || provider?.timeoutMs || 60000),
        routeTimeoutMs: Number(body.options?.timeoutMs) || null,
        providerTimeoutMs: Number(provider?.timeoutMs) || null,
        effectiveMaxOutputTokens: Number(body.options?.maxOutputTokens) || null,
        routeMaxOutputTokens: Number(body.options?.requestedMaxOutputTokens || body.options?.maxOutputTokens) || null,
        effectiveInvocation: createEffectiveInvocationLog({ body, provider, model, requestFormat: provider && model ? resolveRequestFormat({ provider: { ...provider, requestFormat }, model }) : requestFormat, effectiveTimeoutMs: Number(body.options?.timeoutMs || provider?.timeoutMs || 60000) }),
        settingsUpdatedAt,
        providerUpdatedAt: provider?.updatedAt || null,
        modelUpdatedAt: model?.updatedAt || null,
        errorType: normalized.errorType,
        diagnostics: normalized.diagnostics,
        suggestions: normalized.suggestions,
        error: normalized.message,
        errorMessage: normalized.message,
        latencyMs: Math.round(performance.now() - startedAt)
      };
      await appendServerProxyLog({ ...responseBody, success: false });
      sendJson(res, 502, responseBody);
    }
    return true;
  }

  if (url.pathname === "/api/export" && req.method === "POST") {
    const body = await readBody(req);
    const ext = body.type === "json" ? "json" : "md";
    const fileName = `${safeExportName(body.fileName)}-${Date.now()}.${ext}`;
    const filePath = path.join(rootDir, "data/exports", fileName);
    await fs.writeFile(filePath, String(body.content || ""), "utf8");
    sendJson(res, 200, {
      ok: true,
      fileName,
      path: filePath,
      href: `/exports/${encodeURIComponent(fileName)}`
    });
    return true;
  }

  return false;
}

async function performProviderCall({ provider, model, messages, options, source }) {
  if (!provider?.baseUrl || !provider?.apiKey) throw new Error("缺少 Base URL 或 API Key。");
  const requestFormat = resolveRequestFormat({ provider, model });
  const adapterResult =
    requestFormat === "gemini_native"
      ? await callGemini({ provider, model, messages, options })
      : await callOpenAICompatible({ provider, model, messages, options });
  return {
    ...adapterResult,
    endpointType: "server_proxy",
    requestFormat,
    providerStatus: 200,
    providerRawPreview: previewProviderRaw(adapterResult.raw),
    effectiveTimeoutMs: adapterResult.effectiveTimeoutMs || Number(options.timeoutMs || provider.timeoutMs || 60000),
    source
  };
}

async function resolveProviderModel(body = {}, options = {}) {
  const settings = await loadSettingsConfig();
  const providerId = body.providerId;
  const modelId = body.modelId;
  let provider = settings.providers.find((item) => item.id === providerId);
  let model = settings.models.find((item) => item.id === modelId);

  if (!provider) throw new Error("未找到 Provider 配置。请先保存 Provider，再测试或调用。");
  if (!options.allowProtocolError && provider.health?.status === "protocol_error") {
    throw new Error("Provider 当前为 protocol_error，不能被任务路由选为 active model。请先修复 requestFormat / Base URL 并重新测试。");
  }

  if (options.requireCurrentProviderModel) {
    const providerModels = settings.models.filter((item) => item.providerId === provider.id && item.enabled);
    model = providerModels.find((item) => item.id === model?.id) || providerModels[0] || null;
  }

  if (!model && options.requireCurrentProviderModel) throw new Error("该 Provider 下没有启用模型，请先新增或启用一个模型。");
  if (!model) throw new Error("未找到模型配置。请先保存并启用模型。");
  if (model.providerId && model.providerId !== provider.id) throw new Error("模型不属于当前 Provider，请重新选择模型。");
  return { provider, model, settings };
}

async function loadSettingsConfig() {
  const filePath = path.join(rootDir, "data/settings/model-settings.json");
  try {
    const content = await fs.readFile(filePath, "utf8");
    return normalizeApiConfig(JSON.parse(content));
  } catch {
    return normalizeApiConfig({});
  }
}

async function appendServerProxyLog(entry) {
  const line = JSON.stringify({
    ...entry,
    outputText: entry.outputText ? String(entry.outputText).slice(0, 240) : undefined,
    providerRawPreview: entry.providerRawPreview ? String(entry.providerRawPreview).slice(0, 500) : undefined,
    receivedAt: new Date().toISOString()
  });
  await fs.appendFile(path.join(rootDir, "data/logs/model-server-proxy.jsonl"), `${line}\n`, "utf8");
}

function previewProviderRaw(raw) {
  if (!raw) return "";
  try {
    return JSON.stringify(redactSecrets(raw)).slice(0, 500);
  } catch {
    return String(raw).slice(0, 500);
  }
}

function createEffectiveInvocationLog({ body = {}, provider = null, model = null, requestFormat = "auto", effectiveTimeoutMs = null }) {
  const options = body.options || {};
  return {
    taskType: body.taskType || null,
    routeId: body.routeId || null,
    routeTaskType: body.taskType || null,
    modelId: model?.id || body.modelId || null,
    providerId: provider?.id || body.providerId || null,
    providerName: provider?.name || "",
    modelName: model?.displayName || model?.modelName || "",
    routeTimeoutMs: Number(options.timeoutMs) || null,
    providerTimeoutMs: Number(provider?.timeoutMs) || null,
    effectiveTimeoutMs: Number(effectiveTimeoutMs || options.timeoutMs || provider?.timeoutMs || 60000),
    routeMaxOutputTokens: Number(options.requestedMaxOutputTokens || options.maxOutputTokens) || null,
    effectiveMaxOutputTokens: Number(options.maxOutputTokens) || null,
    requestFormat,
    resolvedRequestFormat: requestFormat
  };
}

function normalizeProviderError(error, provider = null, model = null) {
  const raw = error?.message || String(error || "未知错误");
  const errorType = classifyProviderError(raw);
  const diagnostics = provider && model ? diagnoseProviderProtocol(provider, model, { errorMessage: raw }) : null;
  const suggestions = suggestProviderFix(raw, provider || {}, model || {});
  if (raw.includes("当前接口不接受 OpenAI Chat Completions 格式") || raw.includes("请求被中止") || raw.includes("服务端请求外部 Provider 失败")) {
    return { message: raw, errorType, diagnostics, suggestions };
  }
  if (/Unknown name "messages"|Unknown name "max_tokens"|Unknown name "temperature"|Cannot find field/i.test(raw)) {
    return {
      message:
        `${raw}。当前接口不接受 OpenAI Chat Completions 请求体。你可能把 Gemini native 接口配置成了 OpenAI-compatible，或 Base URL 不是 /chat/completions 兼容地址。`,
      errorType,
      diagnostics,
      suggestions
    };
  }
  if (/Failed to fetch|fetch failed/i.test(raw)) {
    return {
      message: `${raw}。服务端请求外部 Provider 失败，请确认 Base URL、requestFormat、网络代理和服务商状态；浏览器侧真实任务已经通过本地 server proxy 转发。`,
      errorType,
      diagnostics,
      suggestions
    };
  }
  if (/The user aborted a request|signal is aborted|AbortError|aborted/i.test(raw)) {
    return {
      message: `${raw}。请求被中止，可能是超时、重复触发或页面状态切换。请查看 timeoutMs 和是否重复点击。`,
      errorType,
      diagnostics,
      suggestions
    };
  }
  return { message: raw, errorType, diagnostics, suggestions };
}

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (key.toLowerCase() === "apikey") return [key, item ? "[已脱敏]" : ""];
      return [key, redactSecrets(item)];
    })
  );
}

async function serveStatic(req, res, url) {
  const decoded = decodeURIComponent(url.pathname);
  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const normalized = path.normalize(relativePath);
  if (normalized.startsWith("..")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const filePath = normalized.startsWith("exports/")
    ? path.join(rootDir, "data", normalized)
    : path.join(rootDir, normalized);

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": contentTypes[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "max-age=60"
    });
    res.end(await fs.readFile(filePath));
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

await ensureDataDirs();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (!handled) sendJson(res, 404, { ok: false, error: "API not found" });
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`AI 剧本结构学习与细纲生产系统已启动：http://${host}:${port}`);
});
