---
title: IME変換入力をテストする
description: 日本語・中国語・韓国語のテキスト入力をテストします — 変換イベント、候補の確定、そしてCJKユーザーだけが遭遇するバグ。
sidebar:
  order: 4
---

**ユースケース:** アプリに検索ボックス、エディタ、フォームがある。そして日本のユーザーはIME(Input Method Editor)を通して入力します。`nihongo` とタイプすると下線つきの未確定文字列 `にほんご` が表示され、確定すると `日本語` になります。オートコンプリートのドロップダウン、文字数カウンタ、`Enter` での送信ハンドラは、*変換中に限って*壊れることが珍しくありません。

> ▶ **動くサンプル**: [`test-ime-composition.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/complex-ui/test-ime-composition.spec.ts)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

- `page.fill()` と `keyboard.insertText()` は**変換イベントを一切発火させずに**値をセットします。IMEユーザーが実際に通るコードパス(`compositionstart` → `compositionupdate` → `compositionend`)は一度も実行されません。
- `keyboard.type()` は1文字ずつキーイベントを発火しますが、やはり変換イベントは発生しません。
- 定番のバグ — 変換中の `Enter` が候補の確定ではなくフォームを送信してしまう — は、上記のどの方法でも検出できません。

## レシピ

### Chromium: CDPで本物の変換を駆動する

ChromiumのDevToolsプロトコルはIMEの機構そのものを駆動できます。

```ts
import { test, expect } from '@playwright/test';

test('変換中のEnterで送信されないこと', async ({ page }) => {
  await page.goto('/search');
  await page.locator('#q').click();

  const cdp = await page.context().newCDPSession(page);

  // 変換開始: フィールドに下線つきの未確定文字列が表示される
  await cdp.send('Input.imeSetComposition', {
    text: 'にほんご',
    selectionStart: 4,
    selectionEnd: 4,
  });

  // ここでのEnterは「候補の確定」であって「フォームの送信」ではない
  await cdp.send('Input.insertText', { text: '日本語' }); // compositionend

  await expect(page.locator('#q')).toHaveValue('日本語');
  await expect(page).toHaveURL(/\/search$/);  // 送信は起きていない
});
```

### クロスブラウザ: 変換イベントをディスパッチする

Firefox/WebKitには相当するCDPの口がありません。イベント列のディスパッチなら、アプリ側のリスナーは実行できます(ただしブラウザ自身のIME内部処理は通りません)。

```ts
await page.locator('#q').evaluate((el: HTMLInputElement) => {
  const fire = (type: string, data: string) =>
    el.dispatchEvent(new CompositionEvent(type, { data, bubbles: true }));
  el.focus();
  fire('compositionstart', '');
  for (const chunk of ['に', 'にほ', 'にほん', 'にほんご']) {
    fire('compositionupdate', chunk);
    el.value = chunk;
    el.dispatchEvent(new InputEvent('input', { data: chunk, inputType: 'insertCompositionText', bubbles: true }));
  }
  el.value = '日本語';
  fire('compositionend', '日本語');
  el.dispatchEvent(new InputEvent('input', { data: '日本語', inputType: 'insertCompositionText', bubbles: true }));
});
```

### 何をアサーションすべきか

バグが潜むのは最終的な値ではなく、相互作用の中です。

- **変換中のEnter/Escape** — 候補の確定/キャンセルであるべきで、送信やダイアログを閉じる動作になってはいけません(変換中の `keydown` は `isComposing: true` かつレガシーな `keyCode === 229` を持ちます。どちらも見ていないコードはバグっています)。
- **文字数カウンタとバリデーション** — 未確定文字列をカウントしてはいけない、あるいは `compositionend` 後に正しい値に落ち着くこと。
- **オートコンプリート** — `にほ`(未確定)で検索すべきか、確定済みテキストだけで検索すべきか。仕様がどちらであれ、その通りに動くことを検証します。
- **`maxlength` つきフィールド** — 変換中は一時的に上限を超えることがあります。確定時に壊れた切り詰め方をしないこと。

## 注意点

- `Input.imeSetComposition` はChromium限定です。イベントディスパッチ方式はどこでも動きますが、ブラウザ自身のIME配管はバイパスします — 可能なら両方使ってください。
- IMEシミュレーションをすべてのテストに振りかけないこと。テキスト入力面ごとに焦点を絞ったスイートをひとつ用意すれば、この種のバグは捕まえられます。

## 関連レシピ

- [canvas描画をテストする](../test-canvas-rendering/) — テキストを自前で描画するエディタは、両方の問題に同時にぶつかります。
