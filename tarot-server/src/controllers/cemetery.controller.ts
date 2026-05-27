import type { Request, Response } from 'express';
import * as CemeteryService from '../services/cemetery.service.js';
import { success, fail } from '../utils/response.js';

const VALID_BASES = ['standard', 'wide', 'tiered'];
const VALID_BODIES = ['slab', 'pillar', 'obelisk', 'dome', 'crystal'];
const VALID_TOPS = ['none', 'cross', 'sphere', 'spike'];
const VALID_COLORS = ['purple', 'cyan', 'pink', 'amber', 'green', 'blue'];
const LEGACY_SHAPES = ['cross', 'obelisk', 'round', 'angel', 'gothic', 'modern', 'cyber', 'ancient'];

function isValidTombstoneStyle(style: string): boolean {
  if (!style || typeof style !== 'string' || style.length > 50) return false;
  const parts = style.split('-');
  if (parts.length === 4) {
    return VALID_BASES.includes(parts[0]) && VALID_BODIES.includes(parts[1])
      && VALID_TOPS.includes(parts[2]) && VALID_COLORS.includes(parts[3]);
  }
  if (parts.length === 2) {
    return LEGACY_SHAPES.includes(parts[0]) && VALID_COLORS.includes(parts[1]);
  }
  if (parts.length === 1) {
    return LEGACY_SHAPES.includes(parts[0]);
  }
  return false;
}

/** GET /api/cemetery/markers */
export async function getMarkers(_req: Request, res: Response) {
  try {
    const markers = await CemeteryService.getAllMarkers();
    res.json(success(markers));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '获取标记失败';
    res.status(500).json(fail(msg));
  }
}

/** GET /api/cemetery/tombstones/me */
export async function getMyTombstone(req: Request, res: Response) {
  try {
    const tombstone = await CemeteryService.getMyTombstone(req.userId!);
    res.json(success(tombstone));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '获取墓碑失败';
    res.status(500).json(fail(msg));
  }
}

/** GET /api/cemetery/tombstones/:id */
export async function getTombstoneById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) {
      res.status(400).json(fail('无效的墓碑ID'));
      return;
    }
    const tombstone = await CemeteryService.getTombstoneDetail(id);
    if (!tombstone) {
      res.status(404).json(fail('墓碑不存在'));
      return;
    }
    res.json(success(tombstone));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '获取墓碑详情失败';
    res.status(500).json(fail(msg));
  }
}

/** GET /api/cemetery/position-check?lng=&lat= */
export async function checkPosition(req: Request, res: Response) {
  try {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      res.status(400).json(fail('坐标参数无效'));
      return;
    }
    const result = await CemeteryService.checkPosition(lng, lat);
    res.json(success(result));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '位置检查失败';
    res.status(500).json(fail(msg));
  }
}

/** POST /api/cemetery/divination */
export async function performDivination(req: Request, res: Response) {
  try {
    const { tarotCardId, lines } = req.body;
    if (tarotCardId === undefined || !Array.isArray(lines) || lines.length !== 6) {
      res.status(400).json(fail('请提供 tarotCardId 和 6 爻 lines 数组'));
      return;
    }
    const result = await CemeteryService.performDivination(req.userId!, tarotCardId, lines);
    res.json(success(result));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '占卜失败';
    res.status(400).json(fail(msg));
  }
}

/** POST /api/cemetery/tombstones */
export async function createTombstone(req: Request, res: Response) {
  try {
    const { longitude, latitude, tombstoneStyle, displayName, epitaph, tarotCardId, hexagramId } = req.body;

    if (longitude === undefined || latitude === undefined || !displayName || !tombstoneStyle) {
      res.status(400).json(fail('缺少必填字段'));
      return;
    }
    if (!isValidTombstoneStyle(tombstoneStyle)) {
      res.status(400).json(fail('无效的墓碑样式'));
      return;
    }
    if (displayName.length > 50) {
      res.status(400).json(fail('名称不能超过50个字符'));
      return;
    }
    if (epitaph && epitaph.length > 200) {
      res.status(400).json(fail('墓志铭不能超过200个字符'));
      return;
    }

    if (typeof longitude !== 'number' || typeof latitude !== 'number'
      || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      res.status(400).json(fail('坐标参数无效'));
      return;
    }

    const tombstone = await CemeteryService.createTombstone(req.userId!, {
      longitude,
      latitude,
      tombstoneStyle,
      displayName,
      epitaph: epitaph || null,
      tarotCardId: tarotCardId ?? null,
      hexagramId: hexagramId ?? null,
    });
    res.status(201).json(success(tombstone, '墓碑创建成功'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '墓碑创建失败';
    res.status(400).json(fail(msg));
  }
}

/** DELETE /api/cemetery/tombstones/me */
export async function deleteMyTombstone(req: Request, res: Response) {
  try {
    await CemeteryService.deleteMyTombstone(req.userId!);
    res.json(success(null, '墓碑已删除'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '墓碑删除失败';
    res.status(400).json(fail(msg));
  }
}

/** PUT /api/cemetery/tombstones/me */
export async function updateMyTombstone(req: Request, res: Response) {
  try {
    const { displayName, epitaph } = req.body;
    if (displayName !== undefined && (typeof displayName !== 'string' || displayName.length > 50)) {
      res.status(400).json(fail('名称不能超过50个字符'));
      return;
    }
    if (epitaph !== undefined && epitaph !== null && (typeof epitaph !== 'string' || epitaph.length > 200)) {
      res.status(400).json(fail('墓志铭不能超过200个字符'));
      return;
    }
    const tombstone = await CemeteryService.updateMyTombstone(req.userId!, {
      displayName,
      epitaph,
    });
    res.json(success(tombstone, '墓碑更新成功'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '墓碑更新失败';
    res.status(400).json(fail(msg));
  }
}
