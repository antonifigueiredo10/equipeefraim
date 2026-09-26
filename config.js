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
      (estouNaHome() ? '' : '<a href="' + paginaHome() + '" class="btn-home">🏠 Início</a>') +
      '<button type="button" onclick="sair()">Sair</button>' +
    '</span>';
  document.body.insertBefore(barra, document.body.firstChild);
  carregarMinhaFoto();
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
