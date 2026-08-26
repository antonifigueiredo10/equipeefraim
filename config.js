/* =====================================================================
   EQUIPE EFRAIM — Configuração e controle de acesso (arquivo único)
   Usado por: login.html, index.html, escala.html
   =====================================================================

   ⚙️  EDITE APENAS AS DUAS LINHAS ABAIXO.
   Cole os valores de: Supabase → Project Settings → Data API
   ===================================================================== */

const SUPABASE_URL      = "https://biitbbrbcbhimmitqkcc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaXRiYnJiY2JoaW1taXRxa2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NzY3NjUsImV4cCI6MjEwMzM1Mjc2NX0.nlytjRC3OSgVaGDvrphub2LAS0X82MWCewMmsbbnzjA";

/* Lista de quem pode ter acesso. Para incluir alguém novo:
   1) adicione o nome aqui;  2) rode no SQL Editor:
      insert into convites (nome, codigo) values ('Nome Novo','ABC123'); */
const NOMES = [
  "Antonio", "Bruna", "Cristiane", "Denilson", "Dri Gamarra",
  "Felipe", "Fernanda", "Hamilton", "Igor", "José Eduardo",
  "Jugleyde Pompeo", "Karina", "Katia", "Laura", "Lígia",
  "Marco Maia", "Marina", "MissLayne", "Neto", "Pedro",
  "Raphael", "Rebeca", "Reinaldo", "Taisla", "Wagner", "Zé Luis",
];

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
