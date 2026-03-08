// SheetJS (xlsx) — optional dependency for Excel export
// Falls back to CSV when not installed
declare module 'xlsx' {
  export interface WorkBook {
    Sheets: Record<string, WorkSheet>;
    SheetNames: string[];
  }
  export interface WorkSheet {
    [cell: string]: any;
    '!cols'?: Array<{ wch?: number; wpx?: number }>;
    '!rows'?: Array<{ hpx?: number; hpt?: number }>;
  }
  export const utils: {
    book_new(): WorkBook;
    aoa_to_sheet(data: any[][]): WorkSheet;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name?: string): void;
  };
  export function writeFile(wb: WorkBook, filename: string): void;
}
