/* ------------------------------------------------------------------ */
/* Eskina do Frango — frontend que conversa com a API                  */
/* ------------------------------------------------------------------ */

const $ = s => document.querySelector(s);
const dinheiro = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

let produtos = [];
let config = {};
let carrinho = {};
let filtro = 'Tudo';
let editando = null;
let token = sessionStorage.getItem('eskina-token') || null;

/* ---------- conversa com a API ---------- */

async function api(caminho, opcoes = {}) {
  const cabecalhos = { ...(opcoes.headers || {}) };
  if (opcoes.body) cabecalhos['Content-Type'] = 'application/json';
  if (token) cabecalhos.Authorization = 'Bearer ' + token;

  const r = await fetch('/api' + caminho, {
    ...opcoes,
    headers: cabecalhos,
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
  });

  if (r.status === 401 && token) {
    token = null;
    sessionStorage.removeItem('eskina-token');
    mostraLogin();
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro || 'Não deu pra falar com o servidor.');
  return dados;
}

function recado(txt) {
  const el = $('#recado');
  el.textContent = txt;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 2600);
}

/* ---------- enfeites ---------- */

function montarFita() {
  const frases = ['Frango fresco todo dia', 'Frios fatiados na hora', 'Peça pelo WhatsApp', 'Entrega no bairro', 'Qualidade garantida'];
  const bloco = frases.map(f => `<span>${f}</span>`).join('');
  $('#fita').innerHTML = bloco + bloco;
}

