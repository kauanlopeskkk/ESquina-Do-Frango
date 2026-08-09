// URL da API (Back-end API/API_Frango.py rodando com uvicorn, porta padrão 8000).
const API_BASE_URL = "http://127.0.0.1:8000";

const gridEl = document.getElementById("grid-produtos");
const filtrosEl = document.getElementById("filtros-categoria");
const estadoEl = document.getElementById("estado-produtos");

const ICONES_CATEGORIA = {
  "Frango e Carnes": "🍗",
  "Frios e Laticínios": "🧀",
  "Mercearia": "🛒",
  "Higiene e Limpeza": "🧼",
};

let categoriaAtiva = "Todos";
let produtosCache = [];

function formatarPreco(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function cardProduto(produto) {
  const precoKilo = produto.preco_do_kilo
    ? `<span class="block text-xs text-neutral-500">${formatarPreco(produto.preco_do_kilo)}/kg</span>`
    : "";
  const descricao = produto.descricao
    ? `<p class="text-sm text-neutral-500 mt-1 flex-1">${produto.descricao}</p>`
    : '<div class="flex-1"></div>';

  return `
    <article class="product-card bg-white rounded-2xl shadow-md border border-neutral-100 p-5 flex flex-col">
      <div class="text-3xl mb-3">${ICONES_CATEGORIA[produto.categoria] || "🛍️"}</div>
      <span class="text-xs font-semibold text-emerald-700 uppercase tracking-wide">${produto.categoria}</span>
      <h3 class="text-lg font-semibold text-neutral-900 mt-1">${produto.nome}</h3>
      ${descricao}
      <div class="mt-4">
        <span class="text-xl font-bold text-emerald-800">${formatarPreco(produto.preco_de_unidade)}</span>
        ${precoKilo}
      </div>
    </article>
  `;
}

function renderizarProdutos() {
  const lista =
    categoriaAtiva === "Todos"
      ? produtosCache
      : produtosCache.filter((produto) => produto.categoria === categoriaAtiva);

  if (lista.length === 0) {
    gridEl.innerHTML = "";
    estadoEl.textContent = "Nenhum produto cadastrado nessa categoria ainda.";
    estadoEl.classList.remove("hidden");
    return;
  }

  estadoEl.classList.add("hidden");
  gridEl.innerHTML = lista.map(cardProduto).join("");
}

function renderizarFiltros(categorias) {
  const todas = ["Todos", ...categorias];

  filtrosEl.innerHTML = todas
    .map((categoria) => {
      const ativo = categoria === categoriaAtiva;
      const classes = ativo
        ? "bg-emerald-700 text-white border-emerald-700"
        : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50";
      return `<button type="button" data-categoria="${categoria}" class="filtro-btn px-4 py-2 rounded-full text-sm font-medium border transition ${classes}">${categoria}</button>`;
    })
    .join("");

  filtrosEl.querySelectorAll(".filtro-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
      categoriaAtiva = botao.dataset.categoria;
      renderizarFiltros(categorias);
      renderizarProdutos();
    });
  });
}

async function carregarLoja() {
  estadoEl.textContent = "Carregando produtos...";
  estadoEl.classList.remove("hidden");

  try {
    const [categoriasResp, produtosResp] = await Promise.all([
      fetch(`${API_BASE_URL}/categorias`),
      fetch(`${API_BASE_URL}/produtos`),
    ]);

    if (!categoriasResp.ok || !produtosResp.ok) {
      throw new Error("Falha ao consultar a API");
    }

    const categorias = await categoriasResp.json();
    produtosCache = await produtosResp.json();

    renderizarFiltros(categorias);
    renderizarProdutos();
  } catch (erro) {
    console.error(erro);
    gridEl.innerHTML = "";
    estadoEl.textContent =
      "Não foi possível carregar os produtos agora. Verifique se a API está rodando (uvicorn API_Frango:app, dentro da pasta Back-end API) e recarregue a página.";
    estadoEl.classList.remove("hidden");
  }
}

document.addEventListener("DOMContentLoaded", carregarLoja);
