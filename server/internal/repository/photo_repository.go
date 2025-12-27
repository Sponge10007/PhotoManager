package repository

import (
	"context"
	"photoms/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type PhotoRepository struct {
	collection *mongo.Collection
}

func NewPhotoRepository(db *mongo.Database) *PhotoRepository {
	return &PhotoRepository{
		collection: db.Collection("photos"),
	}
}

func (r *PhotoRepository) Create(ctx context.Context, photo *models.Photo) error {
	photo.CreatedAt = primitive.NewDateTimeFromTime(primitive.DateTime(0).Time())
	photo.UpdatedAt = photo.CreatedAt

	result, err := r.collection.InsertOne(ctx, photo)
	if err != nil {
		return err
	}

	photo.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *PhotoRepository) FindByHash(ctx context.Context, hash string) (*models.Photo, error) {
	var photo models.Photo
	err := r.collection.FindOne(ctx, bson.M{"hash": hash}).Decode(&photo)
	if err != nil {
		return nil, err
	}
	return &photo, nil
}

func (r *PhotoRepository) FindByUserID(ctx context.Context, userID primitive.ObjectID, page, limit int64) ([]*models.Photo, int64, error) {
	skip := (page - 1) * limit

	filter := bson.M{"user_id": userID}

	opts := options.Find().
		SetSkip(skip).
		SetLimit(limit).
		SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var photos []*models.Photo
	if err = cursor.All(ctx, &photos); err != nil {
		return nil, 0, err
	}

	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	return photos, total, nil
}

func (r *PhotoRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Photo, error) {
	var photo models.Photo
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&photo)
	if err != nil {
		return nil, err
	}
	return &photo, nil
}

func (r *PhotoRepository) Update(ctx context.Context, id primitive.ObjectID, update bson.M) error {
	update["updated_at"] = primitive.NewDateTimeFromTime(primitive.DateTime(0).Time())

	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"_id": id},
		bson.M{"$set": update},
	)
	return err
}

func (r *PhotoRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}
