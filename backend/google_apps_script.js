// 百草醫館 - Google Apps Script 後端
// 專案部署與 Script Properties 密鑰設定指引已於 Walkthrough 中載明。

function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  return SpreadsheetApp.getActiveSpreadsheet(); // 綁定模式下自動獲取
}

// 初始化資料庫 (由管理員在前端點擊或開發時執行一次即可)
function initDatabase() {
  var ss = getSpreadsheet();

  // 1. 系統設定
  var configSheet = getOrCreateSheet(ss, "system_config", ["key", "value"]);
  var configData = configSheet.getDataRange().getValues();
  var existingKeys = {};
  for (var i = 1; i < configData.length; i++) {
    existingKeys[configData[i][0]] = true;
  }

  var defaultConfigValues = [
    ["game_enabled", "true"],
    ["force_logout_time", "0"],
    ["exp_task_complete", "30"],
    ["exp_task_duplicate", "50"],
    ["exp_battle_win", "50"],
    ["exp_battle_lose", "20"],
    ["exp_battle_draw", "30"],
    ["exp_qr_duplicate", "80"],
    ["exp_bingo_line", "150"],
    ["exp_bingo_duplicate", "50"]
  ];

  for (var c = 0; c < defaultConfigValues.length; c++) {
    var key = defaultConfigValues[c][0];
    var val = defaultConfigValues[c][1];
    if (!existingKeys[key]) {
      configSheet.appendRow([key, val]);
    }
  }

  // 2. 弟子玩家資料
  getOrCreateSheet(ss, "players", [
    "id", "password", "name", "role", "level", "exp",
    "equipped_head", "equipped_body", "equipped_hands", "equipped_feet", "equipped_sub1", "equipped_sub2",
    "deck", "inventory", "tasks_progress", "last_active"
  ]);

  // 建立預設帳號與管理員
  var playersSheet = ss.getSheetByName("players");
  var hasAdmin = false;
  var hasStaff = false;
  var hasPlayer1 = false;
  var data = playersSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === "admin") hasAdmin = true;
    if (data[i][0] === "staff") hasStaff = true;
    if (data[i][0] === "player1") hasPlayer1 = true;
  }

  var defaultTasks = {};
  for (var k = 0; k < 16; k++) {
    defaultTasks[k] = { status: "available", password: "", completed: false };
  }

  var defaultInventory = {
    "skill_card_01": 2, "skill_card_02": 2, "skill_card_03": 2,
    "skill_card_04": 1, "skill_card_05": 1, "skill_card_06": 1,
    "equip_head_01": 1, "equip_body_02": 1, "equip_hands_02": 1, "equip_feet_02": 1
  };
  var defaultDeck = [
    "skill_card_01", "skill_card_02", "skill_card_03", "skill_card_04",
    "skill_card_05", "skill_card_06", "", "", "", ""
  ];

  if (!hasAdmin) {
    playersSheet.appendRow([
      "admin", "admin123", "系統大掌櫃", "admin", 99, 99999,
      "", "", "", "", "", "",
      JSON.stringify(defaultDeck), JSON.stringify(defaultInventory), JSON.stringify(defaultTasks), "0"
    ]);
  }

  if (!hasStaff) {
    playersSheet.appendRow([
      "staff", "admin123", "分藥掌櫃", "game_admin", 99, 99999,
      "", "", "", "", "", "",
      JSON.stringify(defaultDeck), JSON.stringify(defaultInventory), JSON.stringify(defaultTasks), "0"
    ]);
  }

  if (!hasPlayer1) {
    playersSheet.appendRow([
      "player1", "123", "試藥弟子小智", "player", 1, 0,
      "", "", "", "", "", "",
      JSON.stringify(defaultDeck), JSON.stringify(defaultInventory), JSON.stringify(defaultTasks),
      "0"
    ]);
    playersSheet.appendRow([
      "player2", "123", "試藥弟子小茂", "player", 1, 0,
      "", "", "", "", "", "",
      JSON.stringify(defaultDeck), JSON.stringify(defaultInventory), JSON.stringify(defaultTasks),
      "0"
    ]);
    playersSheet.appendRow([
      "player3", "123", "試藥弟子小剛", "player", 1, 0,
      "", "", "", "", "", "",
      JSON.stringify(defaultDeck), JSON.stringify(defaultInventory), JSON.stringify(defaultTasks),
      "0"
    ]);
  }

  // 3. 戰鬥房間表
  var oldBattlesSheet = ss.getSheetByName("battles");
  if (oldBattlesSheet) {
    var headers = oldBattlesSheet.getRange(1, 1, 1, oldBattlesSheet.getLastColumn()).getValues()[0];
    if (headers.length !== 29 || headers[17] !== "r1_p1_cards") {
      ss.deleteSheet(oldBattlesSheet);
    }
  }

  getOrCreateSheet(ss, "battles", [
    "battle_id", "p1_id", "p2_id", "status", "winner_id", "start_time",
    "p1_hp", "p1_max_hp", "p1_def", "p1_atk",
    "p2_hp", "p2_max_hp", "p2_def", "p2_atk",
    "p1_action", "p2_action", "round_number",
    "r1_p1_cards", "r1_p2_cards",
    "r2_p1_cards", "r2_p2_cards",
    "r3_p1_cards", "r3_p2_cards",
    "r4_p1_cards", "r4_p2_cards",
    "r5_p1_cards", "r5_p2_cards",
    "p1_last_action", "p2_last_action"
  ]);

  // 4. 對戰邀請表
  getOrCreateSheet(ss, "invitations", [
    "invitation_id", "sender_id", "receiver_id", "status", "created_at"
  ]);

  // 5. 管理員發卡額度表
  getOrCreateSheet(ss, "admin_quotas", [
    "admin_id", "card_id", "quota"
  ]);

  // 6. QR Code 領取憑證表
  getOrCreateSheet(ss, "qr_codes", [
    "token", "admin_id", "card_id", "status", "claimed_by", "created_at"
  ]);

  // 7. 卡牌主資料庫表 (自訂中醫卡牌管理)
  var oldCardsSheet = ss.getSheetByName("cards");
  if (oldCardsSheet) {
    ss.deleteSheet(oldCardsSheet);
  }
  var cardsSheet = getOrCreateSheet(ss, "cards", [
    "id", "name", "type", "sub_type", "element", "rarity", "atk_mod", "def_mod", "description", "image_url",
    "self_atk", "self_def", "ops_atk", "ops_def",
    "self_othr_atk", "self_othr_def", "self_othr_ele",
    "ops_any_atk", "ops_any_def", "ops_any_ele",
    "target", "atk_aft", "def_aft", "hp_aft"
  ]);

  if (cardsSheet.getLastRow() <= 1) {
    var defaultCards = [
      ["equip_head_01", "太陽穴金針", "equipment", "head", "金", "綠色", 10, 5, "金針刺入雙側太陽穴，激發經絡潛能，使氣力與防護力均衡提升。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_head_02", "百會玉衡冠", "equipment", "head", "水", "紫色", 2, 20, "按壓百會穴的玉石發冠，安神定志，大幅度強化經絡防護力。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_head_03", "神庭烈焰針", "equipment", "head", "火", "綠色", 18, 0, "火針刺激神庭穴，溫通督脈，使藥力輸出大幅上升。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_body_01", "天樞厚土甲", "equipment", "body", "土", "綠色", -5, 40, "於神闕與雙側天樞穴敷貼大黃、芒硝等重鎮藥膏，使身體防禦固若金湯。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_body_02", "神闕艾灸護甲", "equipment", "body", "火", "紅色", 10, 15, "持續艾灸神闕穴（臍部），溫陽救逆，行氣活血，攻防兼備。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_body_03", "膻中氣海袍", "equipment", "body", "木", "綠色", 5, 22, "輕柔的絲綢道袍，內襯保護膻中與氣海穴的藥墊，調和一身之氣。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_hands_01", "合谷雷火灸", "equipment", "hands", "火", "綠色", 20, 5, "手握點燃的雷火大艾條灸合谷穴，激發雙手爆發力，攻擊力十足。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_hands_02", "內關青藤腕", "equipment", "hands", "木", "綠色", 10, 12, "寬筋藤編織腕帶按壓內關穴，寧心安神、理氣止痛，攻守相濟。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_hands_03", "勞宮暗影針", "equipment", "hands", "金", "金色", 28, -5, "刺入勞宮穴的隱密短針，宣洩心火，出招快狠，但防禦略降。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_feet_01", "湧泉硃砂履", "equipment", "feet", "火", "綠色", 12, 8, "鞋底內襯硃砂貼湧泉穴，引火下行，步伐沉穩有力且帶有火熱藥勁。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_feet_02", "足三里飛針", "equipment", "feet", "土", "藍色", 5, 15, "銀針輕刺足三里，激發胃經之氣，身輕如燕，行動極為迅捷靈活。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_feet_03", "太衝水晶鞋", "equipment", "feet", "木", "綠色", 0, 20, "按摩太衝穴的硬底鞋，疏肝理氣，步伐穩健如山，大補防護力。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_sub_01", "香薷防疫香包", "equipment", "sub", "水", "綠色", 5, 5, "裝有香薷、蒼朮、白芷的香包，辟穢解毒，提升微幅攻防氣場。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_sub_02", "萬歌硃砂葫蘆", "equipment", "sub", "火", "綠色", 15, 0, "裝滿辟邪硃砂的銅葫蘆，鎮驚安神，激發仙獸戰意。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_sub_03", "八卦太極鏡", "equipment", "sub", "金", "綠色", 0, 15, "黃銅太極鏡，反射邪氣，在身周張開護體金光。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["equip_sub_04", "川烏拔毒膏", "equipment", "sub", "木", "綠色", 8, 2, "劇毒川烏製成的敷貼膏藥，以毒攻毒，帶有微弱的氣血吸取加護。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 0],
      ["skill_card_01", "人參生脈飲", "skill", "skill", "木", "藍色", 0, 0, "服下人參、麥冬、五味子熬製的生脈飲，益氣復脈，為自身恢復 30 點氣血。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 0, 30],
      ["skill_card_02", "附子大熱劑", "skill", "skill", "火", "紅色", 0, 0, "使用大熱大毒的附子湯劑，回陽救逆，直接灼燒對手經絡，造成 25 點無視防禦的經絡傷害。", "", "", "", "", "", "", "", "", "", "", "", "opponent", 0, 0, -25],
      ["skill_card_03", "石膏清涼散", "skill", "skill", "水", "藍色", 0, 0, "降火聖藥生石膏熬製清涼散，清熱瀉火，為自身增加 25 點經絡防護力。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 25, 0],
      ["skill_card_04", "麻黃宣肺湯", "skill", "skill", "火", "紫色", 0, 0, "服下麻黃宣肺湯，宣肺發汗。限自身現存攻擊力小於等於 25 時觸發，使攻擊力增加 20 點且防禦力減少 10 點。", "", "<=25", "", "", "", "", "", "", "", "", "", "self", 20, -10, 0],
      ["skill_card_05", "斷腸五毒膏", "skill", "skill", "土", "藍色", 0, 0, "調配斷腸草與五毒製成毒膏，使對手氣血扣減 15 點，且防禦力降低 15 點。", "", "", "", "", "", "", "", "", "", "", "", "opponent", 0, -15, -15],
      ["skill_card_06", "甘草調和湯", "skill", "skill", "土", "藍色", 0, 0, "利用國老甘草調和百藥，為自身回復 15 點氣血與 15 點經絡防禦力。", "", "", "", "", "", "", "", "", "", "", "", "self", 0, 15, 15],
      ["skill_card_07", "雷公藤破壞散", "skill", "skill", "木", "金色", 0, 0, "使用極毒雷公藤，限自身現存攻擊力大於 15 時觸發，對手扣除 35 氣血，但自身受到 10 點反噬。", "", ">15", "", "", "", "", "", "", "", "", "", "opponent", 0, 0, -35],
      ["skill_card_08", "細辛通陽鎧", "skill", "skill", "金", "紫色", 0, 0, "細辛通陽，限對方現存攻擊力大於 10 時觸發，防禦增加 30 點並對對手反震 5 點傷害。", "", "", "", ">10", "", "", "", "", "", "", "", "self", 0, 30, 0],
      ["skill_card_09", "黃連解毒湯", "skill", "skill", "金", "綠色", 0, 0, "大苦大寒黃連解毒湯，降低對手防禦力 20 點，且對手本回合攻擊力降低 20 點。", "", "", "", "", "", "", "", "", "", "", "", "opponent", -20, -20, 0],
      ["skill_card_10", "靈芝補氣吸精", "skill", "skill", "木", "紅色", 0, 0, "吸取對手元氣，自身回復 15 氣血，對手扣除 15 氣血值。", "", "", "", "", "", "", "", "", "", "", "", "opponent", 0, 0, -15],
      ["skill_card_11", "大黃瀉火膏", "skill", "skill", "水", "綠色", 0, 0, "使用將軍大黃，釜底抽薪，使對手防護力大幅降低 30 點。", "", "", "", "", "", "", "", "", "", "", "", "opponent", 0, -30, 0],
      ["skill_card_12", "神速奪命刺", "skill", "skill", "金", "金色", 0, 0, "限自己另一張卡牌的特性等於「金」時觸發，對手扣除 15 氣血，且自身攻擊力增加 15 點。", "", "", "", "", "", "", "", "=金", "", "", "", "opponent", 15, 0, -15]
    ];
    for (var d = 0; d < defaultCards.length; d++) {
      cardsSheet.appendRow(defaultCards[d]);
    }
  }

  // 8. 藥斗任務設定工作表
  var oldTasksConfigSheet = ss.getSheetByName("tasks_config");
  if (oldTasksConfigSheet) {
    ss.deleteSheet(oldTasksConfigSheet);
  }
  var tasksConfigSheet = getOrCreateSheet(ss, "tasks_config", ["grid_index", "name", "description", "reward_card_id", "detail", "url"]);
  if (tasksConfigSheet.getLastRow() <= 1) {
    var defaultTasksConfig = [
      [0, "當歸", "辨識當歸切片，完成當歸補血湯配藥。", "skill_card_01", "當歸藥理常識：味甘、辛，性溫。歸肝、心、脾經。功能補血活血、調經止痛、潤腸通便。挑戰規則：請向執藥師辨識當歸與假當歸切片，並親自完成補血湯配藥即可通關。"],
      [1, "黃耆", "體驗百草醫館黃耆煎藥，學習溫補脾胃經絡。", "", "黃耆藥理常識：味甘，性溫。歸脾、肺經。功能補氣升陽、固表止汗、利水消腫。挑戰規則：在砂鍋煎藥區體驗黃耆煎煮 15 分鐘，經執藥師確認藥汁顏色與香氣後即可通關。"],
      [2, "甘草", "調和諸藥！在人體經絡模型上尋找甘草所對應的脾經穴位。", "skill_card_03", "甘草藥理常識：味甘，性平。歸心、肺、脾、胃經。功能補脾益氣、清熱解毒、祛痰止咳、調和諸藥。挑戰規則：在人體銅人經絡模型上準確找出脾經的「太白穴」，指認正確即可獲得通關口令。"],
      [3, "人參", "大補元氣！完成人參切片與生脈飲的沖泡。", "", "人參藥理常識：味甘、微苦，性微溫。歸脾、肺、心經。功能大補元氣、補脾益肺、生津、安神。挑戰規則：使用藥刀切出三片均勻的人參薄片，並完成一劑生脈飲沖泡，經執藥師品嘗認可後通關。"],
      [4, "川芎", "活血行氣！辨識川芎外觀與其氣味特色。", "equip_head_02", "川芎藥理常識：味辛，性溫。歸肝、膽、心包經。功能活血行氣、祛風止痛。為「血中之氣藥」。挑戰規則：閉眼嗅聞川芎特殊的濃烈藥香，並在三種藥根中準確挑出川芎，即核發通關碼。"],
      [5, "白芍", "柔肝止痛！製作一劑白芍與甘草的調和藥包。", "", "白芍藥理常識：味苦、酸，性微寒。歸肝、脾經。功能養血調經、斂陰止汗、柔肝止痛、平抑肝陽。挑戰規則：稱取白芍 10 錢、甘草 5 錢，調配成經典「芍藥甘草湯」藥包，封口整齊即可通關。"],
      [6, "熟地", "滋陰補血！觀察九蒸九曬熟地黃的製作過程。", "skill_card_05", "熟地黃藥理常識：味甘，性微溫。歸肝、腎經。功能補血滋陰、益精填髓。挑戰規則：向執藥師請教並說明「九蒸九曬」對於地黃炮製的意義（消除黏膩性、增加溫補力），回答正確通關。"],
      [7, "柴胡", "疏肝解熱！完成柴胡葛根湯的調配。", "", "柴胡藥理常識：味苦、辛，性微寒。歸膽、肝、肺經。功能和解表裡、疏肝解鬱、升陽舉陷。挑戰規則：調配柴胡葛根湯，稱量比例需精準至分兩，經執藥師覆核無誤後核發通關碼。"],
      [8, "半夏", "燥濕化痰！學習法半夏與生半夏的炮製區別。", "equip_body_03", "半夏藥理常識：味辛，性溫；有毒。歸脾、胃、肺經。功能燥濕化痰、降逆止嘔、消痞散結。挑戰規則：口述生半夏毒性與法半夏（生薑、礬水炮製）的安全區別，確保用藥安全後通關。"],
      [9, "茯苓", "利水滲濕！辨別茯苓塊與茯苓片的差別。", "", "茯苓藥理常識：味甘、淡，性平。歸心、肺、脾、腎經。功能利水滲濕、健脾、寧心。挑戰規則：在藥斗中指出「茯苓塊」與「茯苓片」的外觀差異，並說出其常用於利水消腫的藥理常識。"],
      [10, "陳皮", "理氣健脾！體驗百草堂三年老陳皮的泡茶修煉。", "skill_card_08", "陳皮藥理常識：味苦、辛，性溫。歸脾、肺經。功能理氣健脾、燥濕化痰。挑戰規則：使用醫館珍藏之三年老陳皮泡製一壺陳皮普洱茶，分送兩位同道品茗，完成茶道修煉通關。"],
      [11, "白術", "健脾益氣！完成白術與山藥的藥膳配製。", "", "白術藥理常識：味甘、苦，性溫。歸脾、胃經。功能健脾益氣、燥濕利水、止汗、安胎。挑戰規則：調配一劑「健脾八珍糕」的基礎白術與山藥藥膳比例，通過執藥師審查後即可通關。"],
      [12, "枸杞", "滋補肝腎，明目！完成枸杞與菊花茶的搭配。", "equip_hands_03", "枸杞子藥理常識：味甘，性平。歸肝、腎經。功能滋補肝腎、益精明目。挑戰規則：調製「枸杞菊花茶」，說明其明目退火之藥理，並通過執藥師的茶飲溫度與比例認證通關。"],
      [13, "杜仲", "補肝腎，強筋骨！學習杜仲折斷時的絲絡辨識。", "", "杜仲藥理常識：味甘，性溫。歸肝、腎經。功能補肝腎、強筋骨、安胎。挑戰規則：將杜仲藥皮輕輕折斷，觀察並指明其中連接的「白色彈性絲絡」，能說出其代表之真偽辨識常識即可通關。"],
      [14, "砂仁", "化濕開胃，溫脾止瀉！體驗砂仁研碎時的芳香。", "skill_card_10", "砂仁藥理常識：味辛，性溫。歸脾、胃、腎經。功能化濕開胃、溫脾止瀉、理氣安胎。挑戰規則：使用乳缽將砂仁研碎，使其芳香氣體溢出以達到「醒脾」效果，完成操作經執藥師點頭後通關。"],
      [15, "麥冬", "養陰生津，潤肺清心！調製一劑麥冬清涼飲。", "", "麥冬藥理常識：味甘、微苦，性微寒。歸心、肺、胃經。功能養陰生津、潤肺清心。挑戰規則：調配夏季防暑之麥冬清涼飲，經檢測口感甘涼、無雜質後，由執藥師核發最終格通關碼。"]
    ];
    for (var t = 0; t < defaultTasksConfig.length; t++) {
      tasksConfigSheet.appendRow(defaultTasksConfig[t]);
    }
  }

  // 9. 等級對照工作表
  var oldLevelConfigSheet = ss.getSheetByName("level_config");
  if (oldLevelConfigSheet) {
    var headers = oldLevelConfigSheet.getRange(1, 1, 1, oldLevelConfigSheet.getLastColumn()).getValues()[0];
    if (headers.length !== 3) {
      ss.deleteSheet(oldLevelConfigSheet);
    }
  }
  var levelConfigSheet = getOrCreateSheet(ss, "level_config", ["level", "min_exp", "base_hp"]);
  if (levelConfigSheet.getLastRow() <= 1) {
    for (var l = 1; l <= 50; l++) {
      var minExp = (l - 1) * 100;
      var baseHp = 100 + (l - 1) * 15;
      levelConfigSheet.appendRow([l, minExp, baseHp]);
    }
  }

  // 10. 進行中任務工作表
  getOrCreateSheet(ss, "active_tasks", ["player_id", "grid_index", "password", "status", "created_at"]);

  return { success: true, message: "百草醫館資料庫已初始化！" };
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

// 統一入口 API
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var result = { success: false, error: "無效的操作" };
  try {
    var params = e.parameter;
    var action = params.action;
    var data = {};

    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
      if (!action) action = data.action;
    }

    if (params.payload) {
      data = JSON.parse(params.payload);
    }

    result = routeAction(action, data, params);
  } catch (err) {
    result = { success: false, error: err.toString(), stack: err.stack };
  }

  var output = ContentService.createTextOutput(JSON.stringify(result));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function routeAction(action, data, params) {
  var ss = getSpreadsheet();

  if (action !== "login" && action !== "setup") {
    // 檢查強制登出設定
    var forceLogoutTime = Number(getSystemConfig(ss, "force_logout_time")) || 0;
    var requesterId = data.requester_id || params.requester_id || data.player_id || data.admin_id;
    if (requesterId) {
      var reqUser = getPlayerRow(ss, requesterId);
      if (reqUser && reqUser.role !== "admin" && reqUser.role !== "game_admin") {
        var lastActive = Number(reqUser.last_active) || 0;
        if (lastActive < forceLogoutTime) {
          return { success: false, error: "FORCE_LOGOUT", message: "管理員已關閉通道，所有玩家強制登出中" };
        }
      }
    }

    var gameEnabled = getSystemConfig(ss, "game_enabled") === "true";
    if (!gameEnabled) {
      if (requesterId) {
        var reqUser = getPlayerRow(ss, requesterId);
        if (reqUser && reqUser.role !== "admin" && reqUser.role !== "game_admin") {
          return { success: false, error: "伺服器維護中，目前玩家無法進入培育場。" };
        }
      } else {
        return { success: false, error: "培育場關閉中" };
      }
    }
  }

  switch (action) {
    case "setup":
      return initDatabase();

    case "login":
      return handleLogin(ss, data.username, data.password);

    case "get_cards":
      return getCardsList(ss);

    case "get_tasks_config":
      return getTasksConfigList(ss);

    case "get_player_data":
      return getPlayerData(ss, data.player_id);

    case "update_equipment":
      return updateEquipment(ss, data.player_id, data.equipped);

    case "update_deck":
      return updateDeck(ss, data.player_id, data.deck);

    case "get_online_players":
      return getOnlinePlayers(ss, data.player_id);

    case "invite_player":
      return invitePlayer(ss, data.sender_id, data.receiver_id);

    case "check_invitations":
      return checkInvitations(ss, data.player_id);

    case "respond_invitation":
      return respondInvitation(ss, data.player_id, data.invitation_id, data.accept);

    case "get_battle_state":
      return getBattleState(ss, data.battle_id, data.player_id);

    case "abandon_battle":
      return abandonBattle(ss, data.battle_id, data.player_id);

    case "submit_battle_action":
      return submitBattleAction(ss, data.battle_id, data.player_id, data.card_id);

    case "claim_qr_code":
      return claimQrCode(ss, data.player_id, data.token);

    case "claim_task":
      return claimTask(ss, data.player_id, data.grid_index, data.password);

    case "start_task":
      return startTask(ss, data.player_id, data.grid_index);

    case "admin_generate_qr":
      return adminGenerateQr(ss, data.admin_id, data.card_id);

    case "admin_get_tasks":
      return adminGetTasks(ss, data.admin_id);

    case "admin_get_quotas":
      return adminGetQuotas(ss, data.admin_id);

    case "game_admin_toggle_login":
      return gameAdminToggleLogin(ss, data.admin_id, data.enabled);

    case "game_admin_update_player":
      return gameAdminUpdatePlayer(ss, data.admin_id, data.target_player_id, data.fields);

    case "game_admin_reset_system":
      return gameAdminResetSystem(ss, data.admin_id);

    case "game_admin_set_system_configs":
      return gameAdminSetSystemConfigs(ss, data.admin_id, data.configs);

    case "get_level_config":
      return getLevelConfigList(ss);

    default:
      return { success: false, error: "未知的請求動作 (" + action + ")" };
  }
}

// 獲取 Sheets 自訂卡牌清單
function getCardsList(ss) {
  var sheet = ss.getSheetByName("cards");
  var data = sheet.getDataRange().getValues();
  var list = [];

  if (data.length <= 1) return { success: true, cards: [] };

  var headers = data[0];
  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    colMap[String(headers[c]).trim().toLowerCase()] = c;
  }

  var getVal = function (row, fieldNames, defaultVal) {
    for (var f = 0; f < fieldNames.length; f++) {
      var idx = colMap[fieldNames[f].toLowerCase()];
      if (idx !== undefined && idx !== -1) {
        return row[idx];
      }
    }
    return defaultVal;
  };

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    list.push({
      id: String(getVal(row, ["id"], "")),
      name: String(getVal(row, ["name", "名稱"], "")),
      type: String(getVal(row, ["type", "類型"], "")),
      sub_type: String(getVal(row, ["sub_type", "部位", "子類型"], "")),
      element: String(getVal(row, ["element", "屬性"], "")),
      rarity: String(getVal(row, ["rarity", "稀有度"], "")),
      atk_mod: Number(getVal(row, ["atk_mod", "內功", "初始內功"], 0)),
      def_mod: Number(getVal(row, ["def_mod", "衛氣", "初始衛氣"], 0)),
      description: String(getVal(row, ["description", "說明", "描述", "卡牌描述"], "")),
      image_url: String(getVal(row, ["image_url", "圖片", "圖片連結"], "")),
      self_atk: String(getVal(row, ["self_atk"], "")),
      self_def: String(getVal(row, ["self_def"], "")),
      ops_atk: String(getVal(row, ["ops_atk"], "")),
      ops_def: String(getVal(row, ["ops_def"], "")),
      self_othr_atk: String(getVal(row, ["self_othr_atk"], "")),
      self_othr_def: String(getVal(row, ["self_othr_def"], "")),
      self_othr_ele: String(getVal(row, ["self_othr_ele"], "")),
      ops_any_atk: String(getVal(row, ["ops_any_atk"], "")),
      ops_any_def: String(getVal(row, ["ops_any_def"], "")),
      ops_any_ele: String(getVal(row, ["ops_any_ele"], "")),
      target: String(getVal(row, ["target", "對象"], "self")),
      atk_aft: Number(getVal(row, ["atk_aft", "觸發後內功", "內功強度"], 0)),
      def_aft: Number(getVal(row, ["def_aft", "觸發後衛氣", "衛氣強度"], 0)),
      hp_aft: Number(getVal(row, ["hp_aft", "觸發後營血", "營血調養"], 0))
    });
  }
  return { success: true, cards: list };
}

