export function send(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json"
  });

  if (body == null) {
    response.end();
    return;
  }

  response.end(JSON.stringify(body));
}
