#!/usr/bin/env node
/**
 * Caderneta — API + static
 * Persiste em ./data/caderneta.json (disco do servidor, não no browser).
 *
 * Uso: node server.js
 * Env: PORT=8765  CADERNETA_TOKEN=opcional
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "caderneta.json");
const SHEET_FILE = path.join(DATA_DIR, "caderneta.csv");
const PORT = Number(process.env.PORT || 8765);
const TOKEN = process.env.CADERNETA_TOKEN || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const GL_COLS = [
  ["jejum", "glicemia_jejum"],
  ["posCafe", "glicemia_2h_cafe"],
  ["preAlmoco", "glicemia_pre_almoco"],
  ["posAlmoco", "glicemia_2h_almoco"],
  ["preJantar", "glicemia_pre_jantar"],
  ["posJantar", "glicemia_2h_jantar"],
  ["deitar", "glicemia_ao_deitar"],
];

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ nome: "", limites: { hipo: 70, pre: 100, pos: 140 }, dias: {} }, null, 2),
      "utf8"
    );
  }
}

function readDb() {
  ensureData();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return { nome: "", limites: { hipo: 70, pre: 100, pos: 140 }, dias: {} };
  }
}

function mediaPA(lista) {
  if (!lista || !lista.length) return { s: "", d: "", p: "" };
  var s = 0, d = 0, p = 0, np = 0;
  lista.forEach(function (m) {
    s += +m.s; d += +m.d;
    if (m.p != null) { p += +m.p; np++; }
  });
  return {
    s: Math.round(s / lista.length),
    d: Math.round(d / lista.length),
    p: np ? Math.round(p / np) : "",
  };
}

function csvCell(v) {
  var s = v == null ? "" : String(v);
  if (/[;"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toSheet(db) {
  var headers = [
    "data", "nome",
    "pressao_manha_sistolica", "pressao_manha_diastolica", "pressao_manha_pulso",
    "pressao_noite_sistolica", "pressao_noite_diastolica", "pressao_noite_pulso",
  ];
  GL_COLS.forEach(function (c) { headers.push(c[1]); });
  headers.push("anotacao");

  var dias = Object.keys(db.dias || {}).sort();
  var lines = ["\uFEFF" + headers.join(";")]; // BOM para Excel

  dias.forEach(function (k) {
    var dia = db.dias[k] || {};
    var pa = dia.pressao || {};
    var gl = dia.glicemia || {};
    var manha = mediaPA(pa.manha);
    var noite = mediaPA(pa.noite);
    var row = [
      k,
      db.nome || "",
      manha.s, manha.d, manha.p,
      noite.s, noite.d, noite.p,
    ];
    GL_COLS.forEach(function (c) {
      var g = gl[c[0]];
      row.push(g && g.v != null ? g.v : "");
    });
    row.push(dia.nota || "");
    lines.push(row.map(csvCell).join(";"));
  });

  return lines.join("\n") + "\n";
}

function writeDb(obj) {
  ensureData();
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);

  const sheet = toSheet(obj);
  const tmpSheet = SHEET_FILE + ".tmp";
  fs.writeFileSync(tmpSheet, sheet, "utf8");
  fs.renameSync(tmpSheet, SHEET_FILE);
}

function authOk(req) {
  if (!TOKEN) return true;
  const h = req.headers["x-caderneta-token"] || "";
  const q = new URL(req.url, "http://x").searchParams.get("token") || "";
  return h === TOKEN || q === TOKEN;
}

function send(res, code, body, type) {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": type || "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Caderneta-Token",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
      if (Buffer.concat(chunks).length > 2e6) {
        reject(new Error("payload grande demais"));
        req.destroy();
      }
    });
    req.on("end", function () {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  let file = pathname === "/" ? "/index.html" : pathname;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(ROOT, file);
  if (!full.startsWith(ROOT)) return send(res, 403, { error: "forbidden" });
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    return send(res, 404, { error: "não encontrado" });
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(full).pipe(res);
}

const server = http.createServer(async function (req, res) {
  const u = new URL(req.url, "http://localhost");
  const pathname = u.pathname;

  if (req.method === "OPTIONS") return send(res, 204, "");

  if (pathname === "/api/caderneta" || pathname === "/api/caderneta/") {
    if (!authOk(req)) return send(res, 401, { error: "não autorizado" });

    if (req.method === "GET") {
      return send(res, 200, readDb());
    }

    if (req.method === "PUT" || req.method === "POST") {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}");
        if (!body || typeof body !== "object") {
          return send(res, 400, { error: "JSON inválido" });
        }
        const db = {
          nome: String(body.nome || ""),
          limites: Object.assign({ hipo: 70, pre: 100, pos: 140 }, body.limites || {}),
          dias: body.dias && typeof body.dias === "object" ? body.dias : {},
          atualizadoEm: new Date().toISOString(),
        };
        writeDb(db);
        return send(res, 200, {
          ok: true,
          atualizadoEm: db.atualizadoEm,
          planilha: "/data/caderneta.csv",
        });
      } catch (e) {
        return send(res, 400, { error: e.message || "falha ao salvar" });
      }
    }

    return send(res, 405, { error: "método não permitido" });
  }

  if (pathname === "/api/caderneta.csv" || pathname === "/data/caderneta.csv") {
    if (!authOk(req)) return send(res, 401, { error: "não autorizado" });
    ensureData();
    if (!fs.existsSync(SHEET_FILE)) writeDb(readDb());
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="caderneta.csv"',
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    return fs.createReadStream(SHEET_FILE).pipe(res);
  }

  if (pathname === "/api/health") {
    return send(res, 200, { ok: true, file: DATA_FILE, planilha: SHEET_FILE });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return serveStatic(req, res, pathname);
  }

  send(res, 404, { error: "não encontrado" });
});

ensureData();
writeDb(readDb()); // garante a planilha CSV existir
server.listen(PORT, "0.0.0.0", function () {
  console.log("Caderneta rodando em http://0.0.0.0:" + PORT);
  console.log("JSON:     " + DATA_FILE);
  console.log("Planilha: " + SHEET_FILE);
  if (TOKEN) console.log("Token de acesso ativo (header X-Caderneta-Token)");
});
