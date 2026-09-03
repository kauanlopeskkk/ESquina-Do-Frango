// Carrinho de compras, checkout e telas de pagamento (Pix / cartão / dinheiro).
// Depende de API_BASE_URL, produtosCache e formatarPreco definidos em assets/js/main.js.

const CHAVE_CARRINHO = "eskina_carrinho";

let carrinho = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || "[]");
let pedidoAtual = null;
let pollingPagamento = null;
let mpPublicKey = null;

const carrinhoBadgeEl = document.getElementById("carrinho-badge");
const carrinhoOverlayEl = document.getElementById("carrinho-overlay");
const carrinhoDrawerEl = document.getElementById("carrinho-drawer");
const carrinhoItensEl = document.getElementById("carrinho-itens");
const carrinhoVazioEl = document.getElementById("carrinho-vazio");
const carrinhoTotalEl = document.getElementById("carrinho-total");
const btnAbrirCarrinhoEl = document.getElementById("btn-abrir-carrinho");
const carrinhoFecharEl = document.getElementById("carrinho-fechar");
const btnFinalizarCompraEl = document.getElementById("btn-finalizar-compra");

const modalCheckoutEl = document.getElementById("modal-checkout");
const checkoutOverlayEl = document.getElementById("checkout-overlay");
const checkoutFecharEl = document.getElementById("checkout-fechar");
const formCheckoutEl = document.getElementById("form-checkout");
const checkoutErroEl = document.getElementById("checkout-erro");
const checkoutContinuarEl = document.getElementById("checkout-continuar");
const checkoutEnderecoContainerEl = document.getElementById("checkout-endereco-container");
const checkoutEnderecoEl = document.getElementById("checkout-endereco");

const modalPagamentoEl = document.getElementById("modal-pagamento");
const pagamentoFecharEl = document.getElementById("pagamento-fechar");
const pagamentoPixEl = document.getElementById("pagamento-pix");
const pagamentoCartaoEl = document.getElementById("pagamento-cartao");
const pagamentoDinheiroEl = document.getElementById("pagamento-dinheiro");
const pagamentoConfirmadoEl = document.getElementById("pagamento-confirmado");
const pagamentoConfirmadoTextoEl = document.getElementById("pagamento-confirmado-texto");
const pixQrcodeEl = document.getElementById("pix-qrcode");
const pixCopiaColaEl = document.getElementById("pix-copia-cola");
const pixCopiarEl = document.getElementById("pix-copiar");
const pixStatusEl = document.getElementById("pix-status");
const cartaoIndisponivelEl = document.getElementById("cartao-indisponivel");




function salvarCarrinho() {
  localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
  atualizarBadge();
  renderizarCarrinho();
}

function adicionarAoCarrinho(produto, quantidade = 1) {
  const item = carrinho.find((i) => i.id === produto.id);
  if (item) {
    item.quantidade += quantidade;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco_de_unidade,
      quantidade,
    });
  }
  salvarCarrinho();
  abrirCarrinho();
}

function alterarQuantidade(id, delta) {
  const item = carrinho.find((i) => i.id === id);
  if (!item) return;
  item.quantidade += delta;
  if (item.quantidade <= 0) {
    carrinho = carrinho.filter((i) => i.id !== id);
  }
  salvarCarrinho();
}

function removerItem(id) {
  carrinho = carrinho.filter((i) => i.id !== id);
  salvarCarrinho();
}

function totalCarrinho() {
  return carrinho.reduce((soma, i) => soma + i.preco * i.quantidade, 0);
}

function atualizarBadge() {
  const quantidadeTotal = carrinho.reduce((soma, i) => soma + i.quantidade, 0);
  if (quantidadeTotal > 0) {
    carrinhoBadgeEl.textContent = String(quantidadeTotal);
    carrinhoBadgeEl.classList.remove("hidden");
    carrinhoBadgeEl.classList.add("flex");
  } else {
    carrinhoBadgeEl.classList.add("hidden");
    carrinhoBadgeEl.classList.remove("flex");
  }
}

function itemCarrinhoHtml(item) {
  return `
    <div class="flex items-center gap-3" data-item-id="${item.id}">
      <div class="flex-1">
        <p class="text-sm font-semibold text-neutral-900">${item.nome}</p>
        <p class="text-xs text-neutral-500">${formatarPreco(item.preco)} cada</p>
      </div>
      <div class="flex items-center border border-neutral-200 rounded-full">
        <button type="button" data-diminuir="${item.id}" class="w-7 h-7 text-emerald-800 hover:bg-emerald-50 rounded-full" aria-label="Diminuir">−</button>
        <span class="w-6 text-center text-sm font-semibold">${item.quantidade}</span>
        <button type="button" data-aumentar="${item.id}" class="w-7 h-7 text-emerald-800 hover:bg-emerald-50 rounded-full" aria-label="Aumentar">+</button>
      </div>
      <button type="button" data-remover="${item.id}" class="text-neutral-400 hover:text-red-600 text-sm" aria-label="Remover">🗑️</button>
    </div>
  `;
}

