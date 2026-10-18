import { spawn } from "node:child_process";
import { PrinterOffline, PrinterUncertain } from "./errors";
import type { ReceiptPrinter } from "./types";

// Raw bytes straight to the Windows spooler (datatype RAW), so USB printers need no driver rendering.
// The printer name comes from the environment and the bytes from stdin; neither is interpolated into the script.
const UNCERTAIN_EXIT = 3; // the script exits 3 when the job had started: it may be partly printed
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
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool AbortPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr handle);
  public static bool Started;
  static Exception Fail(string message) { return new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), message); }
  public static void Send(string name, byte[] bytes) {
    IntPtr handle;
    if (!OpenPrinter(name, out handle, IntPtr.Zero)) throw Fail("Cannot open printer '" + name + "'");
    try {
      var info = new DocInfo { Name = "Shopper receipt", DataType = "RAW" };
      if (StartDocPrinter(handle, 1, info) == 0) throw Fail("Cannot start the print job");
      var done = false;
      try {
        if (!StartPagePrinter(handle)) throw Fail("Cannot start the page");
        Started = true;
        int written;
        if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length) throw Fail("Write to printer failed");
        if (!EndPagePrinter(handle)) throw Fail("Cannot end the page");
        done = true;
      } finally {
        if (done) { if (!EndDocPrinter(handle)) throw Fail("Cannot finish the print job"); }
        else AbortPrinter(handle);
      }
    } finally { ClosePrinter(handle); }
  }
}
'@
$bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
try { [RawPrinter]::Send($env:SHOPPER_PRINTER_NAME, $bytes) }
catch { [Console]::Error.WriteLine($_.Exception.Message); exit $(if ([RawPrinter]::Started) { ${UNCERTAIN_EXIT} } else { 2 }) }
`;

const encoded = Buffer.from(SCRIPT, "utf16le").toString("base64");

/** Windows PowerShell by absolute path: a service or kiosk PATH may lack System32, and PATH can be planted. */
export const windowsPowerShell = `${process.env.SystemRoot ?? "C:/Windows"}/System32/WindowsPowerShell/v1.0/powershell.exe`;

/**
 * Failing before the job started is `PrinterOffline`; a failure once the job started, or a timeout,
 * is `PrinterUncertain` so a caller never silently retries into a double print.
 */
export function spoolerPrinter(options: {
  printerName: string;
  shell?: string;
  timeoutMs?: number;
}): ReceiptPrinter {
  return {
    print: (bytes) =>
      new Promise<void>((resolve, reject) => {
        if (!options.shell && process.platform !== "win32")
          return reject(new PrinterOffline(new Error("USB printers need Windows")));
        const child = spawn(
          options.shell ?? windowsPowerShell,
          ["-NoProfile", "-NonInteractive", "-OutputFormat", "Text", "-EncodedCommand", encoded],
          {
            env: { ...process.env, SHOPPER_PRINTER_NAME: options.printerName },
            stdio: ["pipe", "ignore", "pipe"],
            windowsHide: true,
            signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
          },
        );
        let stderr = "";
        child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
        child.once("error", (cause) =>
          reject(
            cause.name === "AbortError" ? new PrinterUncertain(cause) : new PrinterOffline(cause),
          ),
        );
        child.once("close", (code, signal) => {
          if (code === 0) return resolve();
          const cause = new Error(stderr.trim() || `PowerShell exited with ${code ?? signal}`);
          reject(
            code === UNCERTAIN_EXIT || signal
              ? new PrinterUncertain(cause)
              : new PrinterOffline(cause),
          );
        });
        child.stdin.on("error", () => undefined); // surfaced through the exit code
        child.stdin.end(Buffer.from(bytes).toString("base64"));
      }),
  };
}
