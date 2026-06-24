import { CARDS, updateCardsFromSheets, calculateRoundEffects } from './cardData';

// BroadcastChannel 用於本地多視窗同步
let localChannel = null;
try {
  localChannel = new BroadcastChannel('spirit_arena_local_channel');
} catch (e) {
  console.warn('BroadcastChannel not supported in this environment', e);
}

export function registerBroadcastListener(callback) {
  if (localChannel) {
    const handler = (e) => callback(e.data);
    localChannel.addEventListener('message', handler);
    return () => localChannel.removeEventListener('message', handler);
  }
  return () => {};
}

export function postLocalBroadcast(data) {
  if (localChannel) {
    localChannel.postMessage(data);
  }
}

export function getApiMode() {
  const gasUrl = import.meta.env.VITE_GAS_URL || '';
  return gasUrl ? 'cloud' : 'local';
}

export function setApiMode(mode) {
  // 模式現在直接依據環境變數決定，不允許手動修改
}

// 中醫百草任務本地預設配置
const DEFAULT_TASKS_CONFIG = [
  { grid_index: 0, name: '當歸', description: '辨識當歸切片，完成當歸補血湯配藥。', reward_card_id: 'skill_card_01' },
  { grid_index: 1, name: '黃耆', description: '體驗百草醫館黃耆煎藥，學習溫補脾胃衛氣。', reward_card_id: '' },
  { grid_index: 2, name: '甘草', description: '調和諸藥！在人體衛氣模型上尋找甘草所對應的脾經穴位。', reward_card_id: 'skill_card_03' },
  { grid_index: 3, name: '人參', description: '大補元氣！完成人參切片與生脈飲的沖泡。', reward_card_id: '' },
  { grid_index: 4, name: '川芎', description: '活血行氣！辨識川芎外觀與其氣味特色。', reward_card_id: 'equip_head_02' },
  { grid_index: 5, name: '白芍', description: '柔肝止痛！製作一劑白芍與甘草的調和藥包。', reward_card_id: '' },
  { grid_index: 6, name: '熟地', description: '滋陰補血！觀察九蒸九曬熟地黃的製作過程。', reward_card_id: 'skill_card_05' },
  { grid_index: 7, name: '柴胡', description: '疏肝解熱！完成柴胡葛根湯的調配。', reward_card_id: '' },
  { grid_index: 8, name: '半夏', description: '燥濕化痰！學習法半夏與生半夏的炮製區別。', reward_card_id: 'equip_body_03' },
  { grid_index: 9, name: '茯苓', description: '利水滲濕！辨別茯苓塊與茯苓片的差別。', reward_card_id: '' },
  { grid_index: 10, name: '陳皮', description: '理氣健脾！體驗百草堂三年老陳皮的泡茶修煉。', reward_card_id: 'skill_card_08' },
  { grid_index: 11, name: '白朮', description: '健脾益氣！完成白朮與山藥的藥膳配製。', reward_card_id: '' },
  { grid_index: 12, name: '枸杞', description: '滋補肝腎，明目！完成枸杞與菊花茶的搭配。', reward_card_id: 'equip_hands_03' },
  { grid_index: 13, name: '杜仲', description: '補肝腎，強筋骨！學習杜仲折斷時的絲絡辨識。', reward_card_id: '' },
  { grid_index: 14, name: '砂仁', description: '化濕開胃，溫脾止瀉！體驗砂仁研碎時的芳香。', reward_card_id: 'skill_card_10' },
  { grid_index: 15, name: '麥冬', description: '養陰生津，潤肺清心！調製一劑麥冬清涼飲。', reward_card_id: '' }
];

// ----------------- 本地模擬服務 (Local Mock) -----------------
const PRESET_ACCOUNTS = {
  admin: { id: 'admin', name: '系統大掌櫃', role: 'admin', level: 99, exp: 99999, password: 'admin123' },
  staff: { id: 'staff', name: '分藥小掌櫃', role: 'game_admin', level: 99, exp: 99999, password: 'admin123' },
  player1: { id: 'player1', name: '訓練師小智', role: 'player', level: 1, exp: 0, password: '123' },
  player2: { id: 'player2', name: '訓練師小茂', role: 'player', level: 1, exp: 0, password: '123' },
  player3: { id: 'player3', name: '訓練師小剛', role: 'player', level: 1, exp: 0, password: '123' }
};

function initLocalDatabase() {
  // 初始化玩家
  Object.keys(PRESET_ACCOUNTS).forEach(id => {
    const key = `sa_player_${id}`;
    if (!localStorage.getItem(key)) {
      const preset = { ...PRESET_ACCOUNTS[id] };
      preset.equipped = { head: '', body: '', hands: '', feet: '', sub1: '', sub2: '' };
      preset.deck = [
        'skill_card_01', 'skill_card_02', 'skill_card_03', 'skill_card_04',
        'skill_card_05', 'skill_card_06', '', '', '', ''
      ];
      preset.inventory = {
        'skill_card_01': 2, 'skill_card_02': 2, 'skill_card_03': 2,
        'skill_card_04': 1, 'skill_card_05': 1, 'skill_card_06': 1,
        'equip_head_01': 1, 'equip_body_02': 1, 'equip_hands_02': 1, 'equip_feet_02': 1
      };
      
      const defaultTasks = {};
      for (let k = 0; k < 16; k++) {
        defaultTasks[k] = { status: 'available', password: '', completed: false };
      }
      preset.tasks_progress = defaultTasks;
      preset.last_active = 0;
      
      localStorage.setItem(key, JSON.stringify(preset));
    }
  });

  // 初始化本地任務設定
  if (!localStorage.getItem('sa_tasks_config')) {
    localStorage.setItem('sa_tasks_config', JSON.stringify(DEFAULT_TASKS_CONFIG));
  }

  // 初始化系統設定
  if (!localStorage.getItem('sa_game_enabled')) {
    localStorage.setItem('sa_game_enabled', 'true');
  }
  // 初始化等級生命對照表
  if (!localStorage.getItem('sa_level_config')) {
    const defaultLevels = [];
    for (let l = 1; l <= 50; l++) {
      defaultLevels.push({
        level: l,
        min_exp: (l - 1) * 100,
        base_hp: 100 + (l - 1) * 15
      });
    }
    localStorage.setItem('sa_level_config', JSON.stringify(defaultLevels));
  }
  // 初始化強制登出時間戳記
  if (!localStorage.getItem('sa_force_logout_time')) {
    localStorage.setItem('sa_force_logout_time', '0');
  }
  // 初始化對戰邀請
  if (!localStorage.getItem('sa_invitations')) {
    localStorage.setItem('sa_invitations', '[]');
  }
  // 初始化戰鬥房間
  if (!localStorage.getItem('sa_battles')) {
    localStorage.setItem('sa_battles', '[]');
  }
  // 初始化 QR Token 表
  if (!localStorage.getItem('sa_qr_codes')) {
    localStorage.setItem('sa_qr_codes', '[]');
  }
  // 初始化管理員配額
  if (!localStorage.getItem('sa_admin_quotas')) {
    localStorage.setItem('sa_admin_quotas', '[]');
  }
  // 初始化進行中任務
  if (!localStorage.getItem('sa_active_tasks')) {
    localStorage.setItem('sa_active_tasks', '[]');
  }
}

