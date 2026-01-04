package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"photoms/internal/models"
	"photoms/pkg/config"
)

type ArkImageTagger struct {
	apiKey     string
	baseURL    string
	model      string
	reasoning  string
	candidates []string
	maxTags    int
	httpClient *http.Client
}

func NewArkImageTagger(cfg *config.Config) *ArkImageTagger {
	timeout := time.Duration(cfg.AITagTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 20 * time.Second
	}

	maxTags := cfg.AITagMaxTags
	if maxTags <= 0 {
		maxTags = 5
	}
	if maxTags > 20 {
		maxTags = 20
	}

	baseURL := strings.TrimSpace(cfg.ArkBaseURL)
	if baseURL == "" {
		baseURL = "https://ark.cn-beijing.volces.com/api/v3"
	}

	return &ArkImageTagger{
		apiKey:     strings.TrimSpace(cfg.ArkAPIKey),
		baseURL:    strings.TrimRight(baseURL, "/"),
		model:      strings.TrimSpace(cfg.ArkModel),
		reasoning:  strings.TrimSpace(cfg.ArkReasoningEffort),
		candidates: cfg.AITagCandidates,
		maxTags:    maxTags,
		httpClient: &http.Client{Timeout: timeout},
	}
}

func (t *ArkImageTagger) GenerateTags(ctx context.Context, imagePath string) ([]models.Tag, error) {
	imageBytes, mimeType, err := readImageFile(imagePath)
	if err != nil {
		return nil, err
	}

	if t.apiKey == "" {
		return nil, fmt.Errorf("%w: ARK_API_KEY is empty", ErrNotConfigured)
	}
	if t.model == "" {
		t.model = "doubao-seed-1-6-251015"
	}

	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(imageBytes))
	prompt := buildTagPrompt(t.candidates, t.maxTags)

	reqBody := chatCompletionsRequest{
		Model: t.model,
		Messages: []chatCompletionsMessage{
			{
				Role: "user",
				Content: []chatCompletionsContentPart{
					{
						Type:     "image_url",
						ImageURL: &chatCompletionsImageURL{URL: dataURL},
					},
					{Type: "text", Text: prompt},
				},
			},
		},
		Temperature:     0.2,
		ReasoningEffort: t.reasoning,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.baseURL+"/chat/completions", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+t.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("ark error: status=%d body=%s", resp.StatusCode, truncate(respBytes, 800))
	}

	var parsed chatCompletionsResponse
	if err := json.Unmarshal(respBytes, &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse ark response: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return nil, fmt.Errorf("ark response has no choices")
	}

	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		return nil, fmt.Errorf("ark returned empty content")
	}

	var out taggerOutput
	if err := json.Unmarshal([]byte(content), &out); err != nil {
		return nil, fmt.Errorf("failed to parse tag JSON: %w (content=%s)", err, truncate([]byte(content), 400))
	}

	tags := make([]models.Tag, 0, len(out.Tags))
	seen := make(map[string]struct{}, len(out.Tags))
	for _, item := range out.Tags {
		name := sanitizeTagName(item.Name)
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		tag := models.Tag{
			Name:   name,
			Source: "AI",
		}
		if item.Score > 0 && item.Score <= 1 {
			tag.Score = item.Score
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

type chatCompletionsRequest struct {
	Model           string                   `json:"model"`
	Messages        []chatCompletionsMessage `json:"messages"`
	Temperature     float64                  `json:"temperature,omitempty"`
	ReasoningEffort string                   `json:"reasoning_effort,omitempty"`
}

type chatCompletionsMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type chatCompletionsContentPart struct {
	Type     string                   `json:"type"`
	Text     string                   `json:"text,omitempty"`
	ImageURL *chatCompletionsImageURL `json:"image_url,omitempty"`
}

type chatCompletionsImageURL struct {
	URL string `json:"url"`
}

type chatCompletionsResponse struct {
	Choices []struct {
		Message struct {
			Content          string `json:"content"`
			ReasoningContent string `json:"reasoning_content,omitempty"`
		} `json:"message"`
	} `json:"choices"`
}

type taggerOutput struct {
	Tags []struct {
		Name  string  `json:"name"`
		Score float64 `json:"score,omitempty"`
	} `json:"tags"`
}

func buildTagPrompt(candidates []string, maxTags int) string {
	if maxTags <= 0 {
		maxTags = 5
	}
	if maxTags > 20 {
		maxTags = 20
	}

	list := strings.Join(candidates, "，")
	if strings.TrimSpace(list) == "" {
		list = "风景，人物，动物，建筑，食物，车辆，文档，截图，其他"
	}

	return fmt.Sprintf(
		"请根据图片内容生成 1~%d 个中文标签，尽量覆盖：类别标签（如：%s）+ 更细粒度的实体/场景标签（如：海滩、山、狗、猫、夜景、室内等）。\n"+
			"标签不需要限制在示例列表内；避免输出长句，使用短词；不要重复。\n"+
			"只输出 JSON，不要解释。输出格式：{\"tags\":[{\"name\":\"人物\",\"score\":0.95}]}。\n"+
			"score 为 0~1 的浮点数（可选）。",
		maxTags,
		list,
	)
}

func readImageFile(path string) ([]byte, string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, "", fmt.Errorf("empty image path")
	}

	info, err := os.Stat(path)
	if err != nil {
		return nil, "", err
	}
	if info.IsDir() {
		return nil, "", fmt.Errorf("image path is a directory: %s", path)
	}

	const maxBytes = 8 * 1024 * 1024
	if info.Size() > maxBytes {
		return nil, "", fmt.Errorf("image too large for tagging: %d bytes (max %d)", info.Size(), maxBytes)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, "", err
	}
	mimeType := http.DetectContentType(data)
	if strings.HasPrefix(mimeType, "application/octet-stream") {
		switch strings.ToLower(filepath.Ext(path)) {
		case ".jpg", ".jpeg":
			mimeType = "image/jpeg"
		case ".png":
			mimeType = "image/png"
		case ".gif":
			mimeType = "image/gif"
		case ".webp":
			mimeType = "image/webp"
		case ".bmp":
			mimeType = "image/bmp"
		case ".tif", ".tiff":
			mimeType = "image/tiff"
		}
	}
	return data, mimeType, nil
}

func sanitizeTagName(name string) string {
	name = strings.TrimSpace(strings.Trim(name, "\"\x00"))
	return name
}

func truncate(b []byte, n int) string {
	s := string(b)
	if len(s) <= n {
		return s
	}
	return s[:n] + "...(truncated)"
}
