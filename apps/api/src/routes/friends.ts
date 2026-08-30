import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { toPublicUserDTO } from "../lib/dto.js";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  listFriends,
  listFriendRequests,
} from "../services/friends.js";

const sendRequestSchema = z.object({ username: z.string().min(1) });

export const friendRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireAuth);

  app.get("/", async (request, reply) => {
    const friends = await listFriends(request.currentUser!.id);
    return reply.send({ data: friends.map(toPublicUserDTO) });
  });

  app.delete<{ Params: { friendId: string } }>("/:friendId", async (request, reply) => {
    await removeFriend(request.currentUser!.id, request.params.friendId);
    return reply.send({ data: { ok: true } });
  });

  app.get("/requests", async (request, reply) => {
    const { incoming, outgoing } = await listFriendRequests(request.currentUser!.id);
    return reply.send({
      data: {
        incoming: incoming.map((r) => ({ id: r.id, createdAt: r.createdAt, user: toPublicUserDTO(r.sender) })),
        outgoing: outgoing.map((r) => ({ id: r.id, createdAt: r.createdAt, user: toPublicUserDTO(r.receiver) })),
      },
    });
  });

  app.post("/requests", async (request, reply) => {
    const body = sendRequestSchema.parse(request.body);
    const result = await sendFriendRequest(request.currentUser!.id, body.username);
    return reply.status(201).send({ data: result });
  });

  app.post<{ Params: { id: string } }>("/requests/:id/accept", async (request, reply) => {
    const result = await acceptFriendRequest(request.currentUser!.id, request.params.id);
    return reply.send({ data: result });
  });

  app.post<{ Params: { id: string } }>("/requests/:id/reject", async (request, reply) => {
    const result = await rejectFriendRequest(request.currentUser!.id, request.params.id);
    return reply.send({ data: result });
  });

  app.delete<{ Params: { id: string } }>("/requests/:id", async (request, reply) => {
    await cancelFriendRequest(request.currentUser!.id, request.params.id);
    return reply.send({ data: { ok: true } });
  });
};
