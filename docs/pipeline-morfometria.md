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
- `narrative.generated.json`: subconjunto público sem interpretações textuais e sem indicadores `needs_review`;
- `validation-report.json`: recálculos independentes, divergências e bloqueios científicos.

O caminho absoluto da fonte não é persistido. O original continua fora do Git e os derivados permitem confirmar se a fonte mudou pelo checksum.

## Estados de revisão

- `source_only`: valor de entrada preservado, ainda sem validação metodológica externa;
- `verified`: relação matemática reproduzida com as entradas disponíveis e compatível com o arredondamento da planilha;
- `needs_review`: indicador sem dados intermediários, método, unidade, precisão ou referência suficientes.

As interpretações textuais da planilha são preservadas apenas no derivado canônico como evidência de origem. Elas não entram no derivado narrativo nem no bundle da PWA até que seus limiares e referências com DOI sejam verificados.

## Política da narrativa pública

A página inicial consome exclusivamente `narrative.generated.json`. O importador aplica a política `factual_source_attributed`: admite valores `source_only` e relações `verified`, remove todo campo `sourceInterpretation` e exclui integralmente indicadores `needs_review`. Uma lista explícita no frontend limita ainda mais quais métricas podem ser apresentadas. O estado `verified` confirma apenas compatibilidade matemática com o arredondamento da fonte; não representa validação causal ou hidrológica.

## Resultado inicial

- 55 indicadores importados;
- 19 relações recalculadas;
- 18 resultados compatíveis com o arredondamento informado;
- 15 células sem unidade explícita;
- perda de precisão detectada no número de infiltração;
- 11 estimativas de tempo de concentração com dispersão de aproximadamente 294 vezes entre mínimo e máximo;
- integral hipsométrica bloqueada por ausência da curva ou do método de cálculo.

## Gate científico ainda pendente

Os tempos de concentração possuem um tratamento deliberadamente separado: `narrative.generated.json` publica `concentrationTimeComparison` apenas como comparação de sensibilidade entre métodos (`mode: method_sensitivity_only`, `designUseAllowed: false`). Isso permite explicar ao leitor por que os resultados divergem sem transformar uma fórmula não validada regionalmente em parâmetro de projeto. Para uso em dimensionamento, ainda são necessários domínio de calibração, fórmula, unidades, dados de chuva, cobertura, solos, subdivisão da bacia e validação com hidrogramas observados.
