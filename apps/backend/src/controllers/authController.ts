import type { Request, Response } from "express";
import { prismaClient } from "@repo/db";
import jwt from "jsonwebtoken";

export async function signup(req: Request, res: Response) {
  const { username, password } = req.body;
  console.log(`[AUTH] Signup attempt for username: ${username}`);

  const findUser = await prismaClient.user.findUnique({ where: { username } });
  if (findUser) {
    console.log(`[AUTH] Signup failed: Username ${username} already exists`);
    res.status(403).json({ error: true, payload: "username already exists" });
    return;
  }

  const user = await prismaClient.user.create({ data: { username, password } });
  console.log(
    `[AUTH] Signup successful for username: ${username}, userId: ${user.id}`,
  );
  res.status(201).json({ error: false, payload: user.id });
}

export async function signin(req: Request, res: Response) {
  const { username, password } = req.body;
  console.log(`[AUTH] Signin attempt for username: ${username}`);

  const user = await prismaClient.user.findUnique({ where: { username } });
  if (!user || user.password != password) {
    console.log(
      `[AUTH] Signin failed: Incorrect credentials for username: ${username}`,
    );
    res.status(400).json({ error: true, payload: "incorrect credentials" });
    return;
  }

  let expireAt = new Date();
  expireAt.setMinutes(expireAt.getMinutes() + 10);

  const jwt_token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      expireAt: expireAt.toISOString(),
    },
    process.env.JWT_SECRET_KEY!,
  );

  console.log(
    `[AUTH] Signin successful for username: ${username}, userId: ${user.id}`,
  );
  res.status(200).json({ error: false, payload: { jwt_token } });
}
