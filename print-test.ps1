# TM-T20 raw test print with cut
# Sends ESC/POS bytes directly to the printer

$printerName = "TM-T20"

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
    $docInfo.pDocName = "TM-T20 Test Print"
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

# Check if printer exists
$printer = Get-Printer -Name $printerName -ErrorAction SilentlyContinue
if (-not $printer) {
    Write-Error "Printer '$printerName' not found."
    exit 1
}

Write-Host "Printer '$printerName' found. Sending RAW ESC/POS test print..."

# Text content
$content = @"
*** GIJOCA JOCA JOCA ***
$(Get-Date)
"@

$feedBytes = [System.Text.Encoding]::ASCII.GetBytes("`r`n`r`n`r`n`r`n`r`n`r`n")

# Use ASCII for ESC/POS text
$textBytes = [System.Text.Encoding]::ASCII.GetBytes($content)

# Feed a few blank lines before cutting
$feedBytes = [System.Text.Encoding]::ASCII.GetBytes("`r`n`r`n`r`n`r`n`r`n`r`n")

# Full cut command: GS V 0
$cutBytes = [byte[]](0x1D, 0x56, 0x00)

# Combine all bytes
$allBytes = $textBytes + $feedBytes + $cutBytes

# Send to printer
Send-RawBytesToPrinter -PrinterName $printerName -Bytes $allBytes

Write-Host "Print job sent successfully."