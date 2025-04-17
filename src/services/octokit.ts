import { request } from "@octokit/request";
import { createAppAuth } from "@octokit/auth-app";
import { AppConfig } from "../types";

export async function createOctokitClient(config: AppConfig, installationId: number) {
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