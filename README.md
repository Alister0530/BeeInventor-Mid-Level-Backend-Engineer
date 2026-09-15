# DasIoT Backend Technical Interview - Exercise 1：記憶體內字典（In-Memory Dictionary）

## 使用語言與執行方式

- **語言**：TypeScript, Node.js
- **測試框架**：Jest（透過 `ts-jest`）

```bash
npm install
npm test          # 執行全部測試
npm run build     # 只做型別檢查（tsc --noEmit）
```

## 專案結構

```
lib/
  WordDictionary.ts          # 共用介面，兩個解法都實作這個
  validation.ts              # 共用輸入防呆機制，兩個解法都用同一套
solution/
  RegexWordDictionary.ts     # 解法一：Set + RegExp
  TrieWordDictionary.ts      # 解法二：Trie（前綴樹）
test/
  wordDictionary.contract.ts # 共用測試規格（Part A/B/C + 輸入防呆）
  RegexWordDictionary.test.ts
  TrieWordDictionary.test.ts
```

## 題目要求整理

- 字串只會包含小寫英文字母 `a-z`
- 透過 `setup()` 設定字典時，即使單字內容重複，查詢結果依然相同（`setup()` 內部應視為一個不重複的集合，不需要處理「出現次數」）
- 重複呼叫 `setup()` 會**取代**（而不是疊加）先前的字典內容
- 需實作 `setup()` / `contains()` / `startsWith()` / `search()`

適用情境：在一組字串裡做**完全比對、前綴搜尋、萬用字元搜尋**這三種逐步疊加的查詢需求。考量過資料特性之後，決定分別用 **Regex** 跟 **Trie（前綴樹）** 兩種方式實作，理由如下。

## Regex vs Trie

| 比較面向 | Regex（`RegexWordDictionary`）                                                 | Trie（`TrieWordDictionary`）                                                 |
|---|------------------------------------------------------------------------------|----------------------------------------------------------------------------|
| **正確性** | 完全比對／前綴搜尋邏輯單純、正確性高；萬用字元需自行把 `*`、`?` 轉換成 regex 語法，轉換函式一旦寫錯容易全面出錯，且需注意跳脫其他特殊字元 | 基礎查詢（完全比對、前綴）天生沒有語法陷阱，正確性穩定；萬用字元需要額外實作 DFS／回溯，邏輯越複雜越容易漏掉邊界情況（例如連續 `*`）     |
| **可讀性** | 高：搜尋邏輯集中在一個 pattern 字串，大多數工程師都看得懂基本 regex 語法                                 | 中：需要理解樹狀節點、`children: Map` 巢狀結構與遞迴回溯邏輯，第一次接觸需要時間消化                         |
| **可維護性** | 高：程式碼量少，需求變動（例如忽略大小寫、模糊比對）通常只要改 pattern 或加 flag 即可                           | 中：資料結構與演算法綁在一起，需求變動（例如要支援刪除單字、模糊比對）往往需要大幅修改插入／查詢邏輯                         |
| **可測試性** | 高：輸入輸出都是單純值                                                                  | 中：需涵蓋插入、查詢與各種邊界情況（空字典、共用前綴節點是否正確共用、連續萬用字元）                                 |
| **擴展性** | 依專案方向而定                                                                      | 依專案方向而定                                                                    |
| **安全性** | 需注意會導致**ReDoS**危險的 pattern 結構，可搭配長度限制、白名單、逾時保護等，本問題不考慮 `re2`                 | 相對安全：內部走的是固定字元路徑比對，沒有 regex 回溯爆炸的風險；仍需對輸入做長度與型別檢查                          |
| **空間複雜度** | O(N·L)                                                                       | O(N·L) 最壞，共用前綴越多越省                                                         |
| **時間複雜度** | `contains` O(1)<br>`startsWith`／`search` O(N·L)                              | `contains`／`startsWith` O(L)<br>`search` 最壞 O(26^k·L) 但可透過在節點記憶一些資訊降低時間複雜度 |

（N = 字典裡的單字數量，L = 平均單字長度，k = pattern 裡的萬用字元數量，q = 查詢字串長度）

## 解決方式選擇

| 情境 | 選擇                                         | 理由                                              |
|---|--------------------------------------------|-------------------------------------------------|
| 字典規模小（< 1 萬筆）、查詢不頻繁 | **Regex**                                  | 開發與維護成本最低，效能差異使用者無感                             |
| 打字預測／自動完成，高頻即時前綴查詢 | **Trie**                                   | 查詢時間只跟輸入字長有關，與資料量無關，適合即時互動情境                    |
| 錯字提醒／模糊比對（容許拼錯幾個字元） | **Trie + 編輯距離（Levenshtein）** 或 **BK-tree** | Regex 與純 Trie 都無法表達「容許拼錯幾個字元」這種語意，必須疊加額外演算法才能支援 |
| 成本考量優先、目前沒有明確效能瓶頸 | **Regex**                                  | 先用 Regex，發現效能瓶頸再轉換                              |

## 設計考量與假設

