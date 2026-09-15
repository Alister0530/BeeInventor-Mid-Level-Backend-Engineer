import { WordDictionary } from '../lib/WordDictionary';
import { normalizePattern, normalizeQuery, normalizeWord } from '../lib/validation';

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  /** 字串結束時設定為true **/
  isWord: boolean = false;
}

/**
 * 解法二：Trie（前綴樹）。
 * `search` 用帶回溯的 DFS 來處理 `?`（剛好一個字元）跟 `*`（零個或多個字元）；
 *
 * 時間複雜度（N = 詞的數量，L = 平均詞長，
 * k = search pattern 裡萬用字元的數量）：
 *   setup:      O(N * L)
 *   contains:   O(L)
 *   startsWith: O(L)
 *   search:     最壞情況 O(26^k * L)，因為 `?`/`*` 會分支嘗試，
 *               但實務上因為每個節點的子節點數只會是
 *               字典裡真實存在的分支，通常遠少於 26 個，
 *               所以效能比這個上界好很多。
 *               可以對dfs()做記憶化還可以增加查詢效能
 * 空間複雜度：O(共用前綴之後的總字元數)
 *
 * 輸入防呆：每個對外方法在做任何實際處理之前，
 * 都會先透過 lib/validation.ts 裡的共用函式驗證輸入——
 * 跟 RegexWordDictionary 用的是完全同一套函式，
 * 所以儘管兩邊的底層實作完全不同，
 * 對「什麼算合法輸入」的判斷結果還是完全一致。
 */
export class TrieWordDictionary implements WordDictionary {
  /**
   * 本字典的根節點
   */
  private root: TrieNode = new TrieNode();

  setup(words: string[]): void {
    // 直接換一棵全新的空樹，等於「整個取代」舊內容
    // 之後所有方法讀到的 this.root，看到的都會是這顆新樹。
    this.root = new TrieNode();
    for (const word of words) this.insert(normalizeWord(word));
  }

  /**
   * 把一個詞放進樹裡。注意這整個詞只呼叫「一次」insert，
   * 不是每個字母各呼叫一次；逐字母往下走的動作，
   * 是靠底下這個 for 迴圈裡的區域變數 `node` 來完成的。
   */
  private insert(word: string): void {
    let node = this.root; // 從最頂端（root）出發，這裡是唯一一次讀取 this.root
    for (const ch of word) {
      // 如果目前這個節點還沒有 ch 這個文字節點，先幫它創一個
      if (!node.children.has(ch)) {
        node.children.set(ch, new TrieNode());
      }
      // 把 node 這個變數「重新指向」子節點
      node = node.children.get(ch)!;
    }
    // 迴圈跑完，node 現在停在這個詞最後一個字母對應的節點，
    // 標記它是一個完整詞的結尾
    node.isWord = true;
  }

  contains(word: string): boolean {
    const normalized = normalizeQuery(word, 'contains');
    const node = this.walk(normalized);
    // 光是「走得到底」還不夠，一定要確認這個節點真的被標記過 isWord，
    // 才代表字典裡真的有這個完整的詞（不是剛好走過的一段路徑而已）
    return node !== null && node.isWord;
  }

  /**
   * 只做完全字面的前綴比對——為什麼要拒絕 `?`/`*`，
   * 詳見 RegexWordDictionary.startsWith 的 doc comment，
   * 兩邊的理由完全一樣。
   */
  startsWith(prefix: string): boolean {
    const normalized = normalizeQuery(prefix, 'startsWith');
    // 不檢查 isWord：只要「路徑走得到底」就代表有詞以這個前綴開頭
    return this.walk(normalized) !== null;
  }

  /**
   * `contains` 跟 `startsWith` 共用的走訪邏輯：
   * 從 root 出發，沿著 `chars` 這串字元一路往下走。
   * 中途只要有任何一個字元在樹上找不到對應的小孩，就代表這條路走不通，回傳 null。
   */
  private walk(chars: string): TrieNode | null {
    let node = this.root;
    for (const ch of chars) {
      const next = node.children.get(ch);
      if (!next) return null; // 走不下去了，路徑不存在
      node = next; // 跟 insert 裡一樣，往下走一格
    }
    return node; // 整串字元都走完了，回傳最後停留的節點
  }

  search(pattern: string): boolean {
    const normalized = normalizePattern(pattern);
    // 從 root（i.e. 樹的最頂端）跟 pattern 的第 0 個字元開始，交給 dfs 去遞迴探索
    return this.dfs(this.root, normalized, 0);
  }

