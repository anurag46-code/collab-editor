package crdt

import (
	"testing"
)

// TestBasicInsert verifies a single client can build a document character by character.
func TestBasicInsert(t *testing.T) {
	doc := NewDocument("alice")
	doc.Insert('h', -1, 0)
	doc.Insert('i', 0, 1)

	if got := doc.Content(); got != "hi" {
		t.Errorf("expected 'hi', got %q", got)
	}
}

// TestCommutativity is the core CRDT guarantee:
// two clients inserting concurrently must converge to the same document
// regardless of which op is applied first.
func TestCommutativity(t *testing.T) {
	// Alice and Bob both start with an empty document.
	alice := NewDocument("alice")
	bob := NewDocument("bob")

	// Alice inserts 'A' at the beginning.
	opA := alice.Insert('A', -1, 0)

	// Bob inserts 'B' at the beginning concurrently (before receiving Alice's op).
	opB := bob.Insert('B', -1, 0)

	// Now sync: Alice applies Bob's op, Bob applies Alice's op.
	alice.Apply(opB)
	bob.Apply(opA)

	// Both documents must have identical content.
	if alice.Content() != bob.Content() {
		t.Errorf("convergence failed: alice=%q bob=%q", alice.Content(), bob.Content())
	}

	// Both must contain both characters.
	if len(alice.Content()) != 2 {
		t.Errorf("expected 2 chars, got %q", alice.Content())
	}
}

// TestIdempotent verifies applying the same op twice does not duplicate a character.
func TestIdempotent(t *testing.T) {
	doc := NewDocument("alice")
	op := doc.Insert('X', -1, 0)
	doc.Apply(op) // apply the same op again
	doc.Apply(op) // and again

	if doc.Content() != "X" {
		t.Errorf("expected 'X', got %q", doc.Content())
	}
}

// TestDelete verifies a character can be removed and both replicas converge.
func TestDelete(t *testing.T) {
	alice := NewDocument("alice")
	bob := NewDocument("bob")

	// Both build the word "hi"
	opH := alice.Insert('h', -1, 0)
	opI := alice.Insert('i', 0, 1)
	bob.Apply(opH)
	bob.Apply(opI)

	// Alice deletes 'h'
	delOp := alice.Delete(0)

	// Bob receives the delete
	bob.Apply(delOp)

	if alice.Content() != "i" {
		t.Errorf("alice: expected 'i', got %q", alice.Content())
	}
	if bob.Content() != "i" {
		t.Errorf("bob: expected 'i', got %q", bob.Content())
	}
}

// TestConcurrentInsertAndDelete verifies insert and delete ops commute correctly.
func TestConcurrentInsertAndDelete(t *testing.T) {
	alice := NewDocument("alice")
	bob := NewDocument("bob")

	// Seed both with "hello"
	ops := []Op{}
	for _, ch := range "hello" {
		op := alice.Insert(ch, alice.Len()-1, alice.Len())
		ops = append(ops, op)
	}
	for _, op := range ops {
		bob.Apply(op)
	}

	// Alice deletes 'h' (index 0)
	delOp := alice.Delete(0)

	// Bob concurrently inserts '!' at the end (before receiving Alice's delete)
	insertOp := bob.Insert('!', bob.Len()-1, bob.Len())

	// Cross-apply
	alice.Apply(insertOp)
	bob.Apply(delOp)

	if alice.Content() != bob.Content() {
		t.Errorf("convergence failed: alice=%q bob=%q", alice.Content(), bob.Content())
	}
}
