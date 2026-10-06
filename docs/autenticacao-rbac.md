# Autenticação e controle de acesso

## Objetivo do marco v0.2.0

Este marco estabelece autenticação social, perfil de usuário e autorização por papéis sem criar um caminho de autopromoção. O banco utilizado por cliente, regras e backend é sempre o Firestore nomeado `sigparamirimdb`.

## Provedores

A interface oferece Google, Facebook e Microsoft. Cada provedor somente funciona depois de ser habilitado no Firebase Authentication e de seus domínios, identificadores e segredos serem configurados no console. Segredos de OAuth nunca pertencem ao repositório nem a variáveis `VITE_*`.

Na verificação remota de 6 de outubro de 2026, os três provedores ainda não possuíam configuração no projeto. Google exige a seleção da conta de suporte e um cliente OAuth; Facebook e Microsoft exigem, adicionalmente, os identificadores e segredos emitidos pelas respectivas plataformas. O código está publicado, mas o login social só conclui depois dessa configuração externa.

## Primeiro acesso

1. O usuário autentica com um provedor habilitado.
2. A callable Function `bootstrapProfile` cria `users/{uid}` se o perfil ainda não existir.
3. Todo perfil novo recebe `role=user` e `accountStatus=pending`.
4. As custom claims correspondentes são emitidas pelo backend.
5. O cliente renova o token e apresenta o estado de análise, sem conceder acesso editorial.

## Papéis e estados

- `user`: consulta áreas autorizadas e gerencia as próprias preferências.
- `editor`: propõe mudanças em camadas, dashboards e publicações; não aprova a própria proposta e não responde tickets.
- `admin`: gerencia acessos, revisa propostas e opera módulos administrativos.
- `pending`: conta criada, aguardando ativação administrativa.
- `active`: conta autorizada a usar as funções correspondentes ao papel.
- `suspended`: conta bloqueada nas regras e funções protegidas.

O frontend nunca é a fonte de autoridade. Regras Firestore/Storage e callable Functions validam sessão, estado e papel novamente.

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

- Facebook e Microsoft dependem de credenciais externas ainda não presentes no projeto.
- O e-mail/UID do primeiro administrador precisa ser formalmente definido.
- A sincronização entre documento de perfil e custom claims é compensável, mas não atômica entre serviços; falhas devem ser auditadas e reprocessadas.
- Contas que acabaram de receber novas claims precisam renovar o token.
