import mongoose from "mongoose";
import { USER_ROLES } from "../../constants/constants.js";

const MESSAGE_STATUS = {
  DELIVERED: "DELIVERED",
  SEEN: "SEEN",
};

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderType: {
      type: String,
      enum: Object.values(USER_ROLES).map((v) => v.value),
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: (doc) => {
        if (doc.senderType === USER_ROLES.ADMIN.value || doc.senderType === USER_ROLES.SUPPORT_AGENT.value) {
          return 'Agent';
        } else if (doc.senderType === USER_ROLES.VISITOR.value) {
          return 'Visitor';
        }
      }
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(MESSAGE_STATUS),
      default: MESSAGE_STATUS.DELIVERED,
    },
    seenAt: {
      type: Date,
      default: null,
    },
    seenById: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    seenByRole: {
      type: String,
      enum: Object.values(USER_ROLES).map((v) => v.value),
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, status: 1 });

export const getMessageModel = (tenantConnection) => {
  if (tenantConnection.models.Message) return tenantConnection.models.Message;
  return tenantConnection.model('Message', messageSchema);
}