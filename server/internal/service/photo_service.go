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

	// 3. 构造数据库模型
	photo := &models.Photo{
		UserID:    userID,
		Title:     file.Filename,
		FileName:  newFileName,
		Path:      "/uploads/" + newFileName, // 用于前端访问
		ThumbPath: "/uploads/" + newFileName, // 暂时使用原图作为缩略图
		Hash:      fileHash,
		Size:      file.Size,
		MimeType:  file.Header.Get("Content-Type"),
	}

	if err := s.repo.Create(ctx, photo); err != nil {
		return nil, err
	}

	return photo, nil
}
