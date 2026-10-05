# Auditoria Firebase — Fase 0

Data da auditoria: 5 de outubro de 2026  
Projeto-alvo: `ppgeol-tools`  
Escopo: inventário somente leitura de Firebase CLI, projeto, app Web, Hosting, Firestore, Functions e Storage.

## Resumo executivo

O projeto `ppgeol-tools` está ativo no Firebase e possui um app Web ativo chamado **SIG Paramirim**, um site padrão do Firebase Hosting e o banco Firestore nomeado `sigparamirimdb`. O banco está em modo Native, na multirregião `nam5`, mas foi encontrado sem proteção contra exclusão, sem Point-in-Time Recovery (PITR), sem agenda de backup e sem índices compostos ou sobrescritas de campo cadastrados.

O diretório local ainda não era um projeto Firebase no início desta auditoria: não havia `firebase.json` nem `.firebaserc`, e por isso não existia projeto Firebase ativo localmente. Todas as consultas bem-sucedidas usaram `--project ppgeol-tools` explicitamente.

A API do Cloud Functions retornou o estado `SERVICE_DISABLED`. O inventário de funções não pôde ser concluído e não se deve interpretar a falha como prova de que não existem funções. O bucket informado é coerente com o rótulo de bucket padrão existente no projeto, porém suas propriedades de segurança não puderam ser lidas com as credenciais ativas no Google Cloud CLI.

Nenhum recurso remoto foi alterado, nenhuma API foi habilitada e nenhum deploy foi executado.

## Achados confirmados

| Área | Achado | Evidência de leitura | Situação |
|---|---|---|---|
| CLI | Firebase CLI `15.11.0` | `firebase --version` | Confirmado |
| Projeto | `ppgeol-tools`, número `993762485943`, estado `ACTIVE` | `firebase projects:list --json` | Confirmado |
| App Web | App ativo com nome de exibição `SIG Paramirim` | `firebase apps:list --project ppgeol-tools --json` | Confirmado |
| Hosting | Site padrão `ppgeol-tools` | `firebase hosting:sites:list --project ppgeol-tools --json` | Confirmado |
| Hosting | URL padrão `https://ppgeol-tools.web.app` | `firebase hosting:sites:get ppgeol-tools --project ppgeol-tools --json` | Confirmado |
| Firestore | Banco nomeado `sigparamirimdb` | `firebase firestore:databases:get sigparamirimdb --project ppgeol-tools --json` | Confirmado |
| Firestore | Localização `nam5` | mesmo comando | Confirmado |
| Firestore | Tipo `FIRESTORE_NATIVE`, edição `STANDARD` | mesmo comando | Confirmado |
| Firestore | Concorrência pessimista e atualizações em tempo real habilitadas | mesmo comando | Confirmado |
| Firestore | Retenção de versões de `3600s` | mesmo comando | Confirmado |
| Firestore | PITR desabilitado | mesmo comando | Risco aberto |
| Firestore | Proteção contra exclusão desabilitada | mesmo comando | Risco aberto |
| Firestore | Nenhum índice composto e nenhuma sobrescrita de campo | `firebase firestore:indexes --database sigparamirimdb --project ppgeol-tools --json` | Confirmado |
| Firestore | Nenhuma agenda de backup | `firebase firestore:backups:schedules:list --database sigparamirimdb --project ppgeol-tools --json` | Risco aberto |
| Functions | `cloudfunctions.googleapis.com` retornou `SERVICE_DISABLED` | consultas somente leitura pelos CLIs Firebase e Google Cloud | Pendente |
| Storage | O projeto possui rótulo indicando criação do bucket padrão | `firebase projects:list --json` | Confirmado parcialmente |
| Storage | Bucket esperado: `gs://ppgeol-tools.firebasestorage.app` | escopo fornecido e rótulo do projeto | Configuração não verificada |

## Contexto local e credenciais

- No início da auditoria, o repositório não continha `firebase.json` nem `.firebaserc`. O comando `firebase use` falhou corretamente por não estar em um diretório Firebase inicializado.
- O Google Cloud CLI estava com outro projeto ativo (`geoanalytics-6879a`), não `ppgeol-tools`.
- As credenciais do Firebase CLI conseguiram consultar projeto, apps, Hosting e Firestore.
- As credenciais ativas do Google Cloud CLI não possuíam permissão para descrever o Firestore, listar/descrever buckets ou listar serviços de `ppgeol-tools`.
- Não trocar automaticamente conta ou projeto global. A automação deve sempre informar `--project ppgeol-tools` e verificar a identidade ativa antes de qualquer operação futura.

## Riscos de segurança e operação

### Prioridade alta

1. **Exclusão acidental do banco:** `sigparamirimdb` está sem proteção contra exclusão.
2. **Recuperação insuficiente:** PITR está desabilitado e não existe agenda de backup detectável.
3. **Risco de direcionamento ao projeto errado:** o Google Cloud CLI aponta para outro projeto e o repositório ainda não possui associação Firebase local.
4. **Configuração do Storage não auditada:** não foi possível confirmar localização, Uniform Bucket-Level Access, Public Access Prevention, versionamento, retenção, ciclo de vida, CORS ou regras implantadas.
5. **Functions indisponível para inventário:** a API retornou `SERVICE_DISABLED`; os fluxos de aprovação, notificações, tickets e processamento geoespacial não devem ser considerados disponíveis até verificação explícita.

