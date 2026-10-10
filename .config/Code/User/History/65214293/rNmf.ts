import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body?.object !== "whatsapp_business_account") {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change?.value;

        const phoneNumberId = value?.metadata?.phone_number_id;

        if (!phoneNumberId) {
          continue;
        }

        const connection = await prisma.whatsAppConnection.findUnique({
          where: {
            phoneNumberId,
          },
        });

        if (!connection) {
          console.warn(
            "WhatsApp connection not found:",
            phoneNumberId
          );
          continue;
        }

        const messages = Array.isArray(value?.messages)
          ? value.messages
          : [];

        for (const message of messages) {
          if (!message?.id || !message?.from) {
            continue;
          }

          if (message.type !== "text") {
            continue;
          }

          const text = message.text?.body;

          if (!text) {
            continue;
          }

          const customer = await prisma.customer.upsert({
            where: {
              businessId_waId: {
                businessId: connection.businessId,
                waId: message.from,
              },
            },
            create: {
              businessId: connection.businessId,
              waId: message.from,
              phoneNumber: message.from,
              profileName: value?.contacts?.[0]?.profile?.name ?? null,
            },
            update: {
              profileName:
                value?.contacts?.[0]?.profile?.name ?? undefined,
            },
          });

          const conversation =
            await prisma.conversation.findFirst({
              where: {
                businessId: connection.businessId,
                customerId: customer.id,
                whatsappConnectionId: connection.id,
                status: "OPEN",
              },
              orderBy: {
                updatedAt: "desc",
              },
            });

          const activeConversation =
            conversation ??
            (await prisma.conversation.create({
              data: {
                businessId: connection.businessId,
                customerId: customer.id,
                whatsappConnectionId: connection.id,
                status: "OPEN",
                mode: "AI",
              },
            }));

          const existingMessage =
            await prisma.message.findUnique({
              where: {
                externalId: message.id,
              },
            });

          if (existingMessage) {
            continue;
          }

          await prisma.message.create({
            data: {
              conversationId: activeConversation.id,
              businessId: connection.businessId,
              externalId: message.id,
              direction: "INBOUND",
              sender: "CUSTOMER",
              type: "TEXT",
              text,
            },
          });

          await prisma.conversation.update({
            where: {
              id: activeConversation.id,
            },
            data: {
              lastMessageAt: new Date(),
            },
          });

          console.log("WhatsApp message stored:", {
            businessId: connection.businessId,
            conversationId: activeConversation.id,
            customerId: customer.id,
            messageId: message.id,
          });
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);

    return NextResponse.json(
      { received: false },
      { status: 500 }
    );
  }
}