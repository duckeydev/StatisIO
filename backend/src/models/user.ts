import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  monitorIds: [{ type: String }] 
});

userSchema.pre("save", function () {
  this.updatedAt = new Date();
});

userSchema.set('toJSON', {
  transform: (doc, ret: Record<string, unknown>) => {
    delete ret['passwordHash']; 
    return ret;
  }
});

export default mongoose.model("User", userSchema);