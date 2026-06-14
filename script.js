const CARD_BASE_PATH = "cards/tarot";
const HISTORY_KEY = "jiminyUranaiHistory";

const tarotCards = [
  card("愚者", "the-fool", "新しい始まり、自由、可能性", "無計画、不安定、軽率", "心を開いて一歩踏み出して。準備不足だけは見直しましょう。", "保留"),
  card("魔術師", "the-magician", "創造力、行動力、チャンス", "準備不足、空回り、迷い", "持っている力を具体的な行動に変える時です。", "yes"),
  card("女教皇", "the-high-priestess", "直感、静けさ、内面の知恵", "秘密、不安、考えすぎ", "答えを急がず、違和感や直感を大切に。", "neutral"),
  card("女帝", "the-empress", "愛情、豊かさ、育つ流れ", "依存、甘え、停滞", "育てたいものに時間と優しさを注ぎましょう。", "yes"),
  card("皇帝", "the-emperor", "安定、責任、リーダーシップ", "頑固、支配、融通のなさ", "ルールと計画を整えると道が固まります。", "yes"),
  card("教皇", "the-hierophant", "信頼、学び、伝統", "孤立、常識への反発、視野の狭さ", "信頼できる人や基本に立ち返ると安心です。", "yes"),
  card("恋人", "the-lovers", "選択、調和、ときめき", "迷い、誘惑、不一致", "心が本当に望むものを選んでください。", "yes"),
  card("戦車", "the-chariot", "前進、勝利、突破力", "暴走、焦り、方向性の乱れ", "勢いは味方。目的地を確認して進みましょう。", "strongYes"),
  card("力", "strength", "勇気、忍耐、優しい強さ", "自信不足、我慢の限界、弱気", "押し切るより、穏やかな粘り強さが鍵です。", "yes"),
  card("隠者", "the-hermit", "内省、探求、慎重さ", "孤独、閉じこもり、考えすぎ", "一人で整理する時間が答えを照らします。", "neutral"),
  card("運命の輪", "wheel-of-fortune", "転機、好機、流れの変化", "タイミングのずれ、停滞、予想外", "流れが変わります。小さなサインを逃さないで。", "yes"),
  card("正義", "justice", "公平、判断、バランス", "偏り、不公平、決断の遅れ", "事実を整理し、公平な判断を意識しましょう。", "neutral"),
  card("吊るされた男", "the-hanged-man", "忍耐、視点転換、手放し", "停滞、報われなさ、執着", "今は見方を変えるほど道が開けます。", "neutral"),
  card("死神", "death", "終わりと再生、切り替え", "変化への抵抗、未練、停滞", "終わらせることで、新しい余白が生まれます。", "no"),
  card("節制", "temperance", "調和、調整、回復", "不均衡、浪費、焦り", "急がず、ちょうどよいペースに整えましょう。", "yes"),
  card("悪魔", "the-devil", "執着、誘惑、依存", "解放、気づき、悪習から離れる", "魅力的でも縛られすぎていないか確認して。", "caution"),
  card("塔", "the-tower", "衝撃、崩壊、目覚め", "被害を避ける、再建、警告", "無理に守るより、崩れた後の再建を見て。", "no"),
  card("星", "the-star", "希望、癒し、未来への光", "理想倒れ、失望、回復途中", "希望を小さな行動に落とし込むと輝きます。", "yes"),
  card("月", "the-moon", "不安、曖昧さ、見えないもの", "不安の解消、真実が見える、混乱の終わり", "まだ情報不足。焦って結論を出さないで。", "neutral"),
  card("太陽", "the-sun", "成功、喜び、明るい展開", "遅れ、過信、子どもっぽさ", "素直に楽しむほど運が開きます。", "strongYes"),
  card("審判", "judgement", "復活、決断、目覚め", "後悔、先延ばし、呼びかけを無視", "過去の経験を活かし、次の扉を開けましょう。", "yes"),
  card("世界", "the-world", "完成、達成、統合", "未完成、停滞、詰めの甘さ", "一区切りの達成。次のステージを見据えて。", "strongYes"),
];

function card(name, slug, upright, reversed, advice, yesNo) {
  return { name, slug, upright, reversed, advice, yesNo, image: `${CARD_BASE_PATH}/${slug}.png` };
}

const menuButtons = document.querySelectorAll(".menu-button");
const forms = document.querySelectorAll(".reading-form");
const result = document.getElementById("result");

window.addEventListener("DOMContentLoaded", () => {
  menuButtons.forEach((button) => button.addEventListener("click", () => switchReading(button.dataset.reading)));
  document.getElementById("drawOneButton").addEventListener("click", drawOneCard);
  document.getElementById("drawTimelineButton").addEventListener("click", () => drawThreeCards("timeline"));
  document.getElementById("drawYesNoButton").addEventListener("click", drawYesNo);
  document.getElementById("drawChoiceButton").addEventListener("click", drawChoiceReading);
  document.getElementById("drawLoveButton").addEventListener("click", drawLoveReading);
  document.getElementById("drawWorkButton").addEventListener("click", drawWorkReading);
  document.getElementById("clearHistoryButton").addEventListener("click", () => { localStorage.removeItem(HISTORY_KEY); renderHistory(); });
  renderHistory();
});

function switchReading(type) {
  menuButtons.forEach((b) => b.classList.toggle("active", b.dataset.reading === type));
  forms.forEach((f) => f.classList.toggle("active", f.dataset.form === type));
}

function drawOneCard() {
  const theme = document.getElementById("oneTheme").value;
  const drawn = [drawCard("今日の1枚")];
  renderReadingResult({ title: "今日の1枚", subtitle: `テーマ：${theme}`, cards: drawn, summary: `${drawn[0].card.advice}` });
  saveHistory("今日の1枚", drawn);
}

