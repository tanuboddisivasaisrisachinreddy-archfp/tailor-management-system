import mongoose from "mongoose";

const measurementSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, unique: true },
    chest: { type: Number, default: 0 },
    waist: { type: Number, default: 0 },
    shoulder: { type: Number, default: 0 },
    sleeveLength: { type: Number, default: 0 },
    hip: { type: Number, default: 0 },
    neck: { type: Number, default: 0 },
    length: { type: Number, default: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Measurement = mongoose.model("Measurement", measurementSchema);
