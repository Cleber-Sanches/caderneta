/**
 * Caderneta — armazenamento na Planilha Google (Apps Script)
 *
 * Instalação: veja planilha/LEIAME.md
 * Propriedade do script obrigatória: TOKEN (a chave que o app envia)
 *
 * GET  ?token=...            → { ok, db }
 * POST {"token":..., "db":…} → { ok }
 */

var ABA_DADOS = "_dados";     // JSON completo, em pedaços (não editar à mão)
var ABA_LEITURA = "Medições"; // uma linha por medida, para ler e filtrar
var PEDACO = 40000;           // limite seguro de caracteres por célula

var GLICEMIA = [
  ["jejum", "Jejum"], ["posCafe", "2 h após o café"], ["preAlmoco", "Antes do almoço"],
  ["posAlmoco", "2 h após o almoço"], ["preJantar", "Antes do jantar"],
  ["posJantar", "2 h após o jantar"], ["aoDeitar", "Ao deitar"]
];

function doGet(e) {
  if (!autorizado(e.parameter.token)) return saida({ ok: false, erro: "chave inválida" });
  return saida({ ok: true, db: ler() });
}

function doPost(e) {
  var corpo;
  try { corpo = JSON.parse(e.postData.contents); } catch (err) { return saida({ ok: false, erro: "corpo inválido" }); }
  if (!autorizado(corpo.token)) return saida({ ok: false, erro: "chave inválida" });
  if (!corpo.db || typeof corpo.db.dias !== "object") return saida({ ok: false, erro: "dados inválidos" });
  var trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try { gravar(corpo.db); } finally { trava.releaseLock(); }
  return saida({ ok: true });
}

function autorizado(t) {
  var chave = PropertiesService.getScriptProperties().getProperty("TOKEN");
  return !!chave && t === chave;
}

function saida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function aba(nome) {
  var ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(nome) || ss.insertSheet(nome);
}

function ler() {
  var sh = aba(ABA_DADOS), n = sh.getLastRow();
  if (!n) return null;
  var txt = sh.getRange(1, 1, n, 1).getValues().map(function (r) { return r[0]; }).join("");
  return txt ? JSON.parse(txt) : null;
}

function gravar(db) {
  var txt = JSON.stringify(db), partes = [];
  for (var i = 0; i < txt.length; i += PEDACO) partes.push([txt.slice(i, i + PEDACO)]);
  var sh = aba(ABA_DADOS);
  sh.clearContents();
  sh.getRange(1, 1, partes.length, 1).setNumberFormat("@").setValues(partes);
  if (!sh.isSheetHidden()) sh.hideSheet();
  planilhaLegivel(db);
}

function planilhaLegivel(db) {
  var linhas = [];
  Object.keys(db.dias).sort().forEach(function (k) {
    var d = db.dias[k] || {}, p = d.pressao || {}, g = d.glicemia || {};
    [["manha", "Manhã"], ["noite", "Noite"]].forEach(function (per) {
      (p[per[0]] || []).forEach(function (m) {
        linhas.push([k, "Pressão", per[1], m.t || "", m.s, m.d, m.p == null ? "" : m.p, "", ""]);
      });
    });
    GLICEMIA.forEach(function (x) {
      var v = g[x[0]]; if (v == null) return;
      var obj = typeof v === "object";
      linhas.push([k, "Glicemia", x[1], obj ? (v.t || "") : "", "", "", "", obj ? v.v : v, ""]);
    });
    if (d.nota) linhas.push([k, "Anotação", "", "", "", "", "", "", d.nota]);
  });
  var sh = aba(ABA_LEITURA);
  sh.clearContents();
  var cab = [["data", "tipo", "período / momento", "hora", "sistólica", "diastólica", "pulso", "glicemia (mg/dL)", "anotação"]];
  sh.getRange(1, 1, 1, cab[0].length).setValues(cab).setFontWeight("bold");
  sh.setFrozenRows(1);
  if (linhas.length) sh.getRange(2, 1, linhas.length, cab[0].length).setValues(linhas);
}
