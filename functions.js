export default {
  async fetch(request) {
    return Response.json({
      ok: true,
      name: "pg-huntshade",
      path: new URL(request.url).pathname,
    });
  },
};
