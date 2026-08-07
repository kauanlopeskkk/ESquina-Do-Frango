import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db, semear } from './db.js';

const PORTA = process.env.PORTA || 3000;
const SENHA = process.env.ADMIN_SENHA || 'trocar-essa-senha';
const PASTA = dirname(fileURLToPath(import.meta.url));

semear();

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(join(PASTA, 'public')));

/* ------------------------------------------------------------------ */
/* Sessão do dono                                                      */
/* ------------------------------------------------------------------ */

const sessoes = new Map(); // token -> validade em ms
const DURACAO = 1000 * 60 * 60 * 8; // 8 horas

function comparaSenha(enviada) {
  const a = Buffer.from(String(enviada));
  const b = Buffer.from(SENHA);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function exigeDono(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const validade = sessoes.get(token);
  if (!validade || validade < Date.now()) {
    sessoes.delete(token);
    return res.status(401).json({ erro: 'Faça login na área do dono para continuar.' });
  }
  next();
}

app.post('/api/login', (req, res) => {
  if (!comparaSenha(req.body?.senha)) {
    return res.status(401).json({ erro: 'Senha incorreta.' });
  }
  const token = randomBytes(24).toString('hex');
  sessoes.set(token, Date.now() + DURACAO);
  res.json({ token, expiraEm: DURACAO });
});

app.post('/api/logout', exigeDono, (req, res) => {
  sessoes.delete((req.headers.authorization || '').replace('Bearer ', ''));
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Produtos                                                            */
/* ------------------------------------------------------------------ */

const paraProduto = p => ({ ...p, destaque: !!p.destaque, ativo: !!p.ativo });

function validaProduto(c) {
  const nome = String(c.nome ?? '').trim();
  const preco = Number(c.preco);
  if (!nome) return { erro: 'Escreva o nome do produto.' };
  if (nome.length > 80) return { erro: 'O nome pode ter no máximo 80 letras.' };
  if (!Number.isFinite(preco) || preco <= 0) return { erro: 'Escreva um preço maior que zero.' };
  return {
    dados: {
      nome,
      preco: Math.round(preco * 100) / 100,
      categoria: String(c.categoria ?? 'Mercearia').trim() || 'Mercearia',
      unidade: String(c.unidade ?? 'un').trim() || 'un',
      icone: String(c.icone ?? '🛒').trim().slice(0, 4) || '🛒',
      destaque: c.destaque ? 1 : 0,
      ativo: c.ativo === false ? 0 : 1
    }
  };
}

app.get('/api/produtos', (req, res) => {
  const todos = req.query.todos === '1';
  const linhas = db
    .prepare(`SELECT * FROM produtos ${todos ? '' : 'WHERE ativo = 1'} ORDER BY destaque DESC, categoria, nome`)
    .all();
  res.json(linhas.map(paraProduto));
});

app.post('/api/produtos', exigeDono, (req, res) => {
  const { erro, dados } = validaProduto(req.body);
  if (erro) return res.status(400).json({ erro });

  const r = db
    .prepare(
      `INSERT INTO produtos (nome, categoria, preco, unidade, icone, destaque, ativo)
       VALUES (@nome, @categoria, @preco, @unidade, @icone, @destaque, @ativo)`
    )
    .run(dados);

  const novo = db.prepare('SELECT * FROM produtos WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json(paraProduto(novo));
});

app.put('/api/produtos/:id', exigeDono, (req, res) => {
  const existe = db.prepare('SELECT id FROM produtos WHERE id = ?').get(req.params.id);
  if (!existe) return res.status(404).json({ erro: 'Produto não encontrado.' });

  const { erro, dados } = validaProduto(req.body);
  if (erro) return res.status(400).json({ erro });

  db.prepare(
    `UPDATE produtos SET nome=@nome, categoria=@categoria, preco=@preco,
     unidade=@unidade, icone=@icone, destaque=@destaque, ativo=@ativo WHERE id=@id`
  ).run({ ...dados, id: Number(req.params.id) });

  res.json(paraProduto(db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id)));
});

app.delete('/api/produtos/:id', exigeDono, (req, res) => {
  const r = db.prepare('DELETE FROM produtos WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ erro: 'Produto não encontrado.' });
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Configuração da loja                                                */
/* ------------------------------------------------------------------ */

const CAMPOS_CONFIG = ['zap', 'pix', 'endereco', 'horario', 'taxa'];

app.get('/api/config', (req, res) => {
  const linhas = db.prepare('SELECT chave, valor FROM config').all();
  res.json(Object.fromEntries(linhas.map(l => [l.chave, l.valor])));
});

app.put('/api/config', exigeDono, (req, res) => {
  const ins = db.prepare(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'
  );
  const tx = db.transaction(() => {
    for (const campo of CAMPOS_CONFIG) {
      if (campo in req.body) ins.run(campo, String(req.body[campo] ?? '').slice(0, 200));
    }
  });
  tx();
  const linhas = db.prepare('SELECT chave, valor FROM config').all();
  res.json(Object.fromEntries(linhas.map(l => [l.chave, l.valor])));
});

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

app.post('/api/pedidos', (req, res) => {
  const { itens, pagamento, entrega } = req.body || {};
  if (!Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ erro: 'O pedido está sem itens.' });
  }
  if (entrega === 'entrega' && !String(req.body.endereco ?? '').trim()) {
    return res.status(400).json({ erro: 'Escreva o endereço da entrega.' });
  }

  // O total é recalculado aqui com os preços do banco, nunca com os que vieram do navegador.
  const buscar = db.prepare('SELECT id, nome, preco, unidade FROM produtos WHERE id = ? AND ativo = 1');
  const detalhados = [];
  let subtotal = 0;

  for (const item of itens) {
    const p = buscar.get(item.id);
    if (!p) return res.status(400).json({ erro: `Um produto do carrinho saiu da loja. Atualize a página.` });
    const qtd = Math.max(1, Math.min(99, Math.round(Number(item.qtd) || 1)));
    subtotal += p.preco * qtd;
    detalhados.push({ id: p.id, nome: p.nome, preco: p.preco, unidade: p.unidade, qtd });
  }

  const taxaLoja = Number(db.prepare("SELECT valor FROM config WHERE chave = 'taxa'").get()?.valor) || 0;
  const taxa = entrega === 'entrega' ? taxaLoja : 0;
  const total = Math.round((subtotal + taxa) * 100) / 100;

  const r = db
    .prepare(
      `INSERT INTO pedidos (cliente, itens, subtotal, taxa, total, pagamento, entrega, endereco, troco)
       VALUES (@cliente, @itens, @subtotal, @taxa, @total, @pagamento, @entrega, @endereco, @troco)`
    )
    .run({
      cliente: String(req.body.cliente ?? '').slice(0, 80) || null,
      itens: JSON.stringify(detalhados),
      subtotal: Math.round(subtotal * 100) / 100,
      taxa,
      total,
      pagamento: String(pagamento ?? 'PIX').slice(0, 40),
      entrega: entrega === 'entrega' ? 'entrega' : 'retirar',
      endereco: String(req.body.endereco ?? '').slice(0, 200) || null,
      troco: Number(req.body.troco) || null
    });

  res.status(201).json({ id: r.lastInsertRowid, itens: detalhados, subtotal, taxa, total });
});

app.get('/api/pedidos', exigeDono, (req, res) => {
  const linhas = db.prepare('SELECT * FROM pedidos ORDER BY id DESC LIMIT 100').all();
  res.json(linhas.map(p => ({ ...p, itens: JSON.parse(p.itens) })));
});

app.patch('/api/pedidos/:id', exigeDono, (req, res) => {
  const status = String(req.body?.status ?? '');
  if (!['novo', 'separando', 'entregue', 'cancelado'].includes(status)) {
    return res.status(400).json({ erro: 'Status inválido.' });
  }
  const r = db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, req.params.id);
  if (!r.changes) return res.status(404).json({ erro: 'Pedido não encontrado.' });
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */

app.use((req, res) => res.status(404).json({ erro: 'Endereço não existe nesta API.' }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ erro: 'Deu problema no servidor. Tente de novo.' });
});

app.listen(PORTA, () => {
  console.log(`\n  Eskina do Frango no ar em http://localhost:${PORTA}`);
  if (SENHA === 'trocar-essa-senha') {
    console.log('  ATENÇÃO: defina ADMIN_SENHA antes de colocar o site na internet.\n');
  }
});
