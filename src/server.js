const http = require("http");
const fs = require("fs");
const path = require("path");
const store = require("./store");

const PORT = 80;
const NEXUS_PLUGIN_SECRET = process.env.NEXUS_PLUGIN_SECRET || "";
const NEXUS_API_URL =
  process.env.NEXUS_API_URL || "http://host.docker.internal:9600";
const NEXUS_HOST_URL =
  process.env.NEXUS_HOST_URL || "http://host.docker.internal:9600";

const publicDir = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const CATEGORY_EMOJI = {
  win: "\u{1F3C6}",
  motivation: "\u{1F525}",
  gratitude: "\u{1F49C}",
  reminder: "\u{1F4CC}",
};

// ── Token Management ───────────────────────────────────────────

let cachedAccessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 30000) {
    return cachedAccessToken;
  }

  const res = await fetch(`${NEXUS_HOST_URL}/api/v1/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: NEXUS_PLUGIN_SECRET }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedAccessToken;
}

// ── Helpers ────────────────────────────────────────────────────

async function getSettings() {
  try {
    const token = await getAccessToken();
    const res = await fetch(`${NEXUS_HOST_URL}/api/v1/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return await res.json();
  } catch {}
  return {};
}

function formatCookie(cookie) {
  const emoji = CATEGORY_EMOJI[cookie.category] || "";
  const date = new Date(cookie.created_at).toLocaleDateString();
  return `${emoji} ${cookie.message} (${date})`;
}

// ── Server ─────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Config endpoint
  if (req.url === "/api/config") {
    getAccessToken()
      .then((token) => {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ token, apiUrl: NEXUS_API_URL }));
      })
      .catch((err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  // REST API for the UI
  if (req.url === "/api/cookies" && req.method === "GET") {
    const cookies = store.listCookies();
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(cookies));
    return;
  }

  if (req.url === "/api/cookies/random" && req.method === "GET") {
    const cookie = store.getRandomCookie();
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(cookie));
    return;
  }

  if (req.url === "/api/cookies" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { message, category } = JSON.parse(body);
        if (!message || !message.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Message is required" }));
          return;
        }
        const settings = await getSettings();
        const maxCookies = settings.max_cookies || 200;
        const cookie = store.addCookie(message.trim(), category || "win");
        store.trimToMax(maxCookies);
        res.writeHead(201, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify(cookie));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.url === "/api/cookies" && req.method === "DELETE") {
    store.clearJar();
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ cleared: true }));
    return;
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // MCP tool call handler
  if (req.method === "POST" && req.url === "/mcp/call") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { tool_name, arguments: args = {} } = JSON.parse(body);
        let result;

        switch (tool_name) {
          case "add_cookie": {
            if (!args.message || !args.message.trim()) {
              result = {
                content: [{ type: "text", text: "Error: message is required" }],
                is_error: true,
              };
              break;
            }
            const settings = await getSettings();
            const maxCookies = settings.max_cookies || 200;
            const cookie = store.addCookie(
              args.message.trim(),
              args.category || "win"
            );
            store.trimToMax(maxCookies);
            const emoji = CATEGORY_EMOJI[cookie.category] || "";
            result = {
              content: [
                {
                  type: "text",
                  text: `${emoji} Added to the jar: "${cookie.message}"`,
                },
              ],
              is_error: false,
            };
            break;
          }

          case "get_cookie": {
            const cookie = store.getRandomCookie();
            if (!cookie) {
              result = {
                content: [
                  {
                    type: "text",
                    text: "The jar is empty! Add some cookies first.",
                  },
                ],
                is_error: false,
              };
            } else {
              result = {
                content: [{ type: "text", text: formatCookie(cookie) }],
                is_error: false,
              };
            }
            break;
          }

          case "list_cookies": {
            const cookies = store.listCookies(args.category);
            if (cookies.length === 0) {
              const msg = args.category
                ? `No ${args.category} cookies in the jar.`
                : "The jar is empty!";
              result = {
                content: [{ type: "text", text: msg }],
                is_error: false,
              };
            } else {
              const lines = cookies.map(formatCookie);
              result = {
                content: [
                  {
                    type: "text",
                    text: `${cookies.length} cookie${cookies.length === 1 ? "" : "s"} in the jar:\n\n${lines.join("\n")}`,
                  },
                ],
                is_error: false,
              };
            }
            break;
          }

          case "count_cookies": {
            const count = store.countCookies();
            result = {
              content: [
                {
                  type: "text",
                  text: `There ${count === 1 ? "is" : "are"} ${count} cookie${count === 1 ? "" : "s"} in the jar.`,
                },
              ],
              is_error: false,
            };
            break;
          }

          case "clear_jar": {
            store.clearJar();
            result = {
              content: [
                { type: "text", text: "The jar has been emptied. Fresh start!" },
              ],
              is_error: false,
            };
            break;
          }

          default:
            result = {
              content: [{ type: "text", text: `Unknown tool: ${tool_name}` }],
              is_error: true,
            };
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            content: [{ type: "text", text: `Error: ${err.message}` }],
            is_error: true,
          })
        );
      }
    });
    return;
  }

  // Serve index.html with NEXUS_API_URL templated in
  if (req.url === "/" || req.url === "/index.html") {
    const html = fs
      .readFileSync(path.join(publicDir, "index.html"), "utf8")
      .replace(/\{\{NEXUS_API_URL\}\}/g, NEXUS_API_URL);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
    return;
  }

  // Serve other static files
  const fullPath = path.join(publicDir, req.url);
  const ext = path.extname(fullPath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Cookie Jar plugin running on port ${PORT}`);
});
