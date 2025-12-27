package config

import (
	"log"
	"os"
)

type Config struct {
	Port           string
	MongoURI       string
	DatabaseName   string
	JWTSecret      string
	UploadDir      string
	AllowedOrigins []string
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
