-- Migration: Add audio/media support to messages
-- Tracks MIME type and media URLs for WhatsApp voice notes, images, videos

-- Add columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Index for efficient filtering by media type
CREATE INDEX IF NOT EXISTS idx_messages_mime_type ON messages(mime_type);
CREATE INDEX IF NOT EXISTS idx_messages_media_url ON messages(media_url);