function drawThreeCards(type) {
  const labels = type === "timeline" ? ["過去", "現在", "未来"] : ["1枚目", "2枚目", "3枚目"];
  const cards = drawUniqueCards(3, labels);
  renderReadingResult({ title: "過去・現在・未来", subtitle: "時間の流れを3枚で読みます", cards, summary: createOverallAdvice(cards) });
  saveHistory("過去・現在・未来", cards);
}

function drawYesNo() {
  const question = document.getElementById("yesNoQuestion").value.trim() || "質問未入力";
  const drawn = [drawCard("答え")];
  const judgement = judgeYesNo(drawn[0]);
  renderReadingResult({ title: "Yes / No 占い", subtitle: `質問：${escapeHtml(question)}`, cards: drawn, summary: `<span class="yesno-answer">${judgement.label}</span><br>${judgement.message}` });
  saveHistory("Yes / No 占い", drawn);
}

function drawChoiceReading() {
  const a = document.getElementById("choiceA").value.trim() || "選択肢A";
  const b = document.getElementById("choiceB").value.trim() || "選択肢B";
  const cards = drawUniqueCards(2, [`A：${a}を選んだ場合の未来`, `B：${b}を選んだ場合の未来`]);
  renderReadingResult({ title: "二者択一占い", subtitle: "AとBそれぞれの未来", cards, summary: `Aは「${cards[0].meaning}」。Bは「${cards[1].meaning}」。より心が軽くなり、行動を続けられる方を選ぶのがおすすめです。` });
  saveHistory("二者択一占い", cards);
}

function drawLoveReading() {
  const cards = drawUniqueCards(3, ["自分の気持ち", "相手の気持ち", "これからの流れ"]);
  renderReadingResult({ title: "恋愛占い", subtitle: "気持ちと流れを3枚で読みます", cards, summary: createOverallAdvice(cards) });
  saveHistory("恋愛占い", cards);
}

function drawWorkReading() {
  const cards = drawUniqueCards(3, ["現状", "課題", "アドバイス"]);
  renderReadingResult({ title: "仕事占い", subtitle: "現状整理と次の一手", cards, summary: createOverallAdvice(cards) });
  saveHistory("仕事占い", cards);
}

function drawUniqueCards(count, roles) {
  return shuffle([...tarotCards]).slice(0, count).map((cardData, index) => prepareDrawnCard(cardData, roles[index]));
}
function drawCard(role) { return prepareDrawnCard(tarotCards[Math.floor(Math.random() * tarotCards.length)], role); }
function prepareDrawnCard(cardData, role) {
  const reversed = Math.random() < 0.5;
  return { card: cardData, role, reversed, position: reversed ? "逆位置" : "正位置", meaning: reversed ? cardData.reversed : cardData.upright };
}

function renderReadingResult({ title, subtitle, cards, summary }) {
  result.classList.remove("empty");
  result.innerHTML = `<div class="result-heading"><h2>${title}</h2><p>${subtitle}</p></div><div class="card-grid">${cards.map(renderCard).join("")}</div><div class="result-summary"><strong>総合アドバイス</strong><br>${summary}</div>`;
}

function renderCard(drawn) {
  return `<article class="tarot-card"><div class="card-inner"><div class="card-face card-back">✦</div><div class="card-face card-front"><div class="card-image-wrap"><img class="card-image ${drawn.reversed ? "reversed" : ""}" src="${drawn.card.image}" alt="${drawn.card.name}" onerror="this.outerHTML='<div class=&quot;card-image missing&quot;>✦<br>${drawn.card.name}</div>'"></div><div class="card-body"><div class="card-role">${drawn.role}</div><h3>${drawn.card.name}</h3><div class="card-position">${drawn.position}</div><p>${drawn.meaning}</p><p><strong>アドバイス：</strong>${drawn.card.advice}</p></div></div></div></article>`;
}

function judgeYesNo(drawn) {
  if (drawn.reversed) {
    if (["strongYes", "yes"].includes(drawn.card.yesNo)) return { label: "NO", message: "本来の良さが出にくい暗示です。条件を整えてから進めましょう。" };
    if (drawn.card.yesNo === "caution") return { label: "注意して進める", message: "依存や無理を手放せば改善の余地があります。" };
    return { label: "NO", message: "今は流れが弱め。焦らず見直しを優先してください。" };
  }
  const map = { strongYes: ["YES", "強いYES。前向きに進める流れです。"], yes: ["YES", "YES寄り。小さく始めると追い風を感じられます。"], no: ["NO", "今はおすすめしにくい流れ。無理な前進は避けて。"], caution: ["注意して進める", "魅力はありますがリスク確認が必要です。"], neutral: ["どちらとも言えない", "まだ不明。情報を集めてから判断しましょう。"] };
  const [label, message] = map[drawn.card.yesNo];
  return { label, message };
}

function createOverallAdvice(cards) { return cards.map((d) => `${d.role}は「${d.meaning}」`).join("、") + "。カード同士の流れを見て、急ぐ所と整える所を分けると進みやすくなります。"; }
function saveHistory(type, cards) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  history.unshift({ type, date: new Date().toLocaleString("ja-JP"), cards: cards.map((d) => `${d.role}:${d.card.name}(${d.position})`) });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  renderHistory();
}
function renderHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  document.getElementById("historyList").innerHTML = history.length ? history.map((h) => `<div class="history-item"><strong>${h.type}</strong><br>${h.date}<br>${h.cards.join(" / ")}</div>`).join("") : `<p class="history-item">まだ履歴はありません。</p>`;
}
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function escapeHtml(str) { return str.replace(/[&<>'"]/g, (m) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[m])); }
