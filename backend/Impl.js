/**
 * Logic Implementation for Phase 3 (Stats Allocation & Points System) - ROBUST v3
 */

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

    let base = { atk: 0, defense: 0, speed: 0, spirit: 0, wins: 0, losses: 0, points: 0, Applypoints: 0 };
    if (statsData) {
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

// --- Phase 3 New Functions ---

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

        logAction('SYSTEM', 'settleBattle_START', payload);

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
            if (bIdxWinner !== -1) battleSheet.getRange(bRow, bIdxWinner + 1).setValue(winnerId);
        } else {
            logAction('SYSTEM', 'settleBattle_WARN', 'Battle not found: ' + battleId);
        }

        // 2. Award Points
        // Need to find participants AGAIN because we don't have them in payload
        // We can get them from the battle row if found, OR we can accept them in payload as an optimization
        // Safer to get from Sheet to prevent cheating/spoofing, but strictly speaking payload comes from client.
        // If bRow is found, use that.

        let parts = [];
        if (bRow !== -1) {
            const cId = battleData[bRow - 1][getColumnIndex(bHeaders, 'challengerId')];
            const dId = battleData[bRow - 1][getColumnIndex(bHeaders, 'defenderId')];
            parts = [cId, dId];
        } else {
            // Fallback or error? Error.
            throw new Error("Cannot find battle row to identify participants");
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

        return response({ ok: true, pointsEarned: (winnerId === parts[0] ? 4 : 1) });
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
        for (let i = 1; i < invData.length; i++) {
            if (String(invData[i][iIdxTeam]).trim() === String(teamId).trim() &&
                String(invData[i][iIdxCard]).trim() === String(cardId).trim()) {
                iRow = i + 1; break;
            }
        }

        if (iRow === -1 || Number(invData[iRow - 1][iIdxQty]) < 1) return response({ ok: false, error: "Not in inventory" });

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
        for (let i = 1; i < loadoutData.length; i++) {
            if (String(loadoutData[i][idxTeam]).trim() === String(teamId).trim() && String(loadoutData[i][idxSlot]) === String(slot)) {
                lRow = i + 1; break;
            }
        }
        if (lRow !== -1) loadoutSheet.getRange(lRow, idxCard + 1).setValue(cardId);
        else loadoutSheet.appendRow([teamId, slot, cardId]);

        // Reduce Inv
        const curQty = Number(invSheet.getRange(iRow, iIdxQty + 1).getValue());
        if (curQty <= 1) invSheet.deleteRow(iRow);
        else invSheet.getRange(iRow, iIdxQty + 1).setValue(curQty - 1);

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

function reduceItemFromInventory(sheet, teamId, cardId, qty) {
    // Helper function logic mostly handled inline in equip for simplicity, 
    // but keeping signature for potential reuse if needed
}

function logAction(teamId, action, payload) {
    try {
        const sheet = getDb().getSheetByName('Logs');
        sheet.appendRow([new Date(), 'api', teamId, action, JSON.stringify(payload)]);
    } catch (e) { }
}
