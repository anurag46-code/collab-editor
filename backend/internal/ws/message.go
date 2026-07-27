package ws

import (
	"encoding/json"
	"github.com/anurag46-code/collab-editor/internal/crdt"
)

// MsgType identifies the kind of message being sent.
type MsgType string

const (
	MsgTypeOp       MsgType = "op"       // a CRDT operation (insert or delete)
	MsgTypeSnapshot MsgType = "snapshot" // full document content sent to a late joiner
	MsgTypePresence MsgType = "presence" // cursor position (Phase 5)
	MsgTypeLang     MsgType = "lang"     // language change broadcast by room owner
)

// Message is the envelope for every WebSocket frame in both directions.
type Message struct {
	Type     MsgType          `json:"type"`
	Op       *crdt.Op         `json:"op,omitempty"`
	Content  string           `json:"content,omitempty"`  // snapshot: plain text (for display)
	Entries  []crdt.EntryJSON `json:"entries,omitempty"`  // snapshot: full CRDT state for late joiners
	OwnerID  string           `json:"ownerId,omitempty"`  // snapshot: room owner
	Language string           `json:"language,omitempty"` // snapshot: current lang | lang: new lang
	ClientID string           `json:"clientId,omitempty"` // presence: who moved their cursor
	Email    string           `json:"email,omitempty"`    // presence: user email for display
	Line     int              `json:"line,omitempty"`     // presence: cursor line
	Col      int              `json:"col,omitempty"`      // presence: cursor column
	Color    string           `json:"color,omitempty"`    // presence: user color
}

func NewOpMessage(op crdt.Op) ([]byte, error) {
	return json.Marshal(Message{Type: MsgTypeOp, Op: &op})
}

func NewSnapshotMessage(content string, entries []crdt.EntryJSON, ownerID string, language string) ([]byte, error) {
	return json.Marshal(Message{Type: MsgTypeSnapshot, Content: content, Entries: entries, OwnerID: ownerID, Language: language})
}
