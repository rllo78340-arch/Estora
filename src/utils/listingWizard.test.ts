import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertFromUsd,
  convertToUsd,
  DEFAULT_WIZARD_DRAFT,
  movePhoto,
  removePhoto,
  setPrimaryPhoto,
  validateUploadFile,
  validateUzbekistanCoordinates,
  validateWizardStep,
} from './listingWizard';

test('convertToUsd and convertFromUsd accurately convert USD and UZS', () => {
  assert.equal(convertToUsd(100000, 'USD'), 100000);
  assert.equal(convertToUsd(1280000000, 'UZS'), 100000);
  assert.equal(convertFromUsd(1000, 'UZS'), 12800000);
});

test('validateUzbekistanCoordinates enforces Uzbekistan geographic bounds', () => {
  assert.equal(validateUzbekistanCoordinates(41.3111, 69.2797), true); // Tashkent
  assert.equal(validateUzbekistanCoordinates(39.6542, 66.9597), true); // Samarkand
  assert.equal(validateUzbekistanCoordinates(25.2048, 55.2708), false); // Dubai
  assert.equal(validateUzbekistanCoordinates(55.7558, 37.6173), false); // Moscow
});

test('validateUploadFile checks extensions, mime types, and max file sizes', () => {
  assert.equal(
    validateUploadFile({ name: 'interior.jpg', type: 'image/jpeg', size: 2_000_000 }, 'photo').valid,
    true
  );
  assert.equal(
    validateUploadFile({ name: 'too-big.png', type: 'image/png', size: 12_000_000 }, 'photo').valid,
    false
  );
  assert.equal(
    validateUploadFile({ name: 'script.exe', type: 'application/x-msdownload', size: 1024 }, 'photo').valid,
    false
  );
  assert.equal(
    validateUploadFile({ name: 'villa.glb', type: 'model/gltf-binary', size: 8_000_000 }, 'model3d').valid,
    true
  );
  assert.equal(
    validateUploadFile({ name: 'villa.obj', type: 'text/plain', size: 1_000_000 }, 'model3d').valid,
    false
  );
});

test('photo gallery helpers support reordering, primary selection, and safe deletion', () => {
  const initial = [
    { id: 'p1', url: '/a.jpg', name: 'A' },
    { id: 'p2', url: '/b.jpg', name: 'B' },
    { id: 'p3', url: '/c.jpg', name: 'C' },
  ];
  const moved = movePhoto(initial, 0, 1);
  assert.deepEqual(
    moved.map((p) => p.id),
    ['p2', 'p1', 'p3']
  );

  const primary = setPrimaryPhoto(moved, 'p3');
  assert.equal(primary.primaryPhotoId, 'p3');

  const removed = removePhoto(moved, 'p3', 'p3');
  assert.equal(removed.photos.length, 2);
  assert.equal(removed.primaryPhotoId, 'p2');
});

test('validateWizardStep blocks missing required fields across steps', () => {
  assert.ok(validateWizardStep(1, DEFAULT_WIZARD_DRAFT));
  const validDraft = {
    ...DEFAULT_WIZARD_DRAFT,
    title: 'Резиденция Бульвар Ташкент',
    areaSqm: '185',
    description: 'Просторная резиденция с дизайнерской отделкой и террасой в центре.',
    district: 'Шайхантахурский район',
    address: 'ул. Батыра Закирова, 14',
    priceAmount: '420000',
    contactName: 'Тимур Рахимов',
    contactPhone: '+998 90 123 45 67',
  };
  assert.equal(validateWizardStep(1, validDraft), null);
  assert.equal(validateWizardStep(2, validDraft), null);
  assert.equal(validateWizardStep(3, validDraft), null);
  assert.equal(validateWizardStep(5, validDraft), null);
  assert.equal(validateWizardStep(7, validDraft), null);
  assert.equal(validateWizardStep(8, validDraft), null);

  assert.ok(validateWizardStep(1, { ...validDraft, contactPhone: '' }));
  assert.ok(validateWizardStep(2, { ...validDraft, country: 'UAE' }));
  assert.ok(validateWizardStep(2, { ...validDraft, latitude: 25.2, longitude: 55.2 }));
});
