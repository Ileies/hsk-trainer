#!/usr/bin/env python3
"""Update vocabulary IDs 1-200: fix English translations and add example sentences."""

import sqlite3

DB_PATH = "/home/ileies/Downloads/hsk-tester/local.db"

updates = [
    (1, "to love; to be fond of; love; affection",
     "Wǒ hěn [...] wǒ de jiārén. (I love my family very much.)\nTā hěn [...] chī shuǐguǒ. (She loves eating fruit.)"),

    (2, "eight; 8",
     "Wǒ yǒu [...] gè péngyou. (I have eight friends.)\nTā jīnnián [...] suì. (He is eight years old this year.)"),

    (3, "father; dad; daddy",
     "Wǒ de [...] shì yīshēng. (My dad is a doctor.)\n[...] měitiān dōu hěn máng. (Dad is very busy every day.)"),

    (4, "cup; glass; mug",
     "Zhège [...] shì wǒ de. (This cup is mine.)\nQǐng gěi wǒ yī gè [...]. (Please give me a cup.)"),

    (5, "Beijing (capital of China)",
     "Wǒ xiǎng qù [...] lǚyóu. (I want to travel to Beijing.)\n[...] shì Zhōngguó de shǒudū. (Beijing is the capital of China.)"),

    (6, "measure word for books; this; root; origin",
     "Wǒ mǎi le yī [...] shū. (I bought a book.)\nZhè [...] shū hěn hǎo kàn. (This book is very interesting.)"),

    (7, "you're welcome; don't mention it; not polite",
     "Xièxiè nǐ de bāngzhù! [...]. (Thank you for your help! You're welcome.)\n[...], zhè shì wǒ yīnggāi zuò de. (You're welcome, this is what I should do.)"),

    (8, "not; no; (negative prefix)",
     "Wǒ [...] xǐhuān hē chá. (I don't like drinking tea.)\nTā [...] shì lǎoshī. (He is not a teacher.)"),

    (9, "dish; cuisine; vegetables; food",
     "Māma zuò de [...] hěn hǎo chī. (The food mom cooks is very tasty.)\nZhège [...] shì shénme? (What dish is this?)"),

    (10, "tea",
     "Wǒ hěn xǐhuān hē [...]. (I really like drinking tea.)\nZhège [...] hěn hǎo hē. (This tea tastes very good.)"),

    (11, "to eat; to consume",
     "Nǐ xiǎng [...] shénme? (What do you want to eat?)\nWǒ měitiān dōu [...] mǐfàn. (I eat rice every day.)"),

    (12, "taxi; cab; taxicab",
     "Wǒ zuò [...] qù jīchǎng. (I'm taking a taxi to the airport.)\nZhèlǐ hěn nán jiào [...]. (It's very hard to hail a taxi here.)"),

    (13, "to make a phone call; to call; to phone",
     "Wǒ xiǎng gěi māma [...]. (I want to call mom.)\nTā zài [...] gěi tā de péngyou. (He is calling his friend.)"),

    (14, "big; large; great; old (of age)",
     "Nǐ jiā de gǒu hěn [...]. (Your family's dog is very big.)\nZhège chéngshì hěn [...]. (This city is very large.)"),

    (15, "structural particle: 's (possessive); used before a noun",
     "Zhè shì wǒ [...] shū. (This is my book.)\nTā [...] māma shì lǎoshī. (His mother is a teacher.)"),

    (16, "o'clock; point; dot; a bit; measure word for time",
     "Xiànzài jǐ [...] le? (What time is it now?)\nWǒ [...] le yī bēi chá. (I ordered a cup of tea.)"),

    (17, "computer; personal computer; PC",
     "Wǒ měitiān dōu yòng [...]. (I use a computer every day.)\nZhège [...] hěn guì. (This computer is very expensive.)"),

    (18, "television; TV",
     "Wǒ xǐhuān kàn [...]. (I like watching TV.)\nTā měitiān wǎnshang kàn [...]. (He watches TV every evening.)"),

    (19, "movie; film",
     "Wǒmen qù kàn [...] ba. (Let's go watch a movie.)\nZhège [...] hěn hǎo kàn. (This movie is very good.)"),

    (20, "thing; stuff; object; belongings",
     "Nǐ mǎi le shénme [...]? (What things did you buy?)\nWǒ de [...] fàng zài zhuōzi shang. (My things are on the table.)"),

    (21, "all; both; entirely; even; already",
     "Wǒmen [...] xǐhuān chī mǐfàn. (We all like eating rice.)\nTāmen [...] shì xuésheng. (They are all students.)"),

    (22, "to read; to study; to attend school",
     "Wǒ měitiān [...] shū. (I read books every day.)\nTā zài [...] dàxué. (She is attending university.)"),

    (23, "sorry; I'm sorry; I beg your pardon; excuse me",
     "[...], wǒ lái wǎn le. (Sorry, I'm late.)\n[...], wǒ bù zhīdào. (I'm sorry, I didn't know.)"),

    (24, "many; much; more; a lot; how (in exclamations)",
     "Zhège chéngshì yǒu hěn [...] rén. (This city has very many people.)\nNǐ yǒu [...] shǎo qián? (How much money do you have?)"),

    (25, "how much; how many; however much; a certain amount",
     "Zhège [...] qián? (How much does this cost?)\nNǐmen bān yǒu [...] gè xuésheng? (How many students are in your class?)"),

    (26, "son",
     "Tā de [...] hěn cōngming. (His son is very smart.)\nWǒ de [...] jīnnián wǔ suì. (My son is five years old this year.)"),

    (27, "two; 2; second",
     "Wǒ yǒu [...] gè jiějie. (I have two older sisters.)\nJīntiān shì [...] yuè sì hào. (Today is February fourth.)"),

    (28, "restaurant; eatery; diner",
     "Wǒmen qù [...] chī fàn ba. (Let's go to a restaurant to eat.)\nNàge [...] de cài hěn hǎo chī. (The food at that restaurant is very tasty.)"),

    (29, "airplane; aircraft; plane",
     "Wǒ zuò [...] qù Běijīng. (I'm taking a plane to Beijing.)\nNà jiā [...] hěn dà. (That airplane is very large.)"),

    (30, "minute (unit of time)",
     "Wǒ děng le nǐ sān shí [...]. (I waited for you for thirty minutes.)\nCóng zhèlǐ dào xuéxiào yào wǔ [...]. (It takes five minutes from here to school.)"),

    (31, "happy; pleased; glad; excited; willing",
     "Wǒ hěn [...] rènshi nǐ. (I'm very happy to meet you.)\nTā jīntiān kàn qǐlái hěn [...]. (She looks very happy today.)"),

    (32, "general measure word; individual; piece",
     "Wǒ mǎi le sān [...] píngguǒ. (I bought three apples.)\nTā yǒu yī [...] hǎo péngyou. (She has a good friend.)"),

    (33, "to work; job; work; occupation; employment",
     "Nǐ zài nǎlǐ [...]? (Where do you work?)\nTā de [...] hěn máng. (Her work is very busy.)"),

    (34, "dog",
     "Wǒ jiā yǒu yī zhī [...]. (My family has a dog.)\nZhège [...] hěn kě'ài. (This dog is very cute.)"),

    (35, "Chinese language; Mandarin; Putonghua",
     "Wǒ zài xué [...]. (I'm learning Chinese.)\nNǐ de [...] shuō de hěn hǎo. (You speak Chinese very well.)"),

    (36, "good; well; fine; proper; OK; nice",
     "Zhège diànyǐng hěn [...]. (This movie is very good.)\nNǐ [...] ma? (Are you well?)"),

    (37, "to drink",
     "Nǐ xiǎng [...] shénme? (What would you like to drink?)\nWǒ měitiān [...] sān bēi shuǐ. (I drink three glasses of water every day.)"),

    (38, "and; with; together with; peace; harmony",
     "Wǒ [...] wǒ de péngyou qù kàn diànyǐng. (My friend and I went to watch a movie.)\nTā [...] tā gēge dōu xǐhuān chī shuǐguǒ. (He and his older brother both like eating fruit.)"),

    (39, "very; quite; much; very much",
     "Jīntiān tiānqì [...] hǎo. (Today's weather is very good.)\nWǒ [...] xǐhuān zhège chéngshì. (I like this city very much.)"),

    (40, "behind; at the back; in the rear; later; afterwards",
     "Xuéxiào [...] yǒu yī gè gōngyuán. (Behind the school there is a park.)\nWǒ zuò zài tā [...]. (I'm sitting behind her.)"),

    (41, "to return; to go back; to reply; measure word for times",
     "Wǒ jīntiān wǎnshang [...] jiā. (I'm going home tonight.)\nTā hái méi [...] wǒ de diànhuà. (He hasn't called me back yet.)"),

    (42, "can; to be able to; will; likely; to meet; meeting",
     "Nǐ [...] shuō Hànyǔ ma? (Can you speak Chinese?)\nWǒ [...] kāichē. (I can drive a car.)"),

    (43, "train station; railway station",
     "Wǒ zài [...] děng nǐ. (I'll wait for you at the train station.)\nCóng zhèlǐ dào [...] yào duō cháng shíjiān? (How long does it take to get to the train station from here?)"),

    (44, "how many; several; a few (usually less than 10)",
     "Nǐ yǒu [...] gè xiōngdì jiěmèi? (How many siblings do you have?)\nWǒ yǒu [...] gè hǎo péngyou. (I have a few good friends.)"),

    (45, "home; house; family; measure word for businesses or households",
     "Wǒ [...] yǒu sì kǒu rén. (My family has four people.)\nTā měitiān wǎnshang liù diǎn huí [...]. (He goes home every evening at six o'clock.)"),

    (46, "to be called; to call; to shout; to order",
     "Nǐ [...] shénme míngzi? (What is your name?)\nWǒ [...] tā lái chī fàn. (I called her to come eat.)"),

    (47, "today",
     "[...] tiānqì hěn hǎo. (Today's weather is very good.)\nNǐ [...] yǒu shíjiān ma? (Do you have time today?)"),

    (48, "nine; 9",
     "Wǒ [...] diǎn shàngkè. (Class starts at nine o'clock.)\nTā yǒu [...] gè tóngxué. (He has nine classmates.)"),

    (49, "to open; to start; to drive; to operate; to turn on",
     "Qǐng [...] mén. (Please open the door.)\nTā [...] chē qù gōngzuò. (She drives to work.)"),

    (50, "to look; to see; to watch; to read; to think; to visit",
     "Nǐ xǐhuān [...] diànshì ma? (Do you like watching TV?)\nWǒ qù [...] péngyou. (I'm going to visit a friend.)"),

    (51, "to see; to catch sight of; to perceive",
     "Wǒ [...] tā le. (I saw him.)\nNǐ [...] wǒ de shū le ma? (Did you see my book?)"),

    (52, "yuan (unit of Chinese currency); piece; lump; measure word for things",
     "Zhège píngguǒ yī [...] qián. (This apple costs one yuan.)\nQǐng gěi wǒ yī [...] miànbāo. (Please give me a piece of bread.)"),

    (53, "to come; to arrive; to do (used to replace a verb)",
     "Qǐng [...] zhèlǐ. (Please come here.)\nTā míngtiān [...] wǒ jiā. (She's coming to my home tomorrow.)"),

    (54, "teacher; instructor",
     "Wǒ de [...] hěn hǎo. (My teacher is very good.)\nTā shì Hànyǔ [...]. (He is a Chinese language teacher.)"),

    (55, "modal particle: indicates completion or change of state; (verb complement)",
     "Tā chī [...] fàn. (She has eaten.)\nTiānqì hǎo [...]. (The weather has gotten better.)"),

    (56, "cold; cool; icy",
     "Jīntiān tiānqì hěn [...]. (Today's weather is very cold.)\nZhège shuǐ tài [...] le. (This water is too cold.)"),

    (57, "inside; in; within; inner; li (unit of distance)",
     "Shū zài bāo [...]. (The book is inside the bag.)\nFángjiān [...] yǒu yī zhāng zhuōzi. (Inside the room there is a table.)"),

    (58, "zero; 0; fractional",
     "Zuótiān qìwēn shì [...] dù. (Yesterday the temperature was zero degrees.)\nDiànhuà hàomǎ lǐ yǒu sān gè [...]. (There are three zeros in the phone number.)"),

    (59, "six; 6",
     "Wǒ [...] diǎn qǐchuáng. (I get up at six o'clock.)\nWǒmen bān yǒu [...] shí gè xuésheng. (Our class has sixty students.)"),

    (60, "mother; mom; mama; mum",
     "Wǒ de [...] shì lǎoshī. (My mom is a teacher.)\n[...] zuò de cài hěn hǎo chī. (The food mom cooks is very tasty.)"),

    (61, "question particle for yes-no questions; (interrogative suffix)",
     "Nǐ shì xuésheng [...]? (Are you a student?)\nNǐ chī fàn le [...]? (Have you eaten?)"),

    (62, "to buy; to purchase",
     "Wǒ xiǎng [...] yī běn shū. (I want to buy a book.)\nTā qù chāoshì [...] dōngxi. (She went to the supermarket to buy things.)"),

    (63, "cat",
     "Wǒ jiā yǒu yī zhī [...]. (My family has a cat.)\nNà zhī [...] hěn kě'ài. (That cat is very cute.)"),

    (64, "not; without; no; lacking; to not have",
     "Wǒ [...] qián. (I don't have money.)\nTā [...] lái. (She didn't come.)"),

    (65, "it doesn't matter; never mind; no problem; that's OK",
     "Duìbuqǐ, wǒ lái wǎn le. [...]. (Sorry, I'm late. Never mind.)\n[...], zhè bù shì nǐ de cuò. (It's OK, this is not your fault.)"),

    (66, "(cooked) rice; steamed rice",
     "Wǒ hěn xǐhuān chī [...]. (I really like eating rice.)\nZhège [...] hěn hǎo chī. (This rice is very tasty.)"),

    (67, "tomorrow",
     "[...] tiānqì zěnme yàng? (What's the weather like tomorrow?)\nWǒ [...] qù kàn péngyou. (I'm going to visit a friend tomorrow.)"),

    (68, "name (of a person or thing); given name",
     "Nǐ de [...] shì shénme? (What is your name?)\nTā de [...] hěn hǎo tīng. (Her name sounds very nice.)"),

    (69, "which; which one; where (in questions)",
     "Nǐ shì [...] guó rén? (Which country are you from?)\nNǐ qù [...] lǐ? (Where are you going?)"),

    (70, "that; those; then; in that case",
     "[...] gè rén shì wǒ de lǎoshī. (That person is my teacher.)\n[...] běn shū shì nǐ de ma? (Is that book yours?)"),

    (71, "modal particle: and...?; what about...?; (indicates ongoing action)",
     "Wǒ hěn hǎo, nǐ [...]? (I'm fine, and you?)\nTā [...] qù nǎlǐ le? (Where did she go then?)"),

    (72, "can; to be able to; may; capable; ability",
     "Wǒ [...] shuō yī diǎn Hànyǔ. (I can speak a little Chinese.)\nNǐ [...] bāng wǒ ma? (Can you help me?)"),

    (73, "you (singular, informal); your",
     "[...] shì nǎ guó rén? (Which country are you from?)\n[...] xǐhuān chī shénme? (What do you like to eat?)"),

    (74, "year; New Year",
     "Wǒ xué Hànyǔ xué le sān [...] le. (I have been learning Chinese for three years.)\nJīn [...] tā shí bā suì. (She is eighteen years old this year.)"),

    (75, "daughter",
     "Tā de [...] hěn piàoliang. (His daughter is very beautiful.)\nWǒ de [...] jīnnián qī suì. (My daughter is seven years old this year.)"),

    (76, "friend; companion",
     "Tā shì wǒ de hǎo [...]. (She is my good friend.)\nWǒ yǒu hěn duō [...]. (I have many friends.)"),

    (77, "pretty; beautiful; handsome; good-looking",
     "Tā chuān de yīfu hěn [...]. (The clothes she's wearing are very pretty.)\nZhège chéngshì hěn [...]. (This city is very beautiful.)"),

    (78, "apple",
     "Wǒ hěn xǐhuān chī [...]. (I really like eating apples.)\nZhège [...] hěn hǎo chī. (This apple is very tasty.)"),

    (79, "seven; 7",
     "Wǒ [...] diǎn qǐchuáng. (I get up at seven o'clock.)\nYī gè xīngqī yǒu [...] tiān. (A week has seven days.)"),

    (80, "money; coin; currency; cash",
     "Wǒ méi yǒu [...]. (I don't have money.)\nZhège duōshao [...]? (How much does this cost?)"),

    (81, "in front; ahead; the front; previously",
     "Xuéxiào [...] yǒu yī jiā cāntīng. (In front of the school there is a restaurant.)\nTā zǒu zài wǒ [...]. (He is walking ahead of me.)"),

    (82, "please; to invite; to treat (sb to sth); to ask (sb to do sth)",
     "[...] jìn. (Please come in.)\nWǒ [...] nǐ chī fàn. (I'll treat you to a meal.)"),

    (83, "to go; to leave; to visit",
     "Nǐ [...] nǎlǐ? (Where are you going?)\nWǒ xiǎng [...] Zhōngguó. (I want to go to China.)"),

    (84, "hot; heat; fever; warm; to warm",
     "Jīntiān tiānqì hěn [...]. (Today's weather is very hot.)\nZhège chá tài [...] le. (This tea is too hot.)"),

    (85, "person; people; man; human being",
     "Zhège chéngshì yǒu hěn duō [...]. (This city has very many people.)\nTā shì gè hǎo [...]. (She is a good person.)"),

    (86, "to know; to recognize; to be acquainted with; to understand",
     "Wǒ [...] tā. (I know her.)\nNǐ [...] zhège zì ma? (Do you recognize this character?)"),

    (87, "sun; day; date; Japan (abbreviation); daily",
     "Jīntiān shì xīngqī [...]. (Today is Sunday.)\nMíngnián sān yuè wǔ [...] wǒ qù Běijīng. (I'm going to Beijing on March 5th next year.)"),

    (88, "three; 3",
     "Wǒ yǒu [...] gè mèimei. (I have three younger sisters.)\nWǒmen jiā [...] kǒu rén. (Our family has three people.)"),

    (89, "shop; store; retail store",
     "Nà jiā [...] yǒu hěn duō hǎo dōngxi. (That shop has many good things.)\nWǒ qù [...] mǎi dōngxi. (I'm going to the shop to buy things.)"),

    (90, "on; above; up; upper; to go up; to attend (class/work)",
     "Shū zài zhuōzi [...]. (The book is on the table.)\nTā měitiān [...] bān. (She goes to work every day.)"),

    (91, "morning; a.m.; forenoon",
     "Wǒ [...] jiǔ diǎn shàngkè. (I have class at nine in the morning.)\n[...] tiānqì hěn hǎo. (The weather is very good in the morning.)"),

    (92, "few; little; less; to be short of; seldom",
     "Zhège chéngshì rén hěn [...]. (This city has very few people.)\nWǒ de qián tài [...] le. (I have too little money.)"),

    (93, "who; whoever; someone",
     "Nà gè rén shì [...]? (Who is that person?)\n[...] xiǎng qù? (Who wants to go?)"),

    (94, "what; something; anything; whatever",
     "Nǐ xiǎng chī [...]? (What do you want to eat?)\nNǐ zài zuò [...] ne? (What are you doing?)"),

    (95, "ten; 10",
     "Yī nián yǒu [...] èr gè yuè. (A year has twelve months.)\nTā jīnnián [...] suì. (She is ten years old this year.)"),

    (96, "time; moment; period; when",
     "Nǐ shénme [...] huí lái? (When will you come back?)\nWǒ xiǎo [...] xǐhuān chī píngguǒ. (When I was little I liked eating apples.)"),

    (97, "is; are; am; yes; to be; indeed",
     "Tā [...] wǒ de lǎoshī. (She is my teacher.)\nNǐ [...] nǎ guó rén? (Which country are you from?)"),

    (98, "book; written work",
     "Wǒ xǐhuān kàn [...]. (I like reading books.)\nZhè běn [...] hěn hǎo kàn. (This book is very interesting.)"),

    (99, "water; river; liquid",
     "Wǒ xiǎng hē [...]. (I want to drink water.)\nZhège [...] hěn liáng. (This water is very cool.)"),

    (100, "fruit; fresh fruit",
     "Wǒ hěn xǐhuān chī [...]. (I really like eating fruit.)\nZhège [...] hěn hǎo chī. (This fruit is very tasty.)"),

    (101, "to sleep; to go to bed; to go to sleep",
     "Wǒ měitiān wǎnshang shí diǎn [...]. (I go to sleep at ten o'clock every evening.)\nTā hái méi [...] ne. (She hasn't gone to sleep yet.)"),

    (102, "to speak; to talk; to chat; to say",
     "Qǐng bié zài kètáng lǐ [...]. (Please don't talk in class.)\nTāmen zài yīqǐ [...]. (They are talking together.)"),

    (103, "four; 4",
     "Wǒ jiā yǒu [...] kǒu rén. (My family has four people.)\nYī nián yǒu [...] gè jìjié. (A year has four seasons.)"),

    (104, "years old; age; year (of age)",
     "Nǐ jīnnián jǐ [...]? (How old are you this year?)\nWǒ érzi wǔ [...] le. (My son is five years old.)"),

    (105, "he; him; his",
     "[...] shì wǒ de péngyou. (He is my friend.)\nWǒ qǐng [...] chī fàn. (I'm inviting him to eat.)"),

    (106, "she; her; hers",
     "[...] shì wǒ de jiějie. (She is my older sister.)\nWǒ rènshi [...] hěn jiǔ le. (I have known her for a long time.)"),

    (107, "too; excessively; very; extremely; great",
     "Zhège wèntí [...] nán le. (This question is too difficult.)\nJīntiān [...] rè le. (It's too hot today.)"),

    (108, "weather; climate",
     "Jīntiān [...] zěnme yàng? (How's the weather today?)\nZhèlǐ de [...] hěn hǎo. (The weather here is very good.)"),

    (109, "to listen; to hear; to obey",
     "Wǒ xǐhuān [...] yīnyuè. (I like listening to music.)\nQǐng [...] wǒ shuō. (Please listen to me.)"),

    (110, "classmate; fellow student; schoolmate",
     "Tā shì wǒ de [...]. (She is my classmate.)\nWǒ hé wǒ de [...] yīqǐ qù chī fàn. (I'm going to eat with my classmate.)"),

    (111, "hello (on the phone); hey; to feed (an animal)",
     "[...], nǐ hǎo! (Hello?)\n[...], nǐ shì lǐ lǎoshī ma? (Hello, is this Teacher Li?)"),

    (112, "I; me; my",
     "[...] shì xuésheng. (I am a student.)\n[...] hěn xǐhuān chī Zhōngguó cài. (I really like eating Chinese food.)"),

    (113, "we; us; our",
     "[...] dōu shì xuésheng. (We are all students.)\n[...] yīqǐ qù ba. (Let's go together.)"),

    (114, "five; 5",
     "Wǒ jiā yǒu [...] kǒu rén. (My family has five people.)\nWǒ měitiān [...] diǎn xiàbān. (I get off work at five o'clock every day.)"),

    (115, "to like; to be fond of; to enjoy; to prefer",
     "Wǒ hěn [...] chī píngguǒ. (I really like eating apples.)\nNǐ [...] shénme yùndòng? (What sports do you like?)"),

    (116, "under; below; down; next; lower; to descend",
     "Māo zài zhuōzi [...]. (The cat is under the table.)\nXīngqī [...] wǒ qù Běijīng. (I'm going to Beijing next week.)"),

    (117, "afternoon; p.m.",
     "Wǒ [...] sān diǎn yǒu kè. (I have class at three in the afternoon.)\n[...] tiānqì hěn hǎo. (The weather is very good in the afternoon.)"),

    (118, "to rain; to be raining",
     "Jīntiān [...] le. (It's raining today.)\nMíngtiān kěnéng huì [...]. (It might rain tomorrow.)"),

    (119, "Mr.; sir; gentleman; husband; teacher; doctor",
     "Lǐ [...], nǐ hǎo! (Hello, Mr. Li!)\nNín shì wáng [...] ma? (Are you Mr. Wang?)"),

    (120, "now; at present; currently; today",
     "Nǐ [...] zài nǎlǐ? (Where are you now?)\n[...] jǐ diǎn le? (What time is it now?)"),

    (121, "to think; to want; to miss; to long for; to plan to",
     "Wǒ [...] qù Zhōngguó. (I want to go to China.)\nWǒ hěn [...] wǒ de māma. (I miss my mom very much.)"),

    (122, "small; little; young; minor",
     "Zhège fángjiān hěn [...]. (This room is very small.)\nWǒ yǒu yī gè [...] gǒu. (I have a small dog.)"),

    (123, "Miss; Ms.; young lady; young woman",
     "Zhāng [...], qǐng jìn. (Miss Zhang, please come in.)\nNà wèi [...] shì shuí? (Who is that young lady?)"),

    (124, "some; a few; a little; measure word for a small amount",
     "Wǒ xiǎng mǎi yī [...] shuǐguǒ. (I want to buy some fruit.)\nQǐng gěi wǒ yī [...] chá. (Please give me some tea.)"),

    (125, "to write; to compose; to describe",
     "Qǐng [...] xia nǐ de míngzi. (Please write down your name.)\nTā zài [...] hànzì. (She is writing Chinese characters.)"),

    (126, "thank you; thanks; to thank",
     "[...] nǐ de bāngzhù. (Thank you for your help.)\n[...] nǐ lái. (Thank you for coming.)"),

    (127, "week; day of the week",
     "Zhège [...] nǐ yǒu kōng ma? (Are you free this week?)\nYī gè [...] yǒu qī tiān. (A week has seven days.)"),

    (128, "student; pupil; disciple",
     "Wǒ shì Hànyǔ [...]. (I'm a Chinese language student.)\nTāmen bān yǒu sān shí gè [...]. (Their class has thirty students.)"),

    (129, "to learn; to study; learning; study",
     "Wǒ zài [...] Hànyǔ. (I'm studying Chinese.)\nTā hěn nǔlì [...]. (She studies very hard.)"),

    (130, "school; educational institution",
     "Wǒ de [...] hěn dà. (My school is very large.)\nTā hái zài [...] lǐ. (He is still at school.)"),

    (131, "one; 1; single; a (indefinite article equivalent)",
     "Wǒ yǒu [...] gè mèimei. (I have one younger sister.)\nZhè shì [...] gè hǎo wèntí. (This is a good question.)"),

    (132, "clothes; clothing; garment; outfit",
     "Tā mǎi le yī jiàn xīn [...]. (She bought a new piece of clothing.)\nZhè jiàn [...] hěn piàoliang. (This garment is very beautiful.)"),

    (133, "doctor; physician; medical doctor",
     "Wǒ bàba shì [...]. (My dad is a doctor.)\nWǒ qù kàn [...]. (I'm going to see a doctor.)"),

    (134, "hospital; clinic",
     "Wǒ māma zài [...] gōngzuò. (My mom works in a hospital.)\nNà jiā [...] hěn dà. (That hospital is very large.)"),

    (135, "chair; seat",
     "Qǐng zuò zài [...] shang. (Please sit in the chair.)\nZhège [...] hěn shūfu. (This chair is very comfortable.)"),

    (136, "to have; there is; there are; to exist; to possess",
     "Nǐ [...] xiōngdì jiěmèi ma? (Do you have siblings?)\nFángjiān lǐ [...] yī zhāng zhuōzi. (There is a table in the room.)"),

    (137, "moon; month",
     "Yī nián yǒu shí èr gè [...]. (A year has twelve months.)\nWǒ shì sān [...] shēng de. (I was born in March.)"),

    (138, "at; in; located at; to be present; in the process of",
     "Tā [...] jiā. (She is at home.)\nWǒ [...] Běijīng xué Hànyǔ. (I'm learning Chinese in Beijing.)"),

    (139, "goodbye; see you later; farewell; bye",
     "Míngtiān jiàn! [...]. (See you tomorrow! Goodbye.)\n[...], xièxiè nǐ de bāngzhù. (Goodbye, thank you for your help.)"),

    (140, "how; why; what (way); how come",
     "Nǐ [...] qù nàlǐ? (How do you get there?)\nZhège zì [...] xiě? (How do you write this character?)"),

    (141, "how is it?; what is it like?; how about it?; is it OK?",
     "Jīntiān tiānqì [...]? (How's the weather today?)\nNǐ juéde zhège diànyǐng [...]? (What do you think of this movie?)"),

    (142, "this; these; here",
     "[...] shì wǒ de shū. (This is my book.)\n[...] gè rén shì shuí? (Who is this person?)"),

    (143, "China; People's Republic of China",
     "Wǒ xiǎng qù [...] lǚyóu. (I want to travel to China.)\n[...] yǒu hěn duō hǎo chī de dōngxi. (China has many delicious things to eat.)"),

    (144, "noon; midday; lunchtime",
     "Wǒmen [...] yīqǐ qù chī fàn ba. (Let's go eat together at noon.)\n[...] wǒ xiǎng shuì yīhuì jiào. (I want to take a nap at noon.)"),

    (145, "to live; to reside; to dwell; to stay; to stop",
     "Nǐ [...] zài nǎlǐ? (Where do you live?)\nWǒ [...] zài Běijīng. (I live in Beijing.)"),

    (146, "table; desk",
     "Shū zài [...] shang. (The book is on the table.)\nZhège [...] hěn dà. (This table is very large.)"),

    (147, "character; written word; letter; word; written form",
     "Nǐ rènshi zhège [...] ma? (Do you recognize this character?)\nWǒ hái bù huì xiě zhège [...]. (I still can't write this character.)"),

    (148, "yesterday",
     "[...] wǒ qù kàn diànyǐng. (Yesterday I went to watch a movie.)\n[...] tiānqì hěn hǎo. (Yesterday's weather was very good.)"),

    (149, "to sit; to take (a seat/vehicle); by (means of transport)",
     "Qǐng [...] xia. (Please sit down.)\nWǒ [...] fēijī qù Shànghǎi. (I'm going to Shanghai by airplane.)"),

    (150, "to do; to make; to act as; to be; to prepare",
     "Nǐ zài [...] shénme? (What are you doing?)\nMāma zài [...] fàn. (Mom is making food.)"),

    # HSK 2
    (151, "modal particle: OK?; right?; I suppose; let's (suggestion); probably",
     "Wǒmen zǒu [...]. (Let's go, shall we?)\nNǐ shì lǎoshī [...]? (You are a teacher, right?)"),

    (152, "white; blank; pure; in vain; free of charge",
     "Tā chuān le yī jiàn [...] yīfu. (She wore a white outfit.)\nXuě shì [...] sè de. (Snow is white.)"),

    (153, "hundred; 100",
     "Zhè běn shū yī [...] kuài qián. (This book costs one hundred yuan.)\nYī [...] nián yǐhòu. (One hundred years from now.)"),

    (154, "to help; to assist; help; assistance",
     "Xièxiè nǐ de [...]. (Thank you for your help.)\nWǒ kěyǐ [...] nǐ ma? (Can I help you?)"),

    (155, "newspaper; paper",
     "Wǒ bàba měitiān kàn [...]. (My dad reads the newspaper every day.)\nZhè fèn [...] shì jīntiān de. (This newspaper is from today.)"),

    (156, "to compare; compared to; than; ratio; score",
     "Tā [...] wǒ gāo. (He is taller than me.)\nJīntiān [...] zuótiān lěng. (Today is colder than yesterday.)"),

    (157, "don't; other; another; to leave; to separate",
     "[...] shuōhuà, tīng lǎoshī jiǎng. (Don't talk; listen to the teacher.)\n[...] pǎo, màn màn zǒu. (Don't run, walk slowly.)"),

    (158, "long; length; for a long time",
     "Zhège fángjiān hěn [...]. (This room is very long.)\nTā de tóufa hěn [...]. (Her hair is very long.)"),

    (159, "to sing; to sing a song",
     "Wǒ xǐhuān [...]. (I like singing.)\nTāmen zài yīqǐ [...]. (They are singing together.)"),

    (160, "to go out; to come out; to happen; to produce; to exit",
     "Tā [...] mén le. (He went out the door.)\nWǒ xiàwǔ [...] qù mǎi dōngxi. (I'm going out in the afternoon to buy things.)"),

    (161, "to wear; to put on (clothes); to pass through; to thread",
     "Tā [...] le yī jiàn hóng yīfu. (She wore a red outfit.)\nJīntiān hěn lěng, nǐ yào duō [...] yīdiǎn. (Today is very cold, you should wear a bit more.)"),

    (162, "boat; ship; vessel; watercraft",
     "Wǒmen zuò [...] qù nàge dǎo. (We're taking a boat to that island.)\nHé lǐ yǒu hěn duō xiǎo [...]. (There are many small boats in the river.)"),

    (163, "measure word for times (occurrences); second; next in sequence",
     "Wǒ qù guò Běijīng sān [...]. (I've been to Beijing three times.)\nZhè shì wǒ dì yī [...] chī zhège cài. (This is my first time eating this dish.)"),

    (164, "from; since; through; by (a certain route)",
     "Wǒ [...] Shànghǎi lái. (I'm from Shanghai.)\n[...] zhèlǐ dào xuéxiào bù yuǎn. (From here to school is not far.)"),

    (165, "wrong; mistake; error; bad",
     "Nǐ shuō [...] le. (What you said is wrong.)\nWǒ xiě le hěn duō [...]. (I made many mistakes in writing.)"),

    (166, "to play basketball",
     "Wǒ xǐhuān [...]. (I like playing basketball.)\nTāmen měi gè xīngqī liù dōu qù [...]. (They play basketball every Saturday.)"),

    (167, "everyone; everybody; all; all together",
     "[...] dōu xǐhuān tā. (Everyone likes her.)\n[...] hǎo! (Hello everyone!)"),

    (168, "but; however; nevertheless; yet",
     "Wǒ xiǎng qù [...] méi yǒu shíjiān. (I want to go, but I don't have time.)\nTā hěn máng [...] hái shì lái le. (She was very busy, but still came.)"),

    (169, "to arrive; to reach; until; to; up to",
     "Nǐ shénme shíhou [...] Běijīng? (When will you arrive in Beijing?)\nWǒ [...] jiā le. (I've arrived home.)"),

    (170, "structural particle: used after verb to introduce complement; manner particle",
     "Tā shuō [...] hěn hǎo. (She speaks very well.)\nNǐ xiě [...] zhēn piàoliang. (You write really beautifully.)"),

    (171, "must; have to; need to; ought to",
     "Wǒ [...] zǒu le. (I have to go now.)\nNǐ [...] hǎo hao xuéxí. (You must study hard.)"),

    (172, "younger brother; kid brother",
     "Wǒ de [...] hěn kě'ài. (My younger brother is very cute.)\n[...] bǐ wǒ xiǎo liǎng suì. (My younger brother is two years younger than me.)"),

    (173, "first; number one; the first; most important; top",
     "Tā shì [...] gè dào de. (She was the first to arrive.)\nWǒ [...] cì lái Zhōngguó. (This is my first time in China.)"),

    (174, "to understand; to comprehend; to know",
     "Nǐ [...] ma? (Do you understand?)\nWǒ bù [...] tā shuō de huà. (I don't understand what he's saying.)"),

    (175, "room; chamber",
     "Wǒ de [...] hěn xiǎo. (My room is very small.)\nNà jiā fàndiàn de [...] hěn gānjìng. (The rooms in that hotel are very clean.)"),

    (176, "very; extremely; highly; unusual; extraordinary",
     "Jīntiān tiānqì [...] hǎo. (Today's weather is extremely good.)\nWǒ [...] xǐhuān Zhōngguó cài. (I like Chinese food very much.)"),

    (177, "waiter; waitress; attendant; service person; staff",
     "Qǐng wèn, [...] zài nǎlǐ? (Excuse me, where is the waiter?)\nNà wèi [...] hěn rèqíng. (That attendant is very friendly.)"),

    (178, "tall; high; above average; loud; expensive",
     "Tā hěn [...]. (He is very tall.)\nZhège lóu hěn [...]. (This building is very tall.)"),

    (179, "to tell; to inform; to let know; to notify",
     "Qǐng nǐ [...] wǒ. (Please tell me.)\nTā [...] wǒ tā de míngzi. (He told me his name.)"),

    (180, "older brother; elder brother",
     "Wǒ de [...] shì lǎoshī. (My older brother is a teacher.)\n[...] bǐ wǒ dà sān suì. (My older brother is three years older than me.)"),

    (181, "to give; for; to; by; give (as a gift)",
     "Qǐng [...] wǒ yī bēi chá. (Please give me a cup of tea.)\nTā [...] wǒ mǎi le yī běn shū. (She bought a book for me.)"),

    (182, "public bus; city bus; bus",
     "Wǒ měitiān zuò [...] shàngbān. (I take the bus to work every day.)\nZhè lù [...] qù nǎlǐ? (Where does this bus go?)"),

    (183, "kilogram; kg",
     "Wǒ mǎi le wǔ [...] píngguǒ. (I bought five kilograms of apples.)\nTā tǐzhòng qīshí [...]. (He weighs seventy kilograms.)"),

    (184, "company; business; firm; corporation",
     "Wǒ zài yī jiā dà [...] gōngzuò. (I work at a large company.)\nTā de [...] hěn dà. (Her company is very large.)"),

    (185, "expensive; costly; precious; noble",
     "Zhège tài [...] le. (This is too expensive.)\nZhèlǐ de dōngxi hěn [...]. (Things here are very expensive.)"),

    (186, "still; yet; also; in addition; even more; even",
     "Tā [...] méi lái. (She still hasn't come.)\nWǒ [...] xiǎng chī yī diǎn. (I still want to eat a little more.)"),

    (187, "child; children; kid; offspring",
     "Tā yǒu liǎng gè [...]. (She has two children.)\nNà gè [...] hěn kě'ài. (That child is very cute.)"),

    (188, "tasty; delicious; good to eat",
     "Zhège cài hěn [...]. (This dish is very tasty.)\nZhèlǐ de shuǐguǒ tèbié [...]. (The fruit here is especially delicious.)"),

    (189, "number; date; ordinal number; size",
     "Jīntiān shì jǐ [...] ? (What's today's date?)\nWǒ de diànhuà [...] shì duōshao? (What is my phone number?)"),

    (190, "black; dark; unlawful; sinister",
     "Tā yǒu yī zhī [...] māo. (He has a black cat.)\nTiān [...] le. (It's gotten dark.)"),

    (191, "red; popular; revolutionary; bonus",
     "Tā chuān le yī jiàn [...] yīfu. (She wore a red outfit.)\nZhè duǒ huā shì [...] sè de. (This flower is red.)"),

    (192, "to welcome; welcome; greet; reception",
     "[...] lái Zhōngguó! (Welcome to China!)\n[...] nǐ lái wǒ jiā. (Welcome to my home.)"),

    (193, "to return; to pay back; to give back; to repay",
     "Nǐ yào [...] wǒ qián. (You need to pay me back.)\nWǒ bǎ shū [...] gěi tā le. (I returned the book to her.)"),

    (194, "to reply; to answer; to respond; response; answer",
     "Qǐng [...] wǒ de wèntí. (Please answer my question.)\nTā de [...] hěn hǎo. (Her answer is very good.)"),

    (195, "airport; airfield",
     "Wǒ qù [...] jiē tā. (I'm going to the airport to pick her up.)\n[...] lí zhèlǐ yuǎn ma? (Is the airport far from here?)"),

    (196, "(chicken) egg; hen's egg",
     "Wǒ hěn xǐhuān chī [...]. (I really like eating eggs.)\nZhège [...] hěn hǎo chī. (This egg is very tasty.)"),

    (197, "measure word for matters, events, or clothes; item; piece; article",
     "Wǒ mǎi le yī [...] yīfu. (I bought a piece of clothing.)\nTā yǒu yī [...] shì xiǎng gàosu nǐ. (He has something he wants to tell you.)"),

    (198, "classroom; lecture room",
     "Xuéshengmen zài [...] lǐ. (The students are in the classroom.)\nWǒmen de [...] hěn dà. (Our classroom is very large.)"),

    (199, "older sister; elder sister",
     "Wǒ de [...] shì yīshēng. (My older sister is a doctor.)\n[...] bǐ wǒ dà wǔ suì. (My older sister is five years older than me.)"),

    (200, "to introduce; to present; to recommend; introduction",
     "Ràng wǒ [...] yīxià. (Let me make an introduction.)\nTā bǎ tā de péngyou [...] gěi wǒ. (He introduced his friend to me.)"),
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
