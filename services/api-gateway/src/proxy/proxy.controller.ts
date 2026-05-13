import { All, Controller, Req, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as http from 'http';

const SERVICE_MAP: Record<string, { hostEnvKey: string; portEnvKey: string; defaultHost: string; defaultPort: number }> = {
  auth:         { hostEnvKey: 'AUTH_SERVICE_HOST',        portEnvKey: 'AUTH_SERVICE_PORT',        defaultHost: 'auth-service',        defaultPort: 3001 },
  users:        { hostEnvKey: 'USER_SERVICE_HOST',        portEnvKey: 'USER_SERVICE_PORT',        defaultHost: 'user-service',        defaultPort: 3002 },
  profiles:     { hostEnvKey: 'USER_SERVICE_HOST',        portEnvKey: 'USER_SERVICE_PORT',        defaultHost: 'user-service',        defaultPort: 3002 },
  addresses:    { hostEnvKey: 'USER_SERVICE_HOST',        portEnvKey: 'USER_SERVICE_PORT',        defaultHost: 'user-service',        defaultPort: 3002 },
  listings:     { hostEnvKey: 'LISTING_SERVICE_HOST',     portEnvKey: 'LISTING_SERVICE_PORT',     defaultHost: 'listing-service',     defaultPort: 3003 },
  categories:   { hostEnvKey: 'LISTING_SERVICE_HOST',     portEnvKey: 'LISTING_SERVICE_PORT',     defaultHost: 'listing-service',     defaultPort: 3003 },
  offers:       { hostEnvKey: 'OFFER_SERVICE_HOST',       portEnvKey: 'OFFER_SERVICE_PORT',       defaultHost: 'offer-service',       defaultPort: 3004 },
  trades:       { hostEnvKey: 'TRADE_SERVICE_HOST',       portEnvKey: 'TRADE_SERVICE_PORT',       defaultHost: 'trade-service',       defaultPort: 3005 },
  reputation:   { hostEnvKey: 'REPUTATION_SERVICE_HOST',  portEnvKey: 'REPUTATION_SERVICE_PORT',  defaultHost: 'reputation-service',  defaultPort: 3006 },
  ratings:      { hostEnvKey: 'REPUTATION_SERVICE_HOST',  portEnvKey: 'REPUTATION_SERVICE_PORT',  defaultHost: 'reputation-service',  defaultPort: 3006 },
  'fraud-flags': { hostEnvKey: 'REPUTATION_SERVICE_HOST',  portEnvKey: 'REPUTATION_SERVICE_PORT',  defaultHost: 'reputation-service',  defaultPort: 3006 },
  trust:        { hostEnvKey: 'REPUTATION_SERVICE_HOST',  portEnvKey: 'REPUTATION_SERVICE_PORT',  defaultHost: 'reputation-service',  defaultPort: 3006 },
  disputes:     { hostEnvKey: 'DISPUTE_SERVICE_HOST',     portEnvKey: 'DISPUTE_SERVICE_PORT',     defaultHost: 'dispute-service',     defaultPort: 3007 },
  certificates: { hostEnvKey: 'CERTIFICATE_SERVICE_HOST', portEnvKey: 'CERTIFICATE_SERVICE_PORT', defaultHost: 'certificate-service', defaultPort: 3008 },
  shipments:    { hostEnvKey: 'SHIPPING_SERVICE_HOST',    portEnvKey: 'SHIPPING_SERVICE_PORT',    defaultHost: 'shipping-service',    defaultPort: 3009 },
  payments:     { hostEnvKey: 'PAYMENT_SERVICE_HOST',     portEnvKey: 'PAYMENT_SERVICE_PORT',     defaultHost: 'payment-service',     defaultPort: 3010 },
  centers:      { hostEnvKey: 'TRADE_SERVICE_HOST',      portEnvKey: 'TRADE_SERVICE_PORT',      defaultHost: 'trade-service',      defaultPort: 3005 },
  messaging:    { hostEnvKey: 'MESSAGING_SERVICE_HOST',  portEnvKey: 'MESSAGING_SERVICE_PORT',  defaultHost: 'messaging-service',  defaultPort: 3011 },
  conversations:{ hostEnvKey: 'MESSAGING_SERVICE_HOST',  portEnvKey: 'MESSAGING_SERVICE_PORT',  defaultHost: 'messaging-service',  defaultPort: 3011 },
};

@Controller()
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly targets = new Map<string, { host: string; port: number }>();

  constructor(private readonly config: ConfigService) {
    for (const [route, { hostEnvKey, portEnvKey, defaultHost, defaultPort }] of Object.entries(SERVICE_MAP)) {
      const host = this.config.get<string>(hostEnvKey, defaultHost);
      const port = this.config.get<number>(portEnvKey, defaultPort);
      this.targets.set(route, { host, port });
    }
  }

  @All('api/*')
  async proxyAll(@Req() req: Request, @Res() res: Response) {
    const path = req.originalUrl || req.url;
    const match = path.match(/^\/api\/([^/?]+)(.*)/);
    if (!match) {
      return res.status(404).json({ error: 'Invalid API path' });
    }

    const service = match[1];
    const remainingPath = match[2] || '';
    const target = this.targets.get(service);

    if (!target) {
      return res.status(404).json({ error: `Unknown service: ${service}` });
    }

    const targetPath = `/${service}${remainingPath}`;

    // Forward all headers except 'host' (must point to the backend)
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value && key !== 'host') {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    const proxyReq = http.request(
      {
        hostname: target.host,
        port: target.port,
        path: targetPath,
        method: req.method,
        headers,
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 502);
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value) res.setHeader(key, value);
        }
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (err) => {
      this.logger.error(`Proxy error for ${service}: ${err.message}`);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Bad gateway' });
      }
    });

    // Pipe the raw request body to the backend (works for JSON, multipart, etc.)
    req.pipe(proxyReq);
  }
}