  /**
   * 帶回溯（backtracking）的深度優先搜尋（DFS）。
   *
   * DFS 的精神：每次選一個可能性，就把它「完整探索到底」（拿到明確的
   * true/false），才回頭嘗試下一個可能性——不會探索一半就跳去看別的選項。
   * `this.dfs(...)` 這一行呼叫，會等到裡面整個遞迴完全結束、拿到回傳值，
   * 才會繼續往下執行外面的程式碼。
   *
   * @param node    目前走到樹上的哪個節點
   * @param pattern 要比對的萬用字元字串
   * @param i       目前比對到 pattern 的第幾個字元（游標位置）
   */
  private dfs(node: TrieNode, pattern: string, i: number): boolean {
    // 終止條件：pattern 已經整個比對完了（游標走到最後）。
    // 這時候「路徑走得到底」還不夠，要看 node 是不是剛好是完整詞的結尾。
    if (i === pattern.length) return node.isWord;

    const ch = pattern[i];

    if (ch === '?') {
      // '?' 代表「剛好一個任意字元」：不知道具體是哪個字母，
      // 把目前節點的每一個子節點都當作候選，各自完整探索一次（DFS）。
      // 只要有任何一個子節點最後能走出成功的結果就成功，不用再試其他小孩。
      for (const child of node.children.values()) {
        if (this.dfs(child, pattern, i + 1)) return true;
      }
      // 所有小孩都試過了、沒有一個成功，這條路徑確定失敗
      return false;
    }

    if (ch === '*') {
      // '*' 代表「零個或多個任意字元」，沒辦法一次決定要吃幾個，
      // 所以用「每次只決定要不要再多吃一個」的方式，一步步試：
      //
      // 選項一：'*' 這次决定不再吃字元了 —— pattern 游標往前走一格（i+1），
      //         但樹的節點留在原地不動（因為沒有真的吃掉任何字母）。
      //         這個遞迴呼叫會被「完整探索到底」，才輪到看選項二。
      if (this.dfs(node, pattern, i + 1)) return true;

      // 選項二：'*' 决定再多吃一個字元 —— 樹往下走一層（換成某個小孩），
      //         但 pattern 游標維持在同一個 '*' 上不動（i 不變），
      //         因為 '*' 還沒決定要停，之後可能還會繼續吃更多字元。
      //         每個小孩都要試，因為不知道 '*' 吃掉的那個字母實際上是誰。
      for (const child of node.children.values()) {
        if (this.dfs(child, pattern, i)) return true;
      }
      return false;
    }

    // 一般字元（不是萬用字元）：只有一條路可以走，
    // 樹上有對應的小孩就往下走一格、pattern 游標也往前走一格；
    // 沒有對應的小孩，這條路直接失敗，不用再試其他可能。
    const next = node.children.get(ch);
    return next ? this.dfs(next, pattern, i + 1) : false;
  }

  // ============================================================
  // 效能優化提示（目前註解掉，未啟用）：
  //
  // 上面的 dfs() 沒有記憶化（memoization）。當 pattern 裡有多個 '*' 時，
  // 同一個 (node, i) 狀態可能經由不同路徑被重複計算多次，
  // 最壞情況會逼近 O(26^k * L)（k = pattern 裡萬用字元的數量）。
  //
  // 加上記憶化之後，同一個 (node, i) 狀態只會真正遞迴計算一次，
  // 之後遇到同樣的狀態直接查表回傳，可以大幅降低重複計算。
  //
  // 注意：memo 的 key 是 (node, i) 這個組合，代表「pattern 比對到
  // 第 i 個字元時，走到 node 這個節點」，這個意義只在同一次 search()
  // 呼叫、同一個 pattern 之內成立——所以 memo 必須是每次呼叫 search()
  // 時新建立的區域變數，不能是跨呼叫共用的 class 欄位，
  // 否則不同 pattern 的查詢結果會互相污染。
  //
  // private dfsMemo(
  //   node: TrieNode,
  //   pattern: string,
  //   i: number,
  //   memo: Map<TrieNode, Map<number, boolean>>
  // ): boolean {
  //   if (i === pattern.length) return node.isWord;
  //
  //   let cached = memo.get(node);
  //   if (cached?.has(i)) return cached.get(i)!;
  //
  //   const ch = pattern[i];
  //   let result: boolean;
  //
  //   if (ch === '?') {
  //     result = false;
  //     for (const child of node.children.values()) {
  //       if (this.dfsMemo(child, pattern, i + 1, memo)) { result = true; break; }
  //     }
  //   } else if (ch === '*') {
  //     result = this.dfsMemo(node, pattern, i + 1, memo);
  //     if (!result) {
  //       for (const child of node.children.values()) {
  //         if (this.dfsMemo(child, pattern, i, memo)) { result = true; break; }
  //       }
  //     }
  //   } else {
  //     const next = node.children.get(ch);
  //     result = next ? this.dfsMemo(next, pattern, i + 1, memo) : false;
  //   }
  //
  //   if (!cached) { cached = new Map(); memo.set(node, cached); }
  //   cached.set(i, result);
  //   return result;
  // }
  //
  // 要啟用的話，search() 要改成：
  //   const normalized = normalizePattern(pattern);
  //   return this.dfsMemo(this.root, normalized, 0, new Map());
  // ============================================================
}