// 獲取藥斗任務配置清單
function getTasksConfigList(ss) {
  var sheet = ss.getSheetByName("tasks_config");
  if (!sheet) return { success: false, error: "tasks_config table missing" };
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    list.push({
      grid_index: Number(data[i][0]),
      name: String(data[i][1]),
      description: String(data[i][2]),
      reward_card_id: String(data[i][3] || ""),
      detail: String(data[i][4] || "詳細小任務規則及通關代碼，請洽工作人員。"),
      url: data[i].length > 5 ? String(data[i][5] || "") : ""
    });
  }
  return { success: true, tasks: list };
}

// 將 Sheets 轉為卡牌 Map
function getCardsDict(ss) {
  var sheet = ss.getSheetByName("cards");
  var data = sheet.getDataRange().getValues();
  var dict = {};

  if (data.length <= 1) return dict;

  var headers = data[0];
  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    colMap[String(headers[c]).trim().toLowerCase()] = c;
  }

  var getVal = function (row, fieldNames, defaultVal) {
    for (var f = 0; f < fieldNames.length; f++) {
      var idx = colMap[fieldNames[f].toLowerCase()];
      if (idx !== undefined && idx !== -1) {
        return row[idx];
      }
    }
    return defaultVal;
  };

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id = String(getVal(row, ["id"], ""));
    dict[id] = {
      id: id,
      name: String(getVal(row, ["name", "名稱"], "")),
      type: String(getVal(row, ["type", "類型"], "")),
      sub_type: String(getVal(row, ["sub_type", "部位", "子類型"], "")),
      element: String(getVal(row, ["element", "屬性"], "")),
      rarity: String(getVal(row, ["rarity", "稀有度"], "")),
      atk_mod: Number(getVal(row, ["atk_mod", "內功", "初始內功"], 0)),
      def_mod: Number(getVal(row, ["def_mod", "衛氣", "初始衛氣"], 0)),
      description: String(getVal(row, ["description", "說明", "描述", "卡牌描述"], "")),
      image_url: String(getVal(row, ["image_url", "圖片", "圖片連結"], "")),
      self_atk: String(getVal(row, ["self_atk"], "")),
      self_def: String(getVal(row, ["self_def"], "")),
      ops_atk: String(getVal(row, ["ops_atk"], "")),
      ops_def: String(getVal(row, ["ops_def"], "")),
      self_othr_atk: String(getVal(row, ["self_othr_atk"], "")),
      self_othr_def: String(getVal(row, ["self_othr_def"], "")),
      self_othr_ele: String(getVal(row, ["self_othr_ele"], "")),
      ops_any_atk: String(getVal(row, ["ops_any_atk"], "")),
      ops_any_def: String(getVal(row, ["ops_any_def"], "")),
      ops_any_ele: String(getVal(row, ["ops_any_ele"], "")),
      target: String(getVal(row, ["target", "對象"], "self")),
      atk_aft: Number(getVal(row, ["atk_aft", "觸發後內功", "內功強度"], 0)),
      def_aft: Number(getVal(row, ["def_aft", "觸發後衛氣", "衛氣強度"], 0)),
      hp_aft: Number(getVal(row, ["hp_aft", "觸發後營血", "營血調養"], 0))
    };
  }
  return dict;
}

