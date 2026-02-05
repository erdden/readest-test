const HANDWRITING_NOTE_REGEX = /^!\[Handwriting\]\((data:image\/png;base64,[^)]+)\)$/;

export const buildHandwritingNote = (dataUrl: string) => `![Handwriting](${dataUrl})`;

export const extractHandwritingData = (note: string) => {
  const match = note.trim().match(HANDWRITING_NOTE_REGEX);
  return match ? match[1] : null;
};

export const isHandwritingNote = (note: string) => Boolean(extractHandwritingData(note));
