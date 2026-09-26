/* =====================================================================
   EQUIPE EFRAIM — Configuração e controle de acesso (arquivo único)
   Usado por: login.html, index.html, escala.html
   =====================================================================

   ⚙️  EDITE APENAS AS DUAS LINHAS ABAIXO.
   Cole os valores de: Supabase → Project Settings → Data API
   ===================================================================== */

const SUPABASE_URL      = "https://clqexwccsfdecsqtggbg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscWV4d2Njc2ZkZWNzcXRnZ2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3ODA3NTAsImV4cCI6MjEwMzM1Njc1MH0.5TdEH8KBspbPgt-S1K6SwWqdCmmn_lm2UUXb_ma8fEQ";

/* A lista de nomes NÃO fica mais neste arquivo: ela vem do banco.
   Para incluir ou tirar alguém, use o PAINEL → aba OBREIROS, no site. */
let NOMES = [];

/* ===================== daqui para baixo, não precisa mexer ===================== */

const CONFIGURADO = SUPABASE_URL.startsWith("https://");
const DOMINIO_INTERNO = "equipeefraim.com.br";

/* O obreiro nunca vê este e-mail — ele só escolhe o nome e digita a senha.
   O e-mail interno serve apenas de identificador único dentro do Supabase. */
function emailDe(nome){
  const s = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  return s + "@" + DOMINIO_INTERNO;
}

const sb = CONFIGURADO
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "efraim-sessao" }
    })
  : null;

let SESSAO = null;   // sessão do Supabase Auth
let PERFIL = null;   // { nome, papel, status }  papel = 'obreiro' | 'lider' · status = 'pendente' | 'ativo' | 'bloqueado'

const EH_LIDER = () => PERFIL && PERFIL.papel === "lider";

/* Guardião: chame no topo de toda página protegida.
   Se não houver sessão válida, manda para o login e devolve null. */
async function exigirLogin(){
  if(!CONFIGURADO){ location.replace("login.html"); return null; }

  const { data: { session } } = await sb.auth.getSession();
  if(!session){
    const destino = location.pathname.split("/").pop() || "index.html";
    location.replace("login.html?destino=" + encodeURIComponent(destino));
    return null;
  }
  SESSAO = session;

  const { data, error } = await sb.from("perfis")
    .select("nome,papel,status,foto_em").eq("id", session.user.id).single();

  if(error || !data){ await sb.auth.signOut(); location.replace("login.html"); return null; }

  /* Acesso precisa ser LIBERADO pela liderança (o banco também confere) */
  if(data.status && data.status !== "ativo"){
    await sb.auth.signOut();
    location.replace("login.html?aviso=" + data.status);
    return null;
  }

  PERFIL = data;
  document.documentElement.classList.add("logado");
  return PERFIL;
}

async function sair(){
  if(sb) await sb.auth.signOut();
  location.replace("login.html");
}

/* Busca a lista de nomes no banco (view "pessoas" — só o nome, sem código).
   Funciona antes do login, para montar o menu da tela de entrada.
   A ordem vem do banco: é a sequência do rodízio do plano devocional. */
async function carregarNomes(){
  if(!CONFIGURADO) return [];
  const { data, error } = await sb.from("pessoas").select("nome,ordem").order("ordem", { nullsFirst: false });
  if(error || !data) return [];
  NOMES = data.map(p => p.nome);
  return NOMES;
}

/* Ponte para a função de administração, que roda no servidor do Supabase.
   Só responde a quem tem papel de liderança — a checagem é lá, não aqui. */
async function chamarAdmin(acao, dados = {}){
  const { data: { session } } = await sb.auth.getSession();
  if(!session) throw new Error("SEM_SESSAO");

  const r = await fetch(SUPABASE_URL + "/functions/v1/admin-efraim", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + session.access_token,
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ acao, ...dados })
  });

  const resposta = await r.json().catch(() => ({ erro: "RESPOSTA_INVALIDA" }));
  if(!r.ok || resposta.erro) throw new Error(resposta.erro || ("HTTP " + r.status));
  return resposta;
}

/* Barra fina no topo: foto, nome de quem está logado e o botão Sair */
function montarBarraUsuario(){
  const barra = document.createElement("div");
  barra.id = "barra-usuario";
  barra.innerHTML =
    '<span class="quem-sou">' +
      '<button type="button" id="minha-foto" class="avatar" title="Trocar minha foto" onclick="escolherFoto()">' + iniciais(PERFIL.nome) + '</button>' +
      '<b>' + PERFIL.nome + '</b>' +
      (EH_LIDER() ? ' <i>· liderança</i>' : '') +
    '</span>' +
    '<span class="acoes-barra">' +
      '<button type="button" onclick="sair()">Sair</button>' +
    '</span>';
  document.body.insertBefore(barra, document.body.firstChild);
  carregarMinhaFoto();
  montarNavInferior();
  setTimeout(avisosAutomatico, 900);
}

/* ======================= ÍCONES COLORIDOS + BARRA INFERIOR =======================
   Ícones desenhados em SVG (coloridos, iguais em qualquer celular). */
