# Caderneta — hospedar na nuvem (sem usar seu Mac)

A pessoa acessa pelo celular em um link tipo:
https://caderneta-xxxx.up.railway.app

## 1) Conta
Crie conta gratuita em: https://railway.app

## 2) Projeto no GitHub (recomendado)
1. Crie um repositório privado `caderneta`
2. Suba estes arquivos:
   - index.html
   - server.js
   - package.json
   - pasta data/ (pode ir vazia; o server cria os arquivos)

## 3) Deploy no Railway
1. New Project → Deploy from GitHub → escolha `caderneta`
2. Settings → Networking → Generate Domain
3. Settings → Volumes → Add Volume
   - Mount path: `/app/data`
   (isso guarda a planilha entre restarts)

## 4) (Opcional) PIN de acesso
Variables → adicione:
CADERNETA_TOKEN=um-pin-secreto

No app, quem souber o token acessa; sem token a API fica aberta no link.

## 5) Planilha
Depois de medir, a planilha fica em:
https://SEU-DOMINIO/data/caderneta.csv

## Alternativa sem volume
Se não quiser volume, use Render/Fly com disco, ou depois migramos o storage
para um banco gratuito (Supabase/Turso). Com só o disco efêmero da nuvem,
os dados podem sumir no redeploy.
