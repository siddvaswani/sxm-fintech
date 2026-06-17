import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Open Payments SDK OUT of the server bundle. The SDK reads its OpenAPI
  // spec files (dist/openapi/specs/*.yaml) from disk at runtime using paths relative
  // to its own location in node_modules. When Next/Turbopack bundles it, those paths
  // break (you get a bogus "/ROOT/node_modules/.../wallet-address-server.yaml" not
  // found). Marking it external makes Next load it normally from node_modules, so the
  // spec files resolve correctly.
  serverExternalPackages: ["@interledger/open-payments"],
};

export default nextConfig;
