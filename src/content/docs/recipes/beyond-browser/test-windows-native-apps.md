---
title: Test Windows native apps
description: Automate WPF, WinForms and WinUI applications through UI Automation — no DOM, no browser, still testable.
sidebar:
  order: 5
---

**Use case:** part of your product is a Windows desktop application — a point-of-sale client, a device-configuration tool, an installer, a legacy WPF admin app. No browser, no DOM, and none of your web tooling applies. It still needs regression tests.

> ▶ **Runnable sample**: [`examples/windows-flaui`](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples/windows-flaui) — how to run: [examples/README](https://github.com/untestable-dev/test-automation-recipes/tree/main/examples#readme)

## Why this is hard

- Playwright, Selenium and friends drive *browsers*. A native window has no DOM — instead Windows exposes a **UI Automation (UIA) tree** of elements.
- The classic tool, WinAppDriver, is effectively unmaintained; teams keep building on a dead end.
- Elements are only findable if developers set **AutomationIds** — the `data-testid` of the Windows world — and most codebases haven't.
- CI is unforgiving: UIA needs a real, unlocked, interactive desktop session; a locked screen makes every click fail.

## Recipe

### .NET apps: FlaUI

[FlaUI](https://github.com/FlaUI/FlaUI) is the actively maintained .NET library over UIA3 — the most robust choice when your app (or your team) is .NET:

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

Run it with any .NET test framework (xUnit/NUnit) — you get normal test tooling, retries and reports.

### Any language: Appium Windows Driver

If your test stack is JS/Python and you want one Appium roof over mobile and desktop, the [Appium Windows Driver](https://github.com/appium/appium-windows-driver) drives the same UIA layer:

```ts
const driver = await remote({
  capabilities: {
    platformName: 'Windows',
    'appium:automationName': 'Windows',
    'appium:app': 'C:\\app\\PosClient.exe', // or an AppUserModelID for Store apps
  },
});
await driver.$('~AmountInput').setValue('1980');  // ~ = accessibility id = AutomationId
await driver.$('~ChargeButton').click();
```

(For quick Python scripts, [pywinauto](https://pywinauto.readthedocs.io/) with `backend="uia"` covers the same ground.)

### Make the app testable first

- Inspect the UIA tree with **Accessibility Insights for Windows** — it's the devtools inspector for native apps.
- If elements show up nameless, add `AutomationProperties.AutomationId` in XAML (or `Control.Name` in WinForms). This is the single highest-leverage change; it also improves screen-reader accessibility for free.
- Custom-drawn controls (owner-drawn grids, game-like canvases) have no UIA presence — fall back to pixel techniques: screenshots + tolerant comparison, exactly as in [canvas testing](../../complex-ui/test-canvas-rendering/).

### CI that actually clicks

UIA input requires an **unlocked interactive desktop**:

- Self-hosted Windows VM with auto-logon and screen lock disabled is the reliable setup.
- On shared runners, keep the session alive (`tscon`-to-console trick) or run inside an RDP session that stays connected.
- Record a screen capture per run (`ffmpeg -f gdigrab …`) — it's your trace viewer when a click lands in the void.

## Caveats

- Avoid coordinate-based clicking; DPI scaling and theme changes break it. UIA elements + `Invoke`/patterns survive UI facelifts.
- WebView2/Electron hybrids: automate the web part with Playwright (attach via CDP) and only the native shell via UIA — don't drive HTML through UIA, the tree is miserable.
- Dialogs from the OS (file pickers, UAC) live outside your app's process; find them from the desktop root, and disable UAC prompts on test machines.

## Related

- [Test canvas rendering](../../complex-ui/test-canvas-rendering/) — pixel fallbacks for custom-drawn controls.
- [Test journeys across web and mobile](../test-across-web-and-mobile/) — the same orchestration idea, different second device.
