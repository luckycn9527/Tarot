import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/** 邮件发件人显示名，收件箱中显示为「E-Tomd」而非裸 QQ 号 */
const FROM_NAME = 'E-Tomd';

function smtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST?.trim() && env.SMTP_FROM?.trim());
}

function createTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
}

function fromAddress(): string {
  return `"${FROM_NAME}" <${env.SMTP_FROM}>`;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!smtpConfigured()) {
    if (env.NODE_ENV === 'development') {
      console.warn('[mailer] SMTP 未配置，跳过重置邮件。开发环境重置链接:', resetUrl);
    }
    return;
  }

  const subject = '重置您的 E-Tomd 密码';
  const text = `您好，\n\n请点击以下链接重置密码（${env.PASSWORD_RESET_EXPIRES_HOURS} 小时内有效）：\n\n${resetUrl}\n\n若您未申请重置，请忽略本邮件。\n`;
  const html = `<p>您好，</p><p>请点击以下链接重置密码（<strong>${env.PASSWORD_RESET_EXPIRES_HOURS}</strong> 小时内有效）：</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>若您未申请重置，请忽略本邮件。</p>`;

  await createTransporter().sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  });
}

export async function sendRegisterVerificationEmail(to: string, code: string): Promise<void> {
  if (!smtpConfigured()) {
    if (env.NODE_ENV === 'development') {
      console.warn('[mailer] SMTP 未配置，跳过注册验证码邮件。开发环境验证码:', code);
    }
    return;
  }

  const subject = '您的 E-Tomd 注册验证码';
  const text = `您好，\n\n您的注册验证码是：${code}\n\n验证码 10 分钟内有效，请勿泄露给他人。\n若您未申请注册，请忽略本邮件。\n`;
  const html = `<p>您好，</p>
    <p>您的注册验证码是：</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
    <p>验证码 <strong>10 分钟</strong> 内有效，请勿泄露给他人。</p>
    <p>若您未申请注册，请忽略本邮件。</p>`;

  await createTransporter().sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  });
}
