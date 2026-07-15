export interface ParsedBomItem {
  code: string;
  name: string;
  qtyPerMachine: number;
  owner: string;
}

/**
 * Detects the delimiter used in a single line.
 * Prefers standard separators: comma, semicolon, tab.
 */
function detectDelimiter(line: string): string {
  const separators = [',', ';', '\t'];
  let best = ',';
  let maxCount = 0;
  for (const sep of separators) {
    const count = line.split(sep).length - 1;
    if (count > maxCount) {
      maxCount = count;
      best = sep;
    }
  }
  return best;
}

/**
 * Parses a single line respecting double quotes for fields containing delimiters.
 */
function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the next double quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(v => v.trim());
}

/**
 * Parses CSV/TSV/semicolon-separated BOM text.
 */
export function parseBomText(text: string): ParsedBomItem[] {
  if (!text) return [];
  
  // Split lines and filter out empty lines
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter);

  let codeIdx = -1;
  let nameIdx = -1;
  let qtyIdx = -1;
  let ownerIdx = -1;

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    if (header === '物料号' || header === 'code') {
      codeIdx = i;
    } else if (header === '物料名称' || header === 'name') {
      nameIdx = i;
    } else if (header === '单机用量' || header === 'qtypermachine' || header === 'qty') {
      qtyIdx = i;
    } else if (header === '负责人' || header === 'owner') {
      ownerIdx = i;
    }
  }

  // Fallback to default indices if no headers matched at all
  const hasMatchedHeaders = (codeIdx !== -1 || nameIdx !== -1 || qtyIdx !== -1 || ownerIdx !== -1);
  if (!hasMatchedHeaders) {
    codeIdx = 0;
    nameIdx = 1;
    qtyIdx = 2;
    ownerIdx = 3;
  }

  const result: ParsedBomItem[] = [];
  
  // Start from line 1 (skip header line)
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], delimiter);
    // Ignore lines that are essentially empty
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) {
      continue;
    }

    const getValue = (idx: number, fallback = ''): string => {
      if (idx >= 0 && idx < cols.length) {
        return cols[idx];
      }
      return fallback;
    };

    const code = getValue(codeIdx);
    const name = getValue(nameIdx);
    const qtyStr = getValue(qtyIdx, '0');
    
    // Parse qtyPerMachine as an integer. Handle thousands separators if any.
    let qtyPerMachine = parseInt(qtyStr.replace(/,/g, ''), 10);
    if (isNaN(qtyPerMachine)) {
      qtyPerMachine = 0;
    }
    
    const owner = getValue(ownerIdx);

    result.push({
      code,
      name,
      qtyPerMachine,
      owner
    });
  }

  return result;
}
