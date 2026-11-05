/** Exact public web reader thumbnails captured on 2026-10-30 for offline mobile fallback. */
import qingheThumb from '../../assets/mobile/readers-web/qinghe-thumb.webp?no-inline'
import yanxiThumb from '../../assets/mobile/readers-web/yanxi-thumb.webp?no-inline'
import harukaThumb from '../../assets/mobile/readers-web/haruka-thumb.webp?no-inline'
import xuanyinThumb from '../../assets/mobile/readers-web/xuanyin-thumb.webp?no-inline'
import mirelleThumb from '../../assets/mobile/readers-web/mirelle-thumb.webp?no-inline'
import lingshaThumb from '../../assets/mobile/readers-web/lingsha-thumb.webp?no-inline'
import norickThumb from '../../assets/mobile/readers-web/norick-thumb.webp?no-inline'
import amaraThumb from '../../assets/mobile/readers-web/amara-thumb.webp?no-inline'
import vikramThumb from '../../assets/mobile/readers-web/vikram-thumb.webp?no-inline'
import catalinaThumb from '../../assets/mobile/readers-web/catalina-thumb.webp?no-inline'
import kazukiThumb from '../../assets/mobile/readers-web/kazuki-thumb.webp?no-inline'
import solveigThumb from '../../assets/mobile/readers-web/solveig-thumb.webp?no-inline'

export const WEB_READER_AVATARS: Readonly<Record<string, string>> = {
  qinghe: qingheThumb,
  yanxi: yanxiThumb,
  haruka: harukaThumb,
  xuanyin: xuanyinThumb,
  mirelle: mirelleThumb,
  lingsha: lingshaThumb,
  norick: norickThumb,
  amara: amaraThumb,
  vikram: vikramThumb,
  catalina: catalinaThumb,
  kazuki: kazukiThumb,
  solveig: solveigThumb,
}

export function getWebReaderAvatar(id: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(WEB_READER_AVATARS, id)
    ? WEB_READER_AVATARS[id]
    : undefined
}
