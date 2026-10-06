# Autenticação e controle de acesso

## Objetivo do marco v0.2.0

Este marco estabelece autenticação social, perfil de usuário e autorização por papéis sem criar um caminho de autopromoção. O banco utilizado por cliente, regras e backend é sempre o Firestore nomeado `sigparamirimdb`.

## Provedor de identidade

A plataforma utiliza exclusivamente o Google como provedor de login. A decisão reduz dependências externas, elimina a gestão de segredos OAuth próprios de Meta e Microsoft e simplifica o suporte ao usuário. O provedor Google deve permanecer habilitado no Firebase Authentication, com `ppgeol-tools.web.app` e `ppgeol-tools.firebaseapp.com` entre os domínios autorizados.

## Primeiro acesso

1. O usuário seleciona `Continuar com Google`; o mesmo fluxo cria a identidade no primeiro acesso e autentica nos seguintes.
2. A callable Function `bootstrapProfile` cria `users/{uid}` se o perfil ainda não existir.
3. Todo perfil novo recebe `role=user` e `accountStatus=pending`.
4. As custom claims correspondentes são emitidas pelo backend.
5. O cliente renova o token e apresenta uma tela exclusiva de análise, sem renderizar o shell nem o conteúdo da plataforma.

Não existe cadastro separado. A rota legada `/criar-conta` apenas redireciona para `/entrar`.

## Papéis e estados

- `user`: consulta áreas autorizadas e gerencia as próprias preferências.
- `editor`: propõe mudanças em camadas, dashboards e publicações; não aprova a própria proposta e não responde tickets.
- `admin`: gerencia acessos, revisa propostas e opera módulos administrativos.
- `pending`: conta criada, aguardando ativação administrativa.
- `active`: conta autorizada a usar as funções correspondentes ao papel.
- `suspended`: conta bloqueada nas regras e funções protegidas.

O frontend nunca é a fonte de autoridade. Regras Firestore/Storage e callable Functions validam sessão, estado e papel novamente.

## Fronteiras de acesso

- `/entrar` é a única página de entrada anônima.
- `/status-conta` é acessível somente para apresentar os estados `pending` e `suspended`.
- todas as demais rotas passam pelo portão global e exigem `accountStatus=active`;
- conteúdo publicado no Firestore exige conta ativa; rascunhos exigem editor ou administrador ativo;
- o perfil próprio pode ser lido por uma conta pendente para compor o estado de onboarding, mas notificações, dispositivos e arquivos permanecem bloqueados;
- campos de identidade, papéis e status são mantidos pelo backend e não podem ser alterados pelo cliente.

## Bootstrap do primeiro administrador

Não existe e não deve existir endpoint público para criar o primeiro administrador. O procedimento operacional exige que o responsável informe o UID ou e-mail aprovado e que um operador com credenciais administrativas aplique uma única vez as claims `role=admin` e `accountStatus=active`, registrando a justificativa. Depois desse bootstrap, alterações comuns são feitas por `adminUpdateUserAccess`.

## Fluxo editorial inicial

- Editores e administradores ativos enviam propostas por `submitChangeRequest`.
- A proposta entra como `pending` e notifica administradores ativos.
- Apenas administradores ativos decidem por `reviewChangeRequest`.
- Aprovação e recusa exigem justificativa e geram evento imutável e notificação ao autor.
- Neste marco, aprovar registra a decisão; a promoção transacional do conteúdo canônico será implementada junto ao módulo específico.

## App Check

As Functions aceitam a variável de ambiente server-side `ENFORCE_APP_CHECK=true`. O enforcement permanece desligado enquanto o aplicativo não possuir provedor App Check configurado e telemetria de rollout; ativá-lo antes disso bloquearia clientes legítimos.

## Limitações conhecidas

- A política de acesso permanece dependente da definição formal do e-mail/UID do primeiro administrador.
- A sincronização entre documento de perfil e custom claims é compensável, mas não atômica entre serviços; falhas devem ser auditadas e reprocessadas.
- Contas que acabaram de ser ativadas usam `Verificar acesso` para renovar a sessão; suspensões revogam refresh tokens e as Functions sensíveis consultam o perfil canônico.
