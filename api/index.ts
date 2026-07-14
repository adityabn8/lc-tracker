// Vercel serverless entrypoint — wraps the Express app.
// Every /api/* request is rewritten here (see vercel.json); Express does the
// actual routing since its routes are already mounted under /api.
import app from "../server/src/app";

export default app;