const ICONES_COR = {
  inicio:'<path d="M8 22 24 8l16 14v18a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#FBD5B0"/><path d="M4 23 24 6l20 17-3 3L24 11 7 26z" fill="#E8553B"/><rect x="20" y="28" width="8" height="14" rx="1" fill="#8B5A3C"/><rect x="11" y="26" width="6" height="6" rx="1" fill="#4FA3E8"/><rect x="31" y="26" width="6" height="6" rx="1" fill="#4FA3E8"/>',
  devocional:'<path d="M6 10c6-2 12-1 18 3v27c-6-4-12-5-18-3z" fill="#8E6CFF"/><path d="M42 10c-6-2-12-1-18 3v27c6-4 12-5 18-3z" fill="#6A4BE0"/><path d="M9 13c5-1 10 0 14 3v21c-4-3-9-4-14-3z" fill="#fff"/><path d="M39 13c-5-1-10 0-14 3v21c4-3 9-4 14-3z" fill="#EDE8FF"/><path d="M30 12v12l3-2 3 2V11z" fill="#F0834A"/>',
  celulas:'<path d="M4 14l12-5 16 5 12-5v26l-12 5-16-5-12 5z" fill="#BFE8CF"/><path d="M16 9v26l16 5V14z" fill="#8FD3A8"/><path d="M24 4a9 9 0 0 0-9 9c0 7 9 16 9 16s9-9 9-16a9 9 0 0 0-9-9z" fill="#E8453B"/><circle cx="24" cy="13" r="3.5" fill="#fff"/>',
  lembrete:'<path d="M24 6a12 12 0 0 0-12 12v8l-4 6h32l-4-6v-8A12 12 0 0 0 24 6z" fill="#F7C23C"/><path d="M8 32h32v3H8z" fill="#E0A31F"/><circle cx="24" cy="39" r="4" fill="#E0A31F"/><path d="M17 16a8 8 0 0 1 5-6" stroke="#FFE59A" stroke-width="3" stroke-linecap="round" fill="none"/>',
  perfil:'<circle cx="24" cy="24" r="20" fill="#4FA3E8"/><circle cx="24" cy="19" r="7" fill="#FBD5B0"/><path d="M11 37c3-6 8-9 13-9s10 3 13 9a20 20 0 0 1-26 0z" fill="#2D6FB8"/>',
  escala:'<rect x="10" y="8" width="28" height="36" rx="3" fill="#C98B5A"/><rect x="13" y="12" width="22" height="29" rx="2" fill="#fff"/><rect x="18" y="5" width="12" height="7" rx="2" fill="#7A7A85"/><path d="M17 20h14M17 26h14M17 32h9" stroke="#9AA0A8" stroke-width="2.5" stroke-linecap="round"/><path d="m29 32 2 2 4-4" stroke="#3DBB7A" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
  todos:'<circle cx="17" cy="17" r="6" fill="#FBD5B0"/><path d="M5 38c1-7 6-11 12-11s11 4 12 11z" fill="#8E6CFF"/><circle cx="32" cy="17" r="6" fill="#F2C49B"/><path d="M22 38c1-7 5-11 10-11s10 4 11 11z" fill="#F0834A"/>',
  calendario:'<rect x="6" y="9" width="36" height="33" rx="4" fill="#fff"/><path d="M6 13a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v7H6z" fill="#E8553B"/><rect x="14" y="5" width="4" height="9" rx="2" fill="#7A7A85"/><rect x="30" y="5" width="4" height="9" rx="2" fill="#7A7A85"/><rect x="12" y="25" width="6" height="5" rx="1" fill="#F0834A"/><rect x="21" y="25" width="6" height="5" rx="1" fill="#D5D8DE"/><rect x="30" y="25" width="6" height="5" rx="1" fill="#D5D8DE"/><rect x="12" y="33" width="6" height="5" rx="1" fill="#D5D8DE"/><rect x="21" y="33" width="6" height="5" rx="1" fill="#D5D8DE"/>'
};
function iconeCor(n){ return '<svg viewBox="0 0 48 48" aria-hidden="true">' + (ICONES_COR[n] || "") + '</svg>'; }

function montarNavInferior(){
  if(document.getElementById("nav-inferior")) return;
  const pag = location.pathname.split("/").pop() || "index.html";
  const itens = EH_LIDER()
    ? [["inicio","Início","index.html"],["devocional","Devocional","devocional.html"],["celulas","Células","celulas.html"],["escala","Escala","escala.html"],["perfil","Perfil",""]]
    : [["inicio","Início","devocional.html"],["devocional","Plano","devocional.html#todos"],["celulas","Células","celulas.html"],["escala","Escala","escala.html"],["perfil","Perfil",""]];
  const nav = document.createElement("nav");
  nav.id = "nav-inferior";
  nav.innerHTML = itens.map(([ic, rot, href]) => {
    const alvo = href.split("#")[0];
    const ativo = (!href.includes("#") && alvo === pag && ic !== "perfil");
    return '<a class="ni' + (ativo ? " ativo" : "") + '" data-ic="' + ic + '" href="' + (href || "#perfil") + '">' +
           '<span class="ni-ic">' + iconeCor(ic) + '</span><span class="ni-rot">' + rot + '</span></a>';
  }).join("");
  nav.querySelector('[data-ic="perfil"]').onclick = e => { e.preventDefault(); abrirPerfil(); };
  document.body.appendChild(nav);
  document.body.classList.add("com-nav");
}

function abrirPerfil(){
  const cx = document.createElement("div");
  cx.id = "folha-perfil";
  cx.innerHTML =
    '<div class="fp-caixa">' +
      '<div class="avatar grande" id="fp-foto">' + (document.querySelector("#minha-foto img") ? document.getElementById("minha-foto").innerHTML : iniciais(PERFIL.nome)) + '</div>' +
      '<h3>' + PERFIL.nome + '</h3>' +
      '<div class="fp-papel">' + (EH_LIDER() ? "Liderança" : "Obreiro(a)") + ' · Equipe Efraim</div>' +
      '<button type="button" class="fp-op" data-a="foto"><span>' + iconeCor("perfil") + '</span>Trocar minha foto</button>' +
      '<button type="button" class="fp-op" data-a="avisos"><span>' + iconeCor("lembrete") + '</span><i class="fp-av">Avisos do devocional</i></button>' +
      '<a class="fp-op" href="celulas.html"><span>' + iconeCor("celulas") + '</span>Mapa de células</a>' +
      '<button type="button" class="fp-sair" data-a="sair">Sair do app</button>' +
    '</div>';
  cx.onclick = e => {
    const a = e.target.closest("[data-a]");
    if(e.target === cx){ cx.remove(); return; }
    if(a && a.dataset.a === "foto"){ cx.remove(); escolherFoto(); }
    if(a && a.dataset.a === "sair"){ sair(); }
    if(a && a.dataset.a === "avisos"){ alternarAvisos(a); }
  };
  document.body.appendChild(cx);
  rotuloAvisos(cx.querySelector('[data-a="avisos"]'));
}

/* Página inicial: liderança = painel (index); obreiro = devocional */
function paginaHome(){ return EH_LIDER() ? "index.html" : "devocional.html"; }
function estouNaHome(){
  const atual = location.pathname.split("/").pop() || "index.html";
  return atual === paginaHome();
}

/* ======================= FOTO DE PERFIL =======================
   Bucket privado "fotos" no Supabase, arquivo <id do usuário>.jpg.
   A foto é reduzida no próprio celular (400x400, JPEG) antes de enviar. */
