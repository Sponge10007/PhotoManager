package utils

import (
	"errors"
	"fmt"
	"image"
	"os"
	"photoms/internal/models"

	"github.com/disintegration/imaging"
	"github.com/rwcarlsen/goexif/exif"
	"go.mongodb.org/mongo-driver/bson/primitive"
	_ "golang.org/x/image/webp"
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

// EditImage 处理图片：裁剪并调整色调
func EditImage(srcPath, dstPath string, cropX, cropY, cropW, cropH int, brightness, contrast, saturation float64) error {
	src, err := imaging.Open(srcPath)
	if err != nil {
		if errors.Is(err, image.ErrFormat) {
			return fmt.Errorf("unsupported image format (supported: jpg/png/gif/bmp/tiff/webp): %w", err)
		}
		return fmt.Errorf("failed to open image: %w", err)
	}

	// 1. 如果提供了有效的裁剪参数，进行裁剪
	if cropW > 0 && cropH > 0 {
		b := src.Bounds()
		x0 := cropX
		y0 := cropY
		x1 := cropX + cropW
		y1 := cropY + cropH

		if x0 < b.Min.X {
			x0 = b.Min.X
		}
		if y0 < b.Min.Y {
			y0 = b.Min.Y
		}
		if x1 > b.Max.X {
			x1 = b.Max.X
		}
		if y1 > b.Max.Y {
			y1 = b.Max.Y
		}

		if x1 > x0 && y1 > y0 {
			src = imaging.Crop(src, image.Rect(x0, y0, x1, y1))
		}
	}

	// 2. 调整色调 (imaging 库支持百分比调整)
	if brightness != 0 {
		src = imaging.AdjustBrightness(src, brightness) // -100 到 100
	}
	if contrast != 0 {
		src = imaging.AdjustContrast(src, contrast)
	}
	if saturation != 0 {
		src = imaging.AdjustSaturation(src, saturation)
	}

	// 3. 保存新图
	if err := imaging.Save(src, dstPath); err != nil {
		return fmt.Errorf("failed to save image: %w", err)
	}
	return nil
}
