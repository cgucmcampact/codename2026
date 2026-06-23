// 百草醫館 - 藥物敷貼、針灸與中藥靜態資料庫
export let CARDS = {
  // 裝備卡 (Equipment) - 穴位針灸與藥貼 (進入戰鬥前確認影響)
  equip_head_01: {
    id: "equip_head_01",
    name: "太陽穴金針",
    type: "equipment",
    sub_type: "head",
    element: "金",
    rarity: "綠色",
    atk_mod: 10,
    def_mod: 5,
    description: "金針刺入雙側太陽穴，激發衛氣潛能，使內功與衛氣均衡提升。",
    image_url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300&auto=format&fit=crop"
  },
  equip_head_02: {
    id: "equip_head_02",
    name: "百會玉衡冠",
    type: "equipment",
    sub_type: "head",
    element: "水",
    rarity: "紫色",
    atk_mod: 2,
    def_mod: 20,
    description: "按壓百會穴的玉石發冠，安神定志，大幅度強化衛氣防護力。",
    image_url: "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=300&auto=format&fit=crop"
  },
  equip_head_03: {
    id: "equip_head_03",
    name: "神庭烈焰針",
    type: "equipment",
    sub_type: "head",
    element: "火",
    rarity: "綠色",
    atk_mod: 18,
    def_mod: 0,
    description: "火針刺激神庭穴，溫通督脈，使內功輸出大幅上升。",
    image_url: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=300&auto=format&fit=crop"
  },
  equip_body_01: {
    id: "equip_body_01",
    name: "天樞厚土甲",
    type: "equipment",
    sub_type: "body",
    element: "土",
    rarity: "綠色",
    atk_mod: -5,
    def_mod: 40,
    description: "於神闕與雙側天樞穴敷貼大黃、芒硝等重鎮藥膏，使身體防禦固若金湯。",
    image_url: "https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=300&auto=format&fit=crop"
  },
  equip_body_02: {
    id: "equip_body_02",
    name: "神闕艾灸護甲",
    type: "equipment",
    sub_type: "body",
    element: "火",
    rarity: "紅色",
    atk_mod: 10,
    def_mod: 15,
    description: "持續艾灸神闕穴（臍部），溫陽救逆，行氣活血，攻防兼備。",
    image_url: "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=300&auto=format&fit=crop"
  },
  equip_body_03: {
    id: "equip_body_03",
    name: "膻中氣海袍",
    type: "equipment",
    sub_type: "body",
    element: "木",
    rarity: "綠色",
    atk_mod: 5,
    def_mod: 22,
    description: "輕柔的絲綢道袍，內襯保護膻中與氣海穴的藥墊，調和一身之氣。",
    image_url: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=300&auto=format&fit=crop"
  },
  equip_hands_01: {
    id: "equip_hands_01",
    name: "合谷雷火灸",
    type: "equipment",
    sub_type: "hands",
    element: "火",
    rarity: "綠色",
    atk_mod: 20,
    def_mod: 5,
    description: "手握點燃的雷火大艾條灸合谷穴，激發雙手爆發力，攻擊力十足。",
    image_url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&auto=format&fit=crop"
  },
  equip_hands_02: {
    id: "equip_hands_02",
    name: "內關青藤腕",
    type: "equipment",
    sub_type: "hands",
    element: "木",
    rarity: "綠色",
    atk_mod: 10,
    def_mod: 12,
    description: "寬筋藤編織腕帶按壓內關穴，寧心安神、理氣止痛，攻守相濟。",
    image_url: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=300&auto=format&fit=crop"
  },
  equip_hands_03: {
    id: "equip_hands_03",
    name: "勞宮暗影針",
    type: "equipment",
    sub_type: "hands",
    element: "金",
    rarity: "金色",
    atk_mod: 28,
    def_mod: -5,
    description: "刺入勞宮穴的隱密短針，宣洩心火，出招快狠，但防禦略降。",
    image_url: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=300&auto=format&fit=crop"
  },
  equip_feet_01: {
    id: "equip_feet_01",
    name: "湧泉硃砂履",
    type: "equipment",
    sub_type: "feet",
    element: "火",
    rarity: "綠色",
    atk_mod: 12,
    def_mod: 8,
    description: "鞋底內襯硃砂貼湧泉穴，引火下行，步伐沉穩有力且帶有火熱藥勁。",
    image_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop"
  },
  equip_feet_02: {
    id: "equip_feet_02",
    name: "足三里飛針",
    type: "equipment",
    sub_type: "feet",
    element: "土",
    rarity: "藍色",
    atk_mod: 5,
    def_mod: 15,
    description: "銀針輕刺足三里，激發胃經之氣，身輕如燕，行動極為迅捷靈活。",
    image_url: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=300&auto=format&fit=crop"
  },
  equip_feet_03: {
    id: "equip_feet_03",
    name: "太衝水晶鞋",
    type: "equipment",
    sub_type: "feet",
    element: "木",
    rarity: "綠色",
    atk_mod: 0,
    def_mod: 20,
    description: "按摩太衝穴的硬底鞋，疏肝理氣，步伐穩健如山，大補防護力。",
    image_url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=300&auto=format&fit=crop"
  },
  equip_sub_01: {
    id: "equip_sub_01",
    name: "香薷防疫香包",
    type: "equipment",
    sub_type: "sub",
    element: "水",
    rarity: "綠色",
    atk_mod: 5,
    def_mod: 5,
    description: "裝有香薷、蒼朮、白芷的香包，辟穢解毒，提升微幅攻防氣場。",
    image_url: "https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=300&auto=format&fit=crop"
  },
  equip_sub_02: {
    id: "equip_sub_02",
    name: "萬歌硃砂葫蘆",
    type: "equipment",
    sub_type: "sub",
    element: "火",
    rarity: "綠色",
    atk_mod: 15,
    def_mod: 0,
    description: "裝滿辟邪硃砂的銅葫蘆，鎮驚安神，激發仙獸戰意。",
    image_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop"
  },
  equip_sub_03: {
    id: "equip_sub_03",
    name: "八卦太極鏡",
    type: "equipment",
    sub_type: "sub",
    element: "金",
    rarity: "綠色",
    atk_mod: 0,
    def_mod: 15,
    description: "黃銅太極鏡，反射邪氣，在身周張開護體金光。",
    image_url: "https://images.unsplash.com/photo-1590073844006-33379778ae09?w=300&auto=format&fit=crop"
  },
  equip_sub_04: {
    id: "equip_sub_04",
    name: "川烏拔毒膏",
    type: "equipment",
    sub_type: "sub",
    element: "木",
    rarity: "綠色",
    atk_mod: 8,
    def_mod: 2,
    description: "劇毒川烏製成的敷貼膏藥，以毒攻毒，帶有微弱的營血吸取加護。",
    image_url: "https://images.unsplash.com/photo-1512290901887-3ceee1a5f4e4?w=300&auto=format&fit=crop"
  },

  // 技能卡 (Skills) - 藥方與針法 (對戰出牌)
  skill_card_01: {
    id: "skill_card_01",
    name: "人參生脈飲",
    type: "skill",
    element: "木",
    rarity: "藍色",
    description: "服下人參、麥冬、五味子熬製的生脈飲，益氣復脈，為自身恢復 30 點營血。",
    image_url: "https://images.unsplash.com/photo-1563483783225-bc53b27b703e?w=300&auto=format&fit=crop",
    // 觸發條件
    self_atk: "", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    // 效果影響
    target: "self",
    atk_aft: 0,
    def_aft: 0,
    hp_aft: 30
  },
  skill_card_02: {
    id: "skill_card_02",
    name: "附子大熱劑",
    type: "skill",
    element: "火",
    rarity: "紅色",
    description: "使用大熱大毒的附子湯劑，回陽救逆，直接灼燒對手衛氣，造成 25 點無視防禦的衛氣傷害。",
    image_url: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=300&auto=format&fit=crop",
    self_atk: "", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "opponent",
    atk_aft: 0,
    def_aft: 0,
    hp_aft: -25
  },
  skill_card_03: {
    id: "skill_card_03",
    name: "石膏清涼散",
    type: "skill",
    element: "水",
    rarity: "藍色",
    description: "降火聖藥生石膏熬製清涼散，清熱瀉火，為自身增加 25 點衛氣防護力。",
    image_url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop",
    self_atk: "", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "self",
    atk_aft: 0,
    def_aft: 25,
    hp_aft: 0
  },
  skill_card_04: {
    id: "skill_card_04",
    name: "麻黃宣肺湯",
    type: "skill",
    element: "火",
    rarity: "紫色",
    description: "服下麻黃宣肺湯，宣肺發汗。限自身現存內功小於等於 25 時觸發，使內功增加 20 點且衛氣減少 10 點。",
    image_url: "https://images.unsplash.com/photo-1547592180-85f173990554?w=300&auto=format&fit=crop",
    self_atk: "<=25", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "self",
    atk_aft: 20,
    def_aft: -10,
    hp_aft: 0
  },
  skill_card_05: {
    id: "skill_card_05",
    name: "斷腸五毒膏",
    type: "skill",
    element: "土",
    rarity: "藍色",
    description: "調配斷腸草與五毒製成毒膏，使對手營血扣減 15 點，且衛氣降低 15 點。",
    image_url: "https://images.unsplash.com/photo-1508847154043-be12a927dfa1?w=300&auto=format&fit=crop",
    self_atk: "", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "opponent",
    atk_aft: 0,
    def_aft: -15, // 備註: 技能降低對手防禦在後台特判或直接作用
    hp_aft: -15
  },
  skill_card_06: {
    id: "skill_card_06",
    name: "甘草調和湯",
    type: "skill",
    element: "土",
    rarity: "藍色",
    description: "利用國老甘草調和百藥，為自身回復 15 點營血與 15 點衛氣。",
    image_url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=300&auto=format&fit=crop",
    self_atk: "", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "self",
    atk_aft: 0,
    def_aft: 15,
    hp_aft: 15
  },
  skill_card_07: {
    id: "skill_card_07",
    name: "雷公藤破壞散",
    type: "skill",
    element: "木",
    rarity: "金色",
    description: "使用極毒雷公藤，限自身現存內功大於 15 時觸發，對手扣除 35 營血，但自身受到 10 點反噬。",
    image_url: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=300&auto=format&fit=crop",
    self_atk: ">15", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "opponent",
    atk_aft: 0,
    def_aft: 0,
    hp_aft: -35
  },
  skill_card_08: {
    id: "skill_card_08",
    name: "細辛通陽鎧",
    type: "skill",
    element: "金",
    rarity: "紫色",
    description: "細辛通陽，限對方現存內功大於 10 時觸發，衛氣增加 30 點並對對手反震 5 點傷害。",
    image_url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=300&auto=format&fit=crop",
    self_atk: "", self_def: "", ops_atk: ">10", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "self",
    atk_aft: 0,
    def_aft: 30,
    hp_aft: 0
  },
  skill_card_09: {
    id: "skill_card_09",
    name: "黃連解毒湯",
    type: "skill",
    element: "金",
    rarity: "綠色",
    description: "大苦大寒黃連解毒湯，降低對手衛氣 20 點，且對手本回合內功降低 20 點。",
    image_url: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?w=300&auto=format&fit=crop",
    self_atk: "", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "opponent",
    atk_aft: -20, // 降低我方? 這會作用於對手，在後台將效果對齊對象
    def_aft: -20,
    hp_aft: 0
  },
  skill_card_10: {
    id: "skill_card_10",
    name: "靈芝補氣吸精",
    type: "skill",
    element: "木",
    rarity: "紅色",
    description: "吸取對手元氣，自身回復 15 營血，對手扣除 15 營血值。",
    image_url: "https://images.unsplash.com/photo-1583088580009-2d947c376666?w=300&auto=format&fit=crop",
    self_atk: "", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "opponent",
    atk_aft: 0,
    def_aft: 0,
    hp_aft: -15
  },
  skill_card_11: {
    id: "skill_card_11",
    name: "大黃瀉火膏",
    type: "skill",
    element: "水",
    rarity: "綠色",
    description: "使用將軍大黃，釜底抽薪，使對手衛氣大幅降低 30 點。",
    image_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop",
    self_atk: "", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "opponent",
    atk_aft: 0,
    def_aft: -30,
    hp_aft: 0
  },
  skill_card_12: {
    id: "skill_card_12",
    name: "神速奪命刺",
    type: "skill",
    element: "金",
    rarity: "金色",
    description: "限自己另一張卡牌的特性等於「金」時觸發，對手扣除 15 營血，且自身內功增加 15 點。",
    image_url: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=300&auto=format&fit=crop",
    self_atk: "", self_def: "", ops_atk: "", ops_def: "",
    self_othr_atk: "", self_othr_def: "", self_othr_ele: "=金",
    ops_any_atk: "", ops_any_def: "", ops_any_ele: "",
    target: "opponent",
    atk_aft: 15,
    def_aft: 0,
    hp_aft: -15
  }
};

