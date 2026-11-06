export function localDateOnly(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function nicknameInputError(value: string, english = false): string {
  const length = value.trim().length
  return length < 2 || length > 20
    ? english ? 'Use 2–20 characters for your name.' : '昵称请填写 2–20 个字符。'
    : ''
}

export function birthInputError(birthday: string, birthTime: string, unknownTime: boolean, english = false, today = localDateOnly()): string {
  const t = (zh: string, en: string) => english ? en : zh
  if (!birthday) return !unknownTime && birthTime ? t('请先选择出生日期。', 'Choose your birth date first.') : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return t('请选择有效的公历日期。', 'Choose a valid Gregorian date.')
  const [year, month, day] = birthday.split('-').map(Number) as [number, number, number]
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0)
  if (year < 100 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return t('请选择真实有效的出生日期。', 'Choose a real calendar date.')
  if (birthday > today) return t('出生日期不能晚于今天。', 'Your birth date cannot be in the future.')
  if (!unknownTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(birthTime)) return t('请填写出生时刻，或选择“不知道”。', 'Enter a birth time or choose “I don’t know”.')
  return ''
}

/** Square preview and upload share the same center crop; large photos never hit the 2 MB server limit. */
export async function prepareMobileAvatar(file: File, english = false): Promise<File> {
  const t = (zh: string, en: string) => english ? en : zh
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(t('请选择 JPG、PNG 或 WebP 图片。', 'Choose a JPG, PNG or WebP image.'))
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error(t('请选择小于 20 MB 的图片。', 'Choose an image smaller than 20 MB.'))
  const url = URL.createObjectURL(file)
  const image = new Image()
  try {
    image.src = url
    await image.decode().catch(() => { throw new Error(t('无法读取这张图片，请换一张。', 'This image could not be read. Choose another.')) })
    const width = image.naturalWidth, height = image.naturalHeight
    if (!width || !height || width * height > 16_000_000) throw new Error(t('图片像素过大，请选择不超过 1600 万像素的图片。', 'Choose an image of up to 16 megapixels.'))
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512
    const context = canvas.getContext('2d')
    if (!context) throw new Error(t('图片暂时无法处理，请重试。', 'The image could not be prepared. Try again.'))
    const edge = Math.min(width, height)
    context.drawImage(image, (width - edge) / 2, (height - edge) / 2, edge, edge, 0, 0, 512, 512)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .9))
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error(t('图片压缩失败，请换一张图片。', 'The image could not be compressed. Choose another.'))
    const extension = blob.type === 'image/webp' ? 'webp' : 'png'
    return new File([blob], `avatar.${extension}`, { type: blob.type, lastModified: Date.now() })
  } finally { image.src = ''; URL.revokeObjectURL(url) }
}