function iniciais(nome){
  return (nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

/* Links temporários (1 h) para várias fotos de uma vez: { userId: url } */
async function urlsDeFotos(ids){
  const lista = (ids || []).filter(Boolean);
  if(!lista.length) return {};
  const { data } = await sb.storage.from("fotos").createSignedUrls(lista.map(id => id + ".jpg"), 3600);
  const mapa = {};
  (data || []).forEach(d => { if(d.signedUrl) mapa[d.path.replace(/\.jpg$/, "")] = d.signedUrl; });
  return mapa;
}

function pintarAvatar(el, url, nome){
  if(!el) return;
  el.innerHTML = url ? '<img alt="" src="' + url + '">' : iniciais(nome);
}

async function carregarMinhaFoto(){
  const el = document.getElementById("minha-foto");
  if(PERFIL.foto_em){
    const m = await urlsDeFotos([SESSAO.user.id]);
    pintarAvatar(el, m[SESSAO.user.id], PERFIL.nome);
  }else{
    convidarFoto();
  }
}

/* Na entrada, quem ainda não tem foto recebe o convite (uma vez por dia no máximo) */
function convidarFoto(){
  const chave = "efraim-foto-adiada-" + SESSAO.user.id;
  try{ const t = +localStorage.getItem(chave); if(t && Date.now() - t < 864e5) return; }catch(e){}
  const cx = document.createElement("div");
  cx.id = "convite-foto";
  cx.innerHTML =
    '<div class="caixa-foto">' +
      '<div class="avatar grande">' + iniciais(PERFIL.nome) + '</div>' +
      '<h3>Coloque sua foto, ' + PERFIL.nome.split(" ")[0] + '!</h3>' +
      '<p>Assim a liderança e a equipe reconhecem você.</p>' +
      '<button type="button" class="sim" onclick="escolherFoto()">📷 ESCOLHER FOTO</button>' +
      '<button type="button" class="depois">agora não</button>' +
    '</div>';
  cx.querySelector(".depois").onclick = () => {
    try{ localStorage.setItem(chave, String(Date.now())); }catch(e){}
    cx.remove();
  };
  document.body.appendChild(cx);
}

function escolherFoto(){
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.onchange = () => { if(inp.files[0]) enviarFoto(inp.files[0]); };
  inp.click();
}

/* Recorta no centro, reduz para 400x400 e envia */
async function enviarFoto(arquivo){
  const el = document.getElementById("minha-foto");
  const convite = document.getElementById("convite-foto");
  if(convite) convite.querySelector("h3").textContent = "Enviando sua foto...";
  try{
    const img = await new Promise((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error("IMAGEM_INVALIDA"));
      i.src = URL.createObjectURL(arquivo);
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const cv = document.createElement("canvas");
    cv.width = cv.height = 400;
    cv.getContext("2d").drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 400, 400);
    const blob = await new Promise(ok => cv.toBlob(ok, "image/jpeg", 0.85));

    const { error } = await sb.storage.from("fotos")
      .upload(SESSAO.user.id + ".jpg", blob, { upsert: true, contentType: "image/jpeg", cacheControl: "60" });
    if(error) throw error;
    await sb.rpc("marcar_foto", { p_tem: true });
    PERFIL.foto_em = new Date().toISOString();

    const m = await urlsDeFotos([SESSAO.user.id]);
    pintarAvatar(el, m[SESSAO.user.id], PERFIL.nome);
    if(convite) convite.remove();
    if(typeof aoTrocarFoto === "function") aoTrocarFoto();
  }catch(e){
    if(convite) convite.querySelector("h3").textContent = "Não deu certo. Tente outra foto.";
    else alert("Não foi possível enviar a foto. Tente outra imagem.");
  }
}

/* ======================= CÉLULAS PERTO DE MIM =======================
   Tabela "celulas" no Supabase (só quem está liberado lê).
   A localização do obreiro fica só no aparelho dele — nada é gravado. */
let CELULAS = null;
async function carregarCelulas(){
  if(CELULAS) return CELULAS;
  const { data, error } = await sb.from("celulas").select("*").eq("ativa", true).order("nome");
  if(error) throw error;
  CELULAS = data || [];
  return CELULAS;
}

function distKm(a, b, c, d){
  const r = x => x * Math.PI / 180, R = 6371;
  const dLat = r(c - a), dLng = r(d - b);
  const h = Math.sin(dLat/2)**2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function textoDist(km){
  return km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1).replace(".", ",") + " km";
}
function linkRota(c){
  return "https://www.google.com/maps/dir/?api=1&destination=" + c.lat + "," + c.lng;
}

/* Pede a localização (o navegador mostra o pedido de permissão).
   Guarda a última posição por 10 min para não perguntar a cada página. */
function pegarLocalizacao(forcar){
  return new Promise((ok, erro) => {
    try{
      const g = JSON.parse(sessionStorage.getItem("efraim-local") || "null");
      if(!forcar && g && Date.now() - g.t < 6e5) return ok(g);
    }catch(e){}
    if(!navigator.geolocation) return erro(new Error("SEM_GPS"));
    navigator.geolocation.getCurrentPosition(
      p => {
        const g = { lat: p.coords.latitude, lng: p.coords.longitude, t: Date.now() };
        try{ sessionStorage.setItem("efraim-local", JSON.stringify(g)); }catch(e){}
        ok(g);
      },
      e => erro(e),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
    );
  });
}

function ordenarPorDistancia(lista, pos){
  return lista.map(c => ({ ...c, km: distKm(pos.lat, pos.lng, c.lat, c.lng) })).sort((a, b) => a.km - b.km);
}

/* Caixa "Células perto de você" para a página inicial */
async function montarBoxCelulas(el, quantas = 3){
  if(!el) return;
  el.className = "box-celulas";
  el.innerHTML = '<div class="bc-tit">📍 Células perto de você</div><div class="bc-corpo">procurando sua localização...</div>' +
                 '<a class="bc-mapa" href="celulas.html">🗺️ VER MAPA DE CÉLULAS</a>';
  const corpo = el.querySelector(".bc-corpo");
  let lista;
  try{ lista = await carregarCelulas(); }
  catch(e){ corpo.textContent = "Não foi possível carregar as células agora."; return; }
  try{
    const pos = await pegarLocalizacao();
    const perto = ordenarPorDistancia(lista, pos).slice(0, quantas);
    corpo.innerHTML = perto.map(c =>
      '<div class="bc-item">' +
        '<div class="bc-km">' + textoDist(c.km) + '</div>' +
        '<div class="bc-info"><b>' + c.nome + '</b><span>' + (c.bairro || "") + ' · ' + (c.dia || "") + ' ' + (c.horario || "") + '</span></div>' +
        '<a class="bc-ir" href="' + linkRota(c) + '" target="_blank" rel="noopener">ir</a>' +
      '</div>').join("");
  }catch(e){
    corpo.innerHTML = '<p>Para mostrar as células mais próximas, o app precisa da sua localização.</p>' +
      '<button type="button" class="bc-permitir">📍 PERMITIR LOCALIZAÇÃO</button>' +
      (e && e.code === 1 ? '<small>Se você já recusou antes, libere nas configurações do navegador (cadeado ao lado do endereço).</small>' : '');
    corpo.querySelector(".bc-permitir").onclick = async () => {
      try{ await pegarLocalizacao(true); montarBoxCelulas(el, quantas); }
      catch(e2){ corpo.querySelector("small") || corpo.insertAdjacentHTML("beforeend", '<small>Localização bloqueada. Libere nas configurações do navegador (cadeado ao lado do endereço) e toque de novo.</small>'); }
    };
  }
}

/* ======================= ESCALA DA SEMANA (dados) =======================
   Usada por escala.html (a escala em si), devocional.html (o obreiro diz se vai
   servir) e index.html (quadro de respostas da liderança). Para publicar a
   próxima escala, troque a lista abaixo: é a mesma do Excel/PDF gerados na
   pasta ALIANÇADOS. */
const UNI_NOITE = "Camiseta de servo + colete + calça jeans ou preta + tênis/sapato fechado baixo";
const UNI_MANHA = "Camiseta de servo + calça jeans ou preta + tênis/sapato fechado baixo";
const G_ESQ = "Lateral esquerda · portas de entrada";
const G_DIR = "Lateral direita · banheiro e mesa de apoio";

const ESCALAS = [
  { data:"2026-10-04", hora:"18h00", inicio:18, dia:"Domingo", curto:"DOM", culto:"Culto da Família", chegada:"17h00", uniforme:UNI_NOITE,
    grupos:[
      ["Funções", [
        ["Mesa de apoio / Máquinas e envelopes", "Hamilton e Miss Layne (casal)", "Conferir e carregar as máquinas, bobinas e envelopes. Recolher após o culto."],
        ["Reservados", "Letícia e Laura", "Cadeiras da frente e dos levitas. Recolher após o culto."],
        ["Bebedouros e corredor", "Jaqueline e Marco Maia", "Copos, secar a água, circulação para as salas restritas."],
        ["Caixa da primícia", "Valéria", "Após o ofertório, entregar à liderança."],
        ["Máquinas da primícia", "Hamilton"],
        ["Máquina de ofertório para os pastores no altar", "Kátia"],
        ["Ofertório", "TODOS", "Cada um atende o lado em que está. Ao terminar, ajuda o outro lado."],
        ["Gazofilácio em frente ao altar", "Lado D: Felipe Bianchezzi · Lado E: Denilson", "Quem está no gazofilácio não passa máquina nem envelope."],
        ["Gazofilácio no meio da igreja (pilar)", "Lado D: Igor · Lado E: José Eduardo"],
        ["Banheiro feminino", "Dri Gamarra e Simone", "Orientar crianças e visitantes, repor insumos, recolher os lixos."],
        ["Banheiro masculino", "Marco Maia e Jesus"],
        ["Organização do templo", "TODOS", "Alinhar cadeiras, recolher lixos e envelopes, cortinas, ar, portas e luzes."],
        ["Organização da sala dos obreiros", "Liderança"],
        ["Oração final", "TODOS"]
      ]],
      [G_ESQ, [
        ["Porta da frente / meio", "Antônio e Laura (casal)"],
        ["Porta da frente / primeira", "Jugleyde Pompeo, Martina Mendes e Milene"],
        ["Porta do fundo", "Alessandra, Daiane Colman e Renata"],
        ["Fundos", "Kátia e Jhuli"]
      ]],
      [G_DIR, [
        ["Mesa de apoio / banheiro", "Clebson, José Luis e Marina Corrêa (casal), Jaqueline e Marco Maia"],
        ["Em frente ao altar", "Jackson e Thays (casal)"],
        ["Meio para o fundo", "Reinaldo e Cristiane (casal), Valéria"]
      ]]
    ]},
  { data:"2026-10-07", hora:"19h30", inicio:19.5, dia:"Quarta-feira", curto:"QUA", culto:"Quarta Profética", chegada:"18h30", uniforme:UNI_NOITE,
    grupos:[
      ["Funções", [
        ["Acompanhar o pregador da noite", "Reinaldo e Cristiane (casal)", "Do gabinete ao altar no início e do altar à saída no final."],
        ["Púlpito", "Igor e Jesus", "Colocar e retirar ao sinal do backstage."],
        ["Mesa de apoio / Máquinas e envelopes", "José Luis e Marina Corrêa (casal)", "Conferir e carregar as máquinas, bobinas e envelopes. Recolher após o culto."],
        ["Reservados", "Letícia e Laura", "Cadeiras da frente e dos levitas. Recolher após o culto."],
        ["Bebedouros e corredor", "José Eduardo e Simone", "Copos, secar a água, circulação para as salas restritas."],
        ["Nave da igreja: microfone e mão no coração", "Hamilton e Miss Layne (casal), Jackson e Thays (casal)", "Obreiras com as mulheres, obreiros com os homens."],
        ["Organizar as pessoas embaixo do altar em fileiras e baldes", "TODOS"],
        ["Ofertório", "TODOS", "Cada um atende o lado em que está. Ao terminar, ajuda o outro lado."],
        ["Máquina de ofertório para os pastores no altar", "Kátia"],
        ["Caixa da primícia", "Jugleyde Pompeo", "Após o ofertório, entregar à liderança."],
        ["Gazofilácio em frente ao altar", "Lado D: Denilson · Lado E: Felipe Bianchezzi", "Quem está no gazofilácio não passa máquina nem envelope."],
        ["Gazofilácio no meio da igreja (pilar)", "Lado D: Marco Maia · Lado E: Igor"],
        ["Banheiro feminino", "Daiane Colman e Renata", "Orientar crianças e visitantes, repor insumos, recolher os lixos."],
        ["Banheiro masculino", "Jesus e Felipe Bianchezzi"],
        ["Apelo", "TODOS", "Acompanhar e, se preciso, anotar nomes. Homem acompanha homem, mulher acompanha mulher."],
        ["Organização do templo", "TODOS", "Alinhar cadeiras, recolher lixos e envelopes, cortinas, ar, portas e luzes."],
        ["Oração final", "TODOS"]
      ]],
      [G_ESQ, [
        ["Porta da frente / meio", "Antônio e Laura (casal)"],
        ["Porta do fundo", "Alessandra, Martina Mendes e Milene"],
        ["Meio para o fundo", "Dri Gamarra e Jhuli"]
      ]],
      [G_DIR, [
        ["Mesa de apoio / banheiro", "Clebson e Letícia (casal)"],
        ["Em frente ao altar", "Valéria e Jaqueline"],
        ["Meio para o fundo", "Reinaldo e Cristiane (casal)"]
      ]]
    ]},
  { data:"2026-10-11", hora:"9h00", inicio:9, dia:"Domingo", curto:"DOM", culto:"Culto da Família (manhã)", chegada:"8h00", uniforme:UNI_MANHA,
    grupos:[
      ["Funções", [
        ["Mesa de apoio / Máquinas e envelopes", "Clebson e Letícia (casal)", "Conferir e carregar as máquinas, bobinas e envelopes. Recolher após o culto."],
        ["Reservados", "Laura", "Cadeiras da frente e dos levitas. Recolher após o culto."],
        ["Bebedouros e corredor", "Jackson e Thays (casal)", "Copos, secar a água, circulação para as salas restritas."],
        ["Caixa da primícia", "Miss Layne", "Após o ofertório, entregar à liderança."],
        ["Máquinas da primícia", "Hamilton"],
        ["Máquina de ofertório para os pastores no altar", "Kátia"],
        ["Ofertório", "TODOS", "No culto de Santa Ceia há oferta missionária no final."],
        ["Gazofilácio em frente ao altar", "Lado D: Jesus · Lado E: José Eduardo", "Quem está no gazofilácio não passa máquina nem envelope."],
        ["Gazofilácio no meio da igreja (pilar)", "Lado D: Igor · Lado E: Denilson"],
        ["Banheiro feminino", "Dri Gamarra e Jhuli", "Orientar crianças e visitantes, repor insumos, recolher os lixos."],
        ["Banheiro masculino", "Felipe Bianchezzi e Marco Maia"],
        ["Organização do templo", "TODOS", "Alinhar cadeiras, recolher lixos e envelopes, cortinas, ar, portas e luzes."],
        ["Organização da sala dos obreiros", "Liderança"],
        ["Oração final", "TODOS"]
      ]],
      [G_ESQ, [
        ["Frente", "Antônio e Laura (casal), Martina Mendes"],
        ["Meio para o fundo", "Alessandra, Simone e Milene"]
      ]],
      [G_DIR, [
        ["Frente", "José Luis e Marina Corrêa (casal), Jugleyde Pompeo e Jaqueline"],
        ["Meio para o fundo", "Reinaldo e Cristiane (casal), Daiane Colman, Valéria e Renata"],
        ["Cortinas", "Liderança", "Abrir as cortinas conforme a demanda."]
      ]]
    ]}
];


/* Datas em que a equipe serve, para a disponibilidade */
function datasDaEscala(){ return ESCALAS.map(c => c.data); }
function cultoDaData(iso){ return ESCALAS.find(c => c.data === iso) || null; }

/* ======================= LEMBRETE (PUSH) DO DEVOCIONAL =======================
   No dia da leitura, o obreiro recebe uma notificação às 07:00 e, se ainda não
   marcou como lida, outra às 20:00. Quem envia é a Edge Function push-devocional. */
const VAPID_PUBLICA = "BL42ys-5soV1oPjjGSQrg2ZwtTXWuPC1vLIgxUoVR9MbLDJGAzZFFOwQ37IK23VmC1esDAX4-iPKZeCWeu5NjKY";

function b64paraU8(b64){
  const p = "=".repeat((4 - b64.length % 4) % 4);
  const s = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}
function ehIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
function ehApp(){ return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; }

async function registrarSW(){
  if(!("serviceWorker" in navigator)) return null;
  try{ return await navigator.serviceWorker.register("/sw.js"); }catch(e){ return null; }
}

/* 'ativo' | 'inativo' | 'negado' | 'ios-instalar' | 'sem-suporte' */
async function estadoPush(){
  if(ehIOS() && !ehApp()) return "ios-instalar";
  if(!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "sem-suporte";
  if(Notification.permission === "denied") return "negado";
  const reg = await registrarSW();
  const sub = reg && await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "ativo" : "inativo";
}

async function salvarInscricao(sub){
  const j = sub.toJSON();
  const { error } = await sb.from("push_inscricoes").upsert({
    endpoint: j.endpoint, user_id: SESSAO.user.id, p256dh: j.keys.p256dh, auth: j.keys.auth
  }, { onConflict: "endpoint" });
  if(error) throw error;
}

async function ativarPush(){
  const perm = await Notification.requestPermission();
  if(perm !== "granted") throw new Error("NEGADO");
  const reg = await registrarSW();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64paraU8(VAPID_PUBLICA) });
  await salvarInscricao(sub);
  /* notificação de teste, para a pessoa ver que funcionou */
  const { data: { session } } = await sb.auth.getSession();
  await fetch(SUPABASE_URL + "/functions/v1/push-devocional", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token, "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ tipo: "teste" })
  }).catch(() => {});
}

