import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadPDF(
  fileBuffer: Buffer,
  filename: string,
  engagementId: number,
  folder: string = 'vouching-pdfs'
): Promise<{
  public_id: string;
  url: string;
  secure_url: string;
  resource_type: string;
}> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        public_id: `${engagementId}/${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        folder,
        type: 'upload',
        flags: ['immutable'],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            public_id: result.public_id,
            url: result.url,
            secure_url: result.secure_url,
            resource_type: result.resource_type,
          });
        } else {
          reject(new Error('Unknown upload error'));
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
}

export async function deletePDF(publicId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function getPDFUrl(publicId: string): Promise<string> {
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: 'raw',
  });
}
