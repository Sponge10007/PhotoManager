package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"photoms/internal/models"
	"photoms/internal/repository"
	"photoms/pkg/ai"
	"photoms/pkg/config"
	"photoms/pkg/utils"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PhotoService struct {
	repo   *repository.PhotoRepository
	config *config.Config
	tagger ai.ImageTagger
}

func NewPhotoService(repo *repository.PhotoRepository, cfg *config.Config) *PhotoService {
	tagger, err := ai.NewImageTagger(cfg)
	if err != nil && !errors.Is(err, ai.ErrDisabled) {
		fmt.Printf("Warning: AI tagger is not available: %v\n", err)
	}
	return &PhotoService{repo: repo, config: cfg, tagger: tagger}
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
		// 秒传逻辑：复用文件/EXIF/缩略图，但不复用用户元数据（标题/描述/标签）
		newPhoto := &models.Photo{
			UserID:    userID,
			Title:     file.Filename,
			FileName:  existing.FileName,
			Path:      existing.Path,
			ThumbPath: existing.ThumbPath,
			Hash:      existing.Hash,
			Size:      existing.Size,
			MimeType:  existing.MimeType,
			Exif:      existing.Exif,
			Tags:      buildAutoTags(existing.Exif, filepath.Ext(existing.FileName), existing.MimeType),
		}

		if err := s.repo.Create(ctx, newPhoto); err != nil {
			return nil, err
		}
		s.maybeGenerateAITagsAsync(newPhoto.ID, userID)
		return newPhoto, nil
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
	thumbFileName := fmt.Sprintf("thumb_%s.jpg", strings.TrimSuffix(newFileName, ext))
	thumbPath := filepath.Join(s.config.UploadDir, thumbFileName)
	if err := utils.GenerateThumbnail(uploadPath, thumbPath, 400); err != nil {
		fmt.Printf("Warning: failed to generate thumbnail: %v\n", err)
		thumbFileName = newFileName // 失败时使用原图
	}

	// 构造数据库模型
	mimeType := file.Header.Get("Content-Type")
	autoTags := buildAutoTags(exifInfo, ext, mimeType)

	photo := &models.Photo{
		UserID:    userID,
		Title:     file.Filename,
		FileName:  newFileName,
		Path:      "/uploads/" + newFileName, // 用于前端访问
		ThumbPath: "/uploads/" + thumbFileName,
		Hash:      fileHash,
		Size:      file.Size,
		MimeType:  mimeType,
		Exif:      exifInfo,
		Tags:      autoTags,
	}

	if err := s.repo.Create(ctx, photo); err != nil {
		return nil, err
	}

	s.maybeGenerateAITagsAsync(photo.ID, userID)
	return photo, nil
}

