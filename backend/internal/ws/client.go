package ws

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024 // 512KB
)

// Client represents one browser WebSocket connection.
// It bridges the WebSocket connection to the Hub via channels.
type Client struct {
	ID     string
	RoomID string
	hub    *Hub
	conn   *websocket.Conn
	// send is a buffered channel of outbound messages.
	// The hub writes here; writePump drains it to the wire.
	send chan []byte
}

func NewClient(id, roomID string, hub *Hub, conn *websocket.Conn) *Client {
	return &Client{
		ID:     id,
		RoomID: roomID,
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 256),
	}
}

// readPump pumps messages from the WebSocket connection to the hub.
//
// One goroutine runs readPump per connection. The application ensures
// there is at most one reader per connection by running this goroutine.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	// Every time we receive a pong, reset the deadline.
	// This is the heartbeat mechanism - if the client goes silent for
	// pongWait seconds, the read deadline fires and we disconnect them.
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("client %s unexpected close: %v", c.ID, err)
			}
			break
		}
		c.hub.broadcast <- BroadcastMsg{RoomID: c.RoomID, SenderID: c.ID, Data: message}
	}
}

// writePump pumps messages from the hub to the WebSocket connection.
//
// One goroutine runs writePump per connection. The application ensures
// there is at most one writer per connection by running this goroutine.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel - send a close frame.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			// Send a ping to keep the connection alive.
			// If the client doesn't respond with a pong within pongWait, readPump disconnects.
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
