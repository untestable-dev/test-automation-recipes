---
title: Windowsネイティブアプリのテスト
description: WPF・WinForms・WinUIアプリをUI Automation経由で自動化する——DOMもブラウザもなくても、テストはできる。
sidebar:
  order: 5
---

**ユースケース:** プロダクトの一部がWindowsデスクトップアプリ——POSクライアント、デバイス設定ツール、インストーラー、レガシーなWPF管理画面。ブラウザもDOMもなく、Web用のツールは一切通用しません。それでもリグレッションテストは必要です。

> ▶ **動くサンプル**: [`examples/windows-flaui`](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples/windows-flaui)(実行方法は [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme))

## なぜ難しいのか

- PlaywrightやSeleniumが操作するのは*ブラウザ*です。ネイティブウィンドウにDOMはなく、代わりにWindowsは **UI Automation(UIA)ツリー** を公開しています。
- 定番だったWinAppDriverは実質メンテナンス停止。行き止まりの上に構築を続けているチームが少なくありません。
- 要素を特定できるのは開発者が **AutomationId**——Windows界の `data-testid`——を設定している場合だけ。そして大半のコードベースは設定していません。
- CIは容赦がありません。UIAには実際にロック解除された対話型デスクトップセッションが必要で、画面がロックされているとすべてのクリックが失敗します。

## レシピ

### .NETアプリなら: FlaUI

[FlaUI](https://github.com/FlaUI/FlaUI)はUIA3の上に構築された、活発にメンテナンスされている.NETライブラリです。アプリ(またはチーム)が.NETなら最も堅実な選択です:

```csharp
using FlaUI.Core;
using FlaUI.UIA3;

using var app = Application.Launch(@"C:\app\PosClient.exe");
using var automation = new UIA3Automation();
var window = app.GetMainWindow(automation);

window.FindFirstDescendant(cf => cf.ByAutomationId("AmountInput"))
      .AsTextBox().Enter("1980");
window.FindFirstDescendant(cf => cf.ByAutomationId("ChargeButton"))
      .AsButton().Invoke();

var receipt = window.FindFirstDescendant(cf => cf.ByAutomationId("ReceiptView"));
Assert.Contains("¥1,980", receipt.AsLabel().Text);
```

xUnit/NUnitなど通常の.NETテストフレームワークで実行でき、普通のテストツールチェーン(リトライ・レポート)がそのまま使えます。

### 言語を問わないなら: Appium Windows Driver

テストスタックがJS/Pythonで、モバイルとデスクトップをAppiumの1つの屋根の下にまとめたいなら、[Appium Windows Driver](https://github.com/appium/appium-windows-driver)が同じUIAレイヤーを操作します:

```ts
const driver = await remote({
  capabilities: {
    platformName: 'Windows',
    'appium:automationName': 'Windows',
    'appium:app': 'C:\\app\\PosClient.exe', // ストアアプリならAppUserModelID
  },
});
await driver.$('~AmountInput').setValue('1980');  // ~ = accessibility id = AutomationId
await driver.$('~ChargeButton').click();
```

(Pythonでさっと書くなら、`backend="uia"` を指定した[pywinauto](https://pywinauto.readthedocs.io/)が同じ領域をカバーします。)

### まずアプリをテスト可能にする

- **Accessibility Insights for Windows** でUIAツリーを調べます。ネイティブアプリ版のDevTools インスペクタです。
- 要素が名無しで並ぶなら、XAMLに `AutomationProperties.AutomationId` を(WinFormsなら `Control.Name` を)追加してもらいましょう。これが最もレバレッジの効く1手で、スクリーンリーダー対応も同時に改善します。
- 独自描画のコントロール(オーナードローのグリッド、ゲーム的なキャンバス)はUIAに存在しません。ピクセル技法——スクリーンショット+許容差付き比較——にフォールバックします。やり方は[canvasのテスト](../../complex-ui/test-canvas-rendering/)と同じです。

### 実際にクリックできるCI

UIAの入力には**ロック解除された対話型デスクトップ**が必要です:

- 自動ログオン+画面ロック無効にしたセルフホストのWindows VMが確実な構成です。
- 共有ランナーではセッションを維持する(`tscon` でコンソールに戻すトリック)か、接続しっぱなしのRDPセッション内で実行します。
- 実行ごとに画面録画を残しましょう(`ffmpeg -f gdigrab …`)。クリックが虚空に消えたときのトレースビューアになります。

## 注意点

- 座標クリックは避けてください。DPIスケーリングやテーマ変更で壊れます。UIA要素+`Invoke`などのパターンはUIの見た目替えを生き延びます。
- WebView2/Electronのハイブリッド構成では、Web部分はPlaywright(CDP接続)で、ネイティブのシェルだけをUIAで自動化します。HTMLをUIA経由で操作してはいけません——あのツリーは悲惨です。
- OS由来のダイアログ(ファイル選択、UAC)はアプリのプロセス外にいます。デスクトップルートから探すこと、テストマシンではUACプロンプトを無効にしておくことを忘れずに。

## 関連レシピ

- [canvasのテスト](../../complex-ui/test-canvas-rendering/) — 独自描画コントロールへのピクセル技法。
- [Webとモバイルを横断するテスト](../test-across-web-and-mobile/) — 同じオーケストレーション発想の「2台目」違い。
