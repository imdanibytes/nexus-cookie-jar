const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "data", "cookies.json");

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function save(cookies) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(cookies, null, 2));
}

function addCookie(message, category = "win") {
  const cookies = load();
  const cookie = {
    id: crypto.randomUUID(),
    message,
    category,
    created_at: new Date().toISOString(),
  };
  cookies.push(cookie);
  save(cookies);
  return cookie;
}

/** Pull a random cookie from the jar and remove it. Returns null if empty. */
function grabCookie() {
  const cookies = load();
  if (cookies.length === 0) return null;
  const idx = Math.floor(Math.random() * cookies.length);
  const [cookie] = cookies.splice(idx, 1);
  save(cookies);
  return cookie;
}

function listCookies(category) {
  const cookies = load();
  if (category) return cookies.filter((c) => c.category === category);
  return cookies;
}

function countCookies() {
  return load().length;
}

function trimToMax(max) {
  const cookies = load();
  if (cookies.length > max) {
    save(cookies.slice(cookies.length - max));
  }
}

module.exports = {
  addCookie,
  grabCookie,
  listCookies,
  countCookies,
  trimToMax,
};
