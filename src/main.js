import './styles.css';
import photoManifest from './data/photoManifest.js';

const weddingDate = new Date('2026-06-16T00:00:00-07:00');
const categories = {
  story: photoManifest.filter((photo) => photo.category === 'story'),
  engagement: photoManifest.filter((photo) => photo.category === 'engagement'),
  courthouse: photoManifest.filter((photo) => photo.category === 'courthouse'),
};

const sectionPhotos = new Map();
let activeDialogPhotos = [];
let activeDialogIndex = 0;
let activeDialogGalleryId = '';
const noteRecipient = 'avaandkevin8@gmail.com';
const noteEndpoint = `https://formsubmit.co/ajax/${noteRecipient}`;

const dialog = document.querySelector('#photo-dialog');
const dialogImage = dialog?.querySelector('[data-dialog-image]');
const dialogCaption = dialog?.querySelector('[data-dialog-caption]');
const sectionStage = document.querySelector('[data-section-stage]');
const contentSections = [...document.querySelectorAll('[data-content-section]')];
const sectionLinks = [...document.querySelectorAll('.site-nav a, .cloud-nav a')]
  .filter((link) => contentSections.some((section) => `#${section.id}` === link.getAttribute('href')));

function withBase(src) {
  return `${import.meta.env.BASE_URL}${src.replace(/^\//, '')}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function storedLocationLabel(photo) {
  return photo.locationLabel === 'Location not stored in metadata' ? '' : photo.locationLabel;
}

function galleryCaption(photo, options = {}) {
  if (photo.captionLabel) return photo.captionLabel;

  const date = formatDate(photo.dateTaken);
  const showLocation = options.showLocation !== false;
  const captionParts = [showLocation ? storedLocationLabel(photo) : '', options.showDate ? date : ''].filter(Boolean);
  return captionParts.join(' · ');
}

function dialogCaptionFor(photo) {
  if (photo.captionLabel) return [photo.alt, photo.captionLabel].filter(Boolean).join(' · ');

  const date = formatDate(photo.dateTaken);
  const captionParts = [photo.alt, storedLocationLabel(photo), date].filter(Boolean);
  return captionParts.join(' · ');
}

function renderGallery(containerId, photos, options = {}) {
  const container = document.querySelector(`#${containerId}`);
  if (!container) return;

  sectionPhotos.set(containerId, photos);
  container.innerHTML = '';

  photos.forEach((photo, index) => {
    const figure = document.createElement('figure');
    figure.className = 'photo-tile';
    figure.style.setProperty('--photo-ratio', `${photo.width} / ${photo.height}`);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-button';
    button.dataset.gallery = containerId;
    button.dataset.index = String(index);
    button.setAttribute('aria-label', `Open ${photo.alt}`);

    const image = document.createElement('img');
    image.src = withBase(photo.thumbSrc);
    image.alt = photo.alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.width = photo.width;
    image.height = photo.height;

    const caption = document.createElement('figcaption');
    caption.textContent = galleryCaption(photo, options);

    button.append(image);
    figure.append(button);
    if (caption.textContent) figure.append(caption);
    container.append(figure);
  });
}

function updateCountdown() {
  const el = document.querySelector('[data-countdown]');
  if (!el) return;

  const now = new Date();
  const diffDays = Math.ceil((weddingDate.valueOf() - now.valueOf()) / 86400000);

  if (diffDays > 1) {
    el.textContent = `${diffDays} days to Santa Barbara Courthouse`;
  } else if (diffDays === 1) {
    el.textContent = 'Tomorrow at Santa Barbara Courthouse';
  } else if (diffDays === 0) {
    el.textContent = 'Today at Santa Barbara Courthouse';
  } else {
    el.textContent = 'Santa Barbara Courthouse';
  }
}

function openDialog(galleryId, index) {
  const photos = sectionPhotos.get(galleryId);
  if (!dialog || !photos?.length) return;

  activeDialogPhotos = photos;
  activeDialogIndex = index;
  activeDialogGalleryId = galleryId;
  renderDialogPhoto();
  dialog.showModal();
}

