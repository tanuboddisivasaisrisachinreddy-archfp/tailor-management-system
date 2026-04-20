import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, required: true, trim: true },
    notes: { type: String, default: "" },
    paidOn: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const Payment = mongoose.model("Payment", paymentSchema);
