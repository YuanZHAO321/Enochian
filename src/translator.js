/*
 * 以诺语翻译引擎 / Enochian translation engine.
 *
 * 以诺语的语法所知甚少，现存语料基本只有迪伊记录的十九篇召唤及其逐词英译，
 * 因此本引擎做的是“逐词对照”翻译：
 *   - 中文 / 英文 → 以诺语：最长匹配词典释义，未收录的拉丁字母词按字母音译；
 *   - 以诺语 → 中文 / 英文：查词典，查不到时尝试拆分复合词。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./alphabet.js'), require('./lexicon.js'));
  } else {
    root.EnochianTranslator = factory(root.EnochianAlphabet, root.EnochianLexicon);
  }
})(typeof self !== 'undefined' ? self : this, function (Alphabet, Lexicon) {
  'use strict';

  var ENTRIES = Lexicon.ENTRIES;

  var ARTICLES = { the: true, a: true, an: true };

  // 以诺语中没有独立对应词的英文虚词：查不到时略去，而不是音译。
  var EN_FUNCTION_WORDS = toSet('in to at on by into unto from do does did will would very so');

  // 中文虚词：词典中查不到时直接略去。
  var ZH_PARTICLES = '的了着过吧呢吗嘛啊呀哦哇么';

  // 常见英文写法 → 词典中迪伊使用的释义。
  var EN_SYNONYMS = {
    world: 'earth',
    sky: 'heavens',
    skies: 'heavens',
    heaven: 'heavens',
    almighty: 'all-powerful',
    dark: 'darkness',
    bright: 'brightness',
    look: 'behold',
    lo: 'behold',
    says: 'saith',
    said: 'saith',
    speaks: 'spake',
    spoke: 'spake',
    spoken: 'have spoken',
    gods: 'god',
    lords: 'lord',
    swords: 'swords',
    star: 'stars',
    holiness: 'holy'
  };

  // 用于判断输入是否为英文的常见词。
  var EN_COMMON = toSet(
    'the a an of and to in is are was were be been am i you he she it we they me him her us them ' +
    'my your his its our their this that these those for with on at by from not no but or as all ' +
    'what who whom which when where why how do does did have has had will shall can may let o ye thou thee thy'
  );

  var CJK_RE = /[㐀-鿿豈-﫿]/;

  var PUNCT_TO_ASCII = {
    '，': ',', '。': '.', '、': ',', '；': ';', '：': ':', '！': '!', '？': '?',
    '“': '"', '”': '"', '‘': "'", '’': "'", '（': '(', '）': ')', '《': '"', '》': '"', '…': '...'
  };
  var PUNCT_TO_ZH = {
    ',': '，', '.': '。', ';': '；', ':': '：', '!': '！', '?': '？', '(': '（', ')': '）'
  };

  // ---------- 工具 ----------

  function toSet(str) {
    var set = {};
    str.split(/\s+/).forEach(function (w) {
      if (w) set[w] = true;
    });
    return set;
  }

  function push(map, key, value) {
    if (!Object.prototype.hasOwnProperty.call(map, key)) map[key] = [];
    if (map[key].indexOf(value) === -1) map[key].push(value);
  }

  function has(map, key) {
    return Object.prototype.hasOwnProperty.call(map, key);
  }

  function stripDiacritics(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /** 以诺词的模糊匹配键：迪伊手稿中 u/v、i/j/y、c/k 常互换。 */
  function enochianKey(word) {
    return stripDiacritics(word)
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/w/g, 'uu')
      .replace(/v/g, 'u')
      .replace(/[jy]/g, 'i')
      .replace(/k/g, 'c');
  }

  /** 规范化英文短语：小写、去重音、连字符拆开、去掉冠词与所有格。 */
  function normEnglish(phrase) {
    return stripDiacritics(phrase)
      .toLowerCase()
      .replace(/'s\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(function (w) {
        return w && !ARTICLES[w];
      })
      .join(' ');
  }

  // ---------- 索引 ----------

  var byWord = {};
  var byKey = {};
  var enIndex = {};
  var zhIndex = {};
  var maxEnWords = 1;
  var maxZhLen = 1;

  ENTRIES.forEach(function (entry) {
    push(byWord, entry.word, entry);
    push(byKey, enochianKey(entry.word), entry);
    entry.en.forEach(function (gloss) {
      var norm = normEnglish(gloss);
      if (!norm) return;
      push(enIndex, norm, entry);
      maxEnWords = Math.max(maxEnWords, norm.split(' ').length);
    });
    entry.zh.forEach(function (gloss) {
      if (/[…()（）]/.test(gloss)) return;
      push(zhIndex, gloss, entry);
      maxZhLen = Math.max(maxZhLen, gloss.length);
    });
  });

  // ---------- 分词 ----------

  /**
   * 把文本切分为：word（拉丁字母词）、num（数字）、cjk（连续汉字）、
   * space（空白）、punct（其他字符）。
   */
  function tokenize(text) {
    var tokens = [];
    var re = /([A-Za-zÀ-ɏ]+(?:'[A-Za-z]+)?)|([0-9]+)|([㐀-鿿豈-﫿]+)|(\s+)|([\s\S])/g;
    var m;
    while ((m = re.exec(text))) {
      if (m[1]) tokens.push({ t: 'word', s: m[1] });
      else if (m[2]) tokens.push({ t: 'num', s: m[2] });
      else if (m[3]) tokens.push({ t: 'cjk', s: m[3] });
      else if (m[4]) tokens.push({ t: 'space', s: m[4] });
      else tokens.push({ t: 'punct', s: m[5] });
    }
    return tokens;
  }

  /** 拉丁字母词 → 音译用的小写字母串（去掉重音和撇号）。 */
  function latinLetters(word) {
    return stripDiacritics(word).toLowerCase().replace(/[^a-z]/g, '');
  }

  // ---------- 英文 → 以诺语 ----------

  function englishCandidates(word) {
    var list = [word];
    if (has(EN_SYNONYMS, word)) list.push(normEnglish(EN_SYNONYMS[word]));
    list.push(word + 's', word + 'es');
    if (/ies$/.test(word)) list.push(word.slice(0, -3) + 'y');
    if (/es$/.test(word)) list.push(word.slice(0, -2));
    if (/s$/.test(word)) list.push(word.slice(0, -1));
    if (/ed$/.test(word)) list.push(word.slice(0, -2), word.slice(0, -1));
    if (/ing$/.test(word)) list.push(word.slice(0, -3), word.slice(0, -3) + 'e');
    if (/eth$/.test(word)) list.push(word.slice(0, -3), word.slice(0, -3) + 'e');
    if (/est$/.test(word)) list.push(word.slice(0, -3), word.slice(0, -2));
    return list;
  }

  function lookupEnglishWord(word) {
    var candidates = englishCandidates(word);
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] && has(enIndex, candidates[i])) return enIndex[candidates[i]];
    }
    return null;
  }

  function wordToken(src, entries, extra) {
    var token = {
      kind: 'word',
      src: src,
      entry: entries[0],
      out: entries[0].word,
      alts: entries.slice(1)
    };
    if (extra) {
      for (var k in extra) token[k] = extra[k];
    }
    return token;
  }

  /** 处理一串连续的英文词（中间无标点）。 */
  function translateEnglishRun(run, out) {
    var norms = run.map(function (tok) {
      return normEnglish(tok.s);
    });
    var i = 0;
    while (i < run.length) {
      if (!norms[i]) {
        out.push({ kind: 'skip', src: run[i].s });
        i++;
        continue;
      }
      // 收集从 i 开始的实词位置（跳过冠词），尝试最长短语匹配。
      var positions = [];
      for (var j = i; j < run.length && positions.length < maxEnWords; j++) {
        if (norms[j]) positions.push(j);
      }
      var matched = null;
      for (var n = positions.length; n >= 2 && !matched; n--) {
        var phrase = positions
          .slice(0, n)
          .map(function (p) {
            return norms[p];
          })
          .join(' ');
        if (has(enIndex, phrase)) matched = { entries: enIndex[phrase], end: positions[n - 1] };
      }
      if (!matched) {
        var single = lookupEnglishWord(norms[i]);
        if (single) matched = { entries: single, end: i };
      }
      if (matched) {
        var src = run
          .slice(i, matched.end + 1)
          .map(function (tok) {
            return tok.s;
          })
          .join(' ');
        out.push(wordToken(src, matched.entries));
        i = matched.end + 1;
      } else if (run[i].t === 'num') {
        out.push({ kind: 'literal', src: run[i].s, out: run[i].s });
        i++;
      } else if (EN_FUNCTION_WORDS[norms[i]]) {
        out.push({ kind: 'skip', src: run[i].s });
        i++;
      } else {
        out.push({ kind: 'translit', src: run[i].s, out: latinLetters(run[i].s) });
        i++;
      }
    }
  }

  /** 遍历分词结果，把连续的英文词交给 translateEnglishRun，其余交给 onOther。 */
  function walkLatin(tokens, out, onOther) {
    var run = [];
    function flush() {
      if (run.length) translateEnglishRun(run, out);
      run = [];
    }
    tokens.forEach(function (tok) {
      if (tok.t === 'word' || tok.t === 'num') {
        run.push(tok);
      } else if (tok.t === 'space') {
        // 空白不打断英文短语
      } else {
        flush();
        onOther(tok);
      }
    });
    flush();
  }

  function punctToken(ch) {
    return { kind: 'punct', src: ch };
  }

  function translateEnglish(text) {
    var out = [];
    walkLatin(tokenize(text), out, function (tok) {
      if (tok.t === 'cjk') translateCjkRun(tok.s, out);
      else out.push(punctToken(tok.s));
    });
    return out;
  }

  // ---------- 中文 → 以诺语 ----------

  /** 正向最大匹配。 */
  function translateCjkRun(text, out) {
    var i = 0;
    while (i < text.length) {
      var found = null;
      for (var len = Math.min(maxZhLen, text.length - i); len >= 1; len--) {
        var sub = text.substr(i, len);
        if (has(zhIndex, sub)) {
          found = sub;
          break;
        }
      }
      if (found) {
        out.push(wordToken(found, zhIndex[found]));
        i += found.length;
        continue;
      }
      var ch = text.charAt(i);
      if (ZH_PARTICLES.indexOf(ch) !== -1) {
        out.push({ kind: 'skip', src: ch });
      } else {
        var last = out[out.length - 1];
        if (last && last.kind === 'unknown') last.src += ch;
        else out.push({ kind: 'unknown', src: ch });
      }
      i++;
    }
  }

  var DE_ENTRY = byWord.de[0];

  function isNoun(tok) {
    return tok && tok.kind === 'word' && tok.entry.pos === 'n';
  }

  /**
   * 调整中文领属结构的语序，使其接近迪伊原文：
   *   - “甲的乙 / 甲之乙”（两边都是名词）→ 乙 de 甲（以诺语 “X of Y”）；
   *   - 本身带“的”的属格词（如“神的”= oiad、“他的”= tox）放到名词之后，
   *     如 busdir oiad “神的荣耀”、aisro tox “他的应许”。
   */
  function reorderPossessives(tokens) {
    var result = tokens.slice();
    for (var k = 0; k < result.length - 1; k++) {
      var a = result[k];
      var mid = result[k + 1];
      var b = result[k + 2];
      var isLinker = (mid.kind === 'skip' && mid.src === '的') ||
        (mid.kind === 'word' && mid.entry === DE_ENTRY);
      if (isNoun(a) && isLinker && isNoun(b)) {
        result.splice(k, 3, b, wordToken(mid.src, [DE_ENTRY]), a);
        k += 2;
      } else if (
        a.kind === 'word' && /的$/.test(a.src) &&
        (a.entry.pos === 'n' || a.entry.pos === 'pron') && isNoun(mid)
      ) {
        result.splice(k, 2, mid, a);
        k += 1;
      }
    }
    return result;
  }

  function translateChinese(text) {
    var out = [];
    walkLatin(tokenize(text), out, function (tok) {
      if (tok.t === 'cjk') translateCjkRun(tok.s, out);
      else out.push(punctToken(tok.s));
    });
    return reorderPossessives(out);
  }

  // ---------- 以诺语 → 中文 / 英文 ----------

  /** 查以诺词：先精确匹配，再按 u/v、i/y 等变体匹配。 */
  function lookup(word) {
    var lower = stripDiacritics(word).toLowerCase();
    if (has(byWord, lower)) return byWord[lower];
    var key = enochianKey(word);
    if (has(byKey, key)) return byKey[key];
    return [];
  }

  /** 把查不到的词拆成若干已知词（每段至少两个字母，段数尽量少）。 */
  function splitCompound(word) {
    var key = enochianKey(word);
    if (key.length < 4 || key.length > 40) return null;
    var best = new Array(key.length + 1);
    best[0] = [];
    for (var end = 1; end <= key.length; end++) {
      for (var start = Math.max(0, end - 20); start <= end - 2; start++) {
        if (!best[start]) continue;
        var piece = key.slice(start, end);
        if (!has(byKey, piece)) continue;
        var candidate = best[start].concat([piece]);
        if (!best[end] || candidate.length < best[end].length) best[end] = candidate;
      }
    }
    var parts = best[key.length];
    if (!parts || parts.length < 2) return null;
    return parts.map(function (piece) {
      return byKey[piece][0];
    });
  }

  function glossOf(entry, target) {
    return target === 'zh' ? entry.zh[0] : entry.en[0];
  }

  function translateEnochian(text, target) {
    var out = [];
    tokenize(text).forEach(function (tok) {
      if (tok.t === 'space') return;
      if (tok.t === 'cjk' || tok.t === 'punct') {
        out.push(punctToken(tok.s));
        return;
      }
      if (tok.t === 'num') {
        out.push({ kind: 'literal', src: tok.s, out: tok.s });
        return;
      }
      var entries = lookup(tok.s);
      if (entries.length) {
        out.push(wordToken(tok.s, entries, { out: glossOf(entries[0], target) }));
        return;
      }
      var parts = splitCompound(tok.s);
      if (parts) {
        out.push({
          kind: 'compound',
          src: tok.s,
          parts: parts,
          out: parts
            .map(function (e) {
              return glossOf(e, target);
            })
            .join(target === 'zh' ? '' : ' ')
        });
        return;
      }
      out.push({ kind: 'unknown', src: tok.s });
    });
    return out;
  }

  // ---------- 仅音译 ----------

  function transliterateTokens(text) {
    var out = [];
    tokenize(text).forEach(function (tok) {
      if (tok.t === 'space') return;
      if (tok.t === 'word') out.push({ kind: 'translit', src: tok.s, out: latinLetters(tok.s) });
      else if (tok.t === 'num') out.push({ kind: 'literal', src: tok.s, out: tok.s });
      else if (tok.t === 'cjk') out.push({ kind: 'unknown', src: tok.s });
      else out.push(punctToken(tok.s));
    });
    return out;
  }

  // ---------- 拼句 ----------

  function joinOutput(tokens, target, useSource) {
    var zh = target === 'zh';
    var text = '';
    var needSpace = false;
    tokens.forEach(function (tok) {
      if (tok.kind === 'skip') return;
      if (tok.kind === 'punct') {
        var ch = tok.src;
        if (zh) ch = PUNCT_TO_ZH[ch] || ch;
        else ch = PUNCT_TO_ASCII[ch] || ch;
        if (/^\s+$/.test(ch)) return;
        text += ch;
        needSpace = !/[(“"'（]$/.test(ch);
        return;
      }
      var piece = useSource ? tok.src : tok.kind === 'unknown' ? '〔' + tok.src + '〕' : tok.out;
      if (!piece) return;
      if (!zh && needSpace && text) text += ' ';
      text += piece;
      needSpace = true;
    });
    if (zh) return text;
    // 句首大写
    return text.replace(/(^|[.!?]\s*)([a-z])/g, function (all, lead, ch) {
      return lead + ch.toUpperCase();
    });
  }

  /** 输出中需要以以诺字母显示的词（拉丁字母形式）。 */
  function scriptWords(tokens, from) {
    var words = [];
    tokens.forEach(function (tok) {
      if (from === 'enochian') {
        if (tok.kind === 'word' || tok.kind === 'compound' || tok.kind === 'unknown') {
          words.push(latinLetters(tok.src));
        }
      } else if (tok.kind === 'word' || tok.kind === 'translit') {
        words.push(latinLetters(tok.out));
      }
    });
    return words.filter(Boolean);
  }

  // ---------- 语言识别 ----------

  function detect(text) {
    if (CJK_RE.test(text)) return 'zh';
    var words = tokenize(text)
      .filter(function (t) {
        return t.t === 'word';
      })
      .map(function (t) {
        return t.s.toLowerCase();
      });
    if (!words.length) return 'en';
    var eno = 0;
    var en = 0;
    words.forEach(function (w) {
      if (lookup(w).length) eno++;
      if (EN_COMMON[w] || lookupEnglishWord(normEnglish(w) || w)) en++;
    });
    return eno > en ? 'enochian' : 'en';
  }

  // ---------- 对外接口 ----------

  /**
   * 翻译。
   * options.from: 'auto' | 'zh' | 'en' | 'enochian' | 'latin'（仅音译）
   * options.to:   以诺语 → 其他语言时的目标语言，'zh'（默认）或 'en'
   */
  function translate(text, options) {
    options = options || {};
    var from = options.from && options.from !== 'auto' ? options.from : detect(text);
    var to = from === 'enochian' ? (options.to === 'en' ? 'en' : 'zh') : 'enochian';
    var tokens;
    if (from === 'enochian') tokens = translateEnochian(text, to);
    else if (from === 'zh') tokens = translateChinese(text);
    else if (from === 'latin') tokens = transliterateTokens(text);
    else tokens = translateEnglish(text);

    return {
      from: from,
      to: to,
      tokens: tokens,
      text: joinOutput(tokens, to, false),
      source: joinOutput(tokens, from === 'zh' ? 'zh' : 'en', true),
      script: scriptWords(tokens, from)
    };
  }

  /** 把拉丁字母文本转换为以诺字母序列：[{ word, letters: [letter, ...] }] */
  function toLetters(text) {
    return tokenize(text)
      .filter(function (t) {
        return t.t === 'word';
      })
      .map(function (t) {
        var word = latinLetters(t.s);
        var letters = [];
        word.split('').forEach(function (ch) {
          letters = letters.concat(Alphabet.fromLatin(ch));
        });
        return { word: word, letters: letters };
      });
  }

  /** 词典检索：匹配以诺词、英文或中文释义。 */
  function search(query, options) {
    options = options || {};
    var q = String(query || '').trim().toLowerCase();
    var key = options.key;
    return ENTRIES.filter(function (entry) {
      if (key && entry.key !== key) return false;
      if (!q) return true;
      if (entry.word.indexOf(q) !== -1 || enochianKey(entry.word).indexOf(enochianKey(q) || q) !== -1) {
        return true;
      }
      return (
        entry.en.some(function (g) {
          return g.toLowerCase().indexOf(q) !== -1;
        }) ||
        entry.zh.some(function (g) {
          return g.indexOf(q) !== -1;
        })
      );
    });
  }

  return {
    translate: translate,
    detect: detect,
    lookup: lookup,
    splitCompound: splitCompound,
    toLetters: toLetters,
    search: search,
    entries: ENTRIES,
    alphabet: Alphabet,
    posName: function (pos) {
      return Lexicon.POS_ZH[pos] || pos;
    }
  };
});
