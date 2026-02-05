import React, { useEffect, useRef, useState } from 'react';
import { useNotebookStore } from '@/store/notebookStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { TextSelection } from '@/utils/sel';
import { md5Fingerprint } from '@/utils/md5';
import { useThemeStore } from '@/store/themeStore';
import { BookNote } from '@/types/book';
import useShortcuts from '@/hooks/useShortcuts';
import TextEditor, { TextEditorRef } from '@/components/TextEditor';
import TextButton from '@/components/TextButton';
import { buildHandwritingNote, extractHandwritingData } from '@/utils/handwriting';

const DEFAULT_STROKE_WIDTH = 2;
const MIN_PRESSURE_STROKE_WIDTH = 1.5;
const PRESSURE_STROKE_MULTIPLIER = 3;

interface NoteEditorProps {
  onSave: (selection: TextSelection, note: string) => void;
  onEdit: (annotation: BookNote) => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ onSave, onEdit }) => {
  const _ = useTranslation();
  const { isDarkMode } = useThemeStore();
  const {
    notebookNewAnnotation,
    notebookEditAnnotation,
    setNotebookNewAnnotation,
    setNotebookEditAnnotation,
    saveNotebookAnnotationDraft,
    getNotebookAnnotationDraft,
  } = useNotebookStore();

  const editorRef = useRef<TextEditorRef>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [textNote, setTextNote] = useState('');
  const [noteMode, setNoteMode] = useState<'text' | 'handwriting'>('text');
  const [handwritingDataUrl, setHandwritingDataUrl] = useState<string | null>(null);
  const [hasHandwriting, setHasHandwriting] = useState(false);
  const separatorWidth = useResponsiveSize(3);
  const handwritingHeight = useResponsiveSize(180);

  useEffect(() => {
    if (notebookEditAnnotation) {
      const noteText = notebookEditAnnotation.note;
      const handwritingData = extractHandwritingData(noteText);
      if (handwritingData) {
        setNoteMode('handwriting');
        setHandwritingDataUrl(handwritingData);
        setHasHandwriting(true);
        setTextNote('');
      } else {
        setNoteMode('text');
        setHandwritingDataUrl(null);
        setHasHandwriting(false);
        setTextNote(noteText);
        editorRef.current?.setValue(noteText);
        editorRef.current?.focus();
      }
    } else if (notebookNewAnnotation) {
      const noteText = getAnnotationText();
      if (noteText) {
        const draftNote = getNotebookAnnotationDraft(md5Fingerprint(noteText)) || '';
        const handwritingData = extractHandwritingData(draftNote);
        if (handwritingData) {
          setNoteMode('handwriting');
          setHandwritingDataUrl(handwritingData);
          setHasHandwriting(true);
          setTextNote('');
        } else {
          setNoteMode('text');
          setHandwritingDataUrl(null);
          setHasHandwriting(false);
          setTextNote(draftNote);
          editorRef.current?.setValue(draftNote);
          editorRef.current?.focus();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookNewAnnotation, notebookEditAnnotation]);

  useEffect(() => {
    if (noteMode !== 'handwriting') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const targetWidth = rect.width * ratio;
    const targetHeight = rect.height * ratio;
    if (canvas.width !== targetWidth) {
      canvas.width = targetWidth;
    }
    if (canvas.height !== targetHeight) {
      canvas.height = targetHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = DEFAULT_STROKE_WIDTH;
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!handwritingDataUrl) return;
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 0, 0, rect.width, rect.height);
    };
    image.src = handwritingDataUrl;
  }, [noteMode, handwritingDataUrl]);

  const getAnnotationText = () => {
    return notebookEditAnnotation?.text || notebookNewAnnotation?.text || '';
  };

  const handleNoteChange = (value: string) => {
    setTextNote(value);
  };

  const handleBlur = () => {
    if (noteMode !== 'text') return;
    const currentValue = editorRef.current?.getValue();
    if (currentValue) {
      const noteText = getAnnotationText();
      if (noteText) {
        saveNotebookAnnotationDraft(md5Fingerprint(noteText), currentValue);
      }
    }
  };

  const getHandwritingValue = () => {
    if (!canvasRef.current || !hasHandwriting) return '';
    return buildHandwritingNote(canvasRef.current.toDataURL('image/png'));
  };

  const handleSaveNote = () => {
    const currentValue =
      noteMode === 'handwriting'
        ? getHandwritingValue()
        : editorRef.current?.getValue() || '';
    if (currentValue) {
      if (notebookNewAnnotation) {
        onSave(notebookNewAnnotation, currentValue);
      } else if (notebookEditAnnotation) {
        notebookEditAnnotation.note = currentValue;
        onEdit(notebookEditAnnotation);
      }
    }
  };

  const handleEscape = () => {
    if (notebookNewAnnotation) {
      setNotebookNewAnnotation(null);
    }
    if (notebookEditAnnotation) {
      setNotebookEditAnnotation(null);
    }
  };

  const setMode = (mode: 'text' | 'handwriting') => {
    if (mode === noteMode) return;
    if (noteMode === 'handwriting' && canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      setHandwritingDataUrl(hasHandwriting ? dataUrl : null);
    }
    setNoteMode(mode);
    if (mode === 'text') {
      editorRef.current?.focus();
    }
  };

  const clearHandwriting = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasHandwriting(false);
    setHandwritingDataUrl(null);
  };

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const getStrokeWidth = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType !== 'pen' || !event.pressure) return DEFAULT_STROKE_WIDTH;
    return MIN_PRESSURE_STROKE_WIDTH + event.pressure * PRESSURE_STROKE_MULTIPLIER;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = isDarkMode ? '#f8fafc' : '#111827';
      ctx.lineWidth = getStrokeWidth(event);
    }
    canvas.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = getCanvasPoint(event);
    event.preventDefault();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const nextPoint = getCanvasPoint(event);
    const lastPoint = lastPointRef.current;
    if (!ctx || !nextPoint || !lastPoint) return;
    ctx.lineWidth = getStrokeWidth(event);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(nextPoint.x, nextPoint.y);
    ctx.stroke();
    lastPointRef.current = nextPoint;
    setHasHandwriting(true);
    event.preventDefault();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    isDrawingRef.current = false;
    lastPointRef.current = null;
    event.preventDefault();
  };

  const canSave = noteMode === 'handwriting' ? hasHandwriting : Boolean(textNote.trim());

  useShortcuts({
    onSaveNote: () => {
      if (canSave) {
        handleSaveNote();
      }
    },
    onEscape: handleEscape,
  });

  return (
    <div className='content booknote-item note-editor-container bg-base-100 mt-2 rounded-md p-2'>
      <div className='flex items-center justify-between pb-2'>
        <div className='flex items-center gap-3'>
          <TextButton
            onClick={() => setMode('text')}
            variant={noteMode === 'text' ? 'primary' : 'secondary'}
          >
            {_('Text')}
          </TextButton>
          <TextButton
            onClick={() => setMode('handwriting')}
            variant={noteMode === 'handwriting' ? 'primary' : 'secondary'}
          >
            {_('Handwriting')}
          </TextButton>
        </div>
        {noteMode === 'handwriting' && (
          <TextButton onClick={clearHandwriting} variant='danger'>
            {_('Clear')}
          </TextButton>
        )}
      </div>
      <div className='flex w-full'>
        {noteMode === 'handwriting' ? (
          <div
            className='w-full rounded-md border border-base-300 bg-base-200/40 p-2'
            style={{ height: `${handwritingHeight}px` }}
          >
            <canvas
              ref={canvasRef}
              className='h-full w-full touch-none rounded-md bg-base-100'
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>
        ) : (
          <TextEditor
            ref={editorRef}
            value={textNote}
            onChange={handleNoteChange}
            onBlur={handleBlur}
            onSave={handleSaveNote}
            onEscape={handleEscape}
            placeholder={_('Add your notes here...')}
            spellCheck={false}
          />
        )}
      </div>

      <div className='flex items-center pt-2'>
        <div
          className='me-2 mt-0.5 min-h-full self-stretch rounded-xl bg-gray-300'
          style={{
            minWidth: `${separatorWidth}px`,
          }}
        ></div>
        <div className='content font-size-sm line-clamp-3'>
          <span className='content font-size-xs text-gray-500'>{getAnnotationText()}</span>
        </div>
      </div>

      <div className='flex justify-end space-x-3 p-2' dir='ltr'>
        <TextButton onClick={handleEscape}>{_('Cancel')}</TextButton>
        <TextButton onClick={handleSaveNote} disabled={!canSave}>
          {_('Save')}
        </TextButton>
      </div>
    </div>
  );
};

export default NoteEditor;
