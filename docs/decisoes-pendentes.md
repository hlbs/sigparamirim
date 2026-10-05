# Decisões pendentes do SIG Paramirim

Este registro reúne definições que não podem ser inventadas. A ausência de uma resposta não bloqueia trabalhos independentes, mas impede a publicação ou ativação da parte afetada.

## Prioridade 0 — bloqueiam segurança ou implantação

| ID | Decisão necessária | Impacto | Gate de resolução |
| --- | --- | --- | --- |
| DP-001 | Definir os e-mails dos administradores iniciais e o processo de bootstrap | impede configuração segura do primeiro administrador | antes de promover qualquer usuário a `admin` |
| DP-002 | Confirmar a política de ativação de novos usuários | altera onboarding, regras e estados de conta | antes de liberar autenticação em produção |
| DP-003 | Confirmar quais áreas são públicas e quais exigem autenticação | afeta regras, cache, rotas e exposição de conteúdo | antes do primeiro preview público |
| DP-004 | Confirmar Hosting Site ID, domínio e domínios autorizados | afeta Auth, redirects, CSP e deploy | antes de configurar ambientes remotos |
| DP-005 | Confirmar região do `sigparamirimdb`, Functions e Storage | afeta latência, custos e residência dos dados | antes de criar Functions ou recursos dependentes |
| DP-006 | Confirmar plano de faturamento e orçamento Google Cloud/Firebase | Translation API, Functions, App Check e processamento podem gerar custos | antes de habilitar serviços cobrados |
| DP-007 | Fornecer e validar a configuração do Facebook Login | sem ela o provedor não funciona | antes do teste E2E do Facebook |
| DP-008 | Fornecer a configuração Microsoft e definir tenant único ou múltiplos tenants | altera OAuth, consentimento e público elegível | antes do teste E2E da Microsoft |
| DP-009 | Definir política LGPD, termos, privacidade e responsável por solicitações de titulares | afeta perfis, tickets, auditoria, carimbo e retenção | antes do piloto com usuários reais |
| DP-010 | Definir retenção de tickets, anexos, notificações e logs de auditoria | afeta armazenamento, deleção e compliance | antes de habilitar gravação em produção |

## Prioridade 1 — bloqueiam publicação de conteúdo ou WebGIS

| ID | Decisão necessária | Impacto | Gate de resolução |
| --- | --- | --- | --- |
| DP-011 | Confirmar CRS oficial de visualização e política de reprojeção | afeta alinhamento, escala e exportação | antes de publicar camadas |
| DP-012 | Confirmar licença e permissão de redistribuição de cada camada | pode impedir exibição ou download público | antes da publicação individual |
| DP-013 | Definir mapas-base permitidos e respectivas atribuições | afeta CSP, licenças e impressão | antes do aceite do WebGIS |
| DP-014 | Definir política de download de dados e atributos | afeta interface, regras e termos de uso | antes de expor qualquer exportação |
| DP-015 | Confirmar se edição de camada abrange apenas catálogo/estilo ou também geometria e atributos | altera profundamente o escopo do editor | antes de implementar edição geoespacial |
| DP-016 | Confirmar unidade e significado científico de `nivel_dinamico.tif`, `nivel_estatico.tif` e `profundidade.tif` | impede sufixos e interpretação confiáveis | antes da publicação desses rasters |
| DP-017 | Confirmar se zero é `NoData` ou valor válido em cada raster | afeta estatísticas, classes, filtros e legenda | antes de calcular classes finais |
| DP-018 | Definir DPI ou orçamento máximo de pixels por tamanho A4–A0 | afeta qualidade, memória e necessidade de renderização server-side | antes do aceite do compositor |
| DP-019 | Definir quais dados do usuário podem aparecer no carimbo | envolve privacidade e LGPD | antes de liberar exportação autenticada |
| DP-020 | Confirmar confidencialidade do relatório Power BI publicado na web | o link atual é público e pode expor dados subjacentes | antes de incorporá-lo em produção |

## Prioridade 2 — bloqueiam acabamento funcional

| ID | Decisão necessária | Impacto | Gate de resolução |
| --- | --- | --- | --- |
| DP-021 | Definir limites de upload por categoria e extensões auxiliares permitidas | afeta UX, regras, custos e segurança | antes do upload público/editorial |
| DP-022 | Definir se haverá varredura antimalware e política de quarentena | afeta anexos de tickets e arquivos editoriais | antes de promover uploads |
| DP-023 | Confirmar se notificações serão apenas in-app ou também push/e-mail | afeta consentimento, FCM e provedores externos | antes da fase de notificações externas |
| DP-024 | Definir expectativa de funcionamento offline | afeta cache, IndexedDB e volume de dados | antes do aceite PWA |
| DP-025 | Definir se Electron integra o primeiro release ou uma fase futura | altera pipeline, testes e distribuição | antes do congelamento de escopo da versão 1.0 |
| DP-026 | Aprovar o nome comercial “Observatório Científico Paramirim” | afeta navegação, conteúdo e divulgação | antes da revisão editorial final |
| DP-027 | Definir política de reabertura, SLA e prioridades do helpdesk | afeta estados, métricas e notificações | antes do aceite do helpdesk |
| DP-028 | Definir política de revisão humana das traduções científicas | afeta publicação e responsabilidade editorial | antes de ativar idiomas em produção |
| DP-029 | Definir glossário técnico multilíngue e responsável por sua manutenção | afeta consistência de tradução | antes do aceite da tradução científica |
| DP-030 | Definir métricas-alvo de desempenho e navegadores/dispositivos suportados | afeta critérios de aceite e otimizações | antes da homologação |

## Suposições provisórias permitidas

Enquanto as decisões permanecerem abertas, a equipe pode trabalhar com adaptadores e configuração local, respeitando estas restrições:

- nenhuma promoção automática de administrador;
- novos usuários tratados como `user` sem privilégios editoriais;
- nenhum dado presumido como público por padrão;
- nenhuma licença, CRS, unidade ou referência científica inventada;
- notificações externas desativadas;
- Electron fora do caminho crítico da PWA;
- uploads mantidos em staging, sem publicação automática;
- traduções marcadas como automáticas e nunca gravadas sobre o conteúdo canônico;
- Power BI tratado como conteúdo externo público, sem garantia de controle de acesso;
- exportações A0 limitadas por orçamento seguro até definição de DPI.

## Processo para encerrar uma decisão

Cada decisão encerrada deve registrar:

1. resposta aprovada e responsável;
2. data da decisão;
3. módulos e documentos afetados;
4. necessidade de ADR novo ou atualização de ADR existente;
5. impactos em segurança, custo, dados e cronograma;
6. critérios de teste decorrentes;
7. versão em que a decisão entrou em vigor.

