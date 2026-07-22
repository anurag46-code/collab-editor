package crdt

// OpType distinguishes insert from delete.
type OpType string

const (
	OpInsert OpType = "insert"
	OpDelete OpType = "delete"
)

// Op is a single CRDT operation that can be applied to any Document replica.
// It is safe to send over the network and apply in any order.
type Op struct {
	Type     OpType   `json:"type"`
	Position Position `json:"position"`
	Char     rune     `json:"char"`
	SiteID   string   `json:"siteId"`
	Clock    int      `json:"clock"` // logical clock for ordering ops from the same site
}
