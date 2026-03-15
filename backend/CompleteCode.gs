/**
 * Spirit Beast System - Google Apps Script Backend (COMPLETE v4 - SAFE POST)
 * Deploy as Web App -> Execute as Me -> Access: Anyone
 * 
 * INSTRUCTIONS:
 * 1. Copy ALL content from this file.
 * 2. Paste into your Google Apps Script project (e.g. Code.gs).
 * 3. Deploy as New Version.
 */

function doGet(e) {
    const p = e.parameter;
    const action = p.action;

    if (action === 'getPlayerState') return getPlayerState(p.teamId);
    if (action === 'getTeamsList') return getTeamsList();
    if (action === 'getBattle') return getBattle(p.battleId);
    if (action === 'checkChallenges') return checkChallenges(p.teamId);

    return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown Action' }))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    // Handle OPTIONS (Preflight) just in case, though usually handled by GAS
    if (e.postData && e.postData.type === 'application/json' && !e.postData.contents) {
         return ContentService.createTextOutput("")
        .setMimeType(ContentService.MimeType.TEXT)
        .setHeader('Access-Control-Allow-Origin', '*')
        .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        .setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    try {
        if (!e.postData || !e.postData.contents) {
             return response({ ok: false, error: 'No Post Data Received' });
        }

        let data;
        try {
            data = JSON.parse(e.postData.contents);
        } catch (jsonErr) {
            return response({ ok: false, error: 'Invalid JSON: ' + jsonErr.toString() });
        }

        const action = data.action;
        const payload = data.payload;

        if (action === 'login') return login(payload);
        if (action === 'equip') return equip(payload);
        if (action === 'saveLoadout') return saveLoadout(payload);
        if (action === 'createChallenge') return createChallenge(payload);
        if (action === 'respondChallenge') return respondChallenge(payload);
        
        // Phase 3 Actions
        if (action === 'saveStats') return saveStats(payload);
        if (action === 'settleBattle') return settleBattle(payload);

        return response({ error: 'Unknown Action: ' + action });

    } catch (err) {
        return response({ ok: false, error: err.toString() });
    }
}

function response(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', '*'); 
}

// --- LOGIC IMPLEMENTATION ---

function getDb() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss;
}

function getData(sheetName) {
  const sheet = getDb().getSheetByName(sheetName);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 1) return [];
  const headers = rows[0];
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    let obj = {};
    for (let h = 0; h < headers.length; h++) {
      obj[headers[h]] = rows[i][h];
    }
    data.push(obj);
  }
  return data;
}

// Helper to reliably find team row - trims whitespace
function findRowIndex(data, colIndex, value) {
    const target = String(value).trim();
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][colIndex]).trim() === target) {
            return i + 1;
        }
    }
    return -1;
}

function normalizeHeader(header) {
    if (!header) return '';
    return String(header).trim().toLowerCase();
}

function getColumnIndex(headers, key) {
    const normKey = normalizeHeader(key);
    return headers.findIndex(h => normalizeHeader(h) === normKey);
}


function getTeam(teamId) {
  const teams = getData('Teams');
  const team = teams.find(t => String(t.teamId).trim() === String(teamId).trim());
  if (!team) return null;
  
  const stats = getData('數值').find(s => String(s.teamId).trim() === String(teamId).trim());
  if (stats) {
    team.points = Number(stats.points || 0);
  }
  return team;
}

function getCardDefs() {
  const cards = getData('Cards');
  const map = {};
  cards.forEach(c => {
    map[c.cardId] = {
      cardId: c.cardId,
      name: c.name,
      slot: c.slot,
      description: c.description,
      stats: {
        atk: Number(c.atk || 0),
        defense: Number(c.defense || 0),
        speed: Number(c.speed || 0),
        spirit: Number(c.spirit || 0)
      },
      unique: Boolean(c.unique)
    };
  });
  return map;
}

