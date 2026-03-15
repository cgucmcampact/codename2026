/**
 * Spirit Beast System - Google Apps Script Backend
 * Deploy as Web App -> Execute as Me -> Access: Anyone
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
    try {
        // Determine content type
        let data;
        if (e.postData.type === 'application/json') {
            data = JSON.parse(e.postData.contents);
        } else {
            // Often sent as text/plain to avoid CORS
            data = JSON.parse(e.postData.contents);
        }

        const action = data.action;
        const payload = data.payload;

        if (action === 'login') return login(payload);
        if (action === 'equip') return equip(payload);
        // if (action === 'unequip') return unequip(payload);

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
