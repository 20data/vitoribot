import { describe, expect, it } from 'vitest';
import { escapeMarkdown, formatToman, renderTemplate, toEnDigits, toFaDigits } from './index.js';

describe('persian utils', () => {
  it('converts latin digits to persian', () => {
    expect(toFaDigits('150,000')).toBe('۱۵۰,۰۰۰');
  });
  it('converts persian digits back to latin', () => {
    expect(toEnDigits('۱۵۰٬۰۰۰')).toBe('150٬000'.replace('٬', '٬'));
    expect(toEnDigits('۱۲۳')).toBe('123');
  });
  it('formats toman with separators', () => {
    expect(formatToman(150000)).toBe('۱۵۰,۰۰۰');
  });
  it('escapes markdown safely', () => {
    expect(escapeMarkdown('a_b*c')).toBe('a\\_b\\*c');
  });
  it('renders templates', () => {
    expect(renderTemplate('سلام {{name}}!', { name: 'علی' })).toBe('سلام علی!');
  });
});
