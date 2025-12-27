package main

import (
	"context"
	"log"
	"photoms/internal/controller"
	"photoms/internal/middleware"
	"photoms/internal/repository"
	"photoms/internal/service"
	"photoms/pkg/config"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Connect to MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		log.Fatal("Failed to connect to MongoDB:", err)
	}
	defer client.Disconnect(context.Background())

	if err := client.Ping(ctx, nil); err != nil {
		log.Fatal("Failed to ping MongoDB:", err)
	}

	log.Println("Connected to MongoDB successfully")

	db := client.Database(cfg.DatabaseName)

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)
	photoRepo := repository.NewPhotoRepository(db)

	// Initialize services
	authService := service.NewAuthService(userRepo, cfg)
	photoService := service.NewPhotoService(photoRepo, cfg) // 注入 photoRepo

	// Initialize controllers
	authController := controller.NewAuthController(authService)
	photoController := controller.NewPhotoController(photoService)

	// Setup Gin router
	router := gin.Default()

	// CORS middleware
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Public routes
	api := router.Group("/api/v1")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authController.Register)
			auth.POST("/login", authController.Login)
		}

		// Protected routes
		photos := api.Group("/photos")
		photos.Use(middleware.AuthMiddleware(cfg))
		{
			photos.POST("", photoController.Upload)
			photos.GET("", photoController.List)
			photos.GET("/:id", photoController.GetByID)
			photos.PUT("/:id", photoController.Update)
			photos.DELETE("/:id", photoController.Delete)
		}
	}

	// Serve uploaded files
	router.Static("/uploads", cfg.UploadDir)

	log.Printf("Server starting on port %s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