function renderizarCarrinho() {
if(carrinho.length === 0) {
    carrinhoItensEl.innerHTML = "";
    carrinhoVazioEl.classList.remove("hidden");
    btnFinalizarCompraEl.disabled = true;
  } else {
    carrinhoVazioEl.classList.add("hidden");
    carrinhoItensEl.innerHTML = carrinho.map(itemCarrinhoHtml).join("");
    btnFinalizarCompraEl.disabled = false;
  }
  carrinhoTotalEl.textContent = formatarPreco(totalCarrinho());
}

  
carrinhoItensEl.addEventListener("click", (evento) => {
  const aumentar = evento.target.closest("[data-aumentar]");
  const diminuir = evento.target.closest("[data-diminuir]");
  const remover = evento.target.closest("[data-remover]");
  if (aumentar) alterarQuantidade(Number(aumentar.dataset.aumentar), 1);
  if (diminuir) alterarQuantidade(Number(diminuir.dataset.diminuir), -1);
  if (remover) removerItem(Number(remover.dataset.remover));
});

function abrirCarrinho() {
  carrinhoOverlayEl.classList.remove("hidden");
  carrinhoDrawerEl.classList.remove("translate-x-full");
}

function fecharCarrinho() {
  carrinhoOverlayEl.classList.add("hidden");
  carrinhoDrawerEl.classList.add("translate-x-full");
}

btnAbrirCarrinhoEl.addEventListener("click", abrirCarrinho);
carrinhoFecharEl.addEventListener("click", fecharCarrinho);
carrinhoOverlayEl.addEventListener("click", fecharCarrinho);

// ---- Checkout ----

function abrirCheckout() {
  if (carrinho.length === 0) return;
  fecharCarrinho();
  checkoutErroEl.classList.add("hidden");
  modalCheckoutEl.classList.remove("hidden");
  modalCheckoutEl.classList.add("flex");
}

function fecharCheckout() {
  modalCheckoutEl.classList.add("hidden");
  modalCheckoutEl.classList.remove("flex");
}

btnFinalizarCompraEl.addEventListener("click", abrirCheckout);
checkoutFecharEl.addEventListener("click", fecharCheckout);
checkoutOverlayEl.addEventListener("click", fecharCheckout);

document.querySelectorAll('input[name="tipo_entrega"]').forEach((radio) => {
  radio.addEventListener("change", (evento) => {
    const isRetirada = evento.target.value === "retirada";
    checkoutEnderecoContainerEl.classList.toggle("hidden", isRetirada);
    checkoutEnderecoEl.required = !isRetirada;
  });
});

