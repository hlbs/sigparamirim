# Roadmap do SIG Paramirim

O desenvolvimento será incremental, orientado por evidências e releases semânticos. As versões abaixo representam metas, não autorização automática para deploy. Cada marco deve passar pelos gates gerais e pelos gates específicos da fase.

## Gate de entrada comum

Antes de iniciar qualquer fase:

- confirmar o escopo e os arquivos sob responsabilidade;
- revisar decisões pendentes relacionadas;
- identificar riscos e dependências;
- definir critérios de aceite e testes;
- preservar mudanças existentes no repositório;
- não iniciar mutações externas sem autorização dentro do escopo.

## Fase 0 — Descoberta, baseline e arquitetura

**Release-alvo:** `v0.1.0`

**Objetivos:**

- inventariar repositório, ambiente Firebase, logo, relatório e dados geoespaciais;
- confirmar banco nomeado, bucket, regiões, Hosting e permissões;
- documentar arquitetura, ADRs, decisões pendentes e plano de releases;
- criar estrutura do monorepo, padrões de qualidade e baseline Git;
- produzir catálogo técnico inicial das camadas e relacioná-lo à planilha de fontes.

**Gate de saída:**

- arquitetura e ADRs iniciais revisados;
- dependências e riscos registrados;
- segredos ausentes do Git;
- scripts de lint, typecheck, teste e build definidos;
- inventário geoespacial diferencia arquivos existentes e camadas planejadas;
- commit de baseline e release `v0.1.0` somente após validação.

## Fase 1 — Fundação web, design system e PWA

**Release-alvo:** `v0.2.0` em conjunto com a identidade

**Objetivos:**

- configurar monorepo TypeScript, React e Vite;
- implementar tokens derivados de `#5a5e0b`, temas claro/escuro e tipografia;
- criar shell responsivo, navegação, header e loading com a logo;
- configurar manifest, service worker, atualização controlada e fallback offline;
- estabelecer testes unitários, componentes e E2E mínimos;
- preparar integração desacoplada para Electron futuro.

**Gate de saída:**

- shell utilizável em 320, 360, 390, 768, 1024, 1366 e 1920 px;
- contraste, foco, teclado e redução de movimento verificados;
- namespace `/__` excluído do fallback do service worker;
- nenhum token, PII ou conteúdo privado armazenado indevidamente no cache;
- build, lint, typecheck e testes verdes.

## Fase 2 — Autenticação, perfil, RBAC e segurança

**Release-alvo:** `v0.2.0`

**Objetivos:**

- integrar login com Google;
- criar onboarding, perfil, avatar e preferências;
- implementar papéis `user`, `editor` e `admin`;
- configurar Firestore nomeado, regras, Functions v2 e App Check;
- criar shell administrativo e trilha de auditoria inicial.

**Gate de saída:**

- provedor Google validado em ambiente autorizado;
- vinculação e conflito de contas testados;
- usuários suspensos bloqueados;
- nenhuma autopromoção possível;
- regras Firestore e Storage cobertas pelo Emulator Suite;
- Functions sensíveis exigem autenticação, autorização e App Check conforme rollout;
- decisões DP-001 a DP-010 resolvidas quando aplicáveis à produção.

## Fase 3 — Conteúdo científico e narrativa inicial

**Release-alvo:** `v0.3.0`

**Estado:** narrativa didática e auditável revisada em `v0.3.0-beta.3`, com comparação metodológica dos tempos de concentração e limites explícitos para inferências subterrâneas; gate científico de dimensionamento ainda aberto.

**Objetivos:**

- criar pipeline auditável para o relatório morfométrico;
- preservar fonte, normalizações, cálculos e dicionário de dados;
- validar referências e DOI;
- construir página inicial em scroll narrativo com visualizações acessíveis;
- apresentar limitações e incertezas sem extrapolar os dados.

O incremento beta publica apenas afirmações factuais, métricas permitidas por lista explícita e referências com DOI. Indicadores `needs_review` e interpretações da fonte são excluídos do artefato entregue ao navegador.

**Gate de saída:**

- dados recalculáveis e rastreáveis;
- problemas de codificação e unidades registrados;
- nenhuma interpretação não sustentada publicada;
- todas as afirmações científicas possuem referência conferida;
- visualizações têm alternativa textual e funcionam com redução de movimento;
- revisão técnica de hidrologia e revisão editorial concluídas.

## Fase 3.5 — Catálogo geoespacial e ingestão inicial

**Release-alvo:** `v0.3.5`

**Objetivos:**

- inventariar os 20 GeoJSON e quatro GeoTIFF iniciais;
- relacionar arquivos, fontes, anos, escalas e observações;
- validar schema, CRS, geometria, extensão, bandas, `NoData` e estatísticas;
- implementar staging, validação, derivados rastreáveis e estilos iniciais;
- testar estratégia para GeoJSON grandes sem trocar o formato canônico.

**Gate de saída:**

