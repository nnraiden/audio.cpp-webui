const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const HOST = process.env.WEBUI_HOST || "127.0.0.1";
const PORT = Number(process.env.WEBUI_PORT || 3000);
const API_ORIGIN = process.env.AUDIOCPP_API_ORIGIN || "http://127.0.0.1:8880";
const SERVER_CONFIG_PATH = process.env.AUDIOCPP_SERVER_CONFIG || path.resolve(ROOT, "..", "server.json");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readServerConfig() {
  try {
    const text = fs.readFileSync(SERVER_CONFIG_PATH, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function resolveConfigPath(modelPath, candidatePath) {
  if (typeof candidatePath !== "string" || candidatePath.length === 0) {
    return null;
  }
  return path.isAbsolute(candidatePath)
    ? candidatePath
    : path.resolve(modelPath, candidatePath);
}

function listWavSamples(basePath) {
  if (!basePath) {
    return [];
  }
  try {
    return fs.readdirSync(basePath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".wav")
      .map((entry) => ({
        id: path.basename(entry.name, path.extname(entry.name)),
        path: path.join(basePath, entry.name),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

function loadVoiceCatalogFromConfig(modelId) {
  const config = readServerConfig();
  const model = config?.models?.find((item) => item?.id === modelId);
  if (!model) {
    return { presets: [], samples: [] };
  }

  const modelPath = typeof model.path === "string"
    ? (path.isAbsolute(model.path) ? model.path : path.resolve(path.dirname(SERVER_CONFIG_PATH), model.path))
    : path.dirname(SERVER_CONFIG_PATH);
  const presetEntries = Object.entries(model.voice_presets || {})
    .map(([id, preset]) => ({
      id,
      voice_id: typeof preset?.voice_id === "string" ? preset.voice_id : null,
      voice_ref: resolveConfigPath(modelPath, preset?.voice_ref),
      reference_text: typeof preset?.reference_text === "string" ? preset.reference_text : null,
      is_default: model.default_voice_preset === id,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const samples = listWavSamples(resolveConfigPath(modelPath, model.voice_samples_base));

  return { presets: presetEntries, samples };
}

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const resolved = path.resolve(root, `.${normalized}`);
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}

function serveFile(req, res, requestPath) {
  const filePath = requestPath === "/" ? path.join(ROOT, "index.html") : safeJoin(ROOT, requestPath);
  if (!filePath) {
    sendJson(res, 400, { error: "invalid path" });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      const fallback = path.join(ROOT, "index.html");
      fs.readFile(fallback, (fallbackError, fallbackData) => {
        if (fallbackError) {
          sendJson(res, 404, { error: "not found" });
          return;
        }
        res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
        res.end(fallbackData);
      });
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Content-Length": stats.size,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxyRequest(req, res) {
  const upstreamUrl = new URL(req.url.replace(/^\/api/, ""), API_ORIGIN);
  const headers = { ...req.headers };
  delete headers.host;
  headers.origin = API_ORIGIN;

  const upstream = http.request(
    upstreamUrl,
    {
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstream.on("error", (error) => {
    sendJson(res, 502, {
      error: "proxy_error",
      message: `Failed to reach audio.cpp backend at ${API_ORIGIN}: ${error.message}`,
    });
  });

  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: "missing url" });
    return;
  }
  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (requestUrl.pathname === "/__webui/config") {
    sendJson(res, 200, { apiOrigin: API_ORIGIN });
    return;
  }

  if (requestUrl.pathname === "/__webui/voice-catalog") {
    sendJson(res, 200, loadVoiceCatalogFromConfig(requestUrl.searchParams.get("model")));
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    proxyRequest(req, res);
    return;
  }

  serveFile(req, res, requestUrl.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`audiocpp webui listening on http://${HOST}:${PORT}`);
  console.log(`proxying backend requests to ${API_ORIGIN}`);
});
