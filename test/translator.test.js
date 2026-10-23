'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Alphabet = require('../src/alphabet.js');
const Lexicon = require('../src/lexicon.js');
const T = require('../src/translator.js');

test('字母表：21 个字母，名称唯一，顺序与迪伊手稿一致', () => {
  const names = Alphabet.LETTERS.map((l) => l.name);
  assert.deepEqual(names, [
    'Pa', 'Veh', 'Ged', 'Gal', 'Or', 'Un', 'Graph', 'Tal', 'Gon', 'Na', 'Ur',
    'Mals', 'Ger', 'Drux', 'Pal', 'Med', 'Don', 'Ceph', 'Van', 'Fam', 'Gisg'
  ]);
  for (const letter of Alphabet.LETTERS) {
    assert.match(letter.d, /^[MLHVCQZ0-9 .-]+$/i, `${letter.name} 的路径数据`);
  }
});

test('字母表：26 个拉丁字母都有对应，W 写作两个 Van', () => {
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
    assert.ok(Alphabet.fromLatin(ch).length > 0, ch);
  }
  assert.deepEqual(Alphabet.fromLatin('w').map((l) => l.name), ['Van', 'Van']);
  assert.equal(Alphabet.fromLatin('K')[0].name, 'Veh');
  assert.equal(Alphabet.fromLatin('y')[0].name, 'Gon');
  assert.deepEqual(Alphabet.fromLatin('1'), []);
});

test('词典：词条格式正确', () => {
  const POS = Object.keys(Lexicon.POS_ZH);
  const seen = new Set();
  for (const e of Lexicon.ENTRIES) {
    assert.match(e.word, /^[a-z]+$/, e.word);
    assert.ok(e.en.length && e.en.every(Boolean), `${e.word} 英文释义`);
    assert.ok(e.zh.length && e.zh.every(Boolean), `${e.word} 中文释义`);
    assert.ok(POS.includes(e.pos), `${e.word} 词性 ${e.pos}`);
    assert.ok(Number.isInteger(e.key) && e.key >= 1 && e.key <= 19, `${e.word} 出处`);
    const id = e.word + '|' + e.en[0];
    assert.ok(!seen.has(id), `重复词条 ${id}`);
    seen.add(id);
  }
  assert.ok(Lexicon.ENTRIES.length > 600);
});

test('英文 → 以诺语', () => {
  assert.equal(T.translate('Behold the face of your God').text, 'Micma adoian de piad');
  assert.equal(T.translate('I am the servant of the Highest').text, 'Zirdo noco de iaida');
  assert.equal(T.translate('O ye heavens, arise!').text, 'Madriax, torzu!');
  assert.equal(
    T.translate('In the name of the Creator, move and show yourselves!').text,
    'Dooiap de qaal, zacar od zamran!'
  );
});

test('英文：词形变化与同义词', () => {
  assert.equal(T.translate('stars', { from: 'en' }).text, 'Aoiveae');
  assert.equal(T.translate('star', { from: 'en' }).text, 'Aoiveae');
  assert.equal(T.translate('the world', { from: 'en' }).text, 'Caosg');
  assert.equal(T.translate('hands', { from: 'en' }).text, 'Zol');
});

test('英文：未收录的词按字母音译，没有对应词的虚词略去', () => {
  const r = T.translate('The dragon sleeps in the west');
  assert.equal(r.text, 'Vovina brgda soboln');
  assert.ok(r.tokens.some((t) => t.kind === 'skip' && t.src === 'in'));

  const love = T.translate('I love you');
  assert.equal(love.text, 'Ol love nonci');
  assert.equal(love.tokens.find((t) => t.src === 'love').kind, 'translit');
});

test('中文 → 以诺语', () => {
  assert.equal(T.translate('看哪，光明与真理').text, 'Micma, olpirt od vooan');
  assert.equal(T.translate('诸天啊，起来，显现吧！').text, 'Madriax, torzu, zamran!');
});

test('中文：领属结构调整为以诺语语序', () => {
  assert.equal(T.translate('我是神的仆人').text, 'Zirdo noco oiad');
  assert.equal(T.translate('神的荣耀').text, 'Busd oiad');
  assert.equal(T.translate('神之名').text, 'Dooain de iad');
  assert.equal(T.translate('我是至高者的真正敬拜者').text, 'Zirdo hoath de iaida');
});

test('中文：未收录的字标记为未知', () => {
  const r = T.translate('我爱你');
  assert.equal(r.text, 'Ol 〔爱〕 ils');
  assert.equal(r.tokens[1].kind, 'unknown');
});

test('以诺语 → 中文 / 英文（第一召唤开篇）', () => {
  const zh = T.translate('Ol sonf vorsg, goho Iad Balt');
  assert.equal(zh.from, 'enochian');
  assert.equal(zh.text, '我统治在你们之上，说神正义');
  const en = T.translate('Ol sonf vorsg, goho Iad Balt', { to: 'en' });
  assert.equal(en.text, 'I reign over you, saith God justice');
});

test('以诺语：拼写变体与复合词', () => {
  assert.equal(T.lookup('uooan')[0].word, 'vooan');
  assert.equal(T.lookup('Yolcam')[0].word, 'yolcam');
  assert.deepEqual(T.splitCompound('odzamran').map((e) => e.word), ['od', 'zamran']);
  const r = T.translate('odzamran', { from: 'enochian', to: 'en' });
  assert.equal(r.tokens[0].kind, 'compound');
  assert.equal(r.text, 'And appear');
});

test('语言识别', () => {
  assert.equal(T.detect('看哪'), 'zh');
  assert.equal(T.detect('Micma goho Piad'), 'enochian');
  assert.equal(T.detect('Behold the face of your God'), 'en');
  assert.equal(T.detect('I am'), 'en');
});

test('仅转写：拉丁字母 → 以诺字母', () => {
  const r = T.translate('John Dee', { from: 'latin' });
  assert.deepEqual(r.script, ['john', 'dee']);
  const [john] = T.toLetters('John');
  assert.deepEqual(john.letters.map((l) => l.name), ['Gon', 'Med', 'Na', 'Drux']);
});

test('以诺文输出：右向左渲染用的词列表', () => {
  assert.deepEqual(T.translate('看哪，光明与真理').script, ['micma', 'olpirt', 'od', 'vooan']);
  assert.deepEqual(T.translate('Zacar od zamran').script, ['zacar', 'od', 'zamran']);
});

test('词典检索', () => {
  assert.ok(T.search('dragon').some((e) => e.word === 'vovina'));
  assert.ok(T.search('真理').some((e) => e.word === 'vooan'));
  assert.ok(T.search('', { key: 19 }).every((e) => e.key === 19));
  assert.equal(T.search('').length, Lexicon.ENTRIES.length);
});