function getInventory(teamId) {
  const invRows = getData('Inventory');
  const cardDefs = getCardDefs();
  const userInv = invRows.filter(r => String(r.teamId).trim() === String(teamId).trim());
  return userInv.map(row => {
    const def = cardDefs[row.cardId];
    if (!def) return null;
    return { ...def, qty: Number(row.qty) };
  }).filter(x => x);
}

function getLoadout(teamId) {
  const loadRows = getData('Loadout');
  const cardDefs = getCardDefs();
  const userLoad = loadRows.filter(r => String(r.teamId).trim() === String(teamId).trim());
  const loadout = {};
  userLoad.forEach(r => {
    if (r.cardId && cardDefs[r.cardId]) {
      loadout[r.slot] = cardDefs[r.cardId];
    }
  });
  return loadout;
}

function calculateStats(loadout, teamId) {
    const statsData = getData('數值').find(s => String(s.teamId).trim() === String(teamId).trim());
    
    // Normalize keys from sheet data just in case
    let base = { atk:0, defense:0, speed:0, spirit:0, wins:0, losses:0, points:0, Applypoints:0 };
    if (statsData) {
        // Find keys case-insensitively
        const findVal = (k) => {
            const keys = Object.keys(statsData);
            const key = keys.find(xk => normalizeHeader(xk) === normalizeHeader(k));
            return key ? Number(statsData[key] || 0) : 0;
        };
        base.atk = findVal('ATK') || findVal('atk');
        base.defense = findVal('DEF') || findVal('defense');
        base.speed = findVal('SPD') || findVal('speed');
        base.spirit = findVal('SPR') || findVal('spirit');
        base.wins = findVal('wins');
        base.losses = findVal('losses');
        base.points = findVal('points');
        base.Applypoints = findVal('Applypoints');
    }

    let stats = { ...base };

    Object.values(loadout).forEach(card => {
        if (card && card.stats) {
            stats.atk += card.stats.atk;
            stats.defense += card.stats.defense;
            stats.speed += card.stats.speed;
            stats.spirit += card.stats.spirit;
        }
    });
    return stats;
}

function getPlayerState(teamId) {
  const team = getTeam(teamId);
  if (!team) return response({ error: 'Team not found' });

  const inventory = getInventory(teamId);
  const loadout = getLoadout(teamId);
  const totalStats = calculateStats(loadout, teamId);

  return response({
      team: team,
      inventory: inventory,
      loadout: loadout,
      totalStats: totalStats
  });
}

function login(payload) {
  const { teamId, password } = payload;
  const team = getTeam(teamId);
  if (!team) return response({ ok: false, error: 'User Not Found' });
  
  // You might want to remove password check or fix it.
  // Assuming password column is 'password'
  if (team.password && String(team.password).trim() !== String(password).trim()) {
      return response({ ok: false, error: 'Wrong Password' });
  }

  const inventory = getInventory(teamId);
  const loadout = getLoadout(teamId);
  const totalStats = calculateStats(loadout, teamId);

  return response({ 
      ok: true, 
      state: {
          team: team,
          inventory: inventory,
          loadout: loadout,
          totalStats: totalStats
      }
  });
}

function getTeamsList() {
    const teams = getData('Teams');
    const statsData = getData('數值');
    const enrichedTeams = teams.map(t => {
        const s = statsData.find(sd => String(sd.teamId).trim() === String(t.teamId).trim());
        let pts = 0;
        if (s) {
             const keys = Object.keys(s);
             const key = keys.find(xk => normalizeHeader(xk) === 'points');
             pts = key ? Number(s[key] || 0) : 0;
        }
        return {
            ...t,
            points: pts
        };
    });
    return response({ ok: true, teams: enrichedTeams });
}

