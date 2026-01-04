package ai

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"photoms/internal/models"
	"photoms/pkg/config"
)

var (
	ErrDisabled      = errors.New("ai tagging is disabled")
	ErrNotConfigured = errors.New("ai tagging is not configured")
)

type ImageTagger interface {
	GenerateTags(ctx context.Context, imagePath string) ([]models.Tag, error)
}

func NewImageTagger(cfg *config.Config) (ImageTagger, error) {
	if cfg == nil || !cfg.AITaggingEnabled {
		return nil, ErrDisabled
	}

	switch strings.ToLower(strings.TrimSpace(cfg.AIProvider)) {
	case "", "ark", "doubao", "openai":
		if strings.TrimSpace(cfg.ArkAPIKey) == "" {
			return nil, fmt.Errorf("%w: ARK_API_KEY is empty", ErrNotConfigured)
		}
		return NewArkImageTagger(cfg), nil
	default:
		return nil, fmt.Errorf("%w: unsupported AI_PROVIDER=%q", ErrNotConfigured, cfg.AIProvider)
	}
}
