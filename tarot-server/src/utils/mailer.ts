import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

function smtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST?.trim() && env.SMTP_FROM?.trim());
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!smtpConfigured()) {
    if (env.NODE_ENV === 'development') {
      console.warn('[mailer] SMTP 未配置，跳过重置邮件。开发环境重置链接:', resetUrl);
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });

  const subject = '重置您的 E-Tomd 密码';
  const text = `您好，\n\n请点击以下链接重置密码（${env.PASSWORD_RESET_EXPIRES_HOURS} 小时内有效）：\n\n${resetUrl}\n\n若您未申请重置，请忽略本邮件。\n`;
  const html = `<p>您好，</p><p>请点击以下链接重置密码（<strong>${env.PASSWORD_RESET_EXPIRES_HOURS}</strong> 小时内有效）：</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>若您未申请重置，请忽略本邮件。</p>`;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}
