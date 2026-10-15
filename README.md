# SIG Paramirim

Plataforma científica, PWA e WebGIS para organização, visualização e divulgação de dados da Bacia Hidrográfica do Rio Paramirim.

## Estado do projeto

O SIG Paramirim está na versão estável `1.0.3`: uma plataforma científica com PWA, WebGIS, dashboards, acervo do Observatório, gestão editorial e conteúdo morfométrico sobre a Bacia Hidrográfica do Rio Paramirim. A versão atual reorganiza a seção “Resposta à chuva”, apresentando equações em notação matemática e distinguindo a faixa de aplicação dos métodos de uma calibração hidrológica regional. O histórico de cada versão registra em linguagem simples as mudanças entregues.

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
