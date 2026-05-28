import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import exifr from 'exifr';
import heicConvert from 'heic-convert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const sourceSets = [
  {
    id: 'engagement',
    label: 'Engagement Photos',
    folder: path.join(root, 'Photos', 'Engagement Photos'),
    sort: 'date',
    altPrefix: 'Ava and Kevin engagement photo',
  },
  {
    id: 'story',
    label: 'Kevin & Ava Pics',
    folder: path.join(root, 'Photos', 'Kevin & Ava Pics'),
    sort: 'story',
    altPrefix: 'Ava and Kevin together',
  },
  {
    id: 'courthouse',
    label: 'Santa Barbara Courthouse Photos',
    folder: path.join(root, 'Photos', 'Santa Barbara Courthouse Photos'),
    sort: 'venue',
    altPrefix: 'Santa Barbara Courthouse',
  },
];

const supportedExtensions = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.heic', '.heif']);
const outputRoot = path.join(root, 'public', 'photos');
const dataDir = path.join(root, 'src', 'data');
const manifestPath = path.join(dataDir, 'photoManifest.js');

const naturalCollator = new Intl.Collator('en-US', {
  numeric: true,
  sensitivity: 'base',
});

const storyCaptionOverrides = new Map([
  ['img_3013.jpg', 'Pittsburgh · August 2018'],
  ['img_3142.jpg', 'South Carolina State Fair · October 2019'],
  ['img_3510.jpg', 'San Antonio · December 2019'],
]);

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

async function readPhotoMetadata(filePath) {
  try {
    const data = await exifr.parse(filePath, {
      ifd0: true,
      exif: true,
      tiff: true,
      gps: false,
      xmp: false,
      icc: false,
      iptc: false,
      translateValues: true,
    });

    return {
      date: normalizeDate(
        data?.DateTimeOriginal
          || data?.CreateDate
          || data?.ModifyDate
          || data?.DateCreated,
      ),
      latitude: typeof data?.latitude === 'number' ? data.latitude : null,
      longitude: typeof data?.longitude === 'number' ? data.longitude : null,
    };
  } catch {
    return {
      date: null,
      latitude: null,
      longitude: null,
    };
  }
}

async function listSourceFiles(set) {
  const entries = await fs.readdir(set.folder, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .filter((entry) => supportedExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => ({
      category: set.id,
      categoryLabel: set.label,
      sourceName: entry.name,
      sourcePath: path.join(set.folder, entry.name),
      baseName: path.basename(entry.name, path.extname(entry.name)),
    }));

  const withDates = await Promise.all(
    files.map(async (file) => {
      const metadata = await readPhotoMetadata(file.sourcePath);
      return {
        ...file,
        ...metadata,
        locationLabel: locationLabelFor(file, metadata),
        captionLabel: captionLabelFor(file),
      };
    }),
  );

  return withDates.sort((a, b) => comparePhotos(a, b, set.sort));
}

function comparePhotos(a, b, mode) {
  const dateA = a.date?.valueOf() ?? null;
  const dateB = b.date?.valueOf() ?? null;

  if (mode === 'date') {
    if (dateA !== null && dateB !== null && dateA !== dateB) return dateA - dateB;
    if (dateA !== null && dateB === null) return -1;
    if (dateA === null && dateB !== null) return 1;
    return naturalCollator.compare(a.sourceName, b.sourceName);
  }

  if (mode === 'story') {
    if (dateA === null && dateB !== null) return -1;
    if (dateA !== null && dateB === null) return 1;
    if (dateA !== null && dateB !== null && dateA !== dateB) return dateA - dateB;
    return naturalCollator.compare(a.sourceName, b.sourceName);
  }

  if (mode === 'venue') {
    const priorityA = venuePriority(a.sourceName);
    const priorityB = venuePriority(b.sourceName);
    if (priorityA !== priorityB) return priorityA - priorityB;
    if (dateA !== null && dateB !== null && dateA !== dateB) return dateA - dateB;
    return naturalCollator.compare(a.sourceName, b.sourceName);
  }

  return naturalCollator.compare(a.sourceName, b.sourceName);
}

function venuePriority(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('courthouse')) return 0;
  if (lower.includes('clock')) return 1;
  if (lower.includes('mural')) return 2;
  if (lower.includes('stair')) return 3;
  if (lower.includes('inside')) return 4;
  return 5;
}

function displayDate(date) {
  if (!date) return null;
  return date.toISOString();
}