// 獲取等級與生命對照表清單
function getLevelConfigList(ss) {
  var sheet = ss.getSheetByName("level_config");
  if (!sheet) return { success: false, error: "level_config table missing" };
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    list.push({
      level: Number(data[i][0]),
      min_exp: Number(data[i][1]),
      base_hp: Number(data[i][2])
    });
  }
  return { success: true, levels: list };
}

// 根據累積經驗值獲取玩家等級
function getPlayerLevelByExp(ss, exp) {
  var sheet = ss.getSheetByName("level_config");
  if (!sheet) return Math.floor(exp / 100) + 1;
  var data = sheet.getDataRange().getValues();
  var currentLevel = 1;
  var maxExpFound = -1;
  for (var i = 1; i < data.length; i++) {
    var l = Number(data[i][0]);
    var minExp = Number(data[i][1]);
    if (exp >= minExp) {
      if (minExp > maxExpFound || (minExp === maxExpFound && l > currentLevel)) {
        currentLevel = l;
        maxExpFound = minExp;
      }
    }
  }
  return currentLevel;
}

// 根據玩家等級獲取初始最大 HP
function getPlayerBaseHpByLevel(ss, level) {
  var sheet = ss.getSheetByName("level_config");
  if (!sheet) return 100 + (level - 1) * 15;
  var data = sheet.getDataRange().getValues();
  var lastRowHp = 100;
  var maxL = 0;
  for (var i = 1; i < data.length; i++) {
    var l = Number(data[i][0]);
    var hp = Number(data[i][2]);
    if (l === level) {
      return hp;
    }
    if (l > maxL) {
      maxL = l;
      lastRowHp = hp;
    }
  }
  // 超出對照表的等級上限，回退到對照表最後一級的 HP
  if (level > maxL && maxL > 0) {
    return lastRowHp;
  }
  return 100 + (level - 1) * 15;
}

