import { request } from "@octokit/request";
import { createAppAuth } from "@octokit/auth-app";

/**
 * Creates an authenticated Octokit client for the given installation
 * @param {import('../types/index.js').AppConfig} config - Application configuration
 * @param {number} installationId - GitHub App installation ID
 * @returns {Promise<import('@octokit/request').RequestInterface>} Authenticated request function
 */
export async function createOctokitClient(config, installationId) {
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