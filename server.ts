import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  createMediaAssetRecord,
  createPropertyRecord,
  deleteMediaAssetRecord,
  deleteProperty3dTour,
  deletePropertyRecord,
  getCityStats,
  getDefaultCuratorId,
  getMediaAssetById,
  getPropertiesByIds,
  getProperty3dTour,
  getPropertyById,
  listMapProperties,
  listProperties,
  listUserFavorites,
  toggleFavorite,
  updatePropertyRecord,
  upsertProperty3dTour,
} from './src/db/properties.ts';
import {
  createPropertyReportRecord,
  ensureDefaultCategories,
  getAdminDashboardOverview,
  listCategories,
  moderateAdminPropertyRecord,
  moderatePropertyReportRecord,
  updateAdminCategory,
  updateAdminUserRecord,
} from './src/db/admin.ts';
import {
  applyPaidOrderBenefits,
  createPaymentOrderRecord,
  getPaymentOrderByCode,
  listUserPaymentHistory,
} from './src/db/payments.ts';
import { updateUserProfile } from './src/db/users.ts';
import {
  createUserDesign,
  deleteUserDesign,
  getUserDesignById,
  listUserDesigns,
  updateUserDesign,
} from './src/db/designs.ts';
import {
  clearUserSearchHistory,
  clearUserViewHistory,
  createAndEmitNotification,
  createMessageEnriched,
  createSellerReview,
  createUserSavedFilter,
  deleteUserSavedFilter,
  deleteUserSearchHistoryItem,
  dispatchSavedFilterMatchNotifications,
  getUserCabinetOverview,
  listSellerReviews,
  listUserMessagesEnriched,
  listUserNotifications,
  listUserSavedFilters,
  listUserSearchHistory,
  listUserViewHistory,
  markAllNotificationsAsRead,
  markMessagesThreadAsRead,
  markNotificationAsRead,
  moderateReviewStatus,
  recordPropertyView,
  recordUserSearchHistory,
  replyToSellerReview,
  reportSellerReview,
  seedInitialReviewsIfEmpty,
  toggleSavedFilterNotify,
} from './src/db/social.ts';
import { realtimeHub } from './src/realtime/wsHub.ts';
import { analyzeBuildingImageWithGemini, runEstoraAiAgent } from './src/lib/gemini.ts';
import { sanitizePersonalizationContext } from './src/utils/aiAgent.ts';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  type AuthRequest,
} from './src/middleware/auth.ts';
import {
  validateUploadFile,
  validateUzbekistanCoordinates,
} from './src/utils/listingWizard.ts';
import { moderateListingSubmission } from './src/utils/moderation.ts';
import {
  ALLOWED_PAYMENT_PROVIDERS,
  ESTORA_PAID_SERVICES,
  buildCheckoutGatewayResponse,
  computeClickSignString,
  getPaidServiceDefinition,
  validateNoSensitiveCardData,
  verifyPaymeBasicAuth,
  type PaidServiceType,
  type PaymentProvider,
} from './src/utils/payments.ts';
import { validateMessagePayload, validateReviewPayload } from './src/utils/social.ts';
import { isValidGlbMagic, isValidGltfJson } from './src/utils/tour3d.ts';
import { validateUzbekistanLocation } from './src/utils/uzbekistan.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_PROPERTY_TYPES = new Set([
  'apartment',
  'house',
  'villa',
  'penthouse',
  'new_build',
  'commercial',
  'office',
  'shop',
  'land',
]);

const ALLOWED_STATUSES = new Set(['draft', 'pending', 'active', 'rejected', 'archived']);
const ALLOWED_HEATING = new Set(['central', 'individual', 'underfloor', 'none']);
const ALLOWED_CONTACT_METHODS = new Set(['phone', 'telegram', 'whatsapp', 'messages']);

