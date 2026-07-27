package ws

import (
	"encoding/json"
	"log"

	"github.com/anurag46-code/collab-editor/internal/room"
	"github.com/anurag46-code/collab-editor/internal/store"
)

// BroadcastMsg is what a client sends to the hub when it receives a message.
type BroadcastMsg struct {
	RoomID   string
	SenderID string
	Data     []byte
}

// snapshotRequest is sent to the hub to ask for all current room contents.
// The hub writes results back to the Reply channel.
type snapshotRequest struct {
	Reply chan map[string]string
}

// Hub maintains all active rooms and routes messages between clients.
// It is the only goroutine that reads or writes rooms or their documents.
type Hub struct {
	rooms       map[string]*hubRoom
	register    chan *Client
	unregister  chan *Client
	broadcast   chan BroadcastMsg
	snapshotReq chan snapshotRequest
	store       *store.Store
}

// hubRoom bundles the room document with its connected clients.
type hubRoom struct {
	room     *room.Room
	clients  map[string]*Client
	ownerID  string // first client to join; only they can change the language
	language string // current language, broadcast to late joiners
}

func NewHub(s *store.Store) *Hub {
	return &Hub{
		rooms:       make(map[string]*hubRoom),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		broadcast:   make(chan BroadcastMsg, 256),
		snapshotReq: make(chan snapshotRequest),
		store:       s,
	}
}

// RequestSnapshots asks the hub goroutine for a copy of all room contents.
// Safe to call from any goroutine - uses a reply channel to get the result.
func (h *Hub) RequestSnapshots() map[string]string {
	reply := make(chan map[string]string, 1)
	h.snapshotReq <- snapshotRequest{Reply: reply}
	return <-reply
}

// Register sends a client to the hub's register channel.
func (h *Hub) Register(c *Client) {
	h.register <- c
}

// Run starts the hub event loop. Call this in a goroutine: go hub.Run()
func (h *Hub) Run() {
	for {
		select {

		case client := <-h.register:
			hr, ok := h.rooms[client.RoomID]
			if !ok {
				r := room.New(client.RoomID)

				// Load last saved snapshot from Postgres.
				// If none exists (new room), content is "" - no-op.
				if saved, err := h.store.LoadSnapshot(client.RoomID); err != nil {
					log.Printf("load snapshot for room %s: %v", client.RoomID, err)
				} else if saved != "" {
					r.Document.SetContent(saved)
					log.Printf("room %s restored from snapshot (%d chars)", client.RoomID, len(saved))
				}

				hr = &hubRoom{room: r, clients: make(map[string]*Client), ownerID: client.ID, language: "javascript"}
				h.rooms[client.RoomID] = hr
			}
			hr.clients[client.ID] = client
			log.Printf("client %s joined room %s (%d total)", client.ID, client.RoomID, len(hr.clients))

			// Send current document state to the joining client.
			snap, err := NewSnapshotMessage(hr.room.Document.Content(), hr.room.Document.Entries(), hr.ownerID, hr.language)
			if err == nil {
				client.send <- snap
			}

		case client := <-h.unregister:
			hr, ok := h.rooms[client.RoomID]
			if !ok {
				continue
			}
			if _, ok := hr.clients[client.ID]; ok {
				delete(hr.clients, client.ID)
				close(client.send)
				log.Printf("client %s left room %s (%d remaining)", client.ID, client.RoomID, len(hr.clients))
			}
			if len(hr.clients) == 0 {
				delete(h.rooms, client.RoomID)
				log.Printf("room %s empty, removed", client.RoomID)
			}

		case req := <-h.snapshotReq:
			// Collect current content from all active rooms and return to caller.
			// Runs inside the hub goroutine so it is safe to read h.rooms directly.
			result := make(map[string]string, len(h.rooms))
			for id, hr := range h.rooms {
				result[id] = hr.room.Document.Content()
			}
			req.Reply <- result

		case msg := <-h.broadcast:
			hr, ok := h.rooms[msg.RoomID]
			if !ok {
				continue
			}

			// Parse the incoming message to check if it's a CRDT op.
			var envelope Message
			if err := json.Unmarshal(msg.Data, &envelope); err != nil {
				log.Printf("bad message from %s: %v", msg.SenderID, err)
				continue
			}

			// Apply the op to the server-side document.
			if envelope.Type == MsgTypeOp && envelope.Op != nil {
				hr.room.Document.Apply(*envelope.Op)
			}

			// Language change: only the owner can change it; fan out to everyone including sender.
			if envelope.Type == MsgTypeLang && envelope.Language != "" {
				if msg.SenderID != hr.ownerID {
					log.Printf("client %s tried to change language but is not owner", msg.SenderID)
					continue
				}
				hr.language = envelope.Language
				for _, client := range hr.clients {
					select {
					case client.send <- msg.Data:
					default:
						close(client.send)
						delete(hr.clients, client.ID)
					}
				}
				continue
			}

			// Fan out to all other clients in the room.
			for id, client := range hr.clients {
				if id == msg.SenderID {
					continue
				}
				select {
				case client.send <- msg.Data:
				default:
					close(client.send)
					delete(hr.clients, id)
					log.Printf("client %s send buffer full, disconnected", id)
				}
			}
		}
	}
}
