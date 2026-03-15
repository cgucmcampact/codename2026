# 靈獸裝備管理系統 (Spirit Beast Equipment System)

這是一個為營隊貫穿遊戲設計的網頁系統，採用 Pixel Art 復古風格。
玩家可以登入查看自己的靈獸、管理背包、裝備卡牌並查看數值變化。
老師/管理員可以透過 Google Sheets 管理所有遊戲數據（隊伍、卡牌、庫存）。

## 🚀 快速安裝指南 (Quick Start)

### 1. 前端環境建置
確保你的電腦已安裝 [Node.js](https://nodejs.org/)。

1.  開啟終端機 (Terminal) 或 CMD。
2.  進入專案資料夾：
    ```bash
    cd "d:\宿營貫串遊戲"
    ```
3.  安裝相依套件：
    ```bash
    npm install
    ```
4.  啟動開發伺服器：
    ```bash
    npm run dev
    ```
5.  用瀏覽器開啟顯示的網址 (通常是 `http://localhost:5173`)。

> [!WARNING]
> **PowerShell 執行權限錯誤 (PSSecurityException)**
> 如果你在 Windows PowerShell 執行 `npm install` 遇到紅色錯誤訊息，請嘗試改用以下指令：
> ```bash
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```
> 輸入 `A` 同意後，再次執行 `npm install` 即可。
> 或者改用傳統 **Command Prompt (cmd)** 執行指令。

---

## 🛠 Google Sheets (資料庫) 設定指南

本系統使用 Google Sheets 當作簡易資料庫。請依照以下步驟建立：

1.  建立一個新的 Google Sheet。
2.  建立 5 個工作表 (Tabs)，名稱必須完全一致：
    *   **Teams**
    *   **Cards**
    *   **Inventory**
    *   **Loadout**
    *   **Logs**

3.  設定各工作表的首列 (Header)：

| 工作表 | 欄位 (請複製貼上到第一列) | 說明 |
| :--- | :--- | :--- |
| **Teams** | teamId, teamName, password, beastName, avatarSeed | 隊伍設定。`avatarSeed` 影響頭像長相。 |
| **Cards** | cardId, name, slot, description, atk, defense, speed, spirit, unique | 卡片圖鑑。`slot` 需對應前端設定。 |
| **Inventory** | teamId, cardId, qty | 背包紀錄。`qty` 是數量。 |
| **Loadout** | teamId, slot, cardId | 目前裝備狀況。 |
| **數值** | teamId, ATK, DEF, SPD, SPR | **(新)** 戰鬥用的總數值紀錄，自動同步。 |
| **Battles** | battleId, challengerId, defenderId, status, timestamp, log | **(新)** 對戰大廳紀錄。 |
| **Logs** | time, actor, teamId, action, payload | (選填) 系統自動寫入的操作紀錄。 |


---

## ☁️ Google Apps Script (後端 API) 部署指南

1.  在你的 Google Sheet 中，點選選單 **擴充功能 (Extensions)** > **Apps Script**。
2.  這會開啟一個新的腳本編輯器。
3.  將專案中 `backend/Code.js` 的內容完整複製，貼上覆蓋編輯器中的 `Code.gs`。
4.  建立一個新腳本檔案 (名稱取 `Impl` 或任意)，將 `backend/Impl.js` 的內容複製貼上。
5.  **重要**：在腳本中找到 `const SHEET_ID = 'YOUR_SHEET_ID_HERE';` (通常在 Code.js 或 Impl.js)，將其改為你 Google Sheet 網址中的 ID。
    *   ID 是網址 `d/` 和 `/edit` 中間的那串亂碼。
    *   或者直接使用 `SpreadsheetApp.getActiveSpreadsheet()` 則不需要 ID (目前的程式碼已預設使用 Active，所以只要腳本是從 Sheet 開啟的就不用改)。

### 部署為 Web App
1.  點選右上角的 **部署 (Deploy)** > **新增部署 (New deployment)**。
2.  左側齒輪選擇 **網頁應用程式 (Web app)**。
3.  設定如下：
    *   **說明**：Spirit Beast Backend (或是隨意)
    *   **執行身分 (Execute as)**：**我 (Me)** (非常重要！這樣才有權限讀寫你的 Sheet)
    *   **誰可以存取 (Who has access)**：**所有人 (Anyone)** (這樣前端才能呼叫)
4.  點選 **部署**。
5.  複製產生的 **網頁應用程式網址 (Web app URL)** (以 `/exec` 結尾)。

### 連接前端
1.  回到本機專案資料夾。
2.  開啟 `.env` 檔案。
3.  填入網址：
    ```ini
    VITE_GOOGLE_APP_SCRIPT_URL=https://script.google.com/macros/s/你的網址/exec
    ```
4.  重新啟動前端 (`npm run dev`)。

---

## 💊 預設裝備清單 (中西醫主題)

請將以下表格內容直接複製並貼上到 **Cards** 工作表 (從 A2 儲存格開始)。

| cardId | name | slot | description | atk | defense | speed | spirit | unique |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TCM_HEAD_01 | 銀針頭帶 | Head | 集中精神，針針入穴 | 2 | 0 | 5 | 3 | FALSE |
| WEST_BODY_01 | 白大褂 | Body | 象徵專業與潔癖的白袍 | 0 | 5 | 2 | 2 | FALSE |
| WEST_HAND_01 | 聽診器 | Hand | 聆聽心跳的律動 | 1 | 0 | 3 | 5 | FALSE |
| WEST_HAND_02 | 手術刀 | Hand | 鋒利無比，劃開病灶 | 8 | 0 | 4 | 0 | FALSE |
| TCM_ACC_01 | 醫聖葫蘆 | Accessory | 懸壺濟世，內藏靈丹 | 0 | 2 | 0 | 8 | TRUE |
| TCM_ARTI_01 | 本草綱目 | Accessory | 記載百草藥理的經典 | 0 | 5 | 0 | 10 | TRUE |
| TCM_LEGS_01 | 採藥布鞋 | Legs | 走遍名山大川也不累 | 0 | 2 | 6 | 1 | FALSE |
| WEST_ACC_01 | 點滴架 | Accessory | 隨時補充體力與水分 | 1 | 1 | -2 | 5 | FALSE |
| TCM_BODY_01 | 針灸銅人甲 | Body | 標示穴位的堅硬護甲 | 2 | 10 | -5 | 2 | FALSE |
| WEST_HEAD_01 | N95 口罩 | Head | 隔絕世間一切濁氣 | 0 | 3 | 0 | 4 | FALSE |

---

## 🎮 操作說明

### 玩家登入
*   預設在 **Teams** 表格建立一組測試帳號：
    *   teamId: `TEST01`
    *   password: `123` (若後端有啟用密碼檢查)
    *   beastName: `炎魔`
    *   avatarSeed: `TEST01`

### 裝備/卸下
1.  點選下方的裝備欄位 (例如 "Head")。
2.  點選右側背包中對應部位的卡片 (例如 "銀針頭帶")。
3.  系統會自動扣除背包數量並裝備上去，數值會即時更新。
4.  若要卸下，點選已裝備的卡片右上角的 "x" 即可。

### 管理員 (Admin)
*   目前版本主要透過直接操作 Google Sheets 進行 "發卡 (Grant)" 或 "新增卡片"。
*   例如要給 TEST01 一把手術刀：
    1.  去 **Inventory** 工作表。
    2.  新增一行：`TEST01` | `WEST_HAND_02` | `1`。

## 📂 專案檔案架構 (Project Structure)

```
宿營貫串遊戲/
├── backend/                  # Google Apps Script 後端程式碼
│   ├── CompleteCode.gs       # 完整後端邏輯 (部署時使用此檔案)
│   ├── Code.js               # (舊) 僅含路由與入口函數
│   └── Impl.js               # (舊) 實作邏輯 (已合併至 CompleteCode.gs)
├── src/                      # 前端 React 原始碼
│   ├── api/
│   │   └── client.ts         # Axios 設定與後端 API 呼叫封裝
│   ├── components/           # 共用 UI 元件
│   │   ├── PixelCard.tsx     # 像素風格卡片元件
│   │   └── PixelSlot.tsx     # 裝備欄位元件
│   ├── pages/                # 頁面元件
│   │   ├── Login.tsx         # 登入頁面
│   │   ├── Dashboard.tsx     # 玩家主控台 (裝備/背包/狀態)
│   │   └── Admin.tsx         # (開發中) 管理員後台
│   ├── types/
│   │   └── index.ts          # TypeScript 型別定義 (Team, Card, etc.)
│   ├── App.tsx               # 主應用程式路由設定
│   ├── main.tsx              # React 入口點
│   ├── index.css             # 全域樣式與像素字體設定
│   └── App.css               # 元件樣式
├── .env                      # 環境變數 (GAS URL, Admin Path)
├── start_dev.bat             # 快速啟動開發伺服器的腳本
└── README.md                 # 專案說明文件
```
