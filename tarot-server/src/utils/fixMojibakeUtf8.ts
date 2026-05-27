import { Buffer } from 'node:buffer';

/**
 * 将「曾被当成 Latin-1 读入的 UTF-8 字节序列」还原为正确 UTF-8 字符串。
 * 常见于历史数据在 latin1 连接/列下写入中文，或中间层误转一层。
 * 若字符串已含 BMP 外正常中文（code > 255），直接返回，避免误伤。
 */
export function repairUtf8Mojibake(input: string): string {
  if (!input) return input;
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) > 255) return input;
  }
  try {
    const asUtf8 = Buffer.from(input, 'latin1').toString('utf8');
    if (asUtf8 === input) return input;
    const fffdIn = (input.match(/\uFFFD/g) || []).length;
    const fffdOut = (asUtf8.match(/\uFFFD/g) || []).length;
    if (fffdOut > fffdIn) return input;
    const cjkOut = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(asUtf8);
    const cjkIn = /[\u4e00-\u9fff]/.test(input);
    // UTF-8 三字节中文首字节常见 0xE4–0xE9，被误读为 Latin-1 时多出现 C3/C2/E2 等片段
    const mojibakeHint = /[\u00c3\u00c2\u00e2\u00ef\u00e5\u00e6\u00e7\u00e8\u00e9]/.test(input);
    if (cjkOut && (mojibakeHint || !cjkIn)) return asUtf8;
    return input;
  } catch {
    return input;
  }
}