function renderDialogPhoto() {
  const photo = activeDialogPhotos[activeDialogIndex];
  if (!photo || !dialogImage || !dialogCaption) return;

  dialogImage.src = withBase(photo.fullSrc);
  dialogImage.alt = photo.alt;

  const hideCaption = activeDialogGalleryId === 'engagement-gallery';
  dialog.classList.toggle('has-no-caption', hideCaption);
  dialogCaption.hidden = hideCaption;
  dialogCaption.textContent = hideCaption ? '' : dialogCaptionFor(photo);
}

function stepDialog(direction) {
  if (!activeDialogPhotos.length) return;
  activeDialogIndex = (activeDialogIndex + direction + activeDialogPhotos.length) % activeDialogPhotos.length;
  renderDialogPhoto();
}

function wireDialog() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.photo-button');
    if (button) {
      openDialog(button.dataset.gallery, Number(button.dataset.index));
      return;
    }

    if (event.target.closest('[data-dialog-close]')) {
      dialog?.close();
      return;
    }

    if (event.target.closest('[data-dialog-prev]')) {
      stepDialog(-1);
      return;
    }

    if (event.target.closest('[data-dialog-next]')) {
      stepDialog(1);
    }
  });

  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.addEventListener('keydown', (event) => {
    if (!dialog?.open) return;
    if (event.key === 'ArrowLeft') stepDialog(-1);
    if (event.key === 'ArrowRight') stepDialog(1);
  });
}

function wireHeaderState() {
  const header = document.querySelector('[data-site-header]');
  const hero = document.querySelector('.hero');
  if (!header || !hero) return;

  const update = () => {
    header.classList.toggle('is-visible', window.scrollY > hero.offsetHeight * 0.42);
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

function getRequestedSectionId() {
  const id = window.location.hash.replace('#', '');
  const requestedId = id === 'rsvp' ? 'note' : id;
  return contentSections.some((section) => section.id === requestedId) ? requestedId : 'story';
}

function setActiveSection(sectionId, options = {}) {
  contentSections.forEach((section) => {
    const active = section.id === sectionId;
    section.hidden = !active;
    section.classList.toggle('is-active', active);
  });

  sectionLinks.forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('href') === `#${sectionId}`);
  });

  if (options.scroll && sectionStage) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    sectionStage.scrollIntoView({
      block: 'start',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }
}

function wireSectionNavigation() {
  if (!contentSections.length) return;

  sectionLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const sectionId = link.getAttribute('href').replace('#', '');
      event.preventDefault();
      setActiveSection(sectionId, { scroll: true });
      history.pushState(null, '', `#${sectionId}`);
    });
  });

  window.addEventListener('hashchange', () => {
    setActiveSection(getRequestedSectionId(), { scroll: true });
  });

  setActiveSection(getRequestedSectionId(), { scroll: window.location.hash.length > 1 });
}

function wireNoteForm() {
  const form = document.querySelector('[data-note-form]');
  const message = form?.querySelector('#couple-note');
  const status = form?.querySelector('[data-note-status]');
  const button = form?.querySelector('button[type="submit"]');
  const honeypot = form?.querySelector('input[name="_honey"]');
  if (!form || !message || !button) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const note = message.value.trim();
    if (!note) {
      if (status) status.textContent = 'Write a note first, then tap Send note.';
      message.focus();
      return;
    }
    if (honeypot?.value) return;

    button.disabled = true;
    if (status) status.textContent = 'Sending your note...';

    try {
      const response = await fetch(noteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          _subject: 'Wedding website note for Ava and Kevin',
          _template: 'table',
          _captcha: 'false',
          message: note,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.message || 'Note submission failed.');

      form.reset();
      if (status) status.textContent = 'Note sent. Thank you.';
    } catch (error) {
      const subject = encodeURIComponent('Wedding website note for Ava and Kevin');
      const body = encodeURIComponent(`A note from the wedding website:\n\n${note}`);
      if (status) status.textContent = 'Opening an email draft so the note can still be sent.';
      window.location.href = `mailto:${noteRecipient}?subject=${subject}&body=${body}`;
    } finally {
      button.disabled = false;
    }
  });
}

renderGallery('story-gallery', categories.story, { showDate: true });
renderGallery('engagement-gallery', categories.engagement, { showDate: false, showLocation: false });
renderGallery('courthouse-gallery', categories.courthouse, { showDate: false, showLocation: false });
updateCountdown();
wireDialog();
wireHeaderState();
wireSectionNavigation();
wireNoteForm();
