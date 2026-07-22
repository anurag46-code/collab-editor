package store

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq" // registers the postgres driver
)

// Store wraps the database connection and exposes document snapshot operations.
type Store struct {
	db *sql.DB
}

// New opens a Postgres connection using the POSTGRES_DSN environment variable.
func New() (*Store, error) {
	dsn := os.Getenv("POSTGRES_DSN")
	if dsn == "" {
		dsn = "postgres://collab:collab@localhost:5432/collab_editor?sslmode=disable"
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return &Store{db: db}, nil
}

// Migrate creates all tables if they do not exist.
// Called once on server startup.
func (s *Store) Migrate() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS snapshots (
			room_id      TEXT PRIMARY KEY,
			content      TEXT NOT NULL,
			updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS users (
			id           TEXT PRIMARY KEY,
			email        TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`)
	return err
}

// CreateUser inserts a new user. Returns an error if email already exists.
func (s *Store) CreateUser(id, email, passwordHash string) error {
	_, err := s.db.Exec(`
		INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)
	`, id, email, passwordHash)
	return err
}

// GetUserByEmail returns the user row for the given email.
// Returns ("", "", sql.ErrNoRows) if not found.
func (s *Store) GetUserByEmail(email string) (id, passwordHash string, err error) {
	err = s.db.QueryRow(`
		SELECT id, password_hash FROM users WHERE email = $1
	`, email).Scan(&id, &passwordHash)
	return
}

// SaveSnapshot upserts the current document content for a room.
// Uses INSERT ... ON CONFLICT so it works whether the row exists or not.
func (s *Store) SaveSnapshot(roomID, content string) error {
	_, err := s.db.Exec(`
		INSERT INTO snapshots (room_id, content, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (room_id)
		DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
	`, roomID, content)
	return err
}

// LoadSnapshot returns the last saved content for a room.
// Returns ("", nil) if no snapshot exists yet - first time a room is opened.
func (s *Store) LoadSnapshot(roomID string) (string, error) {
	var content string
	err := s.db.QueryRow(`
		SELECT content FROM snapshots WHERE room_id = $1
	`, roomID).Scan(&content)

	if err == sql.ErrNoRows {
		return "", nil // room has never been saved - not an error
	}
	return content, err
}

// Close closes the database connection pool.
func (s *Store) Close() error {
	return s.db.Close()
}