async function desativarPush(){
  const reg = await registrarSW();
  const sub = reg && await reg.pushManager.getSubscription();
  if(sub){
    await sb.from("push_inscricoes").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

/* ======================= AVISOS DO DEVOCIONAL (pedidos sozinhos) =======================
   Não existe mais a caixa "Lembrete" na tela. Ao abrir o app instalado (ou o site no
   Android), o próprio app pede a permissão de aviso. No iPhone o pedido só pode sair de
   um toque, então aparece uma tela com um botão só. Ligar/desligar fica em Perfil. */
function avisosAdiado(){
  try{ const t = +localStorage.getItem("efraim-avisos-adiado"); return t && Date.now() - t < 864e5; }catch(e){ return false; }
}
async function avisosAutomatico(){
  try{
    const estado = await estadoPush();
    if(estado === "ativo"){   /* aparelho já inscrito: renova a inscrição no banco sem perguntar nada */
      const reg = await registrarSW(); const sub = reg && await reg.pushManager.getSubscription();
      if(sub) salvarInscricao(sub).catch(() => {});
      return;
    }
    if(estado !== "inativo") return;                          /* bloqueado, sem suporte ou iPhone sem instalar */
    if(Notification.permission === "granted"){ await ativarPush(); return; }   /* já permitido: só refaz a inscrição */
    if(avisosAdiado()) return;
    if(!ehIOS()){                                             /* Android: pede direto, sem toque */
      try{ await ativarPush(); return; }
      catch(e){ if(Notification.permission === "denied") return; }
    }
    mostrarPedidoAvisos();                                    /* iPhone instalado (ou pedido que não abriu): tela com um botão */
  }catch(e){}
}
function mostrarPedidoAvisos(){
  if(document.getElementById("pedido-avisos")) return;
  const cx = document.createElement("div");
  cx.id = "pedido-avisos";
  cx.innerHTML =
    '<div class="pa-caixa"><img src="/icon-192.png" alt="">' +
      '<h3>Avisos do devocional</h3>' +
      '<p>No dia da sua leitura o app te avisa às 7h e, se ainda não tiver marcado como lida, às 20h.<br>Toque abaixo e depois em <b>Permitir</b> na pergunta do celular.</p>' +
      '<button type="button" class="pa-sim">🔔 PERMITIR AVISOS</button>' +
      '<button type="button" class="pa-depois">agora não</button>' +
    '</div>';
  cx.querySelector(".pa-depois").onclick = () => { try{ localStorage.setItem("efraim-avisos-adiado", String(Date.now())); }catch(e){} cx.remove(); };
  cx.querySelector(".pa-sim").onclick = async function(){
    this.disabled = true; this.textContent = "ativando...";
    try{ await ativarPush(); cx.remove(); }
    catch(e){
      this.disabled = false; this.textContent = "🔔 PERMITIR AVISOS";
      cx.querySelector("p").innerHTML = e.message === "NEGADO"
        ? "Você não permitiu. Para ligar depois: <b>Perfil</b> → Avisos do devocional."
        : "Não deu certo agora. Tente de novo.";
    }
  };
  document.body.appendChild(cx);
}
/* Perfil: liga/desliga os avisos deste aparelho */
async function rotuloAvisos(el){
  if(!el) return;
  const i = el.querySelector(".fp-av");
  const estado = await estadoPush();
  const txt = { "ativo":"Avisos do devocional · ligados", "inativo":"Avisos do devocional · desligados",
                "negado":"Avisos bloqueados no celular", "ios-instalar":"Avisos: instale o app na Tela de Início",
                "sem-suporte":"Avisos: navegador sem suporte" };
  i.textContent = txt[estado] || "Avisos do devocional";
  el.dataset.estado = estado;
}
async function alternarAvisos(el){
  const i = el.querySelector(".fp-av");
  try{
    if(el.dataset.estado === "ativo"){ i.textContent = "desligando..."; await desativarPush(); }
    else if(el.dataset.estado === "inativo"){ i.textContent = "ativando..."; await ativarPush(); }
    else return;
  }catch(e){ i.textContent = e.message === "NEGADO" ? "Você não permitiu os avisos" : "Não deu certo agora"; return; }
  rotuloAvisos(el);
}

/* ======================= INSTALAR O APP (TELA INICIAL) =======================
   Ao abrir o site pelo navegador, aparece uma faixa para instalar o app.
   Android/Chrome: botão INSTALAR abre o pedido do próprio sistema.
   iPhone: mostra o passo a passo (Compartilhar → Adicionar à Tela de Início). */
let EVENTO_INSTALAR = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); EVENTO_INSTALAR = e; mostrarInstalar(); });
window.addEventListener("appinstalled", () => { const f = document.getElementById("faixa-instalar"); if(f) f.remove(); avisosAutomatico(); });

