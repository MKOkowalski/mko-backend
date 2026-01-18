import nodemailer from "nodemailer";

export function isMailerConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * sendMail()
 * Zwraca:
 *  - { ok: true, skipped: false, messageId }
 *  - { ok: false, skipped: true }  gdy SMTP nie skonfigurowane
 *  - { ok: false, skipped: false } gdy wysyłka się nie uda
 */
export async function sendMail({ to, subject, text, html }) {
  if (!isMailerConfigured()) {
    console.warn("[MAILER] SMTP not configured -> skipped");
    return { ok: false, skipped: true };
  }

  try {
    const from = process.env.MAIL_FROM || "no-reply@example.com";
    const transporter = getTransport();

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    return { ok: true, skipped: false, messageId: info.messageId };
  } catch (error) {
    console.error("[MAILER] SEND FAILED");
    console.error(error);
    return { ok: false, skipped: false };
  }
}