// 檢查本地強制登出
function checkLocalForceLogout(playerId) {
  if (!playerId) return;
  const player = getLocalPlayer(playerId);
  if (!player || player.role === 'admin' || player.role === 'game_admin') return;
  const forceLogoutTime = Number(localStorage.getItem('sa_force_logout_time') || '0');
  const lastActive = Number(player.last_active || 0);
  if (lastActive > 0 && lastActive < forceLogoutTime) {
    localStorage.removeItem('sa_player');
    localStorage.removeItem('sa_active_battle_id');
    window.location.reload();
    throw new Error('FORCE_LOGOUT');
  }
}

// 獲取本地系統設定數值
function getLocalConfigNum(key, defaultVal) {
  const val = localStorage.getItem(`sa_cfg_${key}`);
  return val !== null ? Number(val) : defaultVal;
}

// 獲取本地玩家物件
function getLocalPlayer(id) {
  const data = localStorage.getItem(`sa_player_${id.toLowerCase()}`);
  return data ? JSON.parse(data) : null;
}

// 儲存本地玩家物件
function saveLocalPlayer(id, player) {
  localStorage.setItem(`sa_player_${id.toLowerCase()}`, JSON.stringify(player));
}

// 根據經驗值計算本地玩家等級
function getLocalPlayerLevelByExp(exp) {
  const dataStr = localStorage.getItem('sa_level_config');
  if (!dataStr) return Math.floor(exp / 100) + 1;
  const levels = JSON.parse(dataStr);
  let currentLevel = 1;
  let maxExpFound = -1;
  for (let item of levels) {
    const l = Number(item.level);
    const minExp = Number(item.min_exp);
    if (exp >= minExp) {
      if (minExp > maxExpFound || (minExp === maxExpFound && l > currentLevel)) {
        currentLevel = l;
        maxExpFound = minExp;
      }
    }
  }
  return currentLevel;
}

// 根據等級計算本地玩家初始生命
function getLocalBaseHpByLevel(level) {
  const dataStr = localStorage.getItem('sa_level_config');
  if (!dataStr) return 100 + (level - 1) * 15;
  const levels = JSON.parse(dataStr);
  let lastRowHp = 100;
  let maxL = 0;
  for (let item of levels) {
    const l = Number(item.level);
    const hp = Number(item.base_hp);
    if (l === level) {
      return hp;
    }
    if (l > maxL) {
      maxL = l;
      lastRowHp = hp;
    }
  }
  if (level > maxL && maxL > 0) {
    return lastRowHp;
  }
  return 100 + (level - 1) * 15;
}

// 計算玩家總屬性
function calculateLocalStats(player) {
  const level = player.level || 1;
  const baseHp = getLocalBaseHpByLevel(level);
  let bonusAtk = 0;
  let bonusDef = 0;
  
  const slots = ['head', 'body', 'hands', 'feet', 'sub1', 'sub2'];
  slots.forEach(slot => {
    const cardId = player.equipped?.[slot];
    if (cardId && CARDS[cardId]) {
      bonusAtk += CARDS[cardId].atk_mod || 0;
      bonusDef += CARDS[cardId].def_mod || 0;
    }
  });
  return {
    maxHp: baseHp,
    atk: Math.max(0, 10 + bonusAtk),
    def: Math.max(0, 5 + bonusDef)
  };
}

