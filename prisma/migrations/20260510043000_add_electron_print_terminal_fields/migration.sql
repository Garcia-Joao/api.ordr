CREATE TYPE "DeviceClientType" AS ENUM ('WEB', 'ELECTRON');

ALTER TABLE "Device"
ADD COLUMN "clientType" "DeviceClientType" NOT NULL DEFAULT 'WEB',
ADD COLUMN "isPrintTerminal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "printTerminalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "localPrinters" JSONB,
ADD COLUMN "terminalApprovedAt" TIMESTAMP(3);

CREATE INDEX "Device_clientType_idx" ON "Device"("clientType");
CREATE INDEX "Device_isPrintTerminal_idx" ON "Device"("isPrintTerminal");
CREATE INDEX "Device_printTerminalEnabled_idx" ON "Device"("printTerminalEnabled");
