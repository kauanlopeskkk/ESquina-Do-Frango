# Solução Rápida para Permissão do Docker

## Execute estes comandos no terminal:

### 1. Adicionar usuário ao grupo docker
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Verificar se Docker daemon está rodando
```bash
# Se estiver rodando como serviço
sudo systemctl start docker

# Ou iniciar manualmente
dockerd &>/tmp/dockerd.log &

# Testar conexão
docker version
```

### 3. Testar agora (sem reiniciar)
```bash
docker ps
```

### 4. Iniciar o projeto
```bash
cd /home/thegozei/Documentos/GitHub/ESquina-Do-Frango
docker-compose up -d --build
```

### 5. Testar
```bash
# API funcionando
curl http://localhost:8000/ola

# Com admin
curl -u admin:trocar-essa-senha http://localhost:8000/produtos
```

### 6. Acessar banco de dados
```bash
docker ps                          # Listar containers
docker exec -it <container> sh     # Entrar no backend
sqlite3 /app/Mercado.db "SELECT * FROM produtos;"  # Ver dados
```

### 7. Parar quando terminar
```bash
docker-compose down
```

## Importante
- Feche e abra o terminal novamente após o `usermod` para as alterações funcionarem
- Se estiver no WSL: `wsl --shutdown` e abra novamente
- O socket do Docker deve estar em `/var/run/docker.sock`

Arquivo detalhado criado: `DOCKER_FIX.md`