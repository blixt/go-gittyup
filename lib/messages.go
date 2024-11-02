package lib

type ChatMessage struct {
	Content string `json:"content"`
}

func (m ChatMessage) Type() string {
	return "chat"
}

type JoinMessage struct {
	User *UserMetadata `json:"user"`
}

func (m JoinMessage) Type() string {
	return "join"
}

type LeaveMessage struct {
}

func (m LeaveMessage) Type() string {
	return "leave"
}

type LLMDeltaMessage struct {
	ID      string `json:"id"`
	Content string `json:"content"`
}

func (m LLMDeltaMessage) Type() string {
	return "llmDelta"
}

type UpdateMetadataMessage struct {
	ActiveFile *string `json:"activeFile,omitempty"`
	Name       *string `json:"name,omitempty"`
}

func (m UpdateMetadataMessage) Type() string {
	return "updateMetadata"
}

type WelcomeMessage struct {
	Users         []*UserMetadata `json:"users"`
	RepoHash      string          `json:"repoHash"`
	CurrentCommit string          `json:"currentCommit"`
	Files         []string        `json:"files"`
}

func (m WelcomeMessage) Type() string {
	return "welcome"
}
