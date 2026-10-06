# Pipeline morfométrico

## Objetivo

Transformar o relatório `relatorio_bacia_paramirim.xlsx` em dados canônicos rastreáveis sem alterar o arquivo original nem publicar interpretações não verificadas.

## Execução

```powershell
npm run import:morphometry -- "C:\caminho\relatorio_bacia_paramirim.xlsx"
```

O importador valida a aba, o cabeçalho e a quantidade esperada de indicadores. A saída é gravada em `data/morphometry`:

- `manifest.json`: identificação lógica, checksum SHA-256 e nomes dos derivados;
- `morphometry.generated.json`: 55 métricas com rótulo em português, célula de origem, unidade normalizada e estado de revisão;
- `validation-report.json`: recálculos independentes, divergências e bloqueios científicos.

O caminho absoluto da fonte não é persistido. O original continua fora do Git e os derivados permitem confirmar se a fonte mudou pelo checksum.

## Estados de revisão

- `source_only`: valor de entrada preservado, ainda sem validação metodológica externa;
- `verified`: relação matemática reproduzida com as entradas disponíveis e compatível com o arredondamento da planilha;
- `needs_review`: indicador sem dados intermediários, método, unidade, precisão ou referência suficientes.

As interpretações textuais da planilha são preservadas apenas como evidência de origem. Elas não estão autorizadas para publicação até que seus limiares e referências com DOI sejam verificados.

## Resultado inicial

- 55 indicadores importados;
- 19 relações recalculadas;
- 18 resultados compatíveis com o arredondamento informado;
- 15 células sem unidade explícita;
- perda de precisão detectada no número de infiltração;
- 11 estimativas de tempo de concentração com dispersão de aproximadamente 294 vezes entre mínimo e máximo;
- integral hipsométrica bloqueada por ausência da curva ou do método de cálculo.

## Próximo gate científico

Antes de alimentar a narrativa da página inicial, é necessário registrar fórmulas, parâmetros intermediários, unidade, aplicabilidade e referência conferida para os indicadores bloqueados. A interface deve consumir apenas métricas autorizadas pelo processo de revisão hidrológica e editorial.
