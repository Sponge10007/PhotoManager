package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"photoms/internal/models"
	"photoms/internal/repository"
	"photoms/pkg/config"
	"photoms/pkg/utils"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PhotoService struct {
	repo   *repository.PhotoRepository
	config *config.Config
}

func NewPhotoService(repo *repository.PhotoRepository, cfg *config.Config) *PhotoService {
	return &PhotoService{repo: repo, config: cfg}
}

func (s *PhotoService) UploadPhoto(ctx context.Context, userID primitive.ObjectID, file *multipart.FileHeader) (*models.Photo, error) {
	src, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	// 1. 计算文件 Hash 用于秒传
	hash := sha256.New()
	if _, err := io.Copy(hash, src); err != nil {
		return nil, err
	}
	fileHash := hex.EncodeToString(hash.Sum(nil))

	// 检查是否已存在相同 Hash 的图片
	existing, _ := s.repo.FindByHash(ctx, fileHash)
	if existing != nil {
		// 秒传逻辑：复用路径，仅新建数据库记录
		newPhoto := *existing
		newPhoto.ID = primitive.NilObjectID
		newPhoto.UserID = userID
		if err := s.repo.Create(ctx, &newPhoto); err != nil {
			return nil, err
		}
		return &newPhoto, nil
	}

	// 2. 保存新文件
	src.Seek(0, 0) // 重置读取位置
	ext := filepath.Ext(file.Filename)
	newFileName := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), fileHash[:8], ext)
	uploadPath := filepath.Join(s.config.UploadDir, newFileName)

	// 确保目录存在
	os.MkdirAll(s.config.UploadDir, os.ModePerm)

	dst, err := os.Create(uploadPath)
	if err != nil {
		return nil, err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return nil, err
	}

	// 提取EXIF信息
	exifInfo, _ := utils.ExtractExif(uploadPath)

	// 生成缩略图
	thumbFileName := fmt.Sprintf("thumb_%s", newFileName)
	thumbPath := filepath.Join(s.config.UploadDir, thumbFileName)
	if err := utils.GenerateThumbnail(uploadPath, thumbPath, 400); err != nil {
		fmt.Printf("Warning: failed to generate thumbnail: %v\n", err)
		thumbFileName = newFileName // 失败时使用原图
	}

	// 构造数据库模型
	photo := &models.Photo{
		UserID:    userID,
		Title:     file.Filename,
		FileName:  newFileName,
		Path:      "/uploads/" + newFileName, // 用于前端访问
		ThumbPath: "/uploads/" + newFileName, // 暂时使用原图作为缩略图
		Hash:      fileHash,
		Size:      file.Size,
		MimeType:  file.Header.Get("Content-Type"),
		Exif:      exifInfo,
	}

	if err := s.repo.Create(ctx, photo); err != nil {
		return nil, err
	}

	return photo, nil
}

func (s *PhotoService) ListPhotos(ctx context.Context, userID primitive.ObjectID, page, limit int64) ([]*models.Photo, int64, error) {
	return s.repo.FindByUserID(ctx, userID, page, limit)
}

// GetPhotoByID 获取单张图片详情（验证用户所有权）
func (s *PhotoService) GetPhotoByID(ctx context.Context, photoID, userID primitive.ObjectID) (*models.Photo, error) {
	photo, err := s.repo.FindByID(ctx, photoID)
	if err != nil {
		return nil, fmt.Errorf("photo not found: %w", err)
	}

	// 验证用户所有权
	if photo.UserID != userID {
		return nil, fmt.Errorf("unauthorized: photo belongs to another user")
	}

	return photo, nil
}

// UpdatePhoto 更新图片信息（仅允许更新标题、描述、标签）
func (s *PhotoService) UpdatePhoto(ctx context.Context, photoID, userID primitive.ObjectID, updates map[string]interface{}) (*models.Photo, error) {
	// 先验证所有权
	photo, err := s.GetPhotoByID(ctx, photoID, userID)
	if err != nil {
		return nil, err
	}

	// 构造更新数据（只允许更新特定字段）
	allowedFields := map[string]bool{
		"title":       true,
		"description": true,
		"tags":        true,
	}

	updateData := make(map[string]interface{})
	for key, value := range updates {
		if allowedFields[key] {
			updateData[key] = value
		}
	}

	// 如果没有有效的更新字段，直接返回原数据
	if len(updateData) == 0 {
		return photo, nil
	}

	// 执行更新
	if err := s.repo.Update(ctx, photoID, updateData); err != nil {
		return nil, fmt.Errorf("failed to update photo: %w", err)
	}

	// 重新查询返回最新数据
	return s.repo.FindByID(ctx, photoID)
}

// DeletePhoto 删除图片（包括文件和数据库记录）
func (s *PhotoService) DeletePhoto(ctx context.Context, photoID, userID primitive.ObjectID) error {
	// 先验证所有权
	photo, err := s.GetPhotoByID(ctx, photoID, userID)
	if err != nil {
		return err
	}

	// 删除磁盘文件
	if photo.FileName != "" {
		filePath := filepath.Join(s.config.UploadDir, photo.FileName)
		if err := os.Remove(filePath); err != nil {
			// 文件删除失败不阻塞数据库删除，仅记录错误
			fmt.Printf("Warning: failed to delete file %s: %v\n", filePath, err)
		}
	}

	// 删除缩略图（如果与原图不同）
	if photo.ThumbPath != "" && photo.ThumbPath != photo.Path {
		thumbFileName := filepath.Base(photo.ThumbPath)
		thumbPath := filepath.Join(s.config.UploadDir, thumbFileName)
		if err := os.Remove(thumbPath); err != nil {
			fmt.Printf("Warning: failed to delete thumbnail %s: %v\n", thumbPath, err)
		}
	}

	// 删除数据库记录
	if err := s.repo.Delete(ctx, photoID); err != nil {
		return fmt.Errorf("failed to delete photo from database: %w", err)
	}

	return nil
}
