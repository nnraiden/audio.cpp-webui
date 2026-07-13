const http = require("node:http");
const { spawn } = require("node:child_process");

const WEBUI_HOST = "127.0.0.1";
const WEBUI_DIR = __dirname + "/..";

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once("error", reject);
    server.listen(0, WEBUI_HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to determine free port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function httpGetJson(port, path) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        host: WEBUI_HOST,
        port,
        path,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode || 0,
              json: JSON.parse(body),
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
  });
}

function waitForListening(child, port) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`webui did not start on port ${port}`));
    }, 15000);

    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes(`audiocpp webui listening on http://${WEBUI_HOST}:${port}`)) {
        cleanup();
        resolve();
      }
    };

    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`webui exited before startup completed (code=${code}, signal=${signal})`));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.stderr.off("data", onData);
      child.off("exit", onExit);
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", onExit);
  });
}

function waitForExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve(child.exitCode);
      return;
    }
    child.once("exit", (code) => resolve(code ?? 0));
  });
}

function spawnNpmStart(port) {
  const output = [];
  const child = spawn(npmCommand(), ["start"], {
    cwd: WEBUI_DIR,
    env: {
      ...process.env,
      WEBUI_HOST,
      WEBUI_PORT: String(port),
      AUDIOCPP_API_ORIGIN: "http://127.0.0.1:8880",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  return { child, output };
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await waitForExit(child);
}

async function testWebUiSmokeStart() {
  const port = await findFreePort();
  const { child } = spawnNpmStart(port);
  try {
    await waitForListening(child, port);
    const response = await new Promise((resolve, reject) => {
      const request = http.get({ host: WEBUI_HOST, port, path: "/" }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode || 0, body }));
      });
      request.on("error", reject);
    });
    requireCondition(response.status === 200, "root page should return 200");
    requireCondition(response.body.includes("<!DOCTYPE html>") || response.body.includes("<!doctype html>"), "root page should serve html");
  } finally {
    await stopChild(child);
  }
}

async function testWebUiPortInUseFailure() {
  const port = await findFreePort();
  const blocker = http.createServer();
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(port, WEBUI_HOST, resolve);
  });

  const { child, output } = spawnNpmStart(port);
  const exitCode = await waitForExit(child);
  blocker.close();

  requireCondition(exitCode !== 0, "npm start should fail when the target port is already in use");
  const mergedOutput = output.join("");
  requireCondition(
    mergedOutput.includes(`Web UI failed to bind ${WEBUI_HOST}:${port} because the address is already in use.`),
    "port-in-use failure should surface a clear error message"
  );
}

async function main() {
  await testWebUiSmokeStart();
  await testWebUiPortInUseFailure();
  console.log("webui smoke test passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
