# Arquitetura do SIG Paramirim

## 1. Objetivo

Este documento estabelece a arquitetura inicial da plataforma SIG Paramirim. Ele orienta a implementação incremental de uma PWA científica, mobile-first, acessível e segura, preparada para execução no Firebase Hosting e para uma futura distribuição desktop com Electron.

A arquitetura deve sustentar cinco domínios principais:

- conteúdo científico e narrativa da Bacia Hidrográfica do Rio Paramirim;
- WebGIS baseado em OpenLayers;
- Observatório Científico Paramirim;
- helpdesk e notificações;
- gestão editorial e administração.

## 2. Princípios arquiteturais

- **Português brasileiro como idioma canônico:** conteúdo, mensagens, commits e documentação devem preservar corretamente caracteres especiais, símbolos e unidades.
- **Mobile-first real:** fluxos móveis devem usar navegação, drawers, bottom sheets e telas completas adequadas ao toque, sem reproduzir janelas desktop comprimidas.
- **Segurança em profundidade:** autorização deve ser validada na interface, nas regras Firebase e no backend. A interface nunca é a autoridade final.
- **Conteúdo canônico protegido:** editores criam propostas; somente administradores promovem alterações aprovadas ao conteúdo publicado.
- **Contratos explícitos:** dados recebidos, persistidos e expostos devem ser validados por schemas versionados.
- **Progressive enhancement:** o shell da PWA deve permanecer funcional em conectividade limitada, sem prometer acesso offline a grandes camadas geoespaciais.
- **Original preservado:** arquivos geoespaciais e científicos originais permanecem imutáveis; otimizações geram derivados rastreáveis.
- **Desempenho mensurável:** carregamento, interação do mapa, filtros, tabelas e exportação terão orçamentos e telemetria definidos antes da publicação.
- **Acessibilidade:** atender WCAG 2.2 AA, incluindo teclado, foco visível, contraste, redução de movimento e RTL para árabe.
- **Implantação reversível:** cada release deve possuir validação, evidência e estratégia de rollback.

## 3. Organização do monorepo

Estrutura-alvo:

```text
sigparamirim/
├─ apps/
│  ├─ web/                 # React, TypeScript, Vite e PWA
│  └─ desktop/             # reservado para a futura distribuição Electron
├─ functions/              # Cloud Functions for Firebase de 2ª geração
├─ packages/
│  ├─ domain/              # entidades, contratos, schemas e regras de negócio
│  ├─ firebase/            # adaptadores Firebase e autorização
│  ├─ gis/                 # contratos, processamento e integração OpenLayers
│  └─ ui/                  # tokens, componentes e padrões de interação
├─ docs/                   # arquitetura, ADRs, operação e decisões
├─ firestore.rules
├─ firestore.indexes.json
├─ storage.rules
├─ firebase.json
├─ .firebaserc
├─ .env.example
├─ CHANGELOG.md
└─ README.md
```

As dependências devem apontar para dentro dos domínios, evitando que pacotes de negócio importem detalhes de React, OpenLayers ou Firebase. `apps/web` e `functions` compõem os adaptadores externos sobre contratos compartilhados.

## 4. Stack inicial

| Área | Escolha inicial | Responsabilidade |
| --- | --- | --- |
| Aplicação web | React + TypeScript estrito + Vite | interface, roteamento e composição dos módulos |
| Mapa | OpenLayers | visualização, seleção, estilo, filtros e exportação cartográfica |
| Roteamento | React Router | rotas públicas, autenticadas e administrativas |
| Dados remotos | TanStack Query | cache, invalidação, retry e estados assíncronos |
| Estado local | Zustand ou alternativa mínima equivalente | preferências e estado serializável da interface |
| Validação | Zod | fronteiras de entrada, contratos e migrações |
| Backend | Firebase modular SDK + Functions v2 | autenticação, dados, arquivos, workflows e eventos |
| Persistência | Firestore nomeado `sigparamirimdb` | dados de aplicação e auditoria |
| Arquivos | Cloud Storage | originais, staging, derivados, anexos e exportações |
| PWA | `vite-plugin-pwa`/Workbox | manifest, shell offline e atualização controlada |
| Testes | Vitest, Testing Library, Playwright e Emulator Suite | testes unitários, integração, E2E e regras |

Versões devem ser estáveis, compatíveis e fixadas no lockfile quando o projeto for inicializado.

## 5. Módulos funcionais

### 5.1 Shell da plataforma

Responsável pelo layout responsivo, header, navegação, perfil, avatar, tema, seletor de idioma, versão e notificações. Preferências de tema e idioma terão persistência no perfil e fallback local antes do login.

### 5.2 Identidade e autorização

