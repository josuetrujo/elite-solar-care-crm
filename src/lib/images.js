// Phone cameras produce 4–12MB files. Uploading those over a weak signal is
// slow and pointless — a panel photo is perfectly readable at 1600px. This
// shrinks the picture in the browser before anything is sent.

const MAX_EDGE = 1600
const QUALITY = 0.82

export function downscaleImage(file, { maxEdge = MAX_EDGE, quality = QUALITY } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('That file is not an image.'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Could not process that image.')); return }
          resolve({ blob, width: w, height: h, dataUrl: canvas.toDataURL('image/jpeg', 0.6) })
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      // iPhones can hand over HEIC files that browsers won't decode.
      reject(new Error("Couldn't read that image. If it came straight off an iPhone, try taking the photo with the camera button in the app instead."))
    }
    img.src = url
  })
}

export const humanSize = (bytes) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
