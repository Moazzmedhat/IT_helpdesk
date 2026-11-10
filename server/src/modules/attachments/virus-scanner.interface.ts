import { ScanStatus } from '@prisma/client';

export interface VirusScanResult {
  status: ScanStatus;
  threatDetails?: string;
}

export interface IVirusScanner {
  scanBuffer(buffer: Buffer, fileName: string): Promise<VirusScanResult>;
}

export class MockOrClamAvScanner implements IVirusScanner {
  async scanBuffer(buffer: Buffer, fileName: string): Promise<VirusScanResult> {
    // EICAR standard test string detection for virus scanner testing
    const eicarSignature = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    if (buffer.toString('utf8').includes(eicarSignature)) {
      return {
        status: ScanStatus.INFECTED,
        threatDetails: 'EICAR Test Signature Detected',
      };
    }

    return {
      status: ScanStatus.CLEAN,
    };
  }
}

export const virusScanner = new MockOrClamAvScanner();
