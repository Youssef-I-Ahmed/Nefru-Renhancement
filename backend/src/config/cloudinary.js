import { v2 as cloudinary } from "cloudinary";

import { env } from "./env.js";

function configureFromUrl(value) {
  const match = String(value || "").match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) return false;
  cloudinary.config({
    api_key: decodeURIComponent(match[1]),
    api_secret: decodeURIComponent(match[2]),
    cloud_name: decodeURIComponent(match[3]),
    secure: true,
  });
  return true;
}

const explicitCredentials = [env.cloudinaryCloudName, env.cloudinaryApiKey, env.cloudinaryApiSecret];
if (explicitCredentials.some(Boolean) && !explicitCredentials.every(Boolean)) {
  throw new Error("Set all CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET variables, or use CLOUDINARY_URL alone.");
}

if (explicitCredentials.every(Boolean)) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
} else if (!configureFromUrl(env.cloudinaryUrl)) {
  cloudinary.config({ secure: true });
}

export function isCloudinaryConfigured() {
  const config = cloudinary.config();
  return Boolean(config.cloud_name && config.api_key && config.api_secret);
}

export { cloudinary };
