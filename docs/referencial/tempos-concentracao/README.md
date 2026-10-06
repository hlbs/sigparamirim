# Referencial bibliográfico para tempos de concentração

Esta pasta reúne os documentos usados para revisar a seção de resposta à chuva do SIG Paramirim. O objetivo não é transformar uma equação empírica em verdade universal, mas registrar a origem dos métodos, seus pressupostos, seus domínios de calibração e as condições necessárias para uma aplicação responsável.

## Critério de leitura

O conceito de tempo de concentração não possui uma definição operacional única. A literatura distingue, entre outras coisas, tempo de viagem de uma partícula, tempo de equilíbrio da bacia e tempo de resposta do hidrograma. Por isso, uma equação só pode ser defendida quando a variável calculada, a escala, o tipo de escoamento, as unidades e o domínio de calibração são conhecidos.

## Documentos baixados

| Arquivo | Conteúdo utilizado |
| --- | --- |
| `almeida-2014-revisao-30-metodos.pdf` | Revisão de 30 metodologias; comparação de agrupamentos e dependência do contexto físico da bacia. Inclui Kirpich, Kerby-Hathaway, Giandotti, Témez, Passini, Ventura, Bransby-Williams, Johnstone-Cross, California Culverts e USDA/SCS. |
| `beven-2020-historia-tempo-concentracao.pdf` | Revisão conceitual sobre a história do conceito; diferença entre velocidade, celeridade, tempo de viagem e tempo de equilíbrio. |
| `kirpich-1940.pdf` | Documento que reproduz e discute o artigo clássico de Kirpich, além de aplicações modificadas de Kerby-Kirpich para pequenas bacias. |
| `nrcs-neh630-capitulo05-hidrologia.pdf` | Manual oficial USDA/NRCS; pressupostos e limites do TR-55/SCS, incluindo 0,1–10 h, chuva uniforme, CN e armazenamento. |
| `nrcs-neh630-capitulo15-tempo-concentracao.pdf` | Manual oficial USDA/NRCS com a equação de Kirpich e métodos auxiliares para pequenas bacias. |
| `usace-hec-hms-manual-tecnico-2023.pdf` | Manual oficial HEC-HMS; requisitos do Clark, parâmetros de translação, armazenamento, histograma tempo-área e calibração. |

## Síntese aplicada ao Paramirim

| Método | Resultado no relatório | Decisão pública | Motivo |
| --- | ---: | --- | --- |
| Kirpich | 80,13 h | Excluído | Método para pequenas bacias rurais e canais bem definidos; a escala do Paramirim está fora do domínio original. |
| Kerby | 8,89 h | Excluído | Método de escoamento superficial inicial; não representa sozinho uma bacia regional e exige parâmetros de retardo/trecho de fluxo. |
| Giandotti | **34,22 h** | **Referência de escala** | Faixa publicada de 170–70.000 km² contempla os 17.070,32 km² do Paramirim. Ainda depende de validação regional. |
| Témez | 95,76 h | Excluído | Variante regional e domínio não documentados no relatório; não é possível confirmar equivalência de entradas e unidades. |
| USDA/SCS | 267,41 h | Excluído | Requer percurso segmentado, cobertura, solo, declividade, rugosidade, CN e hipóteses de chuva uniforme; o relatório morfométrico não contém esse conjunto. |
| Passini | 1.443,88 h | Excluído | Fórmula, variante e convenção de unidades não identificadas na fonte do valor. |
| Ventura-Heras | 2.617,15 h | Excluído | Resultado extremo e não reproduzível com os metadados atuais; a variante aplicada não está documentada. |
| Bransby-Williams | 32,79 h | Excluído | Domínio, variante e unidades não confirmados para a aplicação realizada. |
| Johnstone-Cross | 46,37 h | Excluído | Faixa publicada de aproximadamente 64,8–4.206,1 km²; a bacia é cerca de quatro vezes maior. |
| Clark | 96,50 h | Excluído | Clark não é apenas uma equação de Tc: exige Tc, coeficiente de armazenamento e relação tempo-área, normalmente calibrados com dados de chuva-vazão. |
| California Culverts | 53,61 h | Excluído | Desenvolvido para pequenas bacias montanhosas; referências técnicas indicam área inferior a 0,50 km² e talvegue inferior a 10 km. |

## Regra de uso

Giandotti é mostrado na página inicial apenas como referência de compatibilidade de escala. Isso não equivale a uma calibração hidrológica do Paramirim. Para projetos, o valor precisa ser reavaliado por sub-bacias, chuva espacialmente distribuída, solos, cobertura, trajetórias hidráulicas, dados de vazão e validação do hidrograma.

Os PDFs são mantidos como material de auditoria do projeto. As conclusões públicas devem ser atualizadas quando forem obtidos dados observados ou quando a equipe confirmar a fórmula exata usada em cada linha do relatório original.

## Fontes online

- Almeida et al. (2014), revisão de 30 métodos: https://www.revistageociencias.com.br/geociencias-arquivos/33/volume33_4_files/33-4-artigo-9.pdf
- Beven (2020), história e limites conceituais: https://doi.org/10.5194/hess-24-2655-2020
- USDA/NRCS NEH 630: https://directives.nrcs.usda.gov/sites/default/files2/1720613219/Chapter%2005%20-%20Stream%20Hydrology.pdf
- USDA/NRCS NEH 630, capítulo 15: https://irrigationtoolbox.com/NEH/Part630_Hydrology/NEH630-ch15draft.pdf
- USACE HEC-HMS Technical Reference Manual: https://www.hec.usace.army.mil/software/hec-hms/documentation/HEC-HMS_Technical_Reference_Manual-20231106.pdf
- Kirpich (1940), cópia digitalizada: https://library.ctr.utexas.edu/hostedpdfs/texastech/0-6382-1.pdf
