/**
 * Testy živého rozvržení stránek (js/core/page-guides.js) — čisté funkce.
 * countChars / countWords / normostrany / pageCountFromHeight nemají DOM
 * závislosti; DOM část (create) se testuje ručně v aplikaci.
 */
const PG = require('../../js/core/page-guides.js');

describe('page-guides — počítání znaků a slov', () => {
  test('countChars odstraní jeden koncový \\n (Quill)', () => {
    expect(PG.countChars('ahoj\n')).toBe(4);
    expect(PG.countChars('ahoj')).toBe(4);
  });
  test('countChars: prázdné / null → 0', () => {
    expect(PG.countChars('')).toBe(0);
    expect(PG.countChars(null)).toBe(0);
    expect(PG.countChars(undefined)).toBe(0);
  });
  test('countChars započítá mezery i vnitřní nové řádky', () => {
    expect(PG.countChars('a b\nc\n')).toBe(5); // "a b\nc" = 5 znaků
  });
  test('countWords: běžný text', () => {
    expect(PG.countWords('  jedna  dva   tři \n')).toBe(3);
  });
  test('countWords: prázdné → 0', () => {
    expect(PG.countWords('\n')).toBe(0);
    expect(PG.countWords('')).toBe(0);
  });
});

describe('page-guides — normostrany (1 NS = 1800 znaků)', () => {
  test('1800 znaků = 1.00 NS', () => {
    expect(Number(PG.normostrany(1800).toFixed(2))).toBe(1);
  });
  test('900 znaků = 0.50 NS', () => {
    expect(Number(PG.normostrany(900).toFixed(2))).toBe(0.5);
  });
  test('záporný vstup se ošetří na 0', () => {
    expect(PG.normostrany(-50)).toBe(0);
  });
});

describe('page-guides — počet A4 stran z výšky', () => {
  const P = 1122; // ~297mm @ 96dpi
  test('krátký obsah = 1 strana', () => {
    expect(PG.pageCountFromHeight(1000, P)).toBe(1);
  });
  test('přesně jedna strana = 1 (tolerance sub-pixelu)', () => {
    expect(PG.pageCountFromHeight(P, P)).toBe(1);
  });
  test('těsně přes jednu stranu = 2', () => {
    expect(PG.pageCountFromHeight(P + 80, P)).toBe(2);
  });
  test('tři strany', () => {
    expect(PG.pageCountFromHeight(P * 2 + 50, P)).toBe(3);
  });
  test('nulová/neplatná výška strany → min 1', () => {
    expect(PG.pageCountFromHeight(0, P)).toBe(1);
    expect(PG.pageCountFromHeight(5000, 0)).toBe(1);
  });
});

describe('page-guides — snapToGap (zlom nesmí protnout text)', () => {
  // řádky vysoké 20px s 5px mezerou: [0-20],[25-45],[50-70]
  const boxes = [
    { top: 0, bottom: 20 },
    { top: 25, bottom: 45 },
    { top: 50, bottom: 70 },
  ];
  test('ideál v mezeře mezi řádky se nemění', () => {
    expect(PG.snapToGap(22, boxes)).toBe(22); // mezera 20..25
  });
  test('ideál uvnitř řádku se posune PŘED tento řádek', () => {
    expect(PG.snapToGap(35, boxes)).toBe(24); // uvnitř 25..45 → top-1
  });
  test('ideál na začátku (před prvním řádkem) zůstává', () => {
    // 0 není < 0 (top prvního je 0) a 0 <= bottom 20 → uvnitř → top-1 = -1
    expect(PG.snapToGap(0, boxes)).toBe(-1);
  });
  test('ideál za posledním řádkem zůstává', () => {
    expect(PG.snapToGap(120, boxes)).toBe(120);
  });
  test('prázdné boxy → vrátí ideál beze změny', () => {
    expect(PG.snapToGap(300, [])).toBe(300);
    expect(PG.snapToGap(300, null)).toBe(300);
  });
});
