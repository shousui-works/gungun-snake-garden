# ぐんぐん ヘビの庭：共有ランキング

ゲーム本体は https://shousui-works.github.io/gungun-snake-garden/ で公開します。
このサービスはSitesのCloudflare WorkerとD1を使い、難易度別の記録を共有します。

## データとAPI

- `POST /api/runs`：難易度を指定し、今回のプレイに結び付いた一度だけ使えるチケットを発行。
- `POST /api/records`：チケット、ニックネーム、レベル、経験値、プレイ秒数を送信。
- `GET /api/leaderboard?difficulty=normal`：上位20件と本人の自己ベストを取得。
- `DELETE /api/records?difficulty=normal`：本人のその難易度の記録を削除。
- 書き込みにはブラウザで生成した256bitのランダムキーをBearerヘッダーで送信。DBにはそのSHA-256ハッシュを保存し、他人の記録を書き換えられないようにします。
- 名前は1〜12文字。HTMLとして表示せず、ブラウザではtextContentで表示します。メールアドレスや本名は不要です。
- レベル、次のレベルまでの経験値の順。同点は同順位。スコアは累積経験値 `(level - 1) * (level + 3) + xp` です。
- 同じブラウザの同じ難易度は1件だけ。低い成績を送っても自己ベストは下がりません。ニックネームは最後の登録で更新されます。
- CORSはゲームのGitHub Pagesと同一サイトに限定。ブラウザキーや内部の所有者IDはランキングの応答に含めません。
- プレイチケットは48時間有効。古いチケットは新規プレイ時に最大1000件ずつ削除。同じキーで5分間に20回を超える開始を制限します。

これは子ども向けの気軽なランキングです。チケット、入力範囲、プレイ時間との整合性を検証しますが、ゲーム自体はクライアントで動くため、改造されたクライアントの不正な記録を完全には防げません。賞品付きの大会向けの検証ではありません。ブラウザデータを消した場合や別端末では別のプレイヤーとして扱います。

## 開発・検証

SitesのVinextスターターと実行プロファイルを維持します。Node.js 24を使用します。

```sh
node --test tests/*.test.mjs
npm run db:generate
npm run build
npm run dev
```

マイグレーションは`drizzle/`に保存します。適用済みSQLやスナップショットは編集せず、新規マイグレーションを追加します。ローカルDBへの適用とSitesでの公開にはSitesスキルの手順を使います。DBのデータや認証キーはGitに保存しません。

公開先は https://gungun-snake-garden-ranking.loyal-wave-1919.chatgpt.site です。GitHub内の`ranking-service/`にはこのサービスの公開ソースを保存します。GitHub Pagesはゲーム本体だけを配信するため、サービス変更はSites側にも公開する必要があります。
