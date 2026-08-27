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
let PERFIL = null;   // { nome, papel }  papel = 'obreiro' | 'lider'

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
    .select("nome,papel").eq("id", session.user.id).single();

  if(error || !data){ await sb.auth.signOut(); location.replace("login.html"); return null; }

  PERFIL = data;
  document.documentElement.classList.add("logado");
  return PERFIL;
}

async function sair(){
  if(sb) await sb.auth.signOut();
  location.replace("login.html");
}

/* Busca a lista de nomes no banco (view "pessoas" — só o nome, sem código).
   Funciona antes do login, para montar o menu da tela de entrada. */
async function carregarNomes(){
  if(!CONFIGURADO) return [];
  const { data, error } = await sb.from("pessoas").select("nome");
  if(error || !data) return [];
  NOMES = data.map(p => p.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
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

/* Barra fina no topo com o nome de quem está logado e o botão Sair */
function montarBarraUsuario(){
  const barra = document.createElement("div");
  barra.id = "barra-usuario";
  barra.innerHTML =
    '<span><b>' + PERFIL.nome + '</b>' +
    (EH_LIDER() ? ' <i>· liderança</i>' : '') + '</span>' +
    '<button type="button" onclick="sair()">Sair</button>';
  document.body.insertBefore(barra, document.body.firstChild);
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
  `;
  document.head.appendChild(st);
})();