// 獲取系統設定值
function getSystemConfig(ss, key) {
  var sheet = ss.getSheetByName("system_config");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      return String(data[i][1]);
    }
  }
  return "";
}

// 設定系統設定值
function setSystemConfig(ss, key, value) {
  var sheet = ss.getSheetByName("system_config");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(String(value));
      return;
    }
  }
  sheet.appendRow([key, String(value)]);
}

// 取得單一玩家列與索引
function getPlayerRow(ss, id) {
  var sheet = ss.getSheetByName("players");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(id).toLowerCase()) {
      return {
        rowNum: i + 1,
        id: data[i][0],
        password: data[i][1],
        name: data[i][2],
        role: data[i][3],
        level: Number(data[i][4]),
        exp: Number(data[i][5]),
        equipped: {
          head: data[i][6] || "",
          body: data[i][7] || "",
          hands: data[i][8] || "",
          feet: data[i][9] || "",
          sub1: data[i][10] || "",
          sub2: data[i][11] || ""
        },
        deck: JSON.parse(data[i][12] || "[]"),
        inventory: JSON.parse(data[i][13] || "{}"),
        tasks_progress: JSON.parse(data[i][14] || "{}"),
        last_active: Number(data[i][15] || 0)
      };
    }
  }
  return null;
}

// 更新玩家特定儲存格
function updatePlayerRow(ss, rowNum, playerObj) {
  var sheet = ss.getSheetByName("players");
  sheet.getRange(rowNum, 5).setValue(playerObj.level);
  sheet.getRange(rowNum, 6).setValue(playerObj.exp);
  sheet.getRange(rowNum, 7).setValue(playerObj.equipped.head);
  sheet.getRange(rowNum, 8).setValue(playerObj.equipped.body);
  sheet.getRange(rowNum, 9).setValue(playerObj.equipped.hands);
  sheet.getRange(rowNum, 10).setValue(playerObj.equipped.feet);
  sheet.getRange(rowNum, 11).setValue(playerObj.equipped.sub1);
  sheet.getRange(rowNum, 12).setValue(playerObj.equipped.sub2);
  sheet.getRange(rowNum, 13).setValue(JSON.stringify(playerObj.deck));
  sheet.getRange(rowNum, 14).setValue(JSON.stringify(playerObj.inventory));
  sheet.getRange(rowNum, 15).setValue(JSON.stringify(playerObj.tasks_progress));
  sheet.getRange(rowNum, 16).setValue(playerObj.last_active);
}

// 登入
function handleLogin(ss, username, password) {
  if (!username) return { success: false, error: "請輸入帳號" };
  var player = getPlayerRow(ss, username);
  if (!player) return { success: false, error: "帳號不存在" };
  if (player.password !== password) return { success: false, error: "密碼錯誤" };

  var gameEnabled = getSystemConfig(ss, "game_enabled") === "true";
  if (!gameEnabled && player.role !== "admin" && player.role !== "game_admin") {
    return { success: false, error: "伺服器維護中，目前玩家無法進入培育中心。" };
  }

  player.last_active = new Date().getTime();
  updatePlayerRow(ss, player.rowNum, player);

  delete player.password;

  return { success: true, player: player, system_login_enabled: gameEnabled };
}

// 取得玩家個人資料並心跳更新
function getPlayerData(ss, playerId) {
  var player = getPlayerRow(ss, playerId);
  if (!player) return { success: false, error: "玩家不存在" };

  player.last_active = new Date().getTime();
  updatePlayerRow(ss, player.rowNum, player);

  delete player.password;
  return { success: true, player: player };
}

// 更換裝備
function updateEquipment(ss, playerId, equipped) {
  var player = getPlayerRow(ss, playerId);
  if (!player) return { success: false, error: "玩家不存在" };

  var slots = ["head", "body", "hands", "feet", "sub1", "sub2"];
  for (var i = 0; i < slots.length; i++) {
    var slot = slots[i];
    var cardId = equipped[slot];
    if (cardId) {
      if (!player.inventory[cardId] || player.inventory[cardId] <= 0) {
        return { success: false, error: "你的背包中沒有此裝備卡！" };
      }
    }
  }

  player.equipped = equipped;
  player.last_active = new Date().getTime();
  updatePlayerRow(ss, player.rowNum, player);

  delete player.password;
  return { success: true, player: player };
}

// 更新技能牌組
function updateDeck(ss, playerId, deck) {
  var player = getPlayerRow(ss, playerId);
  if (!player) return { success: false, error: "玩家不存在" };

  if (!Array.isArray(deck) || deck.length !== 10) {
    return { success: false, error: "牌組卡槽必須為 10 個！" };
  }

  var uniqueCards = {};
  for (var i = 0; i < deck.length; i++) {
    var cid = deck[i];
    if (cid === "") continue; // 容許空白卡槽
    if (uniqueCards[cid]) {
      return { success: false, error: "牌組中同一卡牌只能攜帶一張！" };
    }
    uniqueCards[cid] = true;
    // 取消背包庫存限制，提前出完等同不出牌
    // if (!player.inventory[cid] || player.inventory[cid] < 1) {
    //   return { success: false, error: "背包中無此卡牌，無法配置！" };
    // }
  }

  player.deck = deck;
  player.last_active = new Date().getTime();
  updatePlayerRow(ss, player.rowNum, player);

  delete player.password;
  return { success: true, player: player };
}

// 取得在線玩家
function getOnlinePlayers(ss, playerId) {
  var sheet = ss.getSheetByName("players");
  var data = sheet.getDataRange().getValues();
  var onlineList = [];
  var now = new Date().getTime();

  for (var i = 1; i < data.length; i++) {
    var pId = String(data[i][0]);
    if (pId.toLowerCase() !== String(playerId).toLowerCase() && data[i][3] === "player") {
      var lastActive = Number(data[i][15] || 0);
      if (now - lastActive < 15000) {
        onlineList.push({
          id: pId,
          name: data[i][2],
          level: Number(data[i][4])
        });
      }
    }
  }

  var me = getPlayerRow(ss, playerId);
  if (me) {
    me.last_active = now;
    updatePlayerRow(ss, me.rowNum, me);
  }

  return { success: true, online_players: onlineList };
}

// 發送對戰邀請
function invitePlayer(ss, senderId, receiverId) {
  var sheet = ss.getSheetByName("invitations");
  var data = sheet.getDataRange().getValues();

  // 檢查是否已存在 pending 的相同邀請
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === senderId && data[i][2] === receiverId && data[i][3] === "pending") {
      return { success: true, invitation_id: data[i][0] };
    }
  }

  var invId = "INV_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === senderId && data[i][3] === "pending") {
      sheet.getRange(i + 1, 4).setValue("expired");
    }
  }

  sheet.appendRow([invId, senderId, receiverId, "pending", String(new Date().getTime())]);
  return { success: true, invitation_id: invId };
}

// 檢查被邀請狀態
function checkInvitations(ss, playerId) {
  var sheet = ss.getSheetByName("invitations");
  var data = sheet.getDataRange().getValues();
  var now = new Date().getTime();

  var inbound = null;
  var outboundAccepted = null;

  for (var i = data.length - 1; i >= 1; i--) {
    var invId = data[i][0];
    var sender = data[i][1];
    var receiver = data[i][2];
    var status = data[i][3];
    var createdAt = Number(data[i][4]);

    if (now - createdAt > 30000 && status === "pending") {
      sheet.getRange(i + 1, 4).setValue("expired");
      continue;
    }

    if (receiver === playerId && status === "pending") {
      var senderPlayer = getPlayerRow(ss, sender);
      inbound = {
        invitation_id: invId,
        sender_id: sender,
        sender_name: senderPlayer ? senderPlayer.name : sender
      };
      break;
    }

    var statusStr = String(status);
    if (String(sender).toLowerCase() === String(playerId).toLowerCase() && statusStr.indexOf("accepted") === 0) {
      var bId = "";
      if (statusStr.indexOf("accepted:") === 0) {
        bId = statusStr.split(":")[1];
      }

      if (!bId) {
        var battlesSheet = ss.getSheetByName("battles");
        var bData = battlesSheet.getDataRange().getValues();
        for (var j = bData.length - 1; j >= 1; j--) {
          var p1Lower = String(bData[j][1]).toLowerCase();
          var p2Lower = String(bData[j][2]).toLowerCase();
          var playerLower = String(playerId).toLowerCase();
          if ((p1Lower === playerLower || p2Lower === playerLower) && bData[j][3] === "active") {
            bId = bData[j][0];
            break;
          }
        }
      }

      outboundAccepted = {
        invitation_id: invId,
        battle_id: bId
      };
      sheet.getRange(i + 1, 4).setValue("joined");
      break;
    }
  }

  return { success: true, inbound: inbound, outbound_accepted: outboundAccepted };
}

// 回應邀請
function respondInvitation(ss, receiverId, invId, accept) {
  var sheet = ss.getSheetByName("invitations");
  var data = sheet.getDataRange().getValues();
  var row = -1;
  var senderId = "";
  var now = new Date().getTime();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === invId && data[i][3] === "pending") {
      var createdAt = Number(data[i][4]);
      if (now - createdAt > 30000) {
        sheet.getRange(i + 1, 4).setValue("expired");
        return { success: false, error: "邀請已過期或不存在" };
      }
      row = i + 1;
      senderId = data[i][1];
      break;
    }
  }

  if (row === -1) {
    return { success: false, error: "邀請已過期或不存在" };
  }

  if (!accept) {
    sheet.getRange(row, 4).setValue("rejected");
    return { success: true, status: "rejected" };
  }

  var p1 = getPlayerRow(ss, senderId);
  var p2 = getPlayerRow(ss, receiverId);

  if (!p1 || !p2) {
    return { success: false, error: "玩家資料遺失" };
  }

  var cardsDict = getCardsDict(ss);

  var p1Stats = calculateStatsWithCustomCards(ss, p1, cardsDict);
  var p2Stats = calculateStatsWithCustomCards(ss, p2, cardsDict);

  var battleId = "BAT_" + new Date().getTime();
  sheet.getRange(row, 4).setValue("accepted:" + battleId);
  var battlesSheet = ss.getSheetByName("battles");

  battlesSheet.appendRow([
    battleId, senderId, receiverId, "active", "", String(new Date().getTime()),
    p1Stats.maxHp, p1Stats.maxHp, p1Stats.def, p1Stats.atk,
    p2Stats.maxHp, p2Stats.maxHp, p2Stats.def, p2Stats.atk,
    "waiting", "waiting", 1,
    "", "", // r1
    "", "", // r2
    "", "", // r3
    "", "", // r4
    "", "", // r5
    "", ""  // last_action
  ]);

  return { success: true, status: "accepted", battle_id: battleId };
}

