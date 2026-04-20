import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    gender: { type: String, default: "Not specified" },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Customer = mongoose.model("Customer", customerSchema);
