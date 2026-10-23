/* 以诺语翻译器页面逻辑 */
(function () {
  'use strict';

  var T = window.EnochianTranslator;
  var A = window.EnochianAlphabet;

  // 每个字形占 100×100，字距略小于 100 让字母更紧凑。
  var ADVANCE = 88;
  var WORD_GAP = 70;
  var STROKE = 8;

  var EXAMPLES = [
    { text: '看哪，光明与真理', dir: 'auto' },
    { text: '我是神的仆人', dir: 'auto' },
    { text: '诸天啊，起来，显现吧！', dir: 'auto' },
    { text: 'Behold the face of your God', dir: 'auto' },
    { text: 'In the name of the Creator, move and show yourselves', dir: 'auto' },
    { text: 'Ol sonf vorsg, goho Iad Balt', dir: 'enochian-zh' },
    { text: 'Zacar od zamran, odo cicle qaa', dir: 'enochian-en' },
    { text: 'John Dee', dir: 'latin' }
  ];

  var ZH_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  var LANG_NAME = { zh: '中文', en: '英文', enochian: '以诺语', latin: '拉丁字母' };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function zhNumber(n) {
    if (n < 10) return ZH_DIGITS[n];
    return (n >= 20 ? ZH_DIGITS[Math.floor(n / 10)] : '') + '十' + ZH_DIGITS[n % 10];
  }

  function keyLabel(key) {
    return '第' + zhNumber(key) + '召唤';
  }

  function store(name, value) {
    try {
      if (value === undefined) return window.localStorage.getItem('enochian.' + name);
      window.localStorage.setItem('enochian.' + name, value);
    } catch (e) {
      return null;
    }
    return null;
  }

  // ---------- 字形渲染 ----------

  function glyphMarkup(letter, color) {
    var c = color || 'currentColor';
    var dots = (letter.dots || [])
      .map(function (d) {
        return '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="' + d[2] + '" fill="' + c + '"/>';
      })
      .join('');
    return (
      '<path d="' + letter.d + '" fill="none" stroke="' + c + '" stroke-width="' + STROKE +
      '" stroke-linecap="round" stroke-linejoin="round"/>' + dots
    );
  }

  function installSprite() {
    var symbols = A.LETTERS.map(function (letter) {
      return '<symbol id="g-' + letter.key + '" viewBox="0 0 100 100">' + glyphMarkup(letter) + '</symbol>';
    }).join('');
    document.body.insertAdjacentHTML(
      'afterbegin',
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
        symbols + '</defs></svg>'
    );
  }

  function lettersOf(word) {
    var letters = [];
    String(word).toLowerCase().split('').forEach(function (ch) {
      letters = letters.concat(A.fromLatin(ch));
    });
    return letters;
  }

  function isRtl() {
    return $('rtl').checked;
  }

  /** 单个词的以诺文 SVG（引用字形符号）。 */
  function wordSvg(word, options) {
    options = options || {};
    var letters = lettersOf(word);
    if (!letters.length) return '';
    var rtl = options.rtl === undefined ? isRtl() : options.rtl;
    var n = letters.length;
    var width = (n - 1) * ADVANCE + 100;
    var uses = letters
      .map(function (letter, i) {
        var x = rtl ? (n - 1 - i) * ADVANCE : i * ADVANCE;
        return '<use href="#g-' + letter.key + '" x="' + x + '" y="0" width="100" height="100"/>';
      })
      .join('');
    var names = letters
      .map(function (l) {
        return l.name;
      })
      .join(' ');
    return (
      '<svg' + (options.className ? ' class="' + options.className + '"' : '') +
      ' viewBox="0 0 ' + width + ' 100" role="img" aria-label="' + esc(word + '：' + names) + '">' +
      uses + '</svg>'
    );
  }

  /** 独立的 SVG 文档（不依赖页面中的字形符号），用于复制。 */
  function standaloneSvg(words, rtl, color) {
    var placed = [];
    var x = 0;
    words.forEach(function (word, w) {
      var letters = lettersOf(word);
      if (!letters.length) return;
      if (w > 0 && placed.length) x += WORD_GAP;
      var n = letters.length;
      letters.forEach(function (letter, i) {
        placed.push({ letter: letter, x: x + i * ADVANCE });
      });
      x += (n - 1) * ADVANCE + 100;
    });
    var width = Math.max(x, 100);
    var body = placed
      .map(function (p) {
        // 从右向左：整行镜像排布位置（字形本身不翻转）
        var px = rtl ? width - p.x - 100 : p.x;
        return '<g transform="translate(' + px + ' 0)">' + glyphMarkup(p.letter, color) + '</g>';
      })
      .join('');
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ' + (width + 20) + ' 120" width="' +
      Math.round((width + 20) * 0.6) + '" height="72">' + body + '</svg>'
    );
  }

  // ---------- 复制 ----------

  function flash(message) {
    var status = $('status');
    status.textContent = message;
    clearTimeout(flash.timer);
    flash.timer = setTimeout(function () {
      status.textContent = '';
    }, 2200);
  }

  function copy(text, done) {
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(area);
      flash(ok ? done : '无法自动复制，请手动选择文本');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        flash(done);
      }, fallback);
    } else {
      fallback();
    }
  }

  // ---------- 翻译 ----------

  var lastResult = null;
  var lastScript = [];

  function optionsFor(direction) {
    switch (direction) {
      case 'zh': return { from: 'zh' };
      case 'en': return { from: 'en' };
      case 'enochian-zh': return { from: 'enochian', to: 'zh' };
      case 'enochian-en': return { from: 'enochian', to: 'en' };
      case 'latin': return { from: 'latin' };
      default: return { from: 'auto', to: 'zh' };
    }
  }

  function entryMeta(entry) {
    return T.posName(entry.pos) + ' · ' + keyLabel(entry.key);
  }

  function tokenItem(tok, result) {
    var fromEnochian = result.from === 'enochian';
    var latin, gloss, meta, alts = '', cls = 'tok tok--' + tok.kind;
    switch (tok.kind) {
      case 'word':
        latin = fromEnochian ? tok.src.toLowerCase() : tok.out;
        gloss = fromEnochian ? tok.out : tok.src;
        meta = entryMeta(tok.entry);
        if (fromEnochian) {
          var others = tok.entry[result.to === 'zh' ? 'zh' : 'en'].slice(1)
            .filter(function (g) { return g !== tok.out; });
          tok.alts.forEach(function (e) {
            others.push(result.to === 'zh' ? e.zh[0] : e.en[0]);
          });
          if (tok.entry.word !== tok.src.toLowerCase()) others.unshift('词典写作 ' + tok.entry.word);
          if (others.length) alts = '亦作：' + others.join('；');
        } else if (tok.alts.length) {
          alts = '亦作：' + tok.alts.slice(0, 4).map(function (e) { return e.word; }).join('、');
        }
        break;
      case 'compound':
        latin = tok.src.toLowerCase();
        gloss = tok.out;
        meta = '复合词：' + tok.parts.map(function (e) { return e.word; }).join(' + ');
        break;
      case 'translit':
        latin = tok.out;
        gloss = tok.src;
        meta = result.from === 'latin' ? '字母转写' : '词典未收录 · 按字母音译';
        break;
      case 'literal':
        latin = tok.out;
        gloss = '';
        meta = '数字原样保留';
        break;
      case 'unknown':
        latin = fromEnochian ? tok.src : '';
        gloss = fromEnochian ? '' : tok.src;
        meta = '词典未收录';
        break;
      case 'skip':
        return '<li class="' + cls + '"><span class="tok-gloss">' + esc(tok.src) + '</span><span class="tok-meta">略去</span></li>';
      default:
        return '';
    }
    var svg = tok.kind === 'literal' || (tok.kind === 'unknown' && !fromEnochian) ? '' : wordSvg(latin);
    return (
      '<li class="' + cls + '">' + svg +
      (latin ? '<span class="tok-latin">' + esc(latin) + '</span>' : '') +
      (gloss ? '<span class="tok-gloss">' + esc(gloss) + '</span>' : '') +
      '<span class="tok-meta">' + esc(meta) + '</span>' +
      (alts ? '<span class="tok-alts">' + esc(alts) + '</span>' : '') +
      '</li>'
    );
  }

  function notesFor(result) {
    var translit = [];
    var unknown = [];
    result.tokens.forEach(function (tok) {
      if (tok.kind === 'translit' && result.from !== 'latin') translit.push(tok.src);
      if (tok.kind === 'unknown') unknown.push(tok.src);
    });
    var notes = [];
    if (translit.length) {
      notes.push('「' + translit.join('」「') + '」不在词典中，已按字母音译成以诺文。');
    }
    if (unknown.length) {
      notes.push(
        result.from === 'enochian'
          ? '「' + unknown.join('」「') + '」在十九篇召唤中找不到对应的词。'
          : '「' + unknown.join('」「') + '」不在词典中。人名、地名等可改用拼音或英文输入，以字母音译。'
      );
    }
    return notes.join(' ');
  }

  function renderScript(words) {
    var box = $('script');
    box.dir = isRtl() ? 'rtl' : 'ltr';
    if (!words.length) {
      box.innerHTML = '<span class="empty">以诺文会显现在这里</span>';
      lastScript = [];
      return;
    }
    box.innerHTML = words
      .map(function (word, i) {
        return wordSvg(word, { className: word === lastScript[i] ? '' : 'new' });
      })
      .join('');
    lastScript = words.slice();
  }

  function translateNow() {
    var text = $('source').value;
    var direction = $('direction').value;
    var result = T.translate(text, optionsFor(direction));
    lastResult = result;

    var label = LANG_NAME[result.from] + ' → ' + (result.to === 'enochian' ? '以诺文' : LANG_NAME[result.to]);
    if (direction === 'auto' && text.trim()) label += ' · 自动识别';
    $('direction-label').textContent = label;

    renderScript(result.script);

    var output = $('output');
    output.textContent = result.text || '';
    output.className = 'output-text' + (result.to === 'zh' ? ' zh' : '');
    output.lang = result.to === 'zh' ? 'zh-CN' : result.to === 'en' ? 'en' : 'la';

    $('interlinear').innerHTML = result.tokens
      .map(function (tok) {
        return tokenItem(tok, result);
      })
      .join('');
    $('notes').textContent = notesFor(result);

    store('text', text);
    store('direction', direction);
  }

  var pending = null;
  function scheduleTranslate() {
    clearTimeout(pending);
    pending = setTimeout(translateNow, 120);
  }

  function useExample(example) {
    $('source').value = example.text;
    $('direction').value = example.dir;
    translateNow();
  }

  // ---------- 字母表 ----------

  function renderCompose() {
    var words = $('compose').value.split(/\s+/).filter(Boolean);
    var box = $('compose-out');
    box.dir = isRtl() ? 'rtl' : 'ltr';
    var html = words.map(function (w) { return wordSvg(w); }).join('');
    box.innerHTML = html || '<span class="empty">点下方字母开始拼写</span>';
  }

  function renderLetters() {
    $('letters').innerHTML = A.LETTERS.map(function (letter, i) {
      return (
        '<button type="button" class="letter" data-letter="' + letter.latin[0] + '" aria-label="' +
        esc(letter.name + '，对应 ' + letter.latin.join(' ').toUpperCase()) + '">' +
        '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#g-' + letter.key + '"/></svg>' +
        '<span class="letter-name">' + esc(letter.name) + '</span>' +
        '<span class="letter-latin">' + esc(letter.latin.join(' / ').toUpperCase()) + '</span>' +
        '<span class="letter-meta">第 ' + (i + 1) + ' 字 · ' + esc(letter.zh) + '</span>' +
        '</button>'
      );
    }).join('');

    $('alphabet-band').innerHTML = A.LETTERS.map(function (letter) {
      return '<svg viewBox="0 0 100 100"><use href="#g-' + letter.key + '"/></svg>';
    }).join('');

    var equiv = [];
    A.LETTERS.forEach(function (letter) {
      equiv.push('<li><span class="en">' + esc(letter.name) + '</span> — ' + esc(letter.latin.join(', ').toUpperCase()) + '</li>');
    });
    equiv.push('<li>W — 两个 <span class="en">Van</span></li>');
    $('equiv').innerHTML = equiv.join('');
  }

  // ---------- 词典 ----------

  function renderLexicon() {
    var query = $('lex-query').value;
    var key = parseInt($('lex-key').value, 10) || null;
    var rows = T.search(query, { key: key });
    $('lex-count').textContent = (query || key ? '找到 ' : '共 ') + rows.length + ' 条';
    $('lex-body').innerHTML = rows
      .map(function (e) {
        return (
          '<tr>' +
          '<td class="glyphs">' + wordSvg(e.word) + '</td>' +
          '<td><button type="button" class="word-link" data-word="' + esc(e.word) + '" title="在翻译台中查看">' + esc(e.word) + '</button></td>' +
          '<td>' + esc(e.en.join('; ')) + '</td>' +
          '<td>' + esc(e.zh.join('；')) + '</td>' +
          '<td class="num">' + esc(T.posName(e.pos)) + '</td>' +
          '<td class="num">' + esc(keyLabel(e.key)) + '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  // ---------- 标签页 ----------

  var VIEWS = ['translate', 'alphabet', 'lexicon', 'about'];

  function show(view, updateHash) {
    if (VIEWS.indexOf(view) === -1) view = 'translate';
    VIEWS.forEach(function (v) {
      $(v).hidden = v !== view;
      $('tab-' + v).setAttribute('aria-selected', v === view ? 'true' : 'false');
    });
    if (view === 'lexicon' && !$('lex-body').children.length) renderLexicon();
    if (updateHash && window.history && history.replaceState) {
      try {
        history.replaceState(null, '', '#' + view);
      } catch (e) {
        // 某些嵌入环境不允许修改地址
      }
    }
  }

  // ---------- 初始化 ----------

  function init() {
    installSprite();
    renderLetters();

    var examples = $('examples');
    EXAMPLES.forEach(function (ex, i) {
      examples.insertAdjacentHTML('beforeend', '<button type="button" class="chip" data-example="' + i + '">' + esc(ex.text) + '</button>');
    });
    examples.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-example]');
      if (chip) useExample(EXAMPLES[+chip.getAttribute('data-example')]);
    });

    for (var k = 1; k <= 19; k++) {
      $('lex-key').insertAdjacentHTML('beforeend', '<option value="' + k + '">' + keyLabel(k) + (k === 19 ? '（三十以太）' : '') + '</option>');
    }
    $('about-count').textContent = String(T.entries.length);

    var savedRtl = store('rtl');
    if (savedRtl !== null) $('rtl').checked = savedRtl === '1';
    var savedText = store('text');
    var savedDirection = store('direction');
    if (savedDirection && $('direction').querySelector('option[value="' + savedDirection + '"]')) {
      $('direction').value = savedDirection;
    }
    $('source').value = savedText ? savedText : EXAMPLES[0].text;

    $('source').addEventListener('input', scheduleTranslate);
    $('direction').addEventListener('change', translateNow);
    $('rtl').addEventListener('change', function () {
      store('rtl', $('rtl').checked ? '1' : '0');
      lastScript = [];
      translateNow();
      renderCompose();
      if ($('lex-body').children.length) renderLexicon();
    });

    $('copy-text').addEventListener('click', function () {
      if (lastResult && lastResult.text) copy(lastResult.text, '已复制译文');
      else flash('还没有译文');
    });
    $('copy-svg').addEventListener('click', function () {
      if (!lastResult || !lastResult.script.length) {
        flash('还没有以诺文');
        return;
      }
      copy(standaloneSvg(lastResult.script, isRtl(), '#1a1d29'), '已复制 SVG，可粘贴到设计软件或网页中');
    });

    $('letters').addEventListener('click', function (event) {
      var card = event.target.closest('[data-letter]');
      if (!card) return;
      $('compose').value += card.getAttribute('data-letter');
      renderCompose();
    });
    $('compose').addEventListener('input', renderCompose);
    $('compose-back').addEventListener('click', function () {
      $('compose').value = $('compose').value.slice(0, -1);
      renderCompose();
    });
    $('compose-clear').addEventListener('click', function () {
      $('compose').value = '';
      renderCompose();
      $('compose').focus();
    });
    $('compose-send').addEventListener('click', function () {
      $('source').value = $('compose').value;
      $('direction').value = 'auto';
      translateNow();
      show('translate', true);
    });

    $('lex-query').addEventListener('input', renderLexicon);
    $('lex-key').addEventListener('change', renderLexicon);
    $('lex-body').addEventListener('click', function (event) {
      var link = event.target.closest('[data-word]');
      if (!link) return;
      $('source').value = link.getAttribute('data-word');
      $('direction').value = 'enochian-zh';
      translateNow();
      show('translate', true);
      window.scrollTo(0, 0);
    });

    document.querySelector('.tabs').addEventListener('click', function (event) {
      var tab = event.target.closest('[data-view]');
      if (tab) show(tab.getAttribute('data-view'), true);
    });

    translateNow();
    renderCompose();
    show((location.hash || '').replace('#', ''), false);
  }

  init();
})();
