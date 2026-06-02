#!/usr/bin/env python3
"""Fix 8 errors found in batch 1 (IDs 1-200) after audit."""

import sqlite3

DB_PATH = "/home/ileies/Downloads/hsk-tester/local.db"

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# ID 27: 二 - sentence 1 used 两 context (二 cannot precede measure words)
cursor.execute(
    "UPDATE vocabulary SET example_sentences = ? WHERE id = 27",
    ("Tā zhù zài [...] lóu. (She lives on the second floor.)\nJīntiān shì [...] yuè sì hào. (Today is February fourth.)",)
)

# ID 29: 飞机 - wrong measure word 家 (for establishments) → 架 (for aircraft)
cursor.execute(
    "UPDATE vocabulary SET example_sentences = ? WHERE id = 29",
    ("Wǒ zuò [...] qù Běijīng. (I'm taking a plane to Beijing.)\nNà jià [...] hěn dà. (That airplane is very large.)",)
)

# ID 88: 三 - missing verb 有 in sentence 2
cursor.execute(
    "UPDATE vocabulary SET example_sentences = ? WHERE id = 88",
    ("Wǒ yǒu [...] gè mèimei. (I have three younger sisters.)\nWǒmen jiā yǒu [...] kǒu rén. (Our family has three people.)",)
)

# ID 116: 下 - wrong word order: 星期下 doesn't exist, must be 下(个)星期
cursor.execute(
    "UPDATE vocabulary SET example_sentences = ? WHERE id = 116",
    ("Māo zài zhuōzi [...]. (The cat is under the table.)\n[...] gè xīngqī wǒ qù Běijīng. (I'm going to Beijing next week.)",)
)

# ID 137: 月 - bare 生 is non-standard; correct verb is 出生 (chūshēng)
cursor.execute(
    "UPDATE vocabulary SET example_sentences = ? WHERE id = 137",
    ("Yī nián yǒu shí èr gè [...]. (A year has twelve months.)\nWǒ shì sān [...] chūshēng de. (I was born in March.)",)
)

# ID 144: 中午 - 一会 → 一会儿 (standard Mandarin form for "a little while")
cursor.execute(
    "UPDATE vocabulary SET example_sentences = ? WHERE id = 144",
    ("Wǒmen [...] yīqǐ qù chī fàn ba. (Let's go eat together at noon.)\n[...] wǒ xiǎng shuì yīhuìr jiào. (I want to take a nap at noon.)",)
)

# ID 166: 打篮球 - pinyin tone error: dá (2nd tone) → dǎ (3rd tone)
cursor.execute(
    "UPDATE vocabulary SET pinyin = 'dǎ lán qiú' WHERE id = 166"
)

# ID 189: 号 - "Wǒ de diànhuà" (my own number) makes no sense; should be "Nǐ de"
cursor.execute(
    "UPDATE vocabulary SET example_sentences = ? WHERE id = 189",
    ("Jīntiān shì jǐ [...] ? (What's today's date?)\nNǐ de diànhuà [...] shì duōshao? (What is your phone number?)",)
)

conn.commit()
print(f"Applied 8 fixes. Done.")
conn.close()
