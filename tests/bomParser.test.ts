import { describe, it, expect } from 'vitest';
import { parseBomText } from '../server/bomParser.js';

describe('BOM Parser (bomParser.ts)', () => {
  it('should parse valid comma-separated CSV with standard headers', () => {
    const csvText = `物料号,物料名称,单机用量,负责人
M-001,MCU Board,2,张三
M-002,12V Adapter,1,李四`;

    const result = parseBomText(csvText);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      code: 'M-001',
      name: 'MCU Board',
      qtyPerMachine: 2,
      owner: '张三',
    });
    expect(result[1]).toEqual({
      code: 'M-002',
      name: '12V Adapter',
      qtyPerMachine: 1,
      owner: '李四',
    });
  });

  it('should parse semicolon-separated CSV with different casing and English headers', () => {
    const csvText = `CODE;NAME;QTYPERMACHINE;OWNER
M-003;Screen;1;王五
M-004;Mounting Screw;100;赵六`;

    const result = parseBomText(csvText);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      code: 'M-003',
      name: 'Screen',
      qtyPerMachine: 1,
      owner: '王五',
    });
    expect(result[1]).toEqual({
      code: 'M-004',
      name: 'Mounting Screw',
      qtyPerMachine: 100,
      owner: '赵六',
    });
  });

  it('should parse tab-separated (TSV) CSV with mixed language and alternate headers (e.g. qty)', () => {
    const csvText = `code\tname\tqty\towner
M-005\tChassis\t1\tSun
M-006\tCable\t5\tLi`;

    const result = parseBomText(csvText);
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('M-005');
    expect(result[0].qtyPerMachine).toBe(1);
    expect(result[1].code).toBe('M-006');
    expect(result[1].qtyPerMachine).toBe(5);
  });

  it('should auto-detect and handle headers with different languages and casing', () => {
    // English Mixed Casing
    const text1 = `Code,Name,QtyPerMachine,Owner
M-007,Item A,2,Alice`;
    const res1 = parseBomText(text1);
    expect(res1[0]).toEqual({ code: 'M-007', name: 'Item A', qtyPerMachine: 2, owner: 'Alice' });

    // Chinese Headers
    const text2 = `物料号,物料名称,单机用量,负责人
M-008,Item B,3,Bob`;
    const res2 = parseBomText(text2);
    expect(res2[0]).toEqual({ code: 'M-008', name: 'Item B', qtyPerMachine: 3, owner: 'Bob' });
  });

  it('should return empty array for empty or whitespace-only inputs', () => {
    expect(parseBomText('')).toEqual([]);
    expect(parseBomText('   ')).toEqual([]);
    // @ts-ignore
    expect(parseBomText(null)).toEqual([]);
    // @ts-ignore
    expect(parseBomText(undefined)).toEqual([]);
  });

  it('should fallback to default column indices when headers are not found/recognized', () => {
    // Columns that do not match any recognized header names
    const csvText = `Col1,Col2,Col3,Col4
M-009,Sensor Box,4,Charlie`;

    const result = parseBomText(csvText);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      code: 'M-009',
      name: 'Sensor Box',
      qtyPerMachine: 4,
      owner: 'Charlie',
    });
  });

  it('should parse lines with missing fields and default them correctly', () => {
    // Missing quantity and owner
    const csvText = `code,name,qty,owner
M-010,Item X
M-011,,5`;

    const result = parseBomText(csvText);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      code: 'M-010',
      name: 'Item X',
      qtyPerMachine: 0,
      owner: '',
    });
    expect(result[1]).toEqual({
      code: 'M-011',
      name: '',
      qtyPerMachine: 5,
      owner: '',
    });
  });

  it('should handle quoted fields containing delimiters', () => {
    const csvText = `code,name,qty,owner
M-012,"Bracket, type A",1,David
M-013,"Adapter ""12V""",2,Eric`;

    const result = parseBomText(csvText);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Bracket, type A');
    expect(result[1].name).toBe('Adapter "12V"');
  });

  it('should handle malformed line counts, ignoring empty/blank lines', () => {
    const csvText = `
code,name,qty,owner
M-014,Item Y,10,Frank


M-015,Item Z,20,Grace
`;
    const result = parseBomText(csvText);
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('M-014');
    expect(result[1].code).toBe('M-015');
  });

  it('should handle quantity values with thousand separators and non-numeric quantities', () => {
    const csvText = `code,name,qty,owner
M-016,Item A,"1,250",Alice
M-017,Item B,abc,Bob
M-018,Item C,,Charlie`;

    const result = parseBomText(csvText);
    expect(result).toHaveLength(3);
    expect(result[0].qtyPerMachine).toBe(1250);
    expect(result[1].qtyPerMachine).toBe(0);
    expect(result[2].qtyPerMachine).toBe(0);
  });

  it('should handle unclosed double quotes gracefully', () => {
    const csvText = `code,name,qty,owner
M-019,"Unclosed item name,10,Alice`;

    const result = parseBomText(csvText);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('M-019');
    expect(result[0].name).toBe('Unclosed item name,10,Alice');
    expect(result[0].qtyPerMachine).toBe(0);
  });
});
