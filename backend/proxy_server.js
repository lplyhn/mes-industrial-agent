const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const dist = path.join(__dirname, "../frontend/dist");
const DB_PATH = path.join(__dirname, "conversations.db");
const GATEWAY = { host: "localhost", port: 8642 };

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

var SQL = null;
var db = null;

function getDB() {
  if (db) return db;
  try {
    var buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } catch {
    db = new SQL.Database();
  }
  db.run("CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, title TEXT, messages TEXT, toolCalls TEXT, created_at TEXT, updated_at TEXT)");
  return db;
}

function saveDB() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function sendJSON(res, data, status) {
  status = status || 200;
  res.writeHead(status, {"Content-Type": "application/json; charset=utf-8"});
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise(function(r) {
    var b = "";
    req.on("data", function(c) { b += c; });
    req.on("end", function() { try { r(JSON.parse(b)); } catch { r({}); } });
  });
}

async function handleConv(req, res, rest) {
  var parts = rest ? rest.split("/") : [];
  var cid = parts[0];
  var d = getDB();

  if (req.method === "GET" && parts.length === 0) {
    var rows = d.exec("SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC");
    if (!rows[0] || !rows[0].values) { sendJSON(res, []); return; }
    var cols = rows[0].columns;
    sendJSON(res, rows[0].values.map(function(v) {
      var obj = {};
      for (var i = 0; i < cols.length; i++) obj[cols[i]] = v[i];
      return obj;
    }));
    return;
  }

  if (req.method === "POST" && parts.length === 0) {
    var n = new Date().toISOString();
    var id = crypto.randomUUID();
    d.run("INSERT INTO conversations (id, title, messages, toolCalls, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, "\u65b0\u5bf9\u8bdd", "[]", "[]", n, n]);
    saveDB();
    sendJSON(res, {id, title: "\u65b0\u5bf9\u8bdd", messages: [], toolCalls: [], created_at: n, updated_at: n});
    return;
  }

  if (!cid) { sendJSON(res, {error: "not found"}, 404); return; }

  if (req.method === "GET") {
    var rows = d.exec("SELECT * FROM conversations WHERE id=?", [cid]);
    if (!rows[0] || !rows[0].values || !rows[0].values[0]) { sendJSON(res, {error: "not found"}, 404); return; }
    var cols = rows[0].columns;
    var vals = rows[0].values[0];
    var obj = {};
    for (var i = 0; i < cols.length; i++) {
      var v = vals[i];
      if (cols[i] === "messages" || cols[i] === "toolCalls") {
        try { obj[cols[i]] = JSON.parse(v); } catch { obj[cols[i]] = []; }
      } else {
        obj[cols[i]] = v;
      }
    }
    sendJSON(res, obj);
    return;
  }

  if (req.method === "PUT") {
    var body = await parseBody(req);
    var existing = d.exec("SELECT * FROM conversations WHERE id=?", [cid]);
    if (!existing[0] || !existing[0].values || !existing[0].values[0]) { sendJSON(res, {error: "not found"}, 404); return; }
    var exCols = existing[0].columns;
    var exVals = existing[0].values[0];
    var exObj = {};
    for (var i = 0; i < exCols.length; i++) exObj[exCols[i]] = exVals[i];

    var title = body.title !== undefined ? body.title : exObj.title;
    var msgs = body.messages !== undefined ? JSON.stringify(body.messages) : exObj.messages;
    var tcs = body.toolCalls !== undefined ? JSON.stringify(body.toolCalls) : exObj.toolCalls;
    var now = new Date().toISOString();

    d.run("UPDATE conversations SET title=?, messages=?, toolCalls=?, updated_at=? WHERE id=?",
      [title, msgs, tcs, now, cid]);
    saveDB();
    sendJSON(res, {ok: true});
    return;
  }

  if (req.method === "DELETE") {
    d.run("DELETE FROM conversations WHERE id=?", [cid]);
    saveDB();
    sendJSON(res, {ok: true});
    return;
  }

  sendJSON(res, {error: "method not allowed"}, 405);
}

async function start() {
  SQL = await initSqlJs();
  getDB();
  http.createServer(function(req, res) {
    if (req.url.indexOf("/api/conversations") === 0) {
      handleConv(req, res, req.url.substring("/api/conversations".length).replace(/^\/+/, ""));
      return;
    }
    if (req.url.indexOf("/api/") === 0) {
      var tp = req.url.replace("/api", "");
      var opts = { hostname: GATEWAY.host, port: GATEWAY.port, path: tp, method: req.method, headers: Object.assign({}, req.headers) };
      opts.headers.host = GATEWAY.host + ":" + GATEWAY.port;
      delete opts.headers["origin"];
      var pr = http.request(opts, function(prs) { res.writeHead(prs.statusCode, prs.headers); prs.pipe(res); });
      pr.on("error", function() { res.writeHead(502); res.end("Bad Gateway"); });
      req.pipe(pr);
      return;
    }
    var fPath = path.join(dist, req.url === "/" ? "index.html" : req.url);
    var ext = path.extname(fPath);
    fs.readFile(fPath, function(err, data) {
      if (err) {
        fs.readFile(path.join(dist, "index.html"), function(e2, d2) {
          if (e2) { res.writeHead(404); res.end("Not found"); return; }
          res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
          res.end(d2);
        });
        return;
      }
      res.writeHead(200, {"Content-Type": mimeTypes[ext] || "application/octet-stream"});
      res.end(data);
    });
  }).listen(5175, "0.0.0.0", function() { console.log("Frontend on :5175 (SQLite)"); });
}

start().catch(console.error);
