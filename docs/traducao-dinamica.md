# Tradução dinâmica da interface

O seletor de idioma do cabeçalho atualiza a interface carregada sem criar rotas ou páginas duplicadas. A preferência fica salva no armazenamento local do navegador pelo Zustand. Português restaura os textos originais; os demais idiomas são traduzidos sob demanda e novas áreas da interface são detectadas pelo `MutationObserver`.

## Google Cloud Translation

O navegador envia lotes de textos à função autenticada `translateText`; a credencial Google permanece no ambiente da função e não é exposta no JavaScript do cliente. Traduções por texto/idioma ficam em cache no navegador para evitar chamadas repetidas. Campos editáveis, conteúdo de código, mídia, SVG e o canvas do mapa são ignorados.

Para disponibilizar traduções fora do Emulator Suite, o projeto Firebase/Google Cloud deve:

1. habilitar a Cloud Translation API e manter uma conta de faturamento vinculada;
2. conceder à identidade de execução das Cloud Functions a permissão `roles/cloudtranslate.user`;
3. implantar a função `translateText` junto com o frontend.

A Cloud Translation usa a identidade da função (Application Default Credentials / metadados do runtime), sem chave no cliente. O serviço pode aplicar a franquia mensal vigente, mas faturamento ainda é requisito; configure quotas/alertas do Google Cloud conforme o orçamento do projeto.

Se o serviço não estiver configurado ou ficar indisponível, a interface continua utilizável no idioma original. A escolha de idioma continua salva para a próxima sessão.
