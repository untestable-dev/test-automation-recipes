---
title: クリップボード操作をテストする
description: コピーボタン、ペースト処理、リッチなクリップボード形式をブラウザ横断で検証します。
sidebar:
  order: 3
---

**ユースケース:** 「リンクをコピー」ボタン、セルのペーストを受け付けるスプレッドシートグリッド、Wordのマークアップを整形してくれるエディタ。コピー&ペーストは中核的なインタラクションでありながら、自動化できるものの中で最もブラウザ間の差異が大きい部類です。

> ▶ **動くサンプル**: [`test-clipboard.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/beyond-browser/test-clipboard.spec.ts) / [デモを触る](https://demo.untestable.dev/apps/clipboard/)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

クリップボードは**システム**リソースで、ブラウザごとに異なるパーミッションとユーザーアクティベーションのルールに守られています。Playwrightにはクリップボードの第一級APIがなく、Chromiumで動くコードがWebKitでは静かに失敗します。

## レシピ

### Chromium: パーミッションを付与して非同期APIを使う

```ts
import { test, expect } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('copy button puts the share URL on the clipboard', async ({ page }) => {
  await page.goto('/document/42');
  await page.getByRole('button', { name: 'Copy link' }).click();

  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toBe('https://example.com/s/abc123');
});
```

### ペーストのテスト

本物のペースト＝クリップボードの内容＋pasteイベントです。クリップボードに書き込んでから、実際のキーボードショートカットを送ってアプリの `paste` リスナーを発火させます:

```ts
test('pasting cells fills the grid', async ({ page }) => {
  await page.goto('/sheet');
  await page.evaluate(() =>
    navigator.clipboard.writeText('1\t2\n3\t4'),   // スプレッドシートのコピーと同じTSV形式
  );

  await page.locator('.cell-a1').click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+v' : 'Control+v');

  await expect(page.locator('.cell-b2')).toHaveText('4');
});
```

リッチ形式（WordからのHTMLペースト、画像）は `DataTransfer` を自分で組み立ててイベントをディスパッチします。この方法ならパーミッションプロンプトも完全に回避できます:

```ts
await page.locator('#editor').evaluate((el) => {
  const dt = new DataTransfer();
  dt.setData('text/html', '<b>bold</b> from Word<o:p></o:p>');
  dt.setData('text/plain', 'bold from Word');
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
await expect(page.locator('#editor strong')).toHaveText('bold');
```

### FirefoxとWebKit

`permissions: [...]` によるクリップボード付与はChromium限定です。移植可能な選択肢は:

- **`ClipboardEvent` をディスパッチする**（上記） — すべてのブラウザでアプリのハンドラをテストできます。実クリップボードは経由しません。
- **Firefox**: テスト用プリファレンスを有効化 — `firefoxUserPrefs: { 'dom.events.testing.asyncClipboard': true }`。
- **WebKit**: 読み取りにはユーザーアクティベーションが必要です。イベントディスパッチ方式が現実的な選択肢です。

よくあるパターンは、Chromiumで実クリップボードの完全なカバレッジを取り、同じ機能をブラウザ横断ではイベントレベルでカバーする構成です。

## 注意点

- クリップボードの状態は同一コンテキスト内のテスト間でリークします。`beforeEach` で既知の値を書き込むか、新しいコンテキストを使ってください。
- ユーザーアクティベーションの判定はヘッドありとヘッドレスで挙動が異なります。グリーンにすべき環境はCIのヘッドレスです。
- *ホストマシンの*クリップボード（OSユーティリティ経由）に対するアサートは絶対に避けてください。並列ワーカーが取り合いになります。

## 関連レシピ

- [IME変換入力をテストする](../../complex-ui/test-ime-composition/) — もう一つの「システムのテキスト入力」レシピ。