function instalarAdiado(){
  try{ const t = +localStorage.getItem("efraim-instalar-adiado"); return t && Date.now() - t < 3 * 864e5; }catch(e){ return false; }
}
function mostrarInstalar(){
  if(ehApp() || instalarAdiado() || document.getElementById("faixa-instalar")) return;
  if(!EVENTO_INSTALAR && !ehIOS()) return;
  const f = document.createElement("div");
  f.id = "faixa-instalar";
  f.innerHTML =
    '<img src="/icon-192.png" alt="">' +
    '<div class="fi-txt"><b>Instale o app EQUIPE EFRAIM</b><span>Acesso rápido pela tela inicial e lembrete do devocional.</span></div>' +
    '<button type="button" class="fi-btn">' + (EVENTO_INSTALAR ? "INSTALAR" : "COMO INSTALAR") + '</button>' +
    '<button type="button" class="fi-x" aria-label="Fechar">×</button>';
  f.querySelector(".fi-x").onclick = () => { try{ localStorage.setItem("efraim-instalar-adiado", String(Date.now())); }catch(e){} f.remove(); };
  f.querySelector(".fi-btn").onclick = async () => {
    if(EVENTO_INSTALAR){
      EVENTO_INSTALAR.prompt();
      const r = await EVENTO_INSTALAR.userChoice.catch(() => null);
      EVENTO_INSTALAR = null;
      if(r && r.outcome === "accepted") f.remove();
    }else{
      passoAPassoIOS();
    }
  };
  document.body.appendChild(f);
}
function passoAPassoIOS(){
  const cx = document.createElement("div");
  cx.id = "ios-instalar";
  cx.innerHTML =
    '<div class="ii-caixa">' +
      '<img src="/icon-192.png" alt="">' +
      '<h3>Instalar no iPhone</h3>' +
      '<ol>' +
        '<li>Abra este site no <b>Safari</b>.</li>' +
        '<li>Toque em <b>Compartilhar</b> <span class="ii-ic">⬆️</span> (na barra de baixo).</li>' +
        '<li>Role e toque em <b>Adicionar à Tela de Início</b> <span class="ii-ic">➕</span>.</li>' +
        '<li>Toque em <b>Adicionar</b>. Pronto: o ícone EQUIPE EFRAIM aparece na tela.</li>' +
      '</ol>' +
      '<button type="button">ENTENDI</button>' +
    '</div>';
  cx.onclick = e => { if(e.target === cx || e.target.tagName === "BUTTON") cx.remove(); };
  document.body.appendChild(cx);
}
/* Registra o service worker já na abertura (necessário para instalar e para o lembrete) */
if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
document.addEventListener("DOMContentLoaded", () => setTimeout(mostrarInstalar, 1200));

