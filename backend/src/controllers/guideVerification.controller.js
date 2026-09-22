import {submitGuideVerification} from '../services/marketplace.service.js';
import fs from "fs";

import { isValidObjectId } from "mongoose";

import {
  isValidVerificationFile,
  resolveVerificationFile,
} from "../config/verificationUpload.js";
import { GuideProfile } from "../models/guide.model.js";
import { GuideVerification } from "../models/guideVerification.model.js";
import { Notification } from "../models/notification.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendEmail } from "../utils/sendEmail.js";

const IDENTITY_DOCUMENT_TYPES = new Set(["national_id", "passport"]);

function canEditDocuments(profile, verification) {
  // A submitted packet is immutable until the administrator has reviewed it.
  return !['identity','license'].some(kind => {
    const submitted = verification?.[kind+'SubmittedAt'] || (kind==='identity' ? verification?.submittedAt : null);
    const reviewed = verification?.[kind+'ReviewedAt'] || (kind==='identity' ? verification?.reviewedAt : null);
    return submitted && (!reviewed || submitted > reviewed);
  });
}

async function removeStoredFile(storageKey) {
  if (!storageKey) return;
  await fs.promises.unlink(resolveVerificationFile(storageKey)).catch(() => {});
}



function serializeVerification(guideProfile, verification) {
  return {
    id: verification?._id,
    canEditDocuments: canEditDocuments(guideProfile, verification),
    verificationStatus: guideProfile.verificationStatus,
    identityStatus:guideProfile.identityStatus,licenseStatus:guideProfile.licenseStatus,identityExpiresAt:guideProfile.identityExpiresAt,licenseExpiresAt:guideProfile.licenseExpiresAt,
    rejectionReason: guideProfile.rejectionReason || "",
    documents: (verification?.documents || []).map((document) => ({
      id: document._id,
      documentType: document.documentType,
      originalName: document.originalName,
      mimeType: document.mimeType,
      uploadedAt: document.uploadedAt,
      replacedAt: document.replacedAt,
    })),
    requestedChanges: (verification?.requestedChanges || []).map((change) => ({
      id: change._id,
      documentType: change.documentType,
      message: change.message,
      resolvedAt: change.resolvedAt,
    })),
    submittedAt: verification?.submittedAt || null,
    reviewedAt: verification?.reviewedAt || null,
  };
}

async function getGuideProfile(userId) {
  return GuideProfile.findOne({ user: userId }).select("+rejectionReason");
}

async function getPrivateVerification(guideProfileId) {
  return GuideVerification.findOne({ guideProfile: guideProfileId }).select(
    "+documents +documents.storageKey +requestedChanges +reviewHistory",
  );
}





export const getMyVerification = asyncHandler(async (req, res) => {
  const guideProfile = await getGuideProfile(req.user._id);

  if (!guideProfile) {
    res.status(404);
    throw new Error("Guide profile not found");
  }

  const verification = await getPrivateVerification(guideProfile._id);

  res.status(200).json({
    success: true,
    data: {
      verification: serializeVerification(guideProfile, verification),
    },
  });
});

export const uploadVerificationDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Verification document is required");
  }

  if (!(await isValidVerificationFile(req.file))) {
    await removeStoredFile(req.file.filename);
    res.status(400);
    throw new Error("The uploaded file content is invalid");
  }

  const guideProfile = await getGuideProfile(req.user._id);

  if (!guideProfile) {
    await removeStoredFile(req.file.filename);
    res.status(404);
    throw new Error("Guide profile not found");
  }

  let verification = await getPrivateVerification(guideProfile._id);
  if (!canEditDocuments(guideProfile, verification)) {
    await removeStoredFile(req.file.filename);
    res.status(409);
    throw new Error("Documents cannot be uploaded in the current state");
  }

  if (
    verification?.documents.some(
      (document) => document.documentType === req.body.documentType,
    )
  ) {
    await removeStoredFile(req.file.filename);
    res.status(409);
    throw new Error("This document type already exists; replace it instead");
  }

  const documentData = {
    documentType: req.body.documentType,
    storageKey: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
  };

  try {
    if (!verification) {
      verification = await GuideVerification.create({
        guideProfile: guideProfile._id,
        documents: [documentData],
      });
    } else {
      verification.documents.push(documentData);
      await verification.save();
    }
  } catch (error) {
    await removeStoredFile(req.file.filename);
    throw error;
  }

  res.status(201).json({
    success: true,
    message: "Verification document uploaded successfully",
    data: {
      verification: serializeVerification(guideProfile, verification),
    },
  });
});

