package lib

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/blixt/go-llms/anthropic"
	"github.com/blixt/go-llms/content"
	"github.com/blixt/go-llms/llms"
	"github.com/blixt/go-llms/tools"
	"github.com/joho/godotenv"

	"github.com/blixt/go-hotel/hotel"
)

var llm *llms.LLM

type repoHashKey struct{}

func init() {
	err := godotenv.Load()
	if err != nil {
		log.Printf("Did not load env file: %v", err)
	}
	llm = llms.New(
		anthropic.New(os.Getenv("ANTHROPIC_API_KEY"), "claude-3-5-sonnet-latest"),
		ReadFileTool,
		SubmitSolutionTool,
	)
}

type RoomMetadata struct {
	CloneURL      string
	RepoHash      string
	CurrentCommit string
	Files         []string
}

// HashRoomID generates a SHA-256 hash of the room ID and encodes it in URL-safe base64.
func HashRoomID(roomID string) string {
	hash := sha256.Sum256([]byte(roomID))
	return base64.URLEncoding.EncodeToString(hash[:])
}

// Initialize room
// Runs once when the room is loaded into memory

func RoomInit(ctx context.Context, roomID string) (*RoomMetadata, error) {
	// Hash the room ID for directory naming.
	hashedRoomID := HashRoomID(roomID)

	// Prepare the repository path
	repoPath := filepath.Join(RepoBasePath, hashedRoomID)
	cloneURL := fmt.Sprintf("https://%s.git", roomID)

	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		// Clone the repository if it doesn't exist.
		if err := CloneRepo(cloneURL, repoPath); err != nil {
			log.Println("Clone error:", err)
			return nil, err
		}
	} else {
		// Pull the latest changes if the repository exists.
		if err := PullRepo(repoPath); err != nil {
			log.Println("Pull error:", err)
			return nil, err
		}
	}

	// Get the current commit hash.
	currentCommit, err := GetCurrentCommit(repoPath)
	if err != nil {
		log.Println("Error getting current commit:", err)
		return nil, err
	}

	// Get the list of files
	files, err := GetRepoFiles(repoPath)
	if err != nil {
		log.Println("Error getting repo files:", err)
		return nil, err
	}

	// Return the room metadata with additional information.
	m := &RoomMetadata{
		CloneURL:      cloneURL,
		RepoHash:      hashedRoomID,
		CurrentCommit: currentCommit,
		Files:         files,
	}
	return m, nil
}

type ReadFileParams struct {
	Path string `json:"path" description:"The path to the file to read"`
}

// Define tools
var ReadFileTool = tools.Func(
	"Read file",
	"Read the contents of a file",
	"read_file",
	func(r tools.Runner, p ReadFileParams) tools.Result {
		repoHash, ok := r.Context().Value(repoHashKey{}).(string)
		if !ok {
			return tools.Error(p.Path, fmt.Errorf("repository hash not found in context"))
		}
		contents, err := os.ReadFile(filepath.Join(RepoBasePath, repoHash, p.Path))
		if err != nil {
			return tools.Error(p.Path, fmt.Errorf("error reading file: %w", err))
		}
		return tools.Success(p.Path, map[string]any{"contents": string(contents)})
	},
)

type FileUpdate struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type SubmitSolutionParams struct {
	CommitMessage string       `json:"commit_message" description:"The commit message to use for the solution"`
	FilesToUpdate []FileUpdate `json:"files_to_update" description:"A list of files to update"`
}

var SubmitSolutionTool = tools.Func(
	"Submit solution",
	"Submit the solution to the user's request",
	"submit_solution",
	func(r tools.Runner, p SubmitSolutionParams) tools.Result {
		// Implementation remains the same, just return a tools.Result
		return tools.Success("Solution submitted", map[string]any{
			"commit_message": p.CommitMessage,
			"files":          p.FilesToUpdate,
		})
	},
)

