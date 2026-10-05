# Catálogo geoespacial inicial

Data do inventário: 5 de outubro de 2026.

## Escopo e método

Este inventário cobre os arquivos `.geojson`, `.tif` e `.tiff` encontrados recursivamente em `sig/` e cruza esses arquivos com `organização de camadas.xlsx`. A planilha foi usada somente como fonte de nomes, grupos, instituições, anos, escalas e observações. Nenhum conteúdo da planilha foi tratado como instrução.

Para cada GeoJSON foram verificados: parse JSON, tipo raiz, CRS declarado, contagem de feições, tipos geométricos, extensão calculada a partir das coordenadas, geometrias nulas ou vazias, esquema de atributos, tamanho e SHA-256. Para cada GeoTIFF foram lidos: dimensões, bandas, tipo numérico, georreferenciamento, GeoKeys, NoData, estatísticas dos pixels válidos, organização interna, tamanho e SHA-256. Os dados-fonte não foram alterados nem copiados para o repositório.

O catálogo estruturado completo está em `docs/catalogo-camadas-inicial.json`.

## Resumo

- 20 arquivos GeoJSON presentes, todos válidos como `FeatureCollection`.
- 126.989 feições vetoriais no total.
- Todos os GeoJSON declaram SIRGAS 2000, EPSG:4674.
- Nenhuma geometria nula ou vazia foi encontrada.
- Quatro GeoTIFF presentes, todos com uma banda e NoData declarado como `0`.
- O MDE declara EPSG:31983. Os demais rasters declaram EPSG:4674.
- A planilha descreve 37 camadas vetoriais: 20 possuem arquivo e 17 permanecem planejadas.
- As unidades e, portanto, os sufixos dos três rasters hidrogeológicos não estão documentados na planilha fornecida. Devem ser confirmados antes da publicação.

## Vetores presentes

| Grupo | Camada | Feições | Geometria | Tamanho | CRS | Extensão `[minX, minY, maxX, maxY]` |
| --- | --- | ---: | --- | ---: | --- | --- |
| Bacia hidrográfica | Bacia Hidrográfica do Rio Paramirim | 1 | MultiPolygon | 2,39 MiB | EPSG:4674 | `[-43.307627, -13.661242, -41.873981, -11.582014]` |
| Bacia hidrográfica | Hidrografia | 199 | MultiLineString | 4,76 MiB | EPSG:4674 | `[-43.301662, -13.580521, -41.937700, -11.596972]` |
| Imóveis rurais | Imóvel rural — APP | 6.232 | MultiPolygon | 7,42 MiB | EPSG:4674 | `[-43.374456, -13.577349, -41.886647, -11.512778]` |
| Imóveis rurais | Áreas degradadas em APP | 130 | MultiPolygon | 0,12 MiB | EPSG:4674 | `[-43.088113, -13.531444, -41.931912, -12.020402]` |
| Imóveis rurais | Áreas degradadas em reserva legal | 504 | MultiPolygon | 0,21 MiB | EPSG:4674 | `[-43.114402, -13.519425, -41.982466, -11.625721]` |
| Imóveis rurais | Limites de propriedades | 58.620 | MultiPolygon | 43,31 MiB | EPSG:4674 | `[-43.381148, -13.665599, -41.872484, -11.495488]` |
| Imóveis rurais | Reserva legal | 52.793 | MultiPolygon | 39,74 MiB | EPSG:4674 | `[-43.336569, -13.665599, -41.889321, -11.578552]` |
| Limites territoriais | Cidades | 13 | Point | 0,002 MiB | EPSG:4674 | `[-42.889876, -13.444535, -42.140718, -11.822037]` |
| Limites territoriais | Limites municipais | 417 | MultiPolygon | 9,15 MiB | EPSG:4674 | `[-46.577283, -18.350705, -37.341339, -8.524765]` |
| Limites territoriais | Territórios de identidade | 27 | MultiPolygon | 11,06 MiB | EPSG:4674 | `[-46.577285, -18.348488, -37.333865, -8.527264]` |
| Limites territoriais | Limites estaduais | 27 | MultiPolygon | 16,12 MiB | EPSG:4674 | `[-73.986810, -33.751178, -28.847770, 5.269620]` |
| Poços | Poços — SIAGAS | 935 | Point | 0,88 MiB | EPSG:4674 | `[-43.218611, -13.624722, -41.908888, -11.611111]` |
| Produção | Pontos de extração mineral | 19 | Point | 0,008 MiB | EPSG:4674 | `[-42.746180, -13.560831, -42.083586, -11.873754]` |
| Recursos naturais | Geologia | 231 | MultiPolygon | 2,96 MiB | EPSG:4674 | `[-43.458029, -15.165526, -40.920941, -10.793834]` |
| Recursos naturais | Geomorfologia | 39 | MultiPolygon | 0,41 MiB | EPSG:4674 | `[-44.479600, -14.338170, -40.587900, -8.704872]` |
| Recursos naturais | Vegetação | 6.721 | MultiPolygon | 132,42 MiB | EPSG:4674 | `[-43.381411, -14.188360, -41.650555, -10.822683]` |
| Sociedade e Cultura | Áreas quilombolas | 1 | MultiPolygon | 0,004 MiB | EPSG:4674 | `[-42.050216, -12.558842, -41.972562, -12.481548]` |
| Sociedade e Cultura | Sítios arqueológicos | 71 | Point | 0,035 MiB | EPSG:4674 | `[-43.241705, -13.451563, -42.013189, -11.650804]` |
| Sociedade e Cultura | Unidade de conservação estadual | 1 | MultiPolygon | 0,011 MiB | EPSG:4674 | `[-42.043766, -13.542165, -41.708637, -13.146099]` |
| Sociedade e Cultura | Unidade de conservação municipal | 8 | MultiPolygon | 0,097 MiB | EPSG:4674 | `[-42.795961, -13.660489, -41.817218, -12.770334]` |

