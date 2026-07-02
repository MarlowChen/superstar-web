export function getDownloadFileName(modelName: string, imageId: string | number) {
  // return `AI Generated ${source}_${imageId}.jpg`;
  return `aierone-${modelName}-${imageId}.jpg`;
} 