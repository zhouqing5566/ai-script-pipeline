import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    await fs.writeFile(filePath, JSON.stringify(body, null, 2), "utf8");
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
    const provider = body.provider || {};
    const modelName = body.modelName || body.model?.modelName || "test";
    if (provider.providerType === "local") {
      sendJson(res, 200, { ok: true, message: "本地 Demo Provider 可用。", mode: "demo" });
      return true;
    }
    if (!provider.baseUrl || !provider.apiKey) {
      sendJson(res, 400, { ok: false, error: "缺少 Base URL 或 API Key。" });
      return true;
    }
    const endpoint = buildChatCompletionsUrl(provider.baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(provider.timeoutMs) || 30000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${provider.apiKey}`,
          ...(provider.defaultHeaders || {})
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 8,
          temperature: 0
        }),
        signal: controller.signal
      });
      const text = await response.text();
      sendJson(res, response.ok ? 200 : 502, {
        ok: response.ok,
        status: response.status,
        message: response.ok ? "真实 API 连接测试通过。" : "真实 API 返回错误。",
        preview: text.slice(0, 300)
      });
    } catch (error) {
      sendJson(res, 502, { ok: false, error: error.message });
    } finally {
      clearTimeout(timer);
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

function buildChatCompletionsUrl(baseUrl = "") {
  const clean = String(baseUrl).trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(clean)) return clean;
  return `${clean}/chat/completions`;
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
