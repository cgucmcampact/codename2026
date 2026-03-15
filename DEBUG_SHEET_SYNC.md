# Debug 指南 - Sheet 同步問題排查

## 問題現象
用戶反映：拆卸卡牌後，前端顯示已卸除，但 Google Sheets 上的 Loadout 和 Inventory 工作表沒有更新。

## 可能原因分析

### 1. 樂觀更新遮蔽了錯誤
前端採用了 Optimistic Update，會在後端回應之前先更新 UI。即使後端失敗，用戶也可能看到「卸除成功」的訊息。

### 2. 瀏覽器開發者工具檢查
打開瀏覽器的開發者工具（F12），在 Console 面板中查看：
- 尋找 `[UNEQUIP] Backend Response:` 訊息
- 檢查是否有紅色錯誤訊息
- 查看 Network 面板，檢查對 GAS 的 POST 請求

### 3. Google Apps Script 執行日誌
1. 開啟 Google Sheet → Extensions → Apps Script
2. 左側點選「執行作業」(Executions)
3. 查看最近的執行紀錄，看是否有失敗或錯誤訊息

### 4. Logs 工作表檢查
檢查 Google Sheets 的 `Logs` 工作表：
- 如果有 `unequip` 動作紀錄 → 表示後端有執行
- 如果沒有 → 表示請求可能沒到達後端

## 檢查清單

- [ ] 瀏覽器 Console 是否有錯誤？
- [ ] Network 請求是否成功回傳 200？
- [ ] GAS Executions 是否有錯誤？
- [ ] Logs 工作表是否有記錄？
- [ ] Loadout 工作表的欄位名稱是否正確？(`teamId`, `slot`, `cardId`)
- [ ] Inventory 工作表的欄位名稱是否正確？(`teamId`, `cardId`, `qty`)

## 臨時解法
使用剛才新增的「刷新」按鈕手動同步資料。
