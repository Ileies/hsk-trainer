export type WordResult = {
	correct: boolean;
	userAnswer: string;
	word: {
		id: number;
		hanzi: string;
		pinyin: string;
		pinyinPlain: string;
		english: string;
		hskLevel: number;
		mistakeCount: number;
		isNew: boolean;
		exampleSentences: string | null;
		starred: boolean;
	};
};

export type PracticeWord = WordResult['word'];

// Practice session state - persists across navigation so returning from e.g.
// /explains lands you back in the same card/phase you left.
export const practiceSession = $state({
	hsk: null as number | null,
	wordId: null as number | null,
	word: null as PracticeWord | null,
	remaining: 0,
	total: 0,
	phase: 'input' as 'input' | 'checking' | 'feedback',
	answer: '',
	result: null as WordResult | null,
	explanation: null as string | null,
	aiCorrected: false,
	aiReason: null as string | null,
	starred: false,
	showHint: false,
	showVocab: false,
	shownEnglish: null as string | null,
	repairing: false,
	repaired: false,
	repairError: null as string | null,
	seenIds: [] as number[],
	sessionStartTotal: 0,
	loadError: null as string | null,
	aiCheck: true
});
