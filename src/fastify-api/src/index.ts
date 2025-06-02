import buildServer from "./server.js";

/**
 * Self-executing async function to start the server
 */
(async () => {
  try {
    const server = await buildServer();
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || "0.0.0.0";

    await server.listen({ port, host });
    console.log(`Server is running on ${host}:${port}`);
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();
