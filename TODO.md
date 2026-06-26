# To Do

## Stories

- Move story content out of SQLite and into version-controlled JSON files.
  Keep the database for user-specific story state only, such as learned and
  hanzi-learned progress. AI has had a very hard time creating and repairing
  story data, so JSON should make stories easier to review, diff, repair, and
  author manually.
- Define the story JSON format for title, HSK level, description, sentences,
  and word mappings.
- Migrate the existing seeded stories from DB insert scripts into JSON files.
- Update story loading/listing/reader code to read story content from JSON
  files instead of `stories`, `story_sentences`, `word_map`, and
  `sentence_words` content tables.

## Story Authoring Guidelines

- Do not leave simple grammar words floating around untranslated. Words such
  as "and", "is", "are", and "will" should be translated or absorbed into a
  mapped phrase whenever they appear in the English sentence.
- If the English says "the <word>", include "the" in the mapped English phrase
  instead of mapping only `<word>`. Example: map "the teacher", not just
  "teacher".
- If the English says "to <verb>", include "to" in the mapped English phrase
  instead of mapping only `<verb>`. Example: map "to study", not just "study".
- Prefer contiguous English phrases that appear exactly in the sentence. Avoid
  word mappings that leave orphaned words like "to", "the", "is", "are", or
  "will" rendered as plain English between translated words.
- When Chinese naturally omits a direct equivalent for an English helper word,
  either rewrite the English sentence so the helper word is not present, or map
  the larger phrase that expresses the same idea.
