/**
 * RegexWordDictionary 跟 TrieWordDictionary 共用的輸入防呆機制。
 * 集中寫在這裡，代表兩個解法對「什麼是合法輸入」的認定
 */

/**
 * 英語主要辭典裡公認最長的單字是
 * "pneumonoultramicroscopicsilicovolcanoconiosis"（一種肺部疾病名稱，45 個字母）。
 * 這裡抓 64 當上限，比 45 多留一點彈性空間，
 * 未來如果要收錄更長的專有名詞/複合字也不用回頭改這個常數；
 * 同時任何真正的英文單字都遠遠不會超過這個長度，
 * 所以正常情況下完全不影響使用，又能擋掉刻意塞進來的超長垃圾字串，
 * 避免佔用不必要的儲存空間。
 */
export const MAX_WORD_LENGTH = 64;

/**
 * setup()：驗證 `word` 只包含英文字母（不分大小寫）且長度沒有超過上限，
 * 通過驗證後回傳轉換成小寫的版本，用來實際儲存。
 * 注意：這裡要求至少一個字母（不能是空字串），因為「空字串」不是一個有意義的詞。
 */
export function normalizeWord(word: string): string {
  if (!/^[A-Za-z]+$/.test(word)) {
    throw new Error(`Invalid word "${word}": only English letters (a-z or A-Z) are allowed.`);
  }
  if (word.length > MAX_WORD_LENGTH) {
    throw new Error(
      `Invalid word "${word}": exceeds the maximum length of ${MAX_WORD_LENGTH} characters (the longest word in a major English dictionary).`
    );
  }
  return word.toLowerCase();
}

/**
 * contains() / startsWith()：先把輸入轉成小寫（跟 setup() 對詞做的正規化一致，
 * 大小寫不該影響比對結果），再驗證只剩下英文字母、不能有萬用字元，
 * 而且長度不能超過上限，通過後回傳正規化後的小寫版本供呼叫端實際比對。
 * 萬用字元是 Part C（search）才有的語意，這裡故意不允許。
 * 注意：這裡允許空字串（`*` 而不是 `+`），因為 `startsWith("")` 這種查詢是有意義的
 * （任何詞都以空字串開頭），跟 setup() 要求至少一個字母的情境不同。
 */
export function normalizeQuery(value: string, caller: string): string {
  const lower = value.toLowerCase();
  if (!/^[a-z]*$/.test(lower)) {
    throw new Error(
      `Invalid argument to ${caller}("${value}"): only letters are allowed here, no '?' or '*'.`
    );
  }
  if (lower.length > MAX_WORD_LENGTH) {
    throw new Error(
      `Invalid argument to ${caller}("${value}"): exceeds the maximum length of ${MAX_WORD_LENGTH} characters.`
    );
  }
  return lower;
}

/**
 * search()：先把 pattern 轉成小寫（跟 setup()／normalizeQuery 一致的正規化邏輯），
 * 再驗證只能包含 a-z、`?`、`*` 這三種字元——
 * 這是為了擋掉 regex 特殊字元注入（RegexWordDictionary 那邊），
 * 也擋掉不該出現的字元流進 Trie 的遞迴比對邏輯（TrieWordDictionary 那邊），
 * 兩種情況都要在真正開始處理之前就先擋下來。通過驗證後回傳正規化後的小寫 pattern。
 *
 * 長度上限一樣套用 MAX_WORD_LENGTH，這是刻意簡化過的做法：
 * 因為 `*` 可以比對零個字元，理論上 pattern 字串本身可以比
 * MAX_WORD_LENGTH 更長、卻依然對應得到一個合法的詞（例如塞很多個多餘的 `*`）。
 * 但我們接受這種邊緣情況會被稍微嚴格地擋掉，換取一個簡單、容易驗證的上限——
 * 正常情況下不會有人需要寫出比最長真實單字還長的查詢 pattern。
 */
export function normalizePattern(pattern: string): string {
  const lower = pattern.toLowerCase();
  if (!/^[a-z?*]*$/.test(lower)) {
    throw new Error(`Invalid pattern "${pattern}": only letters, '?', and '*' are allowed.`);
  }
  if (lower.length > MAX_WORD_LENGTH) {
    throw new Error(`Invalid pattern "${pattern}": exceeds the maximum length of ${MAX_WORD_LENGTH} characters.`);
  }
  return lower;
}
