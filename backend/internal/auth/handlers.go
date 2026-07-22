package auth

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/anurag46-code/collab-editor/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type loginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register creates a new user account.
// Passwords are hashed with bcrypt before storing - never stored in plaintext.
func Register(s *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req registerRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// bcrypt cost 12: slow enough to resist brute force, fast enough for normal use
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
			return
		}

		id := uuid.NewString()
		if err := s.CreateUser(id, req.Email, string(hash)); err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
			return
		}

		token, err := GenerateToken(id, req.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate token"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"token": token, "userId": id, "email": req.Email})
	}
}

// Login verifies credentials and returns a JWT.
func Login(s *store.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req loginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		id, hash, err := s.GetUserByEmail(req.Email)
		if err == sql.ErrNoRows {
			// Return the same error for wrong email and wrong password.
			// Distinct errors would let attackers enumerate valid emails.
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "server error"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}

		token, err := GenerateToken(id, req.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"token": token, "userId": id, "email": req.Email})
	}
}

// Middleware validates the JWT on the Authorization header.
// Sets "userID" and "email" in the Gin context for downstream handlers.
func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// WebSocket connections pass the token as a query param because
		// browsers can't set Authorization headers on WebSocket upgrades.
		tokenStr := c.Query("token")
		if tokenStr == "" {
			// Fall back to Authorization: Bearer <token> for HTTP endpoints
			header := c.GetHeader("Authorization")
			if len(header) > 7 && header[:7] == "Bearer " {
				tokenStr = header[7:]
			}
		}

		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}

		claims, err := ValidateToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": fmt.Sprintf("invalid token: %v", err)})
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Next()
	}
}