function montarEstrela() {
  const pts = [];
  const n = 12;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? 34 : 50;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)}% ${(50 + r * Math.sin(a)).toFixed(1)}%`);
  }
  document.documentElement.style.setProperty('--estrela', `polygon(${pts.join(',')})`);
}

/* ---------- loja ---------- */

const escapar = t => String(t).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function montarCartaz() {
  const p = produtos.find(x => x.destaque) || produtos[0];
  if (!p) { $('#cartaz').innerHTML = '<h3>Cadastre um produto</h3>'; return; }
  const [reais, cent] = p.preco.toFixed(2).split('.');
  $('#cartaz').innerHTML = `
    <div class="etiqueta">OFERTA DA SEMANA</div>
    <h3>${escapar(p.nome)}</h3>
    <div class="kg">preço por ${escapar(p.unidade)}</div>
    <div class="valor"><sup>R$</sup>${reais}<small>,${cent}</small></div>`;
}

function cardHTML(p) {
  const [reais, cent] = p.preco.toFixed(2).split('.');
  return `
  <article class="card ${p.destaque ? 'destaque' : ''}">
    ${p.destaque ? '<div class="estrela" style="clip-path:var(--estrela)"><span>OFERTA</span></div>' : ''}
    <div class="foto">${escapar(p.icone)}</div>
    <div class="corpo">
      <span class="cat">${escapar(p.categoria)}</span>
      <h3>${escapar(p.nome)}</h3>
      <div class="preco"><sup>R$</sup>${reais},${cent}<small>/${escapar(p.unidade)}</small></div>
      <div class="botoes">
        <button class="b-add" data-add="${p.id}">Adicionar</button>
        <button class="b-comprar" data-comprar="${p.id}">Comprar</button>
      </div>
    </div>
  </article>`;
}

function renderCatalogo() {
  const cats = ['Tudo', ...new Set(produtos.map(p => p.categoria))];
  $('#filtros').innerHTML = cats.map(c =>
    `<button class="filtro" aria-pressed="${c === filtro}" data-filtro="${escapar(c)}">${escapar(c)}</button>`).join('');

  const dest = produtos.filter(p => p.destaque);
  $('#gradeDestaques').innerHTML = dest.length
    ? dest.map(cardHTML).join('')
    : `<div class="vazio"><strong>Nenhuma oferta marcada</strong>Marque "mostrar nas ofertas" em algum produto na área do dono.</div>`;

  const lista = filtro === 'Tudo' ? produtos : produtos.filter(p => p.categoria === filtro);
  $('#gradeCatalogo').innerHTML = lista.length
    ? lista.map(cardHTML).join('')
    : `<div class="vazio"><strong>Nada nessa categoria ainda</strong>Cadastre um produto na área do dono.</div>`;

  montarCartaz();
}

const soDigitos = t => String(t || '').replace(/\D/g, '');

function linkZap(texto) {
  const n = soDigitos(config.zap);
  const num = n ? (n.startsWith('55') ? n : '55' + n) : '';
  return 'https://wa.me/' + num + (texto ? '?text=' + encodeURIComponent(texto) : '');
}

function renderInfo() {
  $('#infoEndereco').textContent = config.endereco || 'Cadastre o endereço na área do dono.';
  $('#infoHorario').textContent = config.horario || 'Cadastre o horário na área do dono.';
  $('#infoEntrega').textContent = `Peça pelo site ou pelo WhatsApp. Retirada na loja sem custo, entrega no bairro por ${dinheiro(Number(config.taxa) || 0)}.`;
  const a = $('#infoZap');
  a.href = linkZap('');
  a.textContent = config.zap || 'Cadastre o WhatsApp na área do dono';
  $('#linkZapHero').href = linkZap('Fala rapaziada! Queria fazer um pedido.');
  $('#chavePix').textContent = config.pix || 'Cadastre a chave PIX na área do dono';
  $('#dicaTaxa').textContent = dinheiro(Number(config.taxa) || 0);
}

/* ---------- carrinho ---------- */

function addItem(id, abrir) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  carrinho[id] = (carrinho[id] || 0) + 1;
  renderCarrinho();
  if (abrir) abreGaveta(true); else recado(p.nome + ' no carrinho');
}

function mudaQtd(id, d) {
  carrinho[id] = (carrinho[id] || 0) + d;
  if (carrinho[id] <= 0) delete carrinho[id];
  renderCarrinho();
}

function totais() {
  let sub = 0;
  for (const id in carrinho) {
    const p = produtos.find(x => x.id === Number(id));
    if (p) sub += p.preco * carrinho[id];
  }
  const entrega = document.querySelector('input[name=entrega]:checked')?.value === 'entrega';
  const taxa = entrega ? (Number(config.taxa) || 0) : 0;
  return { sub, taxa, total: sub + taxa };
}

function renderCarrinho() {
  const ids = Object.keys(carrinho);
  $('#contador').textContent = ids.reduce((s, i) => s + carrinho[i], 0);

  $('#itensCarrinho').innerHTML = ids.length ? ids.map(id => {
    const p = produtos.find(x => x.id === Number(id));
    if (!p) return '';
    return `<div class="item">
      <div class="ico">${escapar(p.icone)}</div>
      <div class="txt"><b>${escapar(p.nome)}</b><span>${dinheiro(p.preco)} / ${escapar(p.unidade)}</span></div>
      <div class="qtd">
        <button data-menos="${p.id}" aria-label="Tirar um">−</button>
        <b>${carrinho[id]}</b>
        <button data-mais="${p.id}" aria-label="Colocar mais um">+</button>
      </div>
    </div>`;
  }).join('') : `<div class="vazio" style="margin-bottom:18px"><strong>Carrinho vazio</strong>Escolha os produtos na loja e eles aparecem aqui.</div>`;

  const t = totais();
  $('#subtotal').textContent = dinheiro(t.sub);
  $('#linhaTaxa').textContent = dinheiro(t.taxa);
  $('#total').textContent = dinheiro(t.total);
  $('#finalizar').disabled = ids.length === 0;
  $('#blocoEntrega').style.display = ids.length ? '' : 'none';
  $('#blocoPagamento').style.display = ids.length ? '' : 'none';
}

function abreGaveta(on) {
  $('#gaveta').classList.toggle('on', on);
  $('#fundo').classList.toggle('on', on);
}

/* ---------- fechar o pedido ---------- */

async function enviarPedido() {
  const bt = $('#finalizar');
  const entrega = document.querySelector('input[name=entrega]:checked').value;
  const pagamento = document.querySelector('input[name=pgto]:checked').value;
  const endereco = $('#endCliente').value.trim();

  if (entrega === 'entrega' && !endereco) {
    recado('Escreva o endereço da entrega');
    $('#endCliente').focus();
    return;
  }
  if (!soDigitos(config.zap)) { recado('A loja ainda não cadastrou o WhatsApp'); return; }

  bt.disabled = true;
  bt.textContent = 'Registrando pedido...';

  try {
    // O servidor recalcula os preços e guarda o pedido no banco.
    const pedido = await api('/pedidos', {
      method: 'POST',
      body: {
        cliente: $('#nomeCliente').value.trim(),
        itens: Object.keys(carrinho).map(id => ({ id: Number(id), qtd: carrinho[id] })),
        pagamento, entrega, endereco,
        troco: $('#troco').value ? Number($('#troco').value) : null
      }
    });

    const linhas = pedido.itens.map(i => `• ${i.qtd}x ${i.nome} — ${dinheiro(i.preco * i.qtd)}`).join('\n');
    let msg = `*Pedido nº ${pedido.id} — Eskina do Frango*\n\n${linhas}\n\nProdutos: ${dinheiro(pedido.subtotal)}`;
    if (pedido.taxa) msg += `\nEntrega: ${dinheiro(pedido.taxa)}`;
    msg += `\n*Total: ${dinheiro(pedido.total)}*\n\nPagamento: ${pagamento}`;
    if (pagamento === 'PIX' && config.pix) msg += ` (chave ${config.pix})`;
    if (pagamento === 'Dinheiro' && $('#troco').value) msg += ` — troco para ${dinheiro(Number($('#troco').value))}`;
    msg += entrega === 'entrega' ? `\nEntrega em: ${endereco}` : `\nVou retirar na loja`;
    if ($('#nomeCliente').value.trim()) msg += `\nNome: ${$('#nomeCliente').value.trim()}`;

    window.open(linkZap(msg), '_blank');
    carrinho = {};
    renderCarrinho();
    abreGaveta(false);
    recado(`Pedido nº ${pedido.id} registrado`);
  } catch (e) {
    recado(e.message);
  } finally {
    bt.disabled = false;
    bt.textContent = 'Enviar pedido no WhatsApp';
  }
}

/* ---------- área do dono ---------- */

function mostraLogin() {
  $('#telaLogin').hidden = false;
  $('#telaPainel').hidden = true;
}

function mostraPainel() {
  $('#telaLogin').hidden = true;
  $('#telaPainel').hidden = false;
  preencherConfig();
  renderAdmin();
}

async function entrar() {
  const senha = $('#senhaDono').value;
  if (!senha) { recado('Escreva a senha'); return; }
  try {
    const r = await api('/login', { method: 'POST', body: { senha } });
    token = r.token;
    sessionStorage.setItem('eskina-token', token);
    $('#senhaDono').value = '';
    mostraPainel();
    recado('Bem-vindo de volta');
  } catch (e) {
    recado(e.message);
  }
}

async function sair() {
  try { await api('/logout', { method: 'POST' }); } catch (e) { /* já expirou */ }
  token = null;
  sessionStorage.removeItem('eskina-token');
  mostraLogin();
}

function renderAdmin() {
  $('#qtdProdutos').textContent = produtos.length;
  $('#listaAdmin').innerHTML = produtos.length ? produtos.map(p => `
    <tr>
      <td><span class="nome">${escapar(p.icone)} ${escapar(p.nome)}</span> ${p.destaque ? '<span class="tag-dest">OFERTA</span>' : ''}</td>
      <td class="esconde">${escapar(p.categoria)}</td>
      <td class="val">${dinheiro(p.preco)}<span style="font-size:11px;color:#9FC7A8">/${escapar(p.unidade)}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button class="mini" data-editar="${p.id}">Editar</button>
        <button class="mini perigo" data-apagar="${p.id}">Apagar</button>
      </td>
    </tr>`).join('')
    : `<tr><td colspan="4" style="color:#9FC7A8;padding:22px 10px">Nenhum produto cadastrado. Use o formulário ao lado.</td></tr>`;
}

function limparForm() {
  editando = null;
  $('#pNome').value = ''; $('#pPreco').value = ''; $('#pIcone').value = '';
  $('#pDest').checked = false;
  $('#tituloForm').textContent = 'Cadastrar produto';
  $('#salvarProduto').textContent = 'Salvar produto';
  $('#cancelarEdicao').style.display = 'none';
}

async function salvarProduto() {
  const corpo = {
    nome: $('#pNome').value.trim(),
    categoria: $('#pCat').value,
    preco: parseFloat($('#pPreco').value),
    unidade: $('#pUn').value,
    icone: $('#pIcone').value.trim() || '🛒',
    destaque: $('#pDest').checked
  };
  try {
    if (editando) {
      await api('/produtos/' + editando, { method: 'PUT', body: corpo });
      recado('Produto atualizado');
    } else {
      await api('/produtos', { method: 'POST', body: corpo });
      recado('Produto cadastrado');
    }
    limparForm();
    await carregarProdutos();
  } catch (e) {
    recado(e.message);
  }
}

function editarProduto(id) {
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  editando = id;
  $('#pNome').value = p.nome; $('#pCat').value = p.categoria; $('#pPreco').value = p.preco;
  $('#pUn').value = p.unidade; $('#pIcone').value = p.icone; $('#pDest').checked = p.destaque;
  $('#tituloForm').textContent = 'Editar produto';
  $('#salvarProduto').textContent = 'Salvar alterações';
  $('#cancelarEdicao').style.display = 'block';
  $('#pNome').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function apagarProduto(id) {
  const p = produtos.find(x => x.id === id);
  if (!p || !confirm(`Apagar "${p.nome}" da loja?`)) return;
  try {
    await api('/produtos/' + id, { method: 'DELETE' });
    delete carrinho[id];
    if (editando === id) limparForm();
    await carregarProdutos();
    renderCarrinho();
    recado('Produto apagado');
  } catch (e) {
    recado(e.message);
  }
}

function preencherConfig() {
  $('#cZap').value = config.zap || ''; $('#cPix').value = config.pix || '';
  $('#cEnd').value = config.endereco || ''; $('#cHora').value = config.horario || '';
  $('#cTaxa').value = config.taxa ?? '';
}

async function salvarConfig() {
  try {
    config = await api('/config', {
      method: 'PUT',
      body: {
        zap: $('#cZap').value.trim(),
        pix: $('#cPix').value.trim(),
        endereco: $('#cEnd').value.trim(),
        horario: $('#cHora').value.trim(),
        taxa: $('#cTaxa').value
      }
    });
    renderInfo();
    renderCarrinho();
    recado('Dados da loja salvos');
  } catch (e) {
    recado(e.message);
  }
}

async function carregarPedidos() {
  const alvo = $('#listaPedidos');
  alvo.innerHTML = '<p class="carregando">Buscando os pedidos...</p>';
  try {
    const pedidos = await api('/pedidos');
    if (!pedidos.length) {
      alvo.innerHTML = '<p class="carregando">Nenhum pedido ainda. Os pedidos feitos pelo site aparecem aqui.</p>';
      return;
    }
    alvo.innerHTML = pedidos.map(p => `
      <div class="pedido">
        <div class="cab">
          <span class="num">#${p.id}</span>
          <span class="status ${p.status}">${p.status}</span>
          <span class="quando">${p.criado_em}</span>
        </div>
        <ul>${p.itens.map(i => `<li>${i.qtd}x ${escapar(i.nome)} — ${dinheiro(i.preco * i.qtd)}</li>`).join('')}</ul>
        <div class="rodape">
          <span class="grana">${dinheiro(p.total)}</span>
          <span>${escapar(p.pagamento)}</span>
          <span>${p.entrega === 'entrega' ? '🛵 ' + escapar(p.endereco || '') : '🏬 retirar na loja'}</span>
          ${p.cliente ? `<span>· ${escapar(p.cliente)}</span>` : ''}
          <select data-status="${p.id}">
            ${['novo', 'separando', 'entregue', 'cancelado'].map(s =>
              `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>`).join('');
  } catch (e) {
    alvo.innerHTML = `<p class="carregando">${escapar(e.message)}</p>`;
  }
}

