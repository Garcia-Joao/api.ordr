const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const execFileAsync = promisify(execFile)

function escapePowerShellString(value) {
  return String(value).replace(/'/g, "''")
}

async function runPowerShell(psScript) {
  const { stdout, stderr } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    psScript,
  ])

  if (stderr?.trim()) {
    console.warn('[printer.js] PowerShell stderr:', stderr.trim())
  }

  return {
    stdout: stdout?.trim() || '',
    stderr: stderr?.trim() || '',
  }
}

async function listGenericTextPrinters() {
  const psScript = `
$printers = Get-Printer |
  Where-Object {
    $_.DriverName -eq 'Generic / Text Only'
  } |
  Select-Object Name, DriverName, PortName, PrinterStatus, Shared, ShareName

$printers | ConvertTo-Json -Depth 4
`

  const { stdout } = await runPowerShell(psScript)

  if (!stdout) return []

  const parsed = JSON.parse(stdout)
  const printers = Array.isArray(parsed) ? parsed : [parsed]

  return printers.map((printer) => ({
    name: printer.Name,
    driverName: printer.DriverName,
    portName: printer.PortName,
    printerStatus: printer.PrinterStatus,
    shared: Boolean(printer.Shared),
    shareName: printer.ShareName || null,
    isGenericTextOnly: printer.DriverName === 'Generic / Text Only',
  }))
}

async function printerExists(printerName) {
  const escapedPrinterName = escapePowerShellString(printerName)

  const psScript = `
$printer = Get-Printer -Name '${escapedPrinterName}' -ErrorAction SilentlyContinue
if ($printer) { Write-Output 'true' } else { Write-Output 'false' }
`

  const { stdout } = await runPowerShell(psScript)
  return stdout.trim().toLowerCase() === 'true'
}

async function printRawThermalText(content, options = {}) {
  const {
    printerName,
    feedLines = 6,
    cut = true,
  } = options

  if (!printerName) {
    throw new Error('printerName is required')
  }

  const escapedPrinterName = escapePowerShellString(printerName)
  const escapedContent = escapePowerShellString(content)
  const cutCommand = cut ? '$allBytes += [byte[]](0x1D, 0x56, 0x00)' : ''

  const psScript = `
$printerName = '${escapedPrinterName}'
$content = @'
${escapedContent}
'@
$feedLines = ${feedLines}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public class DOCINFO
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFO di);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] data, int buf, out int pcWritten);
}
"@

function Send-RawBytesToPrinter {
    param(
        [Parameter(Mandatory=$true)][string]$PrinterName,
        [Parameter(Mandatory=$true)][byte[]]$Bytes
    )

    $hPrinter = [IntPtr]::Zero
    $docInfo = New-Object RawPrinterHelper+DOCINFO
    $docInfo.pDocName = "ORDR Thermal Print"
    $docInfo.pDataType = "RAW"

    $opened = [RawPrinterHelper]::OpenPrinter($PrinterName, [ref]$hPrinter, [IntPtr]::Zero)
    if (-not $opened) {
        throw "Could not open printer '$PrinterName'. Win32 error: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
    }

    try {
        $startedDoc = [RawPrinterHelper]::StartDocPrinter($hPrinter, 1, $docInfo)
        if (-not $startedDoc) {
            throw "Could not start print document. Win32 error: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
        }

        try {
            $startedPage = [RawPrinterHelper]::StartPagePrinter($hPrinter)
            if (-not $startedPage) {
                throw "Could not start print page. Win32 error: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
            }

            try {
                $written = 0
                $ok = [RawPrinterHelper]::WritePrinter($hPrinter, $Bytes, $Bytes.Length, [ref]$written)
                if (-not $ok) {
                    throw "Could not write to printer. Win32 error: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
                }

                if ($written -ne $Bytes.Length) {
                    throw "Incomplete write. Expected $($Bytes.Length) bytes, wrote $written bytes."
                }
            }
            finally {
                [void][RawPrinterHelper]::EndPagePrinter($hPrinter)
            }
        }
        finally {
            [void][RawPrinterHelper]::EndDocPrinter($hPrinter)
        }
    }
    finally {
        [void][RawPrinterHelper]::ClosePrinter($hPrinter)
    }
}

$printer = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
if (-not $printer) {
    throw "Printer '$printerName' not found."
}

[System.Text.Encoding]::RegisterProvider([System.Text.CodePagesEncodingProvider]::Instance)

# ESC @ reset
$initBytes = [byte[]](0x1B, 0x40)

# ESC t 16 = WPC1252 on many Epson/ESC-POS printers
$codePageBytes = [byte[]](0x1B, 0x74, 0x10)

$textBytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($content)

$feedText = ""
for ($i = 0; $i -lt $feedLines; $i++) {
    $feedText += [Environment]::NewLine
}

$feedBytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($feedText)

$allBytes = $initBytes + $codePageBytes + $textBytes + $feedBytes
${cutCommand}

Send-RawBytesToPrinter -PrinterName $printerName -Bytes $allBytes
Write-Host "Print job sent successfully."
`

  await runPowerShell(psScript)
}

async function printRawThermalTexts(contents, options = {}) {
  if (!Array.isArray(contents)) {
    throw new Error('contents must be an array of strings')
  }

  for (const content of contents) {
    if (typeof content !== 'string') {
      throw new Error('each item in contents must be a string')
    }

    await printRawThermalText(content, {
      ...options,
      cut: true,
    })
  }
}

module.exports = {
  listGenericTextPrinters,
  printerExists,
  printRawThermalText,
  printRawThermalTexts,
}