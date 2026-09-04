const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

http.createServer((request, response) => {
  let requestedPath = decodeURIComponent((request.url || "/").split("?")[0]);
  if (requestedPath === "/") requestedPath = "/index.html";
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
}).listen(4173, "127.0.0.1", () => {
  console.log("Card Demo preview: http://127.0.0.1:4173/");
});
