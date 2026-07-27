import MonacoEditor, { OnMount } from '@monaco-editor/react'
import { useRef, useEffect } from 'react'
import * as monaco from 'monaco-editor'

interface Props {
  content: string
  language: string
  onInsert: (char: string, index: number) => void
  onDelete: (index: number) => void
  onCursorMove: (line: number, col: number) => void
}

export function Editor({ content, language, onInsert, onDelete, onCursorMove }: Props) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const suppressRef = useRef(false) // prevents remote changes from triggering local ops

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor

    editor.onDidChangeCursorPosition((e) => {
      onCursorMove(e.position.lineNumber, e.position.column)
    })

    editor.onDidChangeModelContent((e) => {
      if (suppressRef.current) return // change came from a remote op, ignore

      for (const change of e.changes) {
        const model = editor.getModel()
        if (!model) continue

        // Convert Monaco's line/col offset to a flat character index
        const startIndex = model.getOffsetAt({
          lineNumber: change.range.startLineNumber,
          column: change.range.startColumn,
        })

        // Handle deletions first
        const deleteCount = change.rangeLength
        for (let i = 0; i < deleteCount; i++) {
          onDelete(startIndex)
        }

        // Then handle insertions
        for (let i = 0; i < change.text.length; i++) {
          onInsert(change.text[i], startIndex + i)
        }
      }
    })
  }

  // When remote ops change content, update Monaco without triggering local op handlers
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    if (!model) return

    const current = model.getValue()
    if (current === content) return

    suppressRef.current = true
    // Preserve cursor position across remote updates
    const position = editor.getPosition()
    model.setValue(content)
    if (position) editor.setPosition(position)
    suppressRef.current = false
  }, [content])

  return (
    <MonacoEditor
      height="100%"
      language={language}
      theme="vs-dark"
      onMount={handleMount}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
    />
  )
}
