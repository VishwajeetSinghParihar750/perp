import type { JwtPayload } from "jsonwebtoken";
import type { IncomingMessage } from "node:http";
import type WebSocket from "ws";
import jwt from "jsonwebtoken";

function verifyJwtToken(ws: WebSocket, req: IncomingMessage): boolean {
  //
  try {
    if (!req.url) {
      console.log("[WS_VERIFY] URL missing");
      return false;
    }

    const url = new URL(req.url, "http://anythingWorksHere");

    const jwt_token = url.searchParams.get("jwt_token");

    if (!jwt_token) {
      console.log("[WS_VERIFY] jwt_token parameter missing in URL");
      return false;
    }

    const decodedUser = jwt.verify(
      jwt_token,
      process.env.JWT_SECRET_KEY!,
    ) as JwtPayload;

    console.log("[WS_VERIFY] Decoded user:", decodedUser);

    //
    const currentTime = new Date(Date.now()).toISOString();
    console.log(
      `[WS_VERIFY] Checking expiry: user expireAt = ${decodedUser.expireAt}, current time = ${currentTime}`,
    );
    if (decodedUser.expireAt <= currentTime) {
      console.log("[WS_VERIFY] Token has expired");
      return false;
    }

    ws.user = { username: decodedUser.username, id: decodedUser.id };

    return true;
  } catch (e) {
    console.error("[WS_VERIFY] Verification exception thrown:", e);
    return false;
  }
}

export { verifyJwtToken };