### Prioridade média

1. **Banco nomeado:** toda inicialização cliente/Admin SDK, regra, índice, gatilho e teste deve apontar explicitamente para `sigparamirimdb`; depender de `(default)` pode causar leitura ou escrita no banco errado.
2. **Índices ausentes:** as consultas compostas previstas para notificações, tickets, catálogo de camadas, publicações e aprovações exigirão índices versionados e testados antes de produção.
3. **Regras do Storage e Firestore:** a autorização não pode depender apenas da interface. Como as regras do Storage não devem depender de consultas ao banco nomeado para decidir papéis, usar claims mínimas, caminhos com ownership e promoção administrativa via backend.
4. **Inconsistência de credenciais:** Firebase CLI e Google Cloud CLI não compartilham o mesmo contexto operacional verificado. Isso prejudica auditorias, deploys reproduzíveis e resposta a incidentes.
5. **Ausência de configuração versionada:** sem `firebase.json`, `.firebaserc`, regras e índices no repositório, não há baseline auditável nem deploy reproduzível.

## Itens não verificados

- Provedores Google, Facebook e Microsoft habilitados no Authentication.
- Domínios autorizados, política de criação de conta e configuração de tenant Microsoft.
- Estado do App Check e enforcement por produto.
- Regras atualmente implantadas no Firestore e no Storage.
- Conteúdo, permissões IAM e propriedades avançadas do bucket.
- Canais, versões e releases já publicados no Hosting.
- Existência efetiva de funções implantadas.
- APIs auxiliares para Functions de 2ª geração, como Cloud Run, Eventarc, Artifact Registry e Secret Manager.
- Orçamento, alertas, logs, retenção de auditoria e política LGPD.

## Decisões pendentes antes da implementação remota

1. Confirmar a conta operacional autorizada para Firebase e Google Cloud e alinhar os dois CLIs.
2. Definir se `ppgeol-tools` continuará compartilhado com outras ferramentas ou se o SIG Paramirim terá isolamento adicional por site, bucket, projeto ou ambiente.
3. Definir região das Functions compatível com `nam5`, latência esperada e serviços utilizados.
4. Aprovar habilitação das APIs necessárias para Functions de 2ª geração; não habilitá-las implicitamente.
5. Aprovar proteção contra exclusão, PITR e agenda de backups, considerando custo e RPO/RTO.
6. Definir política de Storage: acesso público, versionamento, retenção, CORS, limpeza de staging e quarentena de anexos.
7. Definir administradores iniciais, política de custom claims e procedimento controlado de bootstrap.
8. Confirmar provedores de Authentication, credenciais OAuth externas, domínios e URLs de redirecionamento.
9. Definir App Check em observação e critérios para posterior enforcement.
10. Definir ambientes de desenvolvimento, homologação e produção, evitando testar regras ou Functions diretamente em produção.

## Comandos de verificação reproduzíveis

Todos os comandos abaixo são de leitura. Manter o projeto explícito e revisar a conta ativa antes de executá-los.

```powershell
firebase --version
firebase projects:list --json
firebase apps:list --project ppgeol-tools --json
firebase hosting:sites:list --project ppgeol-tools --json
firebase hosting:sites:get ppgeol-tools --project ppgeol-tools --json
firebase firestore:databases:list --project ppgeol-tools --json
firebase firestore:databases:get sigparamirimdb --project ppgeol-tools --json
firebase firestore:indexes --database sigparamirimdb --project ppgeol-tools --json
firebase firestore:backups:schedules:list --database sigparamirimdb --project ppgeol-tools --json
firebase functions:list --project ppgeol-tools --json

gcloud auth list --filter=status:ACTIVE
gcloud config get-value project
gcloud firestore databases describe --database=sigparamirimdb --project=ppgeol-tools --format=json
gcloud storage buckets describe gs://ppgeol-tools.firebasestorage.app --format=json
gcloud functions list --project=ppgeol-tools --v2 --format=json
gcloud services list --enabled --project=ppgeol-tools
```

Não executar comandos que ofereçam habilitar APIs interativamente durante uma auditoria somente leitura. Usar modo não interativo ou responder negativamente até haver aprovação específica.

## Gate recomendado para a próxima fase

Antes de qualquer deploy:

- versionar `firebase.json`, `.firebaserc`, regras e índices após revisão;
- garantir seleção explícita de `sigparamirimdb` nos SDKs e em testes;
- alinhar credenciais dos CLIs sem expor tokens ou arquivos de conta de serviço;
- decidir proteção contra exclusão, PITR e backups;
- auditar regras e propriedades do Storage com uma conta que possua somente as permissões de leitura necessárias;
- confirmar Authentication e App Check;
- executar regras no Emulator Suite;
- usar preview de Hosting e smoke test antes da promoção para produção.

## Registro de não alteração

Esta auditoria não:

- inicializou o Firebase no repositório;
- habilitou APIs;
- mudou o projeto ativo;
- criou ou alterou apps, sites, bancos, índices, backups, funções ou buckets;
- leu valores de segredos;
- executou deploy.
