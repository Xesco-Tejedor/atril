# Atril · Taller de palabras

▶ **[Abrir Atril](https://xesco-tejedor.github.io/atril/)**

Para abrirla en una pestaña nueva: Ctrl/Cmd + clic (ordenador) o pulsación larga y "Abrir en pestaña nueva" (móvil). GitHub no permite forzar pestaña nueva desde un README.

Demo gratuita de asistencia léxica a la redacción en español. Editor, selección de palabras, propuestas que el usuario revisa, deshacer cambio, importación/exportación TXT y guardado local. Sin IA, cuentas, claves ni servicios de pago.

## Datos y atribución

36.931 entradas españolas con relaciones léxicas y 101 locuciones latinas, extraídas de la edición española de Wikcionario por Kaikki / Wiktextract. Descarga: 8 de octubre de 2026.

- Fuente: https://kaikki.org/eswiktionary/rawdata.html
- Autores: colaboradores de Wikcionario; cada consulta enlaza la entrada original con su historial de contribuciones: https://es.wiktionary.org
- Licencia de los datos adaptados (`lexico.json`, `latin.json`): Creative Commons Attribution-ShareAlike 4.0, https://creativecommons.org/licenses/by-sa/4.0/
- Cambios: selección de relaciones, acepciones y etiquetas, eliminación de ejemplos literarios y de información no necesaria, formato compacto JSON. No se atribuyen estos datos a Corripio.
- Derechos de reutilización: https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use

## Corripio (opcional, local)

La pestaña Corripio puede responder con el *Diccionario de ideas afines* de Fernando Corripio (© 1985 Editorial Herder): cada persona carga su propio PDF del libro (no tenemos licencia de redistribución, por eso no se incluye), Atril lo analiza en el navegador con pdf.js y guarda el índice (22.341 entradas, con referencias cruzadas «V.» navegables) solo en IndexedDB de ese dispositivo. El PDF y el índice no se suben ni se publican: este repositorio no contiene el diccionario. Editorial: https://herder.com.mx/autor/fernando-corripio

Lector PDF: pdf.js 4.10.38 (https://mozilla.github.io/pdf.js/), licencia Apache 2.0, cargado desde jsDelivr con la versión fijada (`cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/`).

## Privacidad y límites

El texto se guarda en localStorage en el navegador del usuario. No hay backend, telemetría ni llamadas a IA. El sitio público no publica los borradores. Descargar una copia es recomendable: borrar los datos del navegador borra el borrador. El léxico es limitado y comunitario; comprobar sentidos, registros y concordancia antes de aplicar sugerencias. Las ideas afines distinguen relaciones léxicas de preguntas propias para inspirar escritura.

## Código: MIT

Copyright (c) 2026 Xesco Tejedor

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

This code licence does not replace CC BY-SA 4.0 for the dictionary datasets.
