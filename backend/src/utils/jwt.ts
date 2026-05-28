import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    env.JWT_ACCESS_SECRET as Secret,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    } as SignOptions
  );

  const refreshToken = jwt.sign(
    { userId },
    env.JWT_REFRESH_SECRET as Secret,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    } as SignOptions
  );

  return {
    accessToken,
    refreshToken,
  };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(
    token,
    env.JWT_ACCESS_SECRET as Secret
  );
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(
    token,
    env.JWT_REFRESH_SECRET as Secret
  );
};