Provedor de identidade: Google. Os papéis canônicos serão `user`, `editor` e `admin`; o estado de conta será `pending`, `active` ou `suspended`. Custom claims transportarão somente autorização resumida. Promoção de cargos, suspensão e ações sensíveis ocorrerão no backend e gerarão auditoria.

O shell inteiro fica atrás de um portão global. O primeiro login Google cria uma conta `user/pending`; contas pendentes ou suspensas recebem telas próprias e não acessam os módulos. Não existe formulário separado de cadastro.

### 5.3 Conteúdo científico

O relatório morfométrico será importado por pipeline auditável. Valores originais, normalizações, cálculos, interpretações e referências devem permanecer distinguíveis. Nenhuma afirmação científica poderá ser publicada com DOI inventado ou não verificado.

O pipeline inicial registra checksum e célula de origem para 55 indicadores, recalcula somente relações reproduzíveis e bloqueia os indicadores quando faltam método, unidade ou referência. O arquivo original permanece externo e imutável; os JSONs versionados são derivados rastreáveis.

A Home consome um derivado público separado, `narrative.generated.json`, produzido pelo próprio pipeline. Esse arquivo contém apenas estados `source_only` e `verified`, sem o campo de interpretação da fonte. Uma lista explícita no frontend restringe os indicadores efetivamente exibidos. O conjunto canônico completo não é importado pela PWA.

### 5.4 WebGIS

O módulo será dividido em catálogo, adaptadores de fonte, interações, tabela de atributos, filtros, gerenciador de painéis, compositor cartográfico e estado do mapa. Instâncias OpenLayers não serão armazenadas em estado global serializável.

GeoJSON será o único formato vetorial aceito. GeoTIFF (`.tif`/`.tiff`) será o formato raster aceito. Arquivos grandes serão carregados sob demanda e processados fora da thread principal quando necessário. Otimizações internas deverão manter o original, checksum, parâmetros e proveniência.

Rasters iniciais usarão interpolação de cores discreta, dez classes de intervalo igual, rótulos com duas casas decimais, sufixo validado e reamostragem bilinear com vizinhança 2×2. `NoData` não participará da classificação. Essas opções continuarão configuráveis para novas camadas e passarão pelo workflow editorial.

### 5.5 Observatório Científico

Catálogo de publicações com metadados estruturados, filtros compostos, detecção de duplicidade e arquivos versionados. Inclusões e alterações feitas por editores serão propostas pendentes de aprovação.

### 5.6 Helpdesk

Tickets possuirão mensagens e eventos em subcoleções, anexos protegidos, histórico, responsável, estados e justificativa de encerramento. Usuários acessam apenas os próprios tickets; administradores gerenciam todos; editores não respondem tickets.

### 5.7 Idioma da interface

A interface é publicada em português brasileiro. A tradução automática foi retirada no beta.55 para evitar dependência de serviços externos e inconsistência entre navegadores e dispositivos. A reintrodução de outros idiomas exige nova decisão de produto e uma solução compatível com uso móvel.

### 5.8 Administração e workflow editorial

Alterações propostas serão registradas em `changeRequests`, com revisão de origem, patch validado, ator, justificativa e chave de idempotência. Aprovação ou recusa será transacional, revalidada por Function e acompanhada de evento de auditoria e notificação.

## 6. Modelo de dados de alto nível

Coleções iniciais:

```text
users/{uid}
users/{uid}/notifications/{notificationId}
users/{uid}/devices/{deviceId}
layers/{layerId}
dashboards/{dashboardId}
publications/{publicationId}
changeRequests/{requestId}
changeRequests/{requestId}/events/{eventId}
tickets/{ticketId}
tickets/{ticketId}/messages/{messageId}
tickets/{ticketId}/events/{eventId}
auditLogs/{eventId}
appConfig/public
appReleases/{version}
translationCache/{cacheKey}
```

Todos os documentos terão schema, versão, timestamps de servidor e campos de auditoria compatíveis com sua finalidade. O acesso ao Firestore deve nomear explicitamente `sigparamirimdb`; não se deve depender do banco `(default)`.

## 7. Limites de segurança

- Regras do Storage não podem consultar o banco nomeado; autorização de arquivos usará UID, claims, caminhos seguros, metadados imutáveis e promoção administrativa via Admin SDK.
- Uploads entram em `staging`, passam por validação e somente são promovidos após aprovação.
- App Check com reCAPTCHA Enterprise deve começar em observação e migrar para enforcement após análise.
- Functions acionadas por eventos serão idempotentes porque a entrega pode ocorrer mais de uma vez e fora de ordem.
- Segredos backend ficarão no Secret Manager. Arquivos `.env` reais jamais serão versionados; apenas `.env.example` sem valores reais será permitido.
- Logs de auditoria devem registrar o necessário para rastreabilidade sem expor dados pessoais desnecessários.

