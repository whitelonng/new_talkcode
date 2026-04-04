// src/services/file-service.ts

import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import { fileParser, type ParsedFileContent } from '@/lib/local-file-parser';
import { logger } from '@/lib/logger';

export class FileService {
  private appDataPath: string | null = null;
  private attachmentsPath: string | null = null;

  private async getAppDataPath(): Promise<string> {
    if (!this.appDataPath) {
      this.appDataPath = await appDataDir();
    }
    return this.appDataPath;
  }

  async getAttachmentsPath(): Promise<string> {
    if (!this.attachmentsPath) {
      const appData = await this.getAppDataPath();
      this.attachmentsPath = await join(appData, 'attachments');
    }
    return this.attachmentsPath;
  }

  async ensureAttachmentsDirectory(): Promise<void> {
    const attachmentsPath = await this.getAttachmentsPath();
    const dirExists = await exists(attachmentsPath);

    if (!dirExists) {
      await mkdir(attachmentsPath, { recursive: true });
    }
  }

  async saveGeneratedImage(imageData: Uint8Array, filename: string): Promise<string> {
    try {
      await this.ensureAttachmentsDirectory();
      const attachmentsPath = await this.getAttachmentsPath();
      const filePath = await join(attachmentsPath, filename);

      logger.info('Saving image to:', filePath);
      await writeFile(filePath, imageData);
      return filePath;
    } catch (error) {
      logger.error('Failed to save generated image:', error);
      throw new Error('Failed to save generated image to disk');
    }
  }

  async saveClipboardImage(
    imageData: Uint8Array,
    mimeType: string
  ): Promise<{ filePath: string; filename: string }> {
    try {
      await this.ensureAttachmentsDirectory();
      const attachmentsPath = await this.getAttachmentsPath();

      // Determine file extension from MIME type
      const extensionMap: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
      };

      const extension = extensionMap[mimeType] || 'png';
      const filename = `clipboard-${Date.now()}.${extension}`;
      const filePath = await join(attachmentsPath, filename);

      logger.info('Saving clipboard image to:', filePath);
      await writeFile(filePath, imageData);

      return { filePath, filename };
    } catch (error) {
      logger.error('Failed to save clipboard image:', error);
      throw new Error('Failed to save clipboard image to disk');
    }
  }

  async copyFileToAttachments(sourcePath: string, originalFilename: string): Promise<string> {
    await this.ensureAttachmentsDirectory();

    const attachmentsPath = await this.getAttachmentsPath();
    const lastDot = originalFilename.lastIndexOf('.');
    const hasExtension = lastDot > 0;
    const baseName = hasExtension ? originalFilename.slice(0, lastDot) : originalFilename;
    const fileExtension = hasExtension ? originalFilename.slice(lastDot + 1) : '';
    const uniqueFilename = `${Date.now()}-${baseName}${fileExtension ? `.${fileExtension}` : ''}`;
    const targetPath = await join(attachmentsPath, uniqueFilename);

    const fileData = await readFile(sourcePath);
    await writeFile(targetPath, fileData);

    return targetPath;
  }

  async readAttachmentFile(filePath: string): Promise<Uint8Array> {
    return await readFile(filePath);
  }

  async deleteAttachmentFile(filePath: string): Promise<void> {
    try {
      const fileExists = await exists(filePath);
      if (fileExists) {
        await remove(filePath);
      }
    } catch (error) {
      logger.error('Failed to delete attachment file:', error);
    }
  }

  async getFileBase64(filePath: string): Promise<string> {
    try {
      const fileData = await this.readAttachmentFile(filePath);
      return this.uint8ArrayToBase64(fileData);
    } catch (error) {
      logger.error('Failed to read file as base64:', error);
      throw error;
    }
  }

  async parseFileContent(filePath: string): Promise<ParsedFileContent> {
    try {
      const fileData = await this.readAttachmentFile(filePath);
      return await fileParser.parseFileFromPath(filePath, fileData);
    } catch (error) {
      logger.error('Failed to parse file content:', error);
      throw error;
    }
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    const CHUNK_SIZE = 0x80_00;
    let binary = '';

    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
      binary += String.fromCharCode(...Array.from(chunk));
    }

    return btoa(binary);
  }

  // Public wrapper for uint8ArrayToBase64 to support direct conversion
  uint8ArrayToBase64Public(bytes: Uint8Array): string {
    return this.uint8ArrayToBase64(bytes);
  }

  getFilenameFromPath(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!normalizedPath) return 'unknown';
    return normalizedPath.split('/').pop() || 'unknown';
  }

  async getFileSize(filePath: string): Promise<number> {
    try {
      const fileData = await this.readAttachmentFile(filePath);
      return fileData.length;
    } catch (error) {
      logger.error('Failed to get file size:', error);
      return 0;
    }
  }
}

export const fileService = new FileService();
