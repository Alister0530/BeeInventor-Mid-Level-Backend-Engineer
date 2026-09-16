-- Metadata DB schema
-- 對應 Question2.md「DB 資料表設計」章節,PostgreSQL 語法(RDS/Aurora 或自架皆可)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- ============================================================
-- users:使用者帳號
-- 採軟刪除(deleted_at),不做實體 DELETE——見 Question2.md「使用者刪除:軟刪除設計」
-- ============================================================
CREATE TABLE users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL,           -- 唯一性改用下面的 partial unique index
    password      VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'user'
                    CHECK (role IN ('user', 'ops')),
    deleted_at    TIMESTAMPTZ,                     -- null = 帳號正常;有值 = 已軟刪除
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- email 唯一性只在「還沒被軟刪除」的帳號之間強制,讓被刪除的信箱可以重新註冊
CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE deleted_at IS NULL;

-- ============================================================
-- documents:文件 metadata(不存檔案內容本身,內容在 Object Storage)
-- ============================================================
CREATE TABLE documents (
    document_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- 刻意不加 ON DELETE CASCADE:文件刪除牽涉 S3/ES 清理,不能讓 DB 層級的 CASCADE
    -- 繞過應用層的刪除管線,留空(等同 NO ACTION)當保護網——見 Question2.md
    owner_id         UUID NOT NULL REFERENCES users(user_id),
    filename         VARCHAR(255) NOT NULL,
    file_size        BIGINT,
    content_type     VARCHAR(100),
    title            VARCHAR(255),
    summary          TEXT,
    publication_year INT,
    storage_key      VARCHAR(512),              -- 驗證通過後,在正式 Object Storage 的 key
    status           VARCHAR(20) NOT NULL DEFAULT 'pending_upload'
                        CHECK (status IN (
                            'pending_upload', 'pending', 'processing',
                            'indexed', 'failed', 'deleting'
                        )),
    last_error       TEXT,                      -- status = failed 時的失敗原因
    idempotency_key  VARCHAR(255) UNIQUE,        -- 對應 POST /documents 的 Idempotency-Key header
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 支援 GET /documents?status= 依擁有者 + 狀態查詢
CREATE INDEX idx_documents_owner_status ON documents(owner_id, status);
-- 支援 Cleanup CronJob 掃描逾時的 pending_upload
CREATE INDEX idx_documents_status_created ON documents(status, created_at);

-- ============================================================
-- outbox:Outbox pattern 的事件暫存表,由 Outbox Relay 輪詢轉發到 Message Queue
-- 按 created_at 做 RANGE partition,舊 partition 可以直接 DETACH 歸檔到冷儲存,
-- 不用對持續增長的大表下昂貴的 DELETE(見 Question2.md「分區與冷儲存」)
-- ============================================================
CREATE TABLE outbox (
    id           BIGSERIAL,
    aggregate_id UUID NOT NULL,                 -- 通常是 document_id
    event_type   VARCHAR(100) NOT NULL,         -- 例如 document.pending / document.reprocess
    payload      JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,                   -- null 代表還沒被 Relay 發送
    PRIMARY KEY (id, created_at)                -- partition key 必須包含在 PK 裡
) PARTITION BY RANGE (created_at);

-- 部分索引宣告在父表上,PostgreSQL 11+ 會自動套用到每個現有/未來的 partition
CREATE INDEX idx_outbox_unpublished ON outbox(created_at) WHERE published_at IS NULL;

-- 初始的月份 partition 不用在這裡手動建,下面 partman.create_parent() 接管這張表時
-- 會依 p_premake 自動建好當月 + 未來幾期的 partition
-- 保護網:理論上不該有資料落在明確 partition 範圍之外,但避免 insert 直接報錯
CREATE TABLE outbox_default PARTITION OF outbox DEFAULT;

-- ============================================================
-- refresh_tokens:輪替制 refresh token,支援重複使用偵測
-- ============================================================
CREATE TABLE refresh_tokens (
    token_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- 純粹是登入 session,沒有外部系統(S3/ES)要清理,使用者被刪除時直接一起清掉最乾淨
    user_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    family_id  UUID NOT NULL,                   -- 同一條登入鏈路共用一個 family_id
    token_hash VARCHAR(255) NOT NULL,           -- 只存 hash,不存明文
    used_at    TIMESTAMPTZ,                     -- 已被換發過就會有值;若再被使用一次 = 重複使用
    revoked_at TIMESTAMPTZ,                     -- 登出、或偵測到重複使用時整批撤銷
    expires_at TIMESTAMPTZ NOT NULL,            -- 絕對效期上限(建立時 + 30 天)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
-- /auth/refresh 的核心查詢路徑是「用使用者帶來的 token 反查」,一定要有這個索引
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- ============================================================
-- audit_logs:維運人員跨使用者存取的稽核紀錄
-- 跟 outbox 一樣按 created_at 做 RANGE partition + 冷儲存歸檔
-- ============================================================
CREATE TABLE audit_logs (
    log_id        BIGSERIAL,
    -- 刻意不加 ON DELETE CASCADE:稽核紀錄不該因為當事人帳號被刪就消失。
    -- 因為 users 走軟刪除、row 永遠不會被實體刪除,這個外鍵實務上不會被觸發到
    actor_user_id UUID NOT NULL REFERENCES users(user_id),
    action        VARCHAR(100) NOT NULL,        -- 例如 view_document / delete_user
    target_type   VARCHAR(50) NOT NULL,         -- 例如 document / user
    target_id     UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (log_id, created_at)
) PARTITION BY RANGE (created_at);

-- 宣告在父表上,自動套用到每個 partition
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id, created_at);

-- 同樣不手動建月份 partition,交給下面 partman.create_parent() 自動建立
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

-- ============================================================
-- Partition 維護:交給 pg_partman + pg_cron 在 DB 層自動處理,不用應用層自己寫排程
-- (見 Question2.md「分區與冷儲存」)。
-- 前提:pg_cron 需要在資料庫啟動時就載入 shared_preload_libraries = 'pg_cron'
-- (伺服器層級設定,雲端是 RDS/Aurora 的 parameter group + reboot,地端是
-- postgresql.conf + 重啟),要在資料庫佈建階段就設定好,這份腳本本身沒辦法做到這件事。
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;

SELECT partman.create_parent(
    p_parent_table => 'public.outbox',
    p_control => 'created_at',
    p_type => 'native',
    p_interval => '1 month',
    p_premake => 3
);
-- retention_keep_table = true:pg_partman 只負責 detach 過期 partition,不自動刪除,
-- 保留給 Cleanup Service 匯出到 S3 冷儲存之後,再真正 DROP TABLE
UPDATE partman.part_config
SET retention = '30 days',
    retention_keep_table = true
WHERE parent_table = 'public.outbox';

SELECT partman.create_parent(
    p_parent_table => 'public.audit_logs',
    p_control => 'created_at',
    p_type => 'native',
    p_interval => '1 month',
    p_premake => 3
);
UPDATE partman.part_config
SET retention = '13 months',
    retention_keep_table = true
WHERE parent_table = 'public.audit_logs';

-- 每小時跑一次 pg_partman 的維護函式:提前建好未來 partition、detach 過期 partition
SELECT cron.schedule('partman-maintenance', '0 * * * *', $$SELECT partman.run_maintenance();$$);
