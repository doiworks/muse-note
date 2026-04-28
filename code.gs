function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Muse Note")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const defs = [
    {
      name: "WORDS",
      header: [
        "id",
        "school_level",
        "grade",
        "term",
        "exam_type",
        "category1",
        "category2",
        "category3",
        "importance",
        "japanese",
        "english",
        "phonetic",
        "example",
        "pos_code",
        "pos_full",
        "pos_j",
        "antonym",
        "antonym_jp",
        "text",
      ],
    },
    { name: "USERS", header: ["created_at", "user_id", "user_name"] },
    {
      name: "HISTORY",
      header: ["answered_at", "user_id", "word_id", "answer", "correct"],
    },
    {
      name: "STATS",
      header: [
        "user_id",
        "word_id",
        "last_correct",
        "last_wrong",
        "success_count",
        "mistake_count",
        "accuracy",
        "attempt_count",
        "priority",
      ],
    },
  ];
  defs.forEach((d) => {
    let sh = ss.getSheetByName(d.name);
    if (!sh) sh = ss.insertSheet(d.name);
    if (sh.getLastRow() === 0) sh.appendRow(d.header);
  });
}

function registerUser(name) {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("USERS");
  const data = sh.getDataRange().getValues();
  const idxName = data[0].indexOf("user_name");
  const idxId = data[0].indexOf("user_id");
  for (let i = 1; i < data.length; i++) {
    if (data[i][idxName] === name) return data[i][idxId];
  }
  const userId = "U" + Utilities.getUuid().slice(0, 8);
  sh.appendRow([new Date(), userId, name]);
  return userId;
}

function getAllWords() {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("WORDS");
  const vals = sh.getDataRange().getValues();
  const header = vals.shift();
  const idxId = header.indexOf("id");
  const idxJP = header.indexOf("japanese");
  const idxEN = header.indexOf("english");
  const idxIPA = header.indexOf("phonetic");
  const pool = vals.filter((r) => r[idxId] && r[idxJP] && r[idxEN]);
  return pool.map((r) => ({
    id: r[idxId],
    japanese: r[idxJP],
    english: r[idxEN],
    phonetic: r[idxIPA],
  }));
}

function getUserStats(userId) {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const histSh = ss.getSheetByName("HISTORY");
  const vals = histSh.getDataRange().getValues();
  const header = vals.shift();
  const idxUid = header.indexOf("user_id");
  const idxWid = header.indexOf("word_id");
  const idxCor = header.indexOf("correct");
  const userRows = vals.filter((r) => r[idxUid] === userId);
  const map = {};
  userRows.forEach((r) => {
    const wid = r[idxWid];
    if (!map[wid]) map[wid] = { total: 0, correct: 0, recent: [] };
    map[wid].total++;
    if (r[idxCor] == 1) {
      map[wid].correct++;
      map[wid].recent.push("◯");
    } else {
      map[wid].recent.push("✕");
    }
    if (map[wid].recent.length > 5) map[wid].recent.shift();
  });
  return Object.keys(map).map((k) => ({
    word_id: k,
    accuracy: map[k].total
      ? Math.round((map[k].correct / map[k].total) * 100)
      : 0,
    recent: map[k].recent,
  }));
}

function updateStatsOnJudge(userId, wordId, correct) {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("STATS");
  const data = sh.getDataRange().getValues();
  const header = data[0];

  const idxUid = header.indexOf("user_id");
  const idxWid = header.indexOf("word_id");
  const idxLastCorrect = header.indexOf("last_correct");
  const idxLastWrong = header.indexOf("last_wrong");
  const idxSuccess = header.indexOf("success_count");
  const idxMistake = header.indexOf("mistake_count");
  const idxAccuracy = header.indexOf("accuracy");
  const idxAttempt = header.indexOf("attempt_count");
  const idxPriority = header.indexOf("priority");

  const widStr = String(wordId);
  const uidStr = String(userId);

  // --- 既存行 更新 ---
  for (let i = 1; i < data.length; i++) {
    if (
      String(data[i][idxUid]) === uidStr &&
      String(data[i][idxWid]) === widStr
    ) {
      let success = Number(data[i][idxSuccess] || 0);
      let mistake = Number(data[i][idxMistake] || 0);
      let attempt = Number(data[i][idxAttempt] || 0);

      attempt++; // ← 確実に +1される

      let lastCorrect = data[i][idxLastCorrect];
      let lastWrong = data[i][idxLastWrong];

      if (correct) {
        success++;
        lastCorrect = new Date();
      } else {
        mistake++;
        lastWrong = new Date();
      }

      const total = success + mistake;
      const accuracy = total > 0 ? Math.round((success / total) * 100) : 0;

      // ✨ 9列固定で書き込む（必ずここが重要！）
      const row = [
        uidStr,
        widStr,
        lastCorrect,
        lastWrong,
        success,
        mistake,
        accuracy,
        attempt,
        data[i][idxPriority] || 0,
      ];

      sh.getRange(i + 1, 1, 1, 9).setValues([row]);
      return;
    }
  }

  // --- 初回（行が存在しない） ---
  sh.appendRow([
    uidStr,
    widStr,
    correct ? new Date() : "",
    correct ? "" : new Date(),
    correct ? 1 : 0,
    correct ? 0 : 1,
    correct ? 100 : 0,
    1, // attempt_count 初回は 1
    0, // priority
  ]);
}

