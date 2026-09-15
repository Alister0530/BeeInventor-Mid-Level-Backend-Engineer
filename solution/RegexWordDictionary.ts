import { WordDictionary } from '../lib/WordDictionary';
import { normalizePattern, normalizeQuery, normalizeWord } from '../lib/validation';

/**
 * 解法一：扁平儲存 + RegExp。
 *
 * 所有詞存在一個 Set 裡，`contains` 因此天生就有平均 O(1) 的查詢速度。
 * `startsWith` 跟 `search` 都得退回逐一掃過整個 Set，
 * 但 `search` 的 pattern → 是否比對成功這件事，
 * 是交給原生 RegExp 引擎處理，而不是自己刻一個回溯函式——
 * 比起手刻的邏輯（容易在 off-by-one、連續 `*` 這種情況出包），
 * 用原生引擎犯錯的機率低很多。
 *
 * 時間複雜度（N = 詞的數量，L = 平均詞長）：
 *   setup:      O(N * L)  - 要驗證並轉小寫每一個詞
 *   contains:   O(L)      - Set 查詢（雜湊 + 比對）
 *   startsWith: O(N * L)  - 沒有前綴索引，必須掃過每個詞
 *   search:     O(N * L)  - 必須掃過每個詞；每次 RegExp.test
 *                           對這種簡單 pattern 大約是 O(L)
 * 空間複雜度：O(N * L) - 每個詞都完整存一份，沒有共用。
 *
 * startsWith/search 的漸進複雜度比Trie較差，
 * 但實作短、不容易寫錯。
 *
 * 輸入防呆：每個對外方法在做任何實際處理之前，
 * 都會先透過 lib/validation.ts 裡的共用函式把輸入正規化成小寫並驗證，
 * 大小寫不影響比對結果，只有出現字母以外的字元（萬用字元除外，
 * 那是 search 專屬的語意）或超過長度上限，才會被拒絕。
 */
export class RegexWordDictionary implements WordDictionary {
  private words: Set<string> = new Set();

  /**
   * 載入或取代字典內容。每個詞都必須只包含英文字母（不分大小寫），
   * 且長度不能超過 MAX_WORD_LENGTH；儲存前會統一轉成小寫。
   */
  setup(words: string[]): void {
    this.words = new Set(words.map((word) => normalizeWord(word)));
  }

  contains(word: string): boolean {
    const normalized = normalizeQuery(word, 'contains');
    return this.words.has(normalized);
  }

  /**
   * 只做完全字面的前綴比對。萬用字元（`?`、`*`）是 Part C 的範疇
   */
  startsWith(prefix: string): boolean {
    const normalized = normalizeQuery(prefix, 'startsWith');
    for (const word of this.words) {
      if (word.startsWith(normalized)) return true;
    }
    return false;
  }

  /**
   * 萬用字元搜尋。pattern 會先被正規化（轉小寫）並驗證只包含 a-z、`?`、`*`，
   * 才會被轉換成 RegExp——
   * 這是為了防止 regex 特殊字元被意外注入
   * （例如一個不小心混進來的 `.`、`(`、`|`、`\\`），
   * 導致它被當成 regex 語法解讀，而不是被當成不合法輸入擋下來。
   */
  search(pattern: string): boolean {
    const normalized = normalizePattern(pattern);
    const regex = this.toRegExp(normalized);
    for (const word of this.words) {
      if (regex.test(word)) return true;
    }
    return false;
  }

  /**
   * 把我們自己的 pattern 語言（`?` = 一個字元，`*` =零個或多個字元）
   * 轉換成 RegExp，並且加上頭尾錨點，確保是比對整個詞。
   * 這裡不需要對一般字元做跳脫處理，
   * 因為 `normalizePattern` 已經保證 pattern 裡不會出現
   * a-z、`?`、`*` 以外的字元。
   */
  private toRegExp(pattern: string): RegExp {
    let body = '';
    for (const ch of pattern) {
      if (ch === '?') body += '.';
      else if (ch === '*') body += '.*';
      else body += ch;
    }
    return new RegExp(`^${body}$`);
  }
}
