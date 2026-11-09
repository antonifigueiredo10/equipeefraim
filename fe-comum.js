/* =====================================================================
   FÉ EM NEGÓCIOS · funções comuns da busca (guia do admin e guia dos assinantes)
   Usado por: negocios.html e fe-guia.html (depois do config.js)
   ===================================================================== */
const esc = s => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fone = d => d && d.length === 11 ? "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7)
               : d && d.length === 10 ? "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6) : (d || "");
const ramoBase = r => String(r || "").startsWith("Outro") ? "Outro" : r;
const fotoOk = p => /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.foto || "");

/* sinônimos simples: quem busca "grafica" acha "comunicação visual", "impressão" etc. */
const SINONIMOS = {
  grafica: ["grafica", "impressao", "comunicacao visual", "banner", "adesivo", "cartao"],
  advogado: ["advog", "juridic", "direito"], contador: ["contab", "contador", "fiscal"],
  mecanico: ["mecanic", "automotiv", "oficina"], pedreiro: ["construc", "reforma", "pedreiro", "obra"],
  bolo: ["bolo", "doce", "confeit", "aliment"], cabelo: ["cabel", "salao", "beleza", "barbe"],
  medico: ["medic", "saude", "clinica"], dentista: ["dentist", "odonto"], fotografo: ["fotograf", "foto", "video"],
  eletricista: ["eletric", "energia"], computador: ["informatic", "tecnologia", "computador", "sistema"]
};
function termosDe(q){
  return semAcento(q).split(/\s+/).filter(Boolean).map(t => {
    const k = Object.keys(SINONIMOS).find(s => t.startsWith(s.slice(0, 5)) || s.startsWith(t) && t.length >= 4);
    return k ? SINONIMOS[k] : [t];
  });
}
function textoDe(p){ return semAcento([p.nome, p.empresa, p.funcao, p.ramo, p.cidade, p.servicos, p.instagram, FE_VINCULOS[p.vinculo]].join(" ")); }
function bateBusca(p, q){ const g = termosDe(q); if(!g.length) return true; const t = textoDe(p); return g.every(x => x.some(y => t.includes(y))); }
/* destaca as palavras buscadas */
function marcar(txt, q){
  const h = esc(txt);
  const ts = semAcento(q).split(/\s+/).filter(t => t.length >= 2);
  if(!ts.length) return h;
  const base = semAcento(txt);
  const faixas = [];
  ts.forEach(t => { let i = base.indexOf(t); while(i >= 0){ faixas.push([i, i + t.length]); i = base.indexOf(t, i + t.length); } });
  if(!faixas.length) return h;
  faixas.sort((a, b) => a[0] - b[0]);
  let out = "", pos = 0;
  faixas.forEach(([a, b]) => { if(a < pos) return; out += esc(txt.slice(pos, a)) + "<mark>" + esc(txt.slice(a, b)) + "</mark>"; pos = b; });
  return out + esc(txt.slice(pos));
}
function linkInstagram(v){
  if(!v) return "";
  return /^https?:\/\//i.test(v) ? v : (/\./.test(v) && !v.startsWith("@") ? "https://" + v : "https://instagram.com/" + v.replace(/^@/, ""));
}
