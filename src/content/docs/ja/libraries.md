---
title: 注目ライブラリ
description: このサイトのレシピを支えているオープンソースライブラリの紹介です。
---

このサイトのいくつかのレシピは、小さく焦点の絞られたオープンソースライブラリの上に成り立っています。どれも「レシピに必要だったから生まれた」ものです — それぞれが、難しい問題をちょうど1つずつ解決します。

## playwright-audio-mocking

任意の音声ファイルを、PlaywrightからWebサイトのマイク(`getUserMedia()`)に流し込みます — **Chromium・Firefox・WebKit**対応、実行時の `play` / `pause` / `stop` / `loop` 制御つき。

Chromium組み込みのフェイク音声フラグはWAVのみ・Chromium限定で、実行時にファイルを切り替えられません。このライブラリは `getUserMedia` を実際のWeb Audioベースの `MediaStream` に置き換えるため、`MediaRecorder`、アナライザー、WebRTC、音声認識のすべてが無改造で動きます。

- npm: [playwright-audio-mocking](https://www.npmjs.com/package/playwright-audio-mocking)
- GitHub: [tsuemura/playwright-audio-mocking](https://github.com/tsuemura/playwright-audio-mocking)
- 使用レシピ: [マイク入力をモックする](../recipes/media/mock-microphone-input/)、[WebRTC通話をテストする](../recipes/media/test-webrtc-calls/)

## agent-screen-observer

テスト(またはAIエージェント)がUIを操作している間、画面を監視し続けます。そして**視覚イベント** — フェードアウトしていくトースト、一瞬だけ表示されるエラー画面、遅発のレイアウトシフト、アニメーションし続ける領域 — を、必要に応じて画像の証拠を添えられるコンパクトなテキストとしてレポートします。

CDPスクリーンキャスト上で古典的なコンピュータビジョン(アクション直前のベースラインとのピクセル差分)を使うため、検出は決定論的です: LLMなし、フレームレートの推測なし。1行のサマリーはスクリーンショットをストリームする代わりに数十トークンで済みます。

- npm: [agent-screen-observer](https://www.npmjs.com/package/agent-screen-observer)
- GitHub: [tsuemura/agent-screen-observer](https://github.com/tsuemura/agent-screen-observer)
- 使用レシピ: [トーストとちらつきを捕まえる](../recipes/complex-ui/catch-toasts-and-flicker/)、[フレーキーテストを自動修復する](../recipes/strategy/auto-repair-flaky-tests/)

## playwright-interactive-ui-test

**インタラクティブ性の高いUI** — 慣性つきの地図パン、canvas描画、物理アニメーション — を、アプリのDOMやJavaScriptに一切触れずにテストするための実験的ツールキットです。観測はすべてピクセルベース: 速度プロファイル付きのジェスチャ合成、ビューが実際にどれだけ動いたかを測る位相相関によるvisual odometry、そして狙ったピクセル距離ちょうどだけパンする閉ループ制御。

- GitHub: [tsuemura/playwright-interactive-ui-test](https://github.com/tsuemura/playwright-interactive-ui-test) *(実験的)*
- 使用レシピ: [地図UIをテストする](../recipes/complex-ui/test-map-uis/)、[canvas描画をテストする](../recipes/complex-ui/test-canvas-rendering/)
