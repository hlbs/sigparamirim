# SIG Paramirim

Plataforma científica, PWA e WebGIS para organização, visualização e divulgação de dados da Bacia Hidrográfica do Rio Paramirim.

## Estado do projeto

O projeto está no marco de pré-lançamento `v0.3.0-beta.18`: PWA responsiva, entrada única com Google, identidade visual modular com Font Awesome, header e menu lateral premium, perfil customizável, acesso automático após o primeiro login, proteção integral do shell, papéis, regras de segurança e fundação do fluxo editorial. A página inicial apresenta uma narrativa morfométrica didática, leitura integrada da forma, relevo, drenagem real, águas superficiais, contexto territorial baseado em fontes DOI e uma malha 3D WebGL derivada do MDE com hidrografia sobreposta e fluxo visual. O login conta com uma rede tecnológica em canvas, com conexões entre partículas e comportamento independente de scripts externos. O referencial bibliográfico dos tempos de concentração está versionado no projeto; a interface destaca Giandotti como estimativa compatível com a escala territorial publicada para a bacia e apresenta os demais resultados em uma auditoria com limites e motivos de exclusão.

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
