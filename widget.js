/**
 * AcuTwin Widget — встраиваемая кнопка онлайн-записи для сайтов клиник.
 *
 * Использование:
 *   <button onclick="AcuTwinBook.open('doctor-slug')">Записаться</button>
 *   <button onclick="AcuTwinBook.openClinic('clinic-slug')">Все врачи клиники</button>
 *   <script src="https://acutwin.ru/widget.js" async></script>
 *
 * Можно также подключить data-атрибутами:
 *   <a data-acutwin-doctor="petrov-p-p">Записаться к Петрову</a>
 *   <a data-acutwin-clinic="mivm">Запись в клинику МИВМ</a>
 */
(function () {
  'use strict';
  if (window.AcuTwinBook) return; // защита от двойной загрузки

  // Базовый origin — берём с того же сервера, откуда загружен widget.js
  var ORIGIN = (function () {
    var s = document.currentScript;
    if (!s) {
      var ss = document.getElementsByTagName('script');
      for (var i = ss.length - 1; i >= 0; i--) {
        if (ss[i].src && ss[i].src.indexOf('/widget.js') !== -1) { s = ss[i]; break; }
      }
    }
    try { return new URL(s.src).origin; } catch (e) { return 'https://acutwin.ru'; }
  })();

  function openIframe(srcPath) {
    if (document.getElementById('acutwin-widget-root')) return;
    var root = document.createElement('div');
    root.id = 'acutwin-widget-root';
    root.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483600',
      'background:rgba(0,0,0,0.75)', 'backdrop-filter:blur(4px)',
      '-webkit-backdrop-filter:blur(4px)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:16px', 'box-sizing:border-box', 'animation:acutwinFade .2s ease'
    ].join(';');

    var card = document.createElement('div');
    card.style.cssText = [
      'position:relative', 'width:100%', 'max-width:780px',
      'height:min(92vh,860px)', 'border-radius:16px', 'overflow:hidden',
      'background:#131313', 'box-shadow:0 30px 80px rgba(0,0,0,.6)'
    ].join(';');

    var closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Закрыть'); /* i18n-ok */
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = [
      'position:absolute', 'top:10px', 'right:10px', 'z-index:2',
      'width:34px', 'height:34px', 'border-radius:50%', 'border:none',
      'background:rgba(255,255,255,0.12)', 'color:#fff',
      'font-size:24px', 'line-height:1', 'cursor:pointer',
      'display:flex', 'align-items:center', 'justify-content:center',
      'transition:background .15s'
    ].join(';');
    closeBtn.onmouseover = function(){ closeBtn.style.background = 'rgba(255,255,255,0.22)'; };
    closeBtn.onmouseout  = function(){ closeBtn.style.background = 'rgba(255,255,255,0.12)'; };
    closeBtn.onclick = close;

    var iframe = document.createElement('iframe');
    iframe.src = ORIGIN + srcPath + (srcPath.indexOf('?') > -1 ? '&' : '?') + 'embed=1';
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#131313';
    iframe.allow = 'clipboard-write';

    card.appendChild(closeBtn);
    card.appendChild(iframe);
    root.appendChild(card);

    // Закрытие по клику на затемнение и по Esc
    root.addEventListener('click', function (e) { if (e.target === root) close(); });
    document.addEventListener('keydown', escHandler);

    // postMessage из iframe → можно закрыть после успешной записи
    window.addEventListener('message', msgHandler);

    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';

    function escHandler(e) { if (e.key === 'Escape') close(); }
    function msgHandler(e) {
      if (e.origin !== ORIGIN) return;
      if (e.data && e.data.type === 'acutwin:booked') {
        // Записал — не закрываем сразу, пусть пациент увидит экран успеха.
        // Закрытие — кнопкой/Esc.
      }
      if (e.data && e.data.type === 'acutwin:close') close();
    }
    function close() {
      document.removeEventListener('keydown', escHandler);
      window.removeEventListener('message', msgHandler);
      root.remove();
      document.body.style.overflow = '';
    }
  }

  // Анимация fade-in (внедряем стиль один раз)
  if (!document.getElementById('acutwin-widget-style')) {
    var s = document.createElement('style');
    s.id = 'acutwin-widget-style';
    s.textContent = '@keyframes acutwinFade{from{opacity:0}to{opacity:1}}';
    document.head.appendChild(s);
  }

  window.AcuTwinBook = {
    open: function (doctorSlug) {
      if (!doctorSlug) return;
      openIframe('/book.html?doctor=' + encodeURIComponent(doctorSlug));
    },
    openClinic: function (clinicSlug) {
      if (!clinicSlug) return;
      openIframe('/clinic.html?slug=' + encodeURIComponent(clinicSlug));
    },
    openClinicDoctor: function (clinicSlug, doctorSlug) {
      if (!doctorSlug) return;
      openIframe('/book.html?doctor=' + encodeURIComponent(doctorSlug) +
        '&clinic=' + encodeURIComponent(clinicSlug || ''));
    }
  };

  // Авто-подключение элементов с data-атрибутами
  function bindData() {
    document.querySelectorAll('[data-acutwin-doctor]').forEach(function (el) {
      if (el._acutwinBound) return; el._acutwinBound = true;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        e.preventDefault();
        window.AcuTwinBook.open(el.getAttribute('data-acutwin-doctor'));
      });
    });
    document.querySelectorAll('[data-acutwin-clinic]').forEach(function (el) {
      if (el._acutwinBound) return; el._acutwinBound = true;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        e.preventDefault();
        window.AcuTwinBook.openClinic(el.getAttribute('data-acutwin-clinic'));
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindData);
  } else {
    bindData();
  }
})();
