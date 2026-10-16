# Caderneta — Planilha Google

O app (GitHub Pages) salva no aparelho e, se conectado, também nesta planilha.
Endereço e chave ficam só no aparelho — nunca no código.

## Instalar
1. Crie uma planilha em https://sheets.new
2. Extensões → Apps Script → apague o conteúdo e cole `Code.gs` → salvar
3. Configurações do projeto (engrenagem) → Propriedades do script → adicionar
   `TOKEN` = uma chave longa e aleatória
4. Implantar → Nova implantação → tipo **App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Autorize e copie o endereço que termina em `/exec`

## Conectar o app
- No app: Ajustes → Planilha Google → cole endereço e chave → Conectar, ou
- abra `https://cleber-sanches.github.io/caderneta/#sync=<endereço>&k=<chave>`
  e, nessa mesma página, Compartilhar → Adicionar à Tela de Início.

## Abas
- **Medições**: uma linha por medida (pode ler e filtrar; é regravada a cada envio)
- **_dados** (oculta): cópia completa usada pelo app — não editar