export const replaceVerificationDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Replacement document is required");
  }

  if (!(await isValidVerificationFile(req.file))) {
    await removeStoredFile(req.file.filename);
    res.status(400);
    throw new Error("The uploaded file content is invalid");
  }

  if (!isValidObjectId(req.params.documentId)) {
    await removeStoredFile(req.file.filename);
    res.status(400);
    throw new Error("Invalid verification document id");
  }

  const guideProfile = await getGuideProfile(req.user._id);

  if (!guideProfile) {
    await removeStoredFile(req.file.filename);
    res.status(404);
    throw new Error("Guide profile not found");
  }

  const verification = await getPrivateVerification(guideProfile._id);
  if (!canEditDocuments(guideProfile, verification)) {
    await removeStoredFile(req.file.filename);
    res.status(409);
    throw new Error("Documents cannot be changed in the current state");
  }

  const document = verification?.documents.id(req.params.documentId);

  if (!document) {
    await removeStoredFile(req.file.filename);
    res.status(404);
    throw new Error("Verification document not found");
  }

  if (document.documentType !== req.body.documentType) {
    await removeStoredFile(req.file.filename);
    res.status(400);
    throw new Error("Replacement document type must match the original");
  }

  const previousStorageKey = document.storageKey;
  document.storageKey = req.file.filename;
  document.originalName = req.file.originalname;
  document.mimeType = req.file.mimetype;
  document.uploadedAt = new Date();
  document.replacedAt = new Date();

  for (const change of verification.requestedChanges) {
    if (change.documentType === document.documentType && !change.resolvedAt) {
      change.resolvedAt = new Date();
    }
  }

  try {
    await verification.save();
  } catch (error) {
    await removeStoredFile(req.file.filename);
    throw error;
  }

  await removeStoredFile(previousStorageKey);

  res.status(200).json({
    success: true,
    message: "Verification document replaced successfully",
    data: {
      verification: serializeVerification(guideProfile, verification),
    },
  });
});

export const submitVerification=asyncHandler(async(req,res)=>res.json({success:true,data:await submitGuideVerification(req.user,req.body.kind||'identity')}));

export const resubmitVerification=asyncHandler(async(req,res)=>res.json({success:true,data:await submitGuideVerification(req.user,req.body.kind||'identity')}));

export const downloadVerificationDocument = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.documentId)) {
    res.status(400);
    throw new Error("Invalid verification document id");
  }

  let verificationQuery = GuideVerification.findOne({
    "documents._id": req.params.documentId,
  });

  if (req.user.role === "guide") {
    const guideProfile = await GuideProfile.findOne({ user: req.user._id }).select(
      "_id",
    );

    if (!guideProfile) {
      res.status(404);
      throw new Error("Guide profile not found");
    }

    verificationQuery = GuideVerification.findOne({
      guideProfile: guideProfile._id,
      "documents._id": req.params.documentId,
    });
  } else if (req.user.role !== "admin") {
    res.status(403);
    throw new Error("You do not have permission to view this document");
  }

  const verification = await verificationQuery.select(
    "+documents +documents.storageKey",
  );
  const document = verification?.documents.id(req.params.documentId);

  if (!document) {
    res.status(404);
    throw new Error("Verification document not found");
  }

  const filePath = resolveVerificationFile(document.storageKey);

  if (!fs.existsSync(filePath)) {
    res.status(404);
    throw new Error("Stored verification file not found");
  }

  res.download(filePath, document.originalName);
});
