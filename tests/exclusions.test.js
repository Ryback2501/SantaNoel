// The Exclusions cell (apps-script/exclusions.js): participant numbers separated by commas,
// ascending, no spaces ("1,3,5"), or empty when there are none.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { parseExclusions, formatExclusions } = require('../apps-script/exclusions.js');

describe('reading the Exclusions cell (parseExclusions)', () => {
  it.each([
    ['', []],
    ['3', [3]],
    ['1,3,5', [1, 3, 5]],
    [' 1 , 3 ', [1, 3]],
    ['5,1', [5, 1]],
  ])('reads %j as %j', (cell, numbers) => {
    expect(parseExclusions(cell)).toEqual(numbers);
  });

  it('reads an empty or missing cell as no exclusions', () => {
    expect(parseExclusions(undefined)).toEqual([]);
    expect(parseExclusions(null)).toEqual([]);
  });

  it('reads a cell the spreadsheet turned into a number', () => {
    expect(parseExclusions(3)).toEqual([3]);
  });

  it('skips anything that is not a participant number', () => {
    expect(parseExclusions('1,x,,0,-2,2.5,4')).toEqual([1, 4]);
  });
});

describe('writing the Exclusions cell (formatExclusions)', () => {
  it.each([
    [[], ''],
    [[3], '3'],
    [[1, 3, 5], '1,3,5'],
    [[5, 1, 3], '1,3,5'],
  ])('writes %j as %j: ascending, no spaces', (numbers, cell) => {
    expect(formatExclusions(numbers)).toBe(cell);
  });

  it('gives back the same list when read again', () => {
    expect(parseExclusions(formatExclusions([4, 2]))).toEqual([2, 4]);
  });
});
