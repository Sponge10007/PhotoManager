package utils

import (
	"fmt"
	"os"
	"photoms/internal/models"

	"github.com/disintegration/imaging"
	"github.com/rwcarlsen/goexif/exif"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ExtractExif 从图片文件中提取EXIF信息
func ExtractExif(filePath string) (*models.ExifInfo, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	x, err := exif.Decode(file)
	if err != nil {
		// 图片没有EXIF信息，返回nil而不是错误
		return nil, nil
	}

	exifInfo := &models.ExifInfo{}

	// 提取相机品牌
	if make, err := x.Get(exif.Make); err == nil {
		exifInfo.Make, _ = make.StringVal()
	}

	// 提取相机型号
	if model, err := x.Get(exif.Model); err == nil {
		exifInfo.Model, _ = model.StringVal()
	}

	// 提取镜头型号
	if lens, err := x.Get(exif.LensModel); err == nil {
		exifInfo.Lens, _ = lens.StringVal()
	}

	// 提取ISO
	if iso, err := x.Get(exif.ISOSpeedRatings); err == nil {
		if vals, err := iso.Int(0); err == nil {
			exifInfo.ISO = vals
		}
	}

	// 提取光圈
	if aperture, err := x.Get(exif.FNumber); err == nil {
		if num, denom, err := aperture.Rat2(0); err == nil && denom != 0 {
			exifInfo.Aperture = float64(num) / float64(denom)
		}
	}

	// 提取快门速度
	if shutter, err := x.Get(exif.ExposureTime); err == nil {
		if num, denom, err := shutter.Rat2(0); err == nil {
			if num == 1 {
				exifInfo.ShutterSpeed = fmt.Sprintf("1/%d", denom)
			} else {
				exifInfo.ShutterSpeed = fmt.Sprintf("%d/%d", num, denom)
			}
		}
	}

	// 提取焦距
	if focal, err := x.Get(exif.FocalLength); err == nil {
		if num, denom, err := focal.Rat2(0); err == nil && denom != 0 {
			exifInfo.FocalLength = float64(num) / float64(denom)
		}
	}

	// 提取GPS信息
	lat, lon, err := x.LatLong()
	if err == nil {
		exifInfo.GPS = &models.GPSInfo{
			Latitude:  lat,
			Longitude: lon,
		}
	}

	// 提取拍摄时间
	if dt, err := x.DateTime(); err == nil {
		takenAt := primitive.NewDateTimeFromTime(dt)
		exifInfo.TakenAt = &takenAt
	}

	return exifInfo, nil
}

// GenerateThumbnail 生成缩略图
func GenerateThumbnail(srcPath, dstPath string, width int) error {
	// 打开原图
	src, err := imaging.Open(srcPath)
	if err != nil {
		return fmt.Errorf("failed to open image: %w", err)
	}

	// 生成缩略图（保持宽高比）
	thumb := imaging.Resize(src, width, 0, imaging.Lanczos)

	// 保存缩略图
	err = imaging.Save(thumb, dstPath)
	if err != nil {
		return fmt.Errorf("failed to save thumbnail: %w", err)
	}

	return nil
}