- originais preservados com checksum e revisão;
- camadas sem arquivo marcadas como `planned`, sem publicação fictícia;
- CRS ausente ou ambíguo bloqueia publicação;
- rasters iniciais configurados com dez intervalos iguais, cores discretas, duas casas decimais e bilinear 2×2;
- unidade, sufixo e `NoData` só são publicados após validação;
- arquivos grandes não bloqueiam a thread principal;
- licenças e atribuições estão registradas ou a camada permanece não publicada.

## Fase 4 — WebGIS, dashboard e compositor

**Release-alvo:** `v0.4.0`

**Objetivos:**

- implementar mapa OpenLayers, catálogo, identificação e legenda;
- implementar tabela de atributos virtualizada e sincronizada;
- implementar filtros vetoriais e filtros raster por faixa;
- criar painéis desktop arrastáveis/minimizáveis e equivalentes móveis adequados;
- incorporar a aba do Power BI com loading, timeout e fallback;
- implementar compositor PDF/PNG A4–A0.

**Gate de saída:**

- mapa, tabela, seleção, filtro e legenda apresentam estado consistente;
- seleção por toque possui tolerância apropriada;
- `NoData` é respeitado em filtro e classificação;
- iframe externo está isolado por CSP e possui alternativa de abertura;
- exportação aguarda fontes, tiles e símbolos e detecta CORS;
- formatos grandes respeitam orçamento de memória/pixels;
- testes de desempenho e acessibilidade aprovados.

## Fase 5 — Observatório Científico Paramirim

**Release-alvo:** `v0.5.0`

**Objetivos:**

- implementar cadastro estruturado de publicações;
- criar filtros por título, autor, área, instituição, data e flags temáticas;
- validar DOI, ORCID e duplicidades;
- gerir arquivos, fontes e revisões;
- integrar o workflow editorial.

**Gate de saída:**

- duplicidade por DOI, título normalizado e autor/ano testada;
- filtros compostos e paginação validados;
- arquivos protegidos por regras e processo de aprovação;
- editores não alteram o registro publicado diretamente;
- referências e licenças passam por validação antes da publicação.

## Fase 6 — Helpdesk, notificações e administração

**Release-alvo:** `v0.6.0`

**Objetivos:**

- implementar tickets, mensagens, anexos e histórico;
- implementar notificações in-app e histórico completo;
- criar gestão de usuários, tickets, propostas e conteúdo;
- registrar auditoria de ações sensíveis;
- notificar admins sobre tickets e propostas, e editores sobre decisões.

**Gate de saída:**

- usuário acessa somente os próprios tickets;
- editor não responde tickets;
- encerramento exige justificativa e segue a política aprovada;
- anexos passam por validação e quarentena definida;
- as cinco notificações recentes e o histórico paginado funcionam;
- eventos duplicados não geram notificações inconsistentes;
- retenção e política LGPD aprovadas.

## Fase 7 — Tradução, RTL e refinamento mobile

**Release-alvo:** `v0.7.0`

**Objetivos:**

- implementar tradução dinâmica PT, EN, ES, FR, ZH, DE e AR;
- criar cache versionado, glossário e proteção de custos;
- concluir RTL para árabe;
- revisar fluxos móveis de todos os módulos;
- concluir acessibilidade transversal.

**Gate de saída:**

- nenhuma credencial de tradução exposta no cliente;
- idioma persiste por usuário e possui fallback local;
- DOI, URL, siglas, fórmulas e valores permanecem íntegros;
- interface indica tradução automática;
- árabe funciona em RTL sem regressões de mapa, tabelas ou formulários;
- revisão humana das traduções críticas segue política aprovada.

## Fase 8 — Hardening, homologação e produção

**Releases-alvo:** `v0.9.0` e `v1.0.0`

**Objetivos:**

- concluir testes de segurança, carga, acessibilidade e recuperação;
- revisar custos, índices, backups, PITR e proteção contra exclusão;
- validar CI/CD, preview, produção e rollback;
- produzir documentação operacional e release comercial;
- publicar a versão 1.0 somente após homologação.

**Gate de saída para `v0.9.0`:**

- nenhuma vulnerabilidade crítica conhecida;
- regras e fluxos administrativos testados;
- orçamentos de desempenho atendidos;
- auditoria de dependências e segredos aprovada;
- smoke test do ambiente de preview concluído.

**Gate de saída para `v1.0.0`:**

- aceite funcional e científico registrado;
- backup e rollback testados;
- deploy de produção concluído;
- smoke test de produção aprovado;
- changelog, tag, release e versão exibida no header consistentes;
- documentação de operação, manutenção e incidentes disponível.

## Gate de release

Todo release exige, na ordem:

1. working tree revisado;
2. lint e formatação;
3. typecheck;
4. testes unitários e de integração;
5. testes de regras no Emulator Suite quando aplicáveis;
6. build reproduzível;
7. smoke E2E;
8. auditoria de dependências e segredos;
9. atualização do `CHANGELOG.md`;
10. commit em português brasileiro;
11. tag SemVer;
12. release com texto comercial sem detalhes sensíveis;
13. preview validado;
14. promoção controlada para produção;
15. smoke test e registro do rollback disponível.

Falha em qualquer gate obrigatório impede o release. Correções devem gerar nova evidência; não se deve classificar uma funcionalidade como concluída sem validação verificável.
