package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type User struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Username  string             `bson:"username" json:"username"`
	Password  string             `bson:"password" json:"-"`
	Email     string             `bson:"email" json:"email"`
	CreatedAt primitive.DateTime `bson:"created_at" json:"createdAt"`
	UpdatedAt primitive.DateTime `bson:"updated_at" json:"updatedAt"`
}

type Photo struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID      primitive.ObjectID `bson:"user_id" json:"userId"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	FileName    string             `bson:"file_name" json:"fileName"`
	Path        string             `bson:"path" json:"path"`
	ThumbPath   string             `bson:"thumb_path" json:"thumbPath"`
	Hash        string             `bson:"hash" json:"hash"`
	Size        int64              `bson:"size" json:"size"`
	MimeType    string             `bson:"mime_type" json:"mimeType"`
	Exif        *ExifInfo          `bson:"exif,omitempty" json:"exif,omitempty"`
	Tags        []Tag              `bson:"tags,omitempty" json:"tags"`
	CreatedAt   primitive.DateTime `bson:"created_at" json:"createdAt"`
	UpdatedAt   primitive.DateTime `bson:"updated_at" json:"updatedAt"`
}

type ExifInfo struct {
	Make         string              `bson:"make,omitempty" json:"make,omitempty"`
	Model        string              `bson:"model,omitempty" json:"model,omitempty"`
	Lens         string              `bson:"lens,omitempty" json:"lens,omitempty"`
	ISO          int                 `bson:"iso,omitempty" json:"iso,omitempty"`
	Aperture     float64             `bson:"aperture,omitempty" json:"aperture,omitempty"`
	ShutterSpeed string              `bson:"shutter_speed,omitempty" json:"shutterSpeed,omitempty"`
	FocalLength  float64             `bson:"focal_length,omitempty" json:"focalLength,omitempty"`
	GPS          *GPSInfo            `bson:"gps,omitempty" json:"gps,omitempty"`
	TakenAt      *primitive.DateTime `bson:"taken_at,omitempty" json:"takenAt,omitempty"`
}

type GPSInfo struct {
	Latitude  float64 `bson:"latitude" json:"latitude"`
	Longitude float64 `bson:"longitude" json:"longitude"`
}

type Tag struct {
	Name   string  `bson:"name" json:"name"`
	Source string  `bson:"source" json:"source"` // "USER" or "AI"
	Score  float64 `bson:"score,omitempty" json:"score,omitempty"`
}
