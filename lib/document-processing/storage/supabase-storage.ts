/**
 * Supabase Storage Helpers
 * 
 * Handles file operations with Supabase Storage
 */

import { createClient } from '@/lib/supabase/server';

export const STORAGE_BUCKET = 'kb-documents';

/**
 * Generate a storage path for a document
 * Format: {userId}/{kbId}/{timestamp}-{filename}
 */
export function generateStoragePath(
  userId: string,
  kbId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-z0-9.-]/gi, '_');
  return `${userId}/${kbId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  filePath: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download a file from Supabase Storage
 */
export async function downloadFile(
  filePath: string
): Promise<{ success: boolean; data?: Buffer; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(filePath);

    if (error) {
      console.error('Storage download error:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'No data returned from storage' };
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { success: true, data: buffer };
  } catch (error) {
    console.error('Download failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Storage delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get public URL for a file (if bucket is public)
 */
export async function getPublicUrl(filePath: string): Promise<string> {
  const supabase = await createClient();
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Create a signed URL for temporary access
 */
export async function createSignedUrl(
  filePath: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Signed URL error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (error) {
    console.error('Signed URL creation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
