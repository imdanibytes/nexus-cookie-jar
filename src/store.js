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

function getRandomCookie() {
  const cookies = load();
  if (cookies.length === 0) return null;
  return cookies[Math.floor(Math.random() * cookies.length)];
}

function listCookies(category) {
  const cookies = load();
  if (category) return cookies.filter((c) => c.category === category);
  return cookies;
}

function countCookies() {
  return load().length;
}

function clearJar() {
  save([]);
}

function trimToMax(max) {
  const cookies = load();
  if (cookies.length > max) {
    save(cookies.slice(cookies.length - max));
  }
}

module.exports = {
  addCookie,
  getRandomCookie,
  listCookies,
  countCookies,
  clearJar,
  trimToMax,
};
