const TARGET_SIZE = 1.5 * 1024 * 1024;
const START_MAX_SIDE = 1920;

function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Impossible de lire cette photo. Sur iPhone, essaie de la partager en JPEG ou active « Le plus compatible » dans Réglages > Appareil photo > Formats.'));
    };
    image.src = objectUrl;
  });
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('La photo n’a pas pu être optimisée. Essaie une autre image.')), 'image/jpeg', quality);
  });
}

/** Downscale and re-encode selected images in the browser before any network upload. */
export async function compressImageFile(file) {
  if (!file) return null;
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Choisis un fichier image (photo).');
  }

  const { image, objectUrl } = await decodeImage(file);
  try {
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error('Les dimensions de la photo sont illisibles. Essaie une autre image.');

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('La compression photo n’est pas disponible dans ce navigateur.');
    let maxSide = START_MAX_SIDE;
    let quality = 0.84;
    let result;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      result = await canvasBlob(canvas, quality);
      if (result.size <= TARGET_SIZE) break;

      if (quality > 0.55) quality = Math.max(0.52, quality - 0.1);
      else {
        maxSide = Math.max(720, Math.round(maxSide * 0.8));
        quality = 0.76;
      }
    }

    if (!result || result.size > 4 * 1024 * 1024) {
      throw new Error('Cette photo reste trop volumineuse après compression. Essaie de la recadrer ou d’en choisir une autre.');
    }

    const stem = file.name.replace(/\.[^.]+$/, '') || 'photo-etuvendo';
    return new File([result], `${stem}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
