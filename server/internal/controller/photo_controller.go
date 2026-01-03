package controller

import (
	"fmt"
	"net/http"
	"photoms/internal/models"
	"photoms/internal/service"
	"strconv"
	"strings"
	"time"

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
	// 1. 获取分页参数
	page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 64)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	// 过滤参数
	q := strings.TrimSpace(c.Query("q"))
	tag := strings.TrimSpace(c.Query("tag"))

	startDate, err := parseDateQuery(c.Query("startDate"), false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	endDate, err := parseDateQuery(c.Query("endDate"), true)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 2. 获取当前用户 ID
	userIDStr, _ := c.Get("userId")
	userID, _ := primitive.ObjectIDFromHex(userIDStr.(string))

	// 3. 调用 Service 获取数据
	photos, total, err := ctrl.photoService.ListPhotos(c.Request.Context(), userID, page, limit, q, tag, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(photos) == 0 {
		photos = []*models.Photo{}
	}
	c.JSON(http.StatusOK, gin.H{
		"data": photos,
		"meta": gin.H{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

func parseDateQuery(value string, endOfDay bool) (*time.Time, error) {
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

func (ctrl *PhotoController) GetByID(c *gin.Context) {
	// 1. 获取图片ID
	photoIDStr := c.Param("id")
	photoID, err := primitive.ObjectIDFromHex(photoIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid photo ID"})
		return
	}

	// 2. 获取当前用户ID
	userIDStr, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := primitive.ObjectIDFromHex(userIDStr.(string))

	// 3. 调用Service获取照片详情
	photo, err := ctrl.photoService.GetPhotoByID(c.Request.Context(), photoID, userID)
	if err != nil {
		if err.Error() == "unauthorized: photo belongs to another user" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: You don't have permission to access this photo"})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "Photo not found"})
		return
	}

	c.JSON(http.StatusOK, photo)
}

func (ctrl *PhotoController) Update(c *gin.Context) {
	// 1. 获取图片ID
	photoIDStr := c.Param("id")
	photoID, err := primitive.ObjectIDFromHex(photoIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid photo ID"})
		return
	}

	// 2. 获取当前用户ID
	userIDStr, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := primitive.ObjectIDFromHex(userIDStr.(string))

	// 3. 解析请求体
	var updateData map[string]interface{}
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// 4. 调用Service更新照片
	photo, err := ctrl.photoService.UpdatePhoto(c.Request.Context(), photoID, userID, updateData)
	if err != nil {
		if err.Error() == "unauthorized: photo belongs to another user" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: You don't have permission to update this photo"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, photo)
}

func (ctrl *PhotoController) Delete(c *gin.Context) {
	// 1. 获取图片ID
	photoIDStr := c.Param("id")
	photoID, err := primitive.ObjectIDFromHex(photoIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid photo ID"})
		return
	}

	// 2. 获取当前用户ID
	userIDStr, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := primitive.ObjectIDFromHex(userIDStr.(string))

	// 3. 调用Service删除照片
	err = ctrl.photoService.DeletePhoto(c.Request.Context(), photoID, userID)
	if err != nil {
		if err.Error() == "unauthorized: photo belongs to another user" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: You don't have permission to delete this photo"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Photo deleted successfully"})
}
