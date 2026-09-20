# 🍗 Esquina do Frango e Frios

> **Mercadinho online com sabor de bairro — qualidade, variedade e preço justo em Pernambuco.**

<div align="center">

  <img src="https://img.shields.io/badge/Status-Em%20desenvolvimento-green" alt="status" />
  <img src="https://img.shields.io/badge/Frontend-HTML%2BJS-blue" alt="frontend" />
  <img src="https://img.shields.io/badge/Backend-Python-orange" alt="backend" />

</div>

---

## ✨ O que é o projeto

A **Esquina do Frango e Frios** é uma plataforma para **modernizar um mercadinho físico**, permitindo que clientes:

- ✅ Visualizem produtos e preços
- ✅ Filtrarem por categoria
- ✅ Abrirem detalhes em modal (imagem, descrição e preço)
- ✅ Fazem pedidos via WhatsApp

---

## 🎯 Funcionalidades

### Para clientes

- 🛍️ Catálogo de produtos com filtros
- 🧾 Modal de detalhes do produto (imagem + preço)
- 📲 Checkout simples via WhatsApp (sem complicação)

### Para o administrador (futuro/estrutura)

- 🏷️ Gerenciamento de produtos/categorias
- 📦 Controle de estoque e preços
- 🔔 Promoções e avisos (quando integrado)

---

## 🧩 Tecnologias

- **Frontend:** HTML, CSS, JavaScript (e assets locais)
- **Backend:** Python (`API_Frango.py`)
- **Deploy:** `docker-compose.yml`

> Ajuste aqui se você estiver usando mais libs (ex: FastAPI/Django, banco de dados etc.).

---

## 🚀 Como rodar localmente

1. Suba os serviços com Docker:

   ```bash
   docker-compose up --build
   ```

2. Abra o site no navegador (conforme o `nginx.conf`/porta do container).

> Se você preferir rodar sem Docker, me diga como está o seu `API_Frango.py` (framework/servidor) que eu adapto o passo a passo certinho.

---

## 📁 Estrutura (do seu workspace)

```
ESquina-Do-Frango/
├─ docker-compose.yml
├─ pyproject.toml / requirements.txt
├─ SIte Esquina Do Frango Front-End/
│  ├─ EskinaDoFrango.html
│  ├─ style.css
│  ├─ assets/
│  │  ├─ favicon.ico
│  │  └─ js/main.js
│  └─ Back-end API/
│     ├─ API_Frango.py
│     └─ dockerfile
└─ README.md
```

---

## 🖼️ Como adicionar imagens dos produtos

1. Coloque suas imagens em:

   `SIte Esquina Do Frango Front-End/assets/imagens/`

2. No `main.js`, ao renderizar os cards/detalhes, passe o caminho para o `<img id="modal-imagem">`.

Exemplo de caminho:

- `assets/imagens/coxinha.jpg`

---

## 🤝 Contribuindo

Quer melhorar o projeto? Bora!

1. Crie uma branch (`feature/nomedaideia`)
2. Commit (`git commit -m "..."`)
3. Abra um Pull Request

---

## 📝 Licença

MIT — veja o arquivo `LICENSE`.

---

<p align="center">
  Feito com ❤️ em Pernambuco
</p>