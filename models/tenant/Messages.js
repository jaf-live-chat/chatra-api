import mongoose from "mongoose";
import { USER_ROLES } from "../../constants/constants.js";

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
    }
  },
  {
    timestamps: true,
  }
)

export const getMessageModel = (tenantConnection) => {
  if (tenantConnection.models.Message) return tenantConnection.models.Message;
  return tenantConnection.model('Message', messageSchema);
}