## Vetores planejados sem arquivo

- Estações fluviométricas RHN.
- Estações pluviométricas RHN.
- Unidade de conservação federal.
- Solos.
- Aquíferos porosos.
- Aquíferos cársticos.
- Aquíferos fraturados.
- Rodovias.
- Ferrovias.
- Aeroportos.
- Linhas de transmissão.
- Subestações.
- Barragens.
- Usina eólica.
- Usina solar.
- Usina de biomassa.
- Usina hidrelétrica.

Esses itens devem manter status `planned` e não devem aparecer como camadas publicadas até que um arquivo GeoJSON válido seja submetido e aprovado.

## Rasters presentes

| Camada | Dimensões | Tipo | CRS | Resolução | Pixels válidos | NoData | Mínimo | Máximo |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: |
| MDE | 5.057 × 7.567 | uint16 | EPSG:31983 | 30,481981 × 30,461731 m | 18.382.882 | 0 | 400 | 2.022 |
| Nível dinâmico | 1.433 × 2.078 | float32 | EPSG:4674 | 0,000999573° × 0,000999812° | 1.419.327 | 0 | 4,607903 | 134,516403 |
| Nível estático | 1.433 × 2.078 | float32 | EPSG:4674 | 0,000999573° × 0,000999812° | 1.419.327 | 0 | 0,007923 | 69,864784 |
| Profundidade | 1.433 × 2.078 | float32 | EPSG:4674 | 0,000999573° × 0,000999812° | 1.419.327 | 0 | 12,734317 | 179,470535 |

Os quatro rasters são GeoTIFF não comprimidos, organizados em tiras de uma linha, sem pirâmides internas detectáveis. Isso é inadequado para acesso eficiente por faixa no navegador. O pipeline de ingestão deve preservar o original e gerar um derivado COG comprimido, blocado e com overviews, registrando checksum e proveniência.

## Configuração cartográfica inicial dos rasters

Para os quatro rasters, o catálogo propõe como configuração inicial:

- interpolação de cores discreta;
- classificação por intervalo igual;
- dez classes;
- rótulo com duas casas decimais;
- reamostragem bilinear com kernel 2 × 2;
- NoData excluído das estatísticas e das classes;
- sufixo pendente de validação da unidade;
- MDE com rampa hipsométrica;
- nível estático com rampa sequencial azul;
- nível dinâmico com rampa sequencial azul-ciano;
- profundidade com rampa sequencial azul-petróleo/índigo, escurecendo com a profundidade.

