package room

import (
	"github.com/anurag46-code/collab-editor/internal/crdt"
)

// Room holds the shared document state for one editing session.
// It is only ever accessed from the hub goroutine - no locking needed.
type Room struct {
	ID       string
	Document *crdt.Document
}

func New(id string) *Room {
	return &Room{
		ID:       id,
		Document: crdt.NewDocument("server"),
	}
}
