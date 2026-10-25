import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["admin", "hr", "employee"],
      default: "employee",
    },
    firstName: {
      type: String,
      default: "",
    },
    lastName: {
      type: String,
      default: "",
    },
    employeeCode: {
      type: String,
      default: "",
      trim: true,
    },
    department: {
      type: String,
      default: "",
    },
    designation: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      default: "Active",
    },
    joiningDate: {
      type: Date,
      default: null,
    },
    terminationDate: { type: Date, default: null },
    salary: {
      type: Number,
      default: 0,
    },
    phoneNumber: { type: String, default: "" },
    location: { type: String, default: "" },
    employmentType: { type: String, default: "Full-time" },
    manager: { type: String, default: "" },
    isTempPassword: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
