package main

import (
	"log"
	"net/http"

	"github.com/anurag46-code/collab-editor/internal/auth"
	"github.com/anurag46-code/collab-editor/internal/store"
	"github.com/anurag46-code/collab-editor/internal/ws"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func main() {
	s, err := store.New()
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer s.Close()

	if err := s.Migrate(); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Println("database ready")

	hub := ws.NewHub(s)
	go hub.Run()
	go ws.StartSnapshotWorker(hub, s)

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Public auth routes - no token needed
	r.POST("/auth/register", auth.Register(s))
	r.POST("/auth/login", auth.Login(s))

	// Protected routes - JWT required
	protected := r.Group("/", auth.Middleware())
	{
		protected.GET("/ws/:roomID", func(c *gin.Context) {
			roomID := c.Param("roomID")
			// Use the verified userID from the token as the clientID.
			// This replaces the old ?clientId= query param.
			clientID := c.GetString("userID")

			conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
			if err != nil {
				log.Printf("upgrade error: %v", err)
				return
			}

			client := ws.NewClient(clientID, roomID, hub, conn)
			hub.Register(client)

			go client.WritePump()
			go client.ReadPump()
		})
	}

	log.Println("server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("server: %v", err)
	}
}
