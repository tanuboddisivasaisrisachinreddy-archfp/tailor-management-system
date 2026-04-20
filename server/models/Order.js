import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    clothingType: { type: String, required: true, trim: true },
    stitchingDetails: { type: String, required: true, trim: true },
    deliveryDate: { type: Date, required: true },
    price: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Delivered"],
      default: "Pending",
    },
  },
  { timestamps: true },
);

export const Order = mongoose.model("Order", orderSchema);
