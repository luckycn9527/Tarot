import * as CemeteryModel from '../models/cemetery.model.js';
import { hexagrams, findHexagramByLines } from '../data/iching.js';
import { cacheGet, cacheSet, cacheDel, CACHE_KEYS } from './cacheRedis.service.js';

const MARKERS_CACHE_TTL_SEC = 300;
const POSITION_CACHE_TTL_SEC = 15;

// 经纬度常量（替代旧的像素坐标常量）
const LNG_RANGE = 360;   // 经度范围 -180 ~ 180
const LAT_RANGE = 180;   // 纬度范围 -90 ~ 90
const GRID_COLS = 8;
const GRID_ROWS = 8;
const CELL_LNG = LNG_RANGE / GRID_COLS;   // 45°
const CELL_LAT = LAT_RANGE / GRID_ROWS;   // 22.5°

/**
 * 执行占卜：塔罗牌 + 周易 → 推荐区域（经纬度）
 */
export async function performDivination(userId: number, tarotCardId: number, lines: number[]) {
  // 已有墓碑则拒绝
  if (await CemeteryModel.userHasTombstone(userId)) {
    throw new Error('你已有墓碑，无法再次占卜');
  }

  // 查找卦象
  const hexagram = findHexagramByLines(lines);
  if (!hexagram) {
    throw new Error('无效的卦象');
  }

  // 卦象 → 8×8 网格单元
  const cellCol = hexagram.gridCol;
  const cellRow = hexagram.gridRow;

  // 塔罗牌 cardId % 4 → 四象限细分
  const quadrant = tarotCardId % 4;
  const qx = quadrant % 2;       // 0 or 1
  const qy = Math.floor(quadrant / 2); // 0 or 1

  // 计算推荐区域（经纬度）
  const halfLng = CELL_LNG / 2;   // 22.5°
  const halfLat = CELL_LAT / 2;   // 11.25°

  const minLng = cellCol * CELL_LNG - 180 + qx * halfLng;
  const maxLng = minLng + halfLng;
  const maxLat = 90 - (cellRow * CELL_LAT + qy * halfLat);
  const minLat = maxLat - halfLat;

  return {
    hexagram: {
      id: hexagram.id,
      name: hexagram.name,
      symbol: hexagram.symbol,
      meaning: hexagram.meaning,
      lines: hexagram.lines,
    },
    tarotCardId,
    region: {
      minLng,
      maxLng,
      minLat,
      maxLat,
    },
  };
}

/**
 * 创建墓碑
 */
export async function createTombstone(userId: number, data: {
  longitude: number;
  latitude: number;
  tombstoneStyle: string;
  displayName: string;
  epitaph: string | null;
  tarotCardId: number | null;
  hexagramId: number | null;
}) {
  // 校验：一用户一墓碑
  if (await CemeteryModel.userHasTombstone(userId)) {
    throw new Error('每位用户只能创建一个墓碑');
  }

  // 校验：坐标范围
  if (data.longitude < -180 || data.longitude > 180 || data.latitude < -90 || data.latitude > 90) {
    throw new Error('坐标超出地图范围');
  }

  // 校验：坐标未被占用
  if (await CemeteryModel.isPositionOccupied(data.longitude, data.latitude)) {
    throw new Error('该位置已被其他墓碑占据');
  }

  const id = await CemeteryModel.create({
    userId,
    ...data,
  });

  await cacheDel(CACHE_KEYS.cemeteryMarkers);
  return CemeteryModel.findById(id);
}

/**
 * 获取所有墓碑标记（读多写少，优先走 Redis）
 */
export async function getAllMarkers() {
  const key = CACHE_KEYS.cemeteryMarkers;
  const cached = await cacheGet<Awaited<ReturnType<typeof CemeteryModel.findAllMarkers>>>(key);
  if (cached) return cached;
  const rows = await CemeteryModel.findAllMarkers();
  await cacheSet(key, rows, MARKERS_CACHE_TTL_SEC);
  return rows;
}

/**
 * 获取墓碑详情（+1浏览量）
 */
export async function getTombstoneDetail(id: number) {
  const tombstone = await CemeteryModel.findById(id);
  if (!tombstone) {
    throw new Error('墓碑不存在');
  }
  await CemeteryModel.incrementViewCount(id);
  return tombstone;
}

/**
 * 获取我的墓碑
 */
export async function getMyTombstone(userId: number) {
  return CemeteryModel.findByUserId(userId);
}

/**
 * 更新我的墓碑
 */
export async function updateMyTombstone(userId: number, data: {
  displayName?: string;
  epitaph?: string | null;
}) {
  const updated = await CemeteryModel.update(userId, data);
  if (!updated) {
    throw new Error('墓碑不存在或无更新');
  }
  await cacheDel(CACHE_KEYS.cemeteryMarkers);
  return CemeteryModel.findByUserId(userId);
}

/**
 * 删除我的墓碑
 */
export async function deleteMyTombstone(userId: number) {
  const deleted = await CemeteryModel.deleteByUserId(userId);
  if (!deleted) {
    throw new Error('墓碑不存在');
  }
  await cacheDel(CACHE_KEYS.cemeteryMarkers);
}

/**
 * 检查坐标可用性
 */
export async function checkPosition(lng: number, lat: number) {
  const posKey = `cemetery:pos:${lng.toFixed(2)}:${lat.toFixed(2)}`;
  const cached = await cacheGet<{ longitude: number; latitude: number; available: boolean }>(posKey);
  if (cached) return cached;
  const occupied = await CemeteryModel.isPositionOccupied(lng, lat);
  const payload = { longitude: lng, latitude: lat, available: !occupied };
  await cacheSet(posKey, payload, POSITION_CACHE_TTL_SEC);
  return payload;
}
