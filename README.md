# 追匿 (`pg-huntshade`)

**1 追捕 vs 3 逃亡**的不對稱俯視追逃。選擇扮演追捕者或逃亡者，其餘由 AI；單機完整可玩，無 Invite 依賴。

## 玩法

- **追捕**：90 秒內抓完三名匿者；技能＝全圖短暫掃描。
- **逃亡**：撐到時間結束或踩綠色出口脫身；技能＝影遁衝刺（獵人短暫看不到你）。
- 鍵盤 WASD／方向鍵＋Shift 技能；手機左下類比搖桿＋右下技能鍵。

## 開發

```bash
npx vitest run
```

純 HTML／CSS／JS，無 build。Playgrounds／go 畫布執行時由宿主注入 `window.PG`。

## 署名

見 [ATTRIBUTION.md](./ATTRIBUTION.md)。