function calculateStatsWithCustomCards(ss, player, cardsDict) {
  var level = player.level || 1;
  var baseHp = getPlayerBaseHpByLevel(ss, level);
  var bonusAtk = 0;
  var bonusDef = 0;

  var slots = ["head", "body", "hands", "feet", "sub1", "sub2"];
  for (var i = 0; i < slots.length; i++) {
    var cardId = player.equipped[slots[i]];
    if (cardId && cardsDict[cardId]) {
      bonusAtk += cardsDict[cardId].atk_mod || 0;
      bonusDef += cardsDict[cardId].def_mod || 0;
    }
  }

  return {
    maxHp: baseHp,
    atk: Math.max(0, 10 + bonusAtk),
    def: Math.max(0, 5 + bonusDef)
  };
}

// 取得戰鬥狀態並進行超時結算
function getBattleState(ss, battleId, playerId) {
  var sheet = ss.getSheetByName("battles");
  var data = sheet.getDataRange().getValues();
  var row = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === battleId) {
      row = i + 1;
      break;
    }
  }

  if (row === -1) {
    return { success: false, error: "找不到該切磋場地" };
  }

  var bRow = data[row - 1];
  var status = bRow[3];
  var winnerId = bRow[4];
  var startTime = Number(bRow[5]);
  var p1Id = bRow[1];
  var p2Id = bRow[2];

  var now = new Date().getTime();

  // 1. 分段出牌超時自動結算判定 (21秒 = 15秒回合時間 + 4秒動畫展示 + 2秒網路緩衝)
  if (status === "active") {
    var p1Action = bRow[14];
    var p2Action = bRow[15];

    if (p1Action === "waiting") {
      // 階段 1：等待 P1 出牌超時
      if (now - startTime > 21000) {
        sheet.getRange(row, 15).setValue("");
        sheet.getRange(row, 6).setValue(String(now));

        bRow[14] = "";
        bRow[5] = now;
        startTime = now;
      }
    } else if (p2Action === "waiting") {
      // 階段 2：等待 P2 出牌超時
      if (now - startTime > 21000) {
        sheet.getRange(row, 16).setValue("");
        bRow[15] = "";

        resolveRound(ss, row, bRow);

        // 重新讀取更新後的對戰數據
        data = sheet.getDataRange().getValues();
        bRow = data[row - 1];
        status = bRow[3];
        winnerId = bRow[4];
        startTime = Number(bRow[5]);
      }
    }
  }

  // 2. 對戰安全超時結算 (3分鐘)
  if (status === "active" && (now - startTime > 180000)) {
    status = "ended";
    var p1Hp = Number(bRow[6]);
    var p2Hp = Number(bRow[10]);

    if (p1Hp > p2Hp) {
      winnerId = p1Id;
    } else if (p2Hp > p1Hp) {
      winnerId = p2Id;
    } else {
      winnerId = "DRAW";
    }

    sheet.getRange(row, 4).setValue(status);
    sheet.getRange(row, 5).setValue(winnerId);

    distributeBattleRewards(ss, p1Id, p2Id, winnerId);
  }

  return {
    success: true,
    battle: {
      battle_id: bRow[0],
      p1_id: bRow[1],
      p2_id: bRow[2],
      status: status,
      winner_id: winnerId,
      start_time: startTime,
      p1_hp: Number(bRow[6]),
      p1_max_hp: Number(bRow[7]),
      p1_def: Number(bRow[8]),
      p1_atk: Number(bRow[9]),
      p2_hp: Number(bRow[10]),
      p2_max_hp: Number(bRow[11]),
      p2_def: Number(bRow[12]),
      p2_atk: Number(bRow[13]),
      p1_action: bRow[14],
      p2_action: bRow[15],
      round_number: Number(bRow[16]),
      battle_log: [],
      r1_p1_cards: bRow[17] || "",
      r1_p2_cards: bRow[18] || "",
      r2_p1_cards: bRow[19] || "",
      r2_p2_cards: bRow[20] || "",
      r3_p1_cards: bRow[21] || "",
      r3_p2_cards: bRow[22] || "",
      r4_p1_cards: bRow[23] || "",
      r4_p2_cards: bRow[24] || "",
      r5_p1_cards: bRow[25] || "",
      r5_p2_cards: bRow[26] || "",
      p1_last_action: bRow[27] || "",
      p2_last_action: bRow[28] || ""
    }
  };
}

// 提交對戰卡牌選擇
function abandonBattle(ss, battleId, playerId) {
  var sheet = ss.getSheetByName("battles");
  var data = sheet.getDataRange().getValues();
  var row = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === battleId) {
      row = i + 1;
      break;
    }
  }

  if (row === -1) {
    return { success: true, battle: null };
  }

  var bRow = data[row - 1];
  if (bRow[3] !== "active") {
    return getBattleState(ss, battleId, playerId);
  }

  var p1Id = bRow[1];
  var p2Id = bRow[2];
  if (playerId !== p1Id && playerId !== p2Id) {
    return { success: false, error: "你不在這場切磋中" };
  }

  sheet.getRange(row, 4).setValue("abandoned");
  sheet.getRange(row, 5).setValue("ABANDONED");
  sheet.getRange(row, 15).setValue("waiting");
  sheet.getRange(row, 16).setValue("waiting");

  return getBattleState(ss, battleId, playerId);
}

function submitBattleAction(ss, battleId, playerId, cardId) {
  var sheet = ss.getSheetByName("battles");
  var data = sheet.getDataRange().getValues();
  var row = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === battleId) {
      row = i + 1;
      break;
    }
  }

  if (row === -1) return { success: false, error: "切磋不存在" };
  var bRow = data[row - 1];
  if (bRow[3] !== "active") return { success: false, error: "切磋已結束" };

  var p1Id = bRow[1];
  var p2Id = bRow[2];

  if (playerId === p1Id) {
    if (bRow[14] !== "waiting") return { success: false, error: "您已出過牌" };
    sheet.getRange(row, 15).setValue(cardId);
    // P1 出牌後，重置 start_time 為現在時間，以便 P2 開始思考
    sheet.getRange(row, 6).setValue(String(new Date().getTime()));
  } else if (playerId === p2Id) {
    if (bRow[14] === "waiting") return { success: false, error: "請等待對手先出牌" };
    if (bRow[15] !== "waiting") return { success: false, error: "您已出過牌" };
    sheet.getRange(row, 16).setValue(cardId);
  } else {
    return { success: false, error: "您非此切磋之參與方" };
  }

  var updatedRow = sheet.getRange(row, 1, 1, 29).getValues()[0];
  var p1Action = updatedRow[14];
  var p2Action = updatedRow[15];

  if (p1Action !== "waiting" && p2Action !== "waiting") {
    resolveRound(ss, row, updatedRow);
  }

  return getBattleState(ss, battleId, playerId);
}

