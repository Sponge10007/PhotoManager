package controller

import (
	"github.com/gin-gonic/gin"
)

type PhotoController struct {
	// TODO: Add photo service
}

func NewPhotoController() *PhotoController {
	return &PhotoController{}
}

func (ctrl *PhotoController) Upload(c *gin.Context) {
	// TODO: Implement upload
	c.JSON(200, gin.H{"message": "Upload endpoint - to be implemented"})
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
