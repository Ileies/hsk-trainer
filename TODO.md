# Vokabeln vervollständigen

Pro Batch sind zwei Aufgaben zu erledigen:

## 1. Englische Übersetzungen korrigieren und erweitern

Die Spalte `english` enthält teilweise falsche oder unvollständige Übersetzungen. Für jede Vokabel:
- Fehlerhafte Übersetzungen korrigieren
- Fehlende gleichwertige Bedeutungen ergänzen (z.B. Synonyme, alternative Übertragungen)
- Mehrere Bedeutungen mit Semikolon trennen

**Update-Befehl (Beispiel für ID 42):**
```sql
UPDATE vocabulary SET english = 'meaning 1; meaning 2; meaning 3' WHERE id = 42;
```

## 2. Beispielsätze befüllen

Für jede Vokabel in der Spalte `example_sentences` zwei Beispielsätze eintragen.

**Format pro Vokabel (ein einziges Textfeld):**
```
Wǒ hěn xǐhuān chī [...]. (I really like eating [...].)
Zhège [...] hěn hǎo chī. (This [...] is very tasty.)
```
- Sätze auf Pinyin mit Tonsymbolen
- Das abgefragte Wort durch `[...]` ersetzen
- Übersetzung in Klammern dahinter
- Zwei Sätze, durch Zeilenumbruch getrennt

**Update-Befehl (Beispiel für ID 42):**
```sql
UPDATE vocabulary SET example_sentences = 'Satz 1 auf Pinyin. (Translation.)\nSatz 2 auf Pinyin. (Translation.)' WHERE id = 42;
```

---

## Fortschritt (25 Batches, je 200 Vokabeln)

- [x] IDs 1-200
- [x] IDs 201-400
- [ ] IDs 401-600
- [ ] IDs 601-800
- [ ] IDs 801-1000
- [ ] IDs 1001-1200
- [ ] IDs 1201-1400
- [ ] IDs 1401-1600
- [ ] IDs 1601-1800
- [ ] IDs 1801-2000
- [ ] IDs 2001-2200
- [ ] IDs 2201-2400
- [ ] IDs 2401-2600
- [ ] IDs 2601-2800
- [ ] IDs 2801-3000
- [ ] IDs 3001-3200
- [ ] IDs 3201-3400
- [ ] IDs 3401-3600
- [ ] IDs 3601-3800
- [ ] IDs 3801-4000
- [ ] IDs 4001-4200
- [ ] IDs 4201-4400
- [ ] IDs 4401-4600
- [ ] IDs 4601-4800
- [ ] IDs 4801-5000
