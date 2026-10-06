# SIG Paramirim

Plataforma científica, PWA e WebGIS para organização, visualização e divulgação de dados da Bacia Hidrográfica do Rio Paramirim.

## Estado do projeto

O projeto está no marco de pré-lançamento `v0.3.0-beta.2`: PWA responsiva, entrada única com Google, ativação administrativa, proteção integral do shell, perfis, papéis, regras de segurança e fundação do fluxo editorial. A página inicial apresenta uma narrativa morfométrica didática, factual e rastreável; interpretações e indicadores pendentes de revisão científica permanecem fora do pacote publicado.

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

## Estrutura

- `apps/web`: PWA React, Vite e OpenLayers.
- `functions`: Cloud Functions de 2ª geração.
- `packages/domain`: contratos e regras de domínio.
- `packages/firebase`: adaptadores do ecossistema Firebase.
- `packages/gis`: contratos e utilidades geoespaciais.
- `packages/ui`: design system compartilhado.
- `docs`: arquitetura, auditorias, catálogo e decisões.
