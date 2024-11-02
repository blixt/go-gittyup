package lib

import (
	"log"
	"os/exec"
	"strings"
)

const RepoBasePath = "./repos"

// getCurrentCommit retrieves the current commit hash of the repository at the given path
func GetCurrentCommit(repoPath string) (string, error) {
	cmd := exec.Command("git", "-C", repoPath, "rev-parse", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

func GetRepoFiles(repoPath string) ([]string, error) {
	cmd := exec.Command("git", "-C", repoPath, "ls-tree", "-r", "--name-only", "HEAD")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	// Split output into lines and filter empty lines
	files := []string{}
	for _, file := range strings.Split(string(output), "\n") {
		if file != "" {
			files = append(files, file)
		}
	}
	return files, nil
}

func CloneRepo(remote, repoPath string) error {
	cmd := exec.Command("git", "clone", remote, repoPath)
	// Capture the combined output (stdout and stderr)
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Clone error: %v, Output: %s", err, string(output))
		return err
	}
	return nil
}

func PullRepo(repoPath string) error {
	cmd := exec.Command("git", "-C", repoPath, "pull")
	// Capture the combined output (stdout and stderr)
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Pull error: %v, Output: %s", err, string(output))
		return err
	}
	return nil
}
