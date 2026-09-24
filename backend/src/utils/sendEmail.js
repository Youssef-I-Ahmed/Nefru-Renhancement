// import {emailShell} from './authEmailTemplates.js';
// import nodemailer from "nodemailer";
// import { env } from "../config/env.js";

// let transporter;

// function getTransporter() {
//   if (!env.mailerEmail || !env.mailerPassword) {
//     throw new Error("Mailer credentials are not configured");
//   }

//   if (!transporter) {
//     transporter = nodemailer.createTransport({
//       host: env.mailerHost,
//       port: env.mailerPort,
//       secure: env.mailerPort === 465,
//       auth: {
//         user: env.mailerEmail,
//         pass: env.mailerPassword,
//       },
//     });
//   }

//   return transporter;
// }

// export const sendEmail = async (options) => {
//   const mailOptions = {
//     from: `Nefru <${env.mailerEmail}>`,
//     to: options.email,
//     subject: options.subject,
//     text: options.message,
//     html: options.html || emailShell({title:options.subject,eyebrow:'NEFRU',preheader:options.subject,content:'<p>'+String(options.message||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</p>'}),
//   };

//   await getTransporter().sendMail(mailOptions);
// };
import nodemailer from "nodemailer";

import { env } from "../config/env.js";
import { emailShell } from "./authEmailTemplates.js";

let transporter;

function getTransporter() {
  if (!env.mailerEmail || !env.mailerPassword) {
    throw new Error("Mailer credentials are not configured");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mailerHost,
      port: env.mailerPort,
      secure: env.mailerPort === 465,
      auth: {
        user: env.mailerEmail,
        pass: env.mailerPassword,
      },
    });
  }

  return transporter;
}

async function sendWithResend(options) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.mailerFrom,
      to: [options.email],
      subject: options.subject,
      text: options.message || "",
      html:
        options.html ||
        emailShell({
          title: options.subject,
          eyebrow: "NEFRU",
          preheader: options.subject,
          content:
            "<p>" +
            String(options.message || "").replace(
              /[&<>]/g,
              (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
            ) +
            "</p>",
        }),
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error?.message ||
        `Resend request failed with status ${response.status}`,
    );
  }

  return data;
}

export const sendEmail = async (options) => {
  if (env.resendApiKey) {
    return sendWithResend(options);
  }

  const mailOptions = {
    from: `Nefru <${env.mailerEmail}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html:
      options.html ||
      emailShell({
        title: options.subject,
        eyebrow: "NEFRU",
        preheader: options.subject,
        content:
          "<p>" +
          String(options.message || "").replace(
            /[&<>]/g,
            (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c],
          ) +
          "</p>",
      }),
  };

  return getTransporter().sendMail(mailOptions);
};