function saveLoadout(payload) {
    const { teamId, loadout } = payload; 
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
        const ss = getDb();
        const sheet = ss.getSheetByName('Loadout');
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const idxTeam = getColumnIndex(headers, 'teamId');
        
        // Delete existing loadout for this team
        for (let i = data.length - 1; i >= 1; i--) {
            if (String(data[i][idxTeam]).trim() === String(teamId).trim()) {
                sheet.deleteRow(i + 1);
            }
        }

        Object.entries(loadout).forEach(([slot, cardId]) => {
            if (cardId) {
                sheet.appendRow([teamId, slot, cardId]);
            }
        });

        return response({ ok: true });
    } catch(e) {
        return response({ ok: false, error: e.toString() });
    } finally {
        lock.releaseLock();
    }
}

// --- BATTLE SYSTEM ---

function createChallenge(payload) {
    const { challengerId, defenderId } = payload;
    const battleId = Utilities.getUuid();
    const ss = getDb();
    const sheet = ss.getSheetByName('Battles');
    // Ensure 6 cols to support winnerId later
    sheet.appendRow([battleId, challengerId, defenderId, 'PENDING', new Date(), '']);
    return response({ ok: true, battleId });
}

function checkChallenges(teamId) {
    const data = getData('Battles');
    const relevant = data.filter(r => {
        const defId = String(r.defenderId).trim();
        const chalId = String(r.challengerId).trim();
        const tid = String(teamId).trim();
        
        if (defId === tid && r.status === 'PENDING') return true;
        if (chalId === tid && (r.status === 'ACCEPTED' || r.status === 'REJECTED')) return true;
        return false;
    });
    return response({ ok: true, challenges: relevant });
}

function respondChallenge(payload) {
    const { battleId, defenderId, accept } = payload;
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
        const ss = getDb();
        const sheet = ss.getSheetByName('Battles');
        const data = sheet.getDataRange().getValues();
        const idxId = getColumnIndex(data[0], 'battleId');
        const idxStatus = getColumnIndex(data[0], 'status');
        
        const row = findRowIndex(data, idxId, battleId);
        
        if (row !== -1) {
            sheet.getRange(row, idxStatus + 1).setValue(accept ? 'ACCEPTED' : 'REJECTED');
            return response({ ok: true, status: accept ? 'ACCEPTED' : 'REJECTED' });
        }
        return response({ ok: false, error: 'Battle Not Found' });
    } finally {
        lock.releaseLock();
    }
}

function getBattle(battleId) {
    const battles = getData('Battles');
    const battle = battles.find(b => String(b.battleId).trim() === String(battleId).trim());
    if (!battle) return response({ ok: false, error: 'Battle not found' });

    const p1 = getPlayerState(battle.challengerId);
    const p2 = getPlayerState(battle.defenderId);
    
    // Safety check if team not found
    if (!p1 || !p2) {
      // Return basic info if one player missing, but likely fatal for battle
       return response({ ok: false, error: 'Participant not found' });
    }
    
    // Unwrap responses (simulated internal call)
    let cData, dData;
    try {
      cData = JSON.parse(p1.getContent());
      dData = JSON.parse(p2.getContent());
    } catch(e) {
       return response({ ok: false, error: 'Error parsing participant data' });
    }

    return response({
        ok: true,
        battle: {
            ...battle,
            challenger: { 
                teamId: cData.team.teamId, 
                teamName: cData.team.teamName,
                beastName: cData.team.beastName,
                avatarSeed: cData.team.avatarSeed,
                stats: cData.totalStats 
            },
            defender: { 
                teamId: dData.team.teamId, 
                teamName: dData.team.teamName,
                beastName: dData.team.beastName,
                avatarSeed: dData.team.avatarSeed,
                stats: dData.totalStats 
            }
        }
    });
}