/* Estilo da barra + oculta a página até o login ser confirmado
   (evita o "flash" de conteúdo antes do redirecionamento) */
(function(){
  const st = document.createElement("style");
  st.textContent = `
    html:not(.logado) body{visibility:hidden;}
    #barra-usuario{
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding:9px 16px; background:#0F0F12; border-bottom:1px solid #2A2A2F;
      font-family:'Poppins',system-ui,sans-serif; font-size:.78rem; color:#B8B2AA;
      position:sticky; top:0; z-index:50;
    }
    #barra-usuario b{color:#F7F3EE; font-weight:600;}
    #barra-usuario i{color:#F0834A; font-style:normal; font-size:.7rem; letter-spacing:1px; text-transform:uppercase;}
    #barra-usuario button{
      background:transparent; border:1px solid #2A2A2F; color:#B8B2AA;
      border-radius:999px; padding:6px 16px; font-size:.72rem; cursor:pointer;
      font-family:inherit; letter-spacing:1px;
    }
    #barra-usuario button:hover{border-color:#F0834A; color:#F0834A;}
    #barra-usuario .quem-sou{display:flex; align-items:center; gap:9px; min-width:0;}
    #barra-usuario .acoes-barra{display:flex; align-items:center; gap:8px; flex:none;}
    #barra-usuario .btn-home{
      border:1px solid #F0834A; color:#F0834A; border-radius:999px; padding:6px 14px;
      font-size:.72rem; text-decoration:none; letter-spacing:1px; font-weight:600; white-space:nowrap;
    }
    #barra-usuario .btn-home:hover{background:rgba(240,131,74,.12);}
    .avatar{
      width:34px; height:34px; border-radius:50%; flex:none; overflow:hidden; padding:0 !important;
      display:inline-flex; align-items:center; justify-content:center;
      background:#1D1D22; border:1px solid #F0834A !important; color:#F0834A !important;
      font:600 .72rem 'Poppins',system-ui,sans-serif; letter-spacing:0 !important; cursor:pointer;
    }
    .avatar img{width:100%; height:100%; object-fit:cover; display:block;}
    .avatar.grande{width:96px; height:96px; font-size:1.8rem; margin:0 auto 14px; cursor:default;}
    .box-celulas{
      background:linear-gradient(135deg, rgba(240,131,74,.12), #151518 60%); border:1px solid rgba(240,131,74,.45);
      border-radius:16px; padding:16px; margin:6px 0 22px; font-family:'Poppins',system-ui,sans-serif; color:#F7F3EE;
    }
    .box-celulas .bc-tit{font-size:.72rem; font-weight:700; color:#F0834A; letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;}
    .box-celulas .bc-corpo{font-size:.82rem; color:#B8B2AA;}
    .box-celulas .bc-corpo p{margin-bottom:10px; line-height:1.5;}
    .box-celulas .bc-corpo small{display:block; margin-top:8px; font-size:.7rem; line-height:1.5;}
    .box-celulas .bc-item{display:flex; align-items:center; gap:12px; padding:9px 0; border-bottom:1px solid #2A2A2F;}
    .box-celulas .bc-item:last-child{border-bottom:none;}
    .box-celulas .bc-km{min-width:58px; text-align:center; font-weight:700; color:#F0834A; font-size:.85rem;}
    .box-celulas .bc-info{flex:1; min-width:0;}
    .box-celulas .bc-info b{display:block; color:#F7F3EE; font-size:.88rem; font-weight:600;}
    .box-celulas .bc-info span{font-size:.72rem; color:#B8B2AA;}
    .box-celulas .bc-ir{border:1px solid #F0834A; color:#F0834A; border-radius:999px; padding:6px 14px; font-size:.72rem; text-decoration:none; font-weight:600;}
    .box-celulas .bc-permitir{
      width:100%; padding:12px; border:1px solid #F0834A; background:transparent; color:#F0834A;
      border-radius:12px; font:700 .78rem 'Poppins',sans-serif; letter-spacing:1px; cursor:pointer;
    }
    .box-celulas .bc-mapa{
      display:block; text-align:center; margin-top:12px; padding:12px; border-radius:12px; text-decoration:none;
      background:linear-gradient(135deg,#F0834A,#D96A32); color:#fff; font:700 .78rem 'Poppins',sans-serif; letter-spacing:1px;
    }
    #pedido-avisos{position:fixed; inset:0; z-index:112; background:rgba(0,0,0,.75); display:flex; align-items:center; justify-content:center; padding:20px;}
    #pedido-avisos .pa-caixa{
      width:100%; max-width:340px; background:#151518; border:1px solid rgba(240,131,74,.5); border-radius:20px;
      padding:26px 22px; text-align:center; font-family:'Poppins',system-ui,sans-serif; color:#F7F3EE; box-shadow:0 20px 60px rgba(0,0,0,.6);
    }
    #pedido-avisos img{width:64px; height:64px; border-radius:15px;}
    #pedido-avisos h3{font-family:'Playfair Display',serif; font-size:1.25rem; margin:10px 0 8px;}
    #pedido-avisos p{font-size:.82rem; color:#B8B2AA; margin-bottom:18px; line-height:1.55;}
    #pedido-avisos p b{color:#F7F3EE;}
    #pedido-avisos .pa-sim{
      width:100%; padding:14px; border:none; border-radius:12px; cursor:pointer; color:#fff;
      background:linear-gradient(135deg,#F0834A,#D96A32); font:700 .85rem 'Poppins',sans-serif; letter-spacing:1px;
    }
    #pedido-avisos .pa-sim:disabled{opacity:.6;}
    #pedido-avisos .pa-depois{margin-top:10px; background:none; border:none; color:#B8B2AA; font:400 .78rem 'Poppins',sans-serif; cursor:pointer; text-decoration:underline;}
    #folha-perfil .fp-op i{font-style:normal;}
    /* ---- Barra inferior (estilo app) ---- */
    body.com-nav{padding-bottom:calc(78px + env(safe-area-inset-bottom, 0px));}
    #nav-inferior{
      position:fixed; left:0; right:0; bottom:0; z-index:80; display:flex; justify-content:space-around;
      padding:7px 6px calc(7px + env(safe-area-inset-bottom, 0px)); background:rgba(15,15,18,.97);
      border-top:1px solid #2A2A2F; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
      font-family:'Poppins',system-ui,sans-serif;
    }
    #nav-inferior .ni{flex:1; max-width:110px; display:flex; flex-direction:column; align-items:center; gap:3px; text-decoration:none; color:#8E8A84; padding:4px 0; border-radius:12px;}
    #nav-inferior .ni-ic{width:30px; height:30px; transition:transform .15s;}
    #nav-inferior .ni-ic svg{width:100%; height:100%; display:block;}
    #nav-inferior .ni-rot{font-size:.66rem; font-weight:600; letter-spacing:.2px;}
    #nav-inferior .ni.ativo{color:#F0834A;}
    #nav-inferior .ni.ativo .ni-ic{transform:scale(1.1);}
    #nav-inferior .ni:active .ni-ic{transform:scale(.9);}
    #folha-perfil{position:fixed; inset:0; z-index:105; background:rgba(0,0,0,.65); display:flex; align-items:flex-end; justify-content:center;}
    #folha-perfil .fp-caixa{
      width:100%; max-width:480px; background:#151518; border:1px solid #2A2A2F; border-bottom:none;
      border-radius:22px 22px 0 0; padding:22px 20px calc(22px + env(safe-area-inset-bottom, 0px));
      font-family:'Poppins',system-ui,sans-serif; color:#F7F3EE; text-align:center; animation:fi-sobe .25s ease-out;
    }
    #folha-perfil h3{font-family:'Playfair Display',serif; font-size:1.3rem;}
    #folha-perfil .fp-papel{font-size:.74rem; color:#B8B2AA; margin:2px 0 16px; letter-spacing:1px; text-transform:uppercase;}
    #folha-perfil .fp-op{
      display:flex; align-items:center; gap:12px; width:100%; padding:12px 14px; margin-bottom:8px; border-radius:14px;
      background:#1D1D22; border:1px solid #2A2A2F; color:#F7F3EE; text-decoration:none; font:600 .86rem 'Poppins',sans-serif; cursor:pointer; text-align:left;
    }
    #folha-perfil .fp-op span{width:28px; height:28px; flex:none;}
    #folha-perfil .fp-op svg{width:100%; height:100%; display:block;}
    #folha-perfil .fp-sair{width:100%; margin-top:6px; padding:13px; border-radius:14px; border:1px solid #E05555; background:transparent; color:#E05555; font:700 .82rem 'Poppins',sans-serif; cursor:pointer;}
    .icc{display:inline-flex; flex:none;}
    .icc svg{width:100%; height:100%; display:block;}
    #faixa-instalar{
      position:fixed; left:12px; right:12px; bottom:calc(12px + env(safe-area-inset-bottom, 0px)); z-index:90;
      display:flex; align-items:center; gap:12px; padding:12px 12px 12px 14px; border-radius:16px;
      background:#151518; border:1px solid rgba(240,131,74,.55); box-shadow:0 10px 36px rgba(0,0,0,.6);
      font-family:'Poppins',system-ui,sans-serif; max-width:520px; margin:0 auto; animation:fi-sobe .35s ease-out;
    }
    body.com-nav #faixa-instalar{bottom:calc(86px + env(safe-area-inset-bottom, 0px));}
    @keyframes fi-sobe{from{transform:translateY(30px); opacity:0;} to{transform:none; opacity:1;}}
    #faixa-instalar img{width:44px; height:44px; border-radius:11px; flex:none;}
    #faixa-instalar .fi-txt{flex:1; min-width:0;}
    #faixa-instalar .fi-txt b{display:block; color:#F7F3EE; font-size:.84rem;}
    #faixa-instalar .fi-txt span{display:block; color:#B8B2AA; font-size:.7rem; line-height:1.4;}
    #faixa-instalar .fi-btn{
      border:none; border-radius:999px; padding:10px 14px; cursor:pointer; color:#fff; white-space:nowrap;
      background:linear-gradient(135deg,#F0834A,#D96A32); font:700 .7rem 'Poppins',sans-serif; letter-spacing:.5px;
    }
    #faixa-instalar .fi-x{background:none; border:none; color:#B8B2AA; font-size:1.3rem; cursor:pointer; padding:0 2px; line-height:1;}
    #ios-instalar{position:fixed; inset:0; z-index:110; background:rgba(0,0,0,.75); display:flex; align-items:flex-end; justify-content:center; padding:16px;}
    #ios-instalar .ii-caixa{
      width:100%; max-width:420px; background:#151518; border:1px solid #2A2A2F; border-radius:20px; padding:22px;
      font-family:'Poppins',system-ui,sans-serif; color:#F7F3EE; text-align:center; margin-bottom:env(safe-area-inset-bottom, 0px);
    }
    #ios-instalar img{width:64px; height:64px; border-radius:15px;}
    #ios-instalar h3{font-family:'Playfair Display',serif; font-size:1.25rem; margin:10px 0 12px;}
    #ios-instalar ol{text-align:left; font-size:.84rem; color:#B8B2AA; line-height:1.6; padding-left:20px; margin-bottom:16px;}
    #ios-instalar ol b{color:#F7F3EE;}
    #ios-instalar button{
      width:100%; padding:13px; border:none; border-radius:12px; cursor:pointer; color:#fff;
      background:linear-gradient(135deg,#F0834A,#D96A32); font:700 .82rem 'Poppins',sans-serif; letter-spacing:1px;
    }
    #convite-foto{
      position:fixed; inset:0; z-index:100; background:rgba(0,0,0,.72);
      display:flex; align-items:center; justify-content:center; padding:20px;
    }
    #convite-foto .caixa-foto{
      width:100%; max-width:340px; background:#151518; border:1px solid #2A2A2F; border-radius:18px;
      padding:26px 22px; text-align:center; font-family:'Poppins',system-ui,sans-serif; color:#F7F3EE;
    }
    #convite-foto h3{font-family:'Playfair Display',serif; font-size:1.25rem; margin-bottom:8px;}
    #convite-foto p{font-size:.82rem; color:#B8B2AA; margin-bottom:18px; line-height:1.5;}
    #convite-foto .sim{
      width:100%; padding:14px; border:none; border-radius:12px; cursor:pointer; color:#fff;
      background:linear-gradient(135deg,#F0834A,#D96A32); font:700 .85rem 'Poppins',sans-serif; letter-spacing:1px;
    }
    #convite-foto .depois{
      margin-top:10px; background:none; border:none; color:#B8B2AA; font:400 .78rem 'Poppins',sans-serif;
      cursor:pointer; text-decoration:underline;
    }
  `;
  document.head.appendChild(st);
})();
