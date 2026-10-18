import { router } from "./trpc";

import { adminRouter } from "./routes/admin/route";
import { apiKeysRouter } from "./routes/api-keys/route";
import { aiRouter } from "./routes/ai/route";
import { authRouter } from "./routes/auth/route";
import { endpointRouter } from "./routes/endpoint/route";
import { fieldsRouter } from "./routes/fields/route";
import { formsRouter } from "./routes/forms/route";
import { healthRouter } from "./routes/health/route";
import { integrationsRouter } from "./routes/integrations/route";
import { publicRouter } from "./routes/public/route";
import { responsesRouter } from "./routes/responses/route";
import { themesRouter } from "./routes/themes/route";
import { uploadsRouter } from "./routes/uploads/route";

export const serverRouter = router({
  health: healthRouter,
  auth: authRouter,
  themes: themesRouter,
  forms: formsRouter,
  fields: fieldsRouter,
  responses: responsesRouter,
  public: publicRouter,
  endpoint: endpointRouter,
  admin: adminRouter,
  ai: aiRouter,
  uploads: uploadsRouter,
  integrations: integrationsRouter,
  apiKeys: apiKeysRouter,
});

export { createContext } from "./context";
export { auth } from "./auth";
export { userFromApiKey } from "./api-keys";
export type { Context } from "./context";
export type { Auth } from "./auth";

export type ServerRouter = typeof serverRouter;