- 字串只包含小寫英文字母 `a-z`，因此 `RegexWordDictionary.toRegExp` 轉換 pattern 時，除了 `?`／`*` 之外，不需要對其他字元做正規表示式跳脫（`assertValidPattern` 已經先保證 pattern 裡不會出現 a-z/?/* 以外的字元）。
- `setup()` 永遠是**取代**先前內容，而不是疊加（兩個解法在每次呼叫 `setup()` 時都會重建內部狀態）。
- 重複的詞會自然被去除重複：`RegexWordDictionary` 用 `Set` 儲存；`TrieWordDictionary` 對同一個詞插入多次，只是把同一個節點的 `isWord` 重複設成 `true`，是**冪等（idempotent）**操作，沒有任何副作用。
- 空字典時呼叫 `search('*')` 應回傳 `false`——題目特別註明「when the dictionary is not empty」，兩個解法的測試都有明確涵蓋這個案例。
- `TrieWordDictionary` 用 `Map<string, TrieNode>` 存子節點，而不是固定長度 26 的陣列。這是刻意的取捨：`Map` 只會為實際存在的字母配置記憶體（對稀疏字母分佈較省空間），代價是存取速度比陣列直接索引稍慢；如果確定字母表固定且查詢速度優先於記憶體，用 `Array(26)` 也是合理的替代方案。

### 輸入防呆機制（`lib/validation.ts`）

三個防呆需求都抽成 `lib/validation.ts` 的共用函式，讓 `RegexWordDictionary` 跟 `TrieWordDictionary` 用同一套規則判斷「什麼是合法輸入」

三個對外方法（`setup`／`contains`+`startsWith`／`search`）都遵循同一個原則：**大小寫不影響比對結果，一律先正規化成小寫再驗證跟使用；只有出現字母/`?`/`*` 以外的字元、或超過長度上限，才會被拒絕。**

- **`setup()`**（`normalizeWord`）：每個詞都必須只包含英文字母（大小寫皆可），驗證通過後統一轉換成小寫再儲存；不是字母就直接拋出例外。
- **`contains()`／`startsWith()`**（`normalizeQuery`）：輸入先轉小寫，再驗證只剩英文字母、不能有萬用字元，通過後回傳正規化後的小寫版本供比對。`?`、`*` 是 Part C 才有的語意，Part A/B 的輸入如果出現萬用字元，直接拋出例外，而不是把它們當成一般字元去比對——如果真的需要「萬用字元式的前綴比對」，可以直接用 `search(prefix + '*')` 達到一樣效果。
- **`search()`**（`normalizePattern`）：pattern 先轉小寫，再驗證只允許 `a-z`、`?`、`*` 三種字元，才會被轉成 RegExp（Regex 版）或交給 `dfs`（Trie 版）——這是為了擋掉任何字母/`?`/`*` 以外的字元（例如 regex 特殊字元 `.`、`(`、`|`、`\`、數字）意外被當成合法輸入放行的風險，這對 Trie 版來說也一樣重要，雖然 Trie 不會被 regex 語法影響，但同樣不該讓不合法的字元流進遞迴比對邏輯。
- **長度上限 `MAX_WORD_LENGTH = 64`**：英語主要辭典公認最長的單字是 "pneumonoultramicroscopicsilicovolcanoconiosis"（45 個字母），這裡抓 64 當上限，比 45 多留一些彈性空間給未來可能收錄的複合字/專有名詞，同時任何真實單字都遠遠不會碰到這個上限，不影響正常使用，卻能擋掉刻意塞進來的超長字串，避免佔用不必要的儲存空間。這個上限同時套用在 `setup()` 的詞、`contains`/`startsWith` 的查詢字串，以及 `search()` 的 pattern 上（都是正規化之後才檢查長度，大小寫轉換不會影響長度判定）。

## 測試方式

- `test/wordDictionary.contract.ts` 定義一份共用的測試規格（`runWordDictionaryContractTests`），涵蓋 Part A、B、C 以及輸入防呆機制，用工廠函式參數化，同時套用在兩個解法上。
- `RegexWordDictionary.test.ts` 跟 `TrieWordDictionary.test.ts` 只是各自匯入這份規格並套用到自己的實作——避免寫兩份幾乎一樣的測試檔，也確保兩個解法被同一套行為契約檢驗，其中一個之後改壞了一定會被抓到。
- 測試案例除了題目描述的基本情境（完全比對、前綴、單一 `?`、單一 `*` 當前綴/後綴、比對不到的情況）之外，額外補了題目沒有明講、但值得驗證的邊界情況：空字典、`setup()` 傳重複的詞、連續萬用字元（`**`、`*?*`）、同一個 pattern 裡有多個 `?`、pattern 比任何詞都長；以及輸入防呆的部分：非字母輸入、超過長度上限、`contains`/`startsWith` 收到萬用字元會拒絕、`search` 收到 regex 特殊字元或數字會拒絕、以及 `setup`/`contains`/`startsWith`/`search` 收到大寫字母時都會正規化成小寫並正確比對（不會拋出例外）。
