-- Merge prod.db -> local.db
-- Führe aus mit: sqlite3 local.db < scripts/merge-prod-to-local.sql
-- Oder: sqlite3 local.db ".read scripts/merge-prod-to-local.sql"

ATTACH DATABASE 'prod.db' AS prod;

BEGIN TRANSACTION;

-- 1. Users 2, 3, 4 aus prod einfügen (User 1 existiert bereits in local)
INSERT OR IGNORE INTO users (id, email, created_at)
SELECT id, email, created_at FROM prod.users WHERE id != 1;

-- 2. user_word_state User 1: Zeilen einfügen die nur in prod existieren
-- prod.db hat keine hanzi_learned/hanzi_learned_at Spalten, daher defaults (0/NULL)
INSERT OR IGNORE INTO user_word_state (user_id, vocab_id, learned, learned_at, starred, mistake_count, seen_at)
SELECT p.user_id, p.vocab_id, p.learned, p.learned_at, p.starred, p.mistake_count, p.seen_at
FROM prod.user_word_state p
WHERE p.user_id = 1
  AND NOT EXISTS (
    SELECT 1 FROM user_word_state l WHERE l.user_id = 1 AND l.vocab_id = p.vocab_id
  );

-- 3. user_word_state Users 3 und 4 aus prod komplett einfügen
INSERT OR IGNORE INTO user_word_state (user_id, vocab_id, learned, learned_at, starred, mistake_count, seen_at)
SELECT p.user_id, p.vocab_id, p.learned, p.learned_at, p.starred, p.mistake_count, p.seen_at
FROM prod.user_word_state p
WHERE p.user_id IN (3, 4);

-- 4. Explains einfügen die nur in prod existieren (ohne ID, auto-increment)
--    Identifizierung per vocabulary_id + user_answer Kombination
INSERT INTO explains (vocabulary_id, hanzi, pinyin, english, user_answer, explanation, created_at)
SELECT p.vocabulary_id, p.hanzi, p.pinyin, p.english, p.user_answer, p.explanation, p.created_at
FROM prod.explains p
WHERE NOT EXISTS (
  SELECT 1 FROM explains l
  WHERE l.vocabulary_id = p.vocabulary_id
    AND (
      (l.user_answer IS NULL AND p.user_answer IS NULL)
      OR l.user_answer = p.user_answer
    )
);

-- 5. explains_users für die neuen explains einfügen
--    Wir matchen die neuen explains per vocabulary_id + user_answer zurück auf ihre neue ID
INSERT OR IGNORE INTO explains_users (explain_id, user_id)
SELECT l.id, eu.user_id
FROM prod.explains_users eu
JOIN prod.explains p ON p.id = eu.explain_id
JOIN explains l ON l.vocabulary_id = p.vocabulary_id
  AND (
    (l.user_answer IS NULL AND p.user_answer IS NULL)
    OR l.user_answer = p.user_answer
  )
WHERE NOT EXISTS (
  SELECT 1 FROM explains_users x WHERE x.explain_id = l.id AND x.user_id = eu.user_id
);

COMMIT;

DETACH DATABASE prod;
