# Eskina do Frango e Frios — site com backend

Site do mercadinho com catálogo, carrinho, checkout e área do dono protegida por senha.
Os produtos, a configuração da loja e os pedidos ficam salvos num banco de dados SQLite.

## O que tem dentro

```
server.js          o servidor e a API
db.js              o banco de dados e as tabelas
public/            o site que o cliente vê
  index.html
  estilo.css
  loja.js
Dockerfile         para rodar em container
compose.yml        para subir com Podman ou Docker
.env.example       modelo do arquivo de senhas
```

## Rodando no seu PC (jeito mais simples)

Você precisa do Node.js 20 ou mais novo. Baixe em https://nodejs.org

Abra o PowerShell dentro da pasta do projeto e rode:

```bash
npm install
```

Depois crie o arquivo `.env` (copiando o `.env.example`) e escolha sua senha:

```
ADMIN_SENHA=a-senha-que-voce-escolher
PORTA=3000
```

Agora suba o servidor:

```bash
node --env-file=.env server.js
```

Abra http://localhost:3000 no navegador. Na primeira vez o banco é criado sozinho
com 16 produtos de exemplo.

## Rodando com Podman

```bash
podman build -t eskina .
podman run -d --name eskina-loja -p 3000:3000 \
  -e ADMIN_SENHA="a-senha-que-voce-escolher" \
  -v eskina-dados:/app/dados \
  eskina
```

Ou de uma vez com o compose:

```bash
podman compose up -d
```

O volume `eskina-dados` guarda o banco fora do container — pode reconstruir a
imagem à vontade que os produtos e pedidos continuam lá.

## Primeiros passos no site

1. Desça até **Área do dono** e entre com a senha do `.env`
2. Na aba **Dados da loja**, preencha WhatsApp, chave PIX, endereço, horário e a taxa de entrega
3. Na aba **Produtos**, apague os exemplos e cadastre o que você realmente vende
4. A aba **Pedidos** mostra tudo que o cliente pediu pelo site, com status para acompanhar

Sem o WhatsApp cadastrado o botão de finalizar pedido não funciona — é ele que recebe o pedido.

## A API

Tudo que é público não precisa de senha. O que muda a loja exige o cabeçalho
`Authorization: Bearer <token>`, que você pega no `POST /api/login`.

| Método | Endereço             | Precisa de senha | O que faz                          |
|--------|----------------------|------------------|------------------------------------|
| POST   | `/api/login`         | não              | troca a senha por um token de 8h   |
| POST   | `/api/logout`        | sim              | encerra a sessão                   |
| GET    | `/api/produtos`      | não              | lista os produtos da loja          |
| POST   | `/api/produtos`      | sim              | cadastra um produto                |
| PUT    | `/api/produtos/:id`  | sim              | edita um produto                   |
| DELETE | `/api/produtos/:id`  | sim              | apaga um produto                   |
| GET    | `/api/config`        | não              | dados da loja                      |
| PUT    | `/api/config`        | sim              | salva os dados da loja             |
| POST   | `/api/pedidos`       | não              | registra um pedido                 |
| GET    | `/api/pedidos`       | sim              | últimos 100 pedidos                |
| PATCH  | `/api/pedidos/:id`   | sim              | muda o status do pedido            |

Um detalhe importante: quando o cliente fecha o pedido, o servidor **recalcula o
total** usando os preços que estão no banco, e não os que vieram do navegador.
Isso evita que alguém mexa no preço pelo console e peça frango por um centavo.

## Backup

O banco inteiro é um arquivo só: `dados/loja.db`. Copiar esse arquivo é o backup.
No Podman, ele está dentro do volume `eskina-dados`:

```bash
podman cp eskina-loja:/app/dados/loja.db ./backup-loja.db
```

## Antes de colocar na internet

- Troque a `ADMIN_SENHA` por uma senha longa e que você não use em outro lugar
- Coloque o site atrás de HTTPS (o Caddy, o Nginx ou a própria hospedagem resolvem)
- Se for hospedar em serviço gratuito que apaga o disco, troque o SQLite por um
  banco gerenciado (Postgres do Supabase ou do Neon, por exemplo) — só o `db.js` muda
