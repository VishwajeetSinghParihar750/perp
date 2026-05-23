import z from "zod";

const SIGNUP_SCHEMA = z.object({
  username: z.string(),
  password: z.string(),
});

const SIGNIN_SCHEMA = z.object({
  username: z.string(),
  password: z.string(),
});

export { SIGNIN_SCHEMA, SIGNUP_SCHEMA };
