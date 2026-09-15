/**
 * Exercise 1「記憶體內字典」的共用介面。
 * Regex 版跟 Trie 版兩個解法都實作同一個介面，
 * 所以可以自由替換使用，也能用同一套行為規格去測試
 * （見 test/wordDictionary.contract.ts）。
 */
export interface WordDictionary {
  /** 載入或取代字典內容。 */
  setup(words: string[]): void;

  /** 只有完全比對到一個完整的詞，才回傳 true。 */
  contains(word: string): boolean;

  /** 如果字典裡有任何一個詞是以 `prefix` 開頭，回傳 true。 */
  startsWith(prefix: string): boolean;

  /**
   * 如果字典裡有任何一個詞完整符合 `pattern`，回傳 true。
   * `?` 代表剛好一個字元，`*` 代表零個或多個字元。
   */
  search(pattern: string): boolean;
}
