import mongoose from "mongoose";
import { CONVERSATION_STATUS } from "../../constants/constants.js";

const conversationSchema = new mongoose.Schema(
  {
    visitorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Visitor',
      required: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(CONVERSATION_STATUS),
    }
  },
  {
    timestamps: true,
  }
)

export const getConversationModel = (tenantConnection) => {
  if (tenantConnection.models.Conversations) return tenantConnection.models.Conversations;
  return tenantConnection.model('Conversation', conversationSchema);
}