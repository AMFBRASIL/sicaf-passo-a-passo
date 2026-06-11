(function() {
  var _captured = false;

  function sendCapturedPdf(base64, fileName, size) {
    if (_captured) return;
    var b64Part = base64.split(',')[1] || '';
    if (!b64Part.startsWith('JVBER')) {
      console.log('[CadBrasil PageWorld] Conteúdo NÃO é PDF (magic bytes ausentes). Ignorando. Size:', size);
      return;
    }
    _captured = true;
    console.log('[CadBrasil PageWorld] ✅ PDF válido capturado! (' + (size/1024).toFixed(1) + ' KB)');
    window.postMessage({
      source: 'cadbrasil-pdf-intercept',
      base64: base64,
      fileName: fileName || 'SituacaoFornecedor.pdf',
      size: size
    }, '*');
  }

  function blobToBase64(blob, fileName) {
    var reader = new FileReader();
    reader.onload = function() {
      sendCapturedPdf(reader.result, fileName, blob.size);
    };
    reader.readAsDataURL(blob);
  }

  if (typeof window.proximoPasso === 'function') {
    var _origProximoPasso = window.proximoPasso;
    window.proximoPasso = function() {
      console.log('[CadBrasil PageWorld] 🔍 proximoPasso() chamado!');
      var curHref = window.location.href;
      setTimeout(function() {
        if (window.location.href !== curHref) {
          console.log('[CadBrasil PageWorld] 🔍 proximoPasso mudou location para:', window.location.href);
        }
      }, 500);
      return _origProximoPasso.apply(this, arguments);
    };
    console.log('[CadBrasil PageWorld] proximoPasso() interceptado para logging');
  } else {
    console.log('[CadBrasil PageWorld] proximoPasso() não existe ainda (será definido pelo AJAX?)');
  }

  // ── Estratégia 1: Override form.submit() — PrimeFaces download via iframe ──
  var _origSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function() {
    var form = this;
    console.log('[CadBrasil PageWorld] 🔍 form.submit() chamado! action:', form.action ? form.action.substring(0, 100) : '(vazio)', 'target:', form.target || '(nenhum)', 'id:', form.id || '(sem id)');

    if (form.target && !_captured) {
      console.log('[CadBrasil PageWorld] Form com target detectado! Procurando iframe:', form.target);
      var targetFrame = document.querySelector('iframe[name="' + form.target + '"]');
      if (targetFrame) {
        console.log('[CadBrasil PageWorld] ✅ Form submit to iframe:', form.action, 'target:', form.target);
        console.log('[CadBrasil PageWorld] Form fields:', form.elements.length, 'method:', form.method);
      }
    }
    return _origSubmit.call(form);
  };

  // ── Estratégia 2: Override window.open — PDF aberto em nova janela ──
  var _origOpen = window.open;
  window.open = function(url, target, features) {
    console.log('[CadBrasil PageWorld] 🔍 window.open chamado! url:', url ? String(url).substring(0, 100) : '(vazio)');
    if (url && !_captured) {
      var urlStr = String(url).toLowerCase();
      if (urlStr.includes('pdf') || urlStr.includes('download') || urlStr.includes('report') ||
          urlStr.includes('dynamiccontent') || urlStr.includes('javax.faces.resource')) {
        console.log('[CadBrasil PageWorld] window.open PDF detectado:', url);
        try {
          var xhr = new XMLHttpRequest();
          xhr.responseType = 'blob';
          xhr.open('GET', url, true);
          xhr.onload = function() {
            if (xhr.response && xhr.response.size > 100) {
              blobToBase64(xhr.response, 'SituacaoFornecedor.pdf');
            }
          };
          xhr.send();
        } catch(e) {}
      }
    }
    return _origOpen.apply(this, arguments);
  };

  // ── Estratégia 3: Override PrimeFaces.download (se existir) ──
  if (typeof PrimeFaces !== 'undefined') {
    if (PrimeFaces.download) {
      var _origPFDownload = PrimeFaces.download;
      PrimeFaces.download = function(url, mimeType, fileName) {
        console.log('[CadBrasil PageWorld] ✅ PrimeFaces.download chamado! url:', url, 'mime:', mimeType, 'file:', fileName);
        if (!_captured) {
          try {
            var xhr = new XMLHttpRequest();
            xhr.responseType = 'blob';
            var dlForm = document.createElement('form');
            dlForm.method = 'POST';
            dlForm.action = url;
            var vs = document.querySelector('input[name="javax.faces.ViewState"]');
            if (vs) {
              var vsInput = document.createElement('input');
              vsInput.type = 'hidden';
              vsInput.name = 'javax.faces.ViewState';
              vsInput.value = vs.value;
              dlForm.appendChild(vsInput);
            }
            var formData = new FormData(dlForm);
            xhr.open('POST', url, true);
            xhr.onload = function() {
              var ct = (xhr.getResponseHeader('Content-Type') || '').toLowerCase();
              console.log('[CadBrasil PageWorld] PrimeFaces.download XHR response:', ct, 'size:', xhr.response ? xhr.response.size : 0);
              if (xhr.response && (ct.includes('pdf') || ct.includes('octet-stream'))) {
                blobToBase64(xhr.response, fileName || 'SituacaoFornecedor.pdf');
              }
            };
            xhr.send(formData);
          } catch(e) {
            console.log('[CadBrasil PageWorld] PrimeFaces.download XHR erro:', e.message);
          }
        }
        return _origPFDownload.apply(this, arguments);
      };
      console.log('[CadBrasil PageWorld] PrimeFaces.download overridden');
    } else {
      console.log('[CadBrasil PageWorld] PrimeFaces existe mas .download não está definido');
      var _pfDesc = Object.getOwnPropertyDescriptor(PrimeFaces, 'download');
      if (!_pfDesc || _pfDesc.configurable) {
        var _realDownload = null;
        Object.defineProperty(PrimeFaces, 'download', {
          get: function() { return _realDownload; },
          set: function(fn) {
            console.log('[CadBrasil PageWorld] PrimeFaces.download definido! Interceptando...');
            _realDownload = function(url, mimeType, fileName) {
              console.log('[CadBrasil PageWorld] ✅ PrimeFaces.download (lazy) chamado! url:', url);
              return fn.apply(this, arguments);
            };
          },
          configurable: true
        });
      }
    }
  }

  // ── Estratégia 4: Override fetch no page world ──
  var _origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    console.log('[CadBrasil PageWorld] 🔍 fetch chamado:', url.substring(0, 100));
    var promise = _origFetch.apply(this, arguments);
    if (!_captured) {
      promise.then(function(response) {
        var ct = (response.headers.get('Content-Type') || '').toLowerCase();
        if (ct.includes('pdf') || ct.includes('octet-stream')) {
          console.log('[CadBrasil PageWorld] fetch retornou PDF!', url, ct);
          response.clone().blob().then(function(blob) {
            if (blob.size > 500) blobToBase64(blob, 'SituacaoFornecedor.pdf');
          });
        }
      }).catch(function() {});
    }
    return promise;
  };

  // ── Estratégia 5: Override XHR no page world ──
  var _origXHROpen = XMLHttpRequest.prototype.open;
  var _origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._cbd_url = url;
    this._cbd_method = method;
    return _origXHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    var self = this;
    this.addEventListener('load', function() {
      if (_captured) return;
      var ct = (self.getResponseHeader('Content-Type') || '').toLowerCase();
      if (ct.includes('pdf') || ct.includes('octet-stream')) {
        console.log('[CadBrasil PageWorld] XHR PDF detectado:', self._cbd_url, ct, 'size:', self.response ? (self.response.size || self.response.byteLength || 0) : 0);
        var blob = self.response instanceof Blob
          ? self.response
          : new Blob([self.response], { type: ct || 'application/pdf' });
        if (blob.size > 500) blobToBase64(blob, 'SituacaoFornecedor.pdf');
      }
    });
    return _origXHRSend.apply(this, arguments);
  };

  // Cleanup após 45s
  setTimeout(function() {
    HTMLFormElement.prototype.submit = _origSubmit;
    window.open = _origOpen;
    window.fetch = _origFetch;
    XMLHttpRequest.prototype.open = _origXHROpen;
    XMLHttpRequest.prototype.send = _origXHRSend;
    console.log('[CadBrasil PageWorld] Interceptadores de PDF removidos (timeout 45s)');
  }, 45000);
})();
