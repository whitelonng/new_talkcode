// src/hooks/use-file-upload.ts
// React hook wrapper for file upload service

import { useCallback, useState } from 'react';
import { fileUploadService } from '@/services/file-upload-service';
import type { MessageAttachment } from '@/types/agent';

/**
 * React hook for file uploads
 * Delegates all business logic to fileUploadService
 * Manages loading state for UI
 */
export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = useCallback(async (): Promise<MessageAttachment[]> => {
    try {
      setIsUploading(true);
      return await fileUploadService.uploadImagesFromDialog();
    } catch (_error) {
      return [];
    } finally {
      setIsUploading(false);
    }
  }, []);

  const uploadFile = useCallback(async (): Promise<MessageAttachment | null> => {
    try {
      setIsUploading(true);
      return await fileUploadService.uploadFileFromDialog();
    } catch (_error) {
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const uploadVideo = useCallback(async (): Promise<MessageAttachment[]> => {
    try {
      setIsUploading(true);
      return await fileUploadService.uploadVideosFromDialog();
    } catch (_error) {
      return [];
    } finally {
      setIsUploading(false);
    }
  }, []);

  const uploadFromClipboard = useCallback(async (blob: Blob): Promise<MessageAttachment | null> => {
    try {
      setIsUploading(true);
      return await fileUploadService.uploadFromBlob(blob);
    } catch (_error) {
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const uploadFromFileData = useCallback(
    async (
      fileData: Uint8Array,
      mimeType: string,
      originalFileName: string
    ): Promise<MessageAttachment | null> => {
      try {
        setIsUploading(true);
        return await fileUploadService.uploadFromFileData(fileData, mimeType, originalFileName);
      } catch (_error) {
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  return {
    uploadImage,
    uploadFile,
    uploadVideo,
    uploadFromClipboard,
    uploadFromFileData,
    isUploading,
  };
}
