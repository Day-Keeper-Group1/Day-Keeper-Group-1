/**
 * KAN-29: the list the reference page and openapi.json are built from.
 *
 * Adding a route means adding its definition here.
 */

import { definition as authLogin } from "@/app/api/auth/login/route";
import { definition as authLogout } from "@/app/api/auth/logout/route";
import { definition as authMe } from "@/app/api/auth/me/route";
import type { RouteDefinition } from "./handler";

export const routeDefinitions: RouteDefinition[] = [
  authLogin,
  authLogout,
  authMe,
];
