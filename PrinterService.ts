export type PrinterTransport = 'bluetooth' | 'tcp';

export type PrintStatus =
  | 'SUCCESS'
  | 'CONNECTION_ERROR'
  | 'PRINT_ERROR'
  | 'UNKNOWN_ERROR';

export interface PrintResult {
  ok: boolean;
  status: PrintStatus;
  message: string;
  transport: PrinterTransport;
  target: string;
  printerType: string;
  printedAtIso: string;
}

export interface PrintClient {
  connect: () => Promise<void>;
  printFormattedText: (markup: string) => Promise<void>;
  disconnect?: () => Promise<void> | void;
}

export interface ExecutePrintParams {
  transport: PrinterTransport;
  target: string; // device name/mac for bluetooth, IP for tcp
  printerType: string;
  client: PrintClient;
}

/**
 * Service for preparing and printing formatted DantSu receipts.
 */
export class PrinterService {
  /**
   * Builds a reusable test receipt markup string for DantSu printers.
   */
  public buildTestReceiptMarkup(printerType: string, date: Date = new Date()): string {
    const formattedDate = date.toLocaleString();

    return [
      '[C]<b>TEST PRINT</b>',
      '',
      `[L]Printer type:[R]${printerType}`,
      `[L]Date:[R]${formattedDate}`,
      '[L]--------------------------------',
      '[L]Item 1[R]$4.99',
      '[L]Item 2[R]$6.50',
      '[L]Item 3[R]$3.25',
      '[L]--------------------------------',
      '[L]<b>TOTAL</b>[R]<b>$14.74</b>',
      '',
      '[C]Thank you!',
      '[C]Have a great day.',
      ''
    ].join('\n');
  }

  /**
   * Runs connect + print with error-safe handling and deterministic status output.
   */
  public async executeTestPrint(params: ExecutePrintParams): Promise<PrintResult> {
    const { client, printerType, target, transport } = params;
    const printedAtIso = new Date().toISOString();
    const markup = this.buildTestReceiptMarkup(printerType, new Date(printedAtIso));

    try {
      await client.connect();
    } catch (error) {
      this.logTechnicalError('executeTestPrint.connect', target, error);
      await this.safeDisconnect(client, target);

      return {
        ok: false,
        status: 'CONNECTION_ERROR',
        message: 'Unable to connect to the printer. Check the device and try again.',
        transport,
        target,
        printerType,
        printedAtIso
      };
    }

    try {
      await client.printFormattedText(markup);

      return {
        ok: true,
        status: 'SUCCESS',
        message: 'Test receipt printed successfully.',
        transport,
        target,
        printerType,
        printedAtIso
      };
    } catch (error) {
      this.logTechnicalError('executeTestPrint.printFormattedText', target, error);

      return {
        ok: false,
        status: 'PRINT_ERROR',
        message: 'Connected, but failed to print. Please retry the print.',
        transport,
        target,
        printerType,
        printedAtIso
      };
    } finally {
      await this.safeDisconnect(client, target);
    }
  }

  private async safeDisconnect(client: PrintClient, target: string): Promise<void> {
    if (!client.disconnect) {
      return;
    }

    try {
      await client.disconnect();
    } catch (error) {
      this.logTechnicalError('safeDisconnect.disconnect', target, error);
    }
  }

  private logTechnicalError(method: string, target: string, error: unknown): void {
    console.error(`[PrinterService.${method}] Failed for target: ${target}`, error);
  }
}

export default new PrinterService();
