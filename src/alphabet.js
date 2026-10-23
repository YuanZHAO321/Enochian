/*
 * 以诺字母表 / The Enochian alphabet.
 *
 * 字形依据约翰·迪伊 1583 年手稿 (Sloane MS 3188) 中的字母表重新绘制为
 * 单线笔画 SVG（100×100 坐标系，基线 y≈86，字顶 y≈14）。
 * Glyphs are original monoline redrawings of the letterforms in John Dee's
 * 1583 manuscript (Sloane MS 3188), on a 100×100 grid.
 *
 * 字母顺序遵循迪伊手稿：Pa, Veh, Ged, Gal, Or, Un, Graph, Tal, Gon, Na, Ur,
 * Mals, Ger, Drux, Pal, Med, Don, Ceph, Van, Fam, Gisg。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EnochianAlphabet = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // latin: 该字母对应的拉丁字母（第一个为主读音）
  // d: SVG 路径；dots: 实心圆点 [cx, cy, r]
  var LETTERS = [
    {
      name: 'Pa', latin: ['b'], zh: '帕',
      d: 'M12 15H28M20 15Q30 48 46 86Q57 56 72 30C80 16 66 8 58 16C52 24 58 34 68 30'
    },
    {
      name: 'Veh', latin: ['c', 'k'], zh: '维',
      d: 'M25 19Q29 12 36 15V84M24 85H48M36 47C50 44 58 34 61 24C63 15 73 16 71 25M36 52C47 50 54 57 50 65C47 71 40 68 43 62M49 64C55 73 60 80 68 85'
    },
    {
      name: 'Ged', latin: ['g'], zh: '盖德',
      d: 'M22 14H40M31 14C25 46 33 84 56 85C72 86 81 74 79 60C77 46 62 41 50 41M55 60C61 56 69 59 68 67'
    },
    {
      name: 'Gal', latin: ['d'], zh: '加尔',
      d: 'M24 13Q30 14 30 22V42M30 27C44 22 59 27 59 41C59 55 45 61 40 72M20 82C36 74 54 80 74 86L80 78'
    },
    {
      name: 'Or', latin: ['f'], zh: '奥尔',
      d: 'M40 22C54 24 66 20 80 15M70 15C58 36 43 62 26 84M17 79L31 87M49 53C60 50 67 58 61 66C57 72 52 70 52 65'
    },
    {
      name: 'Un', latin: ['a'], zh: '温',
      d: 'M26 18C20 15 18 23 25 25C40 38 58 56 70 84M74 14C61 31 45 52 28 82M36 50H66M64 84H78'
    },
    {
      name: 'Graph', latin: ['e'], zh: '格拉夫',
      d: 'M20 30V17H70M70 17C72 40 70 62 66 84M56 85H78'
    },
    {
      name: 'Tal', latin: ['m'], zh: '塔尔',
      d: 'M70 25C63 11 40 11 33 31C27 50 30 74 45 83C57 90 70 85 75 72M31 49H63'
    },
    {
      name: 'Gon', latin: ['i', 'j', 'y'], zh: '贡',
      d: 'M17 28V17H58M58 17C59 40 58 60 55 82M55 83H80L84 74'
    },
    {
      name: 'Na', latin: ['h'], zh: '纳',
      d: 'M36 82C20 74 15 46 26 34C36 22 50 30 50 46C50 30 64 22 74 34C85 46 80 74 64 82M36 82C42 77 44 70 41 64M64 82C58 77 56 70 59 64'
    },
    {
      name: 'Ur', latin: ['l'], zh: '乌尔',
      d: 'M68 13C52 28 37 42 37 56C38 69 56 75 78 86M19 40C27 43 32 48 37 56M21 82C28 76 33 66 37 56'
    },
    {
      name: 'Mals', latin: ['p'], zh: '马尔斯',
      d: 'M13 74V87M13 82H38C29 68 29 31 50 31C71 31 71 68 62 82H87M87 74V87'
    },
    {
      name: 'Ger', latin: ['q'], zh: '格尔',
      d: 'M17 16H42M29 16V80H71V16M60 16L84 13'
    },
    {
      name: 'Drux', latin: ['n'], zh: '德鲁克斯',
      d: 'M25 12C35 23 44 33 50 43M50 43C62 41 74 34 82 24M37 45C57 47 66 58 60 70C54 80 41 82 29 87M46 62C53 62 58 65 62 70'
    },
    {
      name: 'Pal', latin: ['x'], zh: '帕尔',
      d: 'M31 17C31 40 29 64 24 85M15 86H37M31 17H77L80 33',
      dots: [[46, 35, 5]]
    },
    {
      name: 'Med', latin: ['o'], zh: '梅德',
      d: 'M38 14H54M46 14C45 40 37 64 24 84C44 81 63 74 79 60'
    },
    {
      name: 'Don', latin: ['r'], zh: '冬',
      d: 'M66 24C60 12 41 14 41 28C41 40 52 46 59 46M59 46C40 46 29 56 31 68C33 82 53 88 67 78M50 46H64'
    },
    {
      name: 'Ceph', latin: ['z'], zh: '塞夫',
      d: 'M40 15V84M27 86H53M40 18C60 10 80 16 78 32C76 46 58 48 40 44M22 32H40'
    },
    {
      name: 'Van', latin: ['u', 'v', 'w'], zh: '万',
      d: 'M30 17C44 10 54 18 58 30C64 50 72 72 84 86M56 44C40 48 22 66 24 79C26 88 40 86 52 72M72 86H92'
    },
    {
      name: 'Fam', latin: ['s'], zh: '法姆',
      d: 'M17 22C30 14 42 23 52 22M63 12C56 20 50 26 50 35C50 54 58 72 66 88'
    },
    {
      name: 'Gisg', latin: ['t'], zh: '吉斯格',
      d: 'M22 44C27 58 27 70 24 83C47 77 69 53 82 14'
    }
  ];

  // 拉丁字母 → 以诺字母。W 写作两个 Van（迪伊亦如此处理）。
  var LATIN_MAP = {};
  LETTERS.forEach(function (letter, index) {
    letter.index = index;
    letter.key = letter.name.toLowerCase();
    letter.latin.forEach(function (ch) {
      if (ch !== 'w') LATIN_MAP[ch] = [letter];
    });
  });
  LATIN_MAP.w = [LETTERS[18], LETTERS[18]];

  var BY_NAME = {};
  LETTERS.forEach(function (letter) {
    BY_NAME[letter.key] = letter;
  });

  /** 把一个拉丁字母转换为以诺字母数组（未知字符返回空数组）。 */
  function fromLatin(ch) {
    return LATIN_MAP[String(ch).toLowerCase()] || [];
  }

  return {
    LETTERS: LETTERS,
    fromLatin: fromLatin,
    byName: function (name) {
      return BY_NAME[String(name).toLowerCase()] || null;
    }
  };
});
