package lib

import (
	"github.com/blixt/go-hotel/hotel"
)

type Envelope struct {
	Sender  *UserMetadata
	Message hotel.Message
}

// Note: We will only modify the user metadata within the room goroutine to
// ensure there's never any data races.

type UserMetadata struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	ActiveFile string `json:"activeFile"`
}

func (um *UserMetadata) Envelop(msg hotel.Message) Envelope {
	return Envelope{um, msg}
}

var ServerUser = &UserMetadata{
	ID:   0,
	Name: "Server",
}
