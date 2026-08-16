using System;
using System.Globalization;
using System.Windows.Forms;

namespace DemoApp;

// A tiny point-of-sale window. Control.Name becomes the UIA AutomationId —
// that's what the FlaUI tests locate elements by.
static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();

        var form = new Form { Text = "PosClient", Width = 420, Height = 260 };

        var amount = new TextBox { Name = "AmountInput", Left = 20, Top = 20, Width = 200 };
        var charge = new Button { Name = "ChargeButton", Text = "Charge", Left = 240, Top = 18 };
        var receipt = new Label { Name = "ReceiptView", Left = 20, Top = 70, Width = 360, Height = 100, Text = "" };

        charge.Click += (_, _) =>
        {
            if (decimal.TryParse(amount.Text, out var value))
            {
                receipt.Text = $"Charged ¥{value.ToString("N0", CultureInfo.InvariantCulture)}\nThank you!";
            }
            else
            {
                receipt.Text = "Invalid amount";
            }
        };

        form.Controls.AddRange(new Control[] { amount, charge, receipt });
        Application.Run(form);
    }
}
