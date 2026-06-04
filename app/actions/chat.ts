"use server";

import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function fetchChatMessages(userId1: number, userId2: number) {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ]
      },
      orderBy: { sentAt: "asc" },
    });
    
    // Serialize date objects for client components
    return messages.map(m => ({
      ...m,
      sentAt: m.sentAt.toISOString()
    }));
  } catch (error) {
    console.error("fetchChatMessages error:", error);
    return [];
  }
}

export async function sendChatMessage(senderId: number, receiverId: number, message: string) {
  try {
    const msg = await prisma.chatMessage.create({
      data: {
        senderId,
        receiverId,
        message,
      }
    });
    
    // Auto-create a notification for the receiver if not broadcast
    if (receiverId !== 0) {
      const sender = await prisma.user.findUnique({ where: { id: senderId } });
      const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
      if (sender && receiver) {
        let preview = message;
        if (message.startsWith("[img:")) preview = "📷 Image attachment";
        else if (message.startsWith("[file:")) preview = "📄 File attachment";
        else if (message.length > 80) preview = message.slice(0, 80) + "...";
        
        await prisma.notification.create({
          data: {
            title: `💬 New message from ${sender.name}`,
            body: preview,
            icon: "💬",
            targetEmail: receiver.email
          }
        });
      }
    }
    
    revalidatePath("/dashboard/chat");
    return { success: true, message: { ...msg, sentAt: msg.sentAt.toISOString() } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteChatMessage(id: number) {
  try {
    const msg = await prisma.chatMessage.findUnique({ where: { id } });
    if (msg) {
      if (msg.receiverId !== 0) {
        const sender = await prisma.user.findUnique({ where: { id: msg.senderId } });
        const receiver = await prisma.user.findUnique({ where: { id: msg.receiverId } });
        if (sender && receiver) {
          let preview = msg.message;
          if (msg.message.startsWith("[img:")) preview = "📷 Image attachment";
          else if (msg.message.startsWith("[file:")) preview = "📄 File attachment";
          else if (msg.message.length > 80) preview = msg.message.slice(0, 80) + "...";

          await prisma.notification.deleteMany({
            where: {
              title: `💬 New message from ${sender.name}`,
              body: preview,
              icon: "💬",
              targetEmail: receiver.email
            }
          });
        }
      }
      await prisma.chatMessage.delete({ where: { id } });
    }
    revalidatePath("/dashboard/chat");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchGroupMessages(groupId: number) {
  try {
    const messages = await prisma.groupMessage.findMany({
      where: { groupId },
      orderBy: { sentAt: "asc" }
    });
    return messages.map(m => ({
      ...m,
      sentAt: m.sentAt.toISOString()
    }));
  } catch (error) {
    console.error("fetchGroupMessages error:", error);
    return [];
  }
}

export async function sendGroupMessage(groupId: number, senderEmail: string, message: string) {
  try {
    const msg = await prisma.groupMessage.create({
      data: {
        groupId,
        sender: senderEmail,
        message
      }
    });

    // Notify all members of the group except the sender
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    const senderUser = await prisma.user.findFirst({ where: { email: senderEmail } });
    
    if (group && senderUser) {
      let members: string[] = [];
      try {
        members = JSON.parse(group.members || "[]");
      } catch {}

      let preview = message;
      if (message.startsWith("[img:")) preview = "📷 Image attachment";
      else if (message.startsWith("[file:")) preview = "📄 File attachment";
      else if (message.length > 80) preview = message.slice(0, 80) + "...";

      for (const email of members) {
        if (email && typeof email === "string" && email.toLowerCase().trim() !== senderEmail.toLowerCase().trim()) {
          await prisma.notification.create({
            data: {
              title: `💬 ${senderUser.name} in ${group.name}`,
              body: preview,
              icon: "💬",
              targetEmail: email.trim()
            }
          });
        }
      }
    }

    revalidatePath("/dashboard/chat");
    return { success: true, message: { ...msg, sentAt: msg.sentAt.toISOString() } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGroupMessage(id: number) {
  try {
    const msg = await prisma.groupMessage.findUnique({ where: { id } });
    if (msg) {
      const senderUser = msg.sender 
        ? await prisma.user.findFirst({ where: { email: msg.sender } })
        : null;
      const group = await prisma.group.findUnique({ where: { id: msg.groupId } });
      
      if (group && senderUser) {
        let preview = msg.message;
        if (msg.message.startsWith("[img:")) preview = "📷 Image attachment";
        else if (msg.message.startsWith("[file:")) preview = "📄 File attachment";
        else if (msg.message.length > 80) preview = msg.message.slice(0, 80) + "...";

        await prisma.notification.deleteMany({
          where: {
            title: `💬 ${senderUser.name} in ${group.name}`,
            body: preview,
            icon: "💬"
          }
        });
      }
      await prisma.groupMessage.delete({ where: { id } });
    }
    revalidatePath("/dashboard/chat");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchConversations(userId: number, userEmail: string) {
  try {
    const chatMsgs = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      orderBy: { sentAt: "asc" }
    });

    const groupMsgs = await prisma.groupMessage.findMany({
      orderBy: { sentAt: "asc" }
    });

    const conversations: Record<string, { unreadCount: number, lastMessageAt: string, lastMessagePreview: string }> = {};

    for (const msg of chatMsgs) {
      const contactId = msg.senderId === userId ? `user_${msg.receiverId}` : `user_${msg.senderId}`;
      if (!conversations[contactId]) {
        conversations[contactId] = { unreadCount: 0, lastMessageAt: "", lastMessagePreview: "" };
      }
      conversations[contactId].lastMessageAt = msg.sentAt.toISOString();
      let preview = msg.message;
      if (preview.startsWith("[img:")) preview = "📷 Image";
      if (preview.startsWith("[file:")) preview = "📄 File";
      conversations[contactId].lastMessagePreview = preview;

      if (msg.receiverId === userId && !msg.read) {
        conversations[contactId].unreadCount++;
      }
    }

    for (const msg of groupMsgs) {
      const contactId = `group_${msg.groupId}`;
      if (!conversations[contactId]) {
        conversations[contactId] = { unreadCount: 0, lastMessageAt: "", lastMessagePreview: "" };
      }
      conversations[contactId].lastMessageAt = msg.sentAt.toISOString();
      let preview = msg.message;
      if (preview.startsWith("[img:")) preview = "📷 Image";
      if (preview.startsWith("[file:")) preview = "📄 File";
      conversations[contactId].lastMessagePreview = preview;

      let readBy: number[] = [];
      try {
        readBy = JSON.parse(msg.readBy || "[]");
      } catch {}
      
      if (msg.sender && msg.sender.toLowerCase().trim() !== userEmail.toLowerCase().trim() && !readBy.includes(userId)) {
        conversations[contactId].unreadCount++;
      }
    }

    return conversations;
  } catch (error) {
    console.error("fetchConversations error:", error);
    return {};
  }
}

export async function markMessagesAsRead(contactId: string, userId: number) {
  try {
    if (contactId.startsWith("user_")) {
      const peerId = parseInt(contactId.replace("user_", ""));
      await prisma.chatMessage.updateMany({
        where: {
          senderId: peerId,
          receiverId: userId,
          read: false
        },
        data: {
          read: true
        }
      });
    } else if (contactId.startsWith("group_")) {
      const groupId = parseInt(contactId.replace("group_", ""));
      const unreadMsgs = await prisma.groupMessage.findMany({
        where: { groupId }
      });
      
      for (const msg of unreadMsgs) {
        let readBy: number[] = [];
        try { readBy = JSON.parse(msg.readBy || "[]"); } catch {}
        if (!readBy.includes(userId)) {
          readBy.push(userId);
          await prisma.groupMessage.update({
            where: { id: msg.id },
            data: { readBy: JSON.stringify(readBy) }
          });
        }
      }
    }
    revalidatePath("/dashboard/chat");
    return { success: true };
  } catch (error) {
    console.error("markMessagesAsRead error", error);
    return { success: false };
  }
}

export const markConversationAsRead = markMessagesAsRead;

export async function deleteConversation(userId1: number, userId2: number) {
  try {
    const user1 = await prisma.user.findUnique({ where: { id: userId1 } });
    const user2 = await prisma.user.findUnique({ where: { id: userId2 } });
    if (user1 && user2) {
      await prisma.notification.deleteMany({
        where: {
          OR: [
            {
              title: `💬 New message from ${user1.name}`,
              targetEmail: user2.email,
              icon: "💬"
            },
            {
              title: `💬 New message from ${user2.name}`,
              targetEmail: user1.email,
              icon: "💬"
            }
          ]
        }
      });
    }

    await prisma.chatMessage.deleteMany({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ]
      }
    });
    revalidatePath("/dashboard/chat");
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (error: any) {
    console.error("deleteConversation error", error);
    return { success: false, error: error.message };
  }
}

