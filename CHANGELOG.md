# Histórico de versões

Todas as mudanças relevantes do SIG Paramirim serão registradas neste arquivo.

## [0.3.0-beta.2] - 2026-10-06

### Aprimorado

- Narrativa integralmente reescrita em linguagem didática e inclusiva, aproximando os conceitos hidrológicos do público geral sem perder precisão científica.
- Citações numéricas inseridas nos textos e referências consolidadas em uma única seção ao final da leitura.
- Seção de metodologia reposicionada como compromisso de qualidade e curadoria científica contínua.
- Composição tipográfica revisada para evitar títulos e unidades fragmentados em desktop e dispositivos móveis.

### Corrigido

- Valores e unidades agora possuem tratamento visual independente, preservando expressões como `km/km²`.
- Âncoras internas das seções adicionadas para garantir a navegação pelo botão “Conhecer a bacia”.

## [0.3.0-beta.1] - 2026-10-06

### Adicionado

- Página inicial em narrativa visual responsiva, alimentada pelos dados morfométricos rastreáveis da bacia.
- Seções acessíveis sobre dimensão, relevo, forma, drenagem e perfil longitudinal, com alternativas textuais e suporte à redução de movimento.
- Referências científicas verificáveis por DOI e indicação explícita da célula de origem e do estado de conferência de cada indicador.
- Derivado público `narrative.generated.json`, separado do conjunto científico canônico.

### Segurança científica

- Somente indicadores `source_only` ou `verified` entram no pacote narrativo.
- Interpretações originais não validadas e todos os indicadores `needs_review` são removidos antes do build do navegador.
- Textos evitam inferências causais, classificações hidrológicas ou diagnósticos não sustentados pelos dados disponíveis.

### Verificado

- Pipeline determinístico, tipos, lint, testes, build PWA e regras Firebase.
- Layout desktop e mobile, tema escuro e preferência por movimento reduzido.

## [0.2.2] - 2026-10-06

### Corrigido

- Proteção global do shell: visitantes são enviados ao login e contas pendentes ou suspensas não acessam os módulos.
- Login e criação de conta consolidados no único botão Google, com remoção da página redundante de cadastro.
- Leitura de conteúdo no Firestore restrita a contas ativas, preservando rascunhos somente para editores e administradores.
- Bootstrap de perfil tornado idempotente e limitado a identidades Google; suspensões revogam sessões renováveis.

### Adicionado

- Telas responsivas e acessíveis para cadastro em análise e conta suspensa.
- Pipeline auditável do relatório morfométrico, com checksum, proveniência por célula, recálculo de 19 relações e relatório de bloqueios científicos.
- Testes das decisões de acesso, cálculos morfométricos e regras de segurança atualizadas.

### Segurança

- Functions sensíveis conferem o papel e o estado no perfil canônico do Firestore.
- Campos de provedores de identidade não podem mais ser alterados pelo cliente.
- Visitantes, contas pendentes e contas suspensas não leem camadas, dashboards ou publicações.

## [0.2.1] - 2026-10-06

### Alterado

- Autenticação simplificada para utilizar exclusivamente contas Google.
- Removidas as integrações, opções visuais e dependências de código específicas de Facebook e Microsoft.
- Documentação, arquitetura e roadmap atualizados para refletir a decisão.

### Verificado

- Login Google disponível na interface publicada.
- Build, tipos, testes automatizados e layout responsivo revalidados.

## [0.2.0] - 2026-10-06

### Adicionado

- Interface e integração para login e criação de conta por Google, Facebook e Microsoft; a ativação dos provedores no console permanece uma configuração externa.
- Sessão persistente, perfil do usuário, avatar e estados de conta.
- Proteção de rotas e áreas específicas para usuários, editores e administradores.
- Callable Functions para bootstrap seguro de perfil e gestão administrativa de acesso.
- Fluxo inicial de propostas editoriais com aprovação, recusa, justificativa, auditoria e notificações.
- Máquina de estados editorial com validação de autoria, transições e histórico.
- Testes automatizados das regras de Firestore e Storage no Emulator Suite.
- Documentação operacional de autenticação, RBAC e bootstrap administrativo.

### Segurança

- Perfis novos recebem somente `user/pending` e são criados exclusivamente pelo backend.
- Custom claims são sincronizadas no backend e o token é renovado antes da liberação da sessão.
- Não existe autopromoção nem endpoint público para criar o primeiro administrador.
- Arquivos canônicos e decisões editoriais permanecem inacessíveis para gravação direta pelo cliente.

### Verificado

- TypeScript, lint, build PWA e build de Functions.
- 19 testes unitários de cliente e domínio.
- Oito cenários de regras Firestore/Storage nos emuladores oficiais.

## [0.1.0] - 2026-10-05

### Adicionado

- Estrutura inicial do monorepo TypeScript.
- Shell PWA responsiva com identidade visual do SIG Paramirim.
- Temas claro e escuro com persistência local.
- Navegação adaptativa para desktop e dispositivos móveis.
- Estrutura inicial para catálogo geoespacial, Firebase e documentação técnica.
- Catálogo auditável das 20 camadas GeoJSON e quatro rasters GeoTIFF iniciais.
- Contratos de estilo para vetores e rasters, incluindo classificação em intervalos iguais.
- Regras restritivas iniciais para Firestore e Storage e esqueleto de Cloud Functions.
- Manifesto, service worker, ícones instaláveis e tela base acessível da PWA.
- Documentação de arquitetura, roadmap, auditoria Firebase e decisões pendentes.

### Verificado

- Build de produção da PWA e das Cloud Functions.
- Verificação de tipos TypeScript em todos os workspaces.
- Quatro testes automatizados para classificação raster.
- Compilação das regras nos emuladores oficiais de Firestore e Storage.
- Auditoria de dependências sem vulnerabilidades altas ou críticas.