formCheckoutEl.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  checkoutErroEl.classList.add("hidden");
  checkoutContinuarEl.disabled = true;
  checkoutContinuarEl.textContent = "Enviando pedido...";

  const dados = new FormData(formCheckoutEl);
  const formaPagamento = dados.get("forma_pagamento");
  const tipoEntrega = dados.get("tipo_entrega") || "entrega";

  const corpo = {
    cliente_nome: dados.get("nome"),
    cliente_telefone: dados.get("telefone"),
    cliente_email: dados.get("email"),
    tipo_entrega: tipoEntrega,
    endereco_entrega: tipoEntrega === "retirada" ? "" : dados.get("endereco"),
    forma_pagamento: formaPagamento,
    itens: carrinho.map((item) => ({
      produto_id: item.id,
      nome: item.nome,
      quantidade: item.quantidade,
      preco_unitario: item.preco,
    })),
  };

  try {
    const resposta = await fetch(`${API_BASE_URL}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dadosResposta = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw new Error(dadosResposta.detail || "Não foi possível criar o pedido.");
    }
    pedidoAtual = dadosResposta;
    fecharCheckout();
    await iniciarPagamento(formaPagamento);
  } catch (erro) {
    checkoutErroEl.textContent = erro.message;
    checkoutErroEl.classList.remove("hidden");
  } finally {
    checkoutContinuarEl.disabled = false;
    checkoutContinuarEl.textContent = "Continuar para pagamento";
  }
});

// ---- Pagamento ----

function abrirTelaPagamento(tela) {
  [pagamentoPixEl, pagamentoCartaoEl, pagamentoDinheiroEl, pagamentoConfirmadoEl].forEach((el) =>
    el.classList.add("hidden")
  );
  tela.classList.remove("hidden");
  modalPagamentoEl.classList.remove("hidden");
  modalPagamentoEl.classList.add("flex");
}

function fecharPagamento() {
  modalPagamentoEl.classList.add("hidden");
  modalPagamentoEl.classList.remove("flex");
  if (pollingPagamento) {
    clearInterval(pollingPagamento);
    pollingPagamento = null;
  }
}

pagamentoFecharEl.addEventListener("click", fecharPagamento);

function limparCarrinhoAposCompra() {
  carrinho = [];
  salvarCarrinho();
}

async function iniciarPagamento(formaPagamento) {
  if (formaPagamento === "pix") {
    await iniciarPagamentoPix();
  } else if (formaPagamento === "cartao") {
    await iniciarPagamentoCartao();
  } else {
    abrirTelaPagamento(pagamentoDinheiroEl);
    limparCarrinhoAposCompra();
  }
}

async function iniciarPagamentoPix() {
  abrirTelaPagamento(pagamentoPixEl);
  pixStatusEl.textContent = "⏳ Gerando cobrança Pix...";
  pixQrcodeEl.classList.add("hidden");

  try {
    const resposta = await fetch(`${API_BASE_URL}/pagamentos/${pedidoAtual.id}/pix`, { method: "POST" });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.detail || "Não foi possível gerar o Pix.");

    pixQrcodeEl.src = `data:image/png;base64,${dados.qr_code_base64}`;
    pixQrcodeEl.classList.remove("hidden");
    pixCopiaColaEl.value = dados.qr_code;
    pixStatusEl.textContent = "⏳ Aguardando pagamento...";
    limparCarrinhoAposCompra();

    pollingPagamento = setInterval(verificarStatusPedido, 4000);
  } catch (erro) {
    pixStatusEl.textContent = `⚠️ ${erro.message}`;
  }
}

pixCopiarEl.addEventListener("click", async () => {
  if (!pixCopiaColaEl.value) return;
  await navigator.clipboard.writeText(pixCopiaColaEl.value);
  pixCopiarEl.textContent = "Copiado!";
  setTimeout(() => (pixCopiarEl.textContent = "Copiar"), 2000);
});

async function verificarStatusPedido() {
  if (!pedidoAtual) return;
  try {
    const resposta = await fetch(`${API_BASE_URL}/pedidos/${pedidoAtual.id}/status`);
    const dados = await resposta.json();
    if (dados.status === "pago") {
      clearInterval(pollingPagamento);
      pollingPagamento = null;
      pixStatusEl.textContent = "✅ Pagamento aprovado!";
      setTimeout(() => {
        pagamentoConfirmadoTextoEl.textContent =
          "Recebemos seu pagamento via Pix. Já vamos preparar seu pedido!";
        abrirTelaPagamento(pagamentoConfirmadoEl);
      }, 1200);
    }
  } catch (erro) {
    console.error(erro);
  }
}

async function iniciarPagamentoCartao() {
  abrirTelaPagamento(pagamentoCartaoEl);
  document.getElementById("payment-brick-container").innerHTML = "";
  cartaoIndisponivelEl.classList.add("hidden");

  if (mpPublicKey === null) {
    try {
      const resposta = await fetch(`${API_BASE_URL}/config/mercado-pago`);
      const dados = await resposta.json();
      mpPublicKey = dados.habilitado ? dados.public_key : "";
    } catch (erro) {
      mpPublicKey = "";
    }
  }

  if (!mpPublicKey || typeof MercadoPago === "undefined") {
    cartaoIndisponivelEl.classList.remove("hidden");
    return;
  }

  const mp = new MercadoPago(mpPublicKey, { locale: "pt-BR" });
  const bricksBuilder = mp.bricks();

  await bricksBuilder.create("payment", "payment-brick-container", {
    initialization: {
      amount: pedidoAtual.total,
    },
    customization: {
      paymentMethods: { creditCard: "all", debitCard: "all" },
    },
    callbacks: {
      onSubmit: ({ formData }) =>
        new Promise((resolve, reject) => {
          fetch(`${API_BASE_URL}/pagamentos/${pedidoAtual.id}/cartao`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: formData.token,
              payment_method_id: formData.payment_method_id,
              installments: formData.installments,
              issuer_id: formData.issuer_id,
            }),
          })
            .then(async (resposta) => {
              const dados = await resposta.json();
              if (!resposta.ok) throw new Error(dados.detail || "Pagamento recusado.");

              limparCarrinhoAposCompra();
              pagamentoConfirmadoTextoEl.textContent =
                dados.status === "approved"
                  ? "Pagamento aprovado! Já vamos preparar seu pedido."
                  : `Status do pagamento: ${dados.status}.`;
              abrirTelaPagamento(pagamentoConfirmadoEl);
              resolve();
            })
            .catch(reject);
        }),
      onError: (erro) => console.error(erro),
    },
  });
}

atualizarBadge();
renderizarCarrinho();


