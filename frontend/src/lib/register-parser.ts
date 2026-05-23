// Shared register parsing utility
import { parse as csvParse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

export async function parseRegisterFile(
  file: File | { name: string; buffer: Buffer }
): Promise<Record<string, string>[]> {
  const buffer = 'buffer' in file ? file.buffer : Buffer.from(await file.arrayBuffer());
  const filename = 'name' in file ? file.name : (file as any).name;

  if (filename.toLowerCase().endsWith('.csv')) {
    const text = buffer.toString('utf-8');
    return csvParse(text, { columns: true, skip_empty_lines: true, trim: true });
  } else {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string>[];
  }
}

// Fuzzy column lookup — matches "Invoice No", "invoice_number", "InvNo", etc.
export function getVal(row: Record<string, string>, ...keys: string[]): string | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const key of keys) {
    const found = Object.keys(row).find(k => normalize(k) === normalize(key));
    if (found && row[found] !== '' && row[found] != null) return String(row[found]).trim();
  }
  return null;
}

export function parseDate(val: string | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function parseNum(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

// Map raw CSV/Excel row to RegisterRow prisma data
export function mapRowToRegisterRow(row: Record<string, string>) {
  return {
    invoiceNumber: getVal(row,
      'invoicenumber', 'invno', 'invoiceno', 'salenumber', 'saleno',
      'billno', 'billnumber', 'voucherno', 'vouchernumber', 'documentnumber'
    ),
    invoiceDate: parseDate(getVal(row,
      'invoicedate', 'invdate', 'date', 'saledate', 'billdate', 'documentdate'
    )),
    vendorName: getVal(row,
      'vendorname', 'suppliername', 'vendor', 'supplier',
      'buyername', 'buyer', 'partyname', 'party', 'name'
    ),
    vendorGstin: getVal(row,
      'vendorgstin', 'suppliergstin', 'gstin', 'buyergstin', 'gstno', 'gstinno'
    ),
    taxableValue: parseNum(getVal(row,
      'taxablevalue', 'taxable', 'taxableamount', 'assessablevalue', 'taxableamt'
    )),
    totalValue: parseNum(getVal(row,
      'totalvalue', 'total', 'grandtotal', 'invoicevalue', 'amount',
      'totalamount', 'netamount', 'invoiceamount', 'grandtotalamount'
    )),
  };
}