func (s *PhotoService) ListPhotos(ctx context.Context, userID primitive.ObjectID, page, limit int64, q, tag string, startDate, endDate *time.Time) ([]*models.Photo, int64, error) {
	return s.repo.FindByUserID(ctx, userID, page, limit, q, tag, startDate, endDate)
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

func (s *PhotoService) GenerateAITags(ctx context.Context, photoID, userID primitive.ObjectID) (*models.Photo, error) {
	if s.config == nil || !s.config.AITaggingEnabled {
		return nil, ai.ErrDisabled
	}
	if s.tagger == nil {
		return nil, ai.ErrNotConfigured
	}

	photo, err := s.GetPhotoByID(ctx, photoID, userID)
	if err != nil {
		return nil, err
	}

	imagePath := resolvePhotoDiskPath(s.config.UploadDir, photo)
	if imagePath == "" {
		return nil, fmt.Errorf("failed to resolve photo file path")
	}

	aiTags, err := s.tagger.GenerateTags(ctx, imagePath)
	if err != nil {
		return nil, err
	}

	merged := mergeTags(photo.Tags, aiTags)
	if err := s.repo.Update(ctx, photoID, bson.M{"tags": merged}); err != nil {
		return nil, fmt.Errorf("failed to update AI tags: %w", err)
	}

	return s.repo.FindByID(ctx, photoID)
}

// DeletePhoto 删除图片（包括文件和数据库记录）
func (s *PhotoService) DeletePhoto(ctx context.Context, photoID, userID primitive.ObjectID) error {
	// 先验证所有权
	photo, err := s.GetPhotoByID(ctx, photoID, userID)
	if err != nil {
		return err
	}

	// 先删除数据库记录，避免文件已删除但数据库删除失败
	if err := s.repo.Delete(ctx, photoID); err != nil {
		return fmt.Errorf("failed to delete photo from database: %w", err)
	}

	// 若该文件被其他记录复用（秒传/重复上传），则跳过磁盘清理
	if photo.FileName == "" {
		return nil
	}

	remaining, err := s.repo.CountByFileName(ctx, photo.FileName)
	if err != nil {
		fmt.Printf("Warning: failed to count file references for %s: %v\n", photo.FileName, err)
		return nil
	}
	if remaining > 0 {
		return nil
	}

	// 删除磁盘文件
	filePath := filepath.Join(s.config.UploadDir, photo.FileName)
	if err := os.Remove(filePath); err != nil {
		fmt.Printf("Warning: failed to delete file %s: %v\n", filePath, err)
	}

	// 删除缩略图（如果与原图不同）
	if photo.ThumbPath != "" && photo.ThumbPath != photo.Path {
		thumbFileName := filepath.Base(photo.ThumbPath)
		thumbPath := filepath.Join(s.config.UploadDir, thumbFileName)
		if err := os.Remove(thumbPath); err != nil {
			fmt.Printf("Warning: failed to delete thumbnail %s: %v\n", thumbPath, err)
		}
	}

	return nil
}

func (s *PhotoService) maybeGenerateAITagsAsync(photoID, userID primitive.ObjectID) {
	if s.tagger == nil || s.config == nil || !s.config.AITaggingEnabled {
		return
	}

	timeout := time.Duration(s.config.AITagTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 20 * time.Second
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		if _, err := s.GenerateAITags(ctx, photoID, userID); err != nil {
			fmt.Printf("Warning: AI tagging failed for photo %s: %v\n", photoID.Hex(), err)
		}
	}()
}

func resolvePhotoDiskPath(uploadDir string, photo *models.Photo) string {
	if photo == nil {
		return ""
	}

	// Prefer thumbnail to reduce payload size (fallback to original).
	if p := joinUploadPath(uploadDir, photo.ThumbPath); p != "" {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return joinUploadPath(uploadDir, photo.Path)
}

func joinUploadPath(uploadDir, webPath string) string {
	base := filepath.Base(strings.TrimSpace(webPath))
	if base == "" || base == "." || base == "/" {
		return ""
	}
	return filepath.Join(uploadDir, base)
}

func mergeTags(existing []models.Tag, additions []models.Tag) []models.Tag {
	out := make([]models.Tag, 0, len(existing)+len(additions))
	seen := make(map[string]struct{}, len(existing)+len(additions))

	addTag := func(tag models.Tag) {
		name := strings.TrimSpace(strings.Trim(tag.Name, "\"\x00"))
		if name == "" {
			return
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		tag.Name = name
		out = append(out, tag)
	}

	for _, tag := range existing {
		addTag(tag)
	}
	for _, tag := range additions {
		addTag(tag)
	}
	return out
}

func buildAutoTags(exifInfo *models.ExifInfo, fileExt, mimeType string) []models.Tag {
	tags := make([]models.Tag, 0, 8)
	seen := make(map[string]struct{}, 8)

	add := func(name string) {
		name = strings.TrimSpace(strings.Trim(name, "\"\x00"))
		if name == "" {
			return
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		tags = append(tags, models.Tag{
			Name:   name,
			Source: "AI",
		})
	}

	if fileExt != "" {
		ext := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(fileExt)), ".")
		if ext != "" {
			add(ext)
		}
	}

	if mimeType != "" {
		parts := strings.SplitN(mimeType, "/", 2)
		if len(parts) == 2 && strings.TrimSpace(parts[1]) != "" {
			add(strings.TrimSpace(parts[1]))
		}
	}

	if exifInfo == nil {
		return tags
	}

	add(exifInfo.Make)
	add(exifInfo.Model)
	add(exifInfo.Lens)
	if exifInfo.ISO > 0 {
		add(fmt.Sprintf("ISO%d", exifInfo.ISO))
	}
	if exifInfo.GPS != nil {
		add("GPS")
	}

	return tags
}

// server/internal/service/photo_service.go 增加方法

func (s *PhotoService) EditPhoto(ctx context.Context, photoID, userID primitive.ObjectID,
	cropX, cropY, cropW, cropH int, brightness, contrast, saturation float64) (*models.Photo, error) {

	// 获取原图
	oldPhoto, err := s.GetPhotoByID(ctx, photoID, userID)
	if err != nil {
		return nil, err
	}

	// 准备新文件路径
	oldFilePath := filepath.Join(s.config.UploadDir, filepath.Base(oldPhoto.Path))
	oldBase := filepath.Base(oldPhoto.Path)
	oldExt := filepath.Ext(oldBase)
	extLower := strings.ToLower(oldExt)
	oldStem := strings.TrimSuffix(oldBase, oldExt)

	outExt := extLower
	switch outExt {
	case ".jpeg":
		outExt = ".jpg"
	case ".jpg", ".png", ".gif", ".bmp", ".tif", ".tiff":
		// keep
	default:
		outExt = ".jpg"
	}

	newFileName := fmt.Sprintf("edit_%d_%s%s", time.Now().UnixNano(), oldStem, outExt)
	newUploadPath := filepath.Join(s.config.UploadDir, newFileName)

	// 调用工具类处理图片
	if err := utils.EditImage(oldFilePath, newUploadPath, cropX, cropY, cropW, cropH, brightness, contrast, saturation); err != nil {
		return nil, err
	}

	// 生成新缩略图并复用原 EXIF
	thumbName := "thumb_" + newFileName
	if err := utils.GenerateThumbnail(newUploadPath, filepath.Join(s.config.UploadDir, thumbName), 400); err != nil {
		fmt.Printf("Warning: failed to generate thumbnail: %v\n", err)
		thumbName = newFileName
	}

	info, err := os.Stat(newUploadPath)
	if err != nil {
		return nil, err
	}

	file, err := os.Open(newUploadPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return nil, err
	}
	newHash := hex.EncodeToString(hash.Sum(nil))

	newMimeType := oldPhoto.MimeType
	switch outExt {
	case ".jpg":
		newMimeType = "image/jpeg"
	case ".png":
		newMimeType = "image/png"
	case ".gif":
		newMimeType = "image/gif"
	case ".bmp":
		newMimeType = "image/bmp"
	case ".tif", ".tiff":
		newMimeType = "image/tiff"
	}

	// 创建新文档记录 (非破坏性编辑：生成新图片)
	newPhoto := *oldPhoto
	newPhoto.ID = primitive.NilObjectID
	newPhoto.Title = "编辑自: " + oldPhoto.Title
	newPhoto.FileName = newFileName
	newPhoto.Path = "/uploads/" + newFileName
	newPhoto.ThumbPath = "/uploads/" + thumbName
	newPhoto.Hash = newHash
	newPhoto.Size = info.Size()
	newPhoto.MimeType = newMimeType

	if err := s.repo.Create(ctx, &newPhoto); err != nil {
		return nil, err
	}
	return &newPhoto, nil
}
