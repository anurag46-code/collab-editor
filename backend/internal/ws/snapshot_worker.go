package ws

import (
	"log"
	"time"

	"github.com/anurag46-code/collab-editor/internal/store"
)

// StartSnapshotWorker periodically persists all active room documents to Postgres.
// Runs in its own goroutine - call as: go StartSnapshotWorker(hub, store)
//
// Why 30 seconds: short enough that a crash loses at most 30s of work,
// long enough to not hammer the database on a busy server.
func StartSnapshotWorker(h *Hub, s *store.Store) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// snapshotAll sends a request to the hub and gets back a map of roomID -> content.
		// We don't access h.rooms directly - that would be a race condition.
		// Instead we use a request/response channel pattern.
		snapshots := h.RequestSnapshots()
		for roomID, content := range snapshots {
			if err := s.SaveSnapshot(roomID, content); err != nil {
				log.Printf("snapshot save failed for room %s: %v", roomID, err)
			} else {
				log.Printf("snapshot saved for room %s (%d chars)", roomID, len(content))
			}
		}
	}
}
