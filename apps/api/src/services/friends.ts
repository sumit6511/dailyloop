import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";

export type Relationship = "self" | "friends" | "request_sent" | "request_received" | "none";

function normalizePair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

export async function areFriends(idA: string, idB: string): Promise<boolean> {
  const [userAId, userBId] = normalizePair(idA, idB);
  const friendship = await prisma.friendship.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  return !!friendship;
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId));
}

export async function listFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: { userA: true, userB: true },
  });
  return friendships.map((f) => (f.userAId === userId ? f.userB : f.userA));
}

export async function listFriendRequests(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    prisma.friendRequest.findMany({
      where: { receiverId: userId, status: "PENDING" },
      include: { sender: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: { senderId: userId, status: "PENDING" },
      include: { receiver: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { incoming, outgoing };
}

export async function getRelationship(viewerId: string, targetId: string): Promise<Relationship> {
  if (viewerId === targetId) return "self";
  if (await areFriends(viewerId, targetId)) return "friends";

  const sent = await prisma.friendRequest.findUnique({
    where: { senderId_receiverId: { senderId: viewerId, receiverId: targetId } },
  });
  if (sent?.status === "PENDING") return "request_sent";

  const received = await prisma.friendRequest.findUnique({
    where: { senderId_receiverId: { senderId: targetId, receiverId: viewerId } },
  });
  if (received?.status === "PENDING") return "request_received";

  return "none";
}

export async function sendFriendRequest(senderId: string, targetUsername: string) {
  const target = await prisma.user.findUnique({ where: { username: targetUsername } });
  if (!target) throw Errors.notFound("User not found");
  if (target.id === senderId) throw Errors.badRequest("You can't send a friend request to yourself");

  if (await areFriends(senderId, target.id)) throw Errors.conflict("You're already friends");

  // If they already sent us a request, sending one back just accepts theirs instead of
  // creating a redundant duplicate — matches how most social apps behave.
  const reverseRequest = await prisma.friendRequest.findUnique({
    where: { senderId_receiverId: { senderId: target.id, receiverId: senderId } },
  });
  if (reverseRequest?.status === "PENDING") {
    return acceptFriendRequest(senderId, reverseRequest.id);
  }

  const existing = await prisma.friendRequest.findUnique({
    where: { senderId_receiverId: { senderId, receiverId: target.id } },
  });
  if (existing?.status === "PENDING") throw Errors.conflict("Friend request already sent");

  // A prior REJECTED/CANCELED (or ACCEPTED-then-unfriended) request between this exact pair
  // reuses its row rather than violating the (senderId, receiverId) unique constraint.
  if (existing) {
    return prisma.friendRequest.update({
      where: { id: existing.id },
      data: { status: "PENDING", respondedAt: null },
    });
  }
  return prisma.friendRequest.create({ data: { senderId, receiverId: target.id, status: "PENDING" } });
}

export async function acceptFriendRequest(userId: string, requestId: string) {
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.receiverId !== userId) throw Errors.notFound("Friend request not found");
  if (request.status !== "PENDING") throw Errors.conflict("This request is no longer pending");

  const [userAId, userBId] = normalizePair(request.senderId, request.receiverId);
  return prisma.$transaction(async (tx) => {
    await tx.friendRequest.update({ where: { id: request.id }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    const existingFriendship = await tx.friendship.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
    if (existingFriendship) return existingFriendship;
    return tx.friendship.create({ data: { userAId, userBId } });
  });
}

export async function rejectFriendRequest(userId: string, requestId: string) {
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.receiverId !== userId) throw Errors.notFound("Friend request not found");
  if (request.status !== "PENDING") throw Errors.conflict("This request is no longer pending");
  return prisma.friendRequest.update({
    where: { id: request.id },
    data: { status: "REJECTED", respondedAt: new Date() },
  });
}

export async function cancelFriendRequest(userId: string, requestId: string) {
  const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
  if (!request || request.senderId !== userId) throw Errors.notFound("Friend request not found");
  if (request.status !== "PENDING") throw Errors.conflict("This request is no longer pending");
  return prisma.friendRequest.update({
    where: { id: request.id },
    data: { status: "CANCELED", respondedAt: new Date() },
  });
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const [userAId, userBId] = normalizePair(userId, friendId);
  await prisma.friendship.deleteMany({ where: { userAId, userBId } });
}