// 計算玩家總屬性 (等級決定基礎生命，裝備決定加成)
export const calculateStats = (player, levelConfig = null) => {
  const level = player.level || 1;
  const baseHp = 100 + (level - 1) * 15;
  
  let bonusAtk = 0;
  let bonusDef = 0;
  
  // 計算裝備
  const slots = ['head', 'body', 'hands', 'feet', 'sub1', 'sub2'];
  slots.forEach(slot => {
    const cardId = player.equipped?.[slot];
    if (cardId && CARDS[cardId]) {
      bonusAtk += CARDS[cardId].atk_mod || 0;
      bonusDef += CARDS[cardId].def_mod || 0;
    }
  });
  
  return {
    level,
    exp: player.exp || 0,
    maxHp: baseHp,
    atk: Math.max(0, 10 + bonusAtk),
    def: Math.max(0, 5 + bonusDef)
  };
};

// 等級與經驗值轉換
export const getLevelFromExp = (exp) => {
  return Math.floor((exp || 0) / 100) + 1;
};

// 取得升級所需總經驗
export const getExpNeededForNextLevel = (level) => {
  return level * 100;
};

// 從 Google Sheets 自訂資料更新卡牌庫
export const updateCardsFromSheets = (customCardsList) => {
  if (!customCardsList || !Array.isArray(customCardsList)) return;
  customCardsList.forEach(card => {
    if (card && card.id) {
      CARDS[card.id] = {
        id: card.id,
        name: card.name,
        type: card.type,
        sub_type: card.sub_type,
        element: card.element || "",
        rarity: card.rarity || "",
        description: card.description || "",
        image_url: card.image_url || "",
        atk_mod: Number(card.atk_mod) || 0,
        def_mod: Number(card.def_mod) || 0,
        // 觸發條件
        self_atk: card.self_atk || "",
        self_def: card.self_def || "",
        ops_atk: card.ops_atk || "",
        ops_def: card.ops_def || "",
        self_othr_atk: card.self_othr_atk || "",
        self_othr_def: card.self_othr_def || "",
        self_othr_ele: card.self_othr_ele || "",
        ops_any_atk: card.ops_any_atk || "",
        ops_any_def: card.ops_any_def || "",
        ops_any_ele: card.ops_any_ele || "",
        // 效果影響
        target: card.target || "self",
        atk_aft: Number(card.atk_aft) || 0,
        def_aft: Number(card.def_aft) || 0,
        hp_aft: Number(card.hp_aft) || 0
      };
    }
  });
};

