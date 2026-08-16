---
title: トーストとちらつきを捕まえる
description: 成功トースト、一瞬だけ表示されるエラー画面、遅れてくるレイアウトシフト — アサーションより速く消えてしまうUIを検証します。
sidebar:
  order: 2
---

**ユースケース:** *保存*をクリックすると2秒間トーストが表示される。もっと厄介なケースでは、画面遷移中にエラー画面が300msだけ表示される、バリデーションメッセージが勝手に消える、ページが完成して見えた*後に*レイアウトが跳ねる。**見に行った頃にはもう消えている**ものを検証しなければなりません。

> ▶ **動くサンプル**: [`catch-toasts-and-flicker.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/complex-ui/catch-toasts-and-flicker.spec.ts) / [デモを触る](https://demo.untestable.dev/apps/toasts/)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

- `expect(toast).toBeVisible()` はトーストとの競走になります。何かの理由でアサーションが遅れれば(CIの負荷、遅いセレクタ)、トーストは消えていてテストはフレーキーになります。
- トーストが表示され**なかった**こと、エラー画面が一瞬**表示されなかった**ことのアサーションはさらに困難です。アクション後のスクリーンショットは、その*最中に*何が起きたかについて何も証明しません。
- 動画を録って目視する方法はスケールせず、全フレームを差分してアサーションに使うのはそれ自体が一大プロジェクトです。

## レシピ

[agent-screen-observer](https://www.npmjs.com/package/agent-screen-observer) は画面をストリームとして監視し(CDPスクリーンキャスト — フレームはページの再描画時にのみ届きます)、アクション前のベースラインと全フレームを古典的なコンピュータビジョンで差分し、**視覚イベント**を報告します。現れて消えたもの、一瞬通過した画面、動き続けている領域などです。

```sh
npm install -D agent-screen-observer
```

### Playwrightフィクスチャで設定いらず

```ts
import { test, expect } from 'agent-screen-observer/playwright';

test('can save', async ({ page }) => {
  await page.goto('/editor');
  await page.click('#save');                       // 自動的に観測される
  await expect(page.locator('h1')).toBeVisible();  // アサーションは今まで通り
});
```

デフォルトでは、視覚的な検出結果(一時表示要素、一瞬表示された画面)をテストを失敗させずに警告として*報告*します。既存のスイートに取り付けるだけで、あなたのUIが陰で何をしていたかが見えてきます。

### 一時表示UIへの本気のアサーション

トースト*そのもの*がテスト対象なら、コアAPIを使います。

```ts
import { test, expect } from '@playwright/test';
import { ScreenObserver } from 'agent-screen-observer';

test('保存すると確認トーストが表示される', async ({ page }) => {
  await page.goto('/editor');
  const observer = await ScreenObserver.attach(page, { outDir: 'out/save-toast' });

  const report = await observer.observe('click Save', () => page.click('#save'));

  // トースト = アクション後に現れて、また消えたもの。
  const toast = report.events.find((e) => e.type === 'transient_element');
  expect(toast, report.summary).toBeTruthy();
  expect(toast!.appearedAtMs).toBeLessThan(1000);   // すみやかに表示されたこと

  await observer.detach();
});
```

レポートは**不在**の証明にも使えます。ナビゲーション中にエラー画面が一瞬も表示されなかったこと:

```ts
const report = await observer.observe('submit order', () =>
  page.click('#place-order'),
);
const nav = report.events.find((e) => e.type === 'full_screen_change');
// states = 通過した画面状態のタイムライン。3以上なら何かが一瞬表示されている。
expect(nav?.states?.length ?? 0, report.summary).toBeLessThanOrEqual(2);
```

すべての観測は証拠を `outDir` に書き出します。変化領域ごとのクロップ、中間画面のキーフレーム、前後のフルスクリーンショット、そして人間のレビュー用に実時間の `replay.gif` です。

### 遅れてくるレイアウトシフトを捕まえる(フレーキーの温床)

`report.settled` / `settleTimeMs` は画面が*本当に*変化しなくなった時刻を教えてくれます。アクティビティバーストは段階的レンダリング — ページが「完成して見えた」1〜2秒後にコンテンツが飛び込んでくる現象 — を暴きます。これこそが、20回に1回 `click()` が別の要素に当たるページの正体です。[フレーキーテストを自動修復する](../../strategy/auto-repair-flaky-tests/)を参照してください。

## 注意点

- キャプチャは**Chromium限定**です(CDPスクリーンキャスト)。
- 動き続ける領域(スピナー、動画、カルーセル)は自動的にマスクされ、`animated_region` として一度だけ報告されます。静定の判定やイベントを汚しません。
- 検出は決定論的なピクセル差分で、LLMは関与しません。UIをAIエージェントで操作している場合は、1行のテキストサマリーをそのまま安価に渡せる設計です(スクリーンショット1枚の約1,200トークンに対して数十トークン)。

## 関連レシピ

- [フレーキーテストを自動修復する](../../strategy/auto-repair-flaky-tests/) — オブザーバーのレポートをフレーク診断に使う。
- [慣性つき地図UIをテストする](../test-map-uis/) — インタラクティブUIのピクセルベース観測。