// 回合結算
function resolveRound(ss, rowNum, bRow) {
  var battleSheet = ss.getSheetByName("battles");

  var battleId = bRow[0];
  var p1Id = bRow[1];
  var p2Id = bRow[2];

  var p1Hp = Number(bRow[6]);
  var p1MaxHp = Number(bRow[7]);
  var p1BaseDef = Number(bRow[8]);
  var p1BaseAtk = Number(bRow[9]);

  var p2Hp = Number(bRow[10]);
  var p2MaxHp = Number(bRow[11]);
  var p2BaseDef = Number(bRow[12]);
  var p2BaseAtk = Number(bRow[13]);

  var p1CardId = bRow[14];
  var p2CardId = bRow[15];
  var roundNum = Number(bRow[16]);
  var logArr = [];

  var cardsDict = getCardsDict(ss);

  var p1CardIds = (p1CardId && p1CardId !== "waiting") ? p1CardId.split(",") : [];
  var p2CardIds = (p2CardId && p2CardId !== "waiting") ? p2CardId.split(",") : [];

  var p1Cards = [];
  for (var i = 0; i < p1CardIds.length; i++) {
    if (cardsDict[p1CardIds[i]]) p1Cards.push(cardsDict[p1CardIds[i]]);
  }

  var p2Cards = [];
  for (var j = 0; j < p2CardIds.length; j++) {
    if (cardsDict[p2CardIds[j]]) p2Cards.push(cardsDict[p2CardIds[j]]);
  }

  var p1Stats = { atk: p1BaseAtk, def: p1BaseDef };
  var p2Stats = { atk: p2BaseAtk, def: p2BaseDef };

  var effects = calculateRoundEffects(p1Cards, p2Cards, p1Stats, p2Stats);

  var p1RoundAtk = Math.max(0, p1BaseAtk + effects.p1AtkMod);
  var p1RoundDef = Math.max(0, p1BaseDef + effects.p1DefMod);
  var p2RoundAtk = Math.max(0, p2BaseAtk + effects.p2AtkMod);
  var p2RoundDef = Math.max(0, p2BaseDef + effects.p2DefMod);

  var dmgToP1 = Math.max(0, p2RoundAtk - p1RoundDef);
  var dmgToP2 = Math.max(0, p1RoundAtk - p2RoundDef);

  var nextP1HpFinal = Math.min(p1MaxHp, Math.max(0, p1Hp - dmgToP1 + effects.p1HpMod));
  var nextP2HpFinal = Math.min(p2MaxHp, Math.max(0, p2Hp - dmgToP2 + effects.p2HpMod));

  var p1CardNames = [];
  for (var a = 0; a < p1Cards.length; a++) {
    p1CardNames.push(p1Cards[a].name + "(" + (effects.p1TriggerStates[a] ? "觸發" : "未觸發") + ")");
  }
  if (p1CardNames.length === 0) p1CardNames.push("未出牌");

  var p2CardNames = [];
  for (var b = 0; b < p2Cards.length; b++) {
    p2CardNames.push(p2Cards[b].name + "(" + (effects.p2TriggerStates[b] ? "觸發" : "未觸發") + ")");
  }
  if (p2CardNames.length === 0) p2CardNames.push("未出牌");

  var p1Log = "[" + p1Id + "] 出牌「" + p1CardNames.join(" + ") + "」，攻擊達 " + p1RoundAtk + "，防護力達 " + p1RoundDef;
  var p2Log = "[" + p2Id + "] 出牌「" + p2CardNames.join(" + ") + "」，攻擊達 " + p2RoundAtk + "，防護力達 " + p2RoundDef;

  var p1SkillNet = effects.p1HpMod;
  var p2SkillNet = effects.p2HpMod;
  var p1SkillLog = p1SkillNet >= 0 ? "回復 " + p1SkillNet + " 氣血" : "技能受損 " + Math.abs(p1SkillNet);
  var p2SkillLog = p2SkillNet >= 0 ? "回復 " + p2SkillNet + " 氣血" : "技能受損 " + Math.abs(p2SkillNet);

  var damageLog = "結算: [" + p1Id + "] 受到傷害: " + (dmgToP1 + (p1SkillNet < 0 ? Math.abs(p1SkillNet) : 0)) +
    " (物理 " + dmgToP1 + " + 技能 " + (p1SkillNet < 0 ? Math.abs(p1SkillNet) : 0) + "，回復 " + (p1SkillNet > 0 ? p1SkillNet : 0) + " HP); " +
    "[" + p2Id + "] 受到傷害: " + (dmgToP2 + (p2SkillNet < 0 ? Math.abs(p2SkillNet) : 0)) +
    " (物理 " + dmgToP2 + " + 技能 " + (p2SkillNet < 0 ? Math.abs(p2SkillNet) : 0) + "，回復 " + (p2SkillNet > 0 ? p2SkillNet : 0) + " HP)";

  logArr.push("--- 回合 " + roundNum + " ---");
  logArr.push(p1Log);
  logArr.push(p2Log);
  logArr.push(damageLog);

  var status = "active";
  var winnerId = "";

  if (nextP1HpFinal <= 0 && nextP2HpFinal <= 0) {
    status = "ended";
    winnerId = "DRAW";
    logArr.push("同歸於盡！雙方氣血皆歸零，判定平手！");
  } else if (nextP1HpFinal <= 0) {
    status = "ended";
    winnerId = p2Id;
    logArr.push("[" + p2Id + "] 獲勝！[" + p1Id + "] 氣血歸零。");
  } else if (nextP2HpFinal <= 0) {
    status = "ended";
    winnerId = p1Id;
    logArr.push("[" + p1Id + "] 獲勝！[" + p2Id + "] 氣血歸零。");
  } else if (roundNum >= 5) {
    status = "ended";
    if (nextP1HpFinal > nextP2HpFinal) {
      winnerId = p1Id;
      logArr.push("五回合戰罷，[" + p1Id + "] 氣血較高，取得最終勝利！");
    } else if (nextP2HpFinal > nextP1HpFinal) {
      winnerId = p2Id;
      logArr.push("五回合戰罷，[" + p2Id + "] 氣血較高，取得最終勝利！");
    } else {
      winnerId = "DRAW";
      logArr.push("五回合戰罷，雙方氣血相同，判定平局！");
    }
  }

  battleSheet.getRange(rowNum, 6).setValue(String(new Date().getTime()));
  battleSheet.getRange(rowNum, 7).setValue(nextP1HpFinal);
  battleSheet.getRange(rowNum, 11).setValue(nextP2HpFinal);
  battleSheet.getRange(rowNum, 15).setValue("waiting");
  battleSheet.getRange(rowNum, 16).setValue("waiting");
  battleSheet.getRange(rowNum, 17).setValue(roundNum + 1);

  // 將出牌記錄在每輪的獨立欄位中
  var colP1 = 18 + (roundNum - 1) * 2;
  var colP2 = 19 + (roundNum - 1) * 2;
  battleSheet.getRange(rowNum, colP1).setValue(p1CardId);
  battleSheet.getRange(rowNum, colP2).setValue(p2CardId);

  // 記錄上回合雙方的出牌到 last_action 欄位 (第 28, 29 欄)
  battleSheet.getRange(rowNum, 28).setValue(p1CardId);
  battleSheet.getRange(rowNum, 29).setValue(p2CardId);

  if (status === "ended") {
    battleSheet.getRange(rowNum, 4).setValue("ended");
    battleSheet.getRange(rowNum, 5).setValue(winnerId);
    distributeBattleRewards(ss, p1Id, p2Id, winnerId);
  }
}

function checkCondition(value, condStr) {
  if (!condStr) return true;
  var str = String(condStr).trim();
  if (str === "" || str === "無條件" || str === "無") return true;

  if (str.indexOf(">=") === 0) {
    return Number(value) >= parseFloat(str.substring(2));
  }
  if (str.indexOf("<=") === 0) {
    return Number(value) <= parseFloat(str.substring(2));
  }
  if (str.indexOf(">") === 0) {
    return Number(value) > parseFloat(str.substring(1));
  }
  if (str.indexOf("<") === 0) {
    return Number(value) < parseFloat(str.substring(1));
  }
  if (str.indexOf("==") === 0) {
    var target = str.substring(2).trim();
    return isNaN(target) ? String(value) === target : Number(value) === parseFloat(target);
  }
  if (str.indexOf("=") === 0) {
    var target = str.substring(1).trim();
    return isNaN(target) ? String(value) === target : Number(value) === parseFloat(target);
  }
  return isNaN(str) ? String(value) === str : Number(value) === parseFloat(str);
}

function evaluateCardTrigger(card, selfStats, opsStats, otherCard, opsCards) {
  if (!card) return false;

  if (card.self_atk && !checkCondition(selfStats.atk, card.self_atk)) return false;
  if (card.self_def && !checkCondition(selfStats.def, card.self_def)) return false;
  if (card.ops_atk && !checkCondition(opsStats.atk, card.ops_atk)) return false;
  if (card.ops_def && !checkCondition(opsStats.def, card.ops_def)) return false;

  if (card.self_othr_atk) {
    if (!otherCard) return false;
    if (!checkCondition(otherCard.atk_aft || 0, card.self_othr_atk)) return false;
  }
  if (card.self_othr_def) {
    if (!otherCard) return false;
    if (!checkCondition(otherCard.def_aft || 0, card.self_othr_def)) return false;
  }
  if (card.self_othr_ele) {
    if (!otherCard) return false;
    if (!checkCondition(otherCard.element || "", card.self_othr_ele)) return false;
  }

  if (card.ops_any_atk) {
    if (!opsCards || opsCards.length === 0) return false;
    var match = false;
    for (var a = 0; a < opsCards.length; a++) {
      if (checkCondition(opsCards[a].atk_aft || 0, card.ops_any_atk)) {
        match = true;
        break;
      }
    }
    if (!match) return false;
  }
  if (card.ops_any_def) {
    if (!opsCards || opsCards.length === 0) return false;
    var match = false;
    for (var b = 0; b < opsCards.length; b++) {
      if (checkCondition(opsCards[b].def_aft || 0, card.ops_any_def)) {
        match = true;
        break;
      }
    }
    if (!match) return false;
  }
  if (card.ops_any_ele) {
    if (!opsCards || opsCards.length === 0) return false;
    var match = false;
    for (var c = 0; c < opsCards.length; c++) {
      if (checkCondition(opsCards[c].element || "", card.ops_any_ele)) {
        match = true;
        break;
      }
    }
    if (!match) return false;
  }

  return true;
}

function calculateRoundEffects(p1Cards, p2Cards, p1Stats, p2Stats) {
  var p1TriggerStates = [];
  var p2TriggerStates = [];

  for (var i = 0; i < p1Cards.length; i++) {
    var card = p1Cards[i];
    var otherCard = p1Cards.length > 1 ? p1Cards[1 - i] : null;
    var isTriggered = evaluateCardTrigger(card, p1Stats, p2Stats, otherCard, p2Cards);
    p1TriggerStates.push(isTriggered);
  }

  for (var j = 0; j < p2Cards.length; j++) {
    var card = p2Cards[j];
    var otherCard = p2Cards.length > 1 ? p2Cards[1 - j] : null;
    var isTriggered = evaluateCardTrigger(card, p2Stats, p1Stats, otherCard, p1Cards);
    p2TriggerStates.push(isTriggered);
  }

  var p1AtkMod = 0, p1DefMod = 0, p1HpMod = 0;
  var p2AtkMod = 0, p2DefMod = 0, p2HpMod = 0;

  function applyEffect(cid, card, isP1) {
    var selfAtk = 0, selfDef = 0, selfHp = 0;
    var oppAtk = 0, oppDef = 0, oppHp = 0;

    if (cid === "skill_card_01") {
      selfHp += 30;
    } else if (cid === "skill_card_02") {
      oppHp -= 25;
    } else if (cid === "skill_card_03") {
      selfDef += 25;
    } else if (cid === "skill_card_04") {
      selfAtk += 20;
      selfDef -= 10;
    } else if (cid === "skill_card_05") {
      oppDef -= 15;
      oppHp -= 15;
    } else if (cid === "skill_card_06") {
      selfDef += 15;
      selfHp += 15;
    } else if (cid === "skill_card_07") {
      oppHp -= 35;
      selfHp -= 10;
    } else if (cid === "skill_card_08") {
      selfDef += 30;
      oppHp -= 5;
    } else if (cid === "skill_card_09") {
      oppAtk -= 20;
      oppDef -= 20;
    } else if (cid === "skill_card_10") {
      selfHp += 15;
      oppHp -= 15;
    } else if (cid === "skill_card_11") {
      oppDef -= 30;
    } else if (cid === "skill_card_12") {
      oppHp -= 15;
      selfAtk += 15;
    } else {
      var t = card.target || "self";
      var aa = card.atk_aft || 0;
      var da = card.def_aft || 0;
      var ha = card.hp_aft || 0;

      if (t === "self") {
        selfAtk += aa;
        selfDef += da;
        selfHp += ha;
      } else if (t === "opponent") {
        oppAtk += aa;
        oppDef += da;
        oppHp += ha;
      } else if (t === "both") {
        selfAtk += aa; selfDef += da; selfHp += ha;
        oppAtk += aa; oppDef += da; oppHp += ha;
      }
    }

    if (isP1) {
      p1AtkMod += selfAtk;
      p1DefMod += selfDef;
      p1HpMod += selfHp;
      p2AtkMod += oppAtk;
      p2DefMod += oppDef;
      p2HpMod += oppHp;
    } else {
      p2AtkMod += selfAtk;
      p2DefMod += selfDef;
      p2HpMod += selfHp;
      p1AtkMod += oppAtk;
      p1DefMod += oppDef;
      p1HpMod += oppHp;
    }
  }

  for (var i = 0; i < p1Cards.length; i++) {
    if (p1TriggerStates[i]) {
      applyEffect(p1Cards[i].id, p1Cards[i], true);
    }
  }

  for (var j = 0; j < p2Cards.length; j++) {
    if (p2TriggerStates[j]) {
      applyEffect(p2Cards[j].id, p2Cards[j], false);
    }
  }

  return {
    p1TriggerStates: p1TriggerStates,
    p2TriggerStates: p2TriggerStates,
    p1AtkMod: p1AtkMod,
    p1DefMod: p1DefMod,
    p1HpMod: p1HpMod,
    p2AtkMod: p2AtkMod,
    p2DefMod: p2DefMod,
    p2HpMod: p2HpMod
  };
}

