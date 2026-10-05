# Segurança

## Comunicação responsável

Não registre vulnerabilidades, credenciais, tokens ou dados pessoais em issues públicas. Use um canal privado definido pelos responsáveis do projeto antes do primeiro release público.

## Princípios do baseline

- Regras Firestore e Storage começam em modo restritivo.
- Papéis administrativos dependem de custom claims emitidas pelo backend.
- Arquivos enviados por editores permanecem em staging até aprovação.
- Segredos não são armazenados em variáveis `VITE_*` nem versionados.
- App Check será ativado em observação antes do enforcement.
- O banco usado pela aplicação é explicitamente `sigparamirimdb`.

## Dependências

A auditoria do marco `v0.1.0` não apresenta vulnerabilidades críticas ou altas. Permanecem dois alertas moderados transitivos em `gaxios@6.7.1`/`uuid@9.0.1`, introduzidos por `@google-cloud/storage@8.2.0` via `firebase-admin@14.5.0`. Não há atualização compatível disponibilizada pelo fornecedor no momento do baseline. O risco deve ser reavaliado em cada release; não usar diretamente geração UUID v3/v5/v6 com buffers fornecidos pelo usuário.

