# SIG Paramirim

Plataforma científica, PWA e WebGIS para organização, visualização e divulgação de dados da Bacia Hidrográfica do Rio Paramirim.

## Estado do projeto

O projeto está no marco de pré-lançamento `v0.3.0-beta.60`: PWA responsiva, entrada única com Google, papéis e permissões, atendimento com histórico, notificações, cancelamento de chamados e anexos privados, e WebGIS para explorar camadas raster e vetoriais. Na central de atendimento, qualquer solicitante pode abrir um chamado sem definir a urgência; apenas administradores classificam a prioridade. O formulário informa os mínimos de assunto e descrição para evitar chamados vazios. Solicitantes podem cancelar chamados em andamento sem apagar o histórico e anexar até cinco imagens ou PDFs por mensagem. Editores podem propor camadas e ajustes, mas as alterações só entram no mapa depois de aprovadas por um administrador; administradores podem publicar diretamente. Os arquivos aprovados seguem para o Firebase Storage em `webgis/raster` ou `webgis/vetor`, e o catálogo do mapa acompanha as publicações em tempo real. A Área Editorial também inclui uma ação administrativa para migrar as camadas já publicadas para essa estrutura. A plataforma está em português do Brasil e não depende de serviço externo para traduzir a interface. O projeto também reúne conteúdo territorial e morfométrico, dashboards, impressão cartográfica, perfis de usuários e fontes documentadas. Cada release registra em linguagem simples as mudanças entregues.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local` e preencha apenas as variáveis públicas necessárias.
2. Instale as dependências com `npm install`.
3. Execute `npm run dev`.
4. Verifique tipos com `npm run typecheck`.
5. Gere o build com `npm run build`.

Para regenerar os dados morfométricos auditáveis, execute `npm run import:morphometry -- <caminho-do-relatorio.xlsx>`.

Os emuladores usam, por padrão, Firestore em `127.0.0.1:8180`, Storage em
`127.0.0.1:9199` e a interface de inspeção em `127.0.0.1:4000`.

Arquivos `.env*` reais, tokens e segredos nunca devem ser versionados.

## Releases

Cada versão deve ser criada com uma tag semântica `v*` e enviada ao GitHub. O workflow `.github/workflows/release.yml` transforma automaticamente toda tag publicada em um GitHub Release, evitando que uma versão exista apenas como commit ou tag. Para uma nova entrega: atualize a versão dos workspaces, registre a entrada no `CHANGELOG.md`, faça o commit, crie a tag anotada e execute `git push origin main --tags`.

## Estrutura

- `apps/web`: PWA React, Vite e OpenLayers.
- `functions`: Cloud Functions de 2ª geração.
- `packages/domain`: contratos e regras de domínio.
- `packages/firebase`: adaptadores do ecossistema Firebase.
- `packages/gis`: contratos e utilidades geoespaciais.
- `packages/ui`: design system compartilhado.
- `docs`: arquitetura, auditorias, catálogo e decisões.
