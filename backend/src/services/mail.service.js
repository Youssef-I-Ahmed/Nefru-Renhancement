import { emailShell } from "../utils/authEmailTemplates.js";
import { sendEmail } from "../utils/sendEmail.js";
const escape = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function renderTransactionalEmail({
  title,
  message,
  url,
  cta = "Open NEFRU",
}) {
  let link = "";
  if (url) {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol))
      throw new Error("Invalid email link");
    link = `<p><a href="${escape(parsed.href)}" style="background:#123249;color:#fff;padding:12px 20px;text-decoration:none">${escape(cta)}</a></p>`;
  }
  return emailShell({
    preheader: title,
    eyebrow: "NEFRU",
    title,
    content:
      '<p style="white-space:pre-line">' + escape(message) + "</p>" + link,
  });
}
export async function sendTransactionalEmail({ to, template, data }) {
  const title =
    data.title ||
    {
      "review-invitation": "How was your experience?",
      "reset-password": "Reset your NEFRU password",
    }[template] ||
    "NEFRU update";
  await sendEmail({
    email: to,
    subject: title,
    message: data.message,
    html: renderTransactionalEmail({ ...data, title }),
  });
}
