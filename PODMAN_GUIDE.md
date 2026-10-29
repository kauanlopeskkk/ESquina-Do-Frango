# Resumo para usar o Podman com Esquina do Frango

## Instalação do podman-compose

```bash
# Via pip (mais simples)
pip install podman-compose

# Ou via sistema
sudo dnf install podman-compose  # Fedora
sudo apt-get install podman-compose  # Debian/Ubuntu
```

## Iniciar os serviços

```bash
cd /home/thegozei/Documentos/GitHub/ESquina-Do-Frango
podman-compose up -d --build
```

## Acessar

- API: http://localhost:8000
- Frontend: http://localhost:8080

## Testar

```bash
# Sem autenticação
curl http://localhost:8000/ola

# Com credenciais admin (padrão: admin / trocar-essa-senha)
curl -u admin:trocar-essa-senha http://localhost:8000/produtos
```

## Parar

```bash
podman-compose down
```

## Acessar o banco de dados

```bash
# Listar containers
podman ps

# Entrar no container backend
podman exec -it <nome_do_container> sh

# Query no SQLite
sqlite3 /app/Mercado.db "SELECT * FROM produtos;"
```

## Notas importantes

1. **Arquivo criado**: PODMAN_GUIDE.md com instruções detalhadas
2. O docker-compose.yml já está configurado e deve funcionar com podman-compose
3. Credenciais admin padrão: usuário=admin, senha=trocar-essa-senha
4. Banco de dados Mercado.db é criado automaticamente na primeira inicialização