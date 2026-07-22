package crdt

const base = 1000 // positions range 0..base at each level

// Identifier is one element of a position path: a digit and the site that created it.
type Identifier struct {
	Digit  int    `json:"digit"`
	SiteID string `json:"siteId"`
}

// Position uniquely identifies a character's place in the document.
// It is a list of Identifiers - think of it as a path through a tree.
// Positions are immutable once created - a character never moves.
type Position []Identifier

// Compare returns -1, 0, or 1.
func (p Position) Compare(other Position) int {
	minLen := len(p)
	if len(other) < minLen {
		minLen = len(other)
	}
	for i := 0; i < minLen; i++ {
		if p[i].Digit != other[i].Digit {
			if p[i].Digit < other[i].Digit {
				return -1
			}
			return 1
		}
		if p[i].SiteID != other[i].SiteID {
			if p[i].SiteID < other[i].SiteID {
				return -1
			}
			return 1
		}
	}
	if len(p) < len(other) {
		return -1
	}
	if len(p) > len(other) {
		return 1
	}
	return 0
}

// Between generates a new Position that sorts strictly between lo and hi.
// lo is the left neighbour (nil = document start).
// hi is the right neighbour (nil = document end).
//
// Algorithm: walk level by level.
//   - If the gap between lo and hi digits is >= 2, pick the midpoint and return.
//   - If the gap is 1, go one level deeper under lo (hi becomes "infinity" at that level).
//   - If the gap is 0 (same digit), copy lo's identifier into the prefix and go deeper.
//
// This terminates because eventually one of:
//  a) a gap >= 2 is found, or
//  b) both lo and hi are exhausted → loDigit=0, hiDigit=base, gap=base >= 2.
func Between(lo, hi Position, siteID string) Position {
	prefix := make(Position, 0, 4)
	hiActive := hi // tracks the effective hi as we descend levels

	for level := 0; ; level++ {
		loDigit := loDigitAt(lo, level)
		hiDigit := hiDigitAt(hiActive, level)

		gap := hiDigit - loDigit

		if gap >= 2 {
			mid := loDigit + gap/2
			return append(prefix, Identifier{Digit: mid, SiteID: siteID})
		}

		if gap == 1 {
			// One step apart: descend under lo. hi becomes unbounded at next level.
			if level < len(lo) {
				prefix = append(prefix, lo[level])
			} else {
				prefix = append(prefix, Identifier{Digit: loDigit, SiteID: ""})
			}
			hiActive = nil // next level: hiDigit = base → guaranteed gap >= 2
			continue
		}

		// gap == 0: same digit at this level - copy and go deeper
		if level < len(lo) {
			prefix = append(prefix, lo[level])
		} else {
			prefix = append(prefix, Identifier{Digit: loDigit, SiteID: ""})
		}
	}
}

// loDigitAt returns lo's digit at the given level.
// Past lo's length, returns 0 (lo acts as a start boundary below its length).
func loDigitAt(pos Position, level int) int {
	if level < len(pos) {
		return pos[level].Digit
	}
	return 0
}

// hiDigitAt returns hi's digit at the given level.
// Past hi's length (or nil), returns base (hi acts as an end boundary).
func hiDigitAt(pos Position, level int) int {
	if pos == nil || level >= len(pos) {
		return base
	}
	return pos[level].Digit
}
