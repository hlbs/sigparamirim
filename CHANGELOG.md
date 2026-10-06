# Histórico de versões

Todas as mudanças relevantes do SIG Paramirim serão registradas neste arquivo.

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
