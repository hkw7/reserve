import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendBookingConfirmation({
  to,
  name,
  purpose,
  startTime,
  endTime,
}: {
  to: string;
  name: string;
  purpose: string;
  startTime: Date;
  endTime: Date;
}) {
  const fmt = (d: Date) =>
    d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "【予約確認】ご予約を承りました",
    text: `${name} 様\n\n以下の内容で予約を承りました。\n\n日時: ${fmt(startTime)} 〜 ${fmt(endTime)}\n目的: ${purpose}\n\nよろしくお願いいたします。`,
  });
}

export async function sendBookingNotificationToAdmin({
  name,
  email,
  purpose,
  startTime,
  endTime,
}: {
  name: string;
  email: string;
  purpose: string;
  startTime: Date;
  endTime: Date;
}) {
  const fmt = (d: Date) =>
    d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: process.env.ADMIN_EMAIL,
    subject: "【新規予約】予約が入りました",
    text: `新しい予約が入りました。\n\n氏名: ${name}\nメール: ${email}\n日時: ${fmt(startTime)} 〜 ${fmt(endTime)}\n目的: ${purpose}`,
  });
}
