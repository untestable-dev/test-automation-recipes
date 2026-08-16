---
title: canvas描画をテストする
description: チャート、WebGLシーン、ドローイングアプリ — UIがDOMではなくピクセルでできている場合のアサーション手法です。
sidebar:
  order: 3
---

**ユースケース:** チャートライブラリ、ダイアグラムエディタ、WebGLの商品コンフィギュレータ、ドローイングアプリ。検証すべきものは*描画されて*いて、DOMには存在しない — `page.locator()` に見えるのは大きな `<canvas>` がひとつだけで、その中身は見えません。

> ▶ **動くサンプル**: [`test-canvas-rendering.spec.ts`](https://github.com/untestable-dev/test-automation-recipes/blob/main/examples/tests/complex-ui/test-canvas-rendering.spec.ts) / [デモを触る](https://demo.untestable.dev/apps/chart/)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

- 要素もテキストもARIAツリーも(たいてい)ない — 標準のツールキットが機能しなくなります。
- canvasの出力は**環境依存**です。GPU、アンチエイリアス、フォントのラスタライズがマシンごとに異なるため、素朴なスクリーンショット比較はフレーキーになります。
- アニメーションとトランジションがあるため、どのピクセルが見えるかは*いつ*見るかに依存します。

## レシピ

### 1. まずレンダリングを決定論的にする

スクリーンショットのアサーションは、同じ入力が同じピクセルを描く場合にしか機能しません。

```ts
// 時間駆動のアニメーションを固定する(Playwright組み込みのフェイククロック)
await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });

// アプリ読み込み前に乱数をシードする
await page.addInitScript(() => {
  let seed = 42;
  Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
});

// CSSアニメーション・トランジションのノイズを無効化する
await page.emulateMedia({ reducedMotion: 'reduce' });
```

WebGLでは、全マシンで同一のラスタライズ結果を得るためにCIではソフトウェアレンダリングを使ってください: `--use-gl=swiftshader`(Chromium)。

### 2. 許容差とマスクつきのスクリーンショットアサーション

```ts
await expect(page.locator('#chart')).toHaveScreenshot('revenue-chart.png', {
  maxDiffPixelRatio: 0.01,       // アンチエイリアス差を吸収する
  mask: [page.locator('.live-timestamp')],
});
```

ベースラインは手元のマシンではなく*CIと同じ環境*で生成してください(例: Dockerイメージ経由)。プラットフォーム間のフォントレンダリング差は、偽陽性の差分の筆頭原因です。

### 3. 全体比較ではなくピクセルを突く

「3本目のバーが赤くて2本目より高い」のような検証では、canvasを直接サンプリングするほうが全画像比較よりはるかに堅牢です。

```ts
const barColor = await page.evaluate(() => {
  const canvas = document.querySelector('#chart canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const [r, g, b] = ctx.getImageData(260, 180, 1, 1).data;
  return { r, g, b };
});
expect(barColor.r).toBeGreaterThan(200);  // 赤系であること
```

WebGLのcanvasをこの方法で読むには `preserveDrawingBuffer: true` が必要です。あるいは要素のスクリーンショットを撮り、Node側でPNGをデコードしてください。

### 4. データレイヤーがあるならそちらで検証する

多くのチャートライブラリは内部モデルを公開しています(`chart.getDatasetMeta(...)`、three.jsのシーングラフなど)。「モデルが描画されていること」はピクセルでテストし、「*値*が正しいこと」はモデルで検証する — 「正しく描けているか」と「データが正しいか」を分離すれば、フレーキーさの大半は消えます。

### 動くcanvas: フレームではなく動きを計測する

*動く*canvas(パン・ズーム、物理演算)では単発のスクリーンショットは不適切です。代わりに位相相関で画像の移動量を計測し、視覚的な安定を待ってください。それをパッケージにしたのが [playwright-interactive-ui-test](https://github.com/tsuemura/playwright-interactive-ui-test) です — [慣性つき地図UIをテストする](../test-map-uis/)を参照してください。

## 注意点

- `getImageData` は汚染された(tainted)canvasでは失敗します(CORSヘッダなしのクロスオリジン画像)。
- ヘッドレスとヘッドありでレンダリングが異なることがあります。ベースラインはどちらか一方に決めて固定してください。
- ピクセルパーフェクトを追いかけないこと。許容差+狙い撃ちのサンプリングは、`maxDiffPixels: 0` と古くなったベースラインの墓場に勝ります。

## 関連レシピ

- [慣性つき地図UIをテストする](../test-map-uis/) — インタラクティブ・慣性ありの場合。
- [トーストとちらつきを捕まえる](../catch-toasts-and-flicker/) — ピクセルが*陰で*変わっている場合。