## 8. PWA e compatibilidade Electron

O service worker deve fornecer shell offline, fallback claro e atualização controlada, excluindo o namespace `/__` reservado pelo Firebase. Tokens, PII, anexos privados e respostas administrativas não serão cacheados. Grandes vetores e rasters não terão cache automático.

A aplicação web não dependerá de APIs Node. Uma futura aplicação Electron encapsulará o build web e usará `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` e preload tipado com superfície mínima.

## 9. Observabilidade e qualidade

Serão medidos, no mínimo:

- tempo até o shell interativo;
- tempo até o mapa interativo;
- tempo de troca de camada e aplicação de filtro;
- abertura da tabela de atributos;
- tempo e memória de exportação;
- tamanho do bundle inicial;
- falhas de autenticação, Functions e processamento geoespacial.

Os logs devem usar correlação, severidade e identificadores técnicos, sem incluir tokens ou conteúdo sensível.

## 10. ADRs iniciais

### ADR-001 — Monorepo TypeScript orientado a domínios

- **Status:** aceito.
- **Decisão:** separar aplicações, Functions e pacotes compartilhados em um único repositório, com TypeScript estrito.
- **Motivo:** compartilhar contratos e validação, reduzir divergência entre frontend e backend e manter fronteiras testáveis.
- **Consequência:** será necessário configurar workspaces, build incremental e regras de importação.

### ADR-002 — React, Vite e OpenLayers para a aplicação web

- **Status:** aceito.
- **Decisão:** utilizar React e Vite para o shell PWA, com OpenLayers como motor cartográfico.
- **Motivo:** atender ao escopo aprovado e permitir composição modular, carregamento sob demanda e ferramentas SIG avançadas.
- **Consequência:** integrações entre o ciclo de vida do React e objetos imperativos do OpenLayers deverão ficar encapsuladas.

### ADR-003 — Firebase como plataforma de aplicação

- **Status:** aceito com validação de ambiente.
- **Decisão:** utilizar Hosting, Authentication, Firestore nomeado, Storage, Functions v2 e App Check.
- **Motivo:** o projeto Firebase existente é o destino autorizado e cobre autenticação, persistência, arquivos e implantação.
- **Consequência:** região, plano, domínios OAuth, banco e regras precisam ser auditados antes do deploy.

### ADR-004 — Conteúdo editorial baseado em propostas

- **Status:** aceito.
- **Decisão:** editores não alteram entidades canônicas; criam propostas que exigem decisão administrativa justificada.
- **Motivo:** garantir governança, revisão, notificações e rollback.
- **Consequência:** a implementação exige revisões otimistas, transações, histórico e promoção segura de arquivos.

### ADR-005 — GeoJSON como único formato vetorial de entrada

- **Status:** aceito.
- **Decisão:** aceitar somente `.geojson`, preservando o original e permitindo derivados internos também em GeoJSON.
- **Motivo:** requisito explícito do produto e simplificação do pipeline de ingestão.
- **Consequência:** arquivos grandes exigem particionamento, simplificação documentada, compressão e parsing em worker.

### ADR-006 — Tradução dinâmica por backend

- **Status:** aceito.
- **Decisão:** traduzir a página em tempo real, sem duplicar páginas por idioma, usando cache e API encapsulada no backend.
- **Motivo:** manter uma única fonte canônica e proteger credenciais e controle de custos.
- **Consequência:** conteúdo científico crítico precisa de revisão e a interface deve sinalizar tradução automática.

### ADR-007 — PWA primeiro, Electron desacoplado

- **Status:** aceito.
- **Decisão:** entregar primeiro uma PWA hospedável; reservar `apps/desktop` para fase posterior.
- **Motivo:** reduzir complexidade inicial e preservar portabilidade.
- **Consequência:** funcionalidades não podem depender diretamente do sistema operacional.

### ADR-008 — Releases semânticos por grandes marcos

- **Status:** aceito.
- **Decisão:** usar SemVer, changelog, tags e releases comerciais em português brasileiro após os gates de qualidade.
- **Motivo:** garantir rastreabilidade e comunicação clara da evolução.
- **Consequência:** não haverá release se gates obrigatórios falharem.

## 11. Gate arquitetural global

Uma fase só pode avançar quando:

1. seus contratos e decisões estiverem documentados;
2. riscos críticos tiverem mitigação ou aceite explícito;
3. lint, typecheck, testes aplicáveis e build estiverem verdes;
4. regras de segurança afetadas tiverem testes no Emulator Suite;
5. acessibilidade e responsividade aplicáveis forem verificadas;
6. não houver segredos, credenciais ou dados pessoais indevidos no Git ou no bundle;
7. houver evidência de revisão e estratégia de rollback para mudanças persistentes.