// 分發經驗值
function getSystemConfigNum(ss, key, defaultVal) {
  var val = getSystemConfig(ss, key);
  if (val === "") return defaultVal;
  var num = Number(val);
  return isNaN(num) ? defaultVal : num;
}

// 分發經驗值
function distributeBattleRewards(ss, p1Id, p2Id, winnerId) {
  var p1 = getPlayerRow(ss, p1Id);
  var p2 = getPlayerRow(ss, p2Id);

  if (!p1 || !p2) return;

  var expWin = getSystemConfigNum(ss, "exp_battle_win", 50);
  var expLose = getSystemConfigNum(ss, "exp_battle_lose", 20);
  var expDraw = getSystemConfigNum(ss, "exp_battle_draw", 30);

  var p1ExpGained = 15;
  var p2ExpGained = 15;

  if (winnerId === p1Id) {
    p1ExpGained = expWin; p2ExpGained = expLose;
  } else if (winnerId === p2Id) {
    p2ExpGained = expWin; p1ExpGained = expLose;
  } else if (winnerId === "DRAW") {
    p1ExpGained = expDraw; p2ExpGained = expDraw;
  }

  addExpAndCheckLevel(ss, p1, p1ExpGained);
  addExpAndCheckLevel(ss, p2, p2ExpGained);
}

function addExpAndCheckLevel(ss, player, expToAdd) {
  player.exp = (player.exp || 0) + expToAdd;
  var newLevel = getPlayerLevelByExp(ss, player.exp);
  if (newLevel > player.level) {
    player.level = newLevel;
  }
  updatePlayerRow(ss, player.rowNum, player);
}

// 領取 QR Code 卡牌
function claimQrCode(ss, playerId, token) {
  var qrSheet = ss.getSheetByName("qr_codes");
  var qData = qrSheet.getDataRange().getValues();
  var row = -1;
  var cardId = "";

  for (var i = 1; i < qData.length; i++) {
    if (qData[i][0] === token) {
      cardId = qData[i][2];
      if (qData[i][3] !== "active") {
        return { success: false, error: "此兌換代碼已使用或失效", card_id: cardId };
      }
      row = i + 1;
      break;
    }
  }

  if (row === -1) {
    return { success: false, error: "無效的領取憑證" };
  }

  var player = getPlayerRow(ss, playerId);
  if (!player) return { success: false, error: "玩家不存在" };

  var message = "";
  var expGained = 0;

  if (player.inventory[cardId]) {
    expGained = getSystemConfigNum(ss, "exp_qr_duplicate", 80);
    message = "領取成功！已擁有此卡牌 [" + getCardName(ss, cardId) + "]，自動轉換為 " + expGained + " 點氣血修煉值！";
    addExpAndCheckLevel(ss, player, expGained);
  } else {
    player.inventory[cardId] = 1;
    message = "領取成功！獲得卡牌: " + getCardName(ss, cardId);
    updatePlayerRow(ss, player.rowNum, player);
  }

  qrSheet.getRange(row, 4).setValue("claimed");
  qrSheet.getRange(row, 5).setValue(playerId);

  var freshPlayer = getPlayerRow(ss, playerId);
  delete freshPlayer.password;

  return { success: true, message: message, player: freshPlayer, card_id: cardId };
}

// 執行百子藥櫃任務
function startTask(ss, playerId, gridIndex) {
  var player = getPlayerRow(ss, playerId);
  if (!player) return { success: false, error: "玩家不存在" };

  var tasks = player.tasks_progress;
  gridIndex = String(gridIndex);

  if (!tasks[gridIndex]) {
    return { success: false, error: "無效的任務" };
  }

  if (tasks[gridIndex].status === "completed") {
    return { success: false, error: "此任務已通關完成！" };
  }

  if (tasks[gridIndex].status === "active") {
    // 防呆：確保在 active_tasks 中存在此筆 active 紀錄
    try {
      var activeTasksSheet = getOrCreateSheet(ss, "active_tasks", ["player_id", "grid_index", "password", "status", "created_at"]);
      if (activeTasksSheet) {
        var actData = activeTasksSheet.getDataRange().getValues();
        var actRow = -1;
        for (var i = 1; i < actData.length; i++) {
          if (actData[i][0] === playerId && Number(actData[i][1]) === Number(gridIndex)) {
            actRow = i + 1;
            break;
          }
        }
        if (actRow !== -1) {
          activeTasksSheet.getRange(actRow, 3).setValue(tasks[gridIndex].password);
          activeTasksSheet.getRange(actRow, 4).setValue("active");
        } else {
          activeTasksSheet.appendRow([playerId, Number(gridIndex), tasks[gridIndex].password, "active", String(new Date().getTime())]);
        }
      }
    } catch (e) {
      Logger.log("Fix active_tasks on active status error: " + e.toString());
    }
    return { success: true, password: tasks[gridIndex].password, tasks_progress: tasks };
  }

  var code = "TASK-" + gridIndex + "-" + Math.floor(Math.random() * 9000 + 1000);

  tasks[gridIndex].status = "active";
  tasks[gridIndex].password = code;

  player.tasks_progress = tasks;
  updatePlayerRow(ss, player.rowNum, player);

  // 同步寫入 active_tasks 工作表
  try {
    var activeTasksSheet = getOrCreateSheet(ss, "active_tasks", ["player_id", "grid_index", "password", "status", "created_at"]);
    if (activeTasksSheet) {
      var actData = activeTasksSheet.getDataRange().getValues();
      var actRow = -1;
      for (var i = 1; i < actData.length; i++) {
        if (actData[i][0] === playerId && Number(actData[i][1]) === Number(gridIndex)) {
          actRow = i + 1;
          break;
        }
      }
      if (actRow !== -1) {
        activeTasksSheet.getRange(actRow, 3).setValue(code); // password
        activeTasksSheet.getRange(actRow, 4).setValue("active");
        activeTasksSheet.getRange(actRow, 5).setValue(String(new Date().getTime()));
      } else {
        activeTasksSheet.appendRow([playerId, Number(gridIndex), code, "active", String(new Date().getTime())]);
      }
    }
  } catch (e) {
    Logger.log("Write active_tasks error: " + e.toString());
  }

  return { success: true, password: code, tasks_progress: tasks };
}

// 獲取 Sheets 中任務配對的獎勵
function getRewardCardFromSheets(ss, index) {
  var sheet = ss.getSheetByName("tasks_config");
  if (!sheet) return "";
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === Number(index)) {
      return String(data[i][3] || "");
    }
  }
  return "";
}

// 驗證百子藥櫃密碼
function claimTask(ss, playerId, gridIndex, password) {
  var player = getPlayerRow(ss, playerId);
  if (!player) return { success: false, error: "玩家不存在" };

  var tasks = player.tasks_progress;
  gridIndex = String(gridIndex);

  if (!tasks[gridIndex] || tasks[gridIndex].status !== "active") {
    return { success: false, error: "小挑戰未開啟" };
  }

  if (tasks[gridIndex].password !== password) {
    return { success: false, error: "通關口令錯誤，請向工作人員索取" };
  }

  tasks[gridIndex].status = "completed";
  tasks[gridIndex].completed = true;

  var expBase = getSystemConfigNum(ss, "exp_task_complete", 30);
  var expDup = getSystemConfigNum(ss, "exp_task_duplicate", 50);
  var expBingoLine = getSystemConfigNum(ss, "exp_bingo_line", 150);
  var expBingoDup = getSystemConfigNum(ss, "exp_bingo_duplicate", 50);

  var expReward = expBase;
  var rewardCardId = getRewardCardFromSheets(ss, Number(gridIndex));
  var rewardMessage = "完成小任務 #" + (Number(gridIndex) + 1) + " 挑戰！獲得 " + expBase + " 經驗！";

  if (rewardCardId) {
    if (player.inventory[rewardCardId]) {
      expReward += expDup;
      rewardMessage += " (重複獲得「" + getCardName(ss, rewardCardId) + "」，自動轉換為 " + expDup + " 經驗！)";
    } else {
      player.inventory[rewardCardId] = 1;
      rewardMessage += " (額外獲得卡牌「" + getCardName(ss, rewardCardId) + "」)";
    }
  }

  player.exp = (player.exp || 0) + expReward;

  var bingoLineCount = checkBingoLines(tasks);
  var oldBingoCount = tasks.bingo_count || 0;

  if (bingoLineCount > oldBingoCount) {
    var lineDiff = bingoLineCount - oldBingoCount;
    var lineExp = lineDiff * expBingoLine;
    var randomCard = getRandomCardId(ss);

    player.exp = (player.exp || 0) + lineExp;

    if (player.inventory[randomCard]) {
      player.exp = (player.exp || 0) + expBingoDup;
      rewardMessage += "【🎉 任務連線成功 " + lineDiff + " 條！】再獲得 " + lineExp + " 經驗，連線獎品已轉為 " + expBingoDup + " 經驗！";
    } else {
      player.inventory[randomCard] = 1;
      rewardMessage += "【🎉 任務連線成功 " + lineDiff + " 條！】再獲得 " + lineExp + " 經驗與隨機珍稀卡牌「" + getCardName(ss, randomCard) + "」！";
    }
    tasks.bingo_count = bingoLineCount;
  }

  var newLevel = getPlayerLevelByExp(ss, player.exp);
  if (newLevel > player.level) {
    player.level = newLevel;
  }

  player.tasks_progress = tasks;
  updatePlayerRow(ss, player.rowNum, player);

  // 同步更新 active_tasks 工作表
  try {
    var activeTasksSheet = getOrCreateSheet(ss, "active_tasks", ["player_id", "grid_index", "password", "status", "created_at"]);
    if (activeTasksSheet) {
      var actData = activeTasksSheet.getDataRange().getValues();
      for (var i = 1; i < actData.length; i++) {
        if (actData[i][0] === playerId && Number(actData[i][1]) === Number(gridIndex)) {
          activeTasksSheet.getRange(i + 1, 4).setValue("completed");
          break;
        }
      }
    }
  } catch (e) {
    Logger.log("Update active_tasks status error: " + e.toString());
  }

  delete player.password;
  return { success: true, message: rewardMessage, player: player };
}

function checkBingoLines(tasks) {
  var grid = [];
  for (var i = 0; i < 16; i++) {
    grid.push(tasks[String(i)]?.status === "completed");
  }

  var lines = 0;
  for (var r = 0; r < 4; r++) {
    if (grid[r * 4] && grid[r * 4 + 1] && grid[r * 4 + 2] && grid[r * 4 + 3]) lines++;
  }
  for (var c = 0; c < 4; c++) {
    if (grid[c] && grid[4 + c] && grid[8 + c] && grid[12 + c]) lines++;
  }
  if (grid[0] && grid[5] && grid[10] && grid[15]) lines++;
  if (grid[3] && grid[6] && grid[9] && grid[12]) lines++;

  return lines;
}