function saveStats(payload) {
  const { teamId, newStats } = payload;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName('數值');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idxTeam = getColumnIndex(headers, 'teamId');
    
    const row = findRowIndex(data, idxTeam, teamId);

    if (row === -1) throw new Error("Team stats record not found for " + teamId);

    // Update columns
    const keys = {
        'atk': ['ATK', 'atk'],
        'defense': ['DEF', 'Defense', 'defense'],
        'speed': ['SPD', 'Speed', 'speed'],
        'spirit': ['SPR', 'Spirit', 'spirit'],
        'Applypoints': ['Applypoints', 'applypoints', 'ApplyPoints']
    };

    Object.keys(newStats).forEach(statKey => {
        const possibleHeaders = keys[statKey] || [statKey];
        let hIdx = -1;
        for (const ph of possibleHeaders) {
            hIdx = getColumnIndex(headers, ph);
            if (hIdx !== -1) break;
        }

        if (hIdx !== -1) {
            sheet.getRange(row, hIdx + 1).setValue(newStats[statKey]);
        }
    });

    logAction(teamId, 'saveStats', newStats);
    return response({ ok: true });
  } catch (e) {
    logAction(teamId, 'saveStats_ERROR', e.toString());
    return response({ ok: false, error: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

function settleBattle(payload) {
  const { battleId, winnerId } = payload;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getDb();
    
    // 1. Update Battle Status
    const battleSheet = ss.getSheetByName('Battles');
    const battleData = battleSheet.getDataRange().getValues();
    const bHeaders = battleData[0];
    const bIdxId = getColumnIndex(bHeaders, 'battleId');
    const bIdxStatus = getColumnIndex(bHeaders, 'status');
    const bIdxWinner = getColumnIndex(bHeaders, 'winnerId');
    
    const bRow = findRowIndex(battleData, bIdxId, battleId);
    
    if (bRow !== -1) {
        if (bIdxStatus !== -1) battleSheet.getRange(bRow, bIdxStatus + 1).setValue('FINISHED');
        if (bIdxWinner !== -1) {
            battleSheet.getRange(bRow, bIdxWinner + 1).setValue(winnerId);
        } else {
             logAction('SYSTEM', 'settleBattle_WARN', 'No winnerId column found');
        }
    } else {
        logAction('SYSTEM', 'settleBattle_WARN', 'Battle not found: ' + battleId);
    }

    // 2. Award Points
    // Need to find participants AGAIN because we don't have them in payload
    // Safer to get from Sheet to prevent cheating/spoofing, but strictly speaking payload comes from client.
    
    let parts = [];
    if (bRow !== -1) {
        const cIdx = getColumnIndex(bHeaders, 'challengerId');
        const dIdx = getColumnIndex(bHeaders, 'defenderId');
        
        if (cIdx !== -1 && dIdx !== -1) {
            const cId = battleData[bRow-1][cIdx];
            const dId = battleData[bRow-1][dIdx];
            parts = [cId, dId];
        }
    } 
    
    if (parts.length === 0) {
        // Log error but don't fail complete, maybe return false
        logAction('SYSTEM', 'settleBattle_ERROR', "Cannot find participants for battle " + battleId);
        throw new Error("Cannot find participants");
    }

    const statsSheet = ss.getSheetByName('數值');
    const sData = statsSheet.getDataRange().getValues();
    const sHeaders = sData[0];
    const sIdxTeam = getColumnIndex(sHeaders, 'teamId');
    
    parts.forEach(pid => {
        if (!pid) return;
        const sRow = findRowIndex(sData, sIdxTeam, pid);
        
        if (sRow !== -1) {
            const isWinner = String(pid).trim() === String(winnerId).trim();
            const pointsEarned = isWinner ? 4 : 1; 

            // Robust Get/Set
            const updateCol = (colName, addVal) => {
                const idx = getColumnIndex(sHeaders, colName);
                if (idx !== -1) {
                    const cell = statsSheet.getRange(sRow, idx + 1);
                    const val = Number(cell.getValue()) || 0;
                    cell.setValue(val + addVal);
                } else {
                     logAction('SYSTEM', 'settleBattle_MISSING_COL', colName);
                }
            };

            updateCol('points', pointsEarned);
            updateCol('Applypoints', pointsEarned);
            if (isWinner) updateCol('wins', 1);
            else updateCol('losses', 1);
            
            logAction('SYSTEM', 'settleBattle_AWARD', { pid, points: pointsEarned });
        } else {
            logAction('SYSTEM', 'settleBattle_WARN', 'Stats row not found for: ' + pid);
        }
    });

    return response({ ok: true, pointsEarned: (String(winnerId).trim() === String(parts[0]).trim() ? 4 : 1) });
  } catch (e) {
    logAction('SYSTEM', 'settleBattle_ERROR', e.toString());
    return response({ ok: false, error: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

function equip(payload) {
  const { teamId, slot, cardId } = payload;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getDb();
    const invSheet = ss.getSheetByName('Inventory');
    const invData = invSheet.getDataRange().getValues();
    const iHeaders = invData[0];
    const iIdxTeam = getColumnIndex(iHeaders, 'teamId');
    const iIdxCard = getColumnIndex(iHeaders, 'cardId');
    const iIdxQty = getColumnIndex(iHeaders, 'qty');

    // Find item
    let iRow = -1;
    for(let i=1; i<invData.length; i++) {
        if (String(invData[i][iIdxTeam]).trim() === String(teamId).trim() && 
            String(invData[i][iIdxCard]).trim() === String(cardId).trim()) {
            iRow = i + 1; break;
        }
    }
    
    if (iRow === -1 || Number(invData[iRow-1][iIdxQty]) < 1) return response({ ok: false, error: "Not in inventory" });

    // Unequip current
    const loadoutRows = getData('Loadout');
    const current = loadoutRows.find(r => String(r.teamId).trim() === String(teamId).trim() && String(r.slot) === String(slot));
    
    if (current && current.cardId) {
        addItemToInventory(invSheet, teamId, current.cardId, 1);
    }

    const loadoutSheet = ss.getSheetByName('Loadout');
    const loadoutData = loadoutSheet.getDataRange().getValues();
    const lHeaders = loadoutData[0];
    const idxTeam = getColumnIndex(lHeaders, 'teamId');
    const idxSlot = getColumnIndex(lHeaders, 'slot');
    const idxCard = getColumnIndex(lHeaders, 'cardId');

    let lRow = -1;
    for(let i=1; i<loadoutData.length; i++){
        if(String(loadoutData[i][idxTeam]).trim() === String(teamId).trim() && String(loadoutData[i][idxSlot]) === String(slot)){
            lRow = i+1; break;
        }
    }
    if(lRow !== -1) loadoutSheet.getRange(lRow, idxCard+1).setValue(cardId);
    else loadoutSheet.appendRow([teamId, slot, cardId]);

    // Reduce Inv
    const curQty = Number(invSheet.getRange(iRow, iIdxQty+1).getValue());
    if (curQty <= 1) invSheet.deleteRow(iRow);
    else invSheet.getRange(iRow, iIdxQty+1).setValue(curQty - 1);

    return response({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function addItemToInventory(sheet, teamId, cardId, qty) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxTeam = getColumnIndex(headers, 'teamId');
  const idxCard = getColumnIndex(headers, 'cardId');
  const idxQty = getColumnIndex(headers, 'qty');

  let row = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxTeam]).trim() === String(teamId).trim() && String(data[i][idxCard]).trim() === String(cardId).trim()) {
      row = i + 1; break;
    }
  }
  if (row !== -1) {
    const cur = Number(sheet.getRange(row, idxQty + 1).getValue());
    sheet.getRange(row, idxQty + 1).setValue(cur + qty);
  } else {
    sheet.appendRow([teamId, cardId, qty]);
  }
}

function logAction(teamId, action, payload) {
  const sheet = getDb().getSheetByName('Logs');
  if (sheet) {
    sheet.appendRow([new Date(), 'api', teamId, action, JSON.stringify(payload)]);
  }
}
