package controller

import (
	"net/http"
	"photoms/internal/service"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PhotoController struct {
	photoService *service.PhotoService
}

func NewPhotoController(photoService *service.PhotoService) *PhotoController {
	return &PhotoController{photoService: photoService}
}

func (ctrl *PhotoController) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// 从 JWT 中间件获取用户 ID
	userIDStr, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, _ := primitive.ObjectIDFromHex(userIDStr.(string))

	photo, err := ctrl.photoService.UploadPhoto(c.Request.Context(), userID, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, photo)
}

func (ctrl *PhotoController) List(c *gin.Context) {
	// TODO: Implement list
	c.JSON(200, gin.H{
		"data": []interface{}{},
		"meta": gin.H{
			"total": 0,
			"page":  1,
			"limit": 20,
		},
	})
}

func (ctrl *PhotoController) GetByID(c *gin.Context) {
	// TODO: Implement get by ID
	c.JSON(200, gin.H{"message": "Get photo endpoint - to be implemented"})
}

func (ctrl *PhotoController) Update(c *gin.Context) {
	// TODO: Implement update
	c.JSON(200, gin.H{"status": "ok"})
}

func (ctrl *PhotoController) Delete(c *gin.Context) {
	// TODO: Implement delete
	c.JSON(200, gin.H{"status": "ok"})
}
