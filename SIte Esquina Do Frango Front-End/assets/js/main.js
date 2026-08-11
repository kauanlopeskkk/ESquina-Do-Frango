// URL da API (Back-end API/API_Frango.py rodando com uvicorn, porta padrão 8000).
const API_BASE_URL = "http://127.0.0.1:8000";

const gridEl = document.getElementById("grid-produtos");
const filtrosEl = document.getElementById("filtros-categoria");
const estadoEl = document.getElementById("estado-produtos");

const modalEl = document.getElementById("modal-produto");
const modalOverlayEl = document.getElementById("modal-overlay");
const modalFecharEl = document.getElementById("modal-fechar");
const modalImagemEl = document.getElementById("modal-imagem");
const modalIconeEl = document.getElementById("modal-icone");
const modalCategoriaEl = document.getElementById("modal-categoria");
const modalNomeEl = document.getElementById("modal-nome");
const modalDescricaoEl = document.getElementById("modal-descricao");
const modalPrecoEl = document.getElementById("modal-preco");
const modalPrecoKiloEl = document.getElementById("modal-preco-kilo");
const modalValidadeEl = document.getElementById("modal-validade");
const modalQtdEl = document.getElementById("modal-qtd");
const modalQtdMaisEl = document.getElementById("modal-qtd-mais");
const modalQtdMenosEl = document.getElementById("modal-qtd-menos");
const modalAddCarrinhoEl = document.getElementById("modal-add-carrinho");

let produtoModalAtual = null;
let quantidadeModalAtual = 1;

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
    <article data-id="${produto.id}" class="product-card cursor-pointer bg-white rounded-2xl shadow-md border border-neutral-100 p-5 flex flex-col">
      <div class="text-3xl mb-3">${ICONES_CATEGORIA[produto.categoria] || "🛍️"}</div>
      <span class="text-xs font-semibold text-emerald-700 uppercase tracking-wide">${produto.categoria}</span>
      <h3 class="text-lg font-semibold text-neutral-900 mt-1">${produto.nome}</h3>
      ${descricao}
      <div class="mt-4">
        <span class="text-xl font-bold text-emerald-800">${formatarPreco(produto.preco_de_unidade)}</span>
        ${precoKilo}
      </div>
      <button
        type="button"
        data-add-carrinho="${produto.id}"
        class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-full transition"
      >
        + Adicionar ao carrinho
      </button>
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

function abrirModal(produto) {
  produtoModalAtual = produto;
  quantidadeModalAtual = 1;
  modalQtdEl.textContent = "1";
  modalCategoriaEl.textContent = produto.categoria;
  modalNomeEl.textContent = produto.nome;
  modalDescricaoEl.textContent = produto.descricao || "";
  modalDescricaoEl.classList.toggle("hidden", !produto.descricao);
  modalPrecoEl.textContent = formatarPreco(produto.preco_de_unidade);
  modalPrecoKiloEl.textContent = produto.preco_do_kilo
    ? `${formatarPreco(produto.preco_do_kilo)}/kg`
    : "";
  modalValidadeEl.textContent = produto.validade_do_produto
    ? `Validade: ${produto.validade_do_produto} dia(s)`
    : "";

  if (produto.imagem_url) {
    modalImagemEl.src = produto.imagem_url;
    modalImagemEl.alt = produto.nome;
    modalImagemEl.classList.remove("hidden");
    modalIconeEl.classList.add("hidden");
  } else {
    modalImagemEl.classList.add("hidden");
    modalIconeEl.textContent = ICONES_CATEGORIA[produto.categoria] || "🛍️";
    modalIconeEl.classList.remove("hidden");
  }

  modalEl.classList.remove("hidden");
  modalEl.classList.add("flex");
}

function fecharModal() {
  modalEl.classList.add("hidden");
  modalEl.classList.remove("flex");
  modalImagemEl.src = "";
}

modalFecharEl.addEventListener("click", fecharModal);
modalOverlayEl.addEventListener("click", fecharModal);
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") fecharModal();
});

gridEl.addEventListener("click", (evento) => {
  const botaoAdd = evento.target.closest("[data-add-carrinho]");
  if (botaoAdd) {
    const produto = produtosCache.find((p) => String(p.id) === botaoAdd.dataset.addCarrinho);
    if (produto) adicionarAoCarrinho(produto, 1);
    return;
  }

  const card = evento.target.closest(".product-card");
  if (!card) return;
  const produto = produtosCache.find((p) => String(p.id) === card.dataset.id);
  if (produto) abrirModal(produto);
});

modalQtdMaisEl.addEventListener("click", () => {
  quantidadeModalAtual += 1;
  modalQtdEl.textContent = String(quantidadeModalAtual);
});

modalQtdMenosEl.addEventListener("click", () => {
  quantidadeModalAtual = Math.max(1, quantidadeModalAtual - 1);
  modalQtdEl.textContent = String(quantidadeModalAtual);
});

modalAddCarrinhoEl.addEventListener("click", () => {
  if (!produtoModalAtual) return;
  adicionarAoCarrinho(produtoModalAtual, quantidadeModalAtual);
  fecharModal();
});

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
