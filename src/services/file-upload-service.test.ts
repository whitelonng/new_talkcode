import { describe, expect, it, vi } from 'vitest';
import { fileUploadService } from './file-upload-service';

vi.mock('./file-service', () => ({
  fileService: {
    saveClipboardImage: vi.fn().mockResolvedValue({
      filePath: '/attachments/stored.png',
      filename: 'clipboard-123.png',
    }),
    uint8ArrayToBase64Public: vi.fn().mockReturnValue('base64data'),
  },
}));

describe('fileUploadService.extractFilename', () => {
  it('should handle Windows paths', () => {
    const filename = (fileUploadService as { extractFilename: (p: string) => string }).extractFilename(
      'C:\\Users\\dev\\image.png'
    );

    expect(filename).toBe('image.png');
  });

  it('should handle mixed separators', () => {
    const filename = (fileUploadService as { extractFilename: (p: string) => string }).extractFilename(
      'C:/Users/dev\\images/photo.jpg'
    );

    expect(filename).toBe('photo.jpg');
  });

  it('should handle trailing separators', () => {
    const filename = (fileUploadService as { extractFilename: (p: string) => string }).extractFilename(
      'C:\\Users\\dev\\images\\'
    );

    expect(filename).toBe('images');
  });
});

describe('fileUploadService.uploadFromFileData', () => {
  it('should preserve the original filename', async () => {
    const fileData = new Uint8Array([1, 2, 3]);
    const mimeType = 'image/png';
    const originalFileName = 'photo.png';

    const attachment = await fileUploadService.uploadFromFileData(
      fileData,
      mimeType,
      originalFileName
    );

    expect(attachment?.filename).toBe(originalFileName);
    expect(attachment?.filePath).toBe('/attachments/stored.png');
  });
});