// 本地 API 模擬器
const LocalMockService = {
  login: async (username, password) => {
    initLocalDatabase();
    const isEnabled = localStorage.getItem('sa_game_enabled') === 'true';
    const player = getLocalPlayer(username);
    if (!player) throw new Error('帳號不存在');
    if (player.password !== password) throw new Error('密碼錯誤');
    if (!isEnabled && player.role !== 'game_admin' && player.role !== 'admin') {
      throw new Error('伺服器維護中，目前玩家暫時無法登入遊玩。');
    }
    
    player.last_active = Date.now();
    saveLocalPlayer(username, player);
    
    const safePlayer = { ...player };
    delete safePlayer.password;
    return { success: true, player: safePlayer, system_login_enabled: isEnabled };
  },

  getPlayerData: async (playerId) => {
    initLocalDatabase();
    checkLocalForceLogout(playerId);
    const player = getLocalPlayer(playerId);
    if (!player) throw new Error('玩家不存在');
    player.last_active = Date.now();
    saveLocalPlayer(playerId, player);
    
    const safePlayer = { ...player };
    delete safePlayer.password;
    return { success: true, player: safePlayer };
  },

  updateEquipment: async (playerId, equipped) => {
    checkLocalForceLogout(playerId);
    const player = getLocalPlayer(playerId);
    if (!player) throw new Error('玩家不存在');
    
    const slots = ['head', 'body', 'hands', 'feet', 'sub1', 'sub2'];
    for (let slot of slots) {
      const cardId = equipped[slot];
      if (cardId && (!player.inventory[cardId] || player.inventory[cardId] <= 0)) {
        throw new Error('你的背包中沒有此裝備卡！');
      }
    }
    
    player.equipped = equipped;
    player.last_active = Date.now();
    saveLocalPlayer(playerId, player);
    
    const safePlayer = { ...player };
    delete safePlayer.password;
    return { success: true, player: safePlayer };
  },

  updateDeck: async (playerId, deck) => {
    checkLocalForceLogout(playerId);
    const player = getLocalPlayer(playerId);
    if (!player) throw new Error('玩家不存在');
    
    if (!Array.isArray(deck) || deck.length !== 10) {
      throw new Error('牌組卡槽必須為 10 個！');
    }
    
    const uniqueCards = {};
    for (let cid of deck) {
      if (cid === "") continue; // 容許空白卡槽
      if (uniqueCards[cid]) {
        throw new Error('牌組中同一卡牌只能攜帶一張！');
      }
      uniqueCards[cid] = true;
      // 取消本地 Mock 的背包庫存限制
      // if (!player.inventory[cid] || player.inventory[cid] < 1) {
      //   throw new Error('背包中無此卡牌，無法配置！');
      //   }
    }
    
    player.deck = deck;
    player.last_active = Date.now();
    saveLocalPlayer(playerId, player);
    
    const safePlayer = { ...player };
    delete safePlayer.password;
    return { success: true, player: safePlayer };
  },

  getOnlinePlayers: async (playerId) => {
    initLocalDatabase();
    checkLocalForceLogout(playerId);
    const onlineList = [];
    const now = Date.now();
    
    Object.keys(PRESET_ACCOUNTS).forEach(id => {
      if (id.toLowerCase() !== playerId.toLowerCase() && id !== 'admin' && id !== 'staff') {
        const p = getLocalPlayer(id);
        if (p && now - p.last_active < 15000) {
          onlineList.push({
            id: p.id,
            name: p.name,
            level: p.level
          });
        }
      }
    });

    const me = getLocalPlayer(playerId);
    if (me) {
      me.last_active = now;
      saveLocalPlayer(playerId, me);
    }
    return { success: true, online_players: onlineList };
  },

  invitePlayer: async (senderId, receiverId) => {
    checkLocalForceLogout(senderId);
    const invs = JSON.parse(localStorage.getItem('sa_invitations') || '[]');
    
    // 檢查是否已存在 pending 的相同邀請
    const existing = invs.find(i => i.sender_id === senderId && i.receiver_id === receiverId && i.status === 'pending');
    if (existing) {
      return { success: true, invitation_id: existing.invitation_id };
    }

    const invId = `INV_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // 清除該發送者的舊邀請
    const filtered = invs.map(i => {
      if (i.sender_id === senderId && i.status === 'pending') {
        return { ...i, status: 'expired' };
      }
      return i;
    });

    filtered.push({
      invitation_id: invId,
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending',
      created_at: Date.now()
    });
    
    localStorage.setItem('sa_invitations', JSON.stringify(filtered));
    
    // 本地多視窗廣播通知
    postLocalBroadcast({
      type: 'INVITE',
      invitation_id: invId,
      sender_id: senderId,
      sender_name: getLocalPlayer(senderId)?.name || senderId,
      receiver_id: receiverId
    });

    return { success: true, invitation_id: invId };
  },

  checkInvitations: async (playerId) => {
    checkLocalForceLogout(playerId);
    const invs = JSON.parse(localStorage.getItem('sa_invitations') || '[]');
    const now = Date.now();
    let inbound = null;
    let outboundAccepted = null;

    // 清理與篩選
    for (let i = invs.length - 1; i >= 0; i--) {
      const inv = invs[i];
      if (now - inv.created_at > 30000 && inv.status === 'pending') {
        inv.status = 'expired';
        continue;
      }

      if (inv.receiver_id.toLowerCase() === playerId.toLowerCase() && inv.status === 'pending') {
        inbound = {
          invitation_id: inv.invitation_id,
          sender_id: inv.sender_id,
          sender_name: getLocalPlayer(inv.sender_id)?.name || inv.sender_id
        };
        break;
      }

      if (inv.sender_id.toLowerCase() === playerId.toLowerCase() && String(inv.status).startsWith('accepted')) {
        let bId = '';
        if (String(inv.status).startsWith('accepted:')) {
          bId = inv.status.split(':')[1];
        }
        if (!bId) {
          const battles = JSON.parse(localStorage.getItem('sa_battles') || '[]');
          const activeBattle = [...battles].reverse().find(b => 
            (b.p1_id === playerId || b.p2_id === playerId) && b.status === 'active'
          );
          bId = activeBattle ? activeBattle.battle_id : '';
        }
        
        outboundAccepted = {
          invitation_id: inv.invitation_id,
          battle_id: bId
        };
        inv.status = 'joined';
        break;
      }
    }
    
    localStorage.setItem('sa_invitations', JSON.stringify(invs));
    return { success: true, inbound, outbound_accepted: outboundAccepted };
  },

  respondInvitation: async (receiverId, invId, accept) => {
    checkLocalForceLogout(receiverId);
    const invs = JSON.parse(localStorage.getItem('sa_invitations') || '[]');
    const now = Date.now();
    const inv = invs.find(i => i.invitation_id === invId && i.status === 'pending');
    
    if (!inv || now - inv.created_at > 30000) {
      if (inv) {
        inv.status = 'expired';
        localStorage.setItem('sa_invitations', JSON.stringify(invs));
      }
      throw new Error('邀請已過期或不存在');
    }

    if (!accept) {
      inv.status = 'rejected';
      localStorage.setItem('sa_invitations', JSON.stringify(invs));
      return { success: true, status: 'rejected' };
    }

    const p1 = getLocalPlayer(inv.sender_id);
    const p2 = getLocalPlayer(receiverId);
    if (!p1 || !p2) throw new Error('玩家資料遺失');

    const p1Stats = calculateLocalStats(p1);
    const p2Stats = calculateLocalStats(p2);

    const battleId = `BAT_${Date.now()}`;
    
    inv.status = `accepted:${battleId}`;
    localStorage.setItem('sa_invitations', JSON.stringify(invs));

    const battles = JSON.parse(localStorage.getItem('sa_battles') || '[]');
    battles.push({
      battle_id: battleId,
      p1_id: p1.id,
      p2_id: p2.id,
      status: 'active',
      winner_id: '',
      start_time: Date.now(),
      p1_hp: p1Stats.maxHp,
      p1_max_hp: p1Stats.maxHp,
      p1_def: p1Stats.def,
      p1_atk: p1Stats.atk,
      p2_hp: p2Stats.maxHp,
      p2_max_hp: p2Stats.maxHp,
      p2_def: p2Stats.def,
      p2_atk: p2Stats.atk,
      p1_action: 'waiting',
      p2_action: 'waiting',
      round_number: 1,
      r1_p1_cards: '', r1_p2_cards: '',
      r2_p1_cards: '', r2_p2_cards: '',
      r3_p1_cards: '', r3_p2_cards: '',
      r4_p1_cards: '', r4_p2_cards: '',
      r5_p1_cards: '', r5_p2_cards: '',
      p1_last_action: '',
      p2_last_action: ''
    });

    localStorage.setItem('sa_battles', JSON.stringify(battles));
    return { success: true, status: 'accepted', battle_id: battleId };
  },

  abandonBattle: async (battleId, playerId) => {
    checkLocalForceLogout(playerId);
    const battles = JSON.parse(localStorage.getItem('sa_battles') || '[]');
    const battleIndex = battles.findIndex(b => b.battle_id === battleId);
    if (battleIndex === -1) {
      return { success: true, battle: null };
    }

    const battle = battles[battleIndex];
    if (battle.status !== 'active') {
      return { success: true, battle };
    }

    const isP1 = String(playerId || '').toLowerCase() === String(battle.p1_id || '').toLowerCase();
    const isP2 = String(playerId || '').toLowerCase() === String(battle.p2_id || '').toLowerCase();
    if (!isP1 && !isP2) {
      throw new Error('你不在這場對戰中');
    }

    battle.status = 'abandoned';
    battle.winner_id = 'ABANDONED';
    battle.p1_action = 'waiting';
    battle.p2_action = 'waiting';
    localStorage.setItem('sa_battles', JSON.stringify(battles));
    return { success: true, battle };
  },

  getBattleState: async (battleId, playerId) => {
    checkLocalForceLogout(playerId);
    const battles = JSON.parse(localStorage.getItem('sa_battles') || '[]');
    const battle = battles.find(b => b.battle_id === battleId);
    if (!battle) throw new Error('找不到該對戰房');

    const now = Date.now();
    
    // 1. 分段出牌超時自動結算判定 (21秒)
    if (battle.status === 'active') {
      if (battle.p1_action === 'waiting') {
        if (now - battle.start_time > 21000) {
          battle.p1_action = '';
          battle.start_time = now;
          localStorage.setItem('sa_battles', JSON.stringify(battles));
        }
      } else if (battle.p2_action === 'waiting') {
        if (now - battle.start_time > 21000) {
          battle.p2_action = '';
          resolveLocalRound(battle);
          localStorage.setItem('sa_battles', JSON.stringify(battles));
        }
      }
    }

    // 2. 3分鐘超時結算
    if (battle.status === 'active' && (now - battle.start_time > 180000)) {
      battle.status = 'ended';
      if (battle.p1_hp > battle.p2_hp) {
        battle.winner_id = battle.p1_id;
      } else if (battle.p2_hp > battle.p1_hp) {
        battle.winner_id = battle.p2_id;
      } else {
        battle.winner_id = 'DRAW';
      }
      localStorage.setItem('sa_battles', JSON.stringify(battles));

      distributeLocalRewards(battle.p1_id, battle.p2_id, battle.winner_id);
    }

    return { success: true, battle };
  },

  submitBattleAction: async (battleId, playerId, cardId) => {
    checkLocalForceLogout(playerId);
    const battles = JSON.parse(localStorage.getItem('sa_battles') || '[]');
    const battleIndex = battles.findIndex(b => b.battle_id === battleId);
    if (battleIndex === -1) throw new Error('對戰不存在');
    
    const battle = battles[battleIndex];
    if (battle.status !== 'active') throw new Error('對戰已結束');

    if (playerId.toLowerCase() === battle.p1_id.toLowerCase()) {
      if (battle.p1_action !== 'waiting') throw new Error('您已出過牌');
      battle.p1_action = cardId;
      battle.start_time = Date.now(); // P1 出牌後，重置 start_time 好讓 P2 計時
    } else if (playerId.toLowerCase() === battle.p2_id.toLowerCase()) {
      if (battle.p1_action === 'waiting') throw new Error('請等待對手先出牌');
      if (battle.p2_action !== 'waiting') throw new Error('您已出過牌');
      battle.p2_action = cardId;
    } else {
      throw new Error('您非此戰鬥之玩家');
    }

    // 雙方出完牌，進行回合結算
    if (battle.p1_action !== 'waiting' && battle.p2_action !== 'waiting') {
      resolveLocalRound(battle);
      if (battle.status === 'ended') {
        distributeLocalRewards(battle.p1_id, battle.p2_id, battle.winner_id);
      }
    }

    localStorage.setItem('sa_battles', JSON.stringify(battles));
    return { success: true, battle };
  },

  claimQrCode: async (playerId, token) => {
    checkLocalForceLogout(playerId);
    const qrList = JSON.parse(localStorage.getItem('sa_qr_codes') || '[]');
    const qr = qrList.find(q => q.token === token);
    if (!qr) throw new Error('無效的領取憑證 (QR Token)');
    if (qr.status !== 'active') {
      return { success: false, error: '此 QR Code 已被兌換或失效', card_id: qr.card_id };
    }

    const player = getLocalPlayer(playerId);
    if (!player) throw new Error('玩家不存在');

    const cardId = qr.card_id;
    let message = '';
    let expGained = 0;

    const expQrDuplicate = getLocalConfigNum('exp_qr_duplicate', 80);
    if (player.inventory[cardId]) {
      expGained = expQrDuplicate;
      message = `領取成功！已擁有此卡牌 [${CARDS[cardId]?.name || cardId}]，自動轉換為 ${expGained} 點經驗值！`;
      addLocalExp(player, expGained);
    } else {
      player.inventory[cardId] = 1;
      message = `領取成功！獲得卡牌: ${CARDS[cardId]?.name || cardId}`;
      saveLocalPlayer(playerId, player);
    }

    qr.status = 'claimed';
    qr.claimed_by = playerId;
    localStorage.setItem('sa_qr_codes', JSON.stringify(qrList));

    const safePlayer = getLocalPlayer(playerId);
    delete safePlayer.password;
    return { success: true, message, player: safePlayer, card_id: cardId };
  },

  startTask: async (playerId, gridIndex) => {
    checkLocalForceLogout(playerId);
    const player = getLocalPlayer(playerId);
    if (!player) throw new Error('玩家不存在');

    const idxStr = String(gridIndex);
    if (!player.tasks_progress[idxStr]) throw new Error('無效的格子');

    const cell = player.tasks_progress[idxStr];
    if (cell.status === 'completed') {
      throw new Error('此任務已通關完成！');
    }
    if (cell.status === 'active') {
      const activeTasks = JSON.parse(localStorage.getItem('sa_active_tasks') || '[]');
      const existingIdx = activeTasks.findIndex(t => t.player_id === playerId && Number(t.grid_index) === Number(gridIndex));
      if (existingIdx !== -1) {
        activeTasks[existingIdx].password = cell.password;
        activeTasks[existingIdx].status = 'active';
      } else {
        activeTasks.push({
          player_id: playerId,
          grid_index: Number(gridIndex),
          password: cell.password,
          status: 'active',
          created_at: Date.now()
        });
      }
      localStorage.setItem('sa_active_tasks', JSON.stringify(activeTasks));
      return { success: true, password: cell.password, tasks_progress: player.tasks_progress };
    }

    const code = `TASK-${gridIndex}-${Math.floor(Math.random() * 9000 + 1000)}`;
    cell.status = 'active';
    cell.password = code;

    saveLocalPlayer(playerId, player);

    // 同步到 sa_active_tasks
    const activeTasks = JSON.parse(localStorage.getItem('sa_active_tasks') || '[]');
    const existingIdx = activeTasks.findIndex(t => t.player_id === playerId && Number(t.grid_index) === Number(gridIndex));
    if (existingIdx !== -1) {
      activeTasks[existingIdx].password = code;
      activeTasks[existingIdx].status = 'active';
      activeTasks[existingIdx].created_at = Date.now();
    } else {
      activeTasks.push({
        player_id: playerId,
        grid_index: Number(gridIndex),
        password: code,
        status: 'active',
        created_at: Date.now()
      });
    }
    localStorage.setItem('sa_active_tasks', JSON.stringify(activeTasks));

    return { success: true, password: code, tasks_progress: player.tasks_progress };
  },

  claimTask: async (playerId, gridIndex, password) => {
    checkLocalForceLogout(playerId);
    const player = getLocalPlayer(playerId);
    if (!player) throw new Error('玩家不存在');

    const idxStr = String(gridIndex);
    const cell = player.tasks_progress[idxStr];
    if (!cell || cell.status !== 'active') throw new Error('任務未開始或已被領取');
    if (cell.password !== password) throw new Error('通關密碼錯誤，請確認管理員已輸入');

    cell.status = 'completed';
    cell.completed = true;

    const expBase = getLocalConfigNum('exp_task_complete', 30);
    const expDup = getLocalConfigNum('exp_task_duplicate', 50);
    const expBingoLine = getLocalConfigNum('exp_bingo_line', 150);
    const expBingoDup = getLocalConfigNum('exp_bingo_duplicate', 50);

    let expReward = expBase;
    const rewardCardId = getRewardCardForGrid(Number(gridIndex));
    let rewardMessage = `完成格子 #${Number(gridIndex) + 1}！獲得 ${expBase} 點經驗值！`;

    if (rewardCardId) {
      if (player.inventory[rewardCardId]) {
        expReward += expDup;
        rewardMessage += ` (重複獲得「${CARDS[rewardCardId]?.name || rewardCardId}」，自動轉換為 ${expDup} 點經驗值！)`;
      } else {
        player.inventory[rewardCardId] = 1;
        rewardMessage += ` (額外獲得卡牌「${CARDS[rewardCardId]?.name || rewardCardId}」)`;
      }
    }

    player.exp = (player.exp || 0) + expReward;

    const bingoCount = checkLocalBingoLines(player.tasks_progress);
    const oldBingoCount = player.tasks_progress.bingo_count || 0;

    if (bingoCount > oldBingoCount) {
      const lineDiff = bingoCount - oldBingoCount;
      const lineExp = lineDiff * expBingoLine;
      const randomCard = getRandomLocalCardId();

      player.exp = (player.exp || 0) + lineExp;
      if (player.inventory[randomCard]) {
        player.exp = (player.exp || 0) + expBingoDup;
        rewardMessage += `\n【🎉 連線成功 ${lineDiff} 條！】再獲得 ${lineExp} 經驗，連線卡片獎勵已轉換為 ${expBingoDup} 經驗！`;
      } else {
        player.inventory[randomCard] = 1;
        rewardMessage += `\n【🎉 連線成功 ${lineDiff} 條！】再獲得 ${lineExp} 經驗與隨機卡片「${CARDS[randomCard]?.name || randomCard}」！`;
      }
      player.tasks_progress.bingo_count = bingoCount;
    }

    // 計算升級
    const newLevel = getLocalPlayerLevelByExp(player.exp);
    if (newLevel > player.level) {
      player.level = newLevel;
    }

    saveLocalPlayer(playerId, player);
    
    // 同步更新 sa_active_tasks
    const activeTasks = JSON.parse(localStorage.getItem('sa_active_tasks') || '[]');
    const existingIdx = activeTasks.findIndex(t => t.player_id === playerId && Number(t.grid_index) === Number(gridIndex));
    if (existingIdx !== -1) {
      activeTasks[existingIdx].status = 'completed';
      localStorage.setItem('sa_active_tasks', JSON.stringify(activeTasks));
    }
    
    const safePlayer = getLocalPlayer(playerId);
    delete safePlayer.password;
    return { success: true, message: rewardMessage, player: safePlayer };
  },

  adminGenerateQr: async (adminId, cardId) => {
    const admin = getLocalPlayer(adminId);
    if (!admin || (admin.role !== 'admin' && admin.role !== 'game_admin')) {
      throw new Error('無管理權限');
    }

    if (admin.role === 'game_admin') {
      const quotas = JSON.parse(localStorage.getItem('sa_admin_quotas') || '[]');
      const q = quotas.find(item => item.admin_id === adminId && item.card_id === cardId);
      if (!q || q.quota <= 0) {
        throw new Error('您無此卡片的分配額度或配額已用盡！');
      }
      q.quota -= 1;
      localStorage.setItem('sa_admin_quotas', JSON.stringify(quotas));
    }

    const token = `QR_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const qrList = JSON.parse(localStorage.getItem('sa_qr_codes') || '[]');
    qrList.push({
      token,
      admin_id: adminId,
      card_id: cardId,
      status: 'active',
      claimed_by: '',
      created_at: Date.now()
    });
    localStorage.setItem('sa_qr_codes', JSON.stringify(qrList));

    return { success: true, token, card_id: cardId, card_name: CARDS[cardId]?.name || cardId };
  },

  adminGetTasks: async (adminId) => {
    const admin = getLocalPlayer(adminId);
    if (!admin || (admin.role !== 'admin' && admin.role !== 'game_admin')) {
      throw new Error('權限不足');
    }

    const activeTasks = JSON.parse(localStorage.getItem('sa_active_tasks') || '[]');
    const playerTasks = [];
    
    // 建立 playerMap 以獲取 nickname
    const playerMap = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.toLowerCase().startsWith('sa_player_')) {
        const pStr = localStorage.getItem(key);
        if (pStr) {
          try {
            const p = JSON.parse(pStr);
            if (p) {
              playerMap[p.id.toLowerCase()] = p.name;
            }
          } catch (e) {}
        }
      }
    }

    const grouped = {};
    activeTasks.forEach(task => {
      if (task.status === 'active') {
        const pId = task.player_id;
        if (!grouped[pId]) {
          grouped[pId] = [];
        }
        grouped[pId].push({
          grid_index: task.grid_index,
          password: task.password
        });
      }
    });

    for (let pId in grouped) {
      playerTasks.push({
        username: pId,
        nickname: playerMap[pId.toLowerCase()] || pId,
        tasks: grouped[pId]
      });
    }

    return { success: true, player_tasks: playerTasks };
  },

  adminGetQuotas: async (adminId) => {
    const admin = getLocalPlayer(adminId);
    if (!admin) throw new Error('無效使用者');

    if (admin.role === 'admin') {
      const quotas = Object.keys(CARDS).map(cid => ({
        card_id: cid,
        card_name: CARDS[cid].name,
        quota: '無限'
      }));
      return { success: true, quotas, is_unlimited: true };
    }

    const quotas = JSON.parse(localStorage.getItem('sa_admin_quotas') || '[]');
    const list = quotas.filter(q => q.admin_id === adminId).map(q => ({
      card_id: q.card_id,
      card_name: CARDS[q.card_id]?.name || q.card_id,
      quota: q.quota
    }));
    return { success: true, quotas: list, is_unlimited: false };
  },

  gameAdminToggleLogin: async (adminId, enabled) => {
    const admin = getLocalPlayer(adminId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('僅限大掌櫃操作');
    }
    localStorage.setItem('sa_game_enabled', enabled ? 'true' : 'false');
    
    // 如果系統被關閉 (enabled === false)，在本地也進行強踢與清除
    if (!enabled) {
      clearLocalActiveRecordsAndTasks();
    }
    
    return { success: true, game_enabled: enabled };
  },

  gameAdminUpdatePlayer: async (adminId, targetPlayerId, fields) => {
    const admin = getLocalPlayer(adminId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('僅限大掌櫃操作');
    }

    const target = getLocalPlayer(targetPlayerId);
    if (!target) throw new Error('找不到目標玩家');

    if (fields.targetPlayerObj) {
      const updatedObj = fields.targetPlayerObj;
      saveLocalPlayer(targetPlayerId, updatedObj);
      const safeTarget = { ...updatedObj };
      delete safeTarget.password;
      return { success: true, player: safeTarget };
    }

    if (fields.level !== undefined) target.level = Number(fields.level);
    if (fields.exp !== undefined) target.exp = Number(fields.exp);
    if (fields.give_card_id) {
      const cid = fields.give_card_id;
      target.inventory[cid] = (target.inventory[cid] || 0) + 1;
    }

    if (fields.quota_card_id && fields.quota_val !== undefined) {
      const quotas = JSON.parse(localStorage.getItem('sa_admin_quotas') || '[]');
      const qIndex = quotas.findIndex(q => q.admin_id === targetPlayerId && q.card_id === fields.quota_card_id);
      if (qIndex !== -1) {
        quotas[qIndex].quota = Number(fields.quota_val);
      } else {
        quotas.push({
          admin_id: targetPlayerId,
          card_id: fields.quota_card_id,
          quota: Number(fields.quota_val)
        });
      }
      localStorage.setItem('sa_admin_quotas', JSON.stringify(quotas));
    }

    saveLocalPlayer(targetPlayerId, target);
    const safeTarget = { ...target };
    delete safeTarget.password;
    return { success: true, player: safeTarget };
  },

  gameAdminResetSystem: async (adminId) => {
    const admin = getLocalPlayer(adminId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('僅限大掌櫃操作');
    }
    clearLocalActiveRecordsAndTasks();
    return { success: true, message: '💥 成功！大掌櫃總開關已被啟動，所有在線普通弟子已強制退房，進行中對決與任務已清空。' };
  },

  gameAdminSetSystemConfigs: async (adminId, configs) => {
    const admin = getLocalPlayer(adminId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('僅限大掌櫃操作');
    }
    for (let key in configs) {
      localStorage.setItem(`sa_cfg_${key}`, String(configs[key]));
    }
    return { success: true, message: '⚙️ 經驗值與系統配置已更新成功！' };
  }
};

// 本地輔助函式
function clearLocalActiveRecordsAndTasks() {
  localStorage.setItem('sa_force_logout_time', String(Date.now()));
  localStorage.setItem('sa_battles', '[]');
  localStorage.setItem('sa_invitations', '[]');
  localStorage.setItem('sa_active_tasks', '[]');
  
  // 清除所有普通玩家身上為 active 的任務狀態
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sa_player_')) {
      try {
        const playerObj = JSON.parse(localStorage.getItem(key));
        if (playerObj && playerObj.role === 'player' && playerObj.tasks_progress) {
          let changed = false;
          for (const gridKey in playerObj.tasks_progress) {
            if (playerObj.tasks_progress[gridKey] && playerObj.tasks_progress[gridKey].status === 'active') {
              playerObj.tasks_progress[gridKey].status = 'available';
              delete playerObj.tasks_progress[gridKey].password;
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem(key, JSON.stringify(playerObj));
          }
        }
      } catch (e) {
        console.error('Reset local player tasks error:', e);
      }
    }
  }
}

function addLocalExp(player, expToAdd) {
  player.exp = (player.exp || 0) + expToAdd;
  const newLevel = getLocalPlayerLevelByExp(player.exp);
  if (newLevel > player.level) {
    player.level = newLevel;
  }
  saveLocalPlayer(player.id, player);
}

function distributeLocalRewards(p1Id, p2Id, winnerId) {
  const p1 = getLocalPlayer(p1Id);
  const p2 = getLocalPlayer(p2Id);
  if (!p1 || !p2) return;

  let p1Exp = getLocalConfigNum('exp_battle_draw', 30);
  let p2Exp = getLocalConfigNum('exp_battle_draw', 30);

  if (winnerId === p1Id) {
    p1Exp = getLocalConfigNum('exp_battle_win', 50);
    p2Exp = getLocalConfigNum('exp_battle_lose', 20);
  } else if (winnerId === p2Id) {
    p2Exp = getLocalConfigNum('exp_battle_win', 50);
    p1Exp = getLocalConfigNum('exp_battle_lose', 20);
  }

  addLocalExp(p1, p1Exp);
  addLocalExp(p2, p2Exp);
}

function resolveLocalRound(battle) {
  const p1CardIds = (battle.p1_action && battle.p1_action !== 'waiting') ? battle.p1_action.split(',') : [];
  const p2CardIds = (battle.p2_action && battle.p2_action !== 'waiting') ? battle.p2_action.split(',') : [];

  const p1Cards = p1CardIds.map(cid => CARDS[cid]).filter(Boolean);
  const p2Cards = p2CardIds.map(cid => CARDS[cid]).filter(Boolean);

  const p1Stats = { atk: battle.p1_atk, def: battle.p1_def };
  const p2Stats = { atk: battle.p2_atk, def: battle.p2_def };

  const effects = calculateRoundEffects(p1Cards, p2Cards, p1Stats, p2Stats);

  const p1RoundAtk = Math.max(0, battle.p1_atk + effects.p1AtkMod);
  const p1RoundDef = Math.max(0, battle.p1_def + effects.p1DefMod);
  const p2RoundAtk = Math.max(0, battle.p2_atk + effects.p2AtkMod);
  const p2RoundDef = Math.max(0, battle.p2_def + effects.p2DefMod);

  const physDmgToP1 = Math.max(0, p2RoundAtk - p1RoundDef);
  const physDmgToP2 = Math.max(0, p1RoundAtk - p2RoundDef);

  const nextP1Hp = Math.min(battle.p1_max_hp, Math.max(0, battle.p1_hp - physDmgToP1 + 2 * Math.floor(effects.p1HpMod / 2))); // 等等，直接用 effects.p1HpMod
  // 我們稍後會再精細化，我們先用 effects.p1HpMod
  const nextP1HpFinal = Math.min(battle.p1_max_hp, Math.max(0, battle.p1_hp - physDmgToP1 + effects.p1HpMod));
  const nextP2HpFinal = Math.min(battle.p2_max_hp, Math.max(0, battle.p2_hp - physDmgToP2 + effects.p2HpMod));

  const p1CardNames = p1Cards.map((c, idx) => `${c.name}(${effects.p1TriggerStates[idx] ? '觸發' : '未觸發'})`);
  if (p1CardNames.length === 0) p1CardNames.push('空過');

  const p2CardNames = p2Cards.map((c, idx) => `${c.name}(${effects.p2TriggerStates[idx] ? '觸發' : '未觸發'})`);
  if (p2CardNames.length === 0) p2CardNames.push('空過');

  const p1Log = `[${battle.p1_id}] 點刺/投藥「${p1CardNames.join(' + ')}」，內功強度達 ${p1RoundAtk}，衛氣達 ${p1RoundDef}`;
  const p2Log = `[${battle.p2_id}] 點刺/投藥「${p2CardNames.join(' + ')}」，內功強度達 ${p2RoundAtk}，衛氣達 ${p2RoundDef}`;
  
  const p1SkillNet = effects.p1HpMod;
  const p2SkillNet = effects.p2HpMod;
  const p1SkillLog = p1SkillNet >= 0 ? `回復 ${p1SkillNet} 營血` : `衛氣營血受損 ${Math.abs(p1SkillNet)}`;
  const p2SkillLog = p2SkillNet >= 0 ? `回復 ${p2SkillNet} 營血` : `衛氣營血受損 ${Math.abs(p2SkillNet)}`;

  const damageLog = `結算: [${battle.p1_id}] 受到傷害: ${physDmgToP1 + (p1SkillNet < 0 ? Math.abs(p1SkillNet) : 0)} (穴位刺激 ${physDmgToP1} + 技能 ${p1SkillNet < 0 ? Math.abs(p1SkillNet) : 0}，回復 ${p1SkillNet > 0 ? p1SkillNet : 0} 營血); ` +
                    `[${battle.p2_id}] 受到傷害: ${physDmgToP2 + (p2SkillNet < 0 ? Math.abs(p2SkillNet) : 0)} (穴位刺激 ${physDmgToP2} + 技能 ${p2SkillNet < 0 ? Math.abs(p2SkillNet) : 0}，回復 ${p2SkillNet > 0 ? p2SkillNet : 0} 營血)`;

  // 記錄該回合雙方出牌到獨立欄位中
  const currentRound = battle.round_number;
  battle[`r${currentRound}_p1_cards`] = battle.p1_action;
  battle[`r${currentRound}_p2_cards`] = battle.p2_action;

  battle.p1_hp = nextP1HpFinal;
  battle.p2_hp = nextP2HpFinal;

  // 備份上回合雙方的出牌
  battle.p1_last_action = battle.p1_action;
  battle.p2_last_action = battle.p2_action;

  battle.p1_action = 'waiting';
  battle.p2_action = 'waiting';
  battle.round_number += 1;
  battle.start_time = Date.now(); // 更新回合開始時間

  if (nextP1HpFinal <= 0 && nextP2HpFinal <= 0) {
    battle.status = 'ended';
    battle.winner_id = 'DRAW';
  } else if (nextP1HpFinal <= 0) {
    battle.status = 'ended';
    battle.winner_id = battle.p2_id;
  } else if (nextP2HpFinal <= 0) {
    battle.status = 'ended';
    battle.winner_id = battle.p1_id;
  } else if (currentRound >= 5) {
    battle.status = 'ended';
    if (nextP1HpFinal > nextP2HpFinal) {
      battle.winner_id = battle.p1_id;
    } else if (nextP2HpFinal > nextP1HpFinal) {
      battle.winner_id = battle.p2_id;
    } else {
      battle.winner_id = 'DRAW';
    }
  }
}

function getRewardCardForGrid(index) {
  const rewardMap = {
    0: 'skill_card_01',
    2: 'skill_card_03',
    4: 'equip_head_02',
    6: 'skill_card_05',
    8: 'equip_body_03',
    10: 'skill_card_08',
    12: 'equip_hands_03',
    14: 'skill_card_10'
  };
  return rewardMap[index] || '';
}

function unlockLocalAdjacentGrids(tasks, index) {
  const row = Math.floor(index / 4);
  const col = index % 4;
  const adj = [];
  if (row > 0) adj.push((row - 1) * 4 + col);
  if (row < 3) adj.push((row + 1) * 4 + col);
  if (col > 0) adj.push(row * 4 + (col - 1));
  if (col < 3) adj.push(row * 4 + (col + 1));
  
  adj.forEach(i => {
    const idxStr = String(i);
    if (tasks[idxStr] && tasks[idxStr].status === 'locked') {
      tasks[idxStr].status = 'unlocked';
    }
  });
}

function checkLocalBingoLines(tasks) {
  const grid = [];
  for (let i = 0; i < 16; i++) {
    grid.push(tasks[String(i)]?.status === 'completed');
  }
  let lines = 0;
  for (let r = 0; r < 4; r++) {
    if (grid[r*4] && grid[r*4+1] && grid[r*4+2] && grid[r*4+3]) lines++;
  }
  for (let c = 0; c < 4; c++) {
    if (grid[c] && grid[4+c] && grid[8+c] && grid[12+c]) lines++;
  }
  if (grid[0] && grid[5] && grid[10] && grid[15]) lines++;
  if (grid[3] && grid[6] && grid[9] && grid[12]) lines++;
  return lines;
}

function getRandomLocalCardId() {
  const ids = Object.keys(CARDS);
  return ids[Math.floor(Math.random() * ids.length)];
}


// ----------------- GAS 雲端服務 (Cloud GAS) -----------------
function getGasUrl() {
  const settings = JSON.parse(localStorage.getItem('sa_settings') || '{}');
  return import.meta.env.VITE_GAS_URL || settings.gas_url || '';
}

async function callGasApi(action, payload = {}, requesterId = null) {
  const url = getGasUrl();
  if (!url) {
    throw new Error('未設定 Google Script URL！請於模式設定中填寫或建立 .env 檔案。');
  }
  
  // GAS Web App 轉向處理 (使用 POST 且 payload 轉換成 text/plain 避免 preflight 拒絕)
  const body = {
    action,
    requester_id: requesterId,
    ...payload
  };

  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`GAS 伺服器錯誤: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    if (result.error === 'FORCE_LOGOUT') {
      localStorage.removeItem('sa_player');
      localStorage.removeItem('sa_active_battle_id');
      window.location.reload();
    }
    const errObj = new Error(result.error || '未知的 API 錯誤');
    if (result.card_id) {
      errObj.card_id = result.card_id;
    }
    throw errObj;
  }

  return result;
}

