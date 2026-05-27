import { z } from 'zod'

/** 使用当前语言的校验文案（由调用方传入 `vue-i18n` 的 `t`） */
export function getLoginFormSchema(t: (key: string) => string) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, t('auth.validation.emailRequired'))
      .email(t('auth.validation.emailInvalid')),
    password: z.string().min(1, t('auth.validation.passwordRequired')),
  })
}

export function getRegisterFormSchema(t: (key: string) => string) {
  return z
    .object({
      email: z
        .string()
        .trim()
        .min(1, t('auth.validation.emailRequired'))
        .email(t('auth.validation.emailInvalid')),
      password: z
        .string()
        .min(6, t('auth.validation.passwordMin'))
        .max(128, t('auth.validation.passwordMax')),
      confirmPassword: z.string().min(1, t('auth.validation.confirmRequired')),
      nickname: z
        .string()
        .trim()
        .min(2, t('auth.validation.nicknameMin'))
        .max(20, t('auth.validation.nicknameMax')),
    })
    .refine(d => d.password === d.confirmPassword, {
      message: t('auth.validation.passwordMismatch'),
      path: ['confirmPassword'],
    })
}

export type LoginFormInput = z.infer<ReturnType<typeof getLoginFormSchema>>
export type RegisterFormInput = z.infer<ReturnType<typeof getRegisterFormSchema>>

export function formatZodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of err.issues) {
    const path = issue.path[0]
    if (typeof path === 'string' && !out[path]) {
      out[path] = issue.message
    }
  }
  return out
}
