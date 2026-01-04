package config

import (
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port           string
	MongoURI       string
	DatabaseName   string
	JWTSecret      string
	UploadDir      string
	AllowedOrigins []string

	// AI image tagging (optional)
	AITaggingEnabled    bool
	AIProvider          string
	ArkAPIKey           string
	ArkBaseURL          string
	ArkModel            string
	ArkReasoningEffort  string
	AITagCandidates     []string
	AITagMaxTags        int
	AITagTimeoutSeconds int
}

func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		MongoURI:     getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DatabaseName: getEnv("DATABASE_NAME", "photoms"),
		JWTSecret:    getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		UploadDir:    getEnv("UPLOAD_DIR", "./uploads"),
		AllowedOrigins: []string{
			getEnv("CLIENT_URL", "http://localhost:5173"),
		},

		AITaggingEnabled:    getEnvBool("AI_TAGGING_ENABLED", false),
		AIProvider:          getEnv("AI_PROVIDER", "ark"),
		ArkAPIKey:           strings.TrimSpace(os.Getenv("ARK_API_KEY")),
		ArkBaseURL:          getEnv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
		ArkModel:            getEnv("ARK_MODEL", "doubao-seed-1-6-251015"),
		ArkReasoningEffort:  getEnv("ARK_REASONING_EFFORT", "medium"),
		AITagCandidates:     getEnvCSV("AI_TAG_CANDIDATES", defaultAITagCandidates()),
		AITagMaxTags:        getEnvInt("AI_TAG_MAX_TAGS", 5),
		AITagTimeoutSeconds: getEnvInt("AI_TAG_TIMEOUT_SECONDS", 20),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	if defaultValue == "" {
		log.Fatalf("Environment variable %s is required", key)
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}
	switch strings.ToLower(value) {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		log.Fatalf("Environment variable %s must be a boolean (got %q)", key, value)
		return defaultValue
	}
}

func getEnvInt(key string, defaultValue int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}
	num, err := strconv.Atoi(value)
	if err != nil {
		log.Fatalf("Environment variable %s must be an integer (got %q)", key, value)
	}
	return num
}

func getEnvCSV(key string, defaultValue []string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		out = append(out, part)
	}
	if len(out) == 0 {
		return defaultValue
	}
	return out
}

func defaultAITagCandidates() []string {
	return []string{
		"风景",
		"人物",
		"动物",
		"植物",
		"建筑",
		"城市",
		"室内",
		"室外",
		"夜景",
		"食物",
		"车辆",
		"文档",
		"截图",
		"插画",
		"其他",
	}
}