func createDiffFromUserRequest(ctx context.Context, room *hotel.Room[RoomMetadata, UserMetadata, Envelope], currentPath, message string) {
	requestId := fmt.Sprintf("r%d", time.Now().UnixNano())

	// Prepare system prompt
	files := strings.Join(room.Metadata().Files, "\n")
	currentPathContent, err := os.ReadFile(filepath.Join(RepoBasePath, room.Metadata().RepoHash, currentPath))
	if err != nil {
		log.Printf("Error reading %q: %v", currentPath, err)
		return
	}

	llm.SystemPrompt = func() content.Content {
		return content.Textf(
			"Succinctly solve the user's request. Feel free to think through the problem out loud, and read files if necessary. "+
				"However, once you submit your solution, you will not be able to do more so remember you just have one shot. "+
				"Here are all files in the repo:\n\n%s\n\nThe user is currently looking at: %s\n\nContent of %q:\n\n%s",
			files, currentPath, currentPath, currentPathContent,
		)
	}

	// Create a context with the repo hash
	ctxWithRepo := context.WithValue(ctx, repoHashKey{}, room.Metadata().RepoHash)

	// Process chat updates
	for update := range llm.ChatWithContext(ctxWithRepo, message) {
		switch update := update.(type) {
		case llms.ErrorUpdate:
			log.Printf("Error from LLM: %v", update.Error)
			return
		case llms.TextUpdate:
			room.Broadcast(ServerUser.Envelop(LLMDeltaMessage{
				ID:      requestId,
				Content: update.Text,
			}))
		case llms.ToolStartUpdate:
			log.Printf("Starting tool: %s", update.Tool.Label())
		case llms.ToolDoneUpdate:
			log.Printf("Tool finished: %s", update.Result.Label())
			if err := update.Result.Error(); err != nil {
				log.Printf("Tool error: %v", err)
			}
		}
	}
}

// Room event loop
// Runs for as long as the room is active

func RoomHandler(ctx context.Context, room *hotel.Room[RoomMetadata, UserMetadata, Envelope]) {
	// We can safely work on this object directly because nothing else will touch it.
	metadata := room.Metadata()

	defer func() {
		log.Printf("Handler for room %s is exiting", room.ID())
		// TODO: Clean up here.
	}()
	log.Printf("Room %s started", room.ID())

	for {
		select {
		case event := <-room.Events():
			clientMetadata := event.Client.Metadata()
			switch event.Type {
			case hotel.EventJoin:
				// A client joined the room.
				log.Printf("%s joined room %s", clientMetadata.Name, room.ID())
				users := []*UserMetadata{}
				for _, client := range room.Clients() {
					users = append(users, client.Metadata())
				}
				// Send welcome message to the new client.
				room.SendToClient(event.Client, clientMetadata.Envelop(WelcomeMessage{
					Users:         users,
					RepoHash:      metadata.RepoHash,
					CurrentCommit: metadata.CurrentCommit,
					Files:         metadata.Files,
				}))
				// Tell existing clients about the new client.
				room.BroadcastExcept(event.Client, clientMetadata.Envelop(JoinMessage{User: clientMetadata}))
			case hotel.EventLeave:
				// A client left the room.
				log.Printf("%s left room %s", clientMetadata.Name, room.ID())
				// Notify others with the user's name.
				room.BroadcastExcept(event.Client, clientMetadata.Envelop(LeaveMessage{}))
			case hotel.EventCustom:
				// Incoming message from a client.
				switch msg := event.Data.Message.(type) {
				case *ChatMessage:
					room.BroadcastExcept(event.Client, event.Data)
					const aiMentionPrefix = "@ai "
					if strings.HasPrefix(msg.Content, aiMentionPrefix) {
						currentPath := clientMetadata.ActiveFile
						go createDiffFromUserRequest(ctx, room, currentPath, msg.Content[len(aiMentionPrefix):])
					}
				case *UpdateMetadataMessage:
					if msg.ActiveFile != nil {
						clientMetadata.ActiveFile = *msg.ActiveFile
					}
					if msg.Name != nil {
						clientMetadata.Name = strings.TrimSpace(*msg.Name)
						if clientMetadata.Name == "" {
							clientMetadata.Name = "Anonymous"
						}
					}
					log.Printf("Updated metadata for %s: %+v", clientMetadata.Name, clientMetadata)
					room.BroadcastExcept(event.Client, clientMetadata.Envelop(msg))
				default:
					log.Printf("Unhandled message type: %T", msg)
				}
			}
		case <-ctx.Done():
			// Handler context canceled, perform cleanup.
			return
		}
	}
}
