/**
 * Excel Inspector — dumps all sheets from the Excel file for audit.
 * Run: node scripts/inspect-excel.js
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelPath = path.join(__dirname, '../IPL players list.xlsx');

const workbook = XLSX.readFile(excelPath);
console.log('=== SHEETS FOUND ===');
console.log(workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`\n=== SHEET: ${sheetName} (${data.length} rows) ===`);
  if (data.length > 0) {
    console.log('COLUMNS:', Object.keys(data[0]));
    console.log('FIRST 3 ROWS:', JSON.stringify(data.slice(0, 3), null, 2));
  }
});
