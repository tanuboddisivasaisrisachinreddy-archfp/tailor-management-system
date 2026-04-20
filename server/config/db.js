import mongoose from "mongoose";

export async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tailor_management_system";
  await mongoose.connect(mongoUri);
  return mongoUri;
}