const uploadsDir = path.resolve(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      const safeBase = path
        .basename(file.originalname, ext)
        .replace(/[^a-z0-9_-]/gi, '-')
        .slice(0, 40);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase || 'asset'}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(uploadsDir));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      platform: 'ESTORA',
      market: 'Uzbekistan',
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ),
      mapsConfigured: Boolean(
        process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY
      ),
    });
  });

  app.get('/api/config/maps', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({ apiKey });
  });

  app.get('/api/categories', async (_req, res) => {
    try {
      const list = await listCategories(false);
      res.json({ categories: list });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ошибка загрузки категорий',
      });
    }
  });

  app.get('/api/map/properties', async (req, res) => {
    try {
      const q = req.query;
      const toNum = (val: unknown) =>
        typeof val === 'string' && val.trim() !== '' ? Number(val) : undefined;
      const items = await listMapProperties({
        dealType: typeof q.dealType === 'string' ? q.dealType : undefined,
        propertyType: typeof q.propertyType === 'string' ? q.propertyType : undefined,
        city: typeof q.city === 'string' ? q.city : undefined,
        district: typeof q.district === 'string' ? q.district : undefined,
        has3dTour: q.has3dTour === 'true',
        minPrice: toNum(q.minPrice),
        maxPrice: toNum(q.maxPrice),
        q: typeof q.q === 'string' ? q.q : undefined,
        north: toNum(q.north),
        south: toNum(q.south),
        east: toNum(q.east),
        west: toNum(q.west),
      });
      res.json({ properties: items });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ошибка загрузки объектов на карте',
      });
    }
  });

  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    res.json({ user: req.dbUser });
  });

  app.patch('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { fullName, phone, preferredCity, preferredCurrency, notificationsEnabled } =
        req.body ?? {};
      const updated = await updateUserProfile(req.user.uid, {
        ...(typeof fullName === 'string' ? { fullName: fullName.trim() } : {}),
        ...(typeof phone === 'string' ? { phone: phone.trim() } : {}),
        ...(typeof preferredCity === 'string' ? { preferredCity } : {}),
        ...(typeof preferredCurrency === 'string' ? { preferredCurrency } : {}),
        ...(typeof notificationsEnabled === 'boolean' ? { notificationsEnabled } : {}),
      });
      res.json({ user: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка обновления профиля';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/properties', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const q = req.query;
      const toNum = (val: unknown) =>
        typeof val === 'string' && val.trim() !== '' ? Number(val) : undefined;

      if (q.mine === 'true' && !req.dbUser) {
        return res.status(401).json({ error: 'Авторизуйтесь для просмотра ваших объявлений' });
      }

      const isMine = q.mine === 'true' && Boolean(req.dbUser);
      const result = await listProperties({
        dealType: typeof q.dealType === 'string' ? q.dealType : undefined,
        propertyType: typeof q.propertyType === 'string' ? q.propertyType : undefined,
        city: typeof q.city === 'string' ? q.city : undefined,
        district: typeof q.district === 'string' ? q.district : undefined,
        rooms: typeof q.rooms === 'string' ? q.rooms : undefined,
        has3dTour: q.has3dTour === 'true',
        featured: q.featured === 'true',
        minPrice: toNum(q.minPrice),
        maxPrice: toNum(q.maxPrice),
        minArea: toNum(q.minArea),
        maxArea: toNum(q.maxArea),
        minFloor: toNum(q.minFloor),
        maxFloor: toNum(q.maxFloor),
        renovation: typeof q.renovation === 'string' ? q.renovation : undefined,
        furnished: typeof q.furnished === 'string' ? q.furnished : undefined,
        parking: typeof q.parking === 'string' ? q.parking : undefined,
        publishedWithin: typeof q.publishedWithin === 'string' ? q.publishedWithin : undefined,
        q: typeof q.q === 'string' ? q.q : undefined,
        sort: typeof q.sort === 'string' ? q.sort : undefined,
        ownerId: isMine && req.dbUser ? req.dbUser.id : undefined,
        includeAllStatuses: isMine,
        page: toNum(q.page),
        pageSize: isMine ? Math.max(20, toNum(q.pageSize) ?? 20) : toNum(q.pageSize),
        limit: toNum(q.limit),
      });

      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки каталога';
      res.status(500).json({ error: message });
    }
  });

  app.post(
    '/api/uploads',
    requireAuth,
    uploadMiddleware.single('file'),
    async (req: AuthRequest, res) => {
      try {
        if (!req.dbUser) {
          return res.status(401).json({ error: 'Требуется авторизация' });
        }
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: 'Файл не передан.' });
        }
        const rawKind = req.body?.kind;
        const kind: 'photo' | 'model3d' | 'panorama' =
          rawKind === 'model3d' || rawKind === 'panorama' ? rawKind : 'photo';

        const check = validateUploadFile(
          {
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
          },
          kind
        );

        if (!check.valid) {
          fs.unlink(file.path, () => {});
          return res.status(400).json({ error: check.error });
        }

        // Дополнительная проверка содержимого для 3D-моделей (.glb / .gltf)
        if (kind === 'model3d') {
          const lower = file.originalname.toLowerCase();
          if (lower.endsWith('.glb')) {
            const fd = fs.openSync(file.path, 'r');
            const header = new Uint8Array(12);
            const bytesRead = fs.readSync(fd, header, 0, 12, 0);
            fs.closeSync(fd);
            if (bytesRead < 12 || !isValidGlbMagic(header)) {
              fs.unlink(file.path, () => {});
              return res.status(400).json({
                error: 'Файл не является корректной бинарной 3D-моделью GLB.',
              });
            }
          } else if (lower.endsWith('.gltf')) {
            const rawText = fs.readFileSync(file.path, 'utf8');
            if (!isValidGltfJson(rawText)) {
              fs.unlink(file.path, () => {});
              return res.status(400).json({
                error: 'Файл GLTF повреждён или не содержит структуру glTF 2.0.',
              });
            }
          }
        }

        const publicUrl = `/uploads/${file.filename}`;
        const saved = await createMediaAssetRecord({
          ownerId: req.dbUser.id,
          kind,
          fileName: file.originalname,
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes: file.size,
          url: publicUrl,
        });

        res.status(201).json({
          asset: {
            ...saved,
            processingStatus: 'ready',
          },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Ошибка загрузки файла';
        res.status(500).json({ error: message });
      }
    }
  );

  app.delete('/api/uploads/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Некорректный ID файла' });
      }
      const existing = await getMediaAssetById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Файл не найден' });
      }
      if (req.dbUser.role !== 'admin' && existing.ownerId !== req.dbUser.id) {
        return res.status(403).json({ error: 'Вы можете удалять только собственные 3D-файлы и фото.' });
      }
      const deleted = await deleteMediaAssetRecord(id, req.dbUser.id, req.dbUser.role === 'admin');
      if (deleted && deleted.url.startsWith('/uploads/')) {
        const localName = path.basename(deleted.url);
        const targetPath = path.join(uploadsDir, localName);
        if (targetPath.startsWith(uploadsDir)) {
          fs.unlink(targetPath, () => {});
        }
      }
      res.json({ deletedId: id });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка удаления файла';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/properties/:id/tour', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Некорректный ID объекта' });
      }
      const tour = await getProperty3dTour(id);
      res.json(tour);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки 3D-тура';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/properties/:id/tour', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Некорректный ID объекта' });
      }
      const body = req.body ?? {};
      const result = await upsertProperty3dTour({
        propertyId: id,
        actorUserId: req.dbUser.id,
        isAdmin: req.dbUser.role === 'admin',
        model3dUrl: typeof body.model3dUrl === 'string' ? body.model3dUrl : undefined,
        panoramaUrl: typeof body.panoramaUrl === 'string' ? body.panoramaUrl : undefined,
        virtualTourUrl: typeof body.virtualTourUrl === 'string' ? body.virtualTourUrl : undefined,
        tour3dLabel: typeof body.tour3dLabel === 'string' ? body.tour3dLabel : undefined,
        rooms: Array.isArray(body.tourRooms) ? body.tourRooms : [],
        hotspots: Array.isArray(body.tourHotspots) ? body.tourHotspots : [],
        autoRotate: Boolean(body.autoRotate),
        defaultFov: Number(body.defaultFov) || 75,
        exposure: Number(body.exposure) || 1.05,
      });

      if (result.status === 'not_found') {
        return res.status(404).json({ error: 'Объект не найден' });
      }
      if (result.status === 'forbidden') {
        return res.status(403).json({ error: 'Изменять 3D-тур может только владелец объявления.' });
      }

      res.json({ property: result.property });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка сохранения 3D-тура';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/properties/:id/tour', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Некорректный ID объекта' });
      }
      const result = await deleteProperty3dTour(
        id,
        req.dbUser.id,
        req.dbUser.role === 'admin'
      );
      if (result.status === 'not_found') {
        return res.status(404).json({ error: 'Объект не найден' });
      }
      if (result.status === 'forbidden') {
        return res.status(403).json({ error: 'Удалять 3D-контент может только владелец объявления.' });
      }
      res.json({ cleared: true, propertyId: id });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка удаления 3D-контента';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/properties/batch', async (req, res) => {
    try {
      const rawIds = typeof req.query.ids === 'string' ? req.query.ids : '';
      const ids = rawIds
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
        .slice(0, 12);
      if (ids.length === 0) {
        return res.json({ properties: [] });
      }
      const rows = await getPropertiesByIds(ids);
      res.json({ properties: rows });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Ошибка загрузки выбранных объектов.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/properties/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Некорректный идентификатор объекта' });
      }
      const item = await getPropertyById(id);
      if (!item) {
        return res.status(404).json({ error: 'Объект не найден' });
      }
      res.json({ property: item });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки объекта';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/properties', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }
      const body = req.body ?? {};
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const country = typeof body.country === 'string' ? body.country.trim() : 'Uzbekistan';
      const city = typeof body.city === 'string' ? body.city.trim() : '';
      const district = typeof body.district === 'string' ? body.district.trim() : '';
      const address = typeof body.address === 'string' ? body.address.trim() : '';
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      const dealType = body.dealType === 'rent' ? 'rent' : 'sale';
      const propertyType =
        typeof body.propertyType === 'string' && ALLOWED_PROPERTY_TYPES.has(body.propertyType)
          ? body.propertyType
          : 'apartment';
      const renovation =
        typeof body.renovation === 'string' &&
        ['designer', 'euro', 'cosmetic', 'shell'].includes(body.renovation)
          ? body.renovation
          : 'designer';

      const locationCheck = validateUzbekistanLocation({
        country,
        city,
        district,
        address,
      });
      if (!locationCheck.valid) {
        return res.status(400).json({ error: locationCheck.error });
      }

      const latitude = Number(body.latitude ?? 41.3111);
      const longitude = Number(body.longitude ?? 69.2797);
      if (!validateUzbekistanCoordinates(latitude, longitude)) {
        return res.status(400).json({
          error: 'Координаты на карте должны находиться в пределах Республики Узбекистан.',
        });
      }

      const priceUsd = Number(body.priceUsd);
      const areaSqm = Number(body.areaSqm);

      if (!title || !description || !priceUsd || priceUsd <= 0 || !areaSqm || areaSqm <= 0) {
        return res.status(400).json({
          error: 'Заполните название, описание, корректную цену и площадь объекта.',
        });
      }

      const galleryImages = Array.isArray(body.galleryImages)
        ? body.galleryImages.filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
        : [];
      const imageUrl =
        typeof body.imageUrl === 'string' && body.imageUrl.trim().length > 0
          ? body.imageUrl.trim()
          : galleryImages[0] ?? '/src/assets/images/prop_tashkent_apartment_1794853628562.jpg';

      const finalGallery = galleryImages.length > 0 ? galleryImages : [imageUrl];

      const amenities = Array.isArray(body.amenities)
        ? body.amenities.filter((item: unknown): item is string => typeof item === 'string')
        : [];

      const status = body.status === 'draft' ? 'draft' : 'pending';
      const heating =
        typeof body.heating === 'string' && ALLOWED_HEATING.has(body.heating)
          ? body.heating
          : 'individual';
      const contactMethod =
        typeof body.contactMethod === 'string' && ALLOWED_CONTACT_METHODS.has(body.contactMethod)
          ? body.contactMethod
          : 'phone';
      const contactPhone =
        typeof body.contactPhone === 'string' && body.contactPhone.trim().length > 0
          ? body.contactPhone.trim()
          : req.dbUser.phone;

      const modResult = moderateListingSubmission({
        country: locationCheck.normalizedCountry,
        city: locationCheck.normalizedCity,
        district,
        address,
        latitude,
        longitude,
        title,
        description,
        dealType,
        propertyType,
        priceUsd,
        areaSqm,
        contactPhone,
      });

      const tourRooms = Array.isArray(body.tourRooms) ? body.tourRooms : [];
      const tourHotspots = Array.isArray(body.tourHotspots) ? body.tourHotspots : [];
      const model3dUrl = typeof body.model3dUrl === 'string' ? body.model3dUrl.trim() : '';
      const panoramaUrl =
        typeof body.panoramaUrl === 'string' && body.panoramaUrl.trim()
          ? body.panoramaUrl.trim()
          : tourRooms[0]?.filePath || '';
      const virtualTourUrl =
        typeof body.virtualTourUrl === 'string' ? body.virtualTourUrl.trim() : '';
      const computedHas3d = Boolean(
        model3dUrl || panoramaUrl || virtualTourUrl || tourRooms.length > 0
      );

      const created = await createPropertyRecord({
        ownerId: req.dbUser.id,
        title,
        country: locationCheck.normalizedCountry,
        dealType,
        propertyType,
        city: locationCheck.normalizedCity,
        district,
        address,
        latitude,
        longitude,
        priceUsd,
        priceCurrency: body.priceCurrency === 'UZS' ? 'UZS' : 'USD',
        originalPrice: Number(body.originalPrice) || priceUsd,
        monthlyRentUsd: Number(body.monthlyRentUsd) || (dealType === 'rent' ? priceUsd : 0),
        areaSqm,
        bedrooms: Number(body.bedrooms) || 0,
        bathrooms: Number(body.bathrooms) || 1,
        floor: Number(body.floor) || 1,
        totalFloors: Number(body.totalFloors) || 1,
        renovation,
        furnished: Boolean(body.furnished),
        heating,
        airConditioning: body.airConditioning !== false,
        parking: Boolean(body.parking),
        balcony: body.balcony !== false,
        has3dTour: computedHas3d,
        tour3dLabel: typeof body.tour3dLabel === 'string' ? body.tour3dLabel.trim() : '',
        model3dUrl,
        panoramaUrl,
        virtualTourUrl,
        imageUrl,
        galleryImages: finalGallery,
        description,
        amenities,
        contactName:
          typeof body.contactName === 'string' && body.contactName.trim().length > 0
            ? body.contactName.trim()
            : req.dbUser.fullName,
        contactPhone,
        contactMethod,
        status,
        isVerified: false,
        moderationStatus: modResult.recommendedModerationStatus,
        moderationNotes: JSON.stringify(modResult.flags),
        moderationScore: modResult.score,
        rejectionReason: '',
      });

      if (computedHas3d && created?.id) {
        const tourRes = await upsertProperty3dTour({
          propertyId: created.id,
          actorUserId: req.dbUser.id,
          isAdmin: req.dbUser.role === 'admin',
          model3dUrl,
          panoramaUrl,
          virtualTourUrl,
          tour3dLabel: typeof body.tour3dLabel === 'string' ? body.tour3dLabel.trim() : '',
          rooms: tourRooms,
          hotspots: tourHotspots,
          autoRotate: Boolean(body.tourAutoRotate),
          defaultFov: Number(body.tourDefaultFov) || 75,
          exposure: Number(body.tourExposure) || 1.05,
        });
        if (tourRes.status === 'ok' && tourRes.property) {
          return res.status(201).json({ property: tourRes.property });
        }
      }

      const hydratedCreated = created?.id ? (await getPropertyById(created.id)) ?? created : created;
      res.status(201).json({ property: hydratedCreated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка создания объявления';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/properties/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Некорректный ID объекта' });
      }
      const existing = await getPropertyById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Объект не найден' });
      }

      const body = req.body ?? {};
      const nextCountry =
        typeof body.country === 'string' ? body.country : existing.country ?? 'Uzbekistan';
      const nextCity = typeof body.city === 'string' ? body.city : existing.city;
      const nextDistrict = typeof body.district === 'string' ? body.district : existing.district;
      const nextAddress = typeof body.address === 'string' ? body.address : existing.address;

      const locationCheck = validateUzbekistanLocation({
        country: nextCountry,
        city: nextCity,
        district: nextDistrict,
        address: nextAddress,
      });
      if (!locationCheck.valid) {
        return res.status(400).json({ error: locationCheck.error });
      }

      const nextLat = typeof body.latitude === 'number' ? body.latitude : existing.latitude;
      const nextLng = typeof body.longitude === 'number' ? body.longitude : existing.longitude;
      if (!validateUzbekistanCoordinates(nextLat, nextLng)) {
        return res.status(400).json({
          error: 'Координаты должны находиться в пределах Республики Узбекистан.',
        });
      }

      const isAdminUser = req.dbUser.role === 'admin';
      const nextStatus =
        typeof body.status === 'string' && ALLOWED_STATUSES.has(body.status)
          ? !isAdminUser && body.status === 'active'
            ? 'pending'
            : body.status
          : undefined;

      const nextTitle =
        typeof body.title === 'string' && body.title.trim() ? body.title.trim() : existing.title;
      const nextDescription =
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : existing.description;
      const nextDealType =
        typeof body.dealType === 'string' && ['sale', 'rent'].includes(body.dealType)
          ? body.dealType
          : existing.dealType;
      const nextPropertyType =
        typeof body.propertyType === 'string' && ALLOWED_PROPERTY_TYPES.has(body.propertyType)
          ? body.propertyType
          : existing.propertyType;
      const nextPriceUsd =
        typeof body.priceUsd === 'number' && body.priceUsd > 0 ? body.priceUsd : existing.priceUsd;
      const nextAreaSqm =
        typeof body.areaSqm === 'number' && body.areaSqm > 0 ? body.areaSqm : existing.areaSqm;
      const nextContactPhone =
        typeof body.contactPhone === 'string'
          ? body.contactPhone.trim()
          : existing.contactPhone ?? '';

      const modResult = moderateListingSubmission({
        country: locationCheck.normalizedCountry,
        city: locationCheck.normalizedCity,
        district: nextDistrict.trim(),
        address: nextAddress.trim(),
        latitude: nextLat,
        longitude: nextLng,
        title: nextTitle,
        description: nextDescription,
        dealType: nextDealType,
        propertyType: nextPropertyType,
        priceUsd: nextPriceUsd,
        areaSqm: nextAreaSqm,
        contactPhone: nextContactPhone,
      });

      const updated = await updatePropertyRecord(
        id,
        req.dbUser.id,
        isAdminUser,
        {
          ...(typeof body.title === 'string' && body.title.trim() ? { title: body.title.trim() } : {}),
          country: locationCheck.normalizedCountry,
          city: locationCheck.normalizedCity,
          district: nextDistrict.trim(),
          address: nextAddress.trim(),
          latitude: nextLat,
          longitude: nextLng,
          ...(typeof body.dealType === 'string' && ['sale', 'rent'].includes(body.dealType)
            ? { dealType: body.dealType }
            : {}),
          ...(typeof body.propertyType === 'string' && ALLOWED_PROPERTY_TYPES.has(body.propertyType)
            ? { propertyType: body.propertyType }
            : {}),
          ...(typeof body.priceUsd === 'number' && body.priceUsd > 0
            ? { priceUsd: body.priceUsd }
            : {}),
          ...(body.priceCurrency === 'USD' || body.priceCurrency === 'UZS'
            ? { priceCurrency: body.priceCurrency }
            : {}),
          ...(typeof body.originalPrice === 'number' ? { originalPrice: body.originalPrice } : {}),
          ...(typeof body.monthlyRentUsd === 'number' ? { monthlyRentUsd: body.monthlyRentUsd } : {}),
          ...(typeof body.areaSqm === 'number' && body.areaSqm > 0
            ? { areaSqm: body.areaSqm }
            : {}),
          ...(typeof body.bedrooms === 'number' ? { bedrooms: body.bedrooms } : {}),
          ...(typeof body.bathrooms === 'number' ? { bathrooms: body.bathrooms } : {}),
          ...(typeof body.floor === 'number' ? { floor: body.floor } : {}),
          ...(typeof body.totalFloors === 'number' ? { totalFloors: body.totalFloors } : {}),
          ...(typeof body.renovation === 'string' ? { renovation: body.renovation } : {}),
          ...(typeof body.furnished === 'boolean' ? { furnished: body.furnished } : {}),
          ...(typeof body.heating === 'string' && ALLOWED_HEATING.has(body.heating)
            ? { heating: body.heating }
            : {}),
          ...(typeof body.airConditioning === 'boolean'
            ? { airConditioning: body.airConditioning }
            : {}),
          ...(typeof body.parking === 'boolean' ? { parking: body.parking } : {}),
          ...(typeof body.balcony === 'boolean' ? { balcony: body.balcony } : {}),
          ...(typeof body.has3dTour === 'boolean' ? { has3dTour: body.has3dTour } : {}),
          ...(typeof body.tour3dLabel === 'string' ? { tour3dLabel: body.tour3dLabel.trim() } : {}),
          ...(typeof body.model3dUrl === 'string' ? { model3dUrl: body.model3dUrl.trim() } : {}),
          ...(typeof body.panoramaUrl === 'string' ? { panoramaUrl: body.panoramaUrl.trim() } : {}),
          ...(typeof body.virtualTourUrl === 'string'
            ? { virtualTourUrl: body.virtualTourUrl.trim() }
            : {}),
          ...(typeof body.imageUrl === 'string' && body.imageUrl.trim()
            ? { imageUrl: body.imageUrl.trim() }
            : {}),
          ...(Array.isArray(body.galleryImages)
            ? {
                galleryImages: JSON.stringify(
                  body.galleryImages.filter((u: unknown): u is string => typeof u === 'string')
                ),
              }
            : {}),
          ...(Array.isArray(body.amenities)
            ? {
                amenities: JSON.stringify(
                  body.amenities.filter((a: unknown): a is string => typeof a === 'string')
                ),
              }
            : {}),
          ...(typeof body.description === 'string' && body.description.trim()
            ? { description: body.description.trim() }
            : {}),
          ...(typeof body.contactName === 'string' ? { contactName: body.contactName.trim() } : {}),
          ...(typeof body.contactPhone === 'string' ? { contactPhone: body.contactPhone.trim() } : {}),
          ...(typeof body.contactMethod === 'string' && ALLOWED_CONTACT_METHODS.has(body.contactMethod)
            ? { contactMethod: body.contactMethod }
            : {}),
          ...(nextStatus ? { status: nextStatus } : {}),
          moderationScore: modResult.score,
          moderationNotes: JSON.stringify(modResult.flags),
          ...(!isAdminUser
            ? {
                isVerified: false,
                moderationStatus: modResult.recommendedModerationStatus,
                rejectionReason: '',
              }
            : {}),
        }
      );

      if (!updated) {
        return res.status(403).json({ error: 'Нет прав для редактирования этого объекта.' });
      }

      if (
        Array.isArray(body.tourRooms) ||
        Array.isArray(body.tourHotspots) ||
        typeof body.model3dUrl === 'string' ||
        typeof body.panoramaUrl === 'string' ||
        typeof body.virtualTourUrl === 'string'
      ) {
        const rooms = Array.isArray(body.tourRooms)
          ? body.tourRooms
          : existing.tourRooms ?? [];
        const hotspots = Array.isArray(body.tourHotspots)
          ? body.tourHotspots
          : existing.tourHotspots ?? [];
        const tourRes = await upsertProperty3dTour({
          propertyId: id,
          actorUserId: req.dbUser.id,
          isAdmin: req.dbUser.role === 'admin',
          model3dUrl:
            typeof body.model3dUrl === 'string' ? body.model3dUrl : existing.model3dUrl,
          panoramaUrl:
            typeof body.panoramaUrl === 'string' ? body.panoramaUrl : existing.panoramaUrl,
          virtualTourUrl:
            typeof body.virtualTourUrl === 'string'
              ? body.virtualTourUrl
              : existing.virtualTourUrl,
          tour3dLabel:
            typeof body.tour3dLabel === 'string' ? body.tour3dLabel : existing.tour3dLabel,
          rooms,
          hotspots,
          autoRotate:
            typeof body.tourAutoRotate === 'boolean'
              ? body.tourAutoRotate
              : existing.tourConfig?.autoRotate,
          defaultFov:
            typeof body.tourDefaultFov === 'number'
              ? body.tourDefaultFov
              : existing.tourConfig?.defaultFov,
          exposure:
            typeof body.tourExposure === 'number'
              ? body.tourExposure
              : existing.tourConfig?.exposure,
        });
        if (tourRes.status === 'ok' && tourRes.property) {
          return res.json({ property: tourRes.property });
        }
      }

      const fresh = await getPropertyById(id);
      const effectiveProp = fresh ?? updated;
      if (nextStatus && nextStatus !== existing.status && effectiveProp) {
        await createAndEmitNotification({
          userId: existing.ownerId,
          type: 'status_changed',
          title: `Статус объявления обновлён: ${effectiveProp.title}`,
          body: `Новый статус публикации: ${nextStatus}.`,
          linkPath: '/profile',
          relatedPropertyId: id,
        });
        if (nextStatus === 'active') {
          void dispatchSavedFilterMatchNotifications({
            id: effectiveProp.id,
            ownerId: effectiveProp.ownerId,
            status: effectiveProp.status,
            country: effectiveProp.country,
            dealType: effectiveProp.dealType,
            propertyType: effectiveProp.propertyType,
            city: effectiveProp.city,
            district: effectiveProp.district,
            priceUsd: effectiveProp.priceUsd,
            areaSqm: effectiveProp.areaSqm,
            bedrooms: effectiveProp.bedrooms,
            has3dTour: effectiveProp.has3dTour,
            renovation: effectiveProp.renovation,
            furnished: effectiveProp.furnished,
            parking: effectiveProp.parking,
            title: effectiveProp.title,
            description: effectiveProp.description,
          });
        }
      }
      res.json({ property: effectiveProp });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка редактирования объекта';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/properties/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Требуется авторизация' });
      }
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Некорректный ID объекта' });
      }
      const deleted = await deletePropertyRecord(
        id,
        req.dbUser.id,
        req.dbUser.role === 'admin'
      );
      if (!deleted) {
        return res.status(404).json({ error: 'Объект не найден или нет прав на удаление.' });
      }
      res.json({ deletedId: deleted.id });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка удаления объекта';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/cities', async (_req, res) => {
    try {
      const stats = await getCityStats();
      res.json({ cities: stats });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки городов';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/favorites', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const items = await listUserFavorites(req.dbUser.id);
      res.json({ favorites: items });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки избранного';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/favorites/:propertyId', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const propertyId = Number(req.params.propertyId);
      if (Number.isNaN(propertyId)) {
        return res.status(400).json({ error: 'Некорректный ID объекта' });
      }
      await toggleFavorite(req.dbUser.id, propertyId, true);
      res.json({ saved: true, propertyId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка сохранения в избранное';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/favorites/:propertyId', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const propertyId = Number(req.params.propertyId);
      if (Number.isNaN(propertyId)) {
        return res.status(400).json({ error: 'Некорректный ID объекта' });
      }
      await toggleFavorite(req.dbUser.id, propertyId, false);
      res.json({ saved: false, propertyId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка удаления из избранного';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/properties/:id/view', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Некорректный ID объекта' });
      }
      await recordPropertyView(id, req.dbUser?.id ?? null);
      res.json({ recorded: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка записи просмотра';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/cabinet/overview', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const overview = await getUserCabinetOverview(req.dbUser.id);
      res.json(overview);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки личного кабинета';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/saved-filters', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const savedFilters = await listUserSavedFilters(req.dbUser.id);
      res.json({ savedFilters });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка загрузки фильтров' });
    }
  });

  app.post('/api/saved-filters', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const filtersObj = req.body?.filters ?? {};
      const filtersJson =
        typeof filtersObj === 'string' ? filtersObj : JSON.stringify(filtersObj);
      if (!name) {
        return res.status(400).json({ error: 'Укажите название сохранённого фильтра.' });
      }
      const savedFilter = await createUserSavedFilter({
        userId: req.dbUser.id,
        name,
        filtersJson,
        notifyOnMatch: req.body?.notifyOnMatch !== false,
      });
      res.status(201).json({ savedFilter });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка сохранения фильтра' });
    }
  });

  app.patch('/api/saved-filters/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Некорректный ID фильтра' });
      const updated = await toggleSavedFilterNotify(
        req.dbUser.id,
        id,
        Boolean(req.body?.notifyOnMatch)
      );
      if (!updated) return res.status(404).json({ error: 'Фильтр не найден' });
      res.json({ savedFilter: updated });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка обновления фильтра' });
    }
  });

  app.delete('/api/saved-filters/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Некорректный ID фильтра' });
      await deleteUserSavedFilter(req.dbUser.id, id);
      res.json({ deletedId: id });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка удаления фильтра' });
    }
  });

  app.get('/api/search-history', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const history = await listUserSearchHistory(req.dbUser.id);
      res.json({ history });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка загрузки истории поиска' });
    }
  });

  app.post('/api/search-history', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const queryText = typeof req.body?.queryText === 'string' ? req.body.queryText : '';
      const filtersObj = req.body?.filters ?? {};
      const filtersJson =
        typeof filtersObj === 'string' ? filtersObj : JSON.stringify(filtersObj);
      const resultsCount = Number(req.body?.resultsCount) || 0;
      const item = await recordUserSearchHistory({
        userId: req.dbUser.id,
        queryText,
        filtersJson,
        resultsCount,
      });
      res.status(201).json({ item });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка записи поиска' });
    }
  });

  app.delete('/api/search-history/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Некорректный ID' });
      await deleteUserSearchHistoryItem(req.dbUser.id, id);
      res.json({ deletedId: id });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка удаления записи' });
    }
  });

  app.delete('/api/search-history', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      await clearUserSearchHistory(req.dbUser.id);
      res.json({ cleared: true });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка очистки истории' });
    }
  });

  app.get('/api/view-history', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const history = await listUserViewHistory(req.dbUser.id);
      res.json({ history });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка загрузки истории просмотров' });
    }
  });

  app.delete('/api/view-history', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      await clearUserViewHistory(req.dbUser.id);
      res.json({ cleared: true });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка очистки просмотров' });
    }
  });

  app.get('/api/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const list = await listUserMessagesEnriched(req.dbUser.id);
      res.json({ messages: list });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки сообщений';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { propertyId, recipientId, subject, body, imageUrl } = req.body ?? {};
      const check = validateMessagePayload({ subject, body, imageUrl });
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }

      let targetRecipient = typeof recipientId === 'number' ? recipientId : null;
      if (!targetRecipient) {
        targetRecipient = await getDefaultCuratorId();
      }
      if (!targetRecipient) {
        targetRecipient = req.dbUser.id;
      }

      const created = await createMessageEnriched({
        senderId: req.dbUser.id,
        recipientId: targetRecipient,
        propertyId: typeof propertyId === 'number' ? propertyId : null,
        subject: check.cleanSubject,
        body: check.cleanBody,
        imageUrl: check.cleanImageUrl,
      });

      res.status(201).json({ message: created });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка отправки сообщения';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/messages/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const otherUserId = Number(req.body?.otherUserId);
      if (Number.isNaN(otherUserId) || otherUserId <= 0) {
        return res.status(400).json({ error: 'Некорректный собеседник' });
      }
      const propertyId =
        req.body?.propertyId === null || req.body?.propertyId === undefined
          ? null
          : Number(req.body.propertyId);
      const result = await markMessagesThreadAsRead({
        readerId: req.dbUser.id,
        otherUserId,
        propertyId: Number.isNaN(propertyId as number) ? null : propertyId,
      });
      res.json(result);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка отметки прочтения' });
    }
  });

  app.get('/api/sellers/:sellerId/reviews', async (req, res) => {
    try {
      const sellerId = Number(req.params.sellerId);
      if (Number.isNaN(sellerId) || sellerId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID продавца' });
      }
      const data = await listSellerReviews(sellerId);
      res.json(data);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка загрузки отзывов' });
    }
  });

  app.post('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const sellerId = Number(req.body?.sellerId);
      const propertyId =
        typeof req.body?.propertyId === 'number' && req.body.propertyId > 0
          ? req.body.propertyId
          : null;
      const check = validateReviewPayload({
        sellerId,
        authorId: req.dbUser.id,
        rating: Number(req.body?.rating),
        comment: typeof req.body?.comment === 'string' ? req.body.comment : '',
      });
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }

      const saved = await createSellerReview({
        sellerId,
        authorId: req.dbUser.id,
        propertyId,
        rating: check.rating,
        comment: check.comment,
      });
      res.status(201).json(saved);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка сохранения отзыва' });
    }
  });

  app.post('/api/reviews/:id/reply', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const reviewId = Number(req.params.id);
      if (Number.isNaN(reviewId)) return res.status(400).json({ error: 'Некорректный ID отзыва' });
      const replyText = typeof req.body?.reply === 'string' ? req.body.reply.trim() : '';
      if (replyText.length < 2 || replyText.length > 1000) {
        return res.status(400).json({ error: 'Ответ должен содержать от 2 до 1000 символов.' });
      }
      const result = await replyToSellerReview({
        reviewId,
        sellerId: req.dbUser.id,
        replyText,
      });
      if (result.status === 'not_found') return res.status(404).json({ error: 'Отзыв не найден' });
      if (result.status === 'forbidden') {
        return res.status(403).json({ error: 'Ответить на отзыв может только продавец.' });
      }
      res.json({ review: result.review });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка отправки ответа' });
    }
  });

  app.post('/api/reviews/:id/report', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const reviewId = Number(req.params.id);
      if (Number.isNaN(reviewId)) return res.status(400).json({ error: 'Некорректный ID отзыва' });
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'other';
      const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
      const result = await reportSellerReview({
        reviewId,
        reporterId: req.dbUser.id,
        reason,
        details,
      });
      if (result.status === 'not_found') return res.status(404).json({ error: 'Отзыв не найден' });
      res.json({ reported: true, reportsCount: result.reportsCount });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка отправки жалобы' });
    }
  });

  app.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const list = await listUserNotifications(req.dbUser.id);
      res.json({ notifications: list });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка загрузки уведомлений' });
    }
  });

  app.patch('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      await markAllNotificationsAsRead(req.dbUser.id);
      res.json({ updated: true });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка обновления уведомлений' });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Некорректный ID уведомления' });
      await markNotificationAsRead(req.dbUser.id, id);
      res.json({ updated: true, id });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка обновления уведомления' });
    }
  });

  app.post('/api/properties/:id/report', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const propertyId = Number(req.params.id);
      if (Number.isNaN(propertyId) || propertyId <= 0) {
        return res.status(400).json({ error: 'Некорректный ID объекта' });
      }
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'other';
      const details = typeof req.body?.details === 'string' ? req.body.details.trim() : '';
      const result = await createPropertyReportRecord({
        propertyId,
        reporterId: req.dbUser.id,
        reason,
        details,
      });
      if (result.status === 'not_found') {
        return res.status(404).json({ error: 'Объект не найден' });
      }
      res.status(201).json({ reported: true });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ошибка отправки жалобы на объект',
      });
    }
  });

  app.get('/api/payments/services', (_req, res) => {
    res.json({
      services: ESTORA_PAID_SERVICES,
      providers: ['payme', 'click', 'uzcard_humo'],
    });
  });

  app.get('/api/payments/history', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const transactions = await listUserPaymentHistory(req.dbUser.id);
      res.json({ transactions });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ошибка загрузки истории платежей',
      });
    }
  });

  app.post('/api/payments/checkout', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });

      const safetyCheck = validateNoSensitiveCardData(req.body);
      if (!safetyCheck.safe) {
        return res.status(400).json({ error: safetyCheck.reason });
      }

      const serviceType = typeof req.body?.serviceType === 'string' ? req.body.serviceType : '';
      const provider = typeof req.body?.provider === 'string' ? req.body.provider : '';
      const svc = getPaidServiceDefinition(serviceType);
      if (!svc) {
        return res.status(400).json({ error: 'Неизвестная услуга продвижения.' });
      }
      if (!ALLOWED_PAYMENT_PROVIDERS.has(provider as PaymentProvider)) {
        return res.status(400).json({ error: 'Неподдерживаемый платёжный провайдер.' });
      }

      let propertyId: number | null = null;
      if (req.body?.propertyId !== undefined && req.body?.propertyId !== null) {
        const pid = Number(req.body.propertyId);
        if (!Number.isInteger(pid) || pid <= 0) {
          return res.status(400).json({ error: 'Некорректный ID объекта.' });
        }
        const prop = await getPropertyById(pid);
        if (!prop) {
          return res.status(404).json({ error: 'Объект не найден.' });
        }
        if (req.dbUser.role !== 'admin' && prop.ownerId !== req.dbUser.id) {
          return res.status(403).json({
            error: 'Оплачивать продвижение можно только для собственных объявлений.',
          });
        }
        propertyId = pid;
      }

      const order = await createPaymentOrderRecord({
        userId: req.dbUser.id,
        propertyId,
        serviceType: svc.id as PaidServiceType,
        provider: provider as PaymentProvider,
      });

      const appUrl =
        (typeof req.headers.origin === 'string' && req.headers.origin) ||
        `http://localhost:${port}`;
      const gateway = buildCheckoutGatewayResponse({
        orderCode: order.orderCode,
        provider: provider as PaymentProvider,
        amountUzs: order.amountUzs,
        appUrl,
        lang: typeof req.body?.lang === 'string' ? req.body.lang : 'ru',
        paymeMerchantId: process.env.PAYME_MERCHANT_ID,
        clickMerchantId: process.env.CLICK_MERCHANT_ID,
        clickServiceId: process.env.CLICK_SERVICE_ID,
      });

      res.status(201).json({
        order,
        ...gateway,
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ошибка создания платежа',
      });
    }
  });

  app.post('/api/payments/verify', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });

      const safetyCheck = validateNoSensitiveCardData(req.body);
      if (!safetyCheck.safe) {
        return res.status(400).json({ error: safetyCheck.reason });
      }

      const orderCode = typeof req.body?.orderCode === 'string' ? req.body.orderCode.trim() : '';
      if (!orderCode) {
        return res.status(400).json({ error: 'Укажите код заказа orderCode.' });
      }

      const existing = await getPaymentOrderByCode(orderCode);
      if (!existing) {
        return res.status(404).json({ error: 'Платёжный заказ не найден.' });
      }
      if (req.dbUser.role !== 'admin' && existing.userId !== req.dbUser.id) {
        return res.status(403).json({ error: 'Нет доступа к этому платежу.' });
      }

      const updated = await applyPaidOrderBenefits({
        orderCode,
        externalTransactionId:
          typeof req.body?.externalTransactionId === 'string'
            ? req.body.externalTransactionId
            : undefined,
        maskedCardSummary:
          typeof req.body?.maskedCardSummary === 'string'
            ? req.body.maskedCardSummary
            : undefined,
      });

      res.json({ order: updated });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ошибка подтверждения платежа',
      });
    }
  });

  app.post('/api/payments/webhook/payme', async (req, res) => {
    try {
      const secretKey = process.env.PAYME_SECRET_KEY || '';
      if (secretKey && !verifyPaymeBasicAuth(req.headers.authorization, secretKey)) {
        return res.json({
          jsonrpc: '2.0',
          id: req.body?.id ?? null,
          error: { code: -32504, message: 'Insufficient privilege to perform this method.' },
        });
      }

      const rpcId = req.body?.id ?? null;
      const method = req.body?.method;
      const params = req.body?.params ?? {};
      const orderCode =
        typeof params?.account?.order_id === 'string' ? params.account.order_id.trim() : '';

      if (!orderCode && method !== 'CheckTransaction') {
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          error: { code: -31050, message: 'Order ID is missing.' },
        });
      }

      const order = orderCode ? await getPaymentOrderByCode(orderCode) : null;
      if (!order && method !== 'CheckTransaction') {
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          error: { code: -31050, message: 'Order not found.' },
        });
      }

      if (method === 'CheckPerformTransaction' && order) {
        const expectedTiyin = Math.round(order.amountUzs * 100);
        if (Number(params.amount) !== expectedTiyin) {
          return res.json({
            jsonrpc: '2.0',
            id: rpcId,
            error: { code: -31001, message: 'Invalid amount.' },
          });
        }
        return res.json({ jsonrpc: '2.0', id: rpcId, result: { allow: true } });
      }

      if (method === 'CreateTransaction' && order) {
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            create_time: Date.now(),
            transaction: String(order.id),
            state: 1,
          },
        });
      }

      if (method === 'PerformTransaction' && order) {
        const updated = await applyPaidOrderBenefits({
          orderCode: order.orderCode,
          externalTransactionId: typeof params?.id === 'string' ? params.id : undefined,
        });
        return res.json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            transaction: String(order.id),
            perform_time: Date.now(),
            state: updated?.status === 'paid' ? 2 : 1,
          },
        });
      }

      return res.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: { state: order?.status === 'paid' ? 2 : 1 },
      });
    } catch {
      res.status(500).json({ error: 'Payme webhook error' });
    }
  });

  app.post('/api/payments/webhook/click', async (req, res) => {
    try {
      const b = req.body ?? {};
      const clickTransId = b.click_trans_id;
      const serviceId = b.service_id;
      const merchantTransId = typeof b.merchant_trans_id === 'string' ? b.merchant_trans_id : '';
      const amount = b.amount;
      const action = b.action;
      const signTime = typeof b.sign_time === 'string' ? b.sign_time : '';
      const signString = typeof b.sign_string === 'string' ? b.sign_string : '';

      const secretKey = process.env.CLICK_SECRET_KEY || '';
      if (secretKey) {
        const expected = computeClickSignString({
          clickTransId: clickTransId ?? '',
          serviceId: serviceId ?? '',
          secretKey,
          merchantTransId,
          merchantPrepareId: b.merchant_prepare_id,
          amount: amount ?? '',
          action: action ?? '',
          signTime,
        });
        if (expected !== signString) {
          return res.json({ error: -1, error_note: 'SIGN CHECK FAILED' });
        }
      }

      const order = merchantTransId ? await getPaymentOrderByCode(merchantTransId) : null;
      if (!order) {
        return res.json({ error: -5, error_note: 'Order not found' });
      }

      if (Number(action) === 0) {
        return res.json({
          click_trans_id: clickTransId,
          merchant_trans_id: merchantTransId,
          merchant_prepare_id: order.id,
          error: 0,
          error_note: 'Success',
        });
      }

      if (Number(action) === 1 && Number(b.error ?? 0) === 0) {
        await applyPaidOrderBenefits({
          orderCode: order.orderCode,
          externalTransactionId: clickTransId ? `CLICK-${clickTransId}` : undefined,
        });
      }

      return res.json({
        click_trans_id: clickTransId,
        merchant_trans_id: merchantTransId,
        merchant_confirm_id: order.id,
        error: 0,
        error_note: 'Success',
      });
    } catch {
      res.status(500).json({ error: -9, error_note: 'Internal error' });
    }
  });

  app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const overview = await getAdminDashboardOverview();
      res.json(overview);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка панели администратора';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/admin/reviews/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Некорректный ID отзыва' });
      const status = req.body?.status;
      if (status !== 'visible' && status !== 'hidden' && status !== 'flagged') {
        return res.status(400).json({ error: 'Недопустимый статус отзыва' });
      }
      const updated = await moderateReviewStatus(id, status);
      if (!updated) return res.status(404).json({ error: 'Отзыв не найден' });
      res.json({ review: updated });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка модерации отзыва' });
    }
  });

  app.patch('/api/admin/properties/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Некорректный ID объекта' });
      }
      const existing = await getPropertyById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Объект не найден' });
      }

      const body = req.body ?? {};
      let action: 'approve' | 'reject' | 'archive' | 'pending' | 'toggle_featured';
      if (
        body.action === 'approve' ||
        body.action === 'reject' ||
        body.action === 'archive' ||
        body.action === 'pending' ||
        body.action === 'toggle_featured'
      ) {
        action = body.action;
      } else if (typeof body.status === 'string' && ALLOWED_STATUSES.has(body.status)) {
        action =
          body.status === 'active'
            ? 'approve'
            : body.status === 'rejected'
              ? 'reject'
              : body.status === 'archived'
                ? 'archive'
                : 'pending';
      } else if (typeof body.isFeatured === 'boolean') {
        action = 'toggle_featured';
      } else {
        return res.status(400).json({ error: 'Укажите действие модерации.' });
      }

      const updated = await moderateAdminPropertyRecord({
        propertyId: id,
        action,
        isFeatured: typeof body.isFeatured === 'boolean' ? body.isFeatured : undefined,
        rejectionReason: typeof body.rejectionReason === 'string' ? body.rejectionReason : undefined,
      });

      if (!updated) {
        return res.status(404).json({ error: 'Объект не найден' });
      }

      if (updated.status !== existing.status) {
        await createAndEmitNotification({
          userId: updated.ownerId,
          type: 'status_changed',
          title: `Статус объявления изменён: ${updated.title}`,
          body:
            updated.status === 'rejected' && updated.rejectionReason
              ? `Отклонено модератором: ${updated.rejectionReason}`
              : updated.status === 'active'
                ? 'Объявление проверено и опубликовано в каталоге ESTORA.'
                : `Модератор изменил статус публикации на «${updated.status}».`,
          linkPath: '/profile?tab=seller',
          relatedPropertyId: updated.id,
        });
      }

      if (updated.status === 'active' && existing.status !== 'active') {
        void dispatchSavedFilterMatchNotifications({
          id: updated.id,
          ownerId: updated.ownerId,
          status: updated.status,
          country: updated.country,
          dealType: updated.dealType,
          propertyType: updated.propertyType,
          city: updated.city,
          district: updated.district,
          priceUsd: updated.priceUsd,
          areaSqm: updated.areaSqm,
          bedrooms: updated.bedrooms,
          has3dTour: updated.has3dTour,
          renovation: updated.renovation,
          furnished: updated.furnished,
          parking: updated.parking,
          title: updated.title,
          description: updated.description,
        });
      }

      res.json({ property: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ошибка модерации объекта';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const targetId = Number(req.params.id);
      if (Number.isNaN(targetId)) {
        return res.status(400).json({ error: 'Некорректный ID пользователя' });
      }
      const role =
        req.body?.role === 'buyer' || req.body?.role === 'agent' || req.body?.role === 'admin'
          ? req.body.role
          : undefined;
      const result = await updateAdminUserRecord({
        targetUserId: targetId,
        actorUserId: req.dbUser.id,
        isBlocked: typeof req.body?.isBlocked === 'boolean' ? req.body.isBlocked : undefined,
        blockedReason:
          typeof req.body?.blockedReason === 'string' ? req.body.blockedReason : undefined,
        role,
      });

      if (result.status === 'self_restricted') {
        return res.status(400).json({
          error: 'Нельзя заблокировать собственный аккаунт или снять с себя права администратора.',
        });
      }
      if (result.status === 'not_found') {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      res.json({ user: result.user });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ошибка обновления пользователя',
      });
    }
  });

  app.patch('/api/admin/reports/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Некорректный ID жалобы' });
      }
      const status = req.body?.status;
      if (status !== 'resolved' && status !== 'dismissed') {
        return res.status(400).json({ error: 'Допустимые статусы: resolved или dismissed.' });
      }
      const updated = await moderatePropertyReportRecord(id, {
        status,
        adminNote: typeof req.body?.adminNote === 'string' ? req.body.adminNote : undefined,
        archiveProperty: Boolean(req.body?.archiveProperty),
      });
      if (!updated) {
        return res.status(404).json({ error: 'Жалоба не найдена' });
      }
      res.json({ report: updated });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ошибка обработки жалобы',
      });
    }
  });

  app.patch('/api/admin/categories/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Некорректный ID категории' });
      }
      const updated = await updateAdminCategory(id, {
        isActive: typeof req.body?.isActive === 'boolean' ? req.body.isActive : undefined,
        sortOrder: typeof req.body?.sortOrder === 'number' ? req.body.sortOrder : undefined,
        baseListingFeeUsd:
          typeof req.body?.baseListingFeeUsd === 'number'
            ? req.body.baseListingFeeUsd
            : undefined,
      });
      if (!updated) {
        return res.status(404).json({ error: 'Категория не найдена' });
      }
      res.json({ category: updated });
    } catch (error: unknown) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Ошибка обновления категории',
      });
    }
  });

  app.get('/api/designs', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const designs = await listUserDesigns(req.dbUser.id);
      res.json({ designs });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка загрузки дизайнов' });
    }
  });

  app.get('/api/designs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Некорректный ID дизайна' });
      const design = await getUserDesignById(id, req.dbUser.id, req.dbUser.role === 'admin');
      if (!design) return res.status(404).json({ error: 'Дизайн не найден' });
      res.json({ design });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка загрузки дизайна' });
    }
  });

  app.post('/api/designs', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const body = req.body ?? {};
      const title = typeof body.title === 'string' ? body.title.trim() : 'Мой дизайн интерьера';
      const designJson = typeof body.designJson === 'string' ? body.designJson : JSON.stringify(body.designJson ?? {});
      const propertyId = body.propertyId !== undefined && body.propertyId !== null ? Number(body.propertyId) : null;
      const thumbnailUrl = typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl : '';

      const created = await createUserDesign({
        userId: req.dbUser.id,
        propertyId: Number.isInteger(propertyId) && propertyId! > 0 ? propertyId : null,
        title,
        designJson,
        thumbnailUrl,
      });
      res.status(201).json({ design: created });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка сохранения дизайна' });
    }
  });

  app.patch('/api/designs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Некорректный ID дизайна' });
      const body = req.body ?? {};
      const updated = await updateUserDesign(id, req.dbUser.id, req.dbUser.role === 'admin', {
        ...(typeof body.title === 'string' ? { title: body.title } : {}),
        ...(body.designJson !== undefined ? { designJson: typeof body.designJson === 'string' ? body.designJson : JSON.stringify(body.designJson) } : {}),
        ...(typeof body.thumbnailUrl === 'string' ? { thumbnailUrl: body.thumbnailUrl } : {}),
      });
      if (!updated) return res.status(404).json({ error: 'Дизайн не найден или нет прав' });
      res.json({ design: updated });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка обновления дизайна' });
    }
  });

  app.delete('/api/designs/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Некорректный ID дизайна' });
      const deleted = await deleteUserDesign(id, req.dbUser.id, req.dbUser.role === 'admin');
      if (!deleted) return res.status(404).json({ error: 'Дизайн не найден' });
      res.json({ deletedId: id });
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка удаления дизайна' });
    }
  });

  app.post('/api/ai/recommend', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      if (!prompt) {
        return res.status(400).json({ error: 'Введите запрос для ESTORA AI.' });
      }

      const rawPersonalization = sanitizePersonalizationContext(req.body?.personalization);

      // Enrich with signed-in user's favorite property IDs & preferred city ONLY when personalization is enabled
      let favoritePropertyIds = rawPersonalization.favoritePropertyIds;
      let preferredCity = rawPersonalization.preferredCity;
      if (rawPersonalization.enabled && req.dbUser) {
        const userFavs = await listUserFavorites(req.dbUser.id);
        const dbFavIds = userFavs.map((f) => f.propertyId);
        favoritePropertyIds = Array.from(new Set([...favoritePropertyIds, ...dbFavIds])).slice(
          0,
          20
        );
        if (!preferredCity && req.dbUser.preferredCity) {
          preferredCity = req.dbUser.preferredCity;
        }
      }

      const result = await runEstoraAiAgent({
        prompt,
        history: Array.isArray(req.body?.history) ? req.body.history : [],
        personalization: {
          ...rawPersonalization,
          preferredCity,
          favoritePropertyIds,
        },
        selectedCompareIds: Array.isArray(req.body?.selectedCompareIds)
          ? req.body.selectedCompareIds
          : [],
        recentRecommendedIds: Array.isArray(req.body?.recentRecommendedIds)
          ? req.body.recentRecommendedIds
          : [],
        queryCatalog: async (filters) => {
          const toNum = (v?: string) => (v && v.trim() !== '' ? Number(v) : undefined);
          const res = await listProperties({
            dealType: filters.dealType,
            propertyType: filters.propertyType,
            city: filters.city,
            district: filters.district,
            rooms: filters.rooms,
            has3dTour: filters.has3dTour,
            minPrice: toNum(filters.minPrice),
            maxPrice: toNum(filters.maxPrice),
            minArea: toNum(filters.minArea),
            maxArea: toNum(filters.maxArea),
            renovation: filters.renovation,
            furnished: filters.furnished,
            parking: filters.parking,
            q: filters.q,
            sort: filters.sort,
            pageSize: filters.pageSize ?? 12,
          });
          return {
            total: res.total,
            properties: res.properties.map((p) => ({
              ...p,
              createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
              featuredUntil: p.featuredUntil instanceof Date ? p.featuredUntil.toISOString() : p.featuredUntil ? String(p.featuredUntil) : null,
            })),
          };
        },
        getPropertiesByIds: async (ids) => {
          const rows = await getPropertiesByIds(ids);
          return rows.map((p) => ({
            ...p,
            createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
            featuredUntil: p.featuredUntil instanceof Date ? p.featuredUntil.toISOString() : p.featuredUntil ? String(p.featuredUntil) : null,
          }));
        },
      });

      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Не удалось получить рекомендацию ESTORA AI.';
      res.status(500).json({ error: message });
    }
  });

  const archVisionCache = new Map<string, unknown>();

  app.post('/api/properties/analyze-architecture', async (req, res) => {
    try {
      const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const propertyType =
        typeof req.body?.propertyType === 'string' ? req.body.propertyType.trim() : '';
      const description =
        typeof req.body?.description === 'string' ? req.body.description.trim() : '';

      if (!imageUrl) {
        return res.json({ visionOverride: null });
      }

      const cacheKey = `${imageUrl}::${propertyType}`;
      if (archVisionCache.has(cacheKey)) {
        return res.json({ visionOverride: archVisionCache.get(cacheKey) });
      }

      let imageBuffer: Buffer | null = null;
      let mimeType = 'image/jpeg';

      if (imageUrl.startsWith('/uploads/')) {
        const rel = path.basename(imageUrl);
        const fullPath = path.resolve(uploadsDir, rel);
        if (fullPath.startsWith(uploadsDir) && fs.existsSync(fullPath)) {
          imageBuffer = fs.readFileSync(fullPath);
          if (fullPath.endsWith('.png')) mimeType = 'image/png';
          else if (fullPath.endsWith('.webp')) mimeType = 'image/webp';
        }
      } else if (imageUrl.startsWith('/src/assets/images/')) {
        const assetsDir = path.resolve(__dirname, 'src', 'assets', 'images');
        const rel = path.basename(imageUrl);
        const fullPath = path.resolve(assetsDir, rel);
        if (fullPath.startsWith(assetsDir) && fs.existsSync(fullPath)) {
          imageBuffer = fs.readFileSync(fullPath);
          if (fullPath.endsWith('.png')) mimeType = 'image/png';
          else if (fullPath.endsWith('.webp')) mimeType = 'image/webp';
        }
      } else if (imageUrl.startsWith('https://') || imageUrl.startsWith('http://')) {
        try {
          const resp = await fetch(imageUrl, { signal: AbortSignal.timeout(4500) });
          if (resp.ok) {
            const arr = await resp.arrayBuffer();
            if (arr.byteLength > 0 && arr.byteLength <= 4 * 1024 * 1024) {
              imageBuffer = Buffer.from(arr);
              const ct = resp.headers.get('content-type');
              if (ct && ct.startsWith('image/')) mimeType = ct.split(';')[0];
            }
          }
        } catch {
          // ignore fetch timeout
        }
      }

      if (!imageBuffer) {
        return res.json({ visionOverride: null });
      }

      const visionOverride = await analyzeBuildingImageWithGemini({
        imageBase64: imageBuffer.toString('base64'),
        mimeType,
        title,
        propertyType,
        description,
      });

      if (visionOverride) {
        archVisionCache.set(cacheKey, visionOverride);
      }
      return res.json({ visionOverride });
    } catch {
      return res.json({ visionOverride: null });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  void ensureDefaultCategories().catch((err) => {
    console.error('ensureDefaultCategories startup error:', err);
  });
  void seedInitialReviewsIfEmpty().catch((err) => {
    console.error('seedInitialReviewsIfEmpty startup error:', err);
  });

  const httpServer = http.createServer(app);
  realtimeHub.attach(httpServer);

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`ESTORA server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ESTORA server:', err);
  process.exit(1);
});