/* ---------- carregar da API ---------- */

async function carregarProdutos() {
  produtos = await api('/produtos');
  renderCatalogo();
  if (!$('#telaPainel').hidden) renderAdmin();
}

/* ---------- eventos ---------- */

document.addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.add) addItem(Number(t.dataset.add), false);
  if (t.dataset.comprar) addItem(Number(t.dataset.comprar), true);
  if (t.dataset.mais) mudaQtd(Number(t.dataset.mais), 1);
  if (t.dataset.menos) mudaQtd(Number(t.dataset.menos), -1);
  if (t.dataset.editar) editarProduto(Number(t.dataset.editar));
  if (t.dataset.apagar) apagarProduto(Number(t.dataset.apagar));
  if (t.dataset.filtro) { filtro = t.dataset.filtro; renderCatalogo(); }
  if (t.dataset.aba) {
    document.querySelectorAll('.aba').forEach(b => b.setAttribute('aria-pressed', b === t));
    document.querySelectorAll('[data-painel]').forEach(d => { d.hidden = d.dataset.painel !== t.dataset.aba; });
    if (t.dataset.aba === 'pedidos') carregarPedidos();
  }
});

document.addEventListener('change', async e => {
  if (e.target.name === 'entrega') {
    $('#campoEndereco').style.display = e.target.value === 'entrega' ? 'block' : 'none';
    renderCarrinho();
  }
  if (e.target.name === 'pgto') {
    $('#campoTroco').style.display = e.target.value === 'Dinheiro' ? 'block' : 'none';
    $('#campoPix').style.display = e.target.value === 'PIX' ? 'block' : 'none';
  }
  if (e.target.dataset.status) {
    try {
      await api('/pedidos/' + e.target.dataset.status, { method: 'PATCH', body: { status: e.target.value } });
      recado('Pedido atualizado');
      carregarPedidos();
    } catch (err) { recado(err.message); }
  }
});

$('#abrirCarrinho').onclick = () => abreGaveta(true);
$('#fecharCarrinho').onclick = () => abreGaveta(false);
$('#fundo').onclick = () => abreGaveta(false);
$('#finalizar').onclick = enviarPedido;
$('#entrar').onclick = entrar;
$('#sair').onclick = sair;
$('#salvarProduto').onclick = salvarProduto;
$('#cancelarEdicao').onclick = limparForm;
$('#salvarConfig').onclick = salvarConfig;
$('#senhaDono').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') abreGaveta(false); });

/* ---------- início ---------- */

(async () => {
  montarEstrela();
  montarFita();
  try {
    [produtos, config] = await Promise.all([api('/produtos'), api('/config')]);
  } catch (e) {
    recado('O servidor não respondeu. Ele está rodando?');
  }
  renderCatalogo();
  renderInfo();
  renderCarrinho();
  if (token) mostraPainel(); else mostraLogin();
})();
