/* Atril · Corripio local
   Integra el "Diccionario de ideas afines" de Fernando Corripio usando el PDF
   que aporta la persona usuaria. Todo el análisis ocurre en su navegador:
   el PDF y el índice resultante no se suben ni se publican en ningún sitio.
   El índice se guarda solo en IndexedDB de este navegador.
   La obra es © 1985 Editorial Herder: Atril no distribuye su contenido. */
window.CorripioTab = (function () {
  'use strict';
  var DB_NAME = 'atril-corripio', STORE = 'kv';
  var state = { status: 'unknown', count: 0, pages: 0, when: 0, saved: true };
  var byNorm = null;      // Map: forma normalizada -> [entradas]
  var pdfjsLib = null;
  var refresh = null;     // función render() de Atril para actualizar al terminar

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- IndexedDB ---------- */
  function openDB() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbOp(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var rq = fn(db.transaction(STORE, mode).objectStore(STORE));
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error); };
      });
    });
  }
  function idbGet(k) { return idbOp('readonly', function (s) { return s.get(k); }); }
  function idbSet(k, v) { return idbOp('readwrite', function (s) { return s.put(v, k); }); }
  function idbDel(k) { return idbOp('readwrite', function (s) { return s.delete(k); }); }

  /* ---------- índice en memoria ---------- */
  function buildMap(entries) {
    byNorm = new Map();
    entries.forEach(function (e) {
      var keys = e.a ? e.a : [e.w];
      keys.forEach(function (k) {
        var n = norm(k);
        if (!byNorm.has(n)) byNorm.set(n, []);
        byNorm.get(n).push(e);
      });
    });
  }

  /* ---------- análisis del PDF (pdf.js) ---------- */
  function parseCorripio(doc, onProgress) {
    var boldCache = new Map();
    function isBold(page, id) {
      if (!boldCache.has(id)) {
        return page.getOperatorList().then(function () {
          var b = false;
          try { var f = page.commonObjs.get(id); b = !!(f && f.name && /bold/i.test(f.name)); } catch (e) {}
          boldCache.set(id, b);
          return b;
        });
      }
      return Promise.resolve(boldCache.get(id));
    }
    var entries = [], cur = null, started = false;
    function flush() {
      if (cur) {
        cur.t = cur.t.trim();
        if (cur.w) { var e = { w: cur.w, t: cur.t }; if (cur.aliases) e.a = cur.aliases; entries.push(e); }
        cur = null;
      }
    }
    var p = 10;
    function nextPage() {
      if (p > doc.numPages) { flush(); return Promise.resolve({ entries: entries }); }
      var pageNo = p++;
      return doc.getPage(pageNo).then(function (page) {
        return page.getTextContent().then(function (tc) {
          var raw = tc.items.filter(function (i) { return i.str && i.str.trim(); });
          raw.sort(function (a, b) { return b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]; });
          var lineList = [];
          raw.forEach(function (it) {
            var y = it.transform[5], last = lineList[lineList.length - 1];
            if (last && Math.abs(last.y - y) <= 2.5) last.items.push(it);
            else lineList.push({ y: y, items: [it] });
          });
          var chain = Promise.resolve();
          lineList.forEach(function (line) {
            chain = chain.then(function () {
              var items = line.items, text = '', firstX = null, prevEnd = null, startsBold = false;
              var seq = Promise.resolve();
              items.forEach(function (it) {
                seq = seq.then(function () {
                  if (!it.str.trim()) return;
                  var x = it.transform[4];
                  if (firstX === null) {
                    firstX = x;
                    return isBold(page, it.fontName).then(function (b) { startsBold = b; after(); });
                  }
                  after();
                  function after() {
                    if (prevEnd !== null && x - prevEnd > 1.0) text += ' ';
                    text += it.str;
                    prevEnd = x + (it.width || 0);
                  }
                });
              });
              return seq.then(function () {
                text = text.replace(/\s+/g, ' ').trim();
                if (!text) return;
                if (/^[A-ZÑ]$/.test(text) && firstX > 150) return;
                if (!started) {
                  if (startsBold && /^[a-záéíóúüñ'’().-]+\./.test(text) && firstX < 200) started = true;
                  else return;
                }
                if (startsBold) {
                  if (/^—\s*\d+\./.test(text)) { if (cur) cur.t += ' ' + text; return; }
                  if (/^\d+\.?\s+[A-ZÁÉÍÓÚÜÑ]/.test(text) && cur) { cur.t += ' ' + text; return; }
                  flush();
                  var w = null, rest = '';
                  var mm = text.match(/^(.{1,60}?)[.!?,]\s+(.*)$/);
                  if (mm) {
                    w = mm[1]; rest = mm[2] || '';
                    var numTail = w.match(/^(.*?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ)!])\s+(\d+)$/);
                    if (numTail) { w = numTail[1]; rest = numTail[2] + '. ' + rest; }
                    var al = rest.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’()-]{2,}(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’()-]{2,})?)\.\s+(\S.*)$/);
                    if (al && al[1] !== 'V') {
                      cur = { w: w + ', ' + al[1], aliases: [w, al[1]], t: al[2].trim() };
                      rest = null;
                    }
                  } else { w = text; rest = ''; }
                  if (rest !== null) {
                    w = w.replace(/^[¡¿]+|[.,!?\s]+$/g, '').trim();
                    if (!w || /^\d+$/.test(w)) { if (cur) cur.t += ' ' + text; }
                    else cur = { w: w, t: rest.trim() };
                  }
                } else if (cur) cur.t += ' ' + text;
              });
            });
          });
          return chain.then(function () {
            if (onProgress) onProgress(pageNo, doc.numPages);
            return nextPage();
          });
        });
      });
    }
    return nextPage();
  }

  function loadPdf(file, onProgress) {
    return Promise.resolve().then(function () {
      if (!pdfjsLib) {
        // pdf.js 4.10.38 fijado; primero CDN (jsDelivr, inmutable), respaldo local si existe.
        var sources = [
          { lib: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs',
            worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs' },
          { lib: './pdf.min.mjs', worker: './pdf.worker.min.mjs' }
        ];
        var attempt = function (i) {
          if (i >= sources.length) throw new Error('no se pudo cargar pdf.js');
          return import(sources[i].lib).then(function (lib) {
            pdfjsLib = lib;
            lib.GlobalWorkerOptions.workerSrc = sources[i].worker;
          }).catch(function () { return attempt(i + 1); });
        };
        return attempt(0);
      }
    }).then(function () {
      return file.arrayBuffer();
    }).then(function (buf) {
      return pdfjsLib.getDocument({ data: buf }).promise;
    }).then(function (doc) {
      return parseCorripio(doc, onProgress).then(function (out) {
        if (out.entries.length < 5000) {
          var err = new Error('few-entries');
          err.code = 'wrong-pdf';
          throw err;
        }
        buildMap(out.entries);
        state.status = 'ready'; state.count = out.entries.length; state.pages = doc.numPages;
        state.when = Date.now(); state.saved = true;
        return idbSet('index', { entries: out.entries, meta: { count: out.entries.length, pages: doc.numPages, when: state.when } })
          .catch(function () { state.saved = false; });
      });
    });
  }

  function ensureLoaded() {
    if (state.status !== 'unknown') return;
    state.status = 'loading';
    idbGet('index').then(function (idx) {
      if (idx && idx.entries && idx.entries.length) {
        buildMap(idx.entries);
        state.status = 'ready'; state.count = idx.entries.length;
        state.pages = idx.meta ? idx.meta.pages : 0; state.when = idx.meta ? idx.meta.when : 0;
      } else state.status = 'empty';
    }).catch(function () { state.status = 'empty'; state.saved = false; })
      .then(function () { if (refresh) refresh(); });
  }

  /* ---------- representación de entradas ---------- */
  // Convierte el texto de una entrada en bloques (sentidos — n., secciones n., Contr.:)
  function blocks(t) {
    var parts = t.split(/ (?=—\s*\d+\.\s)| (?=\b\d{1,2}\.\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ])| (?=Contr\.:)/);
    return parts.map(function (x) { return x.trim(); }).filter(Boolean);
  }
  // Enlaza referencias "V. PALABRA 3" y términos con asterisco que tienen artículo propio
  function linkify(text, sectionCtx) {
    var html = esc(text);
    html = html.replace(/\bV\.\s+([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ .\-]{0,38}?)(?:\s+(\d+(?:\s*[,;]\s*\d+)*))?\.?(?=\s|,|;|$)/g,
      function (m, word, secs) {
        var w = word.trim().replace(/[.\s]+$/, '');
        if (!w || w === 'V') return m;
        var label = 'V. ' + w + (secs ? ' ' + secs.trim() : '');
        return '<button type="button" class="corr-ref" data-ref="' + esc(w) + '"' +
          (secs ? ' data-sec="' + esc(secs.trim().split(/[,;]/)[0].trim()) + '"' : '') + '>' + esc(label) + '</button>';
      });
    html = html.replace(/\bV\.\s+([a-záéíóúüñ][a-záéíóúüñü .\-]{1,38}?)\.(?=\s|$)/g,
      function (m, word) {
        var w = word.trim();
        return '<button type="button" class="corr-ref" data-ref="' + esc(w) + '">V. ' + esc(w) + '</button>';
      });
    html = html.replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][\wáéíóúüñÁÉÍÓÚÜÑ-]{1,30})\*/g,
      function (m, word) {
        if (byNorm && byNorm.has(norm(word))) {
          return '<button type="button" class="corr-star" data-ref="' + esc(word) + '" title="Tiene artículo propio">' + esc(word) + '•</button>';
        }
        return esc(word) + '*';
      });
    return html;
  }

  function entryHtml(e, highlightSec) {
    var h = '<article class="corr-entry"><h3>' + esc(e.w) + '</h3>';
    blocks(e.t).forEach(function (b) {
      var secN = null;
      var m = b.match(/^(?:—\s*)?(\d{1,2})\./);
      if (m) secN = m[1];
      var cls = 'corr-sec' + (highlightSec && secN === String(highlightSec) ? ' corr-hl' : '');
      h += '<p class="' + cls + '">' + linkify(b) + '</p>';
    });
    return h + '</article>';
  }

  function suggestions(q) {
    var out = [], n = norm(q);
    if (!n) return out;
    var prefix = [], contains = [];
    byNorm.forEach(function (v, k) {
      if (k.indexOf(n) === 0) prefix.push(k);
      else if (k.indexOf(n) !== -1) contains.push(k);
    });
    prefix.sort(); contains.sort();
    return prefix.concat(contains).slice(0, 14);
  }

  /* ---------- interfaz ---------- */
  function render(area, q, rerender) {
    refresh = rerender || refresh;
    ensureLoaded();
    var h = '<h3>Fernando Corripio · <em>Diccionario de ideas afines</em></h3>';

    if (state.status === 'loading') {
      area.innerHTML = h + '<p>Cargando el diccionario guardado…</p>';
      return;
    }
    if (state.status === 'empty' || (state.status === 'unknown')) {
      h += '<p>Busca cualquier palabra y Atril responde con las voces afines del Corripio: artículos completos, apartados numerados y referencias cruzadas que puedes seguir.</p>';
      h += '<div class="empty">La obra es © 1985 Editorial Herder y no tenemos licencia para redistribuirla. Por eso Atril no trae el diccionario: <strong>lo aportas tú</strong>. Carga tu propio PDF del Corripio una sola vez; Atril lo analiza aquí mismo, en tu navegador, y guarda el índice solo en este dispositivo. El PDF y el índice no se suben ni se publican en ningún sitio.</div>';
      h += '<p><label class="file-button corr-load">Cargar mi PDF del Corripio<input type="file" id="corr-file" accept="application/pdf,.pdf"></label></p>';
      h += '<p class="micro">El análisis de las 1.103 páginas tarda un minuto aproximadamente y solo se hace una vez. Funciona igual en el móvil. <a target="_blank" rel="noopener" href="https://herder.com.mx/autor/fernando-corripio">Ver autor y obra en Herder ↗</a></p>';
      area.innerHTML = h;
      var inp = area.querySelector('#corr-file');
      if (inp) inp.onchange = function () { if (inp.files && inp.files[0]) startLoad(area, inp.files[0]); };
      return;
    }
    if (state.status === 'parsing') return; // startLoad ya escribe el progreso

    // estado listo
    h += '<p class="micro">Diccionario listo: <strong>' + state.count.toLocaleString('es-ES') + ' entradas</strong> guardadas solo en este navegador. ';
    h += '<button type="button" class="corr-mini" id="corr-reload">Cambiar PDF</button> <button type="button" class="corr-mini" id="corr-forget">Olvidar diccionario</button>';
    if (!state.saved) h += ' <span class="tag">No se pudo guardar: se perderá al cerrar.</span>';
    h += '</p>';

    var query = (q || '').trim();
    if (!query) {
      h += '<p class="empty">Escribe una palabra arriba y pulsa Explorar, o selecciona texto en el editor.</p>';
    } else {
      var entries = byNorm.get(norm(query)) || null;
      if (!entries && query.indexOf(' ') !== -1) {
        // frase: intenta cada palabra con entrada propia
        var words = query.split(/\s+/).filter(function (w) { return byNorm.has(norm(w)); });
        if (words.length) entries = [];
        (words || []).forEach(function (w) { byNorm.get(norm(w)).forEach(function (e) { if (entries.indexOf(e) === -1) entries.push(e); }); });
      }
      if (entries && entries.length) {
        entries.forEach(function (e) { h += entryHtml(e, state.pendingSec); });
        state.pendingSec = null;
      } else {
        var sugg = suggestions(query);
        h += '<p class="empty">Sin entrada para «' + esc(query) + '».</p>';
        if (sugg.length) {
          h += '<p class="micro">Quizá:</p><div class="chips">';
          sugg.forEach(function (s) { h += '<button type="button" class="corr-ref" data-ref="' + esc(s) + '">' + esc(s) + '</button>'; });
          h += '</div>';
        }
      }
    }
    area.innerHTML = h;
    wire(area);
  }

  function wire(area) {
    area.querySelectorAll('.corr-ref, .corr-star').forEach(function (b) {
      b.onclick = function () {
        var w = b.getAttribute('data-ref'), sec = b.getAttribute('data-sec');
        show(w, sec);
      };
    });
    var rl = area.querySelector('#corr-reload');
    if (rl) rl.onclick = function () {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/pdf,.pdf';
      inp.onchange = function () { if (inp.files && inp.files[0]) startLoad(area, inp.files[0]); };
      inp.click();
    };
    var fg = area.querySelector('#corr-forget');
    if (fg) fg.onclick = function () {
      if (!confirm('¿Olvidar el diccionario Corripio guardado en este navegador? Tu PDF no se borra.')) return;
      idbDel('index').then(function () {
        state = { status: 'empty', count: 0, pages: 0, when: 0, saved: true };
        byNorm = null;
        if (refresh) refresh();
      });
    };
  }

  function show(word, sec) {
    var input = document.getElementById('query');
    if (input) input.value = word;
    state.pendingSec = sec || null;
    var tabBtn = document.querySelector('[data-tab="corripio"]');
    if (tabBtn) { tabBtn.click(); return; }
    renderEntryList(word);   // respaldo si no hay pestañas
  }

  function renderEntryList(word) {
    var area = document.getElementById('results');
    var entries = byNorm && byNorm.get(norm(word));
    if (!area) return;
    var h = '<h3>Fernando Corripio · <em>Diccionario de ideas afines</em></h3>';
    h += '<p class="micro">Diccionario listo: <strong>' + state.count.toLocaleString('es-ES') + ' entradas</strong> guardadas solo en este navegador.</p>';
    if (!entries) {
      h += '<p class="empty">Sin entrada para «' + esc(word) + '».</p>';
    } else {
      entries.forEach(function (e) { h += entryHtml(e, state.pendingSec); });
    }
    state.pendingSec = null;
    area.innerHTML = h;
    wire(area);
  }

  function startLoad(area, file) {
    state.status = 'parsing';
    var h = '<h3>Fernando Corripio · <em>Diccionario de ideas afines</em></h3>';
    h += '<p id="corr-progress">Preparando el análisis…</p><p class="micro">No cierres la página. El PDF no sale de tu navegador.</p>';
    area.innerHTML = h;
    var prog = area.querySelector('#corr-progress');
    var t0 = Date.now();
    loadPdf(file, function (done, total) {
      if (prog) prog.textContent = 'Analizando página ' + done + ' de ' + total + '…';
    }).then(function () {
      state.status = 'ready';
      if (refresh) refresh();
    }).catch(function (err) {
      state.status = 'empty';
      var msg = (err && err.code === 'wrong-pdf')
        ? 'Ese PDF no parece el Diccionario de ideas afines: no se encontraron sus entradas. Comprueba que es el Corripio completo y vuelve a intentarlo.'
        : 'No se pudo analizar el PDF (' + (err && err.message ? err.message : 'error desconocido') + '). Prueba de nuevo o con otra copia.';
      area.innerHTML = '<h3>Fernando Corripio</h3><p class="empty">' + esc(msg) + '</p>' +
        '<p><label class="file-button corr-load">Elegir otro PDF<input type="file" id="corr-file" accept="application/pdf,.pdf"></label></p>';
      var inp = area.querySelector('#corr-file');
      if (inp) inp.onchange = function () { if (inp.files && inp.files[0]) startLoad(area, inp.files[0]); };
    });
  }

    // Tarjeta breve para las otras pestañas: conecta el índice local con la consulta general
  function summaryHtml(q, tab) {
    if (state.status !== 'ready' || !byNorm || !q) return '';
    var entries = byNorm.get(norm(q));
    if (!entries || !entries.length) return '';
    var e = entries[0];
    var bs = blocks(e.t);
    if (tab === 'antonyms') {
      var contra = bs.filter(function (b) { return /^Contr\.:/.test(b); });
      if (contra.length) bs = contra; else return '';
    }
    var frag = bs.slice(0, 2).join(' ');
    if (frag.length > 600) frag = frag.slice(0, 600) + '…';
    return '<section class="sense"><h3>Corripio · tu diccionario local</h3>' +
      '<p class="micro">Diccionario de ideas afines (© Herder), índice guardado solo en este navegador.</p>' +
      '<p class="corr-sec">' + linkify(frag) + '</p>' +
      '<p><button type="button" class="corr-ref" data-ref="' + esc(e.w) + '">Abrir el artículo en Corripio</button></p></section>';
  }

  return { render: render, show: show, summaryHtml: summaryHtml, bind: wire,
           __debug: function () { return { state: state, byNorm: byNorm, loadPdf: loadPdf }; } };
})();
