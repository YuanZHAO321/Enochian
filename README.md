# 以诺语翻译器 · Enochian Translator

中文、英文与以诺语（Enochian）逐词互译，并用以诺字母书写译文。纯静态网页，无需构建，打开 `index.html` 即可使用。

以诺语是 16 世纪英国学者约翰·迪伊（John Dee）与爱德华·凯利（Edward Kelley）在“天使对话”中记录的语言。本项目的词汇全部取自他们 1584 年记录的十九篇召唤（Angelic Keys），字形依据迪伊 1583 年手稿中的字母表重新绘制。

## 功能

- **翻译**：中文 → 以诺语、英文 → 以诺语、以诺语 → 中文 / 英文，可自动识别输入语言。
- **以诺文书写**：译文以 21 个以诺字母显示，默认按手稿习惯从右向左书写，可一键复制为 SVG。
- **逐词对照**：每个词显示以诺文、拼写、释义、词性和出处（第几召唤）；音译词和未收录词会单独标出。
- **字母表**：21 个字母的名称与拉丁字母对应，可点击字母拼写任意单词。
- **词典**：650 余条词汇，可按以诺词、英文或中文检索，也可按召唤筛选。

## 使用

直接用浏览器打开 `index.html`，或启动本地服务器：

```bash
npm start          # http://localhost:8080
```

部署到 GitHub Pages：在仓库 Settings → Pages 中选择从分支根目录发布即可，无需任何构建步骤。

### 在 Node.js 中调用

```js
const T = require('./src/translator.js');

T.translate('看哪，光明与真理').text;              // 'Micma, olpirt od vooan'
T.translate('Behold the face of your God').text;   // 'Micma adoian de piad'
T.translate('Ol sonf vorsg', { to: 'en' }).text;   // 'I reign over you'
T.translate('John Dee', { from: 'latin' }).script; // ['john', 'dee']（仅转写）
T.lookup('vooan');                                 // 词典词条
```

`translate(text, { from, to })` 中 `from` 可取 `auto`（默认）、`zh`、`en`、`enochian`、`latin`；以诺语译出时 `to` 可取 `zh`（默认）或 `en`。

## 翻译原理

以诺语语法所知甚少，可靠的语料几乎只有十九篇召唤及迪伊的逐词英译，因此本工具做的是**逐词对照**翻译：

1. 中文按正向最大匹配、英文按最长短语匹配查找词典释义；英文会尝试还原复数、过去式等词形。
2. 词典中没有的拉丁字母词按字母音译（C/K → Veh，I/J/Y → Gon，U/V → Van，W → 两个 Van），没有对应词的英文虚词（in、to 等）略去。
3. 以诺语译出时，查不到的词会尝试拆成已知词，例如 `odzamran` = `od`（和）+ `zamran`（显现）；u/v、i/y 等手稿中常见的拼写变体视为同一个词。
4. 语序基本保持原句，只把中文“甲的乙”调整为“乙 de 甲”，并把 `oiad`（神的）这类属格词放到名词之后，如 `busd oiad`（神的荣耀）。

结果只是基于有限语料的近似。“爱”“你好”这类现代词汇在召唤中没有对应词，无法真正翻译；人名、地名请输入拼音或英文，以字母音译。

## 项目结构

```
index.html          页面
css/style.css       样式（亮色 / 暗色主题）
src/alphabet.js     21 个以诺字母：名称、拉丁对应、SVG 字形
src/lexicon.js      词典：[以诺词, 迪伊英译, 中文释义, 词性, 出处]
src/translator.js   翻译引擎（浏览器与 Node.js 通用）
src/app.js          页面交互
test/               单元测试（npm test）
```

补充词条只需在 `src/lexicon.js` 中按格式添加一行；同一英文释义对应多个以诺词时，排在前面的优先用于翻译。

## 来源

- 字形：依据大英图书馆藏迪伊手稿 Sloane MS 3188（1583 年）中的字母表重新绘制为单线 SVG。
- 词汇：十九篇以诺召唤及迪伊的逐词英译，见迪伊手稿《48 Claves Angelicae》（Sloane MS 3191）与 1584 年的通灵记录（Cotton Appendix XLVI）。中文释义为本项目所译。

以上手稿均为 16 世纪文献，已进入公有领域。