Os limites das classes devem usar a precisão original. O arredondamento para duas casas é apenas de apresentação.

## Fontes registradas na planilha

- Imóveis rurais: INEMA, 2025.
- Poços: SIAGAS, 2026.
- Estações planejadas: ANA, 2026.
- Bacia e hidrografia: elaboração própria, extraídas de MDE TopoDATA; escala 1:100.000.
- Sítios arqueológicos e áreas quilombolas: IPHAN, 2024.
- Unidades de conservação estadual, municipal e federal planejada: INEMA, 2025.
- Limites estaduais, limites municipais e cidades: IBGE, 2025.
- Territórios de identidade: SEI, 2024.
- Geologia e geomorfologia: INEMA, 2004 apud CBPM e CPRM; escala 1:1.000.000, com observações detalhadas no catálogo JSON.
- Solos planejados: INEMA, 2004 apud CBPM e CPRM; escala 1:1.000.000.
- Vegetação: INEMA, 2019; escala 1:50.000.
- Pontos de extração mineral: IBGE, 2025.

Essas informações são declarações da planilha fornecida. Licença, URL oficial, data de acesso e atribuição final ainda precisam ser verificadas antes da publicação.

## Riscos e bloqueios para publicação

1. **Desempenho de GeoJSON.** Vegetação (132,42 MiB), limites de propriedades (43,31 MiB) e reserva legal (39,74 MiB) não devem ser carregados integralmente na thread principal. São necessários parsing em worker, carregamento sob demanda e derivados GeoJSON simplificados/particionados.
2. **Escopo espacial excessivo.** Limites estaduais abrange todo o Brasil; limites municipais e territórios de identidade abrangem a Bahia. Geologia, geomorfologia e vegetação também excedem a bacia. Definir recorte e escalas de visibilidade sem destruir os originais.
3. **CRS legado em GeoJSON.** Os arquivos incluem o membro `crs`, removido da especificação RFC 7946. A ingestão deve reconhecer o EPSG declarado, validar coordenadas e configurar explicitamente `dataProjection`; não deve depender da autodetecção do navegador.
4. **Encoding da planilha.** Os textos da planilha apresentam caracteres de substituição em vários termos acentuados. Os nomes normalizados deste catálogo devem ser revisados contra a fonte original antes da publicação.
5. **Unidades raster ausentes.** Não definir sufixos para nível dinâmico, nível estático e profundidade antes de confirmação documental.
6. **NoData igual a zero.** Confirmar se zero é ausência de dado em cada raster, especialmente no nível estático, antes de excluir zeros válidos.
7. **GeoTIFF sem otimização web.** Os arquivos não são tileados, não têm compressão e não apresentam overviews internas. Gerar COG derivado no backend.
8. **Resolução angular.** Os rasters hidrogeológicos estão em EPSG:4674 com resolução angular. Documentar método de interpolação/origem e avaliar reprojeção derivada para análises métricas.
9. **Atributos potencialmente sensíveis.** Imóveis rurais contêm número CAR, denominação e identificadores; poços contêm nomes/localizações e parâmetros. Definir campos publicáveis antes da exposição.
10. **Campos totalmente nulos.** `anodereferencia` em limites municipais, `the_geom` em poços, `area_aux` em geologia e outros campos listados no JSON não agregam informação e devem ser ocultados na interface, sem alterar o original.
11. **Licenças não registradas.** Nenhuma licença ou URL oficial foi fornecida na planilha.
12. **Qualidade geométrica não exaustiva.** Este inventário confirma estrutura e presença de coordenadas, mas não substitui validação topológica, detecção de autointerseções e verificação de alinhamento espacial.

## Próximas validações

- Confirmar as unidades, sufixos e significado científico dos três rasters hidrogeológicos.
- Confirmar o uso de zero como NoData.
- Verificar licenças e URLs oficiais das fontes.
- Validar topologia e alinhamento com uma ferramenta GDAL/GEOS.
- Definir campos públicos, aliases e filtros por camada.
- Definir recortes, níveis de zoom e estratégia de particionamento dos GeoJSON grandes.
- Gerar e comparar COGs derivados, mantendo os GeoTIFF originais intactos.