function locationLabelFor(file, metadata) {
  if (file.category === 'engagement') {
    return 'Lake Kawaguchiko, Japan';
  }

  if (file.category === 'courthouse') {
    return 'Santa Barbara Courthouse, Santa Barbara, California';
  }

  if (file.category !== 'story') {
    return 'Location not stored in metadata';
  }

  const lat = metadata.latitude;
  const lon = metadata.longitude;
  if (lat === null || lon === null) return 'Location not stored in metadata';

  const knownPlaces = [
    { label: 'Paris Las Vegas, Nevada', lat: 36.1128, lon: -115.1730, radius: 0.05 },
    { label: 'Dripping Springs, Texas', lat: 30.2521, lon: -98.1331, radius: 0.08 },
    { label: 'Grand Canyon, Arizona', lat: 36.0602, lon: -112.1067, radius: 0.12 },
    { label: 'Sedona, Arizona', lat: 34.9137, lon: -111.94, radius: 0.12 },
    { label: 'Wrightwood, California', lat: 34.3774, lon: -117.6916, radius: 0.12 },
    { label: 'Mount Rainier National Park, Washington', lat: 46.8054, lon: -121.728, radius: 0.12 },
    { label: 'Maui, Hawaii', lat: 20.8901, lon: -156.4329, radius: 0.18 },
    { label: 'Disneyland Resort, Anaheim, California', lat: 33.8149, lon: -117.9214, radius: 0.05 },
    { label: 'Brussels, Belgium', lat: 50.8465, lon: 4.3524, radius: 0.06 },
    { label: 'Rome, Italy', lat: 41.8903, lon: 12.4915, radius: 0.08 },
    { label: 'Santa Cruz Island, Channel Islands, California', lat: 34.0522, lon: -119.5661, radius: 0.18 },
    { label: 'Kyoto, Japan', lat: 34.9668, lon: 135.7753, radius: 0.08 },
    { label: 'Osaka, Japan', lat: 34.669, lon: 135.5011, radius: 0.08 },
    { label: 'London, United Kingdom', lat: 51.5015, lon: -0.1231, radius: 0.08 },
    { label: 'Paris, France', lat: 48.8586, lon: 2.2962, radius: 0.08 },
  ];

  const match = knownPlaces.find((place) => (
    Math.abs(lat - place.lat) <= place.radius
    && Math.abs(lon - place.lon) <= place.radius
  ));

  return match?.label ?? 'Location stored in metadata';
}

function captionLabelFor(file) {
  if (file.category !== 'story') return null;
  return storyCaptionOverrides.get(file.sourceName.toLowerCase()) ?? null;
}

function photoAlt(file, index) {
  const number = index + 1;
  if (file.category === 'courthouse') {
    const readableName = file.baseName
      .replace(/^IMG_\d+$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    return readableName
      ? `${readableName}, Santa Barbara Courthouse`
      : `Santa Barbara Courthouse photo ${number}`;
  }

  return `${file.category === 'engagement' ? 'Ava and Kevin engagement photo' : 'Ava and Kevin together'} ${number}`;
}

async function processPhoto(file, index) {
  const displayOrder = index + 1;
  const outDir = path.join(outputRoot, file.category);
  const slug = `${file.category}-${String(displayOrder).padStart(2, '0')}-${slugify(file.baseName)}`;
  const thumbFile = `${slug}-thumb.webp`;
  const fullFile = `${slug}-full.webp`;
  const thumbPath = path.join(outDir, thumbFile);
  const fullPath = path.join(outDir, fullFile);

  await fs.mkdir(outDir, { recursive: true });

  const image = await createImagePipeline(file.sourcePath);

  await image
    .clone()
    .resize({ width: 720, withoutEnlargement: true })
    .webp({ quality: 76, effort: 4 })
    .toFile(thumbPath);

  const fullInfo = await image
    .clone()
    .resize({ width: 1800, withoutEnlargement: true })
    .webp({ quality: 84, effort: 4 })
    .toFile(fullPath);

  const entry = {
    category: file.category,
    sourceName: file.sourceName,
    displayOrder,
    dateTaken: displayDate(file.date),
    width: fullInfo.width,
    height: fullInfo.height,
    alt: photoAlt(file, index),
    locationLabel: file.locationLabel,
    thumbSrc: `/photos/${file.category}/${thumbFile}`,
    fullSrc: `/photos/${file.category}/${fullFile}`,
  };

  if (file.captionLabel) entry.captionLabel = file.captionLabel;

  return entry;
}

async function createImagePipeline(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === '.heic' || extension === '.heif') {
    const inputBuffer = await fs.readFile(filePath);
    const jpegBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.94,
    });

    return sharp(Buffer.from(jpegBuffer), {
      limitInputPixels: false,
    }).rotate();
  }

  return sharp(filePath, {
    limitInputPixels: false,
  }).rotate();
}

async function main() {
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  const manifest = [];

  for (const set of sourceSets) {
    const files = await listSourceFiles(set);
    const processed = [];
    for (let index = 0; index < files.length; index += 1) {
      processed.push(await processPhoto(files[index], index));
    }
    manifest.push(...processed);
    console.log(`${set.label}: ${processed.length} optimized images`);
  }

  const file = `export const photoManifest = ${JSON.stringify(manifest, null, 2)};\n\nexport default photoManifest;\n`;
  await fs.writeFile(manifestPath, file);
  console.log(`Photo manifest: ${manifest.length} images`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