export function checkCondition(value, condStr) {
  if (!condStr) return true;
  const str = String(condStr).trim();
  if (str === "" || str === "無條件" || str === "無") return true;

  if (str.startsWith(">=")) {
    return Number(value) >= parseFloat(str.substring(2));
  }
  if (str.startsWith("<=")) {
    return Number(value) <= parseFloat(str.substring(2));
  }
  if (str.startsWith(">")) {
    return Number(value) > parseFloat(str.substring(1));
  }
  if (str.startsWith("<")) {
    return Number(value) < parseFloat(str.substring(1));
  }
  if (str.startsWith("==")) {
    const target = str.substring(2).trim();
    return isNaN(target) ? String(value) === target : Number(value) === parseFloat(target);
  }
  if (str.startsWith("=")) {
    const target = str.substring(1).trim();
    return isNaN(target) ? String(value) === target : Number(value) === parseFloat(target);
  }
  return isNaN(str) ? String(value) === str : Number(value) === parseFloat(str);
}

export function evaluateCardTrigger(card, selfStats, opsStats, otherCard, opsCards) {
  if (!card) return false;

  // 1. self_atk
  if (card.self_atk && !checkCondition(selfStats.atk, card.self_atk)) return false;
  // 2. self_def
  if (card.self_def && !checkCondition(selfStats.def, card.self_def)) return false;
  // 3. ops_atk
  if (card.ops_atk && !checkCondition(opsStats.atk, card.ops_atk)) return false;
  // 4. ops_def
  if (card.ops_def && !checkCondition(opsStats.def, card.ops_def)) return false;

  // 5. self_othr_atk
  if (card.self_othr_atk) {
    if (!otherCard) return false;
    if (!checkCondition(otherCard.atk_aft || 0, card.self_othr_atk)) return false;
  }
  // 6. self_othr_def
  if (card.self_othr_def) {
    if (!otherCard) return false;
    if (!checkCondition(otherCard.def_aft || 0, card.self_othr_def)) return false;
  }
  // 7. self_othr_ele
  if (card.self_othr_ele) {
    if (!otherCard) return false;
    if (!checkCondition(otherCard.element || "", card.self_othr_ele)) return false;
  }

  // 8. ops_any_atk
  if (card.ops_any_atk) {
    if (!opsCards || opsCards.length === 0) return false;
    const match = opsCards.some(oc => checkCondition(oc.atk_aft || 0, card.ops_any_atk));
    if (!match) return false;
  }
  // 9. ops_any_def
  if (card.ops_any_def) {
    if (!opsCards || opsCards.length === 0) return false;
    const match = opsCards.some(oc => checkCondition(oc.def_aft || 0, card.ops_any_def));
    if (!match) return false;
  }
  // 10. ops_any_ele
  if (card.ops_any_ele) {
    if (!opsCards || opsCards.length === 0) return false;
    const match = opsCards.some(oc => checkCondition(oc.element || "", card.ops_any_ele));
    if (!match) return false;
  }

  return true;
}

