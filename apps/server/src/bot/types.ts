import type { Context, SessionFlavor } from 'grammy';
import type { ConversationFlavor } from '@grammyjs/conversations';

export interface SessionData {
  dbUserId?: string;
  awaitingTerms?: boolean;
  // Purchase / charge flow drafts (set before entering a conversation).
  purchaseProductId?: string;
  discountCode?: string;
  ticketDeptId?: string;
  replyTicketId?: string;
  // Admin flows.
  adminTargetUserId?: string;
  adminBalanceMode?: 'add' | 'sub';
  adminRejectTxId?: string;
  adminMsgUserId?: string;
  broadcastTarget?: 'ALL' | 'ACTIVE' | 'INACTIVE';
  // Multi-step text input states (handled by textState handler).
  awaitingDiscount?: string;
  awaitingGift?: boolean;
  awaitingSetting?: string;
  adminPanelStep?: number;
  adminPanelDraft?: { name?: string; url?: string; username?: string; password?: string };
  awaitingChannel?: boolean;
}

type BaseContext = Context & SessionFlavor<SessionData>;

export type BotContext = BaseContext & ConversationFlavor<BaseContext>;
