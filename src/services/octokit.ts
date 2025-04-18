import { request } from "@octokit/request";
import { createAppAuth } from "@octokit/auth-app";
import { AppConfig } from "../types";
import type { RequestInterface } from "@octokit/request";

export async function createOctokitClient(config: AppConfig, installationId: number): Promise<RequestInterface> {
  return request.defaults({
    request: { 
      hook: createAppAuth({ 
        appId: config.appId, 
        privateKey: config.privateKey, 
        installationId 
      }) 
    },
  });
}