// 隨機獲取卡牌 ID
function getRandomCardId(ss) {
  var dict = getCardsDict(ss);
  var cards = Object.keys(dict);
  var idx = Math.floor(Math.random() * cards.length);
  return cards[idx];
}

// 管理員生成 QR Code
function adminGenerateQr(ss, adminId, cardId) {
  var admin = getPlayerRow(ss, adminId);
  if (!admin) return { success: false, error: "管理員不存在" };

  var isGameAdmin = admin.role === "game_admin";
  var isNormalAdmin = admin.role === "admin";

  if (!isGameAdmin && !isNormalAdmin) {
    return { success: false, error: "無管理權限" };
  }

  if (isGameAdmin) {
    var quotaSheet = ss.getSheetByName("admin_quotas");
    var qData = quotaSheet.getDataRange().getValues();
    var quotaRow = -1;
    var quotaVal = 0;
    var isUnlimited = false;
    var hasAnyQuotaRecord = false;

    for (var i = 1; i < qData.length; i++) {
      if (qData[i][0] === adminId) {
        hasAnyQuotaRecord = true;
        if (qData[i][1] === cardId) {
          quotaRow = i + 1;
          var rawVal = qData[i][2];
          if (rawVal === "無限" || rawVal === "unlimited" || Number(rawVal) === -1) {
            isUnlimited = true;
          } else {
            quotaVal = Number(rawVal);
          }
          break;
        }
      }
    }

    // 如果該管理員在配額表中沒有任何設定，視為無上限配額
    if (!hasAnyQuotaRecord) {
      isUnlimited = true;
    }

    if (!isUnlimited) {
      if (quotaRow === -1 || quotaVal <= 0) {
        return { success: false, error: "您無此卡片的分配額度或配額已用盡！" };
      }
      quotaSheet.getRange(quotaRow, 3).setValue(quotaVal - 1);
    }
  }

  var token = "QR_" + new Date().getTime() + "_" + Math.floor(Math.random() * 10000);
  var qrSheet = ss.getSheetByName("qr_codes");
  qrSheet.appendRow([token, adminId, cardId, "active", "", String(new Date().getTime())]);

  return { success: true, token: token, card_id: cardId, card_name: getCardName(ss, cardId) };
}

// 管理員獲取所有正在進行的任務
function adminGetTasks(ss, adminId) {
  var admin = getPlayerRow(ss, adminId);
  if (!admin || (admin.role !== "admin" && admin.role !== "game_admin")) {
    return { success: false, error: "權限不足" };
  }

  var activeTasksSheet = ss.getSheetByName("active_tasks");
  if (!activeTasksSheet) return { success: true, player_tasks: [] };
  var actData = activeTasksSheet.getDataRange().getValues();

  var playersSheet = ss.getSheetByName("players");
  var pData = playersSheet.getDataRange().getValues();
  var playerMap = {};
  for (var i = 1; i < pData.length; i++) {
    playerMap[pData[i][0]] = pData[i][2]; // id -> name
  }

  var grouped = {};
  for (var j = 1; j < actData.length; j++) {
    var pId = String(actData[j][0]);
    var gIdx = Number(actData[j][1]);
    var pwd = String(actData[j][2]);
    var status = String(actData[j][3]).toLowerCase();

    if (status === "active") {
      if (!grouped[pId]) {
        grouped[pId] = [];
      }
      grouped[pId].push({
        grid_index: gIdx,
        password: pwd
      });
    }
  }

  var playerTasks = [];
  for (var pId in grouped) {
    playerTasks.push({
      username: pId,
      nickname: playerMap[pId] || pId,
      tasks: grouped[pId]
    });
  }

  return { success: true, player_tasks: playerTasks };
}

// 獲取管理員發卡額度
function adminGetQuotas(ss, adminId) {
  var admin = getPlayerRow(ss, adminId);
  if (!admin) return { success: false, error: "無效工作人員" };

  var cardsDict = getCardsDict(ss);

  if (admin.role === "admin") {
    var quotas = [];
    for (var cid in cardsDict) {
      quotas.push({
        card_id: cid,
        card_name: cardsDict[cid].name,
        quota: "無限"
      });
    }
    return { success: true, quotas: quotas, is_unlimited: true };
  }

  var quotaSheet = ss.getSheetByName("admin_quotas");
  var qData = quotaSheet.getDataRange().getValues();
  var list = [];

  for (var i = 1; i < qData.length; i++) {
    if (qData[i][0] === adminId) {
      var cid = qData[i][1];
      var rawVal = qData[i][2];
      var qVal = (rawVal === "無限" || rawVal === "unlimited" || Number(rawVal) === -1) ? "無限" : Number(rawVal);
      list.push({
        card_id: cid,
        card_name: getCardName(ss, cid),
        quota: qVal
      });
    }
  }

  if (list.length === 0) {
    for (var cid in cardsDict) {
      list.push({
        card_id: cid,
        card_name: cardsDict[cid].name,
        quota: "無限"
      });
    }
    return { success: true, quotas: list, is_unlimited: true };
  }

  return { success: true, quotas: list, is_unlimited: false };
}

// 遊戲管理員切換登入功能開關
function gameAdminToggleLogin(ss, adminId, enabled) {
  var admin = getPlayerRow(ss, adminId);
  if (!admin || admin.role !== "admin") {
    return { success: false, error: "僅限管理員操作" };
  }

  setSystemConfig(ss, "game_enabled", enabled ? "true" : "false");

  // 如果系統被關閉 (enabled === false)，強制踢出所有弟子，並清除進行中的戰鬥、邀請與任務
  if (!enabled) {
    clearActiveRecordsAndTasks(ss);
  }

  return { success: true, game_enabled: enabled };
}

// 輔助函數：清除所有進行中紀錄、戰鬥、邀請、小任務，並重置所有普通玩家進行中任務為 available
function clearActiveRecordsAndTasks(ss) {
  // 1. 強制所有非管理員玩家登出 (寫入新的強踢時間戳記)
  setSystemConfig(ss, "force_logout_time", String(new Date().getTime()));

  // 2. 強制終止並清除所有戰鬥數據
  var battlesSheet = ss.getSheetByName("battles");
  if (battlesSheet) {
    var lastRow = battlesSheet.getLastRow();
    if (lastRow > 1) {
      battlesSheet.deleteRows(2, lastRow - 1);
    }
  }

  // 3. 清空邀請表
  var invSheet = ss.getSheetByName("invitations");
  if (invSheet) {
    var invLastRow = invSheet.getLastRow();
    if (invLastRow > 1) {
      invSheet.deleteRows(2, invLastRow - 1);
    }
  }

  // 4. 清空進行中任務表
  var activeTasksSheet = ss.getSheetByName("active_tasks");
  if (activeTasksSheet) {
    var actLastRow = activeTasksSheet.getLastRow();
    if (actLastRow > 1) {
      activeTasksSheet.deleteRows(2, actLastRow - 1);
    }
  }

  // 5. 清除所有玩家進行中的任務進度 (將 tasks_progress 中狀態為 "active" 的任務改為 "available")
  var playersSheet = ss.getSheetByName("players");
  if (playersSheet) {
    var playersData = playersSheet.getDataRange().getValues();
    for (var i = 1; i < playersData.length; i++) {
      var role = playersData[i][3];
      if (role === "player") {
        var progressJson = playersData[i][14] || "{}";
        try {
          var progress = JSON.parse(progressJson);
          var changed = false;
          for (var key in progress) {
            if (progress[key] && progress[key].status === "active") {
              progress[key].status = "available";
              delete progress[key].password;
              changed = true;
            }
          }
          if (changed) {
            playersSheet.getRange(i + 1, 15).setValue(JSON.stringify(progress));
          }
        } catch (e) {
          Logger.log("Reset player tasks_progress error at row " + (i + 1) + ": " + e.toString());
        }
      }
    }
  }
}


// 遊戲管理員更新玩家狀態
function gameAdminUpdatePlayer(ss, adminId, targetPlayerId, fields) {
  var admin = getPlayerRow(ss, adminId);
  if (!admin || admin.role !== "admin") {
    return { success: false, error: "僅限管理員操作" };
  }

  var target = getPlayerRow(ss, targetPlayerId);
  if (!target) return { success: false, error: "找不到目標玩家" };

  // 支援全能覆寫
  if (fields.targetPlayerObj) {
    var updatedObj = fields.targetPlayerObj;
    updatedObj.rowNum = target.rowNum; // 鎖定行號
    updatePlayerRow(ss, target.rowNum, updatedObj);
    return { success: true, player: updatedObj };
  }

  if (fields.name !== undefined) target.name = fields.name;
  if (fields.password !== undefined) target.password = fields.password;
  if (fields.role !== undefined) target.role = fields.role;
  if (fields.level !== undefined) target.level = Number(fields.level);
  if (fields.exp !== undefined) target.exp = Number(fields.exp);

  if (fields.give_card_id) {
    var cid = fields.give_card_id;
    target.inventory[cid] = (target.inventory[cid] || 0) + 1;
  }

  if (fields.quota_card_id && fields.quota_val !== undefined) {
    var quotaSheet = ss.getSheetByName("admin_quotas");
    var qData = quotaSheet.getDataRange().getValues();
    var qRow = -1;
    for (var i = 1; i < qData.length; i++) {
      if (qData[i][0] === targetPlayerId && qData[i][1] === fields.quota_card_id) {
        qRow = i + 1;
        break;
      }
    }
    if (qRow !== -1) {
      quotaSheet.getRange(qRow, 3).setValue(Number(fields.quota_val));
    } else {
      quotaSheet.appendRow([targetPlayerId, fields.quota_card_id, Number(fields.quota_val)]);
    }
  }

  updatePlayerRow(ss, target.rowNum, target);
  return { success: true, player: target };
}

// 獲取卡片名稱
function getCardName(ss, id) {
  var dict = getCardsDict(ss);
  return dict[id] ? dict[id].name : id;
}

// 總開關：重置系統，強制踢出普通弟子，刪除進行中戰鬥
function gameAdminResetSystem(ss, adminId) {
  var admin = getPlayerRow(ss, adminId);
  if (!admin || admin.role !== "admin") {
    return { success: false, error: "僅限管理員操作" };
  }

  clearActiveRecordsAndTasks(ss);

  return { success: true, message: "💥 成功！管理員總開關已被啟動，所有在線玩家已強制退房，進行中對決與任務已清空。" };
}

// 大掌櫃設定六項 XP 配置
function gameAdminSetSystemConfigs(ss, adminId, configs) {
  var admin = getPlayerRow(ss, adminId);
  if (!admin || admin.role !== "admin") {
    return { success: false, error: "僅限管理員操作" };
  }

  for (var key in configs) {
    setSystemConfig(ss, key, String(configs[key]));
  }

  return { success: true, message: "⚙️ 經驗值與系統配置已更新成功！" };
}