/* ★★★★★ ここに追加する ★★★★★ */
function recordHistory(userId, wordId, answer, correct) {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("HISTORY");
  sh.appendRow([new Date(), userId, wordId, answer, correct ? 1 : 0]);
}

// /* ★★★★★ ここまでをコピペで追加 ★★★★★ */

// function updateAttemptCount(userId, wordId) {
//   ensureSheets();
//   const ss = SpreadsheetApp.getActiveSpreadsheet();
//   const sh = ss.getSheetByName("STATS");
//   const data = sh.getDataRange().getValues();
//   const header = data[0];

//   const idxUid = header.indexOf("user_id");
//   const idxWid = header.indexOf("word_id");
//   const idxAttempt = header.indexOf("attempt_count");

//   // 既存行を検索して更新
//   for (let i = 1; i < data.length; i++) {
//     if (data[i][idxUid] === userId && data[i][idxWid] === wordId) {
//       const newVal = Number(data[i][idxAttempt] || 0) + 1;
//       sh.getRange(i + 1, idxAttempt + 1).setValue(newVal);
//       return;
//     }
//   }

//   // なければ新規追加
//   const row = [];
//   row[idxUid] = userId;
//   row[idxWid] = wordId;
//   row[idxAttempt] = 1;
//   sh.appendRow(row);
// }

function getStatsForUser(userId) {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("STATS");
  const vals = sh.getDataRange().getValues();
  const header = vals.shift();

  const idxUid = header.indexOf("user_id");
  const idxWid = header.indexOf("word_id");
  const idxAttempt = header.indexOf("attempt_count");
  const idxSuccess = header.indexOf("success_count");
  const idxMistake = header.indexOf("mistake_count");

  const map = {};

  vals.forEach((r) => {
    if (r[idxUid] !== userId) return;
    map[r[idxWid]] = {
      attempt: Number(r[idxAttempt] || 0),
      success: Number(r[idxSuccess] || 0),
      mistake: Number(r[idxMistake] || 0),
    };
  });

  return map;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getUserStatsOnly(userId, wordIds) {
  ensureSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const histSh = ss.getSheetByName("HISTORY");
  const vals = histSh.getDataRange().getValues();
  const header = vals.shift();

  const idxUid = header.indexOf("user_id");
  const idxWid = header.indexOf("word_id");
  const idxCor = header.indexOf("correct");

  const need = new Set(wordIds.map(String)); // 必要な word_id だけ

  const map = {}; // { wid → {total, correct, recent[]} }

  vals.forEach((r) => {
    if (r[idxUid] !== userId) return;
    const wid = String(r[idxWid]);
    if (!need.has(wid)) return; // 必要なものだけ見る

    if (!map[wid]) map[wid] = { total: 0, correct: 0, recent: [] };
    map[wid].total++;
    if (r[idxCor] == 1) {
      map[wid].correct++;
      map[wid].recent.push("◯");
    } else {
      map[wid].recent.push("✕");
    }
    if (map[wid].recent.length > 5) map[wid].recent.shift();
  });

  return Object.keys(map).map((wid) => ({
    word_id: wid,
    accuracy: map[wid].total
      ? Math.round((map[wid].correct / map[wid].total) * 100)
      : 0,
    recent: map[wid].recent,
  }));
}