// ----------------- 整合導出 API -----------------
export const ApiService = {
  setupCloudDatabase: async () => {
    if (getApiMode() === 'local') {
      initLocalDatabase();
      return { success: true, message: "Database initialized successfully with preset accounts." };
    }
    return callGasApi('setup');
  },

  login: async (username, password) => {
    if (getApiMode() === 'local') {
      return LocalMockService.login(username, password);
    }
    // 雲端模式
    const res = await callGasApi('login', { username, password });
    // 同步下載 Sheets 中的自訂卡牌庫
    try {
      const cardsRes = await callGasApi('get_cards', {}, username);
      if (cardsRes.success && cardsRes.cards) {
        updateCardsFromSheets(cardsRes.cards);
        // 保存一份在 Local 以備斷網/渲染
        localStorage.setItem('sa_cards', JSON.stringify(cardsRes.cards));
      }
    } catch (e) {
      console.warn('Sync custom cards failed, using fallbacks', e);
      const cached = localStorage.getItem('sa_cards');
      if (cached) updateCardsFromSheets(JSON.parse(cached));
    }
    return res;
  },

  getPlayerData: async (playerId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.getPlayerData(playerId);
    }
    return callGasApi('get_player_data', { player_id: playerId }, playerId);
  },

  updateEquipment: async (playerId, equipped) => {
    if (getApiMode() === 'local') {
      return LocalMockService.updateEquipment(playerId, equipped);
    }
    return callGasApi('update_equipment', { player_id: playerId, equipped }, playerId);
  },

  updateDeck: async (playerId, deck) => {
    if (getApiMode() === 'local') {
      return LocalMockService.updateDeck(playerId, deck);
    }
    return callGasApi('update_deck', { player_id: playerId, deck }, playerId);
  },

  getOnlinePlayers: async (playerId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.getOnlinePlayers(playerId);
    }
    return callGasApi('get_online_players', { player_id: playerId }, playerId);
  },

  invitePlayer: async (senderId, receiverId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.invitePlayer(senderId, receiverId);
    }
    return callGasApi('invite_player', { sender_id: senderId, receiver_id: receiverId }, senderId);
  },

  checkInvitations: async (playerId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.checkInvitations(playerId);
    }
    return callGasApi('check_invitations', { player_id: playerId }, playerId);
  },

  respondInvitation: async (receiverId, invitationId, accept) => {
    if (getApiMode() === 'local') {
      return LocalMockService.respondInvitation(receiverId, invitationId, accept);
    }
    return callGasApi('respond_invitation', { player_id: receiverId, invitation_id: invitationId, accept }, receiverId);
  },

  getBattleState: async (battleId, playerId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.getBattleState(battleId, playerId);
    }
    return callGasApi('get_battle_state', { battle_id: battleId, player_id: playerId }, playerId);
  },

  abandonBattle: async (battleId, playerId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.abandonBattle(battleId, playerId);
    }
    return callGasApi('abandon_battle', { battle_id: battleId, player_id: playerId }, playerId);
  },

  submitBattleAction: async (battleId, playerId, cardId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.submitBattleAction(battleId, playerId, cardId);
    }
    return callGasApi('submit_battle_action', { battle_id: battleId, player_id: playerId, card_id: cardId }, playerId);
  },

  claimQrCode: async (playerId, token) => {
    if (getApiMode() === 'local') {
      return LocalMockService.claimQrCode(playerId, token);
    }
    return callGasApi('claim_qr_code', { player_id: playerId, token }, playerId);
  },

  startTask: async (playerId, gridIndex) => {
    if (getApiMode() === 'local') {
      return LocalMockService.startTask(playerId, gridIndex);
    }
    return callGasApi('start_task', { player_id: playerId, grid_index: gridIndex }, playerId);
  },

  claimTask: async (playerId, gridIndex, password) => {
    if (getApiMode() === 'local') {
      return LocalMockService.claimTask(playerId, gridIndex, password);
    }
    return callGasApi('claim_task', { player_id: playerId, grid_index: gridIndex, password }, playerId);
  },

  adminGenerateQr: async (adminId, cardId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.adminGenerateQr(adminId, cardId);
    }
    return callGasApi('admin_generate_qr', { admin_id: adminId, card_id: cardId }, adminId);
  },

  adminGetTasks: async (adminId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.adminGetTasks(adminId);
    }
    return callGasApi('admin_get_tasks', { admin_id: adminId }, adminId);
  },

  adminGetQuotas: async (adminId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.adminGetQuotas(adminId);
    }
    return callGasApi('admin_get_quotas', { admin_id: adminId }, adminId);
  },

  gameAdminToggleLogin: async (adminId, enabled) => {
    if (getApiMode() === 'local') {
      return LocalMockService.gameAdminToggleLogin(adminId, enabled);
    }
    return callGasApi('game_admin_toggle_login', { admin_id: adminId, enabled }, adminId);
  },

  gameAdminUpdatePlayer: async (adminId, targetPlayerId, fields) => {
    if (getApiMode() === 'local') {
      return LocalMockService.gameAdminUpdatePlayer(adminId, targetPlayerId, fields);
    }
    return callGasApi('game_admin_update_player', { admin_id: adminId, target_player_id: targetPlayerId, fields }, adminId);
  },

  getTasksConfig: async (username) => {
    if (getApiMode() === 'local') {
      return { success: true, tasks: JSON.parse(localStorage.getItem('sa_tasks_config') || '[]') };
    }
    return callGasApi('get_tasks_config', {}, username);
  },

  gameAdminResetSystem: async (adminId) => {
    if (getApiMode() === 'local') {
      return LocalMockService.gameAdminResetSystem(adminId);
    }
    return callGasApi('game_admin_reset_system', { admin_id: adminId }, adminId);
  },

  gameAdminSetSystemConfigs: async (adminId, configs) => {
    if (getApiMode() === 'local') {
      return LocalMockService.gameAdminSetSystemConfigs(adminId, configs);
    }
    return callGasApi('game_admin_set_system_configs', { admin_id: adminId, configs }, adminId);
  },

  getLevelConfig: async (username) => {
    if (getApiMode() === 'local') {
      initLocalDatabase();
      return { success: true, levels: JSON.parse(localStorage.getItem('sa_level_config') || '[]') };
    }
    return callGasApi('get_level_config', {}, username);
  },

  getCards: async (username) => {
    if (getApiMode() === 'local') {
      return { success: true, cards: [] };
    }
    return callGasApi('get_cards', {}, username);
  }
};
