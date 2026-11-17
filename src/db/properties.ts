import { and, asc, desc, eq, gte, ilike, inArray, lte, notInArray, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  favorites,
  mediaAssets,
  messages,
  properties,
  tour3dHotspots,
  tour3dRooms,
  tour3dTours,
  users,
} from './schema.ts';
import { buildEffectiveTourConfig, sanitizeTourHotspots } from '../utils/tour3d.ts';
import type { Tour3DConfig, TourHotspot, TourRoom } from '../types/estora.ts';

async function hydratePropertiesWithTours<T extends { id: number; model3dUrl?: string; panoramaUrl?: string; virtualTourUrl?: string }>(
  rows: T[]
): Promise<Array<T & { tourConfig: Tour3DConfig | null; tourRooms: TourRoom[]; tourHotspots: TourHotspot[] }>> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [tourRows, roomRows, hotspotRows] = await Promise.all([
    db.select().from(tour3dTours).where(inArray(tour3dTours.propertyId, ids)),
    db
      .select()
      .from(tour3dRooms)
      .where(inArray(tour3dRooms.propertyId, ids))
      .orderBy(asc(tour3dRooms.roomOrder), asc(tour3dRooms.id)),
    db
      .select()
      .from(tour3dHotspots)
      .where(inArray(tour3dHotspots.propertyId, ids))
      .orderBy(asc(tour3dHotspots.id)),
  ]);

  const tourByProp = new Map<number, typeof tourRows[number]>();
  for (const t of tourRows) {
    tourByProp.set(t.propertyId, t);
  }

  const roomsByProp = new Map<number, TourRoom[]>();
  for (const r of roomRows) {
    const list = roomsByProp.get(r.propertyId) ?? [];
    list.push({
      id: r.id,
      roomKey: r.roomKey,
      roomName: r.roomName,
      roomOrder: r.roomOrder,
      filePath: r.filePath,
      contentType: r.contentType,
      processingStatus: r.processingStatus,
      initialYaw: r.initialYaw,
      initialPitch: r.initialPitch,
    });
    roomsByProp.set(r.propertyId, list);
  }

  const hotspotsByProp = new Map<number, TourHotspot[]>();
  for (const h of hotspotRows) {
    const list = hotspotsByProp.get(h.propertyId) ?? [];
    list.push({
      id: h.id,
      fromRoomKey: h.fromRoomKey,
      targetRoomKey: h.targetRoomKey,
      label: h.label,
      yaw: h.yaw,
      pitch: h.pitch,
    });
    hotspotsByProp.set(h.propertyId, list);
  }

  return rows.map((row) => {
    const t = tourByProp.get(row.id);
    const rooms = roomsByProp.get(row.id) ?? [];
    const hotspots = hotspotsByProp.get(row.id) ?? [];
    const tourConfig: Tour3DConfig | null = t
      ? {
          contentType: (t.contentType as Tour3DConfig['contentType']) || 'none',
          filePath: t.filePath,
          processingStatus: t.processingStatus,
          autoRotate: t.autoRotate,
          defaultFov: t.defaultFov,
          exposure: t.exposure,
        }
      : rooms.length > 0 || row.model3dUrl || row.virtualTourUrl
        ? buildEffectiveTourConfig({
            model3dUrl: row.model3dUrl,
            tourRooms: rooms,
            virtualTourUrl: row.virtualTourUrl,
          })
        : null;

    return {
      ...row,
      tourConfig,
      tourRooms: rooms,
      tourHotspots: hotspots,
    };
  });
}

export interface PropertyFilterParams {
  dealType?: string;
  propertyType?: string;
  city?: string;
  district?: string;
  rooms?: string;
  has3dTour?: boolean;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  minFloor?: number;
  maxFloor?: number;
  renovation?: string;
  furnished?: string;
  parking?: string;
  publishedWithin?: string;
  q?: string;
  sort?: string;
  ownerId?: number;
  includeAllStatuses?: boolean;
  page?: number;
  pageSize?: number;
  limit?: number;
}