export function calculateRoundEffects(p1Cards, p2Cards, p1Stats, p2Stats) {
  const p1TriggerStates = [];
  const p2TriggerStates = [];

  // P1 判定
  for (let i = 0; i < p1Cards.length; i++) {
    const card = p1Cards[i];
    const otherCard = p1Cards.length > 1 ? p1Cards[1 - i] : null;
    const isTriggered = evaluateCardTrigger(card, p1Stats, p2Stats, otherCard, p2Cards);
    p1TriggerStates.push(isTriggered);
  }

  // P2 判定
  for (let j = 0; j < p2Cards.length; j++) {
    const card = p2Cards[j];
    const otherCard = p2Cards.length > 1 ? p2Cards[1 - j] : null;
    const isTriggered = evaluateCardTrigger(card, p2Stats, p1Stats, otherCard, p1Cards);
    p2TriggerStates.push(isTriggered);
  }

  let p1AtkMod = 0, p1DefMod = 0, p1HpMod = 0;
  let p2AtkMod = 0, p2DefMod = 0, p2HpMod = 0;

  function applyEffect(cid, card, isP1) {
    let selfAtk = 0, selfDef = 0, selfHp = 0;
    let oppAtk = 0, oppDef = 0, oppHp = 0;

    // 內建 12 張特殊處理
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
      // 通用自訂卡
      const t = card.target || "self";
      const aa = card.atk_aft || 0;
      const da = card.def_aft || 0;
      const ha = card.hp_aft || 0;

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

  // 套用 P1 的觸發效果
  for (let i = 0; i < p1Cards.length; i++) {
    if (p1TriggerStates[i]) {
      applyEffect(p1Cards[i].id, p1Cards[i], true);
    }
  }

  // 套用 P2 的觸發效果
  for (let j = 0; j < p2Cards.length; j++) {
    if (p2TriggerStates[j]) {
      applyEffect(p2Cards[j].id, p2Cards[j], false);
    }
  }

  return {
    p1TriggerStates,
    p2TriggerStates,
    p1AtkMod,
    p1DefMod,
    p1HpMod,
    p2AtkMod,
    p2DefMod,
    p2HpMod
  };
}

export const RARITY_COLORS = {
  "綠色": { border: "border-emerald-950/60 hover:border-emerald-600/40", text: "text-emerald-400", bg: "bg-emerald-950/10", shadow: "shadow-emerald-900/5", glow: "border-emerald-500/20 shadow-emerald-500/10" },
  "藍色": { border: "border-blue-950/60 hover:border-blue-600/40", text: "text-blue-400", bg: "bg-blue-950/10", shadow: "shadow-blue-900/5", glow: "border-blue-500/20 shadow-blue-500/10" },
  "紅色": { border: "border-rose-950/60 hover:border-rose-600/40", text: "text-rose-400", bg: "bg-rose-955/10", shadow: "shadow-rose-900/5", glow: "border-rose-500/20 shadow-rose-500/10" },
  "紫色": { border: "border-purple-950/60 hover:border-purple-600/40", text: "text-purple-400", bg: "bg-purple-950/10", shadow: "shadow-purple-900/5", glow: "border-purple-500/20 shadow-purple-500/10" },
  "金色": { border: "border-amber-700/40 hover:border-amber-500/50", text: "text-amber-400", bg: "bg-amber-950/10", shadow: "shadow-amber-900/15", glow: "border-amber-500/35 shadow-amber-500/20" }
};

