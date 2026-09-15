import { WordDictionary } from '../lib/WordDictionary';
import { MAX_WORD_LENGTH } from '../lib/validation';

/**
 * 同一套行為規格，同時套用在 Regex 版跟 Trie 版兩個解法上。
 * 這樣可以保證兩個實作被綁在完全相同的規格上 減少重複程式碼
 */
export function runWordDictionaryContractTests(
  label: string,
  createDictionary: () => WordDictionary //此處定義了runWordDictionaryContractTests的長相
) {
  describe(`${label} - Part A: exact match`, () => {
    let dict: WordDictionary;
    beforeEach(() => {
      dict = createDictionary();
      dict.setup(['cat', 'car', 'bar']);
    });

    test('contains returns true for an exact match', () => {
      expect(dict.contains('cat')).toBe(true);
    });

    test('contains returns false for a partial match', () => {
      expect(dict.contains('ca')).toBe(false);
    });

    test('contains returns false for a word not in the dictionary', () => {
      expect(dict.contains('bat')).toBe(false);
    });

    test('setup replaces previous contents', () => {
      dict.setup(['dog']);
      expect(dict.contains('cat')).toBe(false);
      expect(dict.contains('dog')).toBe(true);
    });

    test('duplicate words in setup do not change the result', () => {
      dict.setup(['cat', 'cat', 'cat']);
      expect(dict.contains('cat')).toBe(true);
    });
  });

  describe(`${label} - Part B: prefix search`, () => {
    let dict: WordDictionary;
    beforeEach(() => {
      dict = createDictionary();
      dict.setup(['cat', 'car', 'bar']);
    });

    test('startsWith returns true for a shared prefix', () => {
      expect(dict.startsWith('ca')).toBe(true);
    });

    test('startsWith returns true for a single-branch prefix', () => {
      expect(dict.startsWith('ba')).toBe(true);
    });

    test('startsWith returns false for a prefix that does not exist', () => {
      expect(dict.startsWith('cr')).toBe(false);
    });

    test('startsWith returns true for a full word (a word is its own prefix)', () => {
      expect(dict.startsWith('cat')).toBe(true);
    });
  });

  describe(`${label} - 前綴不是完整詞時的邊界情況`, () => {
    // 字典只有 "cartoon"，沒有獨立的 "car" 這個詞，
    // 用來驗證 contains（要求完整詞）跟 startsWith（只要求路徑存在）的差異。
    let dict: WordDictionary;
    beforeEach(() => {
      dict = createDictionary();
      dict.setup(['cartoon']);
    });

    test('contains 對非完整詞的前綴回傳 false', () => {
      expect(dict.contains('car')).toBe(false);
    });

    test('startsWith 對真實存在的前綴回傳 true，即使這個前綴本身不是完整詞', () => {
      expect(dict.startsWith('car')).toBe(true);
    });

    test('search 用萬用字元比對這個前綴仍然成立', () => {
      expect(dict.search('car*')).toBe(true);
    });
  });

  describe(`${label} - Part C: wildcard search`, () => {
    let dict: WordDictionary;
    beforeEach(() => {
      dict = createDictionary();
      dict.setup(['cat', 'car', 'bar']);
    });

    test('? matches exactly one character', () => {
      expect(dict.search('c?t')).toBe(true);
    });

    test('* matches a leading portion (suffix pattern)', () => {
      expect(dict.search('*at')).toBe(true);
    });

    test('* matches a trailing portion (prefix pattern)', () => {
      expect(dict.search('ca*')).toBe(true);
    });

    test('search returns false when no word matches', () => {
      expect(dict.search('cr*')).toBe(false);
    });

    test('a lone * matches any word when the dictionary is not empty', () => {
      expect(dict.search('*')).toBe(true);
    });

    test('a lone * returns false when the dictionary is empty', () => {
      const empty = createDictionary();
      empty.setup([]);
      expect(empty.search('*')).toBe(false);
    });

    test('consecutive wildcards are handled correctly', () => {
      expect(dict.search('**')).toBe(true);
      expect(dict.search('c**')).toBe(true);
      expect(dict.search('*?*')).toBe(true);
    });

    test('multiple ? wildcards in one pattern', () => {
      expect(dict.search('?a?')).toBe(true); // 同時符合 cat, car, bar
      expect(dict.search('??')).toBe(false); // 字典裡沒有任何 2 個字母的詞
    });

    test('a pattern longer than any word returns false', () => {
      expect(dict.search('caaat')).toBe(false);
    });
  });

  describe(`${label} - 輸入防呆機制`, () => {
    let dict: WordDictionary;
    beforeEach(() => {
      dict = createDictionary();
    });

    test('setup() 會拒絕包含非英文字母的詞', () => {
      expect(() => dict.setup(['cat1'])).toThrow();
      expect(() => dict.setup(['ca-r'])).toThrow();
      expect(() => dict.setup(['c a t'])).toThrow();
    });

    test('setup() 會把混合大小寫的詞統一轉成小寫', () => {
      dict.setup(['Cat', 'CAR', 'bAr']);
      expect(dict.contains('cat')).toBe(true);
      expect(dict.contains('car')).toBe(true);
      expect(dict.contains('bar')).toBe(true);
    });

    test('setup() 會拒絕超過長度上限的詞', () => {
      const tooLong = 'a'.repeat(MAX_WORD_LENGTH + 1);
      expect(() => dict.setup([tooLong])).toThrow();
    });

    test('setup() 允許剛好等於長度上限的詞', () => {
      const exactlyMax = 'a'.repeat(MAX_WORD_LENGTH);
      expect(() => dict.setup([exactlyMax])).not.toThrow();
      expect(dict.contains(exactlyMax)).toBe(true);
    });

    test('contains() 會拒絕帶有萬用字元的輸入', () => {
      dict.setup(['cat']);
      expect(() => dict.contains('c?t')).toThrow();
      expect(() => dict.contains('ca*')).toThrow();
    });

    test('startsWith() 會拒絕帶有萬用字元的輸入', () => {
      dict.setup(['cat']);
      expect(() => dict.startsWith('c?')).toThrow();
      expect(() => dict.startsWith('ca*')).toThrow();
    });

    test('startsWith() 會拒絕超過長度上限的輸入', () => {
      dict.setup(['cat']);
      const tooLong = 'a'.repeat(MAX_WORD_LENGTH + 1);
      expect(() => dict.startsWith(tooLong)).toThrow();
    });

    test('search() 會拒絕 a-z/?/* 以外的字元', () => {
      dict.setup(['cat']);
      expect(() => dict.search('c.t')).toThrow(); // regex 特殊字元不該被當成一般字元放行
      expect(() => dict.search('cat1')).toThrow(); // 數字
    });

    test('search() 會拒絕超過長度上限的 pattern', () => {
      dict.setup(['cat']);
      const tooLong = 'a'.repeat(MAX_WORD_LENGTH + 1);
      expect(() => dict.search(tooLong)).toThrow();
    });

    test('contains()/startsWith() 會把大寫字母正規化成小寫再比對，不會拒絕', () => {
      dict.setup(['cat']);
      expect(dict.contains('CAT')).toBe(true);
      expect(dict.contains('Cat')).toBe(true);
      expect(dict.startsWith('CA')).toBe(true);
      expect(dict.startsWith('Ca')).toBe(true);
    });

    test('search() 會把大寫字母正規化成小寫再比對，不會拒絕', () => {
      dict.setup(['cat']);
      expect(dict.search('CAT')).toBe(true);
      expect(dict.search('Cat')).toBe(true);
      expect(dict.search('C?T')).toBe(true);
      expect(dict.search('CA*')).toBe(true);
    });
  });
}
