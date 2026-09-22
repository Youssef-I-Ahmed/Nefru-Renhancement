import mongoose from "mongoose";
import bcrypt from "bcrypt";

const USER_ROLES = ["tourist", "guide", "admin"];
const REGISTER_ROLES = ["tourist", "guide"];
const AUTH_PROVIDERS = ["local", "google"];

const userSchema = new mongoose.Schema(
  {
    bookingFence:{type:Number,default:0},
    accountStatus: {type:String,enum:['active','deactivated_by_user','suspended_by_admin','deletion_requested','closed','anonymized'],index:true},
    statusSource:{type:String,enum:['user','admin','system']}, statusReason:{type:String,default:'',select:false}, statusChangedAt:Date,
    statusChangedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}, retentionUntil:Date, anonymizationEligibleAt:Date,
    legalHold:{type:Boolean,default:false}, operationalHold:{type:Boolean,default:false},
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
      required() {
        return this.authProviders?.includes("local");
      },
    },
    authProviders: {
      type: [String],
      enum: AUTH_PROVIDERS,
      default: ["local"],
    },
    googleSub: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "pending", "deactivated"],
      default: "active",
      index: true,
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "roleProfile",
    },
    roleProfile: {
      type: String,
      enum: ["TouristProfile", "GuideProfile"],
      required() {
        return this.role !== "admin";
      },
    },
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    mergedInto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      select: false,
      index: true,
    },
    mergedAt: {
      type: Date,
      default: null,
      select: false,
    },
    stripeCustomerId: {
      type: String,
      default: "",
      select: false,
      index: true,
    },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
  this.passwordChangedAt = new Date();
});

userSchema.methods.comparePassword = async function (matchedPassword) {
  if (!this.password || !matchedPassword) return false;
  return bcrypt.compare(matchedPassword, this.password);
};

export const User = mongoose.model("User", userSchema);
export { USER_ROLES, REGISTER_ROLES, AUTH_PROVIDERS };
