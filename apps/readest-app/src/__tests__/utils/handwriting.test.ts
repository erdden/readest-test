import { describe, expect, it } from 'vitest';
import { buildHandwritingNote, extractHandwritingData, isHandwritingNote } from '@/utils/handwriting';

describe('handwriting note utilities', () => {
  const dataUrl = 'data:image/png;base64,abc123';

  it('builds and detects handwriting notes', () => {
    const note = buildHandwritingNote(dataUrl);
    expect(note).toBe(`![Handwriting](${dataUrl})`);
    expect(isHandwritingNote(note)).toBe(true);
    expect(extractHandwritingData(note)).toBe(dataUrl);
  });

  it('returns null for non-handwriting notes', () => {
    expect(extractHandwritingData('Just a note')).toBeNull();
    expect(isHandwritingNote('Just a note')).toBe(false);
  });
});
