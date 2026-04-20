import { Customer } from "../models/Customer.js";
import { Measurement } from "../models/Measurement.js";
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { User } from "../models/User.js";

export async function seedDatabase() {
  const userCount = await User.countDocuments();
  if (!userCount) {
    await User.create({
      username: "admin",
      fullName: "Shop Admin",
      passwordHash: User.hashPassword("admin123"),
    });
  }

  const customerCount = await Customer.countDocuments();
  if (customerCount) return;

  const customers = await Customer.create([
    {
      fullName: "Asha Reddy",
      phone: "9876543210",
      address: "Banjara Hills, Hyderabad",
      gender: "Female",
      notes: "Prefers soft cotton fabrics.",
    },
    {
      fullName: "Rahul Kumar",
      phone: "9123456780",
      address: "Vijay Nagar, Bengaluru",
      gender: "Male",
      notes: "Needs office wear alterations.",
    },
  ]);

  await Measurement.create([
    {
      customerId: customers[0]._id,
      chest: 36,
      waist: 30,
      shoulder: 15,
      sleeveLength: 22,
      hip: 38,
      neck: 14,
      length: 44,
      notes: "Kurta measurements from last visit.",
    },
    {
      customerId: customers[1]._id,
      chest: 40,
      waist: 34,
      shoulder: 18,
      sleeveLength: 24,
      hip: 40,
      neck: 15,
      length: 42,
      notes: "Slim fit shirt profile.",
    },
  ]);

  const orders = await Order.create([
    {
      customerId: customers[0]._id,
      clothingType: "Kurta",
      stitchingDetails: "Blue linen kurta with side pockets",
      deliveryDate: new Date(),
      price: 1600,
      status: "Pending",
    },
    {
      customerId: customers[1]._id,
      clothingType: "Formal Shirt",
      stitchingDetails: "White shirt alteration with taper fit",
      deliveryDate: new Date(),
      price: 950,
      status: "In Progress",
    },
  ]);

  await Payment.create([
    {
      orderId: orders[0]._id,
      amount: 600,
      method: "Cash",
      notes: "Advance received",
    },
    {
      orderId: orders[1]._id,
      amount: 950,
      method: "UPI",
      notes: "Full payment settled",
    },
  ]);
}
