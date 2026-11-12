package api

import (
	_ "embed"
	"net/http"
)

// openAPISpec is the hand-written OpenAPI 3 description of every route in
// Routes(). TestOpenAPIMatchesRoutes fails if the two drift apart.
//
//go:embed openapi.yaml
var openAPISpec []byte

func serveOpenAPI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write(openAPISpec)
}

// swaggerUI renders Swagger UI (from the jsDelivr CDN) against /openapi.yaml.
// Tokens entered with "Authorize" persist in this browser's local storage.
const swaggerUI = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chris Moore Interior Decor API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css">
  <style>
    body { margin: 0; background: #fbf8f4; }
    .swagger-ui .topbar { background: #1f1b17; }
    .swagger-ui .info .title { font-family: Georgia, serif; }
    .swagger-ui .btn.authorize, .swagger-ui .btn.execute { background: #a8875e; border-color: #a8875e; color: #fff; }
    .swagger-ui .btn.authorize svg { fill: #fff; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/openapi.yaml",
      dom_id: "#swagger-ui",
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
      docExpansion: "list",
      defaultModelsExpandDepth: 0,
    });
  </script>
</body>
</html>`

func serveSwaggerUI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(swaggerUI))
}
