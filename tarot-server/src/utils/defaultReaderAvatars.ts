const DEFAULT_UPLOADS_ORIGIN = 'https://tarot-1.oss-cn-hangzhou.aliyuncs.com';

const DEFAULT_READER_AVATAR_PATHS: Record<string, string> = {
  qinghe: '/uploads/admin/reader-avatar-1782960454614-0bfrh1.webp',
  yanxi: '/uploads/admin/reader-avatar-1782959591352-uasai2.webp',
  haruka: '/uploads/admin/reader-avatar-1782959711684-b5ojao.webp',
  xuanyin: '/uploads/admin/reader-avatar-1782960447799-luqziq.webp',
  mirelle: '/uploads/admin/reader-avatar-1782960641249-80wz1i.webp',
  lingsha: '/uploads/admin/reader-avatar-1782960693213-5qgk04.webp',
  norick: '/uploads/admin/reader-avatar-1782455668968-8q3wwt.png',
  amara: '/uploads/admin/reader-avatar-1782455677013-40p1jo.png',
  vikram: '/uploads/admin/reader-avatar-1782455682918-afvb3n.png',
  catalina: '/uploads/admin/reader-avatar-1782455688279-1af74q.png',
  kazuki: '/uploads/admin/reader-avatar-1782455692476-dold9j.png',
  solveig: '/uploads/admin/reader-avatar-1782455696944-o6bgis.png',
};

function publicUploadsOrigin(): string {
  return (process.env.PUBLIC_UPLOADS_ORIGIN || DEFAULT_UPLOADS_ORIGIN).replace(/\/$/, '');
}

export function getDefaultReaderAvatarUrl(readerCode: string): string | null {
  const path = DEFAULT_READER_AVATAR_PATHS[readerCode];
  if (!path) return null;
  return `${publicUploadsOrigin()}${path}`;
}