export async function listProperties(filters: PropertyFilterParams = {}) {
  try {
    const conditions = [];

    if (!filters.includeAllStatuses) {
      conditions.push(eq(properties.status, 'active'));
      conditions.push(eq(properties.country, 'Uzbekistan'));
      const inactiveCats = await db
        .select({ slug: categories.slug })
        .from(categories)
        .where(eq(categories.isActive, false));
      const inactiveSlugs = inactiveCats.map((c) => c.slug).filter(Boolean);
      if (inactiveSlugs.length > 0) {
        conditions.push(notInArray(properties.propertyType, inactiveSlugs));
      }
    }
    if (filters.dealType && filters.dealType !== 'all') {
      conditions.push(eq(properties.dealType, filters.dealType));
    }
    if (filters.propertyType && filters.propertyType !== 'all') {
      conditions.push(eq(properties.propertyType, filters.propertyType));
    }
    if (filters.city && filters.city !== 'all') {
      conditions.push(eq(properties.city, filters.city));
    }
    if (filters.district && filters.district.trim().length > 0) {
      conditions.push(ilike(properties.district, `%${filters.district.trim()}%`));
    }
    if (filters.rooms && filters.rooms !== 'all') {
      if (filters.rooms === '5+') {
        conditions.push(gte(properties.bedrooms, 5));
      } else {
        const roomCount = Number(filters.rooms);
        if (!Number.isNaN(roomCount)) {
          conditions.push(eq(properties.bedrooms, roomCount));
        }
      }
    }
    if (filters.has3dTour) {
      conditions.push(eq(properties.has3dTour, true));
    }
    if (filters.featured) {
      conditions.push(eq(properties.isFeatured, true));
    }
    if (typeof filters.minPrice === 'number' && !Number.isNaN(filters.minPrice)) {
      conditions.push(gte(properties.priceUsd, filters.minPrice));
    }
    if (typeof filters.maxPrice === 'number' && !Number.isNaN(filters.maxPrice)) {
      conditions.push(lte(properties.priceUsd, filters.maxPrice));
    }
    if (typeof filters.minArea === 'number' && !Number.isNaN(filters.minArea)) {
      conditions.push(gte(properties.areaSqm, filters.minArea));
    }
    if (typeof filters.maxArea === 'number' && !Number.isNaN(filters.maxArea)) {
      conditions.push(lte(properties.areaSqm, filters.maxArea));
    }
    if (typeof filters.minFloor === 'number' && !Number.isNaN(filters.minFloor)) {
      conditions.push(gte(properties.floor, filters.minFloor));
    }
    if (typeof filters.maxFloor === 'number' && !Number.isNaN(filters.maxFloor)) {
      conditions.push(lte(properties.floor, filters.maxFloor));
    }
    if (filters.renovation && filters.renovation !== 'all') {
      conditions.push(eq(properties.renovation, filters.renovation));
    }
    if (filters.furnished === 'true') {
      conditions.push(eq(properties.furnished, true));
    } else if (filters.furnished === 'false') {
      conditions.push(eq(properties.furnished, false));
    }
    if (filters.parking === 'true') {
      conditions.push(eq(properties.parking, true));
    } else if (filters.parking === 'false') {
      conditions.push(eq(properties.parking, false));
    }
    if (filters.publishedWithin && filters.publishedWithin !== 'all') {
      const hours =
        filters.publishedWithin === '24h'
          ? 24
          : filters.publishedWithin === '7d'
            ? 24 * 7
            : filters.publishedWithin === '30d'
              ? 24 * 30
              : 0;
      if (hours > 0) {
        const cutoff = new Date(Date.now() - hours * 3600 * 1000);
        conditions.push(gte(properties.createdAt, cutoff));
      }
    }
    if (typeof filters.ownerId === 'number') {
      conditions.push(eq(properties.ownerId, filters.ownerId));
    }
    if (filters.q && filters.q.trim().length > 0) {
      const term = `%${filters.q.trim()}%`;
      conditions.push(
        or(
          ilike(properties.title, term),
          ilike(properties.city, term),
          ilike(properties.district, term),
          ilike(properties.address, term),
          ilike(properties.description, term)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderClauses =
      filters.sort === 'price_asc'
        ? [asc(properties.priceUsd), desc(properties.id)]
        : filters.sort === 'price_desc'
          ? [desc(properties.priceUsd), desc(properties.id)]
          : filters.sort === 'popular'
            ? [desc(properties.isFeatured), desc(properties.viewsCount), desc(properties.id)]
            : filters.sort === 'area_desc'
              ? [desc(properties.areaSqm), desc(properties.id)]
              : [desc(properties.isFeatured), desc(properties.createdAt), desc(properties.id)];

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, filters.limit ?? filters.pageSize ?? 6));
    const offset = (page - 1) * pageSize;

    const [countRows, rows] = await Promise.all([
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(properties)
        .where(whereClause),
      db
        .select({
          id: properties.id,
          ownerId: properties.ownerId,
          ownerName: users.fullName,
          ownerEmail: users.email,
          ownerPhone: users.phone,
          sellerRatingTenths: users.sellerRatingTenths,
          title: properties.title,
          slug: properties.slug,
          country: properties.country,
          dealType: properties.dealType,
          propertyType: properties.propertyType,
          city: properties.city,
          district: properties.district,
          address: properties.address,
          latitude: properties.latitude,
          longitude: properties.longitude,
          priceUsd: properties.priceUsd,
          priceCurrency: properties.priceCurrency,
          originalPrice: properties.originalPrice,
          monthlyRentUsd: properties.monthlyRentUsd,
          areaSqm: properties.areaSqm,
          bedrooms: properties.bedrooms,
          bathrooms: properties.bathrooms,
          floor: properties.floor,
          totalFloors: properties.totalFloors,
          renovation: properties.renovation,
          furnished: properties.furnished,
          heating: properties.heating,
          airConditioning: properties.airConditioning,
          parking: properties.parking,
          balcony: properties.balcony,
          has3dTour: properties.has3dTour,
          tour3dLabel: properties.tour3dLabel,
          model3dUrl: properties.model3dUrl,
          panoramaUrl: properties.panoramaUrl,
          virtualTourUrl: properties.virtualTourUrl,
          status: properties.status,
          isFeatured: properties.isFeatured,
          isVerified: properties.isVerified,
          moderationStatus: properties.moderationStatus,
          moderationNotes: properties.moderationNotes,
          moderationScore: properties.moderationScore,
          rejectionReason: properties.rejectionReason,
          featuredUntil: properties.featuredUntil,
          viewsCount: properties.viewsCount,
          imageUrl: properties.imageUrl,
          galleryImages: properties.galleryImages,
          description: properties.description,
          amenities: properties.amenities,
          contactName: properties.contactName,
          contactPhone: properties.contactPhone,
          contactMethod: properties.contactMethod,
          createdAt: properties.createdAt,
        })
        .from(properties)
        .leftJoin(users, eq(properties.ownerId, users.id))
        .where(whereClause)
        .orderBy(...orderClauses)
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = countRows[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const hydrated = await hydratePropertiesWithTours(rows);

    return {
      properties: hydrated,
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error('Database query failed in listProperties:', error);
    throw new Error('Не удалось загрузить каталог объектов.', { cause: error });
  }
}

export async function getPropertyById(id: number) {
  try {
    const rows = await db
      .select({
        id: properties.id,
        ownerId: properties.ownerId,
        ownerName: users.fullName,
        ownerEmail: users.email,
        ownerPhone: users.phone,
        sellerRatingTenths: users.sellerRatingTenths,
        title: properties.title,
        slug: properties.slug,
        country: properties.country,
        dealType: properties.dealType,
        propertyType: properties.propertyType,
        city: properties.city,
        district: properties.district,
        address: properties.address,
        latitude: properties.latitude,
        longitude: properties.longitude,
        priceUsd: properties.priceUsd,
        priceCurrency: properties.priceCurrency,
        originalPrice: properties.originalPrice,
        monthlyRentUsd: properties.monthlyRentUsd,
        areaSqm: properties.areaSqm,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
        floor: properties.floor,
        totalFloors: properties.totalFloors,
        renovation: properties.renovation,
        furnished: properties.furnished,
        heating: properties.heating,
        airConditioning: properties.airConditioning,
        parking: properties.parking,
        balcony: properties.balcony,
        has3dTour: properties.has3dTour,
        tour3dLabel: properties.tour3dLabel,
        model3dUrl: properties.model3dUrl,
        panoramaUrl: properties.panoramaUrl,
        virtualTourUrl: properties.virtualTourUrl,
        status: properties.status,
        isFeatured: properties.isFeatured,
        isVerified: properties.isVerified,
        moderationStatus: properties.moderationStatus,
        moderationNotes: properties.moderationNotes,
        moderationScore: properties.moderationScore,
        rejectionReason: properties.rejectionReason,
        featuredUntil: properties.featuredUntil,
        viewsCount: properties.viewsCount,
        imageUrl: properties.imageUrl,
        galleryImages: properties.galleryImages,
        description: properties.description,
        amenities: properties.amenities,
        contactName: properties.contactName,
        contactPhone: properties.contactPhone,
        contactMethod: properties.contactMethod,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .leftJoin(users, eq(properties.ownerId, users.id))
      .where(eq(properties.id, id))
      .limit(1);

    if (!rows[0]) return null;
    const hydrated = await hydratePropertiesWithTours([rows[0]]);
    return hydrated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getPropertyById:', error);
    throw new Error('Не удалось загрузить данные объекта.', { cause: error });
  }
}

export async function getPropertiesByIds(ids: number[]) {
  const cleanIds = Array.from(
    new Set(ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))
  ).slice(0, 20);
  if (cleanIds.length === 0) return [];

  try {
    const rows = await db
      .select({
        id: properties.id,
        ownerId: properties.ownerId,
        ownerName: users.fullName,
        ownerEmail: users.email,
        ownerPhone: users.phone,
        sellerRatingTenths: users.sellerRatingTenths,
        title: properties.title,
        slug: properties.slug,
        country: properties.country,
        dealType: properties.dealType,
        propertyType: properties.propertyType,
        city: properties.city,
        district: properties.district,
        address: properties.address,
        latitude: properties.latitude,
        longitude: properties.longitude,
        priceUsd: properties.priceUsd,
        priceCurrency: properties.priceCurrency,
        originalPrice: properties.originalPrice,
        monthlyRentUsd: properties.monthlyRentUsd,
        areaSqm: properties.areaSqm,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
        floor: properties.floor,
        totalFloors: properties.totalFloors,
        renovation: properties.renovation,
        furnished: properties.furnished,
        heating: properties.heating,
        airConditioning: properties.airConditioning,
        parking: properties.parking,
        balcony: properties.balcony,
        has3dTour: properties.has3dTour,
        tour3dLabel: properties.tour3dLabel,
        model3dUrl: properties.model3dUrl,
        panoramaUrl: properties.panoramaUrl,
        virtualTourUrl: properties.virtualTourUrl,
        status: properties.status,
        isFeatured: properties.isFeatured,
        isVerified: properties.isVerified,
        moderationStatus: properties.moderationStatus,
        moderationNotes: properties.moderationNotes,
        moderationScore: properties.moderationScore,
        rejectionReason: properties.rejectionReason,
        featuredUntil: properties.featuredUntil,
        viewsCount: properties.viewsCount,
        imageUrl: properties.imageUrl,
        galleryImages: properties.galleryImages,
        description: properties.description,
        amenities: properties.amenities,
        contactName: properties.contactName,
        contactPhone: properties.contactPhone,
        contactMethod: properties.contactMethod,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .leftJoin(users, eq(properties.ownerId, users.id))
      .where(
        and(
          inArray(properties.id, cleanIds),
          eq(properties.status, 'active'),
          eq(properties.country, 'Uzbekistan')
        )
      );

    return await hydratePropertiesWithTours(rows);
  } catch (error) {
    console.error('Database query failed in getPropertiesByIds:', error);
    throw new Error('Не удалось загрузить выбранные объекты.', { cause: error });
  }
}

export async function listMapProperties(filters: {
  dealType?: string;
  propertyType?: string;
  city?: string;
  district?: string;
  has3dTour?: boolean;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
} = {}) {
  try {
    const conditions = [eq(properties.status, 'active'), eq(properties.country, 'Uzbekistan')];

    const inactiveCats = await db
      .select({ slug: categories.slug })
      .from(categories)
      .where(eq(categories.isActive, false));
    const inactiveSlugs = inactiveCats.map((c) => c.slug).filter(Boolean);
    if (inactiveSlugs.length > 0) {
      conditions.push(notInArray(properties.propertyType, inactiveSlugs));
    }

    if (filters.dealType && filters.dealType !== 'all') {
      conditions.push(eq(properties.dealType, filters.dealType));
    }
    if (filters.propertyType && filters.propertyType !== 'all') {
      conditions.push(eq(properties.propertyType, filters.propertyType));
    }
    if (filters.city && filters.city !== 'all') {
      conditions.push(eq(properties.city, filters.city));
    }
    if (filters.district && filters.district.trim().length > 0) {
      conditions.push(ilike(properties.district, `%${filters.district.trim()}%`));
    }
    if (filters.has3dTour) {
      conditions.push(eq(properties.has3dTour, true));
    }
    if (typeof filters.minPrice === 'number' && !Number.isNaN(filters.minPrice)) {
      conditions.push(gte(properties.priceUsd, filters.minPrice));
    }
    if (typeof filters.maxPrice === 'number' && !Number.isNaN(filters.maxPrice)) {
      conditions.push(lte(properties.priceUsd, filters.maxPrice));
    }
    if (
      typeof filters.south === 'number' &&
      typeof filters.north === 'number' &&
      Number.isFinite(filters.south) &&
      Number.isFinite(filters.north)
    ) {
      conditions.push(gte(properties.latitude, filters.south));
      conditions.push(lte(properties.latitude, filters.north));
    }
    if (
      typeof filters.west === 'number' &&
      typeof filters.east === 'number' &&
      Number.isFinite(filters.west) &&
      Number.isFinite(filters.east)
    ) {
      conditions.push(gte(properties.longitude, filters.west));
      conditions.push(lte(properties.longitude, filters.east));
    }
    if (filters.q && filters.q.trim().length > 0) {
      const term = `%${filters.q.trim()}%`;
      conditions.push(
        or(
          ilike(properties.title, term),
          ilike(properties.city, term),
          ilike(properties.district, term),
          ilike(properties.address, term)
        )!
      );
    }

    const rows = await db
      .select({
        id: properties.id,
        ownerId: properties.ownerId,
        ownerName: users.fullName,
        ownerEmail: users.email,
        ownerPhone: users.phone,
        sellerRatingTenths: users.sellerRatingTenths,
        title: properties.title,
        slug: properties.slug,
        country: properties.country,
        dealType: properties.dealType,
        propertyType: properties.propertyType,
        city: properties.city,
        district: properties.district,
        address: properties.address,
        latitude: properties.latitude,
        longitude: properties.longitude,
        priceUsd: properties.priceUsd,
        priceCurrency: properties.priceCurrency,
        originalPrice: properties.originalPrice,
        monthlyRentUsd: properties.monthlyRentUsd,
        areaSqm: properties.areaSqm,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
        floor: properties.floor,
        totalFloors: properties.totalFloors,
        renovation: properties.renovation,
        furnished: properties.furnished,
        heating: properties.heating,
        airConditioning: properties.airConditioning,
        parking: properties.parking,
        balcony: properties.balcony,
        has3dTour: properties.has3dTour,
        tour3dLabel: properties.tour3dLabel,
        model3dUrl: properties.model3dUrl,
        panoramaUrl: properties.panoramaUrl,
        virtualTourUrl: properties.virtualTourUrl,
        status: properties.status,
        isFeatured: properties.isFeatured,
        isVerified: properties.isVerified,
        moderationStatus: properties.moderationStatus,
        moderationNotes: properties.moderationNotes,
        moderationScore: properties.moderationScore,
        rejectionReason: properties.rejectionReason,
        featuredUntil: properties.featuredUntil,
        viewsCount: properties.viewsCount,
        imageUrl: properties.imageUrl,
        galleryImages: properties.galleryImages,
        description: properties.description,
        amenities: properties.amenities,
        contactName: properties.contactName,
        contactPhone: properties.contactPhone,
        contactMethod: properties.contactMethod,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .leftJoin(users, eq(properties.ownerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(properties.isFeatured), desc(properties.createdAt), desc(properties.id))
      .limit(150);

    return await hydratePropertiesWithTours(rows);
  } catch (error) {
    console.error('Database query failed in listMapProperties:', error);
    throw new Error('Не удалось загрузить объекты для карты.', { cause: error });
  }
}

export async function getCityStats() {
  try {
    const rows = await db
      .select({
        city: properties.city,
        count: sql<number>`count(*)::int`,
        minPriceUsd: sql<number>`min(${properties.priceUsd})::int`,
      })
      .from(properties)
      .where(and(eq(properties.status, 'active'), eq(properties.country, 'Uzbekistan')))
      .groupBy(properties.city);

    return rows;
  } catch (error) {
    console.error('Database query failed in getCityStats:', error);
    throw new Error('Не удалось получить статистику по городам.', { cause: error });
  }
}

export async function createPropertyRecord(input: {
  ownerId: number;
  title: string;
  country: 'Uzbekistan';
  dealType: string;
  propertyType: string;
  city: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  priceUsd: number;
  priceCurrency: string;
  originalPrice: number;
  monthlyRentUsd: number;
  areaSqm: number;
  bedrooms: number;
  bathrooms: number;
  floor: number;
  totalFloors: number;
  renovation: string;
  furnished: boolean;
  heating: string;
  airConditioning: boolean;
  parking: boolean;
  balcony: boolean;
  has3dTour: boolean;
  tour3dLabel: string;
  model3dUrl: string;
  panoramaUrl: string;
  virtualTourUrl: string;
  imageUrl: string;
  galleryImages: string[];
  description: string;
  amenities: string[];
  contactName: string;
  contactPhone: string;
  contactMethod: string;
  status: string;
  isVerified?: boolean;
  moderationStatus?: string;
  moderationNotes?: string;
  moderationScore?: number;
  rejectionReason?: string;
}) {
  try {
    const slugBase = input.title
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${slugBase || 'estora-object'}-${Date.now()}`;

    const rows = await db
      .insert(properties)
      .values({
        ownerId: input.ownerId,
        title: input.title,
        slug,
        country: input.country,
        dealType: input.dealType,
        propertyType: input.propertyType,
        city: input.city,
        district: input.district,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        priceUsd: input.priceUsd,
        priceCurrency: input.priceCurrency,
        originalPrice: input.originalPrice,
        monthlyRentUsd: input.monthlyRentUsd,
        areaSqm: input.areaSqm,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        floor: input.floor,
        totalFloors: input.totalFloors,
        renovation: input.renovation,
        furnished: input.furnished,
        heating: input.heating,
        airConditioning: input.airConditioning,
        parking: input.parking,
        balcony: input.balcony,
        has3dTour: input.has3dTour,
        tour3dLabel: input.tour3dLabel,
        model3dUrl: input.model3dUrl,
        panoramaUrl: input.panoramaUrl,
        virtualTourUrl: input.virtualTourUrl,
        imageUrl: input.imageUrl,
        galleryImages: JSON.stringify(input.galleryImages),
        description: input.description,
        amenities: JSON.stringify(input.amenities),
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactMethod: input.contactMethod,
        status: input.status,
        isFeatured: false,
        isVerified: Boolean(input.isVerified),
        moderationStatus: input.moderationStatus ?? 'pending',
        moderationNotes: input.moderationNotes ?? '[]',
        moderationScore: input.moderationScore ?? 100,
        rejectionReason: input.rejectionReason ?? '',
      })
      .returning();

    return rows[0];
  } catch (error) {
    console.error('Failed to create property:', error);
    throw new Error('Не удалось сохранить объявление в базу данных.', { cause: error });
  }
}

export async function updatePropertyRecord(
  id: number,
  ownerId: number,
  isAdmin: boolean,
  updates: Partial<{
    title: string;
    country: 'Uzbekistan';
    dealType: string;
    propertyType: string;
    city: string;
    district: string;
    address: string;
    latitude: number;
    longitude: number;
    priceUsd: number;
    priceCurrency: string;
    originalPrice: number;
    monthlyRentUsd: number;
    areaSqm: number;
    bedrooms: number;
    bathrooms: number;
    floor: number;
    totalFloors: number;
    renovation: string;
    furnished: boolean;
    heating: string;
    airConditioning: boolean;
    parking: boolean;
    balcony: boolean;
    has3dTour: boolean;
    tour3dLabel: string;
    model3dUrl: string;
    panoramaUrl: string;
    virtualTourUrl: string;
    imageUrl: string;
    galleryImages: string;
    description: string;
    amenities: string;
    contactName: string;
    contactPhone: string;
    contactMethod: string;
    status: string;
    isVerified: boolean;
    moderationStatus: string;
    moderationNotes: string;
    moderationScore: number;
    rejectionReason: string;
  }>
) {
  try {
    const whereCondition = isAdmin
      ? eq(properties.id, id)
      : and(eq(properties.id, id), eq(properties.ownerId, ownerId));

    const rows = await db
      .update(properties)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(whereCondition)
      .returning();

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to update property:', error);
    throw new Error('Не удалось обновить объявление.', { cause: error });
  }
}

export async function deletePropertyRecord(id: number, ownerId: number, isAdmin: boolean) {
  try {
    const whereCondition = isAdmin
      ? eq(properties.id, id)
      : and(eq(properties.id, id), eq(properties.ownerId, ownerId));

    const rows = await db.delete(properties).where(whereCondition).returning({ id: properties.id });
    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to delete property:', error);
    throw new Error('Не удалось удалить объявление.', { cause: error });
  }
}

export async function createMediaAssetRecord(input: {
  ownerId: number;
  kind: 'photo' | 'model3d' | 'panorama';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}) {
  try {
    const rows = await db.insert(mediaAssets).values(input).returning();
    return rows[0];
  } catch (error) {
    console.error('Failed to save media asset metadata:', error);
    throw new Error('Не удалось сохранить информацию о загруженном файле.', { cause: error });
  }
}

export async function getMediaAssetById(id: number) {
  const rows = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteMediaAssetRecord(id: number, ownerId: number, isAdmin: boolean) {
  const whereCondition = isAdmin
    ? eq(mediaAssets.id, id)
    : and(eq(mediaAssets.id, id), eq(mediaAssets.ownerId, ownerId));

  const rows = await db.delete(mediaAssets).where(whereCondition).returning();
  return rows[0] ?? null;
}

export async function getProperty3dTour(propertyId: number) {
  const [tours, rooms, hotspots] = await Promise.all([
    db.select().from(tour3dTours).where(eq(tour3dTours.propertyId, propertyId)).limit(1),
    db
      .select()
      .from(tour3dRooms)
      .where(eq(tour3dRooms.propertyId, propertyId))
      .orderBy(asc(tour3dRooms.roomOrder), asc(tour3dRooms.id)),
    db
      .select()
      .from(tour3dHotspots)
      .where(eq(tour3dHotspots.propertyId, propertyId))
      .orderBy(asc(tour3dHotspots.id)),
  ]);

  return {
    tourConfig: tours[0] ?? null,
    tourRooms: rooms,
    tourHotspots: hotspots,
  };
}

export async function upsertProperty3dTour(input: {
  propertyId: number;
  actorUserId: number;
  isAdmin: boolean;
  model3dUrl?: string;
  panoramaUrl?: string;
  virtualTourUrl?: string;
  tour3dLabel?: string;
  rooms?: TourRoom[];
  hotspots?: TourHotspot[];
  autoRotate?: boolean;
  defaultFov?: number;
  exposure?: number;
}) {
  const propRows = await db
    .select()
    .from(properties)
    .where(eq(properties.id, input.propertyId))
    .limit(1);
  const prop = propRows[0];
  if (!prop) return { status: 'not_found' as const };
  if (!input.isAdmin && prop.ownerId !== input.actorUserId) {
    return { status: 'forbidden' as const };
  }

  const rooms = (input.rooms ?? [])
    .filter((r) => typeof r.filePath === 'string' && r.filePath.trim().length > 0)
    .map((r, idx) => ({
      roomKey: (r.roomKey || `room-${idx + 1}`).trim(),
      roomName: (r.roomName || `Комната ${idx + 1}`).trim(),
      roomOrder: idx,
      filePath: r.filePath.trim(),
      contentType: r.contentType || 'panorama_360',
      processingStatus: r.processingStatus || 'ready',
      initialYaw: Number.isFinite(Number(r.initialYaw)) ? Number(r.initialYaw) : 0,
      initialPitch: Number.isFinite(Number(r.initialPitch)) ? Number(r.initialPitch) : 0,
    }));

  const hotspots = sanitizeTourHotspots(rooms, input.hotspots ?? []);
  const model3dUrl = (input.model3dUrl ?? '').trim();
  const virtualTourUrl = (input.virtualTourUrl ?? '').trim();
  const primaryPanorama = (input.panoramaUrl ?? '').trim() || rooms[0]?.filePath || '';
  const has3d = Boolean(model3dUrl || virtualTourUrl || rooms.length > 0 || primaryPanorama);

  const effectiveConfig = buildEffectiveTourConfig({
    model3dUrl,
    tourRooms: rooms,
    virtualTourUrl,
    autoRotate: input.autoRotate,
    defaultFov: input.defaultFov,
    exposure: input.exposure,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(properties)
      .set({
        has3dTour: has3d,
        model3dUrl,
        panoramaUrl: primaryPanorama,
        virtualTourUrl,
        ...(typeof input.tour3dLabel === 'string' ? { tour3dLabel: input.tour3dLabel.trim() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(properties.id, input.propertyId));

    await tx.delete(tour3dHotspots).where(eq(tour3dHotspots.propertyId, input.propertyId));
    await tx.delete(tour3dRooms).where(eq(tour3dRooms.propertyId, input.propertyId));
    await tx.delete(tour3dTours).where(eq(tour3dTours.propertyId, input.propertyId));

    if (has3d) {
      await tx.insert(tour3dTours).values({
        propertyId: input.propertyId,
        ownerId: prop.ownerId,
        contentType: effectiveConfig.contentType,
        filePath: effectiveConfig.filePath || '',
        processingStatus: 'ready',
        autoRotate: Boolean(effectiveConfig.autoRotate),
        defaultFov: effectiveConfig.defaultFov ?? 75,
        exposure: effectiveConfig.exposure ?? 1.05,
      });

      if (rooms.length > 0) {
        await tx.insert(tour3dRooms).values(
          rooms.map((r) => ({
            propertyId: input.propertyId,
            ownerId: prop.ownerId,
            roomKey: r.roomKey,
            roomName: r.roomName,
            roomOrder: r.roomOrder,
            filePath: r.filePath,
            contentType: r.contentType,
            processingStatus: 'ready',
            initialYaw: r.initialYaw,
            initialPitch: r.initialPitch,
          }))
        );
      }

      if (hotspots.length > 0) {
        await tx.insert(tour3dHotspots).values(
          hotspots.map((h) => ({
            propertyId: input.propertyId,
            ownerId: prop.ownerId,
            fromRoomKey: h.fromRoomKey,
            targetRoomKey: h.targetRoomKey,
            label: h.label,
            yaw: h.yaw,
            pitch: h.pitch,
          }))
        );
      }
    }
  });

  const updated = await getPropertyById(input.propertyId);
  return { status: 'ok' as const, property: updated };
}

export async function deleteProperty3dTour(
  propertyId: number,
  actorUserId: number,
  isAdmin: boolean
) {
  const propRows = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  const prop = propRows[0];
  if (!prop) return { status: 'not_found' as const };
  if (!isAdmin && prop.ownerId !== actorUserId) {
    return { status: 'forbidden' as const };
  }

  await db.transaction(async (tx) => {
    await tx.delete(tour3dHotspots).where(eq(tour3dHotspots.propertyId, propertyId));
    await tx.delete(tour3dRooms).where(eq(tour3dRooms.propertyId, propertyId));
    await tx.delete(tour3dTours).where(eq(tour3dTours.propertyId, propertyId));
    await tx
      .update(properties)
      .set({
        has3dTour: false,
        tour3dLabel: '',
        model3dUrl: '',
        panoramaUrl: '',
        virtualTourUrl: '',
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));
  });

  return { status: 'ok' as const };
}

export async function updatePropertyStatus(id: number, status: string, isFeatured?: boolean) {
  try {
    const updates: { status: string; updatedAt: Date; isFeatured?: boolean } = {
      status,
      updatedAt: new Date(),
    };
    if (typeof isFeatured === 'boolean') {
      updates.isFeatured = isFeatured;
    }

    const rows = await db
      .update(properties)
      .set(updates)
      .where(eq(properties.id, id))
      .returning();

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to update property status:', error);
    throw new Error('Не удалось обновить статус объявления.', { cause: error });
  }
}

export async function listUserFavorites(userId: number) {
  try {
    const rows = await db
      .select({
        favoriteId: favorites.id,
        propertyId: properties.id,
        title: properties.title,
        dealType: properties.dealType,
        propertyType: properties.propertyType,
        city: properties.city,
        district: properties.district,
        address: properties.address,
        priceUsd: properties.priceUsd,
        areaSqm: properties.areaSqm,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
        floor: properties.floor,
        totalFloors: properties.totalFloors,
        renovation: properties.renovation,
        furnished: properties.furnished,
        parking: properties.parking,
        has3dTour: properties.has3dTour,
        imageUrl: properties.imageUrl,
        description: properties.description,
        contactName: properties.contactName,
        contactPhone: properties.contactPhone,
        contactMethod: properties.contactMethod,
        ownerName: users.fullName,
        ownerPhone: users.phone,
        createdAt: properties.createdAt,
      })
      .from(favorites)
      .innerJoin(properties, eq(favorites.propertyId, properties.id))
      .leftJoin(users, eq(properties.ownerId, users.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));

    return rows;
  } catch (error) {
    console.error('Failed to list favorites:', error);
    throw new Error('Не удалось загрузить избранные объекты.', { cause: error });
  }
}

export async function toggleFavorite(userId: number, propertyId: number, active: boolean) {
  try {
    if (active) {
      await db
        .insert(favorites)
        .values({ userId, propertyId })
        .onConflictDoNothing({ target: [favorites.userId, favorites.propertyId] });
    } else {
      await db
        .delete(favorites)
        .where(and(eq(favorites.userId, userId), eq(favorites.propertyId, propertyId)));
    }
    return true;
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    throw new Error('Не удалось обновить список избранного.', { cause: error });
  }
}

export async function listUserMessages(userId: number) {
  try {
    const rows = await db
      .select({
        id: messages.id,
        propertyId: messages.propertyId,
        propertyTitle: properties.title,
        senderId: messages.senderId,
        recipientId: messages.recipientId,
        subject: messages.subject,
        body: messages.body,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(properties, eq(messages.propertyId, properties.id))
      .where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)))
      .orderBy(desc(messages.createdAt));

    return rows;
  } catch (error) {
    console.error('Failed to load messages:', error);
    throw new Error('Не удалось загрузить сообщения.', { cause: error });
  }
}

export async function createMessage(input: {
  senderId: number;
  recipientId: number;
  propertyId?: number | null;
  subject: string;
  body: string;
}) {
  try {
    const rows = await db
      .insert(messages)
      .values({
        senderId: input.senderId,
        recipientId: input.recipientId,
        propertyId: input.propertyId ?? null,
        subject: input.subject,
        body: input.body,
      })
      .returning();

    return rows[0];
  } catch (error) {
    console.error('Failed to send message:', error);
    throw new Error('Не удалось отправить сообщение.', { cause: error });
  }
}

export async function getDefaultCuratorId(): Promise<number | null> {
  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.uid, 'estora-curator-uz'))
      .limit(1);
    if (rows[0]) {
      return rows[0].id;
    }
    const anyUser = await db.select({ id: users.id }).from(users).limit(1);
    return anyUser[0]?.id ?? null;
  } catch (error) {
    console.error('Failed to lookup default curator:', error);
    return null;
  }
}

export async function getAdminMetrics() {
  try {
    const [propCounts, userCounts, msgCounts, allResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(properties),
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(messages),
      listProperties({ includeAllStatuses: true, pageSize: 100 }),
    ]);

    return {
      totalProperties: propCounts[0]?.count ?? 0,
      totalUsers: userCounts[0]?.count ?? 0,
      totalMessages: msgCounts[0]?.count ?? 0,
      properties: allResult.properties,
    };
  } catch (error) {
    console.error('Failed to fetch admin metrics:', error);
    throw new Error('Не удалось загрузить данные панели администратора.', { cause: error });
  }
}
