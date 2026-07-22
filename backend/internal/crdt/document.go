package crdt

import (
	"sort"
	"strings"
)

// entry is one character in the document with its permanent position.
type entry struct {
	pos  Position
	char rune
}

// Document is a CRDT sequence of characters.
// Internally it keeps a sorted slice of entries.
// Any two replicas that have received the same set of Ops will have identical Content(),
// regardless of the order the ops arrived.
type Document struct {
	entries []entry
	siteID  string
	clock   int
}

func NewDocument(siteID string) *Document {
	return &Document{siteID: siteID}
}

// Insert adds a character between the characters at indices left and right
// (using the current visible text indices, 0-based).
// Returns the Op so it can be broadcast to other clients.
func (d *Document) Insert(char rune, leftIdx, rightIdx int) Op {
	var lo, hi Position

	// leftIdx == -1 means "before the first character" (start sentinel)
	if leftIdx >= 0 && leftIdx < len(d.entries) {
		lo = d.entries[leftIdx].pos
	}
	// rightIdx >= len means "after the last character" (end sentinel)
	if rightIdx >= 0 && rightIdx < len(d.entries) {
		hi = d.entries[rightIdx].pos
	}

	pos := Between(lo, hi, d.siteID)
	d.clock++

	op := Op{
		Type:     OpInsert,
		Position: pos,
		Char:     char,
		SiteID:   d.siteID,
		Clock:    d.clock,
	}
	d.applyInsert(op)
	return op
}

// Delete removes the character at the given visible text index.
// Returns the Op so it can be broadcast to other clients.
func (d *Document) Delete(idx int) Op {
	if idx < 0 || idx >= len(d.entries) {
		return Op{}
	}
	d.clock++
	op := Op{
		Type:     OpDelete,
		Position: d.entries[idx].pos,
		SiteID:   d.siteID,
		Clock:    d.clock,
	}
	d.applyDelete(op)
	return op
}

// Apply integrates a remote Op into this document.
// Safe to call with ops in any order - the CRDT guarantees convergence.
func (d *Document) Apply(op Op) {
	switch op.Type {
	case OpInsert:
		d.applyInsert(op)
	case OpDelete:
		d.applyDelete(op)
	}
}

func (d *Document) applyInsert(op Op) {
	e := entry{pos: op.Position, char: op.Char}
	// Find the insertion point using binary search so the slice stays sorted.
	idx := sort.Search(len(d.entries), func(i int) bool {
		return d.entries[i].pos.Compare(op.Position) >= 0
	})
	// Ignore duplicate positions (idempotent - applying the same op twice is safe)
	if idx < len(d.entries) && d.entries[idx].pos.Compare(op.Position) == 0 {
		return
	}
	// Insert at idx, shifting everything right
	d.entries = append(d.entries, entry{})
	copy(d.entries[idx+1:], d.entries[idx:])
	d.entries[idx] = e
}

func (d *Document) applyDelete(op Op) {
	idx := sort.Search(len(d.entries), func(i int) bool {
		return d.entries[i].pos.Compare(op.Position) >= 0
	})
	if idx < len(d.entries) && d.entries[idx].pos.Compare(op.Position) == 0 {
		d.entries = append(d.entries[:idx], d.entries[idx+1:]...)
	}
}

// Content returns the current document text as a string.
func (d *Document) Content() string {
	var sb strings.Builder
	for _, e := range d.entries {
		sb.WriteRune(e.char)
	}
	return sb.String()
}

// Len returns the number of characters currently in the document.
func (d *Document) Len() int {
	return len(d.entries)
}

// SetContent bootstraps a document from a plain text string (e.g. a Postgres snapshot).
// Each character gets a sequential position - used only for restoring persisted state,
// not for live editing (which uses Insert/Delete with proper CRDT positions).
func (d *Document) SetContent(text string) {
	d.entries = make([]entry, 0, len(text))
	for i, ch := range text {
		pos := Position{Identifier{Digit: i + 1, SiteID: d.siteID}}
		d.entries = append(d.entries, entry{pos: pos, char: ch})
	}
}
