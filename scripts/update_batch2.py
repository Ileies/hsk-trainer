#!/usr/bin/env python3
"""Update vocabulary IDs 201-400: fix English translations and add example sentences."""

import sqlite3

DB_PATH = "/home/ileies/Downloads/hsk-tester/local.db"

updates = [
    (201, "to enter; to come in; to go in; to advance",
     "Qǐng [...] lái. (Please come in.)\nTā [...] le jiàoshì. (She entered the classroom.)"),

    (202, "near; close; nearby; approximately",
     "Xuéxiào [...] zhèlǐ bù yuǎn. (The school is not far from here.)\nWǒ jiā lí gōngzuò hěn [...]. (My home is very close to work.)"),

    (203, "just; right away; immediately; already; exactly; then; only",
     "Wǒ [...] lái. (I'll be right there.)\nTā [...] zhīdào le. (He already knew.)"),

    (204, "to feel; to think; to believe; to have the feeling that",
     "Wǒ [...] tā hěn hǎo. (I feel she is very nice.)\nNǐ [...] zhège diànyǐng zěnme yàng? (What do you think of this movie?)"),

    (205, "coffee",
     "Wǒ měitiān hē yī bēi [...]. (I drink a cup of coffee every day.)\nZhège [...] hěn xiāng. (This coffee smells very good.)"),

    (206, "to start; to begin; to commence; beginning; start",
     "Diànyǐng [...] le. (The movie has started.)\nWǒmen shénme shíhou [...] shàngkè? (When do we start class?)"),

    (207, "exam; test; examination; to take an exam",
     "Míngtiān wǒ yǒu [...]. (I have an exam tomorrow.)\nTā hěn nǔlì zhǔnbèi [...]. (She prepared very hard for the exam.)"),

    (208, "possible; maybe; perhaps; might; possibly; likelihood",
     "Míngtiān [...] huì xià yǔ. (It might rain tomorrow.)\nZhège shì [...] de. (This is possible.)"),

    (209, "can; may; allowed to; possible; acceptable; all right",
     "Wǒ [...] jìn lái ma? (May I come in?)\nZài zhèlǐ [...] pāizhào ma? (Is it allowed to take photos here?)"),

    (210, "lesson; class; course; subject",
     "Wǒ jīntiān yǒu sān jié [...]. (I have three classes today.)\nTā de Hànyǔ [...] hěn yǒu yìsi. (Her Chinese class is very interesting.)"),

    (211, "fast; quick; rapid; soon; almost; hurry up",
     "Tā zǒu de hěn [...]. (He walks very fast.)\n[...] diǎn lái! (Come quickly!)"),

    (212, "happy; joyful; cheerful; merry; delighted",
     "Shēngrì [...]. (Happy birthday.)\nTā kàn qǐlái hěn [...]. (She looks very happy.)"),

    (213, "tired; weary; worn out; exhausted",
     "Wǒ jīntiān hěn [...]. (I'm very tired today.)\nZǒu le zhème cháng de lù, tā hěn [...]. (After walking such a long way, she is very tired.)"),

    (214, "to be away from; to be distant from; to leave; separated from",
     "Xuéxiào [...] wǒ jiā bù yuǎn. (The school is not far from my home.)\n[...] kǎoshì hái yǒu sān tiān. (There are still three days until the exam.)"),

    (215, "two; 2; both; a couple of",
     "Wǒ yǒu [...] gè jiějie. (I have two older sisters.)\n[...] gè rén dōu xǐhuān chī shuǐguǒ. (Both people like eating fruit.)"),

    (216, "road; path; way; route; journey",
     "Zhè tiáo [...] hěn cháng. (This road is very long.)\nQǐng wèn, qù huǒchē zhàn zǒu nǎ tiáo [...]? (Excuse me, which road goes to the train station?)"),

    (217, "to travel; to tour; tourism; trip; journey",
     "Wǒ xǐhuān qù [...]. (I like to travel.)\nTā qù Zhōngguó [...] le. (She went on a trip to China.)"),

    (218, "to sell; to trade; to vend",
     "Nà jiā diàn [...] hěn duō shuǐguǒ. (That store sells lots of fruit.)\nZhège [...] duōshao qián? (How much does this sell for?)"),

    (219, "slow; slowly; leisurely",
     "Tā shuō Hànyǔ hěn [...]. (He speaks Chinese very slowly.)\nQǐng shuō de [...] yīdiǎn. (Please speak a bit more slowly.)"),

    (220, "busy; rushed; to hurry; to rush",
     "Māma jīntiān hěn [...]. (Mom is very busy today.)\nNǐ zuìjìn [...] ma? (Have you been busy lately?)"),

    (221, "every; each; per; each time",
     "[...] tiān wǒ dōu qǐ de hěn zǎo. (Every day I get up very early.)\n[...] gè xuésheng dōu yǒu yī běn shū. (Every student has a book.)"),

    (222, "younger sister; little sister",
     "Wǒ de [...] hěn kě'ài. (My younger sister is very cute.)\n[...] bǐ wǒ xiǎo sān suì. (My younger sister is three years younger than me.)"),

    (223, "door; gate; entrance; measure word for academic subjects",
     "Qǐng guān [...]. (Please close the door.)\nFángjiān de [...] kāi zhe. (The room door is open.)"),

    (224, "man; male adult",
     "Nà gè [...] shì wǒ de bàba. (That man is my dad.)\nTā shì yī gè hǎo [...]. (He is a good man.)"),

    (225, "you (polite form); your (respectful)",
     "[...] hǎo! (Good day to you!)\n[...] guì xìng? (What is your honorable surname?)"),

    (226, "milk; cow's milk",
     "Wǒ měitiān hē yī bēi [...]. (I drink a glass of milk every day.)\nZhège [...] hěn hǎo hē. (This milk tastes very good.)"),

    (227, "woman; female adult",
     "Nà wèi [...] shì wǒ de māma. (That woman is my mom.)\nTā shì yī wèi hěn yōumiù de [...]. (She is a very capable woman.)"),

    (228, "beside; next to; nearby; side",
     "Xuéxiào [...] yǒu yī jiā cāntīng. (Beside the school there is a restaurant.)\nTā zuò zài wǒ [...]. (He is sitting next to me.)"),

    (229, "to run; jogging; running",
     "Wǒ měitiān zǎoshang [...]. (I go running every morning.)\nTā xǐhuān [...] jiànshēn. (She likes jogging to keep fit.)"),

    (230, "cheap; inexpensive; affordable",
     "Zhège shìchǎng de dōngxi hěn [...]. (The things at this market are very cheap.)\nZhège bǐ nàge [...] duō le. (This one is much cheaper than that one.)"),

    (231, "ticket; vote; ballot",
     "Wǒ mǎi le liǎng zhāng [...]. (I bought two tickets.)\nNǐ de [...] zài nǎlǐ? (Where is your ticket?)"),

    (232, "wife; spouse (female)",
     "Tā de [...] shì lǎoshī. (His wife is a teacher.)\nTā hé tā de [...] yīqǐ qù lǚyóu. (He and his wife travel together.)"),

    (233, "to get up; to get out of bed; to rise",
     "Wǒ měitiān liù diǎn [...]. (I get up at six o'clock every day.)\nNǐ jīntiān jǐ diǎn [...]? (What time did you get up today?)"),

    (234, "thousand; 1,000",
     "Zhè běn shū yī [...] kuài qián. (This book costs one thousand yuan.)\nZhège chéngshì yǒu jǐ [...] nián de lìshǐ. (This city has a history of several thousand years.)"),

    (235, "clear; fine; sunny (weather)",
     "Jīntiān tiānqì [...] lǎng. (Today the weather is clear and sunny.)\nMíngtiān kěnéng huì [...] tiān. (Tomorrow it might be sunny.)"),

    (236, "last year",
     "[...] wǒ qù le Zhōngguó. (Last year I went to China.)\nTā [...] bìyè le. (She graduated last year.)"),

    (237, "to let; to allow; to make; to have someone do something; to yield",
     "Qǐng [...] wǒ jìn qù. (Please let me in.)\nMāma [...] wǒ qù mǎi dōngxi. (Mom had me go buy things.)"),

    (238, "to go to work; to be at work; to start work",
     "Wǒ měitiān bā diǎn [...]. (I go to work at eight o'clock every day.)\nTā [...] de shíhou hěn rènzhēn. (She is very serious when at work.)"),

    (239, "body; health; physical condition",
     "Tā de [...] hěn hǎo. (His health is very good.)\nDuō yùndòng duì [...] hǎo. (Exercising more is good for your health.)"),

    (240, "to get sick; to fall ill; to be ill",
     "Tā [...] le, bù néng lái shàngkè. (She got sick and can't come to class.)\nNǐ [...] le, yào duō xiūxi. (You've fallen ill, you need more rest.)"),

    (241, "birthday",
     "Jīntiān shì wǒ de [...]. (Today is my birthday.)\nZhù nǐ [...] kuàilè! (Happy birthday to you!)"),

    (242, "time; period; duration; moment",
     "Nǐ yǒu [...] ma? (Do you have time?)\nXuéxí Hànyǔ xūyào hěn duō [...]. (Learning Chinese requires a lot of time.)"),

    (243, "matter; affair; thing; issue; business",
     "Nǐ yǒu shénme [...] ma? (Do you have something on?)\nZhè jiàn [...] hěn zhòngyào. (This matter is very important.)"),

    (244, "watch; wristwatch",
     "Wǒ de [...] bú zhǔn. (My watch is not accurate.)\nTā dài le yī gè hěn piàoliang de [...]. (She's wearing a very beautiful watch.)"),

    (245, "cell phone; mobile phone; smartphone",
     "Wǒ de [...] méi diàn le. (My phone is out of battery.)\nTā yòng [...] fā le yī tiáo xìnxi. (She sent a message with her phone.)"),

    (246, "to give (as a gift); to send; to deliver; to escort; to see off",
     "Tā [...] gěi wǒ yī běn shū. (He gave me a book as a gift.)\nWǒ qù jīchǎng [...] tā. (I'm going to the airport to see her off.)"),

    (247, "therefore; as a result; so; hence; consequently",
     "Tā bìng le, [...] méi lái. (She was sick, so she didn't come.)\nXiàyǔ le, [...] wǒmen qǔxiāo le lǚxíng. (It rained, therefore we cancelled the trip.)"),

    (248, "it; its (for things or animals)",
     "[...] shì yī zhī hěn kě'ài de māo. (It is a very cute cat.)\nWǒ xǐhuān zhège xiǎo gǒu, [...] hěn wēnshùn. (I like this little dog, it is very gentle.)"),

    (249, "to kick",
     "Tā [...] zú qiú. (He kicks a soccer ball.)\nQǐng bié [...] zhège. (Please don't kick this.)"),

    (250, "topic; question; problem; title; subject",
     "Zhège [...] hěn nán. (This question is very difficult.)\nLǎoshī chū le wǔ gè [...]. (The teacher gave five questions.)"),

    (251, "to dance; dancing",
     "Tā xǐhuān [...]. (She likes dancing.)\nWǒmen yīqǐ qù [...] ba. (Let's go dancing together.)"),

    (252, "outside; exterior; foreign; other",
     "Tā zài [...] děng wǒ. (He is waiting for me outside.)\n[...] miàn hěn lěng, duō chuān diǎn. (It's very cold outside, wear more.)"),

    (253, "to finish; to complete; to end; to use up",
     "Wǒ chī [...] fàn le. (I've finished eating.)\nTā bǎ zuòyè zuò [...] le. (He finished his homework.)"),

    (254, "to play; to have fun; to enjoy; to visit",
     "Háizi xǐhuān [...]. (Children love to play.)\nZánmen qù gōngyuán [...] ba. (Let's go to the park and have fun.)"),

    (255, "evening; night; at night",
     "[...] wǒ xǐhuān kàn diànshì. (In the evening I like to watch TV.)\nZuótiān [...] wǒ shuì de hěn hǎo. (Last night I slept very well.)"),

    (256, "for; because of; for the sake of; to act as",
     "Tā [...] jiā rén zuò le hěn duō. (He did a lot for his family.)\nWǒ [...] nǐ gǎndào gāoxìng. (I am happy for you.)"),

    (257, "to ask; to inquire; to question",
     "Wǒ xiǎng [...] nǐ yī gè wèntí. (I'd like to ask you a question.)\nTā [...] lǎoshī zěnme xiě zhège zì. (She asked the teacher how to write this character.)"),

    (258, "question; problem; issue; matter",
     "Nǐ yǒu shénme [...] ma? (Do you have any questions?)\nZhège [...] hěn nán jiějué. (This problem is very hard to solve.)"),

    (259, "watermelon",
     "Xiàtiān wǒ xǐhuān chī [...]. (In summer I like eating watermelon.)\nZhège [...] hěn tián. (This watermelon is very sweet.)"),

    (260, "to hope; to wish; hope; wish; expectation",
     "Wǒ [...] nǐ shēntǐ jiànkāng. (I hope you stay healthy.)\nTā de [...] shì chéngwéi yīshēng. (Her wish is to become a doctor.)"),

    (261, "to wash; to clean; to bathe",
     "Wǒ qù [...] shǒu. (I'm going to wash my hands.)\nTā zài [...] yīfu. (She is washing clothes.)"),

    (262, "toward; facing; in the direction of; to face",
     "Qǐng [...] qián zǒu. (Please walk forward.)\nTā [...] wǒ wēixiào. (She smiled at me.)"),

    (263, "hour; o'clock (informal)",
     "Wǒ děng le nǐ liǎng gè [...]. (I waited for you for two hours.)\nCóng zhèlǐ dào nàlǐ yào yī gè [...]. (It takes one hour from here to there.)"),

    (264, "to laugh; to smile; to mock; laughter; smile",
     "Tā hěn xǐhuān [...]. (He loves to smile.)\nZhège diànyǐng hěn hǎo [...]. (This movie is very funny.)"),

    (265, "new; fresh; newly; recently",
     "Tā mǎi le yī jiàn [...] yīfu. (She bought a new outfit.)\nWǒ yǒu yī gè [...] péngyou. (I have a new friend.)"),

    (266, "surname; family name; to be surnamed",
     "Nǐ [...] shénme? (What is your surname?)\nWǒ [...] Lǐ. (My surname is Li.)"),

    (267, "to rest; rest; recess; break; time off",
     "Wǒ xiǎng [...] yīhuì. (I want to rest for a while.)\nMíngtiān shì [...] rì. (Tomorrow is a day off.)"),

    (268, "snow; snowfall",
     "Wàimiàn zài xià [...]. (It's snowing outside.)\n[...] hòu de shānshàng hěn piàoliang. (The mountains after snowfall are very beautiful.)"),

    (269, "color; colour",
     "Nǐ xǐhuān shénme [...]? (What color do you like?)\nZhè jiàn yīfu de [...] hěn piàoliang. (The color of this outfit is very pretty.)"),

    (270, "eye; eyes",
     "Tā de [...] hěn dà. (Her eyes are very big.)\n[...] shì xīnlíng de chuāng hù. (Eyes are the windows to the soul.)"),

    (271, "lamb; mutton; goat meat",
     "Wǒ hěn xǐhuān chī [...]. (I really like eating lamb.)\nZhège [...] hěn hǎo chī. (This mutton is very tasty.)"),

    (272, "medicine; drug; remedy; medication",
     "Nǐ chī [...] le ma? (Have you taken your medicine?)\nZhège [...] kěyǐ zhì gǎnmào. (This medicine can treat a cold.)"),

    (273, "to want; to need; will; shall; must; should; important",
     "Wǒ [...] hē shuǐ. (I want to drink water.)\nNǐ [...] zǎodiǎn huí jiā. (You should go home earlier.)"),

    (274, "also; too; as well; even; still",
     "Wǒ [...] xǐhuān chī píngguǒ. (I also like eating apples.)\nTā [...] huì shuō Hànyǔ. (She can speak Chinese too.)"),

    (275, "already; by now; as early as",
     "Wǒ [...] chī fàn le. (I have already eaten.)\nTā [...] dào Běijīng le. (He has already arrived in Beijing.)"),

    (276, "together; at the same time; in the same place",
     "Wǒmen [...] qù ba. (Let's go together.)\nTāmen [...] xué Hànyǔ. (They study Chinese together.)"),

    (277, "meaning; idea; intention; wish; token of affection",
     "Zhège zì shì shénme [...]? (What is the meaning of this character?)\nTā de [...] shì xiǎng qǐng wǒ chī fàn. (His intention is to invite me to eat.)"),

    (278, "overcast; cloudy; negative (yin); shady; gloomy",
     "Jīntiān tiānqì [...]. (Today the weather is overcast.)\n[...] tiān kěnéng yào xià yǔ. (Overcast weather might bring rain.)"),

    (279, "because; since; due to; as a result of",
     "Tā méi lái [...] tā bìng le. (She didn't come because she was sick.)\n[...] xià yǔ, wǒmen méi qù. (Because it rained, we didn't go.)"),

    (280, "to swim; swimming",
     "Tā hěn xǐhuān [...]. (She loves swimming.)\nXiàtiān wǒ cháng qù [...]. (In summer I often go swimming.)"),

    (281, "right side; right-hand side; to the right",
     "Yínháng zài [...]. (The bank is on the right side.)\nQǐng wǎng [...] guǎi. (Please turn to the right.)"),

    (282, "fish",
     "Wǒ hěn xǐhuān chī [...]. (I really like eating fish.)\nHé lǐ yǒu hěn duō [...]. (There are many fish in the river.)"),

    (283, "yuan (basic unit of Chinese currency); basic unit",
     "Zhège píngguǒ wǔ [...] qián. (This apple costs five yuan.)\nYī [...] děngyú shí jiǎo. (One yuan equals ten jiao.)"),

    (284, "far; distant; remote",
     "Tā jiā lí xuéxiào hěn [...]. (His home is very far from school.)\nCóng zhèlǐ dào nàlǐ hěn [...]. (From here to there is very far.)"),

    (285, "sports; exercise; physical activity; to exercise; movement",
     "Tā hěn xǐhuān [...]. (She loves sports.)\nDuō [...] duì shēntǐ hǎo. (Exercising more is good for your health.)"),

    (286, "again; once more; then; further; in addition",
     "Qǐng [...] shuō yī biàn. (Please say it once more.)\nWǒmen [...] jiàn! (See you again!)"),

    (287, "early morning; morning",
     "[...] wǒ qǐ de hěn zǎo. (I got up very early this morning.)\n[...] hǎo! (Good morning!)"),

    (288, "measure word for flat objects; (surname) Zhang; to open up; to spread",
     "Wǒ mǎi le sān [...] zhuōzi. (I bought three tables.)\nQǐng gěi wǒ yī [...] zhǐ. (Please give me a piece of paper.)"),

    (289, "to grow; to develop; to be raised; long (cháng); senior; chief (zhǎng)",
     "Tā [...] de hěn kuài. (She is growing very fast.)\nNǐ [...] de zhēn piàoliang. (You've grown up to be really beautiful.)"),

    (290, "husband",
     "Tā de [...] shì yīshēng. (Her husband is a doctor.)\nTā hé [...] yīqǐ qù lǚyóu. (She travels together with her husband.)"),

    (291, "to look for; to find; to seek; to call on; to look up",
     "Wǒ zài [...] wǒ de shū. (I'm looking for my book.)\nNǐ zài [...] shuí? (Who are you looking for?)"),

    (292, "aspect particle: indicates action in progress or continuing state",
     "Tā kāi [...] mén. (He is keeping the door open.)\nQiáng shàng guà [...] yī fú huà. (A painting is hanging on the wall.)"),

    (293, "really; truly; genuine; real; indeed",
     "Tā [...] de hěn cōngmíng. (She is really very smart.)\nZhège [...] piàoliang! (This is truly beautiful!)"),

    (294, "in the process of; currently; at this moment; to be doing",
     "Tā [...] chī fàn. (She is currently eating.)\nWǒ [...] xiě zuòyè. (I am in the process of doing homework.)"),

    (295, "to know; to be aware of; to understand",
     "Nǐ [...] tā de diànhuà ma? (Do you know his phone number?)\nWǒ bù [...] tā zài nǎlǐ. (I don't know where she is.)"),

    (296, "to prepare; preparation; to get ready; to plan to",
     "Wǒ zài [...] kǎoshì. (I'm preparing for the exam.)\nTā [...] le yī dùn hǎo fàn. (She prepared a good meal.)"),

    (297, "bicycle; bike",
     "Wǒ qí [...] qù shàngbān. (I ride a bicycle to work.)\nTā de [...] hěn piàoliang. (Her bicycle is very pretty.)"),

    (298, "to walk; to go; to leave; to move; to depart",
     "Wǒmen [...] ba. (Let's go.)\nTā [...] le hěn yuǎn de lù. (She walked a very long way.)"),

    (299, "most; -est (superlative suffix); extremely",
     "Tā shì bān lǐ [...] cōngmíng de xuésheng. (She is the smartest student in class.)\nZhège cài [...] hǎo chī. (This dish is the most delicious.)"),

    (300, "left side; left-hand side; to the left",
     "Yóujú zài [...]. (The post office is on the left side.)\nQǐng wǎng [...] guǎi. (Please turn to the left.)"),

    # HSK 3
    (301, "aunt; auntie; maternal aunt; polite term for an older woman",
     "Wǒ de [...] zhù zài Shànghǎi. (My aunt lives in Shanghai.)\nNà wèi [...] hěn rèqíng. (That auntie is very warm-hearted.)"),

    (302, "modal particle: expressing surprise, exclamation, or for emphasis",
     "Zhème hǎo chī [...]! (This tastes so good!)\nNǐ yě lái [...]! (Oh, you've come too!)"),

    (303, "short (in height); low; below average height",
     "Tā bǐ tā gēge [...]. (He is shorter than his older brother.)\nNà zhāng zhuōzi hěn [...]. (That table is very low.)"),

    (304, "hobby; interest; pastime; something one enjoys",
     "Nǐ de [...] shì shénme? (What is your hobby?)\nTā de [...] shì kàn shū. (His hobby is reading.)"),

    (305, "quiet; peaceful; calm; still",
     "Tú shū guǎn lǐ hěn [...]. (It's very quiet in the library.)\nQǐng bǎochí [...]. (Please keep quiet.)"),

    (306, "disposal particle: used before the object to indicate it is being handled; to hold; handle",
     "Tā [...] shū fàng zài zhuōzi shàng. (She put the book on the table.)\nQǐng nǐ [...] mén guān shàng. (Please close the door.)"),

    (307, "to move; to shift; to carry; to relocate",
     "Tāmen [...] jiā le. (They moved house.)\nQǐng bāng wǒ [...] yīxià zhège xiāng zi. (Please help me move this box.)"),

    (308, "class; team; shift; group; work shift",
     "Wǒmen [...] yǒu sān shí gè xuésheng. (Our class has thirty students.)\nTā shàng zǎo [...]. (He works the morning shift.)"),

    (309, "half; semi; halfway; in the middle",
     "Wǒ chī le [...] gè píngguǒ. (I ate half an apple.)\nXiànzài shì sān diǎn [...]. (It is now half past three.)"),

    (310, "method; way; means; approach; measure",
     "Nǐ yǒu shénme [...] ma? (Do you have any method?)\nWǒmen yào xiǎng gè [...]. (We need to think of a way.)"),

    (311, "office; office room",
     "Wǒ de [...] zài sān lóu. (My office is on the third floor.)\nTā měitiān bā diǎn dào [...]. (She arrives at the office at eight every day.)"),

    (312, "to help; to assist; to do someone a favor; to lend a hand",
     "Nǐ néng bāng wǒ gè [...] ma? (Can you do me a favor?)\nTā bāng le wǒ hěn dà de [...]. (She helped me a great deal.)"),

    (313, "bag; sack; bundle; package; to wrap",
     "Wǒ de [...] hěn zhòng. (My bag is very heavy.)\nTā ná zhe yī gè dà [...]. (She is carrying a big bag.)"),

    (314, "full; satiated; to have eaten one's fill",
     "Wǒ chī [...] le. (I'm full.)\nNǐ chī [...] le ma? (Are you full?)"),

    (315, "north; northern part; the North",
     "Tā lái zì [...] fāng. (She comes from the north.)\n[...] fāng de dōngtiān hěn lěng. (Winter in the north is very cold.)"),

    (316, "passive particle: by (used in passive sentences); to be subjected to",
     "Wǒ de shū [...] tā ná zǒu le. (My book was taken away by him.)\nZhège chuānghu [...] fēng chuī kāi le. (The window was blown open by the wind.)"),

    (317, "nose",
     "Tā de [...] hěn gāo. (Her nose is very prominent.)\nWǒ de [...] sāi zhù le. (My nose is blocked.)"),

    (318, "relatively; quite; comparatively; to compare; comparison",
     "Jīntiān [...] zuótiān lěng. (Today is comparatively colder than yesterday.)\nZhège wèntí [...] nán. (This question is relatively difficult.)"),

    (319, "competition; match; contest; game; to compete",
     "Wǒmen míngtiān yǒu [...]. (We have a competition tomorrow.)\nTā cānjiā le pǎobù [...]. (He participated in a running competition.)"),

    (320, "must; have to; necessarily; obligatory",
     "Nǐ [...] àn shí jiāo zuòyè. (You must hand in homework on time.)\nWǒ [...] zǒu le. (I really have to go now.)"),

    (321, "change; variation; to change; to vary; development",
     "Tā de Hànyǔ yǒu le hěn dà de [...]. (Her Chinese has changed a lot.)\nZhège chéngshì biàn [...] hěn dà. (This city has changed enormously.)"),

    (322, "to express; to show; to indicate; to represent; to mean",
     "Tā [...] le duì wǒ de gǎnjī. (She expressed gratitude toward me.)\nZhège shǒushì [...] shénme? (What does this gesture mean?)"),

    (323, "performance; to perform; to act; show; to put on",
     "Tāmen jīntiān wǎnshang yǒu [...]. (They have a performance tonight.)\nTā de [...] hěn jīngcǎi. (Her performance is very wonderful.)"),

    (324, "other people; others; someone else; another person",
     "Bù yào lǎo xiǎng [...] de shì. (Don't always think about other people's business.)\nYào zūnzhòng [...]. (We should respect others.)"),

    (325, "hotel; guesthouse; inn",
     "Wǒ zhù zài yī jiā hǎo [...]. (I'm staying at a nice hotel.)\nNà jiā [...] de fúwù hěn hǎo. (The service at that hotel is very good.)"),

    (326, "refrigerator; fridge",
     "Wǒ bǎ shípǐn fàng jìn [...]. (I put the food in the refrigerator.)\n[...] lǐ yǒu shénme chī de ma? (Is there anything to eat in the fridge?)"),

    (327, "just; not until; only; only then; barely; merely",
     "Tā [...] lái. (She just arrived.)\nWǒ [...] chī le yīdiǎn fàn. (I only ate a little.)"),

    (328, "menu; bill of fare",
     "Fúwùyuán, qǐng gěi wǒ kàn yīxià [...]. (Waiter, please let me see the menu.)\nZhège [...] shàng yǒu hěn duō cài. (There are many dishes on this menu.)"),

    (329, "to participate in; to join; to attend; to take part in",
     "Wǒ xiǎng [...] zhège huódòng. (I want to participate in this activity.)\nTā [...] le bǐsài, dédào le dì yī míng. (She participated in the competition and got first place.)"),

    (330, "grass; straw; rough; manuscript",
     "Gōngyuán lǐ yǒu hěn duō lǜ [...]. (There is a lot of green grass in the park.)\n[...] dì shàng yǒu lù shuǐ. (There is dew on the grass.)"),

    (331, "layer; floor (of a building); level; stratum",
     "Wǒ jiā zhù zài wǔ [...]. (My family lives on the fifth floor.)\nZhège dàngāo yǒu sān [...]. (This cake has three layers.)"),

    (332, "bad; inferior; wrong; to differ; difference; to fall short of",
     "Nǐ de gōngzuò tài [...] le. (Your work is too bad.)\nZhège chéngji bǐ wǒ xiǎng de [...] hěn duō. (This score fell far short of what I expected.)"),

    (333, "supermarket",
     "Wǒ qù [...] mǎi dōngxi. (I'm going to the supermarket to buy things.)\nNà jiā [...] hěn dà. (That supermarket is very large.)"),

    (334, "shirt; blouse",
     "Tā chuān le yī jiàn bái [...]. (He wore a white shirt.)\nZhè jiàn [...] duōshao qián? (How much is this shirt?)"),

    (335, "achievement; result; grades; score; performance",
     "Tā de xuéxí [...] hěn hǎo. (Her academic grades are very good.)\nWǒ duì zhège [...] hěn mǎnyì. (I'm very satisfied with this result.)"),

    (336, "city; town; urban area",
     "Tā zhù zài yī gè dà [...] lǐ. (She lives in a big city.)\nZhège [...] hěn měi. (This city is very beautiful.)"),

    (337, "to arrive late; to be late; tardiness",
     "Duìbuqǐ, wǒ [...] le. (Sorry, I'm late.)\nQǐng bùyào [...]. (Please don't be late.)"),

    (338, "to appear; to occur; to emerge; to arise",
     "Wèntí [...] le. (A problem has appeared.)\nTā tūrán [...] zài wǒ miànqián. (He suddenly appeared before me.)"),

    (339, "except; besides; apart from; in addition to",
     "[...] tā, wǒmen dōu lái le. (Except for her, we all came.)\n[...] Hànyǔ, tā hái huì shuō Yīngyǔ. (Besides Chinese, he can also speak English.)"),

    (340, "kitchen",
     "Māma zài [...] lǐ zuò fàn. (Mom is cooking in the kitchen.)\nZhège [...] hěn gānjìng. (This kitchen is very clean.)"),

    (341, "spring (season)",
     "[...] tiān huā kāi de hěn piàoliang. (In spring the flowers bloom beautifully.)\n[...] tiān tiānqì bù lěng yě bù rè. (Spring weather is neither cold nor hot.)"),

    (342, "word; phrase; term; expression",
     "Zhège [...] de yìsi shì shénme? (What is the meaning of this word?)\nXuéxí Hànyǔ yào jì hěn duō [...]. (Learning Chinese requires memorizing many words.)"),

    (343, "clever; intelligent; smart; bright",
     "Tā de nǚ'ér hěn [...]. (His daughter is very clever.)\nZhège háizi hěn [...], xuéxí hěn kuài. (This child is very smart and learns quickly.)"),

    (344, "to clean; to sweep; to tidy up",
     "Wǒ měi zhōu [...] fángjiān. (I clean my room every week.)\nTā zài [...] kètáng. (She is cleaning the classroom.)"),

    (345, "to plan; to intend; plan; intention",
     "Nǐ [...] shénme shíhou qù? (When do you plan to go?)\nWǒ [...] míngtiān qù Běijīng. (I plan to go to Beijing tomorrow.)"),

    (346, "to bring; to carry; to take; to lead; belt; zone; area",
     "Nǐ yào [...] shénme ma? (Do you need to bring anything?)\nQǐng [...] shàng nǐ de hùzhào. (Please bring your passport.)"),

    (347, "to worry; to be concerned; worried; anxious",
     "Māma hěn [...] wǒ. (Mom worries a lot about me.)\nBié [...], tā méi shì. (Don't worry, she's fine.)"),

    (348, "cake",
     "Shēngrì kuàilè! Zhè shì nǐ de [...]. (Happy birthday! This is your cake.)\nWǒ hěn xǐhuān chī qiǎokèlì [...]. (I really like eating chocolate cake.)"),

    (349, "of course; certainly; naturally; surely; as a matter of course",
     "[...], wǒ huì bāng nǐ. (Of course I'll help you.)\nNǐ néng lái ma? - [...]! (Can you come? - Of course!)"),

    (350, "adverbial particle: used between adjective/verb and the modified verb; -ly",
     "Tā gāoxìng [...] chàng gē. (She sang happily.)\nQǐng nǐ màn màn [...] chī. (Please eat slowly.)"),

    (351, "lamp; light; lantern; bulb",
     "Wǒ kāi le [...]. (I turned on the light.)\nZhège [...] tài àn le. (This lamp is too dim.)"),

    (352, "low; beneath; to lower; to hang down",
     "Zhège zhuōzi tài [...] le. (This table is too low.)\nTā de chéngjī bǐ píjūn [...]. (Her score is below average.)"),

    (353, "place; location; area; region; part",
     "Nǐ qù guò nǎ xiē [...]? (What places have you been to?)\nZhège [...] hěn měi. (This place is very beautiful.)"),

    (354, "subway; metro; underground railway",
     "Wǒ zuò [...] shàngbān. (I take the subway to work.)\nZuò [...] bǐ zuò gōngchē kuài. (Taking the subway is faster than taking the bus.)"),

    (355, "map",
     "Nǐ yǒu zhège chéngshì de [...] ma? (Do you have a map of this city?)\nWǒ kàn [...] zhǎo lù. (I look at the map to find the way.)"),

    (356, "elevator; lift",
     "Wǒmen zuò [...] shàngqù. (Let's take the elevator up.)\n[...] zài nǎlǐ? (Where is the elevator?)"),

    (357, "electronic; electron; digital",
     "Wǒ gěi tā fā le yī fēng [...] yóujiàn. (I sent him an email.)\nTā mǎi le yīgè [...] shǒubiǎo. (She bought an electronic watch.)"),

    (358, "winter (season)",
     "[...] tiān hěn lěng, yào duō chuān yīfu. (Winter is very cold, you need to wear more clothes.)\nWǒ xǐhuān [...] tiān huá xuě. (I like skiing in winter.)"),

    (359, "east; eastern; to the east",
     "Tāiyáng cóng [...] fāng shēngqǐ. (The sun rises in the east.)\nTā de jiā zài chéngshì de [...] bù. (Her home is in the eastern part of the city.)"),

    (360, "animal; creature",
     "Wǒ xǐhuān [...]. (I like animals.)\nZhège gōngyuán lǐ yǒu hěn duō [...]. (There are many animals in this park.)"),

    (361, "short; brief; lacking; in short supply",
     "Tā de tóufa hěn [...]. (Her hair is very short.)\nZhè tiáo lù hěn [...]. (This road is very short.)"),

    (362, "paragraph; section; piece; passage; measure word for sections",
     "Qǐng dú dì yī [...]. (Please read the first paragraph.)\nZhè [...] wénzi hěn yǒu yìsi. (This passage is very interesting.)"),

    (363, "to exercise; to work out; to train; physical exercise; to temper",
     "Tā měitiān [...] shēntǐ. (She exercises every day.)\nDuō [...] duì jiànkāng yǒu hǎo chù. (Exercising more is beneficial for health.)"),

    (364, "how; what; however much; so (in exclamations)",
     "Zhège diànyǐng [...] hǎo kàn! (This movie is so good!)\n[...] piàoliang de fēngjǐng! (What a beautiful scenery!)"),

    (365, "hungry; to starve; hunger",
     "Wǒ hěn [...]. (I'm very hungry.)\nNǐ [...] le ma? (Are you hungry?)"),

    (366, "and also; moreover; in addition; furthermore; not only...but also",
     "Tā bù jǐn piàoliang, [...] hěn cōngmíng. (She is not only beautiful but also very smart.)\nZhège cài hǎo chī, [...] hěn piányí. (This dish is tasty and also very cheap.)"),

    (367, "ear; ears",
     "Tā de [...] hěn líng. (Her ears are very sharp.)\nWǒ de [...] bù shūfu. (My ear is uncomfortable.)"),

    (368, "to have a fever; fever; to run a temperature",
     "Tā [...] le, yào qù kàn yīshēng. (She has a fever and needs to see a doctor.)\nWǒ zuótiān [...], jīntiān hǎo duō le. (I had a fever yesterday, I feel much better today.)"),

    (369, "to discover; to find; to realize; discovery",
     "Tā [...] le yī gè cuòwù. (She discovered a mistake.)\nWǒ [...] tā bù gāoxìng. (I found that he was not happy.)"),

    (370, "convenient; handy; easy; to make things convenient; to use the toilet",
     "Zhège chāoshì hěn [...]. (This supermarket is very convenient.)\nNǐ shénme shíhou [...] jiù lái. (Come whenever it's convenient for you.)"),

    (371, "to put; to place; to release; to let go; to set free",
     "Qǐng [...] zài zhuōzi shang. (Please put it on the table.)\nTā bǎ gǒu [...] chūqù le. (He let the dog out.)"),

    (372, "to set one's mind at rest; to be at ease; don't worry; to feel reassured",
     "Nǐ [...] ba, tā méi wèntí. (Don't worry, she's fine.)\nYǒu wǒ zài, nǐ [...]. (With me here, you can relax.)"),

    (373, "to divide; to separate; point; score; minute; cent; component",
     "Qǐng bǎ zhège [...] chéng liǎng bùfen. (Please divide this into two parts.)\nWǒ děng le nǐ shí [...] zhōng. (I waited for you for ten minutes.)"),

    (374, "nearby; vicinity; close to; in the neighborhood; surrounding area",
     "Wǒ jiā [...] yǒu yī gè gōngyuán. (Near my home there is a park.)\n[...] yǒu méi yǒu yínháng? (Is there a bank nearby?)"),

    (375, "to review; to revise; to go over; to study again",
     "Wǒ zài [...] jīntiān xué de nèiróng. (I'm reviewing what I learned today.)\nKǎoshì qián yào rèn zhēn [...]. (Before the exam you need to review carefully.)"),

    (376, "clean; tidy; neat",
     "Tā de fángjiān hěn [...]. (Her room is very clean.)\nWǒ xǐhuān bǎochí [...] de huánjìng. (I like to keep the environment clean.)"),

    (377, "to dare; bold; daring; to be brave enough to",
     "Tā bù [...] shuō. (She doesn't dare to speak.)\nNǐ [...] ma? (Do you dare?)"),

    (378, "cold (illness); flu; to catch a cold; common cold",
     "Wǒ [...] le. (I've caught a cold.)\nTā [...] le, yào duō hē shuǐ. (He has a cold and needs to drink more water.)"),

    (379, "just now; a moment ago; just a minute ago",
     "[...] tā gěi wǒ dǎ le diànhuà. (Just now he called me.)\nWǒ [...] chī le fàn. (I just ate a moment ago.)"),

    (380, "according to; based on; in accordance with; evidence; grounds",
     "[...] tiānqì yùbào, míngtiān huì xià yǔ. (According to the weather forecast, it will rain tomorrow.)\n[...] nǐ shuō de, tā yīnggāi zài jiā. (Based on what you said, she should be at home.)"),

    (381, "with; and; to follow; to accompany; to go along with",
     "Wǒ xiǎng [...] nǐ qù. (I want to go with you.)\nTā [...] péngyou yīqǐ chī fàn. (She ate with her friends.)"),

    (382, "even more; still more; further; more; still",
     "Jīntiān bǐ zuótiān [...] lěng. (Today is even colder than yesterday.)\nNǐ yào [...] nǔlì. (You need to work even harder.)"),

    (383, "park; public garden",
     "Wǒmen qù [...] sàn bù ba. (Let's go for a walk in the park.)\nNà gè [...] hěn dà hěn piàoliang. (That park is very large and beautiful.)"),

    (384, "story; tale; narrative; anecdote",
     "Māma gěi wǒ jiǎng [...]. (Mom told me a story.)\nZhège [...] hěn yǒu yìsi. (This story is very interesting.)"),

    (385, "to blow (of wind); to scrape; to shave",
     "Jīntiān [...] fēng le. (Today the wind is blowing.)\nWài miàn [...] dà fēng. (There is strong wind outside.)"),

    (386, "to close; to shut; to turn off; to lock up; to concern; to relate to",
     "Qǐng [...] mén. (Please close the door.)\nBié wàng le [...] dēng. (Don't forget to turn off the lights.)"),

    (387, "relationship; relation; connection; to matter; to be important",
     "Tāmen liǎng gè rén de [...] hěn hǎo. (The relationship between the two of them is very good.)\nZhè méi [...], bùyào zháojí. (This doesn't matter, don't worry.)"),

    (388, "to care about; to be concerned about; concern; to show interest in",
     "Tā hěn [...] tā de péngyou. (She cares a lot about her friends.)\nXièxiè nǐ de [...]. (Thank you for your concern.)"),

    (389, "about; regarding; concerning; with regard to; in relation to",
     "[...] zhège wèntí, wǒ xiǎng tǎolùn yīxià. (I'd like to discuss this issue.)\n[...] Zhōngguó lìshǐ, tā zhīdào hěn duō. (He knows a lot about Chinese history.)"),

    (390, "country; nation; state",
     "Zhōngguó shì yī gè dà [...]. (China is a large country.)\nTā xiǎng qù hěn duō [...] lǚyóu. (He wants to travel to many countries.)"),

    (391, "fruit juice; juice",
     "Wǒ xǐhuān hē chéngzhī [...]. (I like drinking orange juice.)\nZhège [...] hěn hǎo hē. (This juice tastes very good.)"),

    (392, "past; in the past; previously; former times",
     "[...] wǒ bù xǐhuān chī shūcài. (In the past I didn't like eating vegetables.)\n[...] de shì jiù bù yào tí le. (Let's not mention past things anymore.)"),

    (393, "or; still; had better; whether...or; either...or",
     "Nǐ hē chá [...] hē kāfēi? (Do you drink tea or coffee?)\nNǐ [...] bù qù le ba. (You had better not go.)"),

    (394, "to be afraid; to be scared; to fear; to dread",
     "Tā [...] gǒu. (She is afraid of dogs.)\nWǒ [...] tā bù lái le. (I'm afraid he won't come.)"),

    (395, "river; stream",
     "Zhè tiáo [...] hěn cháng. (This river is very long.)\n[...] biān yǒu hěn duō shù. (There are many trees by the river.)"),

    (396, "blackboard; chalkboard",
     "Lǎoshī zài [...] shàng xiě zì. (The teacher writes characters on the blackboard.)\nQǐng bǎ [...] cā gānjìng. (Please clean the blackboard.)"),

    (397, "passport",
     "Chūguó xūyào [...]. (You need a passport to go abroad.)\nWǒ de [...] diū le. (I lost my passport.)"),

    (398, "flower; blossom; to spend; to cost; multicolored",
     "Gōngyuán lǐ yǒu hěn duō [...]. (There are many flowers in the park.)\nTā mǎi le yī shù [...]. (She bought a bouquet of flowers.)"),

    (399, "garden; flower garden",
     "Tā jiā yǒu yī gè piàoliang de [...]. (Her home has a beautiful garden.)\n[...] lǐ kāi le hěn duō huā. (Many flowers are blooming in the garden.)"),

    (400, "to draw; to paint; painting; picture; to mark",
     "Tā xǐhuān [...] huà. (She likes painting.)\nZhè fú [...] hěn piàoliang. (This painting is very beautiful.)"),
]

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

for id_, english, example_sentences in updates:
    cursor.execute(
        "UPDATE vocabulary SET english = ?, example_sentences = ? WHERE id = ?",
        (english, example_sentences, id_)
    )

conn.commit()
print(f"Updated {cursor.rowcount} rows in last statement.")
print(f"Total updates applied: {len(updates)}")
conn.close()
print("Done!")
