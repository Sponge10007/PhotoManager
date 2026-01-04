package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"photoms/internal/models"
	"photoms/internal/repository"
	"photoms/pkg/config"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const serverName = "photoms-mcp"

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

type initializeParams struct {
	ProtocolVersion string `json:"protocolVersion"`
}

type toolsCallParams struct {
	Name      string                     `json:"name"`
	Arguments map[string]any             `json:"arguments,omitempty"`
	Meta      map[string]any             `json:"_meta,omitempty"`
	RawArgs   map[string]json.RawMessage `json:"-"`
}

type toolDefinition struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

type toolCallResult struct {
	Content []toolContent `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

type toolContent struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type mcpServer struct {
	photoRepo       *repository.PhotoRepository
	baseURL         string
	defaultUserID   *primitive.ObjectID
	protocolVersion string
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)

	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	cfg := config.Load()

	client, err := connectMongo(cfg.MongoURI)
	if err != nil {
		log.Fatalf("mongo connect failed: %v", err)
	}
	defer client.Disconnect(context.Background())

	db := client.Database(cfg.DatabaseName)
	photoRepo := repository.NewPhotoRepository(db)

	baseURL := strings.TrimRight(strings.TrimSpace(getEnv("MCP_BASE_URL", "http://localhost:8080")), "/")
	var defaultUserID *primitive.ObjectID
	if v := strings.TrimSpace(os.Getenv("MCP_USER_ID")); v != "" {
		id, err := primitive.ObjectIDFromHex(v)
		if err != nil {
			log.Fatalf("invalid MCP_USER_ID (must be ObjectID hex): %v", err)
		}
		defaultUserID = &id
	}

	srv := &mcpServer{
		photoRepo:     photoRepo,
		baseURL:       baseURL,
		defaultUserID: defaultUserID,
	}

	if err := srv.serve(os.Stdin, os.Stdout); err != nil && err != io.EOF {
		log.Fatalf("mcp server stopped: %v", err)
	}
}

func connectMongo(uri string) (*mongo.Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, err
	}
	return client, nil
}

func (s *mcpServer) serve(in io.Reader, out io.Writer) error {
	reader := bufio.NewReader(in)
	writer := bufio.NewWriter(out)
	defer writer.Flush()

	for {
		payload, err := readFramedJSON(reader)
		if err != nil {
			return err
		}

		var req rpcRequest
		if err := json.Unmarshal(payload, &req); err != nil {
			// Can't respond without an ID; ignore.
			continue
		}

		if isNotification(req.ID) {
			s.handleNotification(req)
			continue
		}

		resp := s.handleRequest(req)
		respBytes, err := json.Marshal(resp)
		if err != nil {
			// Best-effort: send a generic error.
			resp = rpcResponse{
				JSONRPC: "2.0",
				ID:      req.ID,
				Error:   &rpcError{Code: -32603, Message: "internal error"},
			}
			respBytes, _ = json.Marshal(resp)
		}

		if err := writeFramedJSON(writer, respBytes); err != nil {
			return err
		}
	}
}

func (s *mcpServer) handleNotification(req rpcRequest) {
	switch req.Method {
	case "notifications/initialized":
		return
	default:
		return
	}
}

func (s *mcpServer) handleRequest(req rpcRequest) rpcResponse {
	switch req.Method {
	case "initialize":
		return s.handleInitialize(req)
	case "ping":
		return rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  map[string]any{},
		}
	case "tools/list":
		return rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]any{
				"tools": s.tools(),
			},
		}
	case "tools/call":
		return s.handleToolsCall(req)
	case "resources/list":
		return rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]any{
				"resources": []any{},
			},
		}
	case "resources/read":
		return rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &rpcError{Code: -32601, Message: "resources/read not supported"},
		}
	case "prompts/list":
		return rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]any{
				"prompts": []any{},
			},
		}
	case "prompts/get":
		return rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &rpcError{Code: -32601, Message: "prompts/get not supported"},
		}
	default:
		return rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &rpcError{Code: -32601, Message: "method not found"},
		}
	}
}

func (s *mcpServer) handleInitialize(req rpcRequest) rpcResponse {
	var params initializeParams
	_ = json.Unmarshal(req.Params, &params)
	if strings.TrimSpace(params.ProtocolVersion) == "" {
		params.ProtocolVersion = "2024-11-05"
	}
	s.protocolVersion = params.ProtocolVersion

	return rpcResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result: map[string]any{
			"protocolVersion": params.ProtocolVersion,
			"capabilities": map[string]any{
				"tools": map[string]any{},
			},
			"serverInfo": map[string]any{
				"name":    serverName,
				"version": "0.1.0",
			},
		},
	}
}

func (s *mcpServer) tools() []toolDefinition {
	return []toolDefinition{
		{
			Name:        "search_photos",
			Description: "在 PhotoMS 图片库中按关键词/标签/日期范围检索图片，返回匹配的图片列表（含可访问的原图/缩略图 URL）。",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query": map[string]any{
						"type":        "string",
						"description": "关键词或自然语言检索（匹配标题/描述/标签）。",
					},
					"tag": map[string]any{
						"type":        "string",
						"description": "单个标签过滤（精确匹配，忽略大小写）。",
					},
					"startDate": map[string]any{
						"type":        "string",
						"description": "起始日期（YYYY-MM-DD 或 RFC3339）。",
					},
					"endDate": map[string]any{
						"type":        "string",
						"description": "结束日期（YYYY-MM-DD 或 RFC3339）。",
					},
					"page": map[string]any{
						"type":        "integer",
						"description": "分页页码（从 1 开始）。",
						"default":     1,
					},
					"limit": map[string]any{
						"type":        "integer",
						"description": "每页数量（1~100）。",
						"default":     20,
					},
					"userId": map[string]any{
						"type":        "string",
						"description": "可选：限制为某个用户的图片（MongoDB ObjectID hex）。未提供则使用环境变量 MCP_USER_ID（如设置）。",
					},
				},
			},
		},
		{
			Name:        "get_photo",
			Description: "根据 ID 获取单张图片的详细信息（含可访问的原图/缩略图 URL）。",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"id": map[string]any{
						"type":        "string",
						"description": "图片 ID（MongoDB ObjectID hex）。",
					},
				},
				"required": []string{"id"},
			},
		},
	}
}

func (s *mcpServer) handleToolsCall(req rpcRequest) rpcResponse {
	var params toolsCallParams
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &rpcError{Code: -32602, Message: "invalid params"},
		}
	}

	switch params.Name {
	case "search_photos":
		return s.toolSearchPhotos(req.ID, params.Arguments)
	case "get_photo":
		return s.toolGetPhoto(req.ID, params.Arguments)
	default:
		return rpcResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &rpcError{Code: -32601, Message: "unknown tool"},
		}
	}
}

func (s *mcpServer) toolSearchPhotos(id json.RawMessage, args map[string]any) rpcResponse {
	query := strings.TrimSpace(getStringArg(args, "query"))
	tag := strings.TrimSpace(getStringArg(args, "tag"))
	startDateStr := strings.TrimSpace(getStringArg(args, "startDate"))
	endDateStr := strings.TrimSpace(getStringArg(args, "endDate"))
	page := getIntArg(args, "page", 1)
	limit := getIntArg(args, "limit", 20)
	userIDStr := strings.TrimSpace(getStringArg(args, "userId"))

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	startDate, err := parseDate(startDateStr, false)
	if err != nil {
		return toolErrorResponse(id, fmt.Sprintf("invalid startDate: %v", err))
	}
	endDate, err := parseDate(endDateStr, true)
	if err != nil {
		return toolErrorResponse(id, fmt.Sprintf("invalid endDate: %v", err))
	}

	var userID *primitive.ObjectID
	if userIDStr != "" {
		oid, err := primitive.ObjectIDFromHex(userIDStr)
		if err != nil {
			return toolErrorResponse(id, "invalid userId (must be ObjectID hex)")
		}
		userID = &oid
	} else if s.defaultUserID != nil {
		userID = s.defaultUserID
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	photos, total, err := s.photoRepo.Find(ctx, userID, int64(page), int64(limit), query, tag, startDate, endDate)
	if err != nil {
		return toolErrorResponse(id, fmt.Sprintf("search failed: %v", err))
	}

	type item struct {
		ID          string   `json:"id"`
		Title       string   `json:"title"`
		Description string   `json:"description,omitempty"`
		Tags        []string `json:"tags,omitempty"`
		CreatedAt   string   `json:"createdAt"`
		URL         string   `json:"url"`
		ThumbURL    string   `json:"thumbUrl"`
	}

	items := make([]item, 0, len(photos))
	for _, p := range photos {
		if p == nil {
			continue
		}
		tags := make([]string, 0, len(p.Tags))
		for _, t := range p.Tags {
			if strings.TrimSpace(t.Name) != "" {
				tags = append(tags, t.Name)
			}
		}
		items = append(items, item{
			ID:          p.ID.Hex(),
			Title:       p.Title,
			Description: p.Description,
			Tags:        tags,
			CreatedAt:   p.CreatedAt.Time().Format(time.RFC3339),
			URL:         resolveURL(s.baseURL, p.Path),
			ThumbURL:    resolveURL(s.baseURL, p.ThumbPath),
		})
	}

	payload, _ := json.MarshalIndent(map[string]any{
		"total": total,
		"page":  page,
		"limit": limit,
		"items": items,
	}, "", "  ")

	return rpcResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result: toolCallResult{
			Content: []toolContent{
				{Type: "text", Text: string(payload)},
			},
		},
	}
}

func (s *mcpServer) toolGetPhoto(id json.RawMessage, args map[string]any) rpcResponse {
	photoIDStr := strings.TrimSpace(getStringArg(args, "id"))
	if photoIDStr == "" {
		return toolErrorResponse(id, "missing id")
	}
	photoID, err := primitive.ObjectIDFromHex(photoIDStr)
	if err != nil {
		return toolErrorResponse(id, "invalid id (must be ObjectID hex)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	photo, err := s.photoRepo.FindByID(ctx, photoID)
	if err != nil {
		return toolErrorResponse(id, fmt.Sprintf("photo not found: %v", err))
	}

	type out struct {
		ID          string       `json:"id"`
		UserID      string       `json:"userId"`
		Title       string       `json:"title"`
		Description string       `json:"description"`
		Tags        []models.Tag `json:"tags"`
		CreatedAt   string       `json:"createdAt"`
		UpdatedAt   string       `json:"updatedAt"`
		URL         string       `json:"url"`
		ThumbURL    string       `json:"thumbUrl"`
	}

	payload, _ := json.MarshalIndent(out{
		ID:          photo.ID.Hex(),
		UserID:      photo.UserID.Hex(),
		Title:       photo.Title,
		Description: photo.Description,
		Tags:        photo.Tags,
		CreatedAt:   photo.CreatedAt.Time().Format(time.RFC3339),
		UpdatedAt:   photo.UpdatedAt.Time().Format(time.RFC3339),
		URL:         resolveURL(s.baseURL, photo.Path),
		ThumbURL:    resolveURL(s.baseURL, photo.ThumbPath),
	}, "", "  ")

	return rpcResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result: toolCallResult{
			Content: []toolContent{
				{Type: "text", Text: string(payload)},
			},
		},
	}
}

func toolErrorResponse(id json.RawMessage, message string) rpcResponse {
	return rpcResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result: toolCallResult{
			IsError: true,
			Content: []toolContent{
				{Type: "text", Text: message},
			},
		},
	}
}

func readFramedJSON(r *bufio.Reader) ([]byte, error) {
	contentLength := -1
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return nil, err
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			break
		}
		k, v, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(k), "Content-Length") {
			n, err := strconv.Atoi(strings.TrimSpace(v))
			if err != nil {
				return nil, fmt.Errorf("invalid Content-Length: %w", err)
			}
			contentLength = n
		}
	}
	if contentLength < 0 {
		return nil, fmt.Errorf("missing Content-Length header")
	}
	if contentLength == 0 {
		return []byte("{}"), nil
	}

	buf := make([]byte, contentLength)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, err
	}
	return buf, nil
}

func writeFramedJSON(w *bufio.Writer, payload []byte) error {
	if _, err := fmt.Fprintf(w, "Content-Length: %d\r\n\r\n", len(payload)); err != nil {
		return err
	}
	if _, err := w.Write(payload); err != nil {
		return err
	}
	return w.Flush()
}

func isNotification(id json.RawMessage) bool {
	if len(id) == 0 {
		return true
	}
	s := strings.TrimSpace(string(id))
	return s == "" || s == "null"
}

func getStringArg(args map[string]any, key string) string {
	if args == nil {
		return ""
	}
	v, ok := args[key]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	default:
		b, _ := json.Marshal(t)
		return string(b)
	}
}

func getIntArg(args map[string]any, key string, def int) int {
	if args == nil {
		return def
	}
	v, ok := args[key]
	if !ok || v == nil {
		return def
	}
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case int64:
		return int(t)
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(t))
		if err != nil {
			return def
		}
		return n
	default:
		return def
	}
}

func parseDate(value string, endOfDay bool) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}

	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return &t, nil
	}

	if t, err := time.ParseInLocation("2006-01-02", value, time.Local); err == nil {
		if endOfDay {
			t = t.Add(24*time.Hour - time.Nanosecond)
		}
		return &t, nil
	}

	return nil, fmt.Errorf("invalid date format: %s", value)
}

func resolveURL(baseURL, path string) string {
	p := strings.TrimSpace(path)
	if p == "" {
		return ""
	}
	if strings.HasPrefix(p, "http://") || strings.HasPrefix(p, "https://") {
		return p
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return baseURL + p
}

func getEnv(key, def string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	return v
}
