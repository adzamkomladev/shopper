import { spawn } from "node:child_process";
import { PrinterOffline } from "./network";
import type { ReceiptPrinter } from "./types";

// Raw bytes straight to the Windows spooler (datatype RAW), so USB printers need no driver rendering.
// The printer name comes from the environment and the bytes from stdin; neither is interpolated into the script.
const SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo { public string Name; public string Output; public string DataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern int StartDocPrinter(IntPtr handle, int level, [In] DocInfo info);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr handle);
  public static void Send(string name, byte[] bytes) {
    IntPtr handle;
    if (!OpenPrinter(name, out handle, IntPtr.Zero)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "Cannot open printer '" + name + "'");
    try {
      var info = new DocInfo { Name = "Shopper receipt", DataType = "RAW" };
      if (StartDocPrinter(handle, 1, info) == 0) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      try {
        StartPagePrinter(handle);
        int written;
        if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "Write to printer failed");
        EndPagePrinter(handle);
      } finally { EndDocPrinter(handle); }
    } finally { ClosePrinter(handle); }
  }
}
'@
$bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
[RawPrinter]::Send($env:SHOPPER_PRINTER_NAME, $bytes)
`;

export function spoolerPrinter(options: { printerName: string; shell?: string }): ReceiptPrinter {
  return {
    print: (bytes) =>
      new Promise<void>((resolve, reject) => {
        const offline = (message: string) => reject(new PrinterOffline(new Error(message)));
        if (!options.shell && process.platform !== "win32")
          return offline("USB printers need Windows");
        const child = spawn(
          options.shell ?? "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-Command", SCRIPT],
          {
            env: { ...process.env, SHOPPER_PRINTER_NAME: options.printerName },
            stdio: ["pipe", "ignore", "pipe"],
            windowsHide: true,
          },
        );
        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
        child.once("error", (cause) => reject(new PrinterOffline(cause)));
        child.once("close", (code) =>
          code === 0 ? resolve() : offline(stderr.trim() || `PowerShell exited with ${code}`),
        );
        child.stdin.on("error", () => undefined); // surfaced through the exit code
        child.stdin.end(Buffer.from(bytes).toString("base64"));
      }),
  };
}
