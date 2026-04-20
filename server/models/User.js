import crypto from "crypto";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

userSchema.statics.hashPassword = function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
};

export const User = mongoose.model("User", userSchema);
