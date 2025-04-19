export function getFileIcon(fileType: string) {
  switch (fileType) {
    case 'pdf':
      return '📄'
    case 'doc':
    case 'docx':
      return '📝'
    case 'xls':
    case 'xlsx':
      return '📊'
    case 'ppt':
    case 'pptx':
      return '📑'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
      return '🖼️'
    case 'mp3':
    case 'wav':
    case 'ogg':
      return '🎵'
    case 'mp4':
    case 'mov':
    case 'avi':
      return '🎥'
    case 'zip':
    case 'rar':
    case '7z':
      return '📦'
    case 'exe':
      return '⚙️'
    case 'txt':
      return '📄'
    default:
      return '📄'
  }
}

export function bytesToString(bytes: number) {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}
