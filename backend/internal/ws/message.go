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
)

// Message is the envelope for every WebSocket frame in both directions.
type Message struct {
	Type     MsgType  `json:"type"`
	Op       *crdt.Op `json:"op,omitempty"`
	Content  string   `json:"content,omitempty"`  // snapshot: current document text
	ClientID string   `json:"clientId,omitempty"` // presence: who moved their cursor
	Line     int      `json:"line,omitempty"`     // presence: cursor line
	Col      int      `json:"col,omitempty"`      // presence: cursor column
	Color    string   `json:"color,omitempty"`    // presence: user color
}

func NewOpMessage(op crdt.Op) ([]byte, error) {
	return json.Marshal(Message{Type: MsgTypeOp, Op: &op})
}

func NewSnapshotMessage(content string) ([]byte, error) {
	return json.Marshal(Message{Type: MsgTypeSnapshot, Content: content})
}
