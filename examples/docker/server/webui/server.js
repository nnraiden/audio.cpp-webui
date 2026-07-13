const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const HOST = process.env.WEBUI_HOST || "127.0.0.1";
const PORT = Number(process.env.WEBUI_PORT || 3000);
const API_ORIGIN = process.env.AUDIOCPP_API_ORIGIN || "http://127.0.0.1:8880";

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
  const upstreamUrl = new URL(req.url, API_ORIGIN);
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

  if (requestUrl.pathname === "/health" || requestUrl.pathname === "/v1" || requestUrl.pathname.startsWith("/v1/")) {
    proxyRequest(req, res);
    return;
  }

  serveFile(req, res, requestUrl.pathname);
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`Web UI failed to bind ${HOST}:${PORT} because the address is already in use.`);
    process.exit(1);
  }
  console.error(`Web UI server error: ${error?.message ?? String(error)}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`audiocpp webui listening on http://${HOST}:${PORT}`);
  console.log(`proxying backend requests to ${API_ORIGIN}`);